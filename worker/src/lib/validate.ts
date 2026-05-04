const ALLOWED_HOSTS = new Set([
  'open.spotify.com',
  'music.apple.com',
  'youtube.com',
  'www.youtube.com',
  'youtu.be',
  'music.youtube.com',
  'deezer.com',
  'www.deezer.com',
  'tidal.com',
  'listen.tidal.com',
  'soundcloud.com',
  'www.soundcloud.com',
  'on.soundcloud.com',
  'spotify.link',
  'apple.co',
  'itun.es',
  'deezer.page.link',
  'dzr.page.link',
  'link.tidal.com',
  'music.amazon.com',
  'app.napster.com',
  'play.napster.com',
  'play.anghami.com',
  'www.boomplay.com',
  'pandora.com',
  'www.pandora.com',
  'music.yandex.ru',
  'music.yandex.com',
  'audius.co',
])

function isBandcamp(hostname: string): boolean {
  return hostname === 'bandcamp.com' || hostname.endsWith('.bandcamp.com')
}

// Path prefixes that identify collections (playlists, albums, artists) rather than tracks.
// Keyed by hostname; paths are checked with startsWith.
const COLLECTION_PATHS: Record<string, string[]> = {
  'open.spotify.com':   ['/playlist/', '/artist/'],
  'deezer.com':         ['/playlist/', '/artist/'],
  'www.deezer.com':     ['/playlist/', '/artist/'],
  'youtube.com':        ['/playlist', '/channel/', '/@'],
  'www.youtube.com':    ['/playlist', '/channel/', '/@'],
  'music.youtube.com':  ['/playlist', '/channel/', '/@'],
}

// Query params that are meaningful per hostname — everything else is stripped.
// Absence of an entry means strip all params.
const KEEP_PARAMS: Record<string, Set<string>> = {
  'youtube.com':       new Set(['v', 't']),  // video ID and optional timestamp
  'www.youtube.com':   new Set(['v', 't']),
  'music.youtube.com': new Set(['v']),
  'music.apple.com':   new Set(['i']),        // track within an album page
}

function stripTracking(url: URL): URL {
  const keep = KEEP_PARAMS[url.hostname]
  if (!keep && url.search === '') return url

  const clean = new URL(url.toString())
  const toDelete: string[] = []
  clean.searchParams.forEach((_, key) => {
    if (!keep || !keep.has(key)) toDelete.push(key)
  })
  toDelete.forEach(k => clean.searchParams.delete(k))
  return clean
}

export function isPlaylistUrl(raw: string): boolean {
  let url: URL
  try { url = new URL(raw) } catch { return false }
  const prefixes = COLLECTION_PATHS[url.hostname]
  return !!prefixes && prefixes.some(p => url.pathname.startsWith(p))
}

/**
 * Validates and sanitises a music platform URL.
 * Returns the cleaned URL (tracking params removed) or null if invalid/collection URL.
 */
export function parseMusicUrl(raw: string): URL | null {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return null
  }
  if (url.protocol !== 'https:') return null
  if (!ALLOWED_HOSTS.has(url.hostname) && !isBandcamp(url.hostname)) return null
  const prefixes = COLLECTION_PATHS[url.hostname]
  if (prefixes?.some(p => url.pathname.startsWith(p))) return null
  return stripTracking(url)
}

export const SUPPORTED_PLATFORMS =
  'Spotify, Apple Music, YouTube, Deezer, Tidal, SoundCloud, Amazon Music, Bandcamp, Napster, Anghami, Boomplay, Pandora'
