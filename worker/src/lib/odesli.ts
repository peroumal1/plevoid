export type OdesliData = {
  entityUniqueId: string
  pageUrl: string
  linksByPlatform: Record<string, { url: string }>
  entitiesByUniqueId: Record<string, {
    title: string
    artistName: string
    thumbnailUrl?: string
  }>
}

export async function fetchOdesli(url: string): Promise<OdesliData | null> {
  try {
    const res = await fetch(
      `https://api.song.link/v1-alpha.1/links?url=${encodeURIComponent(url)}`
    )
    if (!res.ok) return null
    return res.json() as Promise<OdesliData>
  } catch {
    return null
  }
}
