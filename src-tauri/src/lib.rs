// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
mod models;
mod db;
mod feed_parser;
mod commands;

use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_sql::Builder::new().build())
        .setup(|app| {
            let handle = app.handle();
            tauri::async_runtime::block_on(async {
                match db::init_db(&handle).await {
                    Ok(db_state) => {
                        app.manage(db_state);
                    }
                    Err(e) => eprintln!("Failed to initialize database: {}", e),
                }
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::feed::get_feeds,
            commands::feed::add_feed,
            commands::feed::delete_feed,
            commands::feed::sync_feed,
            commands::feed::sync_all_feeds,
            commands::feed::import_opml,
            commands::feed::star_feed,
            commands::article::get_articles,
            commands::article::get_article,
            commands::article::mark_read,
            commands::article::search_articles,
            commands::article::fetch_article_content,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}


