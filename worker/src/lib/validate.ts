// Exact hostnames accepted as music URLs
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

// Bandcamp uses per-artist subdomains: artist.bandcamp.com
function isBandcamp(hostname: string): boolean {
  return hostname === 'bandcamp.com' || hostname.endsWith('.bandcamp.com')
}

/**
 * Returns a parsed URL if the input is a valid HTTPS music platform link,
 * or null if it should be rejected.
 */
export function parseMusicUrl(raw: string): URL | null {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return null
  }
  if (url.protocol !== 'https:') return null
  if (ALLOWED_HOSTS.has(url.hostname) || isBandcamp(url.hostname)) return url
  return null
}

export const SUPPORTED_PLATFORMS =
  'Spotify, Apple Music, YouTube, Deezer, Tidal, SoundCloud, Amazon Music, Bandcamp, Napster, Anghami, Boomplay, Pandora'
