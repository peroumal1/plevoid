import type { Track } from './db'

type OdesliEntity = { title?: string; artistName?: string }
type OdesliBlob = {
  _notFound?: boolean
  _preview?: boolean
  entityUniqueId?: string
  pageUrl?: string
  entitiesByUniqueId?: Record<string, OdesliEntity>
  linksByPlatform?: Record<string, { url: string }>
}

function csvEscape(val: string | null | undefined): string {
  if (val == null) return ''
  const s = String(val)
  if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

export function tracksToCSV(tracks: Track[]): { csv: string; skipped: number } {
  const headers = ['Title', 'Artist', 'Spotify URL', 'Apple Music URL', 'YouTube URL', 'Deezer URL', 'song.link', 'Added']
  let skipped = 0
  const rows = tracks.flatMap(t => {
    if (!t.odesli_data) { skipped++; return [] }
    const od = JSON.parse(t.odesli_data) as OdesliBlob
    if (od._notFound || od._preview || !od.entityUniqueId) { skipped++; return [] }
    const entity = od.entitiesByUniqueId?.[od.entityUniqueId] ?? {}
    const links = od.linksByPlatform ?? {}
    return [[
      csvEscape(entity.title),
      csvEscape(entity.artistName),
      csvEscape(links.spotify?.url),
      csvEscape(links.appleMusic?.url),
      csvEscape(links.youtube?.url ?? links.youtubeMusic?.url),
      csvEscape(links.deezer?.url),
      csvEscape(od.pageUrl),
      csvEscape(new Date(t.added_at * 1000).toISOString()),
    ].join(',')]
  })
  return { csv: [headers.join(','), ...rows].join('\n'), skipped }
}
