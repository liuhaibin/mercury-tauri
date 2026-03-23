use crate::models::Article;
use chrono::Utc;
use tauri::{command, State};
use reqwest;
use std::time::Duration;

fn is_bot_challenge_page(html: &str) -> bool {
    let lower = html.to_lowercase();
    lower.contains("please enable js and disable any ad blocker")
        || lower.contains("enable javascript")
        || lower.contains("checking if the site connection is secure")
        || lower.contains("cf-chl")
        || lower.contains("cloudflare")
}

#[command]
pub async fn get_articles(
    db: State<'_, crate::db::DbState>,
    feed_id: Option<String>,
    limit: Option<i64>,
    offset: Option<i64>,
) -> Result<Vec<Article>, String> {
    let page_limit = limit.unwrap_or(50).clamp(1, 200);
    let page_offset = offset.unwrap_or(0).max(0);

    let articles = if let Some(fid) = feed_id {
        sqlx::query_as::<_, Article>(
            "SELECT id, feed_id, title, url, content, summary, author, published_at, is_read, created_at, updated_at FROM articles WHERE feed_id = ? ORDER BY published_at DESC LIMIT ? OFFSET ?",
        )
        .bind(&fid)
        .bind(page_limit)
        .bind(page_offset)
        .fetch_all(&db.pool)
        .await
        .map_err(|e| e.to_string())?
    } else {
        sqlx::query_as::<_, Article>(
            "SELECT id, feed_id, title, url, content, summary, author, published_at, is_read, created_at, updated_at FROM articles ORDER BY published_at DESC LIMIT ? OFFSET ?",
        )
        .bind(page_limit)
        .bind(page_offset)
        .fetch_all(&db.pool)
        .await
        .map_err(|e| e.to_string())?
    };

    Ok(articles)
}

#[command]
pub async fn get_article(
    db: State<'_, crate::db::DbState>,
    article_id: String,
) -> Result<Article, String> {
    let article = sqlx::query_as::<_, Article>(
        "SELECT id, feed_id, title, url, content, summary, author, published_at, is_read, created_at, updated_at FROM articles WHERE id = ?",
    )
        .bind(&article_id)
        .fetch_optional(&db.pool)
        .await
        .map_err(|e| e.to_string())?;

    article.ok_or_else(|| "Article not found".to_string())
}

#[command]
pub async fn mark_read(
    db: State<'_, crate::db::DbState>,
    article_id: String,
    is_read: bool,
) -> Result<(), String> {
    let now = Utc::now().to_rfc3339();
    let is_read_int = if is_read { 1 } else { 0 };

    sqlx::query("UPDATE articles SET is_read = ?, updated_at = ? WHERE id = ?")
    .bind(is_read_int)
    .bind(&now)
    .bind(&article_id)
    .execute(&db.pool)
    .await
    .map_err(|e| e.to_string())?;

    // Update feed's unread count
    let _ = sqlx::query(
        "UPDATE feeds SET unread_count = (SELECT COUNT(*) FROM articles WHERE feed_id = feeds.id AND is_read = 0) WHERE id = (SELECT feed_id FROM articles WHERE id = ?)",
    )
    .bind(&article_id)
    .execute(&db.pool)
    .await;

    Ok(())
}

/// Fetches the full HTML of the article's web page and stores it in the DB.
/// This allows the frontend to run Mozilla Readability on the complete page.
#[command]
pub async fn fetch_article_content(
    db: State<'_, crate::db::DbState>,
    article_id: String,
) -> Result<String, String> {
    let article = sqlx::query_as::<_, Article>(
        "SELECT id, feed_id, title, url, content, summary, author, published_at, is_read, created_at, updated_at FROM articles WHERE id = ?",
    )
    .bind(&article_id)
    .fetch_optional(&db.pool)
    .await
    .map_err(|e| e.to_string())?
    .ok_or_else(|| "Article not found".to_string())?;

    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(15))
        .user_agent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15")
        .build()
        .map_err(|e| e.to_string())?;

    let response = client
        .get(&article.url)
        .send()
        .await
        .map_err(|e| format!("Failed to fetch article page: {}", e))?;
    let html = response.text().await.map_err(|e| e.to_string())?;

    if is_bot_challenge_page(&html) {
        return Err(
            "This site blocks automated fetch (JS challenge/ad-block check). Open the original article in your browser."
                .to_string(),
        );
    }

    let now = Utc::now().to_rfc3339();
    sqlx::query("UPDATE articles SET content = ?, updated_at = ? WHERE id = ?")
        .bind(&html)
        .bind(&now)
        .bind(&article_id)
        .execute(&db.pool)
        .await
        .map_err(|e| e.to_string())?;

    Ok(html)
}

#[command]
pub async fn search_articles(
    db: State<'_, crate::db::DbState>,
    query: String,
    feed_id: Option<String>,
    limit: Option<i64>,
    offset: Option<i64>,
) -> Result<Vec<Article>, String> {
    let search_term = format!("%{}%", query);
    let page_limit = limit.unwrap_or(50).clamp(1, 200);
    let page_offset = offset.unwrap_or(0).max(0);

    let articles = if let Some(fid) = feed_id {
        sqlx::query_as::<_, Article>(
            "SELECT id, feed_id, title, url, content, summary, author, published_at, is_read, created_at, updated_at FROM articles WHERE feed_id = ? AND (title LIKE ? OR content LIKE ?) ORDER BY published_at DESC LIMIT ? OFFSET ?",
        )
        .bind(&fid)
        .bind(&search_term)
        .bind(&search_term)
        .bind(page_limit)
        .bind(page_offset)
        .fetch_all(&db.pool)
        .await
        .map_err(|e| e.to_string())?
    } else {
        sqlx::query_as::<_, Article>(
            "SELECT id, feed_id, title, url, content, summary, author, published_at, is_read, created_at, updated_at FROM articles WHERE title LIKE ? OR content LIKE ? ORDER BY published_at DESC LIMIT ? OFFSET ?",
        )
        .bind(&search_term)
        .bind(&search_term)
        .bind(page_limit)
        .bind(page_offset)
        .fetch_all(&db.pool)
        .await
        .map_err(|e| e.to_string())?
    };

    Ok(articles)
}

#[cfg(test)]
#[path = "../../tests/commands/article_tests.rs"]
mod tests;
