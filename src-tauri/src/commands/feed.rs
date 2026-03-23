use crate::models::{AddFeedRequest, Feed, FeedSyncResult, OpmlImportRequest, OpmlImportResult};
use chrono::Utc;
use std::collections::HashSet;
use tauri::{command, State};
use uuid::Uuid;

struct OpmlFeedEntry {
    url: String,
    title: Option<String>,
    site_url: Option<String>,
}

#[command]
pub async fn get_feeds(db: State<'_, crate::db::DbState>) -> Result<Vec<Feed>, String> {
    let feeds = sqlx::query_as::<_, Feed>(
        "SELECT id, title, url, description, favicon_url, site_url, article_count, unread_count, created_at, updated_at FROM feeds ORDER BY title COLLATE NOCASE ASC",
    )
        .fetch_all(&db.pool)
        .await
        .map_err(|e| e.to_string())?;

    Ok(feeds)
}

#[command]
pub async fn add_feed(
    db: State<'_, crate::db::DbState>,
    req: AddFeedRequest,
) -> Result<Feed, String> {
    // Parse the feed
    let (feed, articles) = crate::feed_parser::parse_feed_from_url(&req.url)
        .await
        .map_err(|e| format!("Failed to parse feed: {}", e))?;

    // Check if feed already exists
    let existing: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM feeds WHERE url = ?")
        .bind(&req.url)
        .fetch_one(&db.pool)
        .await
        .map_err(|e| e.to_string())?;

    if existing > 0 {
        return Err("Feed already exists".to_string());
    }

    let now = Utc::now().to_rfc3339();

    // Insert feed
    sqlx::query(
        "INSERT INTO feeds (id, title, url, description, favicon_url, site_url, article_count, unread_count, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(&feed.id)
    .bind(&feed.title)
    .bind(&feed.url)
    .bind(feed.description.as_deref())
    .bind(feed.favicon_url.as_deref())
    .bind(feed.site_url.as_deref())
    .bind(feed.article_count)
    .bind(feed.unread_count)
    .bind(&now)
    .bind(&now)
    .execute(&db.pool)
    .await
    .map_err(|e| e.to_string())?;

    // Insert articles
    for article in articles {
        let _ = sqlx::query(
            "INSERT INTO articles (id, feed_id, title, url, content, summary, author, published_at, is_read, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(&article.id)
        .bind(&article.feed_id)
        .bind(&article.title)
        .bind(&article.url)
        .bind(&article.content)
        .bind(article.summary.as_deref())
        .bind(article.author.as_deref())
        .bind(&article.published_at)
        .bind(0)
        .bind(&now)
        .bind(&now)
        .execute(&db.pool)
        .await;
    }

    Ok(feed)
}

#[command]
pub async fn delete_feed(
    db: State<'_, crate::db::DbState>,
    feed_id: String,
) -> Result<(), String> {
    // Explicitly delete articles first in case foreign keys are not enforced
    sqlx::query("DELETE FROM articles WHERE feed_id = ?")
        .bind(&feed_id)
        .execute(&db.pool)
        .await
        .map_err(|e| e.to_string())?;

    sqlx::query("DELETE FROM feeds WHERE id = ?")
        .bind(&feed_id)
        .execute(&db.pool)
        .await
        .map_err(|e| e.to_string())?;

    Ok(())
}

#[command]
pub async fn sync_feed(
    db: State<'_, crate::db::DbState>,
    feed_id: String,
) -> Result<FeedSyncResult, String> {
    // Get feed URL
    let feed = sqlx::query_as::<_, Feed>(
        "SELECT id, title, url, description, favicon_url, site_url, article_count, unread_count, created_at, updated_at FROM feeds WHERE id = ?",
    )
        .bind(&feed_id)
        .fetch_optional(&db.pool)
        .await
        .map_err(|e| e.to_string())?
        .ok_or("Feed not found".to_string())?;

    // Parse feed
    let (_, articles) = crate::feed_parser::parse_feed_from_url(&feed.url)
        .await
        .map_err(|e| format!("Failed to parse feed: {}", e))?;

    let now = Utc::now().to_rfc3339();
    let mut new_count = 0;
    let mut updated_count = 0;

    // Upsert articles
    for article in articles {
        let existing: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM articles WHERE url = ?")
            .bind(&article.url)
            .fetch_one(&db.pool)
            .await
            .map_err(|e| e.to_string())?;

        if existing > 0 {
            updated_count += 1;
        } else {
            new_count += 1;
            let _ = sqlx::query(
                "INSERT INTO articles (id, feed_id, title, url, content, summary, author, published_at, is_read, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            )
            .bind(Uuid::new_v4().to_string())
            .bind(&feed_id)
            .bind(&article.title)
            .bind(&article.url)
            .bind(&article.content)
            .bind(article.summary.as_deref())
            .bind(article.author.as_deref())
            .bind(&article.published_at)
            .bind(0)
            .bind(&now)
            .bind(&now)
            .execute(&db.pool)
            .await;
        }
    }

    // Update feed's article count
    let _ = sqlx::query(
        "UPDATE feeds SET article_count = article_count + ?, unread_count = unread_count + ?, updated_at = ? WHERE id = ?",
    )
    .bind(new_count)
    .bind(new_count)
    .bind(&now)
    .bind(&feed_id)
    .execute(&db.pool)
    .await;

    Ok(FeedSyncResult {
        feed_id,
        new_articles: new_count,
        updated_articles: updated_count,
    })
}

#[command]
pub async fn import_opml(
    db: State<'_, crate::db::DbState>,
    req: OpmlImportRequest,
) -> Result<OpmlImportResult, String> {
    let entries = extract_opml_feed_entries(&req.opml_content)?;
    let mut seen: HashSet<String> = HashSet::new();
    let unique_entries: Vec<OpmlFeedEntry> = entries
        .into_iter()
        .filter(|entry| seen.insert(entry.url.clone()))
        .collect();

    let mut imported = 0;
    let mut skipped = 0;
    let mut failed = 0;

    for entry in &unique_entries {
        let existing: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM feeds WHERE url = ?")
            .bind(&entry.url)
            .fetch_one(&db.pool)
            .await
            .map_err(|e| e.to_string())?;

        if existing > 0 {
            skipped += 1;
            continue;
        }

        let now = Utc::now().to_rfc3339();

        // Try to fetch the feed to get real metadata and articles
        match crate::feed_parser::parse_feed_from_url(&entry.url).await {
            Ok((parsed_feed, articles)) => {
                let title = entry.title.as_deref().unwrap_or(&parsed_feed.title);
                let site_url = entry.site_url.as_deref().or(parsed_feed.site_url.as_deref());

                let insert_result = sqlx::query(
                    "INSERT INTO feeds (id, title, url, description, favicon_url, site_url, article_count, unread_count, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                )
                .bind(&parsed_feed.id)
                .bind(title)
                .bind(&entry.url)
                .bind(parsed_feed.description.as_deref())
                .bind(parsed_feed.favicon_url.as_deref())
                .bind(site_url)
                .bind(parsed_feed.article_count)
                .bind(parsed_feed.unread_count)
                .bind(&now)
                .bind(&now)
                .execute(&db.pool)
                .await;

                if insert_result.is_ok() {
                    for article in &articles {
                        let _ = sqlx::query(
                            "INSERT OR IGNORE INTO articles (id, feed_id, title, url, content, summary, author, published_at, is_read, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                        )
                        .bind(&article.id)
                        .bind(&article.feed_id)
                        .bind(&article.title)
                        .bind(&article.url)
                        .bind(&article.content)
                        .bind(article.summary.as_deref())
                        .bind(article.author.as_deref())
                        .bind(&article.published_at)
                        .bind(0)
                        .bind(&now)
                        .bind(&now)
                        .execute(&db.pool)
                        .await;
                    }
                    imported += 1;
                } else {
                    failed += 1;
                }
            }
            Err(_) => {
                // Fall back to inserting feed with just OPML metadata (no articles)
                let title = entry.title.clone().unwrap_or_else(|| entry.url.clone());

                let insert_result = sqlx::query(
                    "INSERT INTO feeds (id, title, url, description, favicon_url, site_url, article_count, unread_count, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                )
                .bind(Uuid::new_v4().to_string())
                .bind(&title)
                .bind(&entry.url)
                .bind(None::<&str>)
                .bind(None::<&str>)
                .bind(entry.site_url.as_deref())
                .bind(0)
                .bind(0)
                .bind(&now)
                .bind(&now)
                .execute(&db.pool)
                .await;

                if insert_result.is_ok() {
                    imported += 1;
                } else {
                    failed += 1;
                }
            }
        }
    }

    Ok(OpmlImportResult {
        total: unique_entries.len() as i32,
        imported,
        skipped,
        failed,
    })
}

fn extract_opml_feed_entries(opml_content: &str) -> Result<Vec<OpmlFeedEntry>, String> {
    let doc = roxmltree::Document::parse(opml_content)
        .map_err(|e| format!("Invalid OPML/XML: {}", e))?;

    let entries: Vec<OpmlFeedEntry> = doc
        .descendants()
        .filter(|node| node.has_tag_name("outline"))
        .filter_map(|node| {
            node.attribute("xmlUrl")
                .or_else(|| node.attribute("xmlurl"))
                .or_else(|| node.attribute("url"))
                .map(|url| OpmlFeedEntry {
                    url: url.trim().to_string(),
                    title: node
                        .attribute("title")
                        .or_else(|| node.attribute("text"))
                        .map(|v| v.trim().to_string())
                        .filter(|v| !v.is_empty()),
                    site_url: node
                        .attribute("htmlUrl")
                        .or_else(|| node.attribute("htmlurl"))
                        .map(|v| v.trim().to_string())
                        .filter(|v| !v.is_empty()),
                })
        })
        .filter(|entry| !entry.url.is_empty())
        .collect();

    if entries.is_empty() {
        return Err("No feed URLs found in OPML file".to_string());
    }

    Ok(entries)
}
