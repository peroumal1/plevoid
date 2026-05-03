/// <reference types="@cloudflare/vitest-pool-workers" />
import { env, SELF } from "cloudflare:test"
import { describe, it, expect, vi, beforeAll, afterEach } from "vitest"

beforeAll(async () => {
  const schema = (env as any).DB_SCHEMA as string
  // exec() splits on newlines; use batch() of prepared statements instead
  const stmts = schema
    .split(';')
    .map((s: string) => s.trim())
    .filter((s: string) => s.length > 0)
    .map((s: string) => (env as any).plevoid_db.prepare(s))
  await (env as any).plevoid_db.batch(stmts)
})

afterEach(() => vi.unstubAllGlobals())

// Shared state across the sequentially-dependent CRUD tests
let playlistId: string
let editToken: string
let trackId: string

describe("playlist CRUD", () => {
  it("creates a playlist", async () => {
    const res = await SELF.fetch("https://worker.test/api/playlists", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Smoke Test" }),
    })
    expect(res.status).toBe(201)
    const data = await res.json() as { id: string; edit_token: string }
    expect(data.id).toBeTruthy()
    expect(data.edit_token).toBeTruthy()
    playlistId = data.id
    editToken = data.edit_token
  })

  it("fetches the empty playlist", async () => {
    const res = await SELF.fetch(`https://worker.test/api/playlists/${playlistId}`)
    expect(res.status).toBe(200)
    const data = await res.json() as { id: string; title: string; tracks: unknown[] }
    expect(data.id).toBe(playlistId)
    expect(data.title).toBe("Smoke Test")
    expect(data.tracks).toEqual([])
  })

  it("adds a track (Odesli blocked → queued)", async () => {
    // Block Odesli so addTrack falls back to queue; track still returns 201
    vi.stubGlobal('fetch', vi.fn().mockRejectedValueOnce(new Error('network blocked')))

    const res = await SELF.fetch(`https://worker.test/api/playlists/${playlistId}/tracks`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Edit-Token": editToken },
      body: JSON.stringify({ url: "https://open.spotify.com/track/4iV5W9uYEdYUVa79Axb7Rh" }),
    })
    expect(res.status).toBe(201)
    const data = await res.json() as { id: string; url_original: string }
    expect(data.id).toBeTruthy()
    expect(data.url_original).toBe("https://open.spotify.com/track/4iV5W9uYEdYUVa79Axb7Rh")
    trackId = data.id
  })

  it("fetches playlist with the added track", async () => {
    const res = await SELF.fetch(`https://worker.test/api/playlists/${playlistId}`)
    const data = await res.json() as { tracks: Array<{ id: string }> }
    expect(data.tracks).toHaveLength(1)
    expect(data.tracks[0].id).toBe(trackId)
  })

  it("rejects mutations with a bad token", async () => {
    const res = await SELF.fetch(`https://worker.test/api/playlists/${playlistId}/tracks`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Edit-Token": "wrong-token" },
      body: JSON.stringify({ url: "https://open.spotify.com/track/abc" }),
    })
    expect(res.status).toBe(403)
  })

  it("deletes the track", async () => {
    const res = await SELF.fetch(
      `https://worker.test/api/playlists/${playlistId}/tracks/${trackId}`,
      { method: "DELETE", headers: { "X-Edit-Token": editToken } }
    )
    expect(res.status).toBe(200)
    const data = await res.json() as { success: boolean }
    expect(data.success).toBe(true)
  })

  it("returns 404 for an unknown playlist", async () => {
    const res = await SELF.fetch("https://worker.test/api/playlists/doesnotexist")
    expect(res.status).toBe(404)
  })
})

describe("Deezer import", () => {
  it("imports tracks from a public Deezer playlist URL", async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        data: [
          { id: 1, link: "https://www.deezer.com/track/111" },
          { id: 2, link: "https://www.deezer.com/track/222" },
          { id: 3, link: "https://www.deezer.com/track/333" },
        ],
        total: 3,
      }),
    }))

    const res = await SELF.fetch(`https://worker.test/api/playlists/${playlistId}/import/deezer`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Edit-Token": editToken },
      body: JSON.stringify({ playlist_url: "https://www.deezer.com/playlist/99999" }),
    })
    expect(res.status).toBe(201)
    const data = await res.json() as { imported: number; skipped: number }
    expect(data.imported).toBe(3)
    expect(data.skipped).toBe(0)
  })
})

describe("Spotify import", () => {
  it("imports tracks from a public Spotify playlist URL", async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: "test-token", expires_in: 3600 }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          total: 2,
          items: [
            { track: { external_urls: { spotify: "https://open.spotify.com/track/aaa" } } },
            { track: { external_urls: { spotify: "https://open.spotify.com/track/bbb" } } },
          ],
        }),
      })
    )

    const res = await SELF.fetch(`https://worker.test/api/playlists/${playlistId}/import/spotify`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Edit-Token": editToken },
      body: JSON.stringify({ playlist_url: "https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M" }),
    })
    expect(res.status).toBe(201)
    const data = await res.json() as { imported: number; skipped: number }
    expect(data.imported).toBe(2)
    expect(data.skipped).toBe(0)
  })
})
