import { describe, it, expect, vi, afterEach } from 'vitest'
import { extractDeezerPlaylistId, resolveDeezerPlaylistId } from './deezer'

describe('extractDeezerPlaylistId', () => {
  it('extracts ID from www.deezer.com', () => {
    expect(extractDeezerPlaylistId('https://www.deezer.com/playlist/12345678')).toBe('12345678')
  })

  it('extracts ID from deezer.com without www', () => {
    expect(extractDeezerPlaylistId('https://deezer.com/playlist/12345678')).toBe('12345678')
  })

  it('extracts ID with locale prefix in path', () => {
    expect(extractDeezerPlaylistId('https://www.deezer.com/en/playlist/12345678')).toBe('12345678')
  })

  it('returns null for link.deezer.com (short link, not a direct URL)', () => {
    expect(extractDeezerPlaylistId('https://link.deezer.com/s/abc123')).toBeNull()
  })

  it('returns null for non-Deezer URLs', () => {
    expect(extractDeezerPlaylistId('https://open.spotify.com/playlist/abc')).toBeNull()
  })

  it('returns null for Deezer URLs without a playlist path', () => {
    expect(extractDeezerPlaylistId('https://www.deezer.com/track/12345')).toBeNull()
  })

  it('returns null for invalid strings', () => {
    expect(extractDeezerPlaylistId('not-a-url')).toBeNull()
    expect(extractDeezerPlaylistId('')).toBeNull()
  })
})

describe('resolveDeezerPlaylistId', () => {
  afterEach(() => { vi.restoreAllMocks() })

  it('resolves a direct deezer.com URL without making a fetch', async () => {
    const spy = vi.spyOn(global, 'fetch')
    const id = await resolveDeezerPlaylistId('https://www.deezer.com/playlist/99999')
    expect(id).toBe('99999')
    expect(spy).not.toHaveBeenCalled()
  })

  it('follows a link.deezer.com short link and extracts the playlist ID', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      headers: { get: (h: string) => h === 'location' ? 'https://www.deezer.com/playlist/42?utm_source=deezer' : null },
    }))
    expect(await resolveDeezerPlaylistId('https://link.deezer.com/s/abc')).toBe('42')
  })

  it('handles encoded characters in the redirect location', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      headers: { get: (h: string) => h === 'location' ? 'https%3A%2F%2Fwww.deezer.com%2Fplaylist%2F777' : null },
    }))
    expect(await resolveDeezerPlaylistId('https://link.deezer.com/s/xyz')).toBe('777')
  })

  it('returns null when the redirect has no playlist ID', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      headers: { get: () => 'https://www.deezer.com/track/12345' },
    }))
    expect(await resolveDeezerPlaylistId('https://link.deezer.com/s/xyz')).toBeNull()
  })

  it('returns null for unrecognised hostnames', async () => {
    expect(await resolveDeezerPlaylistId('https://example.com/playlist/123')).toBeNull()
  })

  it('returns null when fetch throws', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network error')))
    expect(await resolveDeezerPlaylistId('https://link.deezer.com/s/bad')).toBeNull()
  })
})
