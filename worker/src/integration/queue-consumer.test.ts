/// <reference types="@cloudflare/vitest-pool-workers" />
import { env } from "cloudflare:test"
import { describe, it, expect, vi, beforeAll, afterEach } from "vitest"
import worker from "../../src/index"

beforeAll(async () => {
  const schema = (env as any).DB_SCHEMA as string
  const stmts = schema
    .split(';')
    .map((s: string) => s.trim())
    .filter((s: string) => s.length > 0)
    .map((s: string) => (env as any).plevoid_db.prepare(s))
  await (env as any).plevoid_db.batch(stmts)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

// Minimal valid Odesli payload
const ODESLI_OK = {
  entityUniqueId: 'spotify_song:test',
  pageUrl: 'https://song.link/s/test',
  linksByPlatform: { spotify: { url: 'https://open.spotify.com/track/test' } },
  entitiesByUniqueId: { 'spotify_song:test': { title: 'Test Song', artistName: 'Test Artist' } },
}

// 429 mock response — Retry-After: 1 so fake timers only need to advance 6s (1+5)
const ODESLI_429 = {
  ok: false,
  status: 429,
  headers: { get: (h: string) => h === 'retry-after' ? '1' : null },
}

async function insertTrack(url = 'https://open.spotify.com/track/test'): Promise<string> {
  const playlistId = crypto.randomUUID()
  const trackId = crypto.randomUUID()
  const now = Math.floor(Date.now() / 1000)
  const db = (env as any).plevoid_db
  await db.prepare('INSERT INTO playlists (id, edit_token, title, created_at) VALUES (?, ?, ?, ?)')
    .bind(playlistId, crypto.randomUUID(), 'Test', now).run()
  await db.prepare('INSERT INTO tracks (id, playlist_id, url_original, odesli_data, added_at, position) VALUES (?, ?, ?, NULL, ?, 1)')
    .bind(trackId, playlistId, url, now).run()
  return trackId
}

function makeBatch(trackId: string, url: string) {
  const ack = vi.fn()
  const retry = vi.fn()
  const batch = {
    queue: 'plevoid-odesli-queue',
    messages: [{ id: 'msg-1', timestamp: new Date(), body: { trackId, url }, attempts: 1, ack, retry }],
    ackAll: vi.fn(),
    retryAll: vi.fn(),
  }
  return { batch, ack, retry }
}

async function runConsumer(batch: ReturnType<typeof makeBatch>['batch']) {
  vi.useFakeTimers()
  const p = worker.queue(batch as any, env as any)
  await vi.runAllTimersAsync()
  await p
}

async function getOdesliData(trackId: string) {
  const row = await (env as any).plevoid_db
    .prepare('SELECT odesli_data FROM tracks WHERE id = ?').bind(trackId).first()
  return row?.odesli_data ? JSON.parse(row.odesli_data) : null
}

describe("queue consumer", () => {
  it("acks and writes odesli_data on 200", async () => {
    const trackId = await insertTrack()
    const { batch, ack, retry } = makeBatch(trackId, 'https://open.spotify.com/track/test')

    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce({
      ok: true, status: 200, json: async () => ODESLI_OK,
    }))

    await runConsumer(batch)

    expect(ack).toHaveBeenCalledOnce()
    expect(retry).not.toHaveBeenCalled()
    expect((await getOdesliData(trackId)).entityUniqueId).toBe('spotify_song:test')
  })

  it("acks and stores _notFound on 404", async () => {
    const trackId = await insertTrack()
    const { batch, ack, retry } = makeBatch(trackId, 'https://open.spotify.com/track/test')

    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce({ ok: false, status: 404 }))

    await runConsumer(batch)

    expect(ack).toHaveBeenCalledOnce()
    expect(retry).not.toHaveBeenCalled()
    expect((await getOdesliData(trackId))._notFound).toBe(true)
  })

  it("sleeps full Retry-After on 429, then acks on success", async () => {
    const trackId = await insertTrack()
    const { batch, ack, retry } = makeBatch(trackId, 'https://open.spotify.com/track/test')

    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(ODESLI_429)
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ODESLI_OK })
    )

    await runConsumer(batch)

    expect(ack).toHaveBeenCalledOnce()
    expect(retry).not.toHaveBeenCalled()
    expect((await getOdesliData(trackId)).entityUniqueId).toBe('spotify_song:test')
  })

  it("calls retry (not ack) when 429 persists after maxWaitCycles", async () => {
    const trackId = await insertTrack()
    const { batch, ack, retry } = makeBatch(trackId, 'https://open.spotify.com/track/test')

    // Always 429 — second call after the wait also rate-limited
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(ODESLI_429))

    await runConsumer(batch)

    expect(retry).toHaveBeenCalledOnce()
    expect(ack).not.toHaveBeenCalled()
    expect(await getOdesliData(trackId)).toBeNull()
  })
})
