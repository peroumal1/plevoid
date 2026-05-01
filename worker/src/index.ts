import { Hono } from 'hono'
import { cors } from 'hono/cors'
import type { Bindings } from './types'
import { playlistRoutes } from './routes/playlists'
import { trackRoutes } from './routes/tracks'

const app = new Hono<{ Bindings: Bindings }>()

app.use('*', cors())

app.route('/api/playlists', playlistRoutes)
app.route('/api/playlists', trackRoutes)

// SPA-style rewrites: serve the right HTML shell for dynamic routes
app.get('/p/:id', (c) =>
  c.env.ASSETS.fetch(new Request(new URL('/playlist.html', c.req.url).toString()))
)
app.get('/edit/:id', (c) =>
  c.env.ASSETS.fetch(new Request(new URL('/edit.html', c.req.url).toString()))
)

// Everything else (/, /index.html, assets) falls through to the static directory
app.all('*', (c) => c.env.ASSETS.fetch(c.req.raw))

export default app
