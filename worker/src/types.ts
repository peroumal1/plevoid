export const PLAYLIST_LIMIT = 50
export const PLAYLIST_LIMIT_ERROR = `playlist limit reached (${PLAYLIST_LIMIT} tracks maximum)`

export const TITLE_MAX_LENGTH = 200
export const TITLE_LENGTH_ERROR = `title too long (${TITLE_MAX_LENGTH} characters maximum)`

// Playlists expire 90 days after last access (or creation if never accessed)
export const RETENTION_SECONDS = 90 * 24 * 60 * 60

export type QueueMessage = {
  trackId: string
  url: string
}

export type Bindings = {
  plevoid_db: D1Database
  ASSETS: Fetcher
  ODESLI_API_KEY?: string
  ODESLI_QUEUE: Queue<QueueMessage>
  YOUTUBE_API_KEY?: string
  ADMIN_TOKEN?: string
}
