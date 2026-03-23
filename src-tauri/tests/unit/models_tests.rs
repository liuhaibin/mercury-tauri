use super::*;

#[test]
fn test_feed_serializes_to_json() {
    let feed = Feed {
        id: "feed-1".to_string(),
        title: "Test Feed".to_string(),
        url: "https://example.com/feed".to_string(),
        description: Some("A description".to_string()),
        favicon_url: Some("https://example.com/favicon.ico".to_string()),
        site_url: Some("https://example.com".to_string()),
        article_count: 42,
        unread_count: 5,
        is_starred: false,
        created_at: "2024-01-01T00:00:00Z".to_string(),
        updated_at: "2024-01-02T00:00:00Z".to_string(),
    };

    let json = serde_json::to_string(&feed).unwrap();
    assert!(json.contains("\"id\":\"feed-1\""));
    assert!(json.contains("\"title\":\"Test Feed\""));
    assert!(json.contains("\"article_count\":42"));
    assert!(json.contains("\"unread_count\":5"));
    assert!(json.contains("\"is_starred\":false"));
}

#[test]
fn test_feed_optional_fields_can_be_null() {
    let feed = Feed {
        id: "feed-2".to_string(),
        title: "Minimal Feed".to_string(),
        url: "https://example.com/feed".to_string(),
        description: None,
        favicon_url: None,
        site_url: None,
        article_count: 0,
        unread_count: 0,
        is_starred: false,
        created_at: "2024-01-01T00:00:00Z".to_string(),
        updated_at: "2024-01-01T00:00:00Z".to_string(),
    };

    let json = serde_json::to_string(&feed).unwrap();
    assert!(json.contains("\"description\":null"));
    assert!(json.contains("\"favicon_url\":null"));
    assert!(json.contains("\"site_url\":null"));
}

#[test]
fn test_feed_is_starred_serializes_true() {
    let feed = Feed {
        id: "feed-3".to_string(),
        title: "Starred Feed".to_string(),
        url: "https://example.com/starred".to_string(),
        description: None,
        favicon_url: None,
        site_url: None,
        article_count: 1,
        unread_count: 0,
        is_starred: true,
        created_at: "2024-01-01T00:00:00Z".to_string(),
        updated_at: "2024-01-01T00:00:00Z".to_string(),
    };

    let json = serde_json::to_string(&feed).unwrap();
    assert!(json.contains("\"is_starred\":true"));
}

#[test]
fn test_feed_is_starred_round_trips() {
    let json = r#"{"id":"f1","title":"T","url":"https://x.com/f","description":null,"favicon_url":null,"site_url":null,"article_count":0,"unread_count":0,"is_starred":true,"created_at":"2024-01-01T00:00:00Z","updated_at":"2024-01-01T00:00:00Z"}"#;
    let feed: Feed = serde_json::from_str(json).unwrap();
    assert!(feed.is_starred);
    let round_tripped = serde_json::to_string(&feed).unwrap();
    assert!(round_tripped.contains("\"is_starred\":true"));
}

#[test]
fn test_article_serializes_to_json() {
    let article = Article {
        id: "article-1".to_string(),
        feed_id: "feed-1".to_string(),
        title: "Test Article".to_string(),
        url: "https://example.com/article-1".to_string(),
        content: "<p>Content</p>".to_string(),
        summary: Some("Short summary".to_string()),
        author: Some("Alice".to_string()),
        published_at: "2024-01-01T00:00:00Z".to_string(),
        is_read: false,
        created_at: "2024-01-01T00:00:00Z".to_string(),
        updated_at: "2024-01-01T00:00:00Z".to_string(),
    };

    let json = serde_json::to_string(&article).unwrap();
    assert!(json.contains("\"id\":\"article-1\""));
    assert!(json.contains("\"is_read\":false"));
    assert!(json.contains("\"author\":\"Alice\""));
}

#[test]
fn test_article_deserializes_from_json() {
    let json = r#"{
        "id": "a1",
        "feed_id": "f1",
        "title": "Hello",
        "url": "https://example.com/a1",
        "content": "",
        "summary": null,
        "author": null,
        "published_at": "2024-01-01T00:00:00Z",
        "is_read": true,
        "created_at": "2024-01-01T00:00:00Z",
        "updated_at": "2024-01-01T00:00:00Z"
    }"#;

    let article: Article = serde_json::from_str(json).unwrap();
    assert_eq!(article.id, "a1");
    assert!(article.is_read);
    assert!(article.author.is_none());
}

#[test]
fn test_add_feed_request_deserializes() {
    let json = r#"{"url": "https://example.com/feed.xml"}"#;
    let req: AddFeedRequest = serde_json::from_str(json).unwrap();
    assert_eq!(req.url, "https://example.com/feed.xml");
}

#[test]
fn test_feed_sync_result_serializes() {
    let result = FeedSyncResult {
        feed_id: "f1".to_string(),
        new_articles: 10,
        updated_articles: 3,
    };
    let json = serde_json::to_string(&result).unwrap();
    assert!(json.contains("\"new_articles\":10"));
    assert!(json.contains("\"updated_articles\":3"));
}

#[test]
fn test_opml_import_result_serializes() {
    let result = OpmlImportResult {
        total: 20,
        imported: 15,
        skipped: 3,
        failed: 2,
    };
    let json = serde_json::to_string(&result).unwrap();
    assert!(json.contains("\"total\":20"));
    assert!(json.contains("\"imported\":15"));
    assert!(json.contains("\"skipped\":3"));
    assert!(json.contains("\"failed\":2"));
}
