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

function odesli(title: string, artist: string, pageUrl = 'https://song.link/test') {
  return {
    entityUniqueId: 'ITUNES_SONG::1',
    pageUrl,
    entitiesByUniqueId: {
      'ITUNES_SONG::1': { title, artistName: artist, thumbnailUrl: 'https://example.com/art.jpg' },
    },
    linksByPlatform: {},
  }
}

describe('tracksToCSV', () => {
  it('returns only the header row for an empty playlist', () => {
    expect(tracksToCSV([])).toBe('title,artist,url_original,url_odesli,added_at')
  })

  it('includes all header columns', () => {
    const [header] = tracksToCSV([]).split('\n')
    expect(header).toBe('title,artist,url_original,url_odesli,added_at')
  })

  it('extracts title, artist, and page URL from odesli data', () => {
    const csv = tracksToCSV([track({ odesli: odesli('Blue (Da Ba Dee)', 'Eiffel 65') })])
    const [, row] = csv.split('\n')
    expect(row).toBe('Blue (Da Ba Dee),Eiffel 65,https://music.apple.com/us/album/test/1,https://song.link/test,2023-11-14T22:13:20.000Z')
  })

  it('leaves title/artist/url_odesli empty when odesli_data is null', () => {
    const csv = tracksToCSV([track({ odesli: null })])
    const [, row] = csv.split('\n')
    expect(row).toBe(',,https://music.apple.com/us/album/test/1,,2023-11-14T22:13:20.000Z')
  })

  it('leaves title/artist/url_odesli empty for _notFound sentinel', () => {
    const csv = tracksToCSV([track({ odesli: { _notFound: true } })])
    const [, row] = csv.split('\n')
    expect(row).toBe(',,https://music.apple.com/us/album/test/1,,2023-11-14T22:13:20.000Z')
  })

  it('wraps fields containing commas in double quotes', () => {
    const csv = tracksToCSV([track({ odesli: odesli('Rhythm, Love & Soul', 'Various') })])
    const [, row] = csv.split('\n')
    expect(row).toContain('"Rhythm, Love & Soul"')
  })

  it('escapes double-quotes inside fields', () => {
    const csv = tracksToCSV([track({ odesli: odesli('"Heroes"', 'David Bowie') })])
    const [, row] = csv.split('\n')
    expect(row).toContain('"""Heroes"""')
  })

  it('formats added_at as ISO 8601 timestamp', () => {
    const csv = tracksToCSV([track({ added_at: 0, odesli: null })])
    const [, row] = csv.split('\n')
    expect(row).toContain('1970-01-01T00:00:00.000Z')
  })

  it('produces one row per track plus the header', () => {
    const rows = tracksToCSV([
      track({ id: '1', odesli: odesli('Song A', 'Artist A') }),
      track({ id: '2', odesli: odesli('Song B', 'Artist B') }),
      track({ id: '3', odesli: null }),
    ]).split('\n')
    expect(rows).toHaveLength(4)
  })

  it('does not wrap plain values in quotes', () => {
    const csv = tracksToCSV([track({ odesli: odesli('Simple Title', 'Simple Artist') })])
    const [, row] = csv.split('\n')
    expect(row.startsWith('"')).toBe(false)
  })
})
