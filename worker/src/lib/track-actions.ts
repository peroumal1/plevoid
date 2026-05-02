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
