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

async function getAccessToken(clientId: string, clientSecret: string): Promise<string> {
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  })
  if (!res.ok) throw new Error(`Spotify auth failed (${res.status})`)
  const data = await res.json() as { access_token: string }
  return data.access_token
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
