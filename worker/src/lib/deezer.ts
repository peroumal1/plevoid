function extractIdFromString(s: string): string | null {
  return s.match(/\/playlist\/(\d+)/)?.[1] ?? null
}

export function extractDeezerPlaylistId(url: string): string | null {
  try {
    const u = new URL(url)
    if (u.hostname !== 'www.deezer.com' && u.hostname !== 'deezer.com') return null
    return extractIdFromString(u.pathname)
  } catch {
    return null
  }
}

export async function resolveDeezerPlaylistId(url: string): Promise<string | null> {
  const direct = extractDeezerPlaylistId(url)
  if (direct) return direct

  // Short link — follow one redirect and scan the Location header for the playlist ID
  try {
    const u = new URL(url)
    if (u.hostname !== 'link.deezer.com') return null
    const res = await fetch(url, { redirect: 'manual' })
    const location = res.headers.get('location') ?? ''
    return extractIdFromString(decodeURIComponent(location))
  } catch {
    return null
  }
}

type DeezerTracksResponse = {
  data: Array<{ id: number; link: string }>
  total: number
}

export async function fetchDeezerPlaylistTracks(
  playlistId: string
): Promise<{ urls: string[]; total: number }> {
  const res = await fetch(`https://api.deezer.com/playlist/${playlistId}/tracks?limit=100`)
  if (res.status === 404) throw new Error('Deezer playlist not found or is private')
  if (!res.ok) throw new Error(`Deezer API error (${res.status})`)

  const data = await res.json() as DeezerTracksResponse
  const urls = data.data.map(t => t.link).filter(Boolean)

  return { urls, total: data.total }
}
