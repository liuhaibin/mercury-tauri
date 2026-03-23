# Mercury Tauri - Quick Start Guide

## Installation & Setup

### 1. Install Dependencies
```bash
cd /Users/haibin/Documents/workspace/mercury-tauri
npm install
```

### 2. Try Dev Build
```bash
npm run tauri dev
```

This will:
- Start the Vite dev server
- Open the Tauri app window
- Enable hot reload and dev tools

### 3. If Compilation Fails

Check the error message - here are common issues and fixes:

#### Issue: "error: could not find `Cargo.toml`"
**Solution**: Navigate to the src-tauri directory explicitly
```bash
cd src-tauri
cargo build
cd ..
```

#### Issue: "no method named `db` found for mutable reference"
**Solution**: The SQL plugin API usage might be incorrect. The code has been updated to use the Tauri v2 API directly.
```bash
# Update the plugin
npm install @tauri-apps/plugin-sql@latest
```

#### Issue: Type annotation errors in SQL queries
**Solution**: These are usually resolved by proper type inference. If they persist:
```bash
# Clean build
cargo clean
cargo build
```

#### Issue: Feed parsing fails
**Solution**: Make sure all dependencies are installed
```bash
cd src-tauri
cargo fetch
cargo build
```

### 4. Test the App

Once it's running:

1. **Add a test feed**:
   - Click the "+" button in the sidebar
   - Enter: `https://feeds.arstechnica.com/arstechnica/index`
   - Click "Add Feed"

2. **View articles**:
   - Click on the feed in the sidebar
   - Articles should load in the middle panel

2.5 **Manage feeds**:
   - Hover a feed item in the sidebar
   - Click the "x" button to delete that feed
   - Or click the select button in the sidebar header to enter multi-select mode
   - In multi-select mode you can use `Select all`, `Clear selection`, and `Delete`
   - Feed list is sorted alphabetically by name

2.6 **Import OPML**:
   - Open the Add Feed modal
   - Click "Import OPML" and choose an `.opml` file
   - The modal shows live import progress while feeds are processed
   - When import finishes, a completion toast stays visible until you dismiss it

3. **Read an article**:
   - Click on an article
   - It should display in the reader panel on the right

4. **Search**:
   - Type in the search box at the top
   - Results should filter in real-time

### 5. Build for Production

```bash
npm run build
npm run tauri build
```

This creates a production build in `src-tauri/target/release`.

- **macOS**: Creates a `.dmg` file
- **Windows**: Creates an `.msi` installer
- **Linux**: Creates an `.AppImage` file

## File Changes Summary

### Modified Files
- `package.json` - Added SQL plugin dependency
- `tauri.conf.json` - Updated app name, size, and plugin config
- `src/main.ts` - Completely rewritten with UI logic
- `src/styles.css` - Full styling for three-column layout
- `index.html` - New UI template
- `src-tauri/Cargo.toml` - Added dependencies for RSS parsing and SQL
- `src-tauri/src/lib.rs` - Initialized plugins and commands

### New Files
- `src/services.ts` - API layer for backend commands
- `src/types.ts` - TypeScript interfaces
- `src-tauri/src/models.rs` - Data structures
- `src-tauri/src/db.rs` - Database initialization
- `src-tauri/src/feed_parser.rs` - Feed parsing logic
- `src-tauri/src/commands/mod.rs` - Command module exports
- `src-tauri/src/commands/feed.rs` - Feed commands
- `src-tauri/src/commands/article.rs` - Article commands

## Key API Endpoints (Tauri Commands)

### Feed Management
```typescript
// Get all feeds
invoke("get_feeds") -> Feed[]

// Add a new feed
invoke("add_feed", { req: { url: string } }) -> Feed

// Delete a feed
invoke("delete_feed", { feedId: string }) -> void

// Sync a feed (refresh articles)
invoke("sync_feed", { feedId: string }) -> FeedSyncResult

// Import feeds from OPML
invoke("import_opml", { req: { opml_content: string } }) -> OpmlImportResult
```

### Article Management
```typescript
// Get articles (optionally filtered by feed, paginated)
invoke("get_articles", { feedId?: string, limit?: number, offset?: number }) -> Article[]

// Get a specific article
invoke("get_article", { articleId: string }) -> Article

// Fetch full HTML content for an article URL
invoke("fetch_article_content", { articleId: string }) -> string

// Mark article as read/unread
invoke("mark_read", { articleId: string, isRead: boolean }) -> void

// Search articles (paginated)
invoke("search_articles", { query: string, feedId?: string, limit?: number, offset?: number }) -> Article[]
```

## Troubleshooting

### Database Issues
If the app crashes on startup:
1. Delete the SQLite database: `rm ~/.tauri/mercury.db`
2. Restart the app (it will recreate the database)

### Feed Parsing Fails
Common causes:
- Invalid feed URL
- Feed requires authentication
- Feed is not standard RSS/Atom/JSON

### UI Not Responsive
- Check browser console in dev tools (Ctrl+Shift+I)
- Look for JavaScript errors
- Try clearing the browser cache (Ctrl+Shift+Delete)
- Large OPML imports now show progress in the modal instead of appearing stuck

### Performance Issues
- Limit article count: Edit `get_articles` limit in `commands/article.rs`
- Disable auto-sync if it's slow
- Close other applications to free memory

## Environment Variables

Currently, none are required. In the future, you might want to add:
- `MERCURY_DB_PATH` - Custom database location
- `MERCURY_LLM_KEY` - AI provider API key
- `MERCURY_SYNC_INTERVAL` - Auto-sync frequency

## Next Development Steps

1. **Add Error Boundaries** - Better error messages in the UI
2. **Cursor Pagination** - Replace offset paging with cursor-based paging for stronger consistency on frequently updated feeds
3. **Add Offline Support** - Cache articles locally
4. **Settings Page** - Preferences UI
5. **Import/Export OPML** - Backup and restore feeds

## Resources

- [Tauri Documentation](https://tauri.app/en/docs/)
- [Tauri SQL Plugin](https://github.com/tauri-apps/plugins-workspace/tree/main/plugins/sql)
- [feed-rs Crate](https://docs.rs/feed-rs/)
- [Original Mercury Repository](https://github.com/neolee/mercury)

## Support

If you encounter issues:
1. Check the error message carefully
2. Run `cargo check` to verify compilation
3. Check browser dev tools for frontend errors
4. Search the [Tauri Discord](https://discord.gg/7gPkfpFN) community

---

**Last Updated**: March 2026
**Mercury Tauri Version**: 0.1.0 MVP
