use crate::models::{Article, Feed};
use chrono::Utc;
use feed_rs::parser;
use uuid::Uuid;

/// Parse feed from URL and extract metadata
pub async fn parse_feed_from_url(url: &str) -> Result<(Feed, Vec<Article>), String> {
    let response = reqwest::get(url)
        .await
        .map_err(|e| format!("Failed to fetch feed: {}", e))?;

    let content = response.bytes().await.map_err(|e| e.to_string())?;

    parse_feed(&content, url).await
}

pub async fn parse_feed(content: &[u8], original_url: &str) -> Result<(Feed, Vec<Article>), String> {
    let feed_entry = parser::parse(content).map_err(|e| format!("Failed to parse feed: {}", e))?;

    let feed_id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();

    // Extract feed metadata
    let title = feed_entry
        .title
        .as_ref()
        .map(|t| t.content.clone())
        .unwrap_or_else(|| "Untitled Feed".to_string());

    let description = feed_entry
        .description
        .as_ref()
        .map(|d| d.content.clone());

    let site_url = feed_entry
        .links
        .iter()
        .find(|link| link.rel.as_deref().unwrap_or("") != "self")
        .map(|link| link.href.clone());

    let favicon_url = extract_favicon_url(&site_url);

    let feed = Feed {
        id: feed_id.clone(),
        title,
        url: original_url.to_string(),
        description,
        favicon_url,
        site_url,
        article_count: feed_entry.entries.len() as i32,
        unread_count: feed_entry.entries.len() as i32,
        created_at: now.clone(),
        updated_at: now,
    };

    // Parse articles
    let articles = feed_entry
        .entries
        .into_iter()
        .map(|entry| {
            let article_id = Uuid::new_v4().to_string();
            let title = entry
                .title
                .as_ref()
                .map(|t| t.content.clone())
                .unwrap_or_else(|| "Untitled".to_string());

            let url = entry
                .links
                .first()
                .map(|link| link.href.clone())
                .unwrap_or_else(|| original_url.to_string());

            let content = extract_article_content(&entry);
            let summary = entry.summary.as_ref().map(|s| s.content.clone());
            let author = entry
                .authors
                .first()
                .map(|a| a.name.clone())
                .or_else(|| {
                    entry
                        .contributors
                        .first()
                        .map(|c| c.name.clone())
                });

            let published_at = entry
                .published
                .as_ref()
                .map(|d| d.to_rfc3339())
                .unwrap_or_else(|| Utc::now().to_rfc3339());

            let now = Utc::now().to_rfc3339();

            Article {
                id: article_id,
                feed_id: feed_id.clone(),
                title,
                url,
                content,
                summary,
                author,
                published_at,
                is_read: false,
                created_at: now.clone(),
                updated_at: now,
            }
        })
        .collect();

    Ok((feed, articles))
}

fn extract_article_content(entry: &feed_rs::model::Entry) -> String {
    // Preserve raw HTML so the frontend can run Readability on it
    if let Some(content) = &entry.content {
        if let Some(body) = &content.body {
            if !body.is_empty() {
                return body.clone();
            }
        }
    }

    if let Some(summary) = &entry.summary {
        if !summary.content.is_empty() {
            return summary.content.clone();
        }
    }

    String::new()
}

fn extract_favicon_url(site_url: &Option<String>) -> Option<String> {
    site_url.as_ref().and_then(|url| {
        if let Ok(parsed_url) = url::Url::parse(url) {
            let base = format!(
                "{}://{}",
                parsed_url.scheme(),
                parsed_url.host_str().unwrap_or("")
            );
            Some(format!("{}/favicon.ico", base))
        } else {
            None
        }
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_favicon_extraction() {
        let url = Some("https://example.com/page".to_string());
        let favicon = extract_favicon_url(&url);
        assert_eq!(favicon, Some("https://example.com/favicon.ico".to_string()));
    }
}
