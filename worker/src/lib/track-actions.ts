import type { QueueMessage } from '../types'
import { insertTrack } from './db'

export async function addTrack(
  db: D1Database,
  queue: Queue<QueueMessage>,
  playlistId: string,
  url: string
): Promise<{ id: string; url_original: string; odesli_data: null }> {
  const trackId = crypto.randomUUID()
  await insertTrack(db, trackId, playlistId, url, null)
  await queue.send({ trackId, url })
  return { id: trackId, url_original: url, odesli_data: null }
}

export async function addTracks(
  db: D1Database,
  queue: Queue<QueueMessage>,
  playlistId: string,
  urls: string[]
): Promise<void> {
  if (!urls.length) return

  const { maxPos } = await db
    .prepare('SELECT COALESCE(MAX(position), 0) as maxPos FROM tracks WHERE playlist_id = ?')
    .bind(playlistId)
    .first<{ maxPos: number }>() ?? { maxPos: 0 }

  const now = Math.floor(Date.now() / 1000)
  const ids = urls.map(() => crypto.randomUUID())

  await db.batch(
    urls.map((url, i) =>
      db
        .prepare(
          'INSERT INTO tracks (id, playlist_id, url_original, odesli_data, added_at, position) VALUES (?, ?, ?, NULL, ?, ?)'
        )
        .bind(ids[i], playlistId, url, now, maxPos + i + 1)
    )
  )

  await Promise.all(urls.map((url, i) => queue.send({ trackId: ids[i], url })))
}
