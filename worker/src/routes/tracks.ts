import { Hono } from 'hono'
import type { Bindings } from '../types'
import { getPlaylistForEdit, insertTrack, deleteTrack, getTrackCount } from '../lib/db'
import { parseMusicUrl, SUPPORTED_PLATFORMS } from '../lib/validate'

export const trackRoutes = new Hono<{ Bindings: Bindings }>()

async function verifyToken(
  db: D1Database,
  id: string,
  token: string | undefined
) {
  if (!token) return { err: 'missing X-Edit-Token', status: 401 as const }
  const playlist = await getPlaylistForEdit(db, id)
  if (!playlist) return { err: 'not found', status: 404 as const }
  if (playlist.edit_token !== token) return { err: 'forbidden', status: 403 as const }
  return { playlist }
}

trackRoutes.post('/:id/tracks', async (c) => {
  const check = await verifyToken(c.env.plevoid_db, c.req.param('id'), c.req.header('X-Edit-Token'))
  if ('err' in check) return c.json({ error: check.err }, check.status)

  let body: { url?: string }
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'invalid JSON' }, 400)
  }

  const parsed = parseMusicUrl(body.url?.trim() ?? '')
  if (!parsed) {
    return c.json(
      { error: `invalid URL — must be a link from: ${SUPPORTED_PLATFORMS}` },
      400
    )
  }
  const count = await getTrackCount(c.env.plevoid_db, check.playlist.id)
  if (count >= 50) return c.json({ error: 'playlist limit reached (50 tracks maximum)' }, 400)

  const url = parsed.href
  const trackId = crypto.randomUUID()

  // Insert immediately with null odesli_data, resolve asynchronously via queue
  await insertTrack(c.env.plevoid_db, trackId, check.playlist.id, url, null)
  await c.env.ODESLI_QUEUE.send({ trackId, url })

  return c.json({ id: trackId, url_original: url, odesli_data: null }, 201)
})

trackRoutes.delete('/:id/tracks/:trackId', async (c) => {
  const check = await verifyToken(c.env.plevoid_db, c.req.param('id'), c.req.header('X-Edit-Token'))
  if ('err' in check) return c.json({ error: check.err }, check.status)

  const deleted = await deleteTrack(c.env.plevoid_db, c.req.param('trackId'), check.playlist.id)
  if (!deleted) return c.json({ error: 'track not found' }, 404)

  return c.json({ success: true })
})
