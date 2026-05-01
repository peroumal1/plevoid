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
      'SELECT id, playlist_id, url_original, odesli_data, added_at FROM tracks WHERE playlist_id = ? ORDER BY added_at ASC'
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
      'INSERT INTO tracks (id, playlist_id, url_original, odesli_data, added_at) VALUES (?, ?, ?, ?, ?)'
    )
    .bind(id, playlist_id, url_original, odesli_data, Math.floor(Date.now() / 1000))
    .run()
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
