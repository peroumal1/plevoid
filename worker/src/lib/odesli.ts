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

export async function fetchOdesli(url: string, apiKey?: string): Promise<OdesliData | null> {
  try {
    const qs = new URLSearchParams({ url })
    if (apiKey) qs.set('key', apiKey)
    const res = await fetch(`https://api.song.link/v1-alpha.1/links?${qs}`)
    if (!res.ok) return null
    return res.json() as Promise<OdesliData>
  } catch {
    return null
  }
}
