# Changelog

All notable changes to this project will be documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/) and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.21] — 2026-05-04

### Changed
- docs: update README for YouTube import, OG tags, iframe player, CSV improvements

## [0.2.20] — 2026-05-04

### Added
- YouTube playlist import

## [0.2.19] — 2026-05-04

### Added
- inject OG meta tags server-side for playlist pages

## [0.2.18] — 2026-05-04

### Fixed
- add _preview to OdesliBlob type
- skip unresolved tracks from CSV export, add platform URL columns, warn on skipped tracks

### Changed
- refactor: extract PLAYLIST_LIMIT_ERROR constant, parallelize CSV export queries, minor cleanups

## [0.2.17] — 2026-05-04

### Added
- open platform links in iframe modal instead of new tab

## [0.2.16] — 2026-05-04

### Fixed
- add short link domains for Spotify, Apple Music, Deezer, Tidal, SoundCloud

## [0.2.15] — 2026-05-04

### Fixed
- reject playlist/artist URLs on single-track add with actionable error

### Changed
- ux: update search placeholder to clarify track or album URL

## [0.2.14] — 2026-05-04

### Changed
- refactor: extract PLAYLIST_LIMIT constant, dedupe import route handlers

## [0.2.13] — 2026-05-04

### Changed
- docs: update architecture notes — cron every 10 min, queue 429/4xx handling

## [0.2.12] — 2026-05-03

### Fixed
- speed up stuck-track recovery — cron every 10 min, threshold 10 min

## [0.2.11] — 2026-05-03

### Fixed
- write _notFound on non-retryable 4xx; improve import trigger visibility

## [0.2.10] — 2026-05-03

### Changed
- ux: move import trigger below search bar

## [0.2.9] — 2026-05-03

### Added
- require valid edit token on /api/search

### Fixed
- correct Odesli 429 handling in queue consumer + tests

## [0.2.8] — 2026-05-03

### Fixed
- exclude integration tests from unit test runner
- process queue messages one at a time with 6s pre-call delay

### Changed
- docs: update queue consumer and cron docs to reflect recent fixes
- test: add integration tests for happy paths (Workers pool + D1)

## [0.2.7] — 2026-05-03

### Changed
- docs+tests: add unit tests for auth/deezer/spotify/validate, update README

## [0.2.6] — 2026-05-03

### Added
- keep edit token in URL and surface save reminder

## [0.2.5] — 2026-05-03

### Added
- use search metadata as preview stub while Odesli resolves
- Deezer import, unified import panel, sync Odesli with queue fallback

## [0.2.4] — 2026-05-03

### Changed
- refactor: extract verifyToken, batch imports, merge Spotify into search

## [0.2.3] — 2026-05-02

### Added
- import public Spotify playlists via Client Credentials

## [0.2.2] — 2026-05-02

### Added
- expose /api/version and display version in footer on all pages

### Fixed
- put version on its own line below footer text
- add more spacing and separator line above edit page footer

### Changed
- ci: auto-bump patch version on every deploy, keep manual release for minor/major

## [0.2.1] — 2026-05-02

### Fixed
- move CHANGELOG script to separate file to avoid YAML heredoc conflict
- exclude test files from Workers tsconfig to avoid tinybench/EventTarget conflict

### Changed
- ci: split release workflow into test + release jobs
- ci: add release workflow with version bump, CHANGELOG update, and tagging

## [0.2.0] — 2026-05-02

### Added
- Track reordering — up/down buttons in edit view, persisted via `position` column and `PATCH /api/playlists/:id/tracks/reorder`
- Bulk URL import — textarea mode in edit view accepts one URL per line, fires parallel POSTs
- CSV export — `GET /api/playlists/:id/export.csv` (public); download link in playlist view
- Vitest unit tests for CSV generation (10 tests covering escaping, `_notFound`, null odesli data)
- CI now runs `npm test` before deploying

### Changed
- Track insertion assigns `position` automatically (`MAX(position) + 1`)
- Track list ordered by `position ASC NULLS LAST, added_at ASC`

## [0.1.0] — 2026-04-01

### Added
- Anonymous playlist creation with public URL and secret edit token stored in `localStorage`
- Add tracks by URL (Spotify, Apple Music, YouTube, YouTube Music, Deezer, SoundCloud, Amazon Music, Bandcamp)
- Song search autocomplete via iTunes API, geo-localised by Cloudflare request metadata
- Async Odesli enrichment via Cloudflare Queue (artwork, cross-platform links); frontend polls until resolved
- `_notFound` sentinel for tracks Odesli cannot resolve; edit-URL shortcut shown in edit view
- 50-track limit per playlist
- 90-day inactivity retention policy via weekly cron (`last_accessed_at` updated on every read)
- Songlink attribution in footer
- GitHub Actions CI/CD: typecheck then deploy on push to `main`
- SVG logo and favicons
