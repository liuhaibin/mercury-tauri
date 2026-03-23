import { invoke } from "@tauri-apps/api/core";
import type {
  Feed,
  Article,
  FeedSyncResult,
  AddFeedRequest,
  OpmlImportResult,
} from "./types";

export const feedService = {
  async getFeeds(): Promise<Feed[]> {
    return invoke("get_feeds");
  },

  async addFeed(url: string): Promise<Feed> {
    const req: AddFeedRequest = { url };
    return invoke("add_feed", { req });
  },

  async deleteFeed(feedId: string): Promise<void> {
    return invoke("delete_feed", { feedId });
  },

  async syncFeed(feedId: string): Promise<FeedSyncResult> {
    return invoke("sync_feed", { feedId });
  },

  async importOpml(opmlContent: string): Promise<OpmlImportResult> {
    return invoke("import_opml", {
      req: { opml_content: opmlContent },
    });
  },
};

export const articleService = {
  async getArticles(feedId?: string, limit = 50, offset = 0): Promise<Article[]> {
    return invoke("get_articles", { feedId: feedId ?? null, limit, offset });
  },

  async getArticle(articleId: string): Promise<Article> {
    return invoke("get_article", { articleId });
  },

  async fetchArticleContent(articleId: string): Promise<string> {
    return invoke("fetch_article_content", { articleId });
  },

  async markRead(articleId: string, isRead: boolean): Promise<void> {
    return invoke("mark_read", { articleId, isRead });
  },

  async searchArticles(
    query: string,
    feedId?: string,
    limit = 50,
    offset = 0
  ): Promise<Article[]> {
    return invoke("search_articles", {
      query,
      feedId: feedId ?? null,
      limit,
      offset,
    });
  },
};
