export type QueueMessage = {
  trackId: string
  url: string
}

export type Bindings = {
  plevoid_db: D1Database
  ASSETS: Fetcher
  ODESLI_API_KEY?: string
  ODESLI_QUEUE: Queue<QueueMessage>
}
