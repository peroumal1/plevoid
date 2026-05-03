import { Hono } from 'hono'
import type { Bindings } from '../types'
import { getTrackCount } from '../lib/db'
import { addTracks } from '../lib/track-actions'
import { extractSpotifyPlaylistId, fetchSpotifyPlaylistTracks } from '../lib/spotify'
import { verifyToken } from '../lib/auth'

export const importRoutes = new Hono<{ Bindings: Bindings }>()

importRoutes.post('/:id/import/spotify', async (c) => {
  const check = await verifyToken(c.env.plevoid_db, c.req.param('id'), c.req.header('X-Edit-Token'))
  if ('err' in check) return c.json({ error: check.err }, check.status)

  if (!c.env.SPOTIFY_CLIENT_ID || !c.env.SPOTIFY_CLIENT_SECRET) {
    return c.json({ error: 'Spotify import not configured' }, 503)
  }

  let body: { playlist_url?: string }
  try { body = await c.req.json() } catch { return c.json({ error: 'invalid JSON' }, 400) }

  const playlistId = extractSpotifyPlaylistId(body.playlist_url?.trim() ?? '')
  if (!playlistId) return c.json({ error: 'invalid Spotify playlist URL' }, 400)

  const count = await getTrackCount(c.env.plevoid_db, check.playlist.id)
  const slots = 50 - count
  if (slots <= 0) return c.json({ error: 'playlist limit reached (50 tracks maximum)' }, 400)

  let urls: string[]
  try {
    const result = await fetchSpotifyPlaylistTracks(
      c.env.SPOTIFY_CLIENT_ID,
      c.env.SPOTIFY_CLIENT_SECRET,
      playlistId
    )
    urls = result.urls
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : 'Spotify error' }, 502)
  }

  const toImport = urls.slice(0, slots)
  const skipped = Math.max(0, urls.length - toImport.length)

  await addTracks(c.env.plevoid_db, c.env.ODESLI_QUEUE, check.playlist.id, toImport)

  return c.json({ imported: toImport.length, skipped }, 201)
})
