use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct Feed {
    pub id: String,
    pub title: String,
    pub url: String,
    pub description: Option<String>,
    pub favicon_url: Option<String>,
    pub site_url: Option<String>,
    pub article_count: i32,
    pub unread_count: i32,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct Article {
    pub id: String,
    pub feed_id: String,
    pub title: String,
    pub url: String,
    pub content: String,
    pub summary: Option<String>,
    pub author: Option<String>,
    pub published_at: String,
    pub is_read: bool,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Deserialize)]
pub struct AddFeedRequest {
    pub url: String,
}

#[derive(Debug, Deserialize)]
pub struct OpmlImportRequest {
    pub opml_content: String,
}

#[derive(Debug, Serialize)]
pub struct FeedSyncResult {
    pub feed_id: String,
    pub new_articles: i32,
    pub updated_articles: i32,
}

#[derive(Debug, Serialize)]
pub struct OpmlImportResult {
    pub total: i32,
    pub imported: i32,
    pub skipped: i32,
    pub failed: i32,
}

#[cfg(test)]
#[path = "../tests/unit/models_tests.rs"]
mod tests;
