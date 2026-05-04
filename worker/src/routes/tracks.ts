import { Hono } from 'hono'
import { PLAYLIST_LIMIT, type Bindings } from '../types'
import { deleteTrack, getTrackCount, reorderTracks } from '../lib/db'
import { parseMusicUrl, isPlaylistUrl, SUPPORTED_PLATFORMS } from '../lib/validate'
import { addTrack } from '../lib/track-actions'
import { verifyToken } from '../lib/auth'

export const trackRoutes = new Hono<{ Bindings: Bindings }>()

trackRoutes.post('/:id/tracks', async (c) => {
  const check = await verifyToken(c.env.plevoid_db, c.req.param('id'), c.req.header('X-Edit-Token'))
  if ('err' in check) return c.json({ error: check.err }, check.status)

  let body: { url?: string; metadata?: { title?: string; artist?: string; artwork?: string } }
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'invalid JSON' }, 400)
  }

  const trimmed = body.url?.trim() ?? ''
  if (isPlaylistUrl(trimmed)) {
    return c.json({ error: 'that looks like a playlist URL — use the import option instead' }, 400)
  }
  const parsed = parseMusicUrl(trimmed)
  if (!parsed) {
    return c.json({ error: `invalid URL — must be a track link from: ${SUPPORTED_PLATFORMS}` }, 400)
  }
  const count = await getTrackCount(c.env.plevoid_db, check.playlist.id)
  if (count >= PLAYLIST_LIMIT) return c.json({ error: `playlist limit reached (${PLAYLIST_LIMIT} tracks maximum)` }, 400)

  const meta = body.metadata
  const track = await addTrack(c.env.plevoid_db, c.env.ODESLI_QUEUE, check.playlist.id, parsed.href, c.env.ODESLI_API_KEY, meta)
  return c.json(track, 201)
})

trackRoutes.patch('/:id/tracks/reorder', async (c) => {
  const check = await verifyToken(c.env.plevoid_db, c.req.param('id'), c.req.header('X-Edit-Token'))
  if ('err' in check) return c.json({ error: check.err }, check.status)

  let body: { order?: unknown }
  try { body = await c.req.json() } catch { return c.json({ error: 'invalid JSON' }, 400) }

  if (!Array.isArray(body.order) || !body.order.every(x => typeof x === 'string')) {
    return c.json({ error: 'order must be an array of track IDs' }, 400)
  }

  await reorderTracks(c.env.plevoid_db, check.playlist.id, body.order as string[])
  return c.json({ success: true })
})

trackRoutes.delete('/:id/tracks/:trackId', async (c) => {
  const check = await verifyToken(c.env.plevoid_db, c.req.param('id'), c.req.header('X-Edit-Token'))
  if ('err' in check) return c.json({ error: check.err }, check.status)

  const deleted = await deleteTrack(c.env.plevoid_db, c.req.param('trackId'), check.playlist.id)
  if (!deleted) return c.json({ error: 'track not found' }, 404)

  return c.json({ success: true })
})
