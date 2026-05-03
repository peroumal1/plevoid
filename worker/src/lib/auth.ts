import { getPlaylistForEdit, tokenExists } from './db'
import type { Playlist } from './db'

type TokenError = { err: string; status: 401 | 403 | 404 }
type TokenOk = { playlist: Playlist & { edit_token: string } }

export async function verifyAnyToken(
  db: D1Database,
  token: string | undefined
): Promise<boolean> {
  if (!token) return false
  return tokenExists(db, token)
}

export async function verifyToken(
  db: D1Database,
  id: string,
  token: string | undefined
): Promise<TokenError | TokenOk> {
  if (!token) return { err: 'missing X-Edit-Token', status: 401 }
  const playlist = await getPlaylistForEdit(db, id)
  if (!playlist) return { err: 'not found', status: 404 }
  if (playlist.edit_token !== token) return { err: 'forbidden', status: 403 }
  return { playlist }
}
