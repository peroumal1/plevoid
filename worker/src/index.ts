import { Hono } from 'hono'
import { cors } from 'hono/cors'
import type { Bindings, QueueMessage } from './types'
import { playlistRoutes } from './routes/playlists'
import { trackRoutes } from './routes/tracks'
import { importRoutes } from './routes/import'
import { searchRoutes } from './routes/search'
import { fetchOdesli } from './lib/odesli'
import { updateTrackOdesli, deleteOldPlaylists } from './lib/db'
import pkg from '../package.json'

const app = new Hono<{ Bindings: Bindings }>()

app.use('*', cors())
app.get('/api/version', (c) => c.json({ version: pkg.version }))
app.route('/api/playlists', playlistRoutes)
app.route('/api/playlists', trackRoutes)
app.route('/api/playlists', importRoutes)
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
    const now = Math.floor(Date.now() / 1000)

    const cutoff = now - 90 * 24 * 60 * 60
    const deleted = await deleteOldPlaylists(env.plevoid_db, cutoff)
    console.log(`Retention: deleted ${deleted} playlists older than 90 days`)

    // Re-enqueue tracks whose odesli_data is still null after 1 hour (queue message was lost)
    const stuckCutoff = now - 60 * 60
    const { results: stuck } = await env.plevoid_db
      .prepare('SELECT id, url_original FROM tracks WHERE odesli_data IS NULL AND added_at < ?')
      .bind(stuckCutoff)
      .all<{ id: string; url_original: string }>()
    await Promise.all(stuck.map(t => env.ODESLI_QUEUE.send({ trackId: t.id, url: t.url_original })))
    if (stuck.length) console.log(`Recovery: re-enqueued ${stuck.length} stuck tracks`)
  },

  async queue(batch: MessageBatch<QueueMessage>, env: Bindings): Promise<void> {
    for (const msg of batch.messages) {
      const { trackId, url } = msg.body
      await new Promise(r => setTimeout(r, 6000))
      try {
        // waitOnRateLimit: sleep the actual Retry-After duration on 429 then retry once.
        // maxWaitCycles:1 prevents a second consecutive 429 from looping again (execution timeout).
        const odesli = await fetchOdesli(url, env.ODESLI_API_KEY, { waitOnRateLimit: true, maxWaitCycles: 1 })
        await updateTrackOdesli(env.plevoid_db, trackId, JSON.stringify(odesli ?? { _notFound: true }))
        msg.ack()
      } catch (err) {
        const match = err instanceof Error && err.message.match(/^Odesli (\d+)$/)
        const status = match ? parseInt(match[1], 10) : 0
        // 4xx (except 429) won't fix itself — mark as not found rather than looping forever
        if (status >= 400 && status < 500 && status !== 429) {
          await updateTrackOdesli(env.plevoid_db, trackId, JSON.stringify({ _notFound: true }))
          msg.ack()
        } else {
          msg.retry()
        }
      }
    }
  },
}
