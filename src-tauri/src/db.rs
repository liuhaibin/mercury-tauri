use sqlx::{sqlite::{SqliteConnectOptions, SqlitePoolOptions}, SqlitePool};
use std::fs;
use tauri::{AppHandle, Manager};

pub struct DbState {
    pub pool: SqlitePool,
}

pub async fn init_db(app: &AppHandle) -> Result<DbState, Box<dyn std::error::Error>> {
    let app_dir = match app.path().app_config_dir() {
        Ok(config_dir) if fs::create_dir_all(&config_dir).is_ok() => config_dir,
        _ => {
            let data_dir = app.path().app_data_dir()?;
            fs::create_dir_all(&data_dir)?;
            data_dir
        }
    };

    let db_path = app_dir.join("mercury.db");
    let connect_options = SqliteConnectOptions::new()
        .filename(&db_path)
        .create_if_missing(true)
        .foreign_keys(true);

    let pool = SqlitePoolOptions::new()
        .max_connections(5)
        .connect_with(connect_options)
        .await?;

    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS feeds (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            url TEXT UNIQUE NOT NULL,
            description TEXT,
            favicon_url TEXT,
            site_url TEXT,
            article_count INTEGER DEFAULT 0,
            unread_count INTEGER DEFAULT 0,
            is_starred INTEGER DEFAULT 0,
            last_sync_at TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_feeds_created_at ON feeds(created_at);
        "#,
    )
    .execute(&pool)
    .await?;

    // Migration: ensure is_starred exists for databases created before this column was added
    let has_is_starred = sqlx::query_scalar::<_, i64>(
        "SELECT 1 FROM pragma_table_info('feeds') WHERE name = 'is_starred' LIMIT 1",
    )
    .fetch_optional(&pool)
    .await?
    .is_some();

    if !has_is_starred {
        sqlx::query("ALTER TABLE feeds ADD COLUMN is_starred INTEGER DEFAULT 0")
            .execute(&pool)
            .await?;
    }
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS articles (
            id TEXT PRIMARY KEY,
            feed_id TEXT NOT NULL,
            title TEXT NOT NULL,
            url TEXT UNIQUE NOT NULL,
            content TEXT NOT NULL,
            summary TEXT,
            author TEXT,
            published_at TEXT NOT NULL,
            is_read INTEGER DEFAULT 0,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            FOREIGN KEY (feed_id) REFERENCES feeds(id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_articles_feed_id ON articles(feed_id);
        CREATE INDEX IF NOT EXISTS idx_articles_is_read ON articles(is_read);
        CREATE INDEX IF NOT EXISTS idx_articles_published_at ON articles(published_at);
        "#,
    )
    .execute(&pool)
    .await?;

    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS tags (
            id TEXT PRIMARY KEY,
            name TEXT UNIQUE NOT NULL,
            created_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS article_tags (
            article_id TEXT NOT NULL,
            tag_id TEXT NOT NULL,
            created_at TEXT NOT NULL,
            PRIMARY KEY (article_id, tag_id),
            FOREIGN KEY (article_id) REFERENCES articles(id) ON DELETE CASCADE,
            FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
        );
        "#,
    )
    .execute(&pool)
    .await?;

    Ok(DbState { pool })
}

