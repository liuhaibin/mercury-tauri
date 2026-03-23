import { describe, it, expect, vi, beforeEach } from "vitest";

// vi.mock is hoisted to the top of the file; use vi.hoisted so mockInvoke
// is available inside the factory before module-level code runs.
const { mockInvoke } = vi.hoisted(() => ({
  mockInvoke: vi.fn(),
}));

vi.mock("@tauri-apps/api/core", () => ({
  invoke: mockInvoke,
}));

import { feedService, articleService } from "../services";
import type { Feed, Article, FeedSyncResult, OpmlImportResult } from "../types";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const makeFeed = (overrides: Partial<Feed> = {}): Feed => ({
  id: "feed-1",
  title: "Test Feed",
  url: "https://example.com/feed",
  article_count: 10,
  unread_count: 3,
  is_starred: false,
  created_at: "2024-01-01T00:00:00Z",
  updated_at: "2024-01-01T00:00:00Z",
  ...overrides,
});

const makeArticle = (overrides: Partial<Article> = {}): Article => ({
  id: "article-1",
  feed_id: "feed-1",
  title: "Test Article",
  url: "https://example.com/article-1",
  content: "<p>Body</p>",
  published_at: "2024-01-01T00:00:00Z",
  is_read: false,
  created_at: "2024-01-01T00:00:00Z",
  updated_at: "2024-01-01T00:00:00Z",
  ...overrides,
});

// ---------------------------------------------------------------------------
// feedService
// ---------------------------------------------------------------------------

describe("feedService", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe("getFeeds", () => {
    it("invokes get_feeds with no arguments", async () => {
      const feeds = [makeFeed()];
      mockInvoke.mockResolvedValueOnce(feeds);

      const result = await feedService.getFeeds();

      expect(mockInvoke).toHaveBeenCalledWith("get_feeds");
      expect(result).toEqual(feeds);
    });

    it("returns an empty array when there are no feeds", async () => {
      mockInvoke.mockResolvedValueOnce([]);
      const result = await feedService.getFeeds();
      expect(result).toEqual([]);
    });
  });

  describe("addFeed", () => {
    it("invokes add_feed with url wrapped in req object", async () => {
      const feed = makeFeed({ url: "https://new.com/feed" });
      mockInvoke.mockResolvedValueOnce(feed);

      const result = await feedService.addFeed("https://new.com/feed");

      expect(mockInvoke).toHaveBeenCalledWith("add_feed", {
        req: { url: "https://new.com/feed" },
      });
      expect(result).toEqual(feed);
    });

    it("propagates errors from the backend", async () => {
      mockInvoke.mockRejectedValueOnce(new Error("Feed already exists"));
      await expect(feedService.addFeed("https://dupe.com/feed")).rejects.toThrow(
        "Feed already exists"
      );
    });
  });

  describe("deleteFeed", () => {
    it("invokes delete_feed with feedId", async () => {
      mockInvoke.mockResolvedValueOnce(undefined);

      await feedService.deleteFeed("feed-1");

      expect(mockInvoke).toHaveBeenCalledWith("delete_feed", { feedId: "feed-1" });
    });
  });

  describe("syncFeed", () => {
    it("invokes sync_feed with feedId and returns FeedSyncResult", async () => {
      const syncResult: FeedSyncResult = {
        feed_id: "feed-1",
        new_articles: 5,
        updated_articles: 2,
      };
      mockInvoke.mockResolvedValueOnce(syncResult);

      const result = await feedService.syncFeed("feed-1");

      expect(mockInvoke).toHaveBeenCalledWith("sync_feed", { feedId: "feed-1" });
      expect(result).toEqual(syncResult);
    });
  });

  describe("syncAllFeeds", () => {
    it("invokes sync_all_feeds and returns [synced, failed] tuple", async () => {
      mockInvoke.mockResolvedValueOnce([10, 2]);

      const result = await feedService.syncAllFeeds();

      expect(mockInvoke).toHaveBeenCalledWith("sync_all_feeds");
      expect(result).toEqual([10, 2]);
    });
  });

  describe("importOpml", () => {
    it("invokes import_opml with opml_content in req", async () => {
      const importResult: OpmlImportResult = {
        total: 5,
        imported: 4,
        skipped: 1,
        failed: 0,
      };
      const opmlContent = "<opml><body></body></opml>";
      mockInvoke.mockResolvedValueOnce(importResult);

      const result = await feedService.importOpml(opmlContent);

      expect(mockInvoke).toHaveBeenCalledWith("import_opml", {
        req: { opml_content: opmlContent },
      });
      expect(result).toEqual(importResult);
    });
  });

  describe("starFeed", () => {
    it("invokes star_feed with feedId and starred=true", async () => {
      mockInvoke.mockResolvedValueOnce(undefined);

      await feedService.starFeed("feed-1", true);

      expect(mockInvoke).toHaveBeenCalledWith("star_feed", {
        feedId: "feed-1",
        starred: true,
      });
    });

    it("invokes star_feed with feedId and starred=false to unstar", async () => {
      mockInvoke.mockResolvedValueOnce(undefined);

      await feedService.starFeed("feed-1", false);

      expect(mockInvoke).toHaveBeenCalledWith("star_feed", {
        feedId: "feed-1",
        starred: false,
      });
    });

    it("propagates errors from the backend", async () => {
      mockInvoke.mockRejectedValueOnce(new Error("Feed not found"));

      await expect(feedService.starFeed("bad-id", true)).rejects.toThrow(
        "Feed not found"
      );
    });
  });
});

