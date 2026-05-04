import { Hono } from 'hono'
import type { Bindings } from '../types'
import { searchSpotify } from '../lib/spotify'
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

function interleave<T>(a: T[], b: T[]): T[] {
  const out: T[] = []
  const len = Math.max(a.length, b.length)
  for (let i = 0; i < len; i++) {
    if (i < a.length) out.push(a[i])
    if (i < b.length) out.push(b[i])
  }
  return out
}

searchRoutes.get('/', async (c) => {
  if (!await verifyAnyToken(c.env.plevoid_db, c.req.header('X-Edit-Token'))) {
    return c.json({ error: 'unauthorized' }, 401)
  }

  const q = c.req.query('q')?.trim() ?? ''
  if (q.length < 2) return c.json({ results: [] })

  const cf = c.req.raw.cf as { country?: string } | undefined
  const country = (cf?.country ?? 'us').toLowerCase()

  const [itunesResults, spotifyResults] = await Promise.all([
    searchItunes(q, country),
    c.env.SPOTIFY_CLIENT_ID && c.env.SPOTIFY_CLIENT_SECRET
      ? searchSpotify(c.env.SPOTIFY_CLIENT_ID, c.env.SPOTIFY_CLIENT_SECRET, q).catch(() => [])
      : Promise.resolve([]),
  ])

  const merged = dedupeResults(interleave(itunesResults, spotifyResults)).slice(0, 8)
  return c.json({ results: merged })
})
