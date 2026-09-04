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

// A real browser UA avoids basic bot filtering on the scraped page.
const BROWSER_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36'

type SongLinkPageData = {
  entityUniqueId: string
  pageUrl: string
  entityData?: { title?: string; artistName?: string; thumbnailUrl?: string }
  sections?: Array<{ links?: Array<{ platform?: string; url?: string }> }>
}

// song.link's public REST API (api.song.link/v1-alpha.1/links) was shut down for
// anonymous access on 2026-07-31 (returns 401 PUBLIC_API_ACCESS_DEPRECATED). Its web
// frontend still resolves arbitrary source URLs though, embedding the same matched
// data as Next.js page JSON — same scraping approach as fetchSpotifyEmbedTracks.
export async function fetchOdesli(
  url: string,
  // No longer used (scraping needs no key); kept so callers don't need to change.
  _apiKey?: string,
  { waitOnRateLimit = false, maxWaitCycles = Infinity } = {}
): Promise<OdesliData | null> {
  const endpoint = `https://song.link/${url}`
  const headers = { 'User-Agent': BROWSER_USER_AGENT }

  let res = await fetch(endpoint, { headers })
  let cycles = 0
  while (res.status === 429 && waitOnRateLimit && cycles++ < maxWaitCycles) {
    // Retry-After may be an HTTP date instead of seconds: fall back to 60s if unparseable
    const parsed = parseInt(res.headers.get('retry-after') ?? '', 10)
    const delay = Number.isFinite(parsed) && parsed > 0 ? parsed : 60
    await new Promise(r => setTimeout(r, (delay + 5) * 1000))
    res = await fetch(endpoint, { headers })
  }
  if (!res.ok) throw new Error(`Odesli ${res.status}`)

  const html = await res.text()
  const match = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/)
  if (!match) throw new Error('Could not parse song.link page')

  const next = JSON.parse(match[1]) as { page?: string; props?: { pageProps?: { pageData?: SongLinkPageData } } }
  const pageData = next.props?.pageProps?.pageData
  if (!pageData) return null // song.link's own /not-found page — no match for this URL

  const linksByPlatform: Record<string, { url: string }> = {}
  for (const section of pageData.sections ?? []) {
    for (const link of section.links ?? []) {
      if (link.platform && link.url) linksByPlatform[link.platform] = { url: link.url }
    }
  }

  return {
    entityUniqueId: pageData.entityUniqueId,
    pageUrl: pageData.pageUrl,
    linksByPlatform,
    entitiesByUniqueId: {
      [pageData.entityUniqueId]: {
        title: pageData.entityData?.title ?? '',
        artistName: pageData.entityData?.artistName ?? '',
        ...(pageData.entityData?.thumbnailUrl ? { thumbnailUrl: pageData.entityData.thumbnailUrl } : {}),
      },
    },
  }
}
