import { feedService, articleService } from "./services";
import type { Feed, Article } from "./types";
import { Readability } from "@mozilla/readability";

// UI Elements
const feedsList = document.getElementById("feedsList") as HTMLElement;
const articlesList = document.getElementById("articlesList") as HTMLElement;
const readerContent = document.getElementById("readerContent") as HTMLElement;
const readerTitle = document.getElementById("readerTitle") as HTMLElement;
const readerAuthor = document.getElementById("readerAuthor") as HTMLElement;
const readerDate = document.getElementById("readerDate") as HTMLElement;
const panelTitle = document.getElementById("panelTitle") as HTMLElement;

const btnAddFeed = document.getElementById("btnAddFeed") as HTMLButtonElement;
const btnCloseReader = document.getElementById("btnCloseReader") as HTMLButtonElement;
const btnRefresh = document.getElementById("btnRefresh") as HTMLButtonElement;
const searchInput = document.getElementById("searchInput") as HTMLInputElement;

const addFeedModal = document.getElementById("addFeedModal") as HTMLElement;
const modalOverlay = document.getElementById("modalOverlay") as HTMLElement;
const feedUrlInput = document.getElementById("feedUrlInput") as HTMLInputElement;
const opmlFileInput = document.getElementById("opmlFileInput") as HTMLInputElement;
const btnImportOpml = document.getElementById("btnImportOpml") as HTMLButtonElement;
const btnConfirmAdd = document.getElementById("btnConfirmAdd") as HTMLButtonElement;
const btnCancelAdd = document.getElementById("btnCancelAdd") as HTMLButtonElement;
const btnCloseModal = document.getElementById("btnCloseModal") as HTMLButtonElement;
const modalMessage = document.getElementById("modalMessage") as HTMLElement;

// State
let currentFeed: Feed | null = null;
let currentArticle: Article | null = null;
let feeds: Feed[] = [];
let articles: Article[] = [];
let currentQuery = "";
let articleOffset = 0;
let hasMoreArticles = true;
let isLoadingMoreArticles = false;
let articleLoadToken = 0;
const ARTICLE_PAGE_SIZE = 50;

// Initialize
async function init() {
  await loadFeeds({ reloadArticles: true });
  setupEventListeners();
}

// Load feeds from backend
async function loadFeeds(options?: { reloadArticles?: boolean }) {
  try {
    feeds = await feedService.getFeeds();
    renderFeedsList();

    if (options?.reloadArticles) {
      await loadArticles(getCurrentSearchQuery());
    }
  } catch (error) {
    console.error("Failed to load feeds:", error);
  }
}

// Render feeds list
function renderFeedsList() {
  feedsList.innerHTML = "";
  
  // Add "All" option
  const allItem = document.createElement("div");
  allItem.className = `feed-item ${!currentFeed ? "active" : ""}`;
  allItem.innerHTML = `
    <span class="feed-icon">📰</span>
    <span class="feed-title">All Articles</span>
  `;
  allItem.addEventListener("click", () => {
    currentFeed = null;
    void loadArticles(getCurrentSearchQuery());
    updateFeedSelection();
  });
  feedsList.appendChild(allItem);

  // Add feed items
  feeds.forEach((feed) => {
    const item = document.createElement("div");
    item.className = `feed-item ${currentFeed?.id === feed.id ? "active" : ""}`;
    
    const unreadText = feed.unread_count > 0 ? `${feed.unread_count}` : "";
    
    item.innerHTML = `
      <span class="feed-icon" style="background-color: ${generateColorFromUrl(feed.url)}; color: white;">
        ${feed.title.charAt(0).toUpperCase()}
      </span>
      <span class="feed-title">${feed.title}</span>
      ${unreadText ? `<span class="feed-count">${unreadText}</span>` : ""}
      <button class="feed-delete" title="Delete feed">&times;</button>
    `;

    item.querySelector(".feed-delete")!.addEventListener("click", (e) => {
      e.stopPropagation();
      void deleteFeed(feed);
    });

    item.addEventListener("click", () => {
      currentFeed = feed;
      void loadArticles(getCurrentSearchQuery());
      updateFeedSelection();
    });
    
    feedsList.appendChild(item);
  });
}

