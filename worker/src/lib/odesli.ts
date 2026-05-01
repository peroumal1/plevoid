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
  const qs = new URLSearchParams({ url })
  if (apiKey) qs.set('key', apiKey)
  const res = await fetch(`https://api.song.link/v1-alpha.1/links?${qs}`)
  if (res.status === 404) return null  // confirmed not found on any platform
  if (!res.ok) throw new Error(`Odesli ${res.status}`)  // transient — queue will retry
  return res.json() as Promise<OdesliData>
}
