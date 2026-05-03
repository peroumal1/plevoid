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

export async function fetchOdesli(
  url: string,
  apiKey?: string,
  { waitOnRateLimit = false, maxWaitCycles = Infinity } = {}
): Promise<OdesliData | null> {
  const qs = new URLSearchParams({ url })
  if (apiKey) qs.set('key', apiKey)
  const endpoint = `https://api.song.link/v1-alpha.1/links?${qs}`

  let res = await fetch(endpoint)
  let cycles = 0
  while (res.status === 429 && waitOnRateLimit && cycles++ < maxWaitCycles) {
    const delay = parseInt(res.headers.get('retry-after') ?? '60', 10)
    await new Promise(r => setTimeout(r, (delay + 5) * 1000))
    res = await fetch(endpoint)
  }
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`Odesli ${res.status}`)
  return res.json() as Promise<OdesliData>
}
