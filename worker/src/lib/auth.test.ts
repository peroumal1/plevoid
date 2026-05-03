import { describe, it, expect, vi, beforeEach } from 'vitest'
import { verifyToken, verifyAnyToken } from './auth'
import * as db from './db'

vi.mock('./db', () => ({
  getPlaylistForEdit: vi.fn(),
  tokenExists: vi.fn(),
}))

describe('verifyToken', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when no token is provided', async () => {
    const result = await verifyToken({} as any, 'playlist-id', undefined)
    expect(result).toEqual({ err: 'missing X-Edit-Token', status: 401 })
  })

  it('does not query the database when token is missing', async () => {
    await verifyToken({} as any, 'playlist-id', undefined)
    expect(db.getPlaylistForEdit).not.toHaveBeenCalled()
  })

  it('returns 404 when playlist does not exist', async () => {
    vi.mocked(db.getPlaylistForEdit).mockResolvedValue(null)
    const result = await verifyToken({} as any, 'unknown-id', 'any-token')
    expect(result).toEqual({ err: 'not found', status: 404 })
  })

  it('returns 403 when token does not match', async () => {
    vi.mocked(db.getPlaylistForEdit).mockResolvedValue({
      id: 'playlist-id',
      edit_token: 'correct-token',
      name: 'Test Playlist',
      created_at: '2024-01-01',
      last_accessed_at: '2024-01-01',
    } as any)
    const result = await verifyToken({} as any, 'playlist-id', 'wrong-token')
    expect(result).toEqual({ err: 'forbidden', status: 403 })
  })

  it('returns the playlist when token matches', async () => {
    const playlist = {
      id: 'playlist-id',
      edit_token: 'correct-token',
      name: 'Test Playlist',
      created_at: '2024-01-01',
      last_accessed_at: '2024-01-01',
    }
    vi.mocked(db.getPlaylistForEdit).mockResolvedValue(playlist as any)
    const result = await verifyToken({} as any, 'playlist-id', 'correct-token')
    expect('playlist' in result).toBe(true)
    if ('playlist' in result) {
      expect(result.playlist.id).toBe('playlist-id')
      expect(result.playlist.edit_token).toBe('correct-token')
    }
  })

  it('queries the database with the provided id', async () => {
    vi.mocked(db.getPlaylistForEdit).mockResolvedValue(null)
    await verifyToken({} as any, 'specific-id', 'some-token')
    expect(db.getPlaylistForEdit).toHaveBeenCalledWith({}, 'specific-id')
  })
})

describe('verifyAnyToken', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns false when token is undefined', async () => {
    expect(await verifyAnyToken({} as any, undefined)).toBe(false)
    expect(db.tokenExists).not.toHaveBeenCalled()
  })

  it('returns false when token does not exist in any playlist', async () => {
    vi.mocked(db.tokenExists).mockResolvedValue(false)
    expect(await verifyAnyToken({} as any, 'unknown-token')).toBe(false)
  })

  it('returns true when token matches a playlist', async () => {
    vi.mocked(db.tokenExists).mockResolvedValue(true)
    expect(await verifyAnyToken({} as any, 'valid-token')).toBe(true)
  })
})
