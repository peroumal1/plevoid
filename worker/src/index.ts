import { Hono } from 'hono'
import { cors } from 'hono/cors'
import type { Bindings, QueueMessage } from './types'
import { playlistRoutes } from './routes/playlists'
import { trackRoutes } from './routes/tracks'
import { fetchOdesli } from './lib/odesli'
import { updateTrackOdesli } from './lib/db'

const app = new Hono<{ Bindings: Bindings }>()

app.use('*', cors())
app.route('/api/playlists', playlistRoutes)
app.route('/api/playlists', trackRoutes)

app.get('/p/:id', (c) =>
  c.env.ASSETS.fetch(new Request(new URL('/playlist.html', c.req.url).toString()))
)
app.get('/edit/:id', (c) =>
  c.env.ASSETS.fetch(new Request(new URL('/edit.html', c.req.url).toString()))
)
app.all('*', (c) => c.env.ASSETS.fetch(c.req.raw))

export default {
  fetch: app.fetch.bind(app),

  async queue(batch: MessageBatch<QueueMessage>, env: Bindings): Promise<void> {
    for (const msg of batch.messages) {
      const { trackId, url } = msg.body
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
