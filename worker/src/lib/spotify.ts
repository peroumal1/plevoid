export function extractSpotifyPlaylistId(url: string): string | null {
  try {
    const u = new URL(url)
    if (u.hostname !== 'open.spotify.com') return null
    const match = u.pathname.match(/^\/playlist\/([A-Za-z0-9]+)/)
    return match?.[1] ?? null
  } catch {
    return null
  }
}

let tokenCache: { value: string; expiresAt: number } | null = null

async function getAccessToken(clientId: string, clientSecret: string): Promise<string> {
  if (tokenCache && Date.now() < tokenCache.expiresAt) return tokenCache.value
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  })
  if (!res.ok) throw new Error(`Spotify auth failed (${res.status})`)
  const data = await res.json() as { access_token: string; expires_in: number }
  tokenCache = { value: data.access_token, expiresAt: Date.now() + (data.expires_in - 60) * 1000 }
  return tokenCache.value
}

type SpotifyTracksResponse = {
  total: number
  items: Array<{ track: { external_urls: { spotify: string } } | null }>
}

export async function fetchSpotifyPlaylistTracks(
  clientId: string,
  clientSecret: string,
  playlistId: string
): Promise<{ urls: string[]; total: number }> {
  const token = await getAccessToken(clientId, clientSecret)

  // One page (100) is enough to fill any remaining slots — Plevoid caps at 50 tracks
  const qs = new URLSearchParams({
    limit: '100',
    offset: '0',
    fields: 'total,items(track(external_urls(spotify)))',
  })
  const res = await fetch(
    `https://api.spotify.com/v1/playlists/${playlistId}/tracks?${qs}`,
    { headers: { Authorization: `Bearer ${token}` } }
  )
  if (res.status === 404) throw new Error('Spotify playlist not found, private, or is a Spotify editorial playlist')
  if (!res.ok) throw new Error(`Spotify API error (${res.status})`)

  const data = await res.json() as SpotifyTracksResponse
  const urls = data.items
    .map(item => item.track?.external_urls?.spotify)
    .filter((url): url is string => Boolean(url))

  return { urls, total: data.total }
}

type SpotifySearchItem = {
  name: string
  artists: Array<{ name: string }>
  album: { images: Array<{ url: string }> }
  external_urls: { spotify: string }
}

export type SpotifySearchResult = {
  title: string
  artist: string
  artwork: string
  url: string
}

export async function searchSpotify(
  clientId: string,
  clientSecret: string,
  query: string
): Promise<SpotifySearchResult[]> {
  const token = await getAccessToken(clientId, clientSecret)
  const qs = new URLSearchParams({ q: query, type: 'track', limit: '5' })
  const res = await fetch(`https://api.spotify.com/v1/search?${qs}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) return []
  const data = await res.json() as { tracks: { items: SpotifySearchItem[] } }
  return data.tracks.items.map(item => ({
    title: item.name,
    artist: item.artists[0]?.name ?? '',
    // images are ordered largest→smallest; use last for smallest footprint
    artwork: item.album.images.at(-1)?.url ?? '',
    url: item.external_urls.spotify,
  }))
}
