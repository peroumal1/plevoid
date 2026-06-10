import { Hono } from 'hono'
import type { Bindings } from '../types'
import { verifyAnyToken } from '../lib/auth'

export const searchRoutes = new Hono<{ Bindings: Bindings }>()

type SearchResult = { title: string; artist: string; artwork: string; url: string }

type ItunesTrack = {
  trackId: number
  trackName: string
  artistName: string
  artworkUrl100: string
  trackViewUrl: string
}

async function searchItunes(query: string, country: string): Promise<SearchResult[]> {
  const qs = new URLSearchParams({ term: query, media: 'music', entity: 'song', limit: '5', country })
  const res = await fetch(`https://itunes.apple.com/search?${qs}`)
  if (!res.ok) return []
  const data = await res.json() as { results: ItunesTrack[] }
  return data.results.map(r => ({
    title: r.trackName,
    artist: r.artistName,
    artwork: r.artworkUrl100,
    url: r.trackViewUrl,
  }))
}

function dedupeResults(results: SearchResult[]): SearchResult[] {
  const seen = new Set<string>()
  return results.filter(r => {
    const key = `${r.title.toLowerCase().trim()}-${r.artist.toLowerCase().trim()}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

searchRoutes.get('/', async (c) => {
  if (!await verifyAnyToken(c.env.plevoid_db, c.req.header('X-Edit-Token'))) {
    return c.json({ error: 'unauthorized' }, 401)
  }

  const q = c.req.query('q')?.trim() ?? ''
  if (q.length < 2) return c.json({ results: [] })

  const cf = c.req.raw.cf as { country?: string } | undefined
  const country = (cf?.country ?? 'us').toLowerCase()

  const itunesResults = await searchItunes(q, country)
  return c.json({ results: dedupeResults(itunesResults) })
})
