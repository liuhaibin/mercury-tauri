# Mercury Tauri

Mercury Tauri is a cross-platform desktop RSS reader built with Tauri, Rust, and TypeScript.

## Current Features

- Add RSS/Atom feeds by URL
- Import feeds from OPML
- Live OPML import progress with completion toast
- Sync individual feeds
- Browse articles with incremental loading (infinite scroll)
- Search articles
- Read/unread tracking
- Sidebar feed list sorted alphabetically (case-insensitive)
- Delete feeds directly from the sidebar
- Multi-select feeds and delete them in one action
- Reader fallback for JS-challenge/anti-bot pages

## Tech Stack

- Frontend: Vite + TypeScript + HTML/CSS
- Backend: Rust + Tauri commands
- Database: SQLite via sqlx
- Parsing: feed-rs
- Reader extraction: Mozilla Readability (frontend)

## Project Structure

- `src/`: frontend UI and Tauri invoke client
- `src-tauri/src/commands/`: feed/article backend commands
- `src-tauri/src/db.rs`: SQLite initialization and schema
- `src-tauri/src/feed_parser.rs`: feed parsing and article extraction

## Quick Start

### Prerequisites

- Node.js 18+
- Rust toolchain (stable)
- Tauri system dependencies for your OS: https://tauri.app/start/prerequisites/

### Install

```bash
npm install
```

### Run In Development

```bash
npm run tauri dev
```

### Build Frontend

```bash
npm run build
```

### Check Rust Backend

```bash
cd src-tauri
cargo check
```

## Tauri Command Payload Notes

Frontend invoke payload keys use camelCase field names (for example `feedId`, `articleId`, `isRead`).

Examples:

```ts
invoke("delete_feed", { feedId })
invoke("get_article", { articleId })
invoke("mark_read", { articleId, isRead })
```

## Feed Management Notes

- Feed deletion removes associated articles.
- SQLite foreign keys are enabled, and backend deletion also explicitly removes articles for reliability.
- Sidebar supports both inline single-feed delete and bulk delete through select mode.
- Select mode includes `Select all`, `Clear selection`, `Cancel`, and `Delete` actions.

## OPML Import Notes

- OPML import emits live progress in the Add Feed modal (`current / total`).
- Feed requests use bounded concurrency and HTTP timeouts to avoid indefinite hangs.
- A completion toast remains visible until dismissed.

## Known Reader Behavior

Some sites return anti-bot pages (for example messages like "Please enable JS and disable any ad blocker").
When detected:

- Blocker HTML is not persisted as article content.
- Reader falls back to summary/help text.
- "Open original article" link remains available.

## Documentation

- Implementation details: [IMPLEMENTATION_SUMMARY.md](IMPLEMENTATION_SUMMARY.md)
- Setup and workflow notes: [QUICKSTART.md](QUICKSTART.md)
- Swift vs Tauri comparison: [SWIFT_vs_TAURI.md](SWIFT_vs_TAURI.md)

## License

Refer to your repository license policy.
