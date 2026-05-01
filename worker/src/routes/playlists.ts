import { Hono } from 'hono'
import type { Bindings } from '../types'
import { createPlaylist, getPlaylist, getPlaylistForEdit, getTracks, updatePlaylistTitle } from '../lib/db'

export const playlistRoutes = new Hono<{ Bindings: Bindings }>()

playlistRoutes.post('/', async (c) => {
  let body: { title?: string }
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'invalid JSON' }, 400)
  }

  const title = body.title?.trim()
  if (!title) return c.json({ error: 'title required' }, 400)

  const id = crypto.randomUUID().replace(/-/g, '').slice(0, 12)
  const edit_token = crypto.randomUUID()

  await createPlaylist(c.env.plevoid_db, id, edit_token, title)

  const origin = new URL(c.req.url).origin
  return c.json(
    {
      id,
      edit_token,
      public_url: `${origin}/p/${id}`,
      edit_url: `${origin}/edit/${id}?token=${edit_token}`,
    },
    201
  )
})

playlistRoutes.get('/:id', async (c) => {
  const playlist = await getPlaylist(c.env.plevoid_db, c.req.param('id'))
  if (!playlist) return c.json({ error: 'not found' }, 404)

  const tracks = await getTracks(c.env.plevoid_db, playlist.id)
  return c.json({
    ...playlist,
    tracks: tracks.map((t) => ({
      id: t.id,
      url_original: t.url_original,
      odesli_data: t.odesli_data ? JSON.parse(t.odesli_data) : null,
      added_at: t.added_at,
    })),
  })
})

playlistRoutes.patch('/:id', async (c) => {
  const token = c.req.header('X-Edit-Token')
  const playlist = await getPlaylistForEdit(c.env.plevoid_db, c.req.param('id'))
  if (!playlist) return c.json({ error: 'not found' }, 404)
  if (!token || playlist.edit_token !== token) return c.json({ error: 'forbidden' }, 403)

  let body: { title?: string }
  try { body = await c.req.json() } catch { return c.json({ error: 'invalid JSON' }, 400) }

  const title = body.title?.trim()
  if (!title) return c.json({ error: 'title required' }, 400)

  await updatePlaylistTitle(c.env.plevoid_db, playlist.id, title)
  return c.json({ id: playlist.id, title })
})
