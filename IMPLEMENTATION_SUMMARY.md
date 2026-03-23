# Mercury Tauri - Implementation Summary (Executive)

## Status
- MVP is functional.
- Feed URL import works.
- OPML import works with live progress, request timeouts, and completion toast feedback.
- Article sync works per feed via refresh.
- Feed list is sorted alphabetically by name (case-insensitive).
- Sidebar supports direct feed deletion.
- Sidebar also supports multi-select feed deletion.
- Mercury-style paginated entry loading is implemented (`limit`/`offset` + infinite scroll).
- Reader flow now handles JS-challenge/anti-bot pages with graceful fallback.
- Build checks are passing (`cargo check`, `npm run build`).

## What Is Implemented

### Backend (Rust)
- Modules:
  - `models.rs`
  - `db.rs`
  - `feed_parser.rs`
  - `commands/feed.rs`
  - `commands/article.rs`
- Database:
  - SQLite with `sqlx` pool state managed in Tauri app state.
  - Tables: `feeds`, `articles`, `tags`, `article_tags`.
- Commands:
  - Feed: `get_feeds`, `add_feed`, `delete_feed`, `sync_feed`, `import_opml`
  - Article: `get_articles`, `get_article`, `mark_read`, `search_articles`, `fetch_article_content`
- Feed parsing:
  - Uses `feed-rs` and supports RSS/Atom parsing.
- OPML import:
  - Parses OPML outlines (`xmlUrl`/`xmlurl`/`url`).
  - Processes feed URLs with bounded concurrency.
  - Uses HTTP timeouts to avoid indefinite hangs.
  - Skips duplicate feed URLs.
- Article APIs:
  - `get_articles` and `search_articles` now support optional `limit` and `offset` for paging.
  - `fetch_article_content` detects common bot/challenge pages and returns a descriptive error instead of storing blocker HTML.

### Frontend (TypeScript + HTML/CSS)
- Sidebar feed list, article list, reader panel.
- Add Feed modal supports:
  - URL import
  - OPML file import
- Sidebar feed actions:
  - Feed list sorted by title
  - Inline delete button per feed item
  - Multi-select mode with `Select all`, `Clear selection`, `Cancel`, and `Delete`
- Search, read-state updates, and per-feed sync actions are wired.
- Infinite scroll loading for articles (Mercury-style incremental loading).
- Request token guard prevents stale async article-list responses from replacing newer state.
- OPML modal shows live `current / total` progress and a dismissible completion toast.
- Reader uses layered fallback:
  - feed content
  - full-page fetch
  - summary/help fallback for JS-challenge blocked pages

## Notable Stability Fixes Applied
- Migrated Rust DB access away from removed `tauri-plugin-sql` v2 `Database` API to app-managed `sqlx` pool.
- Hardened SQLite initialization:
  - Uses explicit filename connect options.
  - Creates DB if missing.
  - Falls back from app config dir to app data dir when needed.
- Fixed Tauri invoke payload argument keys to camelCase for command binding (`articleId`, `feedId`, `isRead`).
- Improved modal error surfacing for import failures.
- Changed OPML import flow to avoid hanging on remote feed fetch during import.
- Added OPML progress events from Rust to the frontend modal.
- Added persistent completion toast feedback for OPML import.
- Isolated article render path from mark-read side effects so post-load failures do not show as article load failures.
- Enabled SQLite foreign keys at connection level and added explicit article cleanup on feed delete.
- Added bulk feed selection and deletion UI in the sidebar.

## Current Behavior
- OPML import creates feed entries immediately.
- OPML import reports live progress while feeds are processed.
- Articles are fetched when user syncs a feed.
- Article list is loaded incrementally using backend pagination.
- Feed list is returned sorted by title (`COLLATE NOCASE ASC`).
- Deleting a feed from the sidebar removes the feed and its associated articles.
- Multiple feeds can be selected and deleted together from sidebar select mode.
- Duplicate feed URLs are skipped during OPML import.
- JS-challenge/anti-bot pages are not persisted as reader content.

## Remaining Gaps (Planned)
- OPML export
- Tag management UI
- AI features (summarization/translation/tagging)
- Settings/preferences and keyboard shortcuts

## Quick Validation Checklist
- [ ] Add one feed by URL
- [ ] Import OPML file
- [ ] Confirm imported feeds appear in sidebar
- [ ] Confirm OPML modal progress advances during import
- [ ] Sync a few imported feeds and confirm articles load
- [ ] Search articles
- [ ] Mark article as read and verify unread counts update
- [ ] Delete a feed from sidebar and confirm it disappears along with its articles
- [ ] Select multiple feeds and confirm bulk delete removes all of them
- [ ] Scroll the article list and confirm additional pages load
- [ ] Open an article from a JS-challenge site and confirm fallback message/link appears

## Run Commands
```bash
npm install
npm run tauri dev
```

```bash
cd src-tauri
cargo check
```