function updateFeedSelection() {
  const items = feedsList.querySelectorAll(".feed-item");
  items.forEach((item) => {
    item.classList.remove("active");
  });
  
  if (!currentFeed) {
    items[0]?.classList.add("active");
    panelTitle.textContent = "All Articles";
  } else {
    items.forEach((item) => {
      if ((item.textContent ?? "").includes(currentFeed!.title)) {
        item.classList.add("active");
      }
    });
    panelTitle.textContent = currentFeed.title;
  }
}

async function deleteFeed(feed: Feed) {
  try {
    await feedService.deleteFeed(feed.id);
    if (currentFeed?.id === feed.id) {
      currentFeed = null;
    }
    await loadFeeds({ reloadArticles: true });
  } catch (error) {
    console.error("Failed to delete feed:", error);
  }
}

function getCurrentSearchQuery(): string | undefined {
  const query = searchInput.value.trim();
  return query.length >= 2 ? query : undefined;
}

// Load articles
async function loadArticles(query?: string) {
  articleLoadToken += 1;
  const token = articleLoadToken;
  currentQuery = query?.trim() || "";
  articleOffset = 0;
  hasMoreArticles = true;
  articles = [];
  articlesList.innerHTML = '<div class="reader-empty">Loading\u2026</div>';

  await loadMoreArticles(token);
}

async function loadMoreArticles(token = articleLoadToken) {
  if (!hasMoreArticles || isLoadingMoreArticles) {
    return;
  }

  isLoadingMoreArticles = true;

  try {
    const nextPage = currentQuery
      ? await articleService.searchArticles(
          currentQuery,
          currentFeed?.id,
          ARTICLE_PAGE_SIZE,
          articleOffset
        )
      : await articleService.getArticles(
          currentFeed?.id,
          ARTICLE_PAGE_SIZE,
          articleOffset
        );

    if (token !== articleLoadToken) {
      return;
    }

    articles = [...articles, ...nextPage];
    articleOffset += nextPage.length;
    hasMoreArticles = nextPage.length === ARTICLE_PAGE_SIZE;
    renderArticlesList();
  } catch (error: any) {
    if (token !== articleLoadToken) {
      return;
    }
    console.error("Failed to load articles:", error);
    const msg = typeof error === "string" ? error : error?.message ?? String(error);
    articlesList.innerHTML = `<div class="reader-empty" style="padding:16px;color:#dc2626">Error: ${msg}</div>`;
  } finally {
    isLoadingMoreArticles = false;
  }
}

// Render articles list
function renderArticlesList() {
  articlesList.innerHTML = "";

  if (articles.length === 0) {
    articlesList.innerHTML =
      '<div class="reader-empty">No articles found</div>';
    return;
  }

  articles.forEach((article) => {
    const item = document.createElement("div");
    item.className = `article-item ${!article.is_read ? "unread" : ""} ${
      currentArticle?.id === article.id ? "active" : ""
    }`;

    const pubDate = new Date(article.published_at);
    const dateStr = Number.isNaN(pubDate.getTime())
      ? "-"
      : pubDate.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        });

    item.innerHTML = `
      <div class="article-item-title">${article.title}</div>
      <div class="article-item-meta">
        <span>${article.author || "Unknown"}</span>
        <span>${dateStr}</span>
      </div>
    `;

    item.addEventListener("click", () => {
      currentArticle = article;
      loadArticleContent();
      updateArticleSelection();
    });

    articlesList.appendChild(item);
  });

  if (isLoadingMoreArticles) {
    const loading = document.createElement("div");
    loading.className = "reader-empty";
    loading.textContent = "Loading more…";
    articlesList.appendChild(loading);
  } else if (!hasMoreArticles && articles.length > 0) {
    const end = document.createElement("div");
    end.className = "reader-empty";
    end.textContent = "No more articles";
    articlesList.appendChild(end);
  }
}

function updateArticleSelection() {
  const items = articlesList.querySelectorAll(".article-item");
  items.forEach((item) => {
    item.classList.remove("active");
  });

  const activeItem = Array.from(items).find((item) =>
    (item.textContent ?? "").includes(currentArticle?.title || "")
  );
  activeItem?.classList.add("active");
}

