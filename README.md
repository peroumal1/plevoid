# Plevoid

Anonymous music playlist sharing. No accounts, no sign-up. Create a playlist, share the link.

Paste any Spotify, Apple Music, YouTube, or Deezer URL — Plevoid resolves it via [song.link](https://odesli.co) and shows platform links for every listener.

## Features

- Create and share playlists with a public link; edit via a secret token stored in `localStorage`
- Song search autocomplete (iTunes API, geo-localised)
- Odesli enrichment: artwork, title, artist, and cross-platform links resolved asynchronously
- Track reordering via up/down buttons
- Bulk URL import — paste multiple URLs at once
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

# optional — raises Odesli anonymous rate limit
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
  → insert track row (odesli_data = null, position = MAX+1)
  → enqueue { trackId, url }
  → return immediately

Queue consumer (≤10 req/min, 6s between calls)
  → call Odesli API
  → UPDATE tracks SET odesli_data = ?   -- or {_notFound:true} on 404

Frontend polls GET /api/playlists/:id every 5s
  → updates track cards when odesli_data arrives

PATCH /api/playlists/:id/tracks/reorder   -- token-protected
  → batch-updates position column

GET  /api/playlists/:id/export.csv        -- public
  → streams CSV with title, artist, url_original, url_odesli, added_at
```

Each playlist has a public `id` (12-char UUID slice) and a secret `edit_token` (full UUID). The token is returned once at creation and stored in `localStorage`. It is never returned by the public read endpoint.

Supported platforms: Spotify, Apple Music, YouTube, YouTube Music, Deezer, SoundCloud, Amazon Music, Bandcamp.

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
