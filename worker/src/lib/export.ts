import type { Track } from './db'

type OdesliEntity = { title?: string; artistName?: string }
type OdesliBlob = {
  _notFound?: boolean
  entityUniqueId?: string
  pageUrl?: string
  entitiesByUniqueId?: Record<string, OdesliEntity>
}

function csvEscape(val: string | null | undefined): string {
  if (val == null) return ''
  const s = String(val)
  if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

export function tracksToCSV(tracks: Track[]): string {
  const headers = ['title', 'artist', 'url_original', 'url_odesli', 'added_at']
  const rows = tracks.map(t => {
    let entity: OdesliEntity = {}
    let pageUrl: string | null = null
    if (t.odesli_data) {
      const od = JSON.parse(t.odesli_data) as OdesliBlob
      if (!od._notFound && od.entityUniqueId) {
        entity = od.entitiesByUniqueId?.[od.entityUniqueId] ?? {}
        pageUrl = od.pageUrl ?? null
      }
    }
    return [
      csvEscape(entity.title),
      csvEscape(entity.artistName),
      csvEscape(t.url_original),
      csvEscape(pageUrl),
      csvEscape(new Date(t.added_at * 1000).toISOString()),
    ].join(',')
  })
  return [headers.join(','), ...rows].join('\n')
}