function isBotChallengeContent(html: string): boolean {
  const lower = (html || "").toLowerCase();
  return (
    lower.includes("please enable js and disable any ad blocker") ||
    lower.includes("enable javascript") ||
    lower.includes("checking if the site connection is secure") ||
    lower.includes("cloudflare") ||
    lower.includes("cf-chl")
  );
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// Load and display article content
async function loadArticleContent() {
  if (!currentArticle) return;

  const selectedArticleId = currentArticle.id;
  readerContent.innerHTML = '<div class="reader-empty">Loading…</div>';

  try {
    const article = await articleService.getArticle(selectedArticleId);
    if (!currentArticle || currentArticle.id !== selectedArticleId) {
      return;
    }
    currentArticle = article;

    // Update reader header
    readerTitle.textContent = article.title;
    readerAuthor.textContent = article.author || "Unknown author";

    const pubDate = new Date(article.published_at);
    readerDate.textContent = Number.isNaN(pubDate.getTime())
      ? "Unknown date"
      : pubDate.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    // Use existing feed content if substantial; otherwise fetch the full page
    let html = article.content || "";
    // Fetch full page when content is absent or contains no HTML markup (stored as plain text)
    const looksLikeHtml = html.includes("<");
    const isChallenge = looksLikeHtml && isBotChallengeContent(html);
    if (!looksLikeHtml || isChallenge) {
      // Don't keep challenge-page HTML as reader content.
      if (isChallenge) {
        html = "";
      }
      try {
        html = await articleService.fetchArticleContent(article.id);
      } catch (fetchErr) {
        console.warn("Full-page fetch failed, falling back to feed content:", fetchErr);
      }
    }

    if (!html.trim() || isBotChallengeContent(html)) {
      if (article.summary?.trim()) {
        html = `<p>${escapeHtml(article.summary)}</p>`;
      } else {
        html = '<p class="reader-empty">This site blocks in-app fetching. Use "Open original article" below.</p>';
      }
    }

    const rendered = parseWithReadability(html, article.url);
    const sourceLink = `<p style="margin-top:24px;font-size:13px;color:var(--text-secondary)">
      <a href="${article.url}" target="_blank" rel="noopener noreferrer">Open original article \u2197</a>
    </p>`;
    if (!currentArticle || currentArticle.id !== selectedArticleId) {
      return;
    }
    readerContent.innerHTML = rendered + sourceLink;

    // Open external links in the system browser
    readerContent.querySelectorAll("a[href]").forEach((a) => {
      (a as HTMLAnchorElement).setAttribute("target", "_blank");
      (a as HTMLAnchorElement).setAttribute("rel", "noopener noreferrer");
    });

    // Mark as read as a best-effort side effect. Keep article visible even if this fails.
    if (!article.is_read) {
      void (async () => {
        try {
          await articleService.markRead(article.id, true);
          await loadFeeds();
          renderArticlesList();
        } catch (markErr) {
          console.warn("Failed to mark article as read:", markErr);
        }
      })();
    }
  } catch (error) {
    console.error("Failed to load article:", error);
    const msg = typeof error === "string" ? error : (error as any)?.message ?? String(error);
    readerContent.innerHTML =
      `<div class="reader-empty" style="padding:16px;color:#dc2626">Failed to load article: ${msg}</div>`;
  }
}

function parseWithReadability(html: string, articleUrl: string): string {
  if (!html || !html.trim()) {
    return '<p class="reader-empty">No content available.</p>';
  }

  try {
    const doc = new DOMParser().parseFromString(html, "text/html");

    // Set the base URL so relative image/link URLs resolve correctly
    const base = doc.createElement("base");
    base.href = articleUrl;
    doc.head.insertBefore(base, doc.head.firstChild);

    const reader = new Readability(doc);
    const parsed = reader.parse();
    if (parsed?.content) {
      return parsed.content;
    }
  } catch (e) {
    console.warn("Readability parsing failed, rendering raw HTML:", e);
  }

  // Fallback: render the raw HTML directly
  return html;
}

// Setup event listeners
function setupEventListeners() {
  // Add feed button
  btnAddFeed.addEventListener("click", openAddFeedModal);

  // Add feed modal
  btnConfirmAdd.addEventListener("click", handleAddFeed);
  btnImportOpml.addEventListener("click", () => opmlFileInput.click());
  opmlFileInput.addEventListener("change", handleImportOpml);
  btnCancelAdd.addEventListener("click", closeAddFeedModal);
  btnCloseModal.addEventListener("click", closeAddFeedModal);
  modalOverlay.addEventListener("click", closeAddFeedModal);

  // Reader close button
  btnCloseReader.addEventListener("click", () => {
    currentArticle = null;
    renderArticlesList();
  });

  // Refresh button
  btnRefresh.addEventListener("click", async () => {
    if (currentFeed) {
      btnRefresh.disabled = true;
      try {
        await feedService.syncFeed(currentFeed.id);
        await loadFeeds();
        await loadArticles(getCurrentSearchQuery());
      } catch (error) {
        console.error("Failed to sync feed:", error);
      } finally {
        btnRefresh.disabled = false;
      }
    }
  });

  // Infinite scroll in article list
  articlesList.addEventListener("scroll", () => {
    const threshold = 120;
    const nearBottom =
      articlesList.scrollTop + articlesList.clientHeight >=
      articlesList.scrollHeight - threshold;
    if (nearBottom) {
      void loadMoreArticles();
    }
  });

  // Search input
  let searchTimeout: ReturnType<typeof setTimeout>;
  searchInput.addEventListener("input", (e) => {
    clearTimeout(searchTimeout);
    const query = (e.target as HTMLInputElement).value.trim();

    if (query.length === 0) {
      void loadArticles();
    } else if (query.length >= 2) {
      searchTimeout = setTimeout(() => {
        void loadArticles(query);
      }, 300);
    }
  });
}

// Modal functions
function openAddFeedModal() {
  addFeedModal.classList.add("active");
  modalOverlay.classList.add("active");
  feedUrlInput.focus();
  modalMessage.textContent = "";
}

function closeAddFeedModal() {
  addFeedModal.classList.remove("active");
  modalOverlay.classList.remove("active");
  feedUrlInput.value = "";
  opmlFileInput.value = "";
  modalMessage.textContent = "";
}

async function handleAddFeed() {
  const url = feedUrlInput.value.trim();

  if (!url) {
    showModalMessage("Please enter a feed URL", "error");
    return;
  }

  if (!isValidUrl(url)) {
    showModalMessage("Please enter a valid URL", "error");
    return;
  }

  btnConfirmAdd.disabled = true;
  showModalMessage("Adding feed...", "loading");

  try {
    const feed = await feedService.addFeed(url);
    showModalMessage(`Feed "${feed.title}" added successfully!`, "success");

    setTimeout(() => {
      closeAddFeedModal();
      void loadFeeds({ reloadArticles: true });
    }, 1000);
  } catch (error: any) {
    const errorMsg = error.message || "Failed to add feed";
    showModalMessage(errorMsg, "error");
  } finally {
    btnConfirmAdd.disabled = false;
  }
}

async function handleImportOpml() {
  const file = opmlFileInput.files?.[0];
  if (!file) return;

  btnImportOpml.disabled = true;
  btnConfirmAdd.disabled = true;
  showModalMessage("Importing OPML...", "loading");

  try {
    const content = await file.text();
    const result = await feedService.importOpml(content);

    showModalMessage(
      `Imported ${result.imported}/${result.total} feeds (${result.skipped} skipped, ${result.failed} failed).`,
      result.failed > 0 ? "error" : "success"
    );

    await loadFeeds({ reloadArticles: true });
    opmlFileInput.value = "";
  } catch (error: any) {
    const errorMsg =
      (typeof error === "string" && error) ||
      error?.message ||
      error?.toString?.() ||
      "Failed to import OPML";
    showModalMessage(errorMsg, "error");
  } finally {
    btnImportOpml.disabled = false;
    btnConfirmAdd.disabled = false;
  }
}

function showModalMessage(
  message: string,
  type: "error" | "success" | "loading"
) {
  modalMessage.textContent = message;
  modalMessage.className = `modal-message ${type}`;
}

function isValidUrl(string: string): boolean {
  try {
    new URL(string);
    return true;
  } catch (_) {
    return false;
  }
}

function generateColorFromUrl(url: string): string {
  let hash = 0;
  for (let i = 0; i < url.length; i++) {
    const char = url.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }

  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 70%, 60%)`;
}

// Start the app
init();

