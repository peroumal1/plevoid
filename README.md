# Plevoid

Anonymous music playlist sharing. No accounts, no sign-up. Create a playlist, share the link.

Paste any Spotify, Apple Music, YouTube, or Deezer URL — Plevoid resolves it via [song.link](https://odesli.co) and shows platform links for every listener.

## Features

- Create and share playlists with a public link; edit via a secret token stored in `localStorage` and the URL hash
- Song search autocomplete (iTunes + Spotify, interleaved and deduped)
- Import public playlists from Spotify or Deezer (including link.deezer.com short links)
- Bulk URL import — paste multiple URLs at once
- Odesli enrichment: artwork, title, artist, and cross-platform links resolved asynchronously
- Search-added tracks render immediately with preview metadata; full Odesli data fills in via queue
- Track reordering via up/down buttons
- CSV export of any playlist
- 50-track limit per playlist; playlists deleted after 90 days of inactivity

## Stack

- **Worker** — TypeScript + [Hono](https://hono.dev) on Cloudflare Workers
- **Database** — Cloudflare D1 (SQLite)
- **Queue** — Cloudflare Queues (async Odesli resolution, ≤10 req/min)
- **Frontend** — three static HTML files, no framework, no build step
- **Tests** — Vitest (unit tests for pure functions)

## Local development

Requires [mise](https://mise.jdx.dev) for Node version management.

```zsh
cd worker
mise exec -- npm install
mise exec -- npm run db:init   # first time only — creates local D1
mise exec -- npm run dev       # worker + frontend at http://localhost:8787
```

Running tests:

```zsh
mise exec -- npm test
mise exec -- npm run typecheck
```

## Deployment

One-time infra setup (run locally):

```zsh
cd worker
npx wrangler login
npx wrangler d1 create plevoid-db          # paste the database_id into wrangler.toml
npx wrangler queues create plevoid-odesli-queue
npx wrangler d1 execute plevoid-db --remote --file=schema.sql

# required for Spotify import and search
npx wrangler secret put SPOTIFY_CLIENT_ID
npx wrangler secret put SPOTIFY_CLIENT_SECRET

# optional — song.link stopped issuing new API keys; anonymous mode works at 10 req/min
npx wrangler secret put ODESLI_API_KEY
```

Every push to `main` deploys automatically via GitHub Actions. The workflow runs `typecheck` and `npm test` before deploying.

Required GitHub secret: `CLOUDFLARE_API_TOKEN` (Workers edit permission).

### Schema migrations

When the schema changes, run the migration on both local and remote D1:

```zsh
# example
npx wrangler d1 execute plevoid-db --command="ALTER TABLE tracks ADD COLUMN position INTEGER"
npx wrangler d1 execute plevoid-db --remote --command="ALTER TABLE tracks ADD COLUMN position INTEGER"
```

## Architecture

```
POST /api/playlists/:id/tracks
  → validate URL, check 50-track limit
  → if metadata (search pick): store _preview stub, enqueue, return immediately
  → else: call Odesli synchronously; on error/429 fall back to queue

POST /api/playlists/:id/import/{spotify,deezer}
  → resolve playlist ID, fetch up to 50 track URLs
  → batch-insert tracks, enqueue each for Odesli resolution

Queue consumer (max_concurrency=1, 6s between calls, ≤10 req/min)
  → call Odesli API (sleeps on 429 and retries in-place)
  → UPDATE tracks SET odesli_data = ?   -- or {_notFound:true} on 404

Frontend polls GET /api/playlists/:id every 5s
  → updates track cards when odesli_data arrives or _preview clears

PATCH /api/playlists/:id/tracks/reorder   -- token-protected
  → batch-updates position column

GET  /api/playlists/:id/export.csv        -- public
  → streams CSV with title, artist, url_original, url_odesli, added_at

Cron (weekly):
  → delete playlists inactive for 90+ days
  → re-enqueue tracks with odesli_data IS NULL older than 1 hour (lost queue messages)
```

Each playlist has a public `id` (UUID v4) and a secret `edit_token` (UUID v4). The token is returned once at creation, stored in `localStorage` and the URL hash (`#token=...`), and is never returned by the public read endpoint.

Supported platforms: Spotify, Apple Music, YouTube, YouTube Music, Deezer, Tidal, SoundCloud, Amazon Music, Bandcamp, Napster, Anghami, Boomplay, Pandora.

## Versioning

This project follows [Semantic Versioning](https://semver.org). Releases are tagged in git (`v0.2.0`, …) and summarised in [CHANGELOG.md](CHANGELOG.md).

- **Patch** (`0.x.Y`): bug fixes, copy changes, styling tweaks
- **Minor** (`0.X.0`): new user-facing features, backwards-compatible API additions
- **Major** (`X.0.0`): breaking API changes or significant architecture shifts

To cut a release:

```zsh
# bump version in worker/package.json, update CHANGELOG.md, then:
git tag v0.2.0
git push origin v0.2.0
```
