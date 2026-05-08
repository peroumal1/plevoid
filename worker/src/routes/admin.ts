import { Hono } from 'hono'
import type { Bindings } from '../types'

export const adminRoutes = new Hono<{ Bindings: Bindings }>()

function unauthorized() {
  return new Response('Unauthorized', {
    status: 401,
    headers: { 'WWW-Authenticate': 'Basic realm="Plevoid Admin"' },
  })
}

function checkAuth(c: { env: Bindings; req: { header: (k: string) => string | undefined } }): boolean {
  if (!c.env.ADMIN_TOKEN) return false
  const header = c.req.header('Authorization') ?? ''
  if (!header.startsWith('Basic ')) return false
  const decoded = atob(header.slice(6))
  const password = decoded.slice(decoded.indexOf(':') + 1)
  return password === c.env.ADMIN_TOKEN
}

adminRoutes.use('*', async (c, next) => {
  if (!checkAuth(c)) return unauthorized()
  await next()
})

const PAGE_SIZE = 20

const SORT_COLS: Record<string, string> = {
  created_at: 'p.created_at',
  last_accessed_at: 'p.last_accessed_at',
  expires_at: 'COALESCE(p.last_accessed_at, p.created_at) + 7776000',
  track_count: 'track_count',
}

adminRoutes.get('/stats', async (c) => {
  const db = c.env.plevoid_db
  const now = Math.floor(Date.now() / 1000)

  const [r0, r1, r2, r3, r4, r5, r6, r7] = await db.batch([
    db.prepare('SELECT COUNT(*) as count FROM playlists'),
    db.prepare('SELECT COUNT(*) as count FROM playlists WHERE created_at > ?').bind(now - 7 * 86400),
    db.prepare('SELECT COUNT(*) as count FROM playlists WHERE created_at > ?').bind(now - 30 * 86400),
    db.prepare('SELECT COUNT(*) as count FROM tracks'),
    db.prepare("SELECT COUNT(*) as count FROM tracks WHERE odesli_data IS NOT NULL AND json_extract(odesli_data, '$._notFound') IS NULL AND json_extract(odesli_data, '$._preview') IS NULL"),
    db.prepare("SELECT COUNT(*) as count FROM tracks WHERE odesli_data IS NULL OR json_extract(odesli_data, '$._preview') = 1"),
    db.prepare("SELECT COUNT(*) as count FROM tracks WHERE json_extract(odesli_data, '$._notFound') = 1"),
    db.prepare('SELECT COUNT(*) as count FROM playlists WHERE (COALESCE(last_accessed_at, created_at) + 7776000) BETWEEN ? AND ?').bind(now, now + 7 * 86400),
  ])

  return c.json({
    total_playlists: (r0.results[0] as { count: number }).count,
    playlists_7d: (r1.results[0] as { count: number }).count,
    playlists_30d: (r2.results[0] as { count: number }).count,
    total_tracks: (r3.results[0] as { count: number }).count,
    enrichment: {
      enriched: (r4.results[0] as { count: number }).count,
      pending: (r5.results[0] as { count: number }).count,
      failed: (r6.results[0] as { count: number }).count,
    },
    expiring_soon: (r7.results[0] as { count: number }).count,
  })
})

adminRoutes.get('/playlists', async (c) => {
  const db = c.env.plevoid_db
  const page = Math.max(1, parseInt(c.req.query('page') ?? '1', 10))
  const sortKey = c.req.query('sort') ?? 'created_at'
  const order = c.req.query('order') === 'asc' ? 'ASC' : 'DESC'
  const sortCol = SORT_COLS[sortKey] ?? 'p.created_at'
  const offset = (page - 1) * PAGE_SIZE

  const [countResult, listResult] = await db.batch([
    db.prepare('SELECT COUNT(*) as count FROM playlists'),
    db.prepare(`
      SELECT p.id, p.title, p.created_at, p.last_accessed_at,
        COUNT(t.id) as track_count,
        (COALESCE(p.last_accessed_at, p.created_at) + 7776000) as expires_at
      FROM playlists p
      LEFT JOIN tracks t ON t.playlist_id = p.id
      GROUP BY p.id
      ORDER BY ${sortCol} ${order}
      LIMIT ${PAGE_SIZE} OFFSET ${offset}
    `),
  ])

  return c.json({
    playlists: listResult.results,
    total: (countResult.results[0] as { count: number }).count,
    page,
  })
})

adminRoutes.delete('/playlists/:id', async (c) => {
  const id = c.req.param('id')
  await c.env.plevoid_db.batch([
    c.env.plevoid_db.prepare('DELETE FROM tracks WHERE playlist_id = ?').bind(id),
    c.env.plevoid_db.prepare('DELETE FROM playlists WHERE id = ?').bind(id),
  ])
  return c.json({ success: true })
})

adminRoutes.get('/enrichment/issues', async (c) => {
  const now = Math.floor(Date.now() / 1000)
  const { results } = await c.env.plevoid_db
    .prepare(`
      SELECT t.id, t.playlist_id, t.url_original, t.added_at,
        CASE
          WHEN json_extract(t.odesli_data, '$._notFound') = 1 THEN 'failed'
          ELSE 'pending'
        END as status
      FROM tracks t
      WHERE (t.odesli_data IS NULL AND t.added_at < ?)
         OR json_extract(t.odesli_data, '$._notFound') = 1
      ORDER BY t.added_at DESC
    `)
    .bind(now - 3600)
    .all<{ id: string; playlist_id: string; url_original: string; added_at: number; status: string }>()

  return c.json({ tracks: results })
})

adminRoutes.post('/enrichment/retry/:trackId', async (c) => {
  const trackId = c.req.param('trackId')
  const track = await c.env.plevoid_db
    .prepare('SELECT id, url_original FROM tracks WHERE id = ?')
    .bind(trackId)
    .first<{ id: string; url_original: string }>()

  if (!track) return c.json({ error: 'track not found' }, 404)

  await c.env.plevoid_db
    .prepare('UPDATE tracks SET odesli_data = NULL WHERE id = ?')
    .bind(trackId)
    .run()
  await c.env.ODESLI_QUEUE.send({ trackId: track.id, url: track.url_original })

  return c.json({ success: true })
})
