import { Hono } from 'hono'
import type { Context } from 'hono'
import { PLAYLIST_LIMIT, type Bindings } from '../types'
import { getTrackCount } from '../lib/db'
import { addTracks } from '../lib/track-actions'
import { extractSpotifyPlaylistId, fetchSpotifyPlaylistTracks } from '../lib/spotify'
import { resolveDeezerPlaylistId, fetchDeezerPlaylistTracks } from '../lib/deezer'
import { verifyToken } from '../lib/auth'

export const importRoutes = new Hono<{ Bindings: Bindings }>()

async function runImport(
  c: Context<{ Bindings: Bindings }>,
  resolveId: (url: string) => Promise<string | null>,
  fetchTracks: (id: string) => Promise<{ urls: string[] }>,
  errorLabel: string
) {
  const check = await verifyToken(c.env.plevoid_db, c.req.param('id')!, c.req.header('X-Edit-Token'))
  if ('err' in check) return c.json({ error: check.err }, check.status)

  let body: { playlist_url?: string }
  try { body = await c.req.json() } catch { return c.json({ error: 'invalid JSON' }, 400) }

  const playlistId = await resolveId(body.playlist_url?.trim() ?? '')
  if (!playlistId) return c.json({ error: `invalid ${errorLabel} playlist URL` }, 400)

  const count = await getTrackCount(c.env.plevoid_db, check.playlist.id)
  const slots = PLAYLIST_LIMIT - count
  if (slots <= 0) return c.json({ error: `playlist limit reached (${PLAYLIST_LIMIT} tracks maximum)` }, 400)

  let urls: string[]
  try {
    const result = await fetchTracks(playlistId)
    urls = result.urls
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : `${errorLabel} error` }, 502)
  }

  const toImport = urls.slice(0, slots)
  const skipped = Math.max(0, urls.length - toImport.length)

  await addTracks(c.env.plevoid_db, c.env.ODESLI_QUEUE, check.playlist.id, toImport)

  return c.json({ imported: toImport.length, skipped }, 201)
}

importRoutes.post('/:id/import/spotify', async (c) => {
  if (!c.env.SPOTIFY_CLIENT_ID || !c.env.SPOTIFY_CLIENT_SECRET) {
    return c.json({ error: 'Spotify import not configured' }, 503)
  }
  return runImport(
    c,
    (url) => Promise.resolve(extractSpotifyPlaylistId(url)),
    (id) => fetchSpotifyPlaylistTracks(c.env.SPOTIFY_CLIENT_ID!, c.env.SPOTIFY_CLIENT_SECRET!, id),
    'Spotify'
  )
})

importRoutes.post('/:id/import/deezer', async (c) => {
  return runImport(
    c,
    (url) => resolveDeezerPlaylistId(url),
    (id) => fetchDeezerPlaylistTracks(id),
    'Deezer'
  )
})
