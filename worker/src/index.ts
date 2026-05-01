import { Hono } from 'hono'
import { cors } from 'hono/cors'
import type { Bindings, QueueMessage } from './types'
import { playlistRoutes } from './routes/playlists'
import { trackRoutes } from './routes/tracks'
import { searchRoutes } from './routes/search'
import { fetchOdesli } from './lib/odesli'
import { updateTrackOdesli, deleteOldPlaylists } from './lib/db'

const app = new Hono<{ Bindings: Bindings }>()

app.use('*', cors())
app.route('/api/playlists', playlistRoutes)
app.route('/api/playlists', trackRoutes)
app.route('/api/search', searchRoutes)

app.get('/p/:id', (c) =>
  c.env.ASSETS.fetch(new Request(new URL('/playlist.html', c.req.url).toString()))
)
app.get('/edit/:id', (c) =>
  c.env.ASSETS.fetch(new Request(new URL('/edit.html', c.req.url).toString()))
)
app.all('*', (c) => c.env.ASSETS.fetch(c.req.raw))

export default {
  fetch: app.fetch.bind(app),

  async scheduled(_event: ScheduledEvent, env: Bindings): Promise<void> {
    const cutoff = Math.floor(Date.now() / 1000) - 90 * 24 * 60 * 60
    const deleted = await deleteOldPlaylists(env.plevoid_db, cutoff)
    console.log(`Retention: deleted ${deleted} playlists older than 90 days`)
  },

  async queue(batch: MessageBatch<QueueMessage>, env: Bindings): Promise<void> {
    for (let i = 0; i < batch.messages.length; i++) {
      const msg = batch.messages[i]
      const { trackId, url } = msg.body
      // 6s between calls keeps a full batch of 10 under the 10 req/min anonymous limit
      if (i > 0) await new Promise(r => setTimeout(r, 6000))
      try {
        const odesli = await fetchOdesli(url, env.ODESLI_API_KEY)
        if (odesli) {
          await updateTrackOdesli(env.plevoid_db, trackId, JSON.stringify(odesli))
        }
        msg.ack()
      } catch {
        msg.retry()
      }
    }
  },
}
