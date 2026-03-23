export interface Feed {
  id: string;
  title: string;
  url: string;
  description?: string;
  favicon_url?: string;
  site_url?: string;
  article_count: number;
  unread_count: number;
  is_starred: boolean;
  created_at: string;
  updated_at: string;
}

export interface Article {
  id: string;
  feed_id: string;
  title: string;
  url: string;
  content: string;
  summary?: string;
  author?: string;
  published_at: string;
  is_read: boolean;
  created_at: string;
  updated_at: string;
}

export interface FeedSyncResult {
  feed_id: string;
  new_articles: number;
  updated_articles: number;
}

export interface OpmlImportResult {
  total: number;
  imported: number;
  skipped: number;
  failed: number;
}

export interface AddFeedRequest {
  url: string;
}
