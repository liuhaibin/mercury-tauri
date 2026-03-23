use super::*;

#[test]
fn test_favicon_extraction() {
    let url = Some("https://example.com/page".to_string());
    let favicon = extract_favicon_url(&url);
    assert_eq!(favicon, Some("https://example.com/favicon.ico".to_string()));
}

#[test]
fn test_favicon_extraction_none_input() {
    let favicon = extract_favicon_url(&None);
    assert_eq!(favicon, None);
}

#[test]
fn test_favicon_extraction_root_url() {
    let url = Some("https://blog.example.org/".to_string());
    let favicon = extract_favicon_url(&url);
    assert_eq!(favicon, Some("https://blog.example.org/favicon.ico".to_string()));
}

#[test]
fn test_favicon_extraction_http_scheme() {
    let url = Some("http://example.com".to_string());
    let favicon = extract_favicon_url(&url);
    assert_eq!(favicon, Some("http://example.com/favicon.ico".to_string()));
}

#[test]
fn test_favicon_extraction_with_port() {
    // url::Url::host_str() returns only the hostname (no port),
    // so the favicon URL uses only the scheme + host, without the port.
    let url = Some("https://example.com:8080/some/path".to_string());
    let favicon = extract_favicon_url(&url);
    assert_eq!(favicon, Some("https://example.com/favicon.ico".to_string()));
}

#[test]
fn test_favicon_extraction_invalid_url() {
    let url = Some("not-a-valid-url".to_string());
    let favicon = extract_favicon_url(&url);
    assert_eq!(favicon, None);
}

#[tokio::test]
async fn test_parse_feed_rss_content() {
    let rss = r#"<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Test RSS Feed</title>
    <link>https://example.com</link>
    <description>A test feed</description>
    <item>
      <title>Article One</title>
      <link>https://example.com/article-1</link>
      <description>Summary of article one</description>
      <author>Alice</author>
      <pubDate>Mon, 01 Jan 2024 00:00:00 +0000</pubDate>
    </item>
    <item>
      <title>Article Two</title>
      <link>https://example.com/article-2</link>
      <description>Summary of article two</description>
    </item>
  </channel>
</rss>"#;

    let result = parse_feed(rss.as_bytes(), "https://example.com/feed.xml").await;
    assert!(result.is_ok(), "parse_feed failed: {:?}", result.err());

    let (feed, articles) = result.unwrap();
    assert_eq!(feed.title, "Test RSS Feed");
    assert_eq!(feed.url, "https://example.com/feed.xml");
    assert_eq!(articles.len(), 2);
    assert_eq!(articles[0].title, "Article One");
    assert_eq!(articles[0].url, "https://example.com/article-1");
    assert!(!articles[0].is_read);
    assert_eq!(articles[1].title, "Article Two");
}

#[tokio::test]
async fn test_parse_feed_atom_content() {
    let atom = r#"<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Test Atom Feed</title>
  <link href="https://atom-example.com"/>
  <id>urn:uuid:test-atom-feed</id>
  <updated>2024-01-01T00:00:00Z</updated>
  <entry>
    <title>Atom Entry</title>
    <link href="https://atom-example.com/entry-1"/>
    <id>urn:uuid:entry-1</id>
    <updated>2024-01-01T00:00:00Z</updated>
    <summary>Atom entry summary</summary>
    <author><name>Bob</name></author>
  </entry>
</feed>"#;

    let result = parse_feed(atom.as_bytes(), "https://atom-example.com/feed").await;
    assert!(result.is_ok(), "parse_feed failed: {:?}", result.err());

    let (feed, articles) = result.unwrap();
    assert_eq!(feed.title, "Test Atom Feed");
    assert_eq!(articles.len(), 1);
    assert_eq!(articles[0].title, "Atom Entry");
    assert_eq!(articles[0].author, Some("Bob".to_string()));
}

#[tokio::test]
async fn test_parse_feed_uses_summary_as_content_fallback() {
    let rss = r#"<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Feed</title>
    <link>https://example.com</link>
    <item>
      <title>No Content Item</title>
      <link>https://example.com/no-content</link>
      <description>Just a summary here</description>
    </item>
  </channel>
</rss>"#;

    let (_, articles) = parse_feed(rss.as_bytes(), "https://example.com/feed")
        .await
        .unwrap();
    assert!(!articles[0].content.is_empty());
}

#[tokio::test]
async fn test_parse_feed_invalid_content_returns_error() {
    let bad_content = b"this is not xml or rss content";
    let result = parse_feed(bad_content, "https://example.com/feed").await;
    assert!(result.is_err());
}

#[tokio::test]
async fn test_parse_feed_article_count_matches() {
    let rss = r#"<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Count Feed</title>
    <link>https://example.com</link>
    <item><title>A</title><link>https://example.com/a</link></item>
    <item><title>B</title><link>https://example.com/b</link></item>
    <item><title>C</title><link>https://example.com/c</link></item>
  </channel>
</rss>"#;

    let (feed, articles) = parse_feed(rss.as_bytes(), "https://example.com/feed")
        .await
        .unwrap();
    assert_eq!(feed.article_count, 3);
    assert_eq!(feed.unread_count, 3);
    assert_eq!(articles.len(), 3);
}
