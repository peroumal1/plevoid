CREATE TABLE IF NOT EXISTS playlists (
  id               TEXT PRIMARY KEY,
  edit_token       TEXT NOT NULL,
  title            TEXT NOT NULL,
  created_at       INTEGER NOT NULL,
  last_accessed_at INTEGER
);

CREATE TABLE IF NOT EXISTS tracks (
  id           TEXT PRIMARY KEY,
  playlist_id  TEXT NOT NULL REFERENCES playlists(id),
  url_original TEXT NOT NULL,
  odesli_data  TEXT,
  added_at     INTEGER NOT NULL,
  position     INTEGER
);

-- Every track read/count filters by playlist_id
CREATE INDEX IF NOT EXISTS idx_tracks_playlist ON tracks(playlist_id);

-- tokenExists() runs on every search keystroke
CREATE INDEX IF NOT EXISTS idx_playlists_edit_token ON playlists(edit_token);

-- Cron recovery scan for tracks never resolved by the queue
CREATE INDEX IF NOT EXISTS idx_tracks_unresolved ON tracks(added_at) WHERE odesli_data IS NULL;