// ---------------------------------------------------------------------------
// articleService
// ---------------------------------------------------------------------------

describe("articleService", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe("getArticles", () => {
    it("invokes get_articles with default limit/offset when no args given", async () => {
      mockInvoke.mockResolvedValueOnce([]);

      await articleService.getArticles();

      expect(mockInvoke).toHaveBeenCalledWith("get_articles", {
        feedId: null,
        limit: 50,
        offset: 0,
      });
    });

    it("passes feedId when provided", async () => {
      mockInvoke.mockResolvedValueOnce([]);

      await articleService.getArticles("feed-1");

      expect(mockInvoke).toHaveBeenCalledWith("get_articles", {
        feedId: "feed-1",
        limit: 50,
        offset: 0,
      });
    });

    it("passes null for feedId when undefined", async () => {
      mockInvoke.mockResolvedValueOnce([]);

      await articleService.getArticles(undefined, 25, 50);

      expect(mockInvoke).toHaveBeenCalledWith("get_articles", {
        feedId: null,
        limit: 25,
        offset: 50,
      });
    });

    it("returns the list of articles", async () => {
      const articles = [makeArticle(), makeArticle({ id: "article-2" })];
      mockInvoke.mockResolvedValueOnce(articles);

      const result = await articleService.getArticles();
      expect(result).toHaveLength(2);
    });
  });

  describe("getArticle", () => {
    it("invokes get_article with articleId", async () => {
      const article = makeArticle();
      mockInvoke.mockResolvedValueOnce(article);

      const result = await articleService.getArticle("article-1");

      expect(mockInvoke).toHaveBeenCalledWith("get_article", { articleId: "article-1" });
      expect(result).toEqual(article);
    });

    it("propagates not-found error", async () => {
      mockInvoke.mockRejectedValueOnce(new Error("Article not found"));
      await expect(articleService.getArticle("nonexistent")).rejects.toThrow(
        "Article not found"
      );
    });
  });

  describe("fetchArticleContent", () => {
    it("invokes fetch_article_content and returns html string", async () => {
      const html = "<html><body><p>Full content</p></body></html>";
      mockInvoke.mockResolvedValueOnce(html);

      const result = await articleService.fetchArticleContent("article-1");

      expect(mockInvoke).toHaveBeenCalledWith("fetch_article_content", {
        articleId: "article-1",
      });
      expect(result).toBe(html);
    });

    it("propagates bot-challenge error from backend", async () => {
      mockInvoke.mockRejectedValueOnce(
        new Error("This site blocks automated fetch (JS challenge/ad-block check).")
      );
      await expect(
        articleService.fetchArticleContent("article-1")
      ).rejects.toThrow("blocks automated fetch");
    });
  });

  describe("markRead", () => {
    it("invokes mark_read with articleId and isRead=true", async () => {
      mockInvoke.mockResolvedValueOnce(undefined);

      await articleService.markRead("article-1", true);

      expect(mockInvoke).toHaveBeenCalledWith("mark_read", {
        articleId: "article-1",
        isRead: true,
      });
    });

    it("invokes mark_read with isRead=false", async () => {
      mockInvoke.mockResolvedValueOnce(undefined);

      await articleService.markRead("article-1", false);

      expect(mockInvoke).toHaveBeenCalledWith("mark_read", {
        articleId: "article-1",
        isRead: false,
      });
    });
  });

  describe("searchArticles", () => {
    it("invokes search_articles with query, null feedId, default pagination", async () => {
      mockInvoke.mockResolvedValueOnce([]);

      await articleService.searchArticles("rust");

      expect(mockInvoke).toHaveBeenCalledWith("search_articles", {
        query: "rust",
        feedId: null,
        limit: 50,
        offset: 0,
      });
    });

    it("passes feedId when provided", async () => {
      mockInvoke.mockResolvedValueOnce([]);

      await articleService.searchArticles("rust", "feed-1", 10, 20);

      expect(mockInvoke).toHaveBeenCalledWith("search_articles", {
        query: "rust",
        feedId: "feed-1",
        limit: 10,
        offset: 20,
      });
    });

    it("returns matched articles", async () => {
      const articles = [makeArticle({ title: "Rust programming" })];
      mockInvoke.mockResolvedValueOnce(articles);

      const result = await articleService.searchArticles("rust");
      expect(result[0].title).toBe("Rust programming");
    });
  });
});
