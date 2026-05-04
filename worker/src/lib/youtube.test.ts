import { describe, it, expect, vi, afterEach } from 'vitest'
import { extractYouTubePlaylistId, fetchYouTubePlaylistTracks } from './youtube'

afterEach(() => vi.restoreAllMocks())

function mockFetch(status: number, body: object) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce({
    status,
    ok: status >= 200 && status < 300,
    json: () => Promise.resolve(body),
  }))
}

function playlistResponse(videoIds: (string | undefined)[]) {
  return {
    items: videoIds.map(videoId => ({
      snippet: { resourceId: { kind: 'youtube#video', videoId } },
    })),
  }
}

describe('extractYouTubePlaylistId', () => {
  it('extracts list param from youtube.com/playlist', () => {
    expect(extractYouTubePlaylistId('https://www.youtube.com/playlist?list=PLabc123')).toBe('PLabc123')
  })

  it('extracts list param from music.youtube.com/playlist', () => {
    expect(extractYouTubePlaylistId('https://music.youtube.com/playlist?list=PLxyz')).toBe('PLxyz')
  })

  it('extracts list param from youtube.com without www', () => {
    expect(extractYouTubePlaylistId('https://youtube.com/playlist?list=PLabc')).toBe('PLabc')
  })

  it('returns null for watch URLs (not a playlist page)', () => {
    expect(extractYouTubePlaylistId('https://www.youtube.com/watch?v=abc&list=PLabc')).toBeNull()
  })

  it('returns null for channel URLs', () => {
    expect(extractYouTubePlaylistId('https://www.youtube.com/channel/UCabc')).toBeNull()
  })

  it('returns null for invalid URLs', () => {
    expect(extractYouTubePlaylistId('not-a-url')).toBeNull()
    expect(extractYouTubePlaylistId('')).toBeNull()
  })

  it('returns null for unknown hostnames', () => {
    expect(extractYouTubePlaylistId('https://example.com/playlist?list=PLabc')).toBeNull()
  })
})

describe('fetchYouTubePlaylistTracks', () => {
  it('returns watch URLs for each video', async () => {
    mockFetch(200, playlistResponse(['dQw4w9WgXcQ', 'abc123']))
    const { urls } = await fetchYouTubePlaylistTracks('PLabc', 'key')
    expect(urls).toEqual([
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      'https://www.youtube.com/watch?v=abc123',
    ])
  })

  it('filters out items with no videoId (deleted/private)', async () => {
    mockFetch(200, playlistResponse(['dQw4w9WgXcQ', undefined, 'abc123']))
    const { urls } = await fetchYouTubePlaylistTracks('PLabc', 'key')
    expect(urls).toHaveLength(2)
  })

  it('throws on 404', async () => {
    mockFetch(404, {})
    await expect(fetchYouTubePlaylistTracks('PLabc', 'key')).rejects.toThrow('not found or private')
  })

  it('throws on 403', async () => {
    mockFetch(403, {})
    await expect(fetchYouTubePlaylistTracks('PLabc', 'key')).rejects.toThrow('not accessible')
  })

  it('throws on other non-ok status', async () => {
    mockFetch(500, {})
    await expect(fetchYouTubePlaylistTracks('PLabc', 'key')).rejects.toThrow('YouTube API error (500)')
  })

  it('sends Referer header for API key restriction', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({
      status: 200, ok: true,
      json: () => Promise.resolve(playlistResponse(['abc'])),
    })
    vi.stubGlobal('fetch', fetchMock)
    await fetchYouTubePlaylistTracks('PLabc', 'key')
    expect(fetchMock.mock.calls[0][1]?.headers?.Referer).toBe('https://plevoid.xyz')
  })
})
