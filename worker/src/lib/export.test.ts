import { describe, it, expect } from 'vitest'
import { tracksToCSV } from './export'
import type { Track } from './db'

function track(overrides: Partial<Track> & { odesli?: object | null } = {}): Track {
  const { odesli, ...rest } = overrides
  return {
    id: 'track-1',
    playlist_id: 'playlist-1',
    url_original: 'https://music.apple.com/us/album/test/1',
    odesli_data: odesli !== undefined ? (odesli === null ? null : JSON.stringify(odesli)) : null,
    added_at: 1700000000,
    position: null,
    ...rest,
  }
}

function odesli(title: string, artist: string, links: Record<string, { url: string }> = {}, pageUrl = 'https://song.link/test') {
  return {
    entityUniqueId: 'ITUNES_SONG::1',
    pageUrl,
    entitiesByUniqueId: {
      'ITUNES_SONG::1': { title, artistName: artist, thumbnailUrl: 'https://example.com/art.jpg' },
    },
    linksByPlatform: links,
  }
}

const HEADER = 'Title,Artist,Spotify URL,Apple Music URL,YouTube URL,Deezer URL,song.link,Added'

describe('tracksToCSV', () => {
  it('returns only the header row for an empty playlist', () => {
    const { csv, skipped } = tracksToCSV([])
    expect(csv).toBe(HEADER)
    expect(skipped).toBe(0)
  })

  it('includes all header columns', () => {
    const { csv } = tracksToCSV([])
    const [header] = csv.split('\n')
    expect(header).toBe(HEADER)
  })

  it('extracts title and artist from odesli data', () => {
    const { csv } = tracksToCSV([track({ odesli: odesli('Blue (Da Ba Dee)', 'Eiffel 65') })])
    const [, row] = csv.split('\n')
    expect(row.startsWith('Blue (Da Ba Dee),Eiffel 65,')).toBe(true)
  })

  it('populates platform URL columns from linksByPlatform', () => {
    const links = {
      spotify:    { url: 'https://open.spotify.com/track/abc' },
      appleMusic: { url: 'https://music.apple.com/us/album/test/1' },
      youtube:    { url: 'https://www.youtube.com/watch?v=xyz' },
      deezer:     { url: 'https://www.deezer.com/track/123' },
    }
    const { csv } = tracksToCSV([track({ odesli: odesli('Song', 'Artist', links) })])
    const [, row] = csv.split('\n')
    const cols = row.split(',')
    expect(cols[2]).toBe('https://open.spotify.com/track/abc')
    expect(cols[3]).toBe('https://music.apple.com/us/album/test/1')
    expect(cols[4]).toBe('https://www.youtube.com/watch?v=xyz')
    expect(cols[5]).toBe('https://www.deezer.com/track/123')
  })

  it('falls back to youtubeMusic if youtube link is absent', () => {
    const links = { youtubeMusic: { url: 'https://music.youtube.com/watch?v=abc' } }
    const { csv } = tracksToCSV([track({ odesli: odesli('Song', 'Artist', links) })])
    const [, row] = csv.split('\n')
    expect(row.split(',')[4]).toBe('https://music.youtube.com/watch?v=abc')
  })

  it('leaves platform URL columns empty when no links available', () => {
    const { csv } = tracksToCSV([track({ odesli: odesli('Song', 'Artist') })])
    const [, row] = csv.split('\n')
    const cols = row.split(',')
    expect(cols[2]).toBe('')
    expect(cols[3]).toBe('')
    expect(cols[4]).toBe('')
    expect(cols[5]).toBe('')
  })

  it('omits tracks with null odesli_data and counts them as skipped', () => {
    const { csv, skipped } = tracksToCSV([track({ odesli: null })])
    expect(csv).toBe(HEADER)
    expect(skipped).toBe(1)
  })

  it('omits tracks with _notFound sentinel and counts them as skipped', () => {
    const { csv, skipped } = tracksToCSV([track({ odesli: { _notFound: true } })])
    expect(csv).toBe(HEADER)
    expect(skipped).toBe(1)
  })

  it('omits tracks with _preview stub and counts them as skipped', () => {
    const { csv, skipped } = tracksToCSV([track({ odesli: { entityUniqueId: 'preview', entitiesByUniqueId: { preview: { title: 'Song', artistName: 'Artist' } }, _preview: true } })])
    expect(csv).toBe(HEADER)
    expect(skipped).toBe(1)
  })

  it('includes song.link pageUrl', () => {
    const { csv } = tracksToCSV([track({ odesli: odesli('Song', 'Artist', {}, 'https://song.link/s/abc') })])
    const [, row] = csv.split('\n')
    expect(row).toContain('https://song.link/s/abc')
  })

  it('wraps fields containing commas in double quotes', () => {
    const { csv } = tracksToCSV([track({ odesli: odesli('Rhythm, Love & Soul', 'Various') })])
    const [, row] = csv.split('\n')
    expect(row).toContain('"Rhythm, Love & Soul"')
  })

  it('escapes double-quotes inside fields', () => {
    const { csv } = tracksToCSV([track({ odesli: odesli('"Heroes"', 'David Bowie') })])
    const [, row] = csv.split('\n')
    expect(row).toContain('"""Heroes"""')
  })

  it('formats added_at as ISO 8601 timestamp', () => {
    const { csv } = tracksToCSV([track({ added_at: 0, odesli: odesli('Song', 'Artist') })])
    const [, row] = csv.split('\n')
    expect(row).toContain('1970-01-01T00:00:00.000Z')
  })

  it('produces one row per resolved track, skipping unresolved', () => {
    const { csv, skipped } = tracksToCSV([
      track({ id: '1', odesli: odesli('Song A', 'Artist A') }),
      track({ id: '2', odesli: odesli('Song B', 'Artist B') }),
      track({ id: '3', odesli: null }),
    ])
    expect(csv.split('\n')).toHaveLength(3) // header + 2 resolved tracks
    expect(skipped).toBe(1)
  })

  it('does not wrap plain values in quotes', () => {
    const { csv } = tracksToCSV([track({ odesli: odesli('Simple Title', 'Simple Artist') })])
    const [, row] = csv.split('\n')
    expect(row.startsWith('"')).toBe(false)
  })
})
