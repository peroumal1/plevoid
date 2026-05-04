import { describe, it, expect } from 'vitest'
import { parseMusicUrl, isPlaylistUrl } from './validate'

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
    expect(parseMusicUrl('https://on.soundcloud.com/bkajOOXyAg1ZIp1dUX')).not.toBeNull()
  })

  it('accepts short/share link domains', () => {
    expect(parseMusicUrl('https://spotify.link/aBcDeFg')).not.toBeNull()
    expect(parseMusicUrl('https://apple.co/3xYzABC')).not.toBeNull()
    expect(parseMusicUrl('https://itun.es/abc123')).not.toBeNull()
    expect(parseMusicUrl('https://deezer.page.link/b8ywrXxhuLtnk47f6')).not.toBeNull()
    expect(parseMusicUrl('https://dzr.page.link/abc')).not.toBeNull()
    expect(parseMusicUrl('https://link.tidal.com/AbCdEfG')).not.toBeNull()
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

  it('rejects Spotify playlist and artist URLs', () => {
    expect(parseMusicUrl('https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M')).toBeNull()
    expect(parseMusicUrl('https://open.spotify.com/artist/4dpARuHxo51G3z768sgnrY')).toBeNull()
  })

  it('accepts Spotify album URLs', () => {
    expect(parseMusicUrl('https://open.spotify.com/album/4aawyAB9vmqN3uQ7FjRGTy')).not.toBeNull()
  })

  it('rejects Deezer playlist URLs', () => {
    expect(parseMusicUrl('https://www.deezer.com/playlist/1963962142')).toBeNull()
  })

  it('accepts Deezer album URLs', () => {
    expect(parseMusicUrl('https://www.deezer.com/album/302127')).not.toBeNull()
  })

  it('rejects YouTube playlist and channel URLs', () => {
    expect(parseMusicUrl('https://www.youtube.com/playlist?list=PLrEnWoR732-BHrPp_Pm8_VleD68f9s14-')).toBeNull()
    expect(parseMusicUrl('https://www.youtube.com/channel/UCVHFbw7woebEQAqHMtcMFiA')).toBeNull()
    expect(parseMusicUrl('https://www.youtube.com/@RickAstleyYT')).toBeNull()
  })

  it('isPlaylistUrl identifies collection URLs', () => {
    expect(isPlaylistUrl('https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M')).toBe(true)
    expect(isPlaylistUrl('https://open.spotify.com/track/4iV5W9uYEdYUVa79Axb7Rh')).toBe(false)
    expect(isPlaylistUrl('https://www.youtube.com/playlist?list=PLx')).toBe(true)
    expect(isPlaylistUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe(false)
    expect(isPlaylistUrl('not-a-url')).toBe(false)
  })

  it('returns a URL object with href property', () => {
    const result = parseMusicUrl('https://open.spotify.com/track/abc')
    expect(result).toBeInstanceOf(URL)
    expect(result?.href).toMatch(/^https:\/\/open\.spotify\.com/)
  })
})
