use super::*;

fn basic_opml(extra_items: &str) -> String {
    format!(
        r#"<?xml version="1.0" encoding="UTF-8"?>
<opml version="2.0">
  <head><title>Feeds</title></head>
  <body>
    {}
  </body>
</opml>"#,
        extra_items
    )
}

#[test]
fn test_extract_opml_basic() {
    let opml = basic_opml(
        r#"<outline text="Example" title="Example" type="rss"
            xmlUrl="https://example.com/feed.xml"
            htmlUrl="https://example.com"/>"#,
    );
    let entries = extract_opml_feed_entries(&opml).unwrap();
    assert_eq!(entries.len(), 1);
    assert_eq!(entries[0].url, "https://example.com/feed.xml");
    assert_eq!(entries[0].title, Some("Example".to_string()));
    assert_eq!(entries[0].site_url, Some("https://example.com".to_string()));
}

#[test]
fn test_extract_opml_multiple_entries() {
    let opml = basic_opml(
        r#"<outline xmlUrl="https://a.com/feed" title="A"/>
           <outline xmlUrl="https://b.com/feed" title="B"/>
           <outline xmlUrl="https://c.com/feed" title="C"/>"#,
    );
    let entries = extract_opml_feed_entries(&opml).unwrap();
    assert_eq!(entries.len(), 3);
}

#[test]
fn test_extract_opml_nested_categories() {
    let opml = basic_opml(
        r#"<outline text="Tech">
             <outline text="Blog" xmlUrl="https://techblog.com/feed" title="Tech Blog"/>
           </outline>"#,
    );
    let entries = extract_opml_feed_entries(&opml).unwrap();
    assert_eq!(entries.len(), 1);
    assert_eq!(entries[0].url, "https://techblog.com/feed");
}

#[test]
fn test_extract_opml_falls_back_to_url_attribute() {
    let opml = basic_opml(r#"<outline url="https://fallback.com/feed" title="Fallback"/>"#);
    let entries = extract_opml_feed_entries(&opml).unwrap();
    assert_eq!(entries.len(), 1);
    assert_eq!(entries[0].url, "https://fallback.com/feed");
}

#[test]
fn test_extract_opml_case_insensitive_xmlurl() {
    let opml = basic_opml(r#"<outline xmlurl="https://lowercase.com/feed" title="Low"/>"#);
    let entries = extract_opml_feed_entries(&opml).unwrap();
    assert_eq!(entries.len(), 1);
    assert_eq!(entries[0].url, "https://lowercase.com/feed");
}

#[test]
fn test_extract_opml_outlines_without_url_are_skipped() {
    let opml = basic_opml(
        r#"<outline text="Category" title="No URL here"/>
           <outline xmlUrl="https://valid.com/feed" title="Valid"/>"#,
    );
    let entries = extract_opml_feed_entries(&opml).unwrap();
    assert_eq!(entries.len(), 1);
    assert_eq!(entries[0].url, "https://valid.com/feed");
}

#[test]
fn test_extract_opml_no_feeds_returns_error() {
    let opml = basic_opml(r#"<outline text="Category" title="Just a category"/>"#);
    let result = extract_opml_feed_entries(&opml);
    assert!(result.is_err());
    assert!(result.unwrap_err().contains("No feed URLs found"));
}

#[test]
fn test_extract_opml_invalid_xml_returns_error() {
    let result = extract_opml_feed_entries("this is not xml <unclosed");
    assert!(result.is_err());
    assert!(result.unwrap_err().contains("Invalid OPML/XML"));
}

#[test]
fn test_extract_opml_title_falls_back_to_text_attribute() {
    let opml = basic_opml(
        r#"<outline text="Text Attr" xmlUrl="https://example.com/feed"/>"#,
    );
    let entries = extract_opml_feed_entries(&opml).unwrap();
    assert_eq!(entries[0].title, Some("Text Attr".to_string()));
}

#[test]
fn test_extract_opml_site_url_from_htmlurl() {
    let opml = basic_opml(
        r#"<outline xmlUrl="https://example.com/feed" htmlUrl="https://example.com" title="Ex"/>"#,
    );
    let entries = extract_opml_feed_entries(&opml).unwrap();
    assert_eq!(entries[0].site_url, Some("https://example.com".to_string()));
}

#[test]
fn test_extract_opml_trims_whitespace_from_urls() {
    let opml = basic_opml(
        r#"<outline xmlUrl="  https://example.com/feed  " title="Ex"/>"#,
    );
    let entries = extract_opml_feed_entries(&opml).unwrap();
    assert_eq!(entries[0].url, "https://example.com/feed");
}
