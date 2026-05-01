# Plevoid

Anonymous music playlist sharing. No accounts, no sign-up. Create a playlist, share the link.

Paste any Spotify, Apple Music, YouTube, or Deezer URL — Plevoid resolves it via [song.link](https://odesli.co) and shows platform links for every listener.

## Stack

- **Worker** — TypeScript + [Hono](https://hono.dev) on Cloudflare Workers
- **Database** — Cloudflare D1 (SQLite)
- **Queue** — Cloudflare Queues (async Odesli resolution, ≤10 req/min)
- **Frontend** — three static HTML files, no framework, no build step

## Local development

Requires [mise](https://mise.jdx.dev) for Node version management.

```zsh
cd worker
mise exec -- npm install
mise exec -- npm run db:init   # first time only — creates local D1
mise exec -- npm run dev       # worker + frontend at http://localhost:8787
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

After that, every push to `main` deploys automatically via GitHub Actions. The workflow runs `tsc --noEmit` before deploying.

Required GitHub secret: `CLOUDFLARE_API_TOKEN` (Workers edit permission).

## Architecture

```
POST /api/playlists/:id/tracks
  → insert track row (odesli_data = null)
  → enqueue { trackId, url }
  → return immediately

Queue consumer (≤10/min)
  → call Odesli API
  → UPDATE tracks SET odesli_data = ?

Frontend polls GET /api/playlists/:id every 5s
  → updates track cards when odesli_data arrives
```

Each playlist has a public `id` (UUID) and a secret `edit_token` (UUID). The token is returned once at creation and stored in `localStorage`. It is never returned by the public read endpoint.

Supported platforms: Spotify, Apple Music, YouTube, YouTube Music, Deezer, SoundCloud, Amazon Music, Bandcamp.
