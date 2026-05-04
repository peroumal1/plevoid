type YouTubePlaylistItemsResponse = {
  items: Array<{
    snippet: {
      resourceId: {
        kind: string
        videoId?: string
      }
    }
  }>
}

export function extractYouTubePlaylistId(url: string): string | null {
  try {
    const u = new URL(url)
    if (
      (u.hostname === 'youtube.com' || u.hostname === 'www.youtube.com' || u.hostname === 'music.youtube.com') &&
      u.pathname === '/playlist'
    ) {
      return u.searchParams.get('list')
    }
  } catch {}
  return null
}

export async function fetchYouTubePlaylistTracks(
  playlistId: string,
  apiKey: string
): Promise<{ urls: string[] }> {
  const qs = new URLSearchParams({
    part: 'snippet',
    playlistId,
    maxResults: '50',
    key: apiKey,
  })
  const res = await fetch(
    `https://www.googleapis.com/youtube/v3/playlistItems?${qs}`,
    { headers: { Referer: 'https://plevoid.xyz' } }
  )
  if (res.status === 404) throw new Error('YouTube playlist not found or private')
  if (res.status === 403) throw new Error('YouTube playlist not accessible')
  if (!res.ok) throw new Error(`YouTube API error (${res.status})`)

  const data = await res.json() as YouTubePlaylistItemsResponse
  const urls = data.items
    .map(item => item.snippet?.resourceId?.videoId)
    .filter((id): id is string => Boolean(id))
    .map(id => `https://www.youtube.com/watch?v=${id}`)

  return { urls }
}
