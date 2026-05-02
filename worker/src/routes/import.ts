import { Hono } from 'hono'
import type { Bindings } from '../types'
import { getPlaylistForEdit, getTrackCount } from '../lib/db'
import { addTrack } from '../lib/track-actions'
import { extractSpotifyPlaylistId, fetchSpotifyPlaylistTracks } from '../lib/spotify'

export const importRoutes = new Hono<{ Bindings: Bindings }>()

importRoutes.post('/:id/import/spotify', async (c) => {
  const token = c.req.header('X-Edit-Token')
  if (!token) return c.json({ error: 'missing X-Edit-Token' }, 401)

  const playlist = await getPlaylistForEdit(c.env.plevoid_db, c.req.param('id'))
  if (!playlist) return c.json({ error: 'not found' }, 404)
  if (playlist.edit_token !== token) return c.json({ error: 'forbidden' }, 403)

  if (!c.env.SPOTIFY_CLIENT_ID || !c.env.SPOTIFY_CLIENT_SECRET) {
    return c.json({ error: 'Spotify import not configured' }, 503)
  }

  let body: { playlist_url?: string }
  try { body = await c.req.json() } catch { return c.json({ error: 'invalid JSON' }, 400) }

  const playlistId = extractSpotifyPlaylistId(body.playlist_url?.trim() ?? '')
  if (!playlistId) return c.json({ error: 'invalid Spotify playlist URL' }, 400)

  const count = await getTrackCount(c.env.plevoid_db, playlist.id)
  const slots = 50 - count
  if (slots <= 0) return c.json({ error: 'playlist limit reached (50 tracks maximum)' }, 400)

  let urls: string[]
  let spotifyTotal: number
  try {
    const result = await fetchSpotifyPlaylistTracks(
      c.env.SPOTIFY_CLIENT_ID,
      c.env.SPOTIFY_CLIENT_SECRET,
      playlistId
    )
    urls = result.urls
    spotifyTotal = result.total
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : 'Spotify error' }, 502)
  }

  const toImport = urls.slice(0, slots)
  const skipped = Math.max(0, spotifyTotal - toImport.length)

  for (const url of toImport) {
    await addTrack(c.env.plevoid_db, c.env.ODESLI_QUEUE, playlist.id, url)
  }

  return c.json({ imported: toImport.length, skipped }, 201)
})
