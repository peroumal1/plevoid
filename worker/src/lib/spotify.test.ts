import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { extractSpotifyPlaylistId, fetchSpotifyPlaylistTracks, searchSpotify } from './spotify'

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

// fetchSpotifyPlaylistTracks and searchSpotify share a module-level token cache.
// We advance system time 2h per test so any token cached by the previous test appears
// expired (tokens last ~59 min, 2h > 59 min).
const BASE_TIME = Date.now()
let fakeTimeOffset = 0

function advanceFakeTime() {
  fakeTimeOffset += 2 * 60 * 60 * 1000
  vi.useFakeTimers()
  vi.setSystemTime(BASE_TIME + fakeTimeOffset)
}

describe('fetchSpotifyPlaylistTracks', () => {
  beforeEach(advanceFakeTime)
  afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks() })

  it('returns track URLs from a playlist', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'tok', expires_in: 3600 }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          total: 2,
          items: [
            { track: { external_urls: { spotify: 'https://open.spotify.com/track/aaa' } } },
            { track: { external_urls: { spotify: 'https://open.spotify.com/track/bbb' } } },
          ],
        }),
      })
    )
    const result = await fetchSpotifyPlaylistTracks('cid', 'csecret', 'playlist-id')
    expect(result.urls).toEqual([
      'https://open.spotify.com/track/aaa',
      'https://open.spotify.com/track/bbb',
    ])
    expect(result.total).toBe(2)
  })

  it('filters out null tracks (local tracks, unplayable items)', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'tok', expires_in: 3600 }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          total: 2,
          items: [
            { track: null },
            { track: { external_urls: { spotify: 'https://open.spotify.com/track/aaa' } } },
          ],
        }),
      })
    )
    const result = await fetchSpotifyPlaylistTracks('cid', 'csecret', 'playlist-id')
    expect(result.urls).toEqual(['https://open.spotify.com/track/aaa'])
  })

  it('throws when Spotify auth fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce({ ok: false, status: 401 }))
    await expect(fetchSpotifyPlaylistTracks('bad-id', 'bad-secret', 'playlist-id'))
      .rejects.toThrow('Spotify auth failed')
  })

  it('throws a descriptive error on 404 (private or editorial playlist)', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'tok', expires_in: 3600 }),
      })
      .mockResolvedValueOnce({ ok: false, status: 404 })
    )
    await expect(fetchSpotifyPlaylistTracks('cid', 'csecret', 'private-playlist'))
      .rejects.toThrow('Spotify playlist not found')
  })

  it('throws on other Spotify API errors', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'tok', expires_in: 3600 }),
      })
      .mockResolvedValueOnce({ ok: false, status: 500 })
    )
    await expect(fetchSpotifyPlaylistTracks('cid', 'csecret', 'playlist-id'))
      .rejects.toThrow('Spotify API error (500)')
  })
})

describe('searchSpotify', () => {
  beforeEach(advanceFakeTime)
  afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks() })

  it('returns formatted results using the smallest album image', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'tok', expires_in: 3600 }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          tracks: {
            items: [{
              name: 'Test Song',
              artists: [{ name: 'Test Artist' }],
              album: {
                images: [
                  { url: 'https://i.scdn.co/image/large.jpg' },
                  { url: 'https://i.scdn.co/image/small.jpg' },
                ],
              },
              external_urls: { spotify: 'https://open.spotify.com/track/xyz' },
            }],
          },
        }),
      })
    )
    const results = await searchSpotify('cid', 'csecret', 'test song')
    expect(results).toEqual([{
      title: 'Test Song',
      artist: 'Test Artist',
      artwork: 'https://i.scdn.co/image/small.jpg',
      url: 'https://open.spotify.com/track/xyz',
    }])
  })

  it('returns empty array when search API returns an error', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'tok', expires_in: 3600 }),
      })
      .mockResolvedValueOnce({ ok: false, status: 503 })
    )
    const results = await searchSpotify('cid', 'csecret', 'test')
    expect(results).toEqual([])
  })
})
