CREATE TABLE IF NOT EXISTS playlists (
  id         TEXT PRIMARY KEY,
  edit_token TEXT NOT NULL,
  title      TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS tracks (
  id           TEXT PRIMARY KEY,
  playlist_id  TEXT NOT NULL REFERENCES playlists(id),
  url_original TEXT NOT NULL,
  odesli_data  TEXT,
  added_at     INTEGER NOT NULL
);
