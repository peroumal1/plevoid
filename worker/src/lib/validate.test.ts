import { describe, it, expect } from 'vitest'
import { parseMusicUrl } from './validate'

describe('parseMusicUrl', () => {
  it('accepts Spotify track URLs', () => {
    const result = parseMusicUrl('https://open.spotify.com/track/4iV5W9uYEdYUVa79Axb7Rh')
    expect(result).not.toBeNull()
    expect(result?.hostname).toBe('open.spotify.com')
  })

  it('accepts Apple Music URLs and keeps i param', () => {
    const result = parseMusicUrl('https://music.apple.com/us/album/dark-side/123456?i=789')
    expect(result).not.toBeNull()
    expect(result?.searchParams.get('i')).toBe('789')
  })

  it('accepts YouTube URLs and keeps v param, strips tracking', () => {
    const result = parseMusicUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ&feature=share&si=xyz')
    expect(result).not.toBeNull()
    expect(result?.searchParams.get('v')).toBe('dQw4w9WgXcQ')
    expect(result?.searchParams.has('feature')).toBe(false)
    expect(result?.searchParams.has('si')).toBe(false)
  })

  it('accepts youtu.be URLs', () => {
    expect(parseMusicUrl('https://youtu.be/dQw4w9WgXcQ')).not.toBeNull()
  })

  it('accepts YouTube Music URLs', () => {
    expect(parseMusicUrl('https://music.youtube.com/watch?v=abc123')).not.toBeNull()
  })

  it('strips tracking params from Spotify', () => {
    const result = parseMusicUrl('https://open.spotify.com/track/abc?si=xyz123&context=foo')
    expect(result).not.toBeNull()
    expect(result?.searchParams.has('si')).toBe(false)
    expect(result?.searchParams.has('context')).toBe(false)
  })

  it('accepts Deezer URLs', () => {
    expect(parseMusicUrl('https://www.deezer.com/track/12345')).not.toBeNull()
    expect(parseMusicUrl('https://deezer.com/track/12345')).not.toBeNull()
  })

  it('accepts Tidal URLs', () => {
    expect(parseMusicUrl('https://tidal.com/browse/track/12345')).not.toBeNull()
    expect(parseMusicUrl('https://listen.tidal.com/track/12345')).not.toBeNull()
  })

  it('accepts SoundCloud URLs', () => {
    expect(parseMusicUrl('https://soundcloud.com/artist/track')).not.toBeNull()
    expect(parseMusicUrl('https://www.soundcloud.com/artist/track')).not.toBeNull()
  })

  it('accepts Bandcamp artist subdomain URLs', () => {
    expect(parseMusicUrl('https://artist.bandcamp.com/track/song')).not.toBeNull()
  })

  it('accepts bandcamp.com root', () => {
    expect(parseMusicUrl('https://bandcamp.com/track/song')).not.toBeNull()
  })

  it('rejects http protocol', () => {
    expect(parseMusicUrl('http://open.spotify.com/track/abc')).toBeNull()
  })

  it('rejects unknown hostnames', () => {
    expect(parseMusicUrl('https://example.com/track/abc')).toBeNull()
  })

  it('rejects invalid strings', () => {
    expect(parseMusicUrl('not-a-url')).toBeNull()
    expect(parseMusicUrl('')).toBeNull()
  })

  it('returns a URL object with href property', () => {
    const result = parseMusicUrl('https://open.spotify.com/track/abc')
    expect(result).toBeInstanceOf(URL)
    expect(result?.href).toMatch(/^https:\/\/open\.spotify\.com/)
  })
})
