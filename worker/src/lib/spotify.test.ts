import { describe, it, expect, vi, afterEach } from 'vitest'
import { extractSpotifyPlaylistId, fetchSpotifyEmbedTracks } from './spotify'

const makeEmbedHtml = (trackList: Array<{ uri: string }>) => {
  const data = { props: { pageProps: { state: { data: { entity: { trackList } } } } } }
  return `<script id="__NEXT_DATA__" type="application/json">${JSON.stringify(data)}</script>`
}

describe('extractSpotifyPlaylistId', () => {
  it('extracts ID from open.spotify.com', () => {
    expect(extractSpotifyPlaylistId('https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M')).toBe('37i9dQZF1DXcBWIGoYBM5M')
  })

  it('returns null for non-playlist URLs', () => {
    expect(extractSpotifyPlaylistId('https://open.spotify.com/track/abc123')).toBeNull()
  })

  it('returns null for non-Spotify hostnames', () => {
    expect(extractSpotifyPlaylistId('https://example.com/playlist/abc')).toBeNull()
  })

  it('returns null for invalid strings', () => {
    expect(extractSpotifyPlaylistId('not-a-url')).toBeNull()
    expect(extractSpotifyPlaylistId('')).toBeNull()
  })
})

describe('fetchSpotifyEmbedTracks', () => {
  afterEach(() => { vi.restoreAllMocks() })

  it('returns track URLs parsed from embed __NEXT_DATA__', async () => {
    const html = makeEmbedHtml([
      { uri: 'spotify:track:aaa' },
      { uri: 'spotify:track:bbb' },
    ])
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce({ ok: true, status: 200, text: async () => html }))
    const result = await fetchSpotifyEmbedTracks('playlist-id')
    expect(result.urls).toEqual([
      'https://open.spotify.com/track/aaa',
      'https://open.spotify.com/track/bbb',
    ])
  })

  it('throws on 404', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce({ ok: false, status: 404 }))
    await expect(fetchSpotifyEmbedTracks('private-playlist'))
      .rejects.toThrow('Spotify playlist not found or private')
  })

  it('throws on other non-ok responses', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce({ ok: false, status: 503 }))
    await expect(fetchSpotifyEmbedTracks('playlist-id'))
      .rejects.toThrow('Spotify embed error (503)')
  })

  it('throws when __NEXT_DATA__ is missing from the page', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce({ ok: true, status: 200, text: async () => '<html>no data</html>' }))
    await expect(fetchSpotifyEmbedTracks('playlist-id'))
      .rejects.toThrow('Could not parse Spotify embed page')
  })
})
