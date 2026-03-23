use super::*;

#[test]
fn test_normal_html_is_not_bot_challenge() {
    let html = "<html><body><h1>Welcome</h1><p>Regular article content.</p></body></html>";
    assert!(!is_bot_challenge_page(html));
}

#[test]
fn test_cloudflare_connection_check_detected() {
    let html = "<html><body><p>Checking if the site connection is secure</p></body></html>";
    assert!(is_bot_challenge_page(html));
}

#[test]
fn test_enable_javascript_detected() {
    let html = "<html><body><h1>Enable JavaScript and cookies to continue</h1></body></html>";
    assert!(is_bot_challenge_page(html));
}

#[test]
fn test_ad_blocker_message_detected() {
    let html = "<html><body>Please enable JS and disable any ad blocker</body></html>";
    assert!(is_bot_challenge_page(html));
}

#[test]
fn test_cf_chl_attribute_detected() {
    let html = r#"<html><body><div id="cf-chl-widget-xyz">challenge</div></body></html>"#;
    assert!(is_bot_challenge_page(html));
}

#[test]
fn test_cloudflare_brand_name_detected() {
    let html = "<html><body><p>Protected by Cloudflare</p></body></html>";
    assert!(is_bot_challenge_page(html));
}

#[test]
fn test_detection_is_case_insensitive() {
    let html = "<html><body><p>ENABLE JAVASCRIPT</p></body></html>";
    assert!(is_bot_challenge_page(html));
}

#[test]
fn test_empty_html_is_not_bot_challenge() {
    assert!(!is_bot_challenge_page(""));
}

#[test]
fn test_unrelated_cf_prefix_not_matched() {
    let html = "<html><body><div id='cf-banner'>Info</div></body></html>";
    assert!(!is_bot_challenge_page(html));
}
