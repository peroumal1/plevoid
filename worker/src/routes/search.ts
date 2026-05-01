import { Hono } from 'hono'
import type { Bindings } from '../types'

export const searchRoutes = new Hono<{ Bindings: Bindings }>()

type ItunesTrack = {
  trackId: number
  trackName: string
  artistName: string
  artworkUrl100: string
  trackViewUrl: string
}

searchRoutes.get('/', async (c) => {
  const q = c.req.query('q')?.trim() ?? ''
  if (q.length < 2) return c.json({ results: [] })

  const country = c.req.query('country')?.toLowerCase().slice(0, 2) ?? 'us'
  const qs = new URLSearchParams({ term: q, media: 'music', entity: 'song', limit: '5', country })
  const res = await fetch(`https://itunes.apple.com/search?${qs}`)
  if (!res.ok) return c.json({ results: [] })

  const data = await res.json() as { results: ItunesTrack[] }
  return c.json({
    results: data.results.map(r => ({
      id: r.trackId,
      title: r.trackName,
      artist: r.artistName,
      artwork: r.artworkUrl100,
      url: r.trackViewUrl,
    })),
  })
})
