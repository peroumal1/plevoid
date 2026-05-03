export type Playlist = {
  id: string
  title: string
  created_at: number
}

export type Track = {
  id: string
  playlist_id: string
  url_original: string
  odesli_data: string | null
  added_at: number
  position: number | null
}

export async function getPlaylist(db: D1Database, id: string): Promise<Playlist | null> {
  return db
    .prepare('SELECT id, title, created_at FROM playlists WHERE id = ?')
    .bind(id)
    .first<Playlist>()
}

export async function getPlaylistForEdit(
  db: D1Database,
  id: string
): Promise<(Playlist & { edit_token: string }) | null> {
  return db
    .prepare('SELECT id, title, created_at, edit_token FROM playlists WHERE id = ?')
    .bind(id)
    .first<Playlist & { edit_token: string }>()
}

export async function tokenExists(db: D1Database, token: string): Promise<boolean> {
  const row = await db
    .prepare('SELECT 1 FROM playlists WHERE edit_token = ?')
    .bind(token)
    .first()
  return row !== null
}

export async function createPlaylist(
  db: D1Database,
  id: string,
  edit_token: string,
  title: string
): Promise<void> {
  await db
    .prepare('INSERT INTO playlists (id, edit_token, title, created_at) VALUES (?, ?, ?, ?)')
    .bind(id, edit_token, title, Math.floor(Date.now() / 1000))
    .run()
}

export async function updateLastAccessed(db: D1Database, id: string): Promise<void> {
  await db
    .prepare('UPDATE playlists SET last_accessed_at = ? WHERE id = ?')
    .bind(Math.floor(Date.now() / 1000), id)
    .run()
}

export async function updatePlaylistTitle(
  db: D1Database,
  id: string,
  title: string
): Promise<void> {
  await db
    .prepare('UPDATE playlists SET title = ? WHERE id = ?')
    .bind(title, id)
    .run()
}

export async function getTracks(db: D1Database, playlist_id: string): Promise<Track[]> {
  const { results } = await db
    .prepare(
      'SELECT id, playlist_id, url_original, odesli_data, added_at, position FROM tracks WHERE playlist_id = ? ORDER BY position ASC NULLS LAST, added_at ASC'
    )
    .bind(playlist_id)
    .all<Track>()
  return results
}

export async function insertTrack(
  db: D1Database,
  id: string,
  playlist_id: string,
  url_original: string,
  odesli_data: string | null
): Promise<void> {
  await db
    .prepare(
      'INSERT INTO tracks (id, playlist_id, url_original, odesli_data, added_at, position) VALUES (?, ?, ?, ?, ?, (SELECT COALESCE(MAX(position), 0) + 1 FROM tracks WHERE playlist_id = ?))'
    )
    .bind(id, playlist_id, url_original, odesli_data, Math.floor(Date.now() / 1000), playlist_id)
    .run()
}

export async function reorderTracks(db: D1Database, playlist_id: string, order: string[]): Promise<void> {
  if (!order.length) return
  const stmts = order.map((trackId, i) =>
    db.prepare('UPDATE tracks SET position = ? WHERE id = ? AND playlist_id = ?')
      .bind(i + 1, trackId, playlist_id)
  )
  await db.batch(stmts)
}

export async function updateTrackOdesli(
  db: D1Database,
  id: string,
  odesli_data: string
): Promise<void> {
  await db
    .prepare('UPDATE tracks SET odesli_data = ? WHERE id = ?')
    .bind(odesli_data, id)
    .run()
}

export async function getTrackCount(db: D1Database, playlist_id: string): Promise<number> {
  const result = await db
    .prepare('SELECT COUNT(*) as count FROM tracks WHERE playlist_id = ?')
    .bind(playlist_id)
    .first<{ count: number }>()
  return result?.count ?? 0
}

export async function deleteOldPlaylists(db: D1Database, cutoff: number): Promise<number> {
  const results = await db.batch([
    db.prepare('DELETE FROM tracks WHERE playlist_id IN (SELECT id FROM playlists WHERE COALESCE(last_accessed_at, created_at) < ?)').bind(cutoff),
    db.prepare('DELETE FROM playlists WHERE COALESCE(last_accessed_at, created_at) < ?').bind(cutoff),
  ])
  return results[1].meta.changes
}

export async function deleteTrack(
  db: D1Database,
  id: string,
  playlist_id: string
): Promise<boolean> {
  const result = await db
    .prepare('DELETE FROM tracks WHERE id = ? AND playlist_id = ?')
    .bind(id, playlist_id)
    .run()
  return result.meta.changes > 0
}
