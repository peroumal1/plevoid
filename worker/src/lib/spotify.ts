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

type EmbedData = {
  props: { pageProps: { state: { data: { entity: { trackList: Array<{ uri: string }> } } } } }
}

export async function fetchSpotifyEmbedTracks(playlistId: string): Promise<{ urls: string[] }> {
  const res = await fetch(`https://open.spotify.com/embed/playlist/${playlistId}`)
  if (res.status === 404) throw new Error('Spotify playlist not found or private')
  if (!res.ok) throw new Error(`Spotify embed error (${res.status})`)

  const html = await res.text()
  const match = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/)
  if (!match) throw new Error('Could not parse Spotify embed page')

  const data = JSON.parse(match[1]) as EmbedData
  const trackList = data.props.pageProps.state.data.entity.trackList

  const urls = trackList
    .map(t => {
      const id = t.uri.split(':')[2]
      return id ? `https://open.spotify.com/track/${id}` : null
    })
    .filter((url): url is string => url !== null)

  return { urls }
}

