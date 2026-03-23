import { feedService, articleService } from "./services";
import type { Feed, Article } from "./types";
import { Readability } from "@mozilla/readability";
import { listen } from "@tauri-apps/api/event";

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
const importToast = document.getElementById("importToast") as HTMLElement;
const importToastTitle = document.getElementById("importToastTitle") as HTMLElement;
const importToastMessage = document.getElementById("importToastMessage") as HTMLElement;
const btnDismissImportToast = document.getElementById("btnDismissImportToast") as HTMLButtonElement;
const btnSelectFeeds = document.getElementById("btnSelectFeeds") as HTMLButtonElement;
const btnDeleteSelected = document.getElementById("btnDeleteSelected") as HTMLButtonElement;
const btnCancelSelect = document.getElementById("btnCancelSelect") as HTMLButtonElement;
const btnSelectAllFeeds = document.getElementById("btnSelectAllFeeds") as HTMLButtonElement;
const btnClearSelection = document.getElementById("btnClearSelection") as HTMLButtonElement;
const multiselectBar = document.getElementById("multiselectBar") as HTMLElement;
const selectedCountEl = document.getElementById("selectedCount") as HTMLElement;
const btnSettings = document.getElementById("btnSettings") as HTMLButtonElement;

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
let isSelectMode = false;
const selectedFeedIds = new Set<string>();

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

  // "All Articles" row — not selectable in select mode
  const allItem = document.createElement("div");
  allItem.className = `feed-item ${isSelectMode ? "select-mode-disabled" : (!currentFeed ? "active" : "")}`;
  allItem.innerHTML = `
    <span class="feed-icon">📰</span>
    <span class="feed-title">All Articles</span>
  `;
  if (!isSelectMode) {
    allItem.addEventListener("click", () => {
      currentFeed = null;
      void loadArticles(getCurrentSearchQuery());
      updateFeedSelection();
    });
  }
  feedsList.appendChild(allItem);

  // Feed items
  if (isSelectMode) {
    feeds.forEach((feed) => {
      const isSelected = selectedFeedIds.has(feed.id);
      const item = document.createElement("div");
      item.className = `feed-item select-mode ${isSelected ? "selected" : ""}`;
      item.innerHTML = `
        <span class="feed-checkbox">${isSelected ? "✓" : ""}</span>
        <span class="feed-icon" style="background-color: ${generateColorFromUrl(feed.url)}; color: white;">
          ${feed.title.charAt(0).toUpperCase()}
        </span>
        <span class="feed-title">${feed.title}</span>
      `;
      item.addEventListener("click", () => toggleFeedSelection(feed.id));
      feedsList.appendChild(item);
    });
  } else {
    const starredFeeds = feeds.filter((f) => f.is_starred);
    const unstarredFeeds = feeds.filter((f) => !f.is_starred);
    const showDivider = starredFeeds.length > 0 && unstarredFeeds.length > 0;

    const appendFeedItem = (feed: Feed) => {
      const item = document.createElement("div");
      item.className = `feed-item ${currentFeed?.id === feed.id ? "active" : ""}`;
      const unreadText = feed.unread_count > 0 ? `${feed.unread_count}` : "";
      item.innerHTML = `
        <span class="feed-icon" style="background-color: ${generateColorFromUrl(feed.url)}; color: white;">
          ${feed.title.charAt(0).toUpperCase()}
        </span>
        <span class="feed-title">${feed.title}</span>
        ${unreadText ? `<span class="feed-count">${unreadText}</span>` : ""}
        <button type="button" class="feed-star${feed.is_starred ? " starred" : ""}" title="${feed.is_starred ? "Unstar" : "Star"}">★</button>
        <button type="button" class="feed-delete" title="Delete feed">&times;</button>
      `;
      item.querySelector(".feed-star")!.addEventListener("click", (e) => {
        e.stopPropagation();
        void toggleStarFeed(feed);
      });
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
    };

    starredFeeds.forEach(appendFeedItem);
    if (showDivider) {
      const divider = document.createElement("div");
      divider.className = "feeds-divider";
      feedsList.appendChild(divider);
    }
    unstarredFeeds.forEach(appendFeedItem);
  }
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

async function toggleStarFeed(feed: Feed) {
  try {
    await feedService.starFeed(feed.id, !feed.is_starred);
    feeds = await feedService.getFeeds();
    renderFeedsList();
  } catch (error) {
    console.error("Failed to star feed:", error);
  }
}

function enterSelectMode() {
  isSelectMode = true;
  selectedFeedIds.clear();
  btnSelectFeeds.classList.add("active");
  btnSettings.style.display = "none";
  multiselectBar.classList.add("active");
  updateSelectedCountLabel();
  renderFeedsList();
}

function exitSelectMode() {
  isSelectMode = false;
  selectedFeedIds.clear();
  btnSelectFeeds.classList.remove("active");
  btnSettings.style.display = "";
  multiselectBar.classList.remove("active");
  renderFeedsList();
}

function toggleFeedSelection(feedId: string) {
  if (selectedFeedIds.has(feedId)) {
    selectedFeedIds.delete(feedId);
  } else {
    selectedFeedIds.add(feedId);
  }
  updateSelectedCountLabel();
  renderFeedsList();
}

function selectAllFeeds() {
  selectedFeedIds.clear();
  feeds.forEach((feed) => {
    selectedFeedIds.add(feed.id);
  });
  updateSelectedCountLabel();
  renderFeedsList();
}

function clearSelection() {
  selectedFeedIds.clear();
  updateSelectedCountLabel();
  renderFeedsList();
}

function updateSelectedCountLabel() {
  const count = selectedFeedIds.size;
  selectedCountEl.textContent = count === 0 ? "0 selected" : `${count} selected`;
  btnDeleteSelected.disabled = count === 0;
}

async function deleteSelectedFeeds() {
  if (selectedFeedIds.size === 0) return;
  const idsToDelete = Array.from(selectedFeedIds);
  try {
    await Promise.all(idsToDelete.map((id) => feedService.deleteFeed(id)));
    if (currentFeed && selectedFeedIds.has(currentFeed.id)) {
      currentFeed = null;
    }
    exitSelectMode();
    await loadFeeds({ reloadArticles: true });
  } catch (error) {
    console.error("Failed to delete selected feeds:", error);
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
  btnDismissImportToast.addEventListener("click", hideImportToast);
  btnSelectFeeds.addEventListener("click", () => {
    if (isSelectMode) exitSelectMode(); else enterSelectMode();
  });
  btnSelectAllFeeds.addEventListener("click", selectAllFeeds);
  btnClearSelection.addEventListener("click", clearSelection);
  btnCancelSelect.addEventListener("click", exitSelectMode);
  btnDeleteSelected.addEventListener("click", () => void deleteSelectedFeeds());

  // Reader close button
  btnCloseReader.addEventListener("click", () => {
    currentArticle = null;
    renderArticlesList();
  });

  // Refresh button
  btnRefresh.addEventListener("click", async () => {
    btnRefresh.disabled = true;
    try {
      if (currentFeed) {
        await feedService.syncFeed(currentFeed.id);
      } else {
        await feedService.syncAllFeeds();
      }
      await loadFeeds();
      await loadArticles(getCurrentSearchQuery());
    } catch (error) {
      console.error("Failed to sync feed(s):", error);
    } finally {
      btnRefresh.disabled = false;
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
  modalMessage.className = "modal-message";
}

function closeAddFeedModal() {
  addFeedModal.classList.remove("active");
  modalOverlay.classList.remove("active");
  feedUrlInput.value = "";
  opmlFileInput.value = "";
  modalMessage.textContent = "";
  modalMessage.className = "modal-message";
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

  hideImportToast();
  btnImportOpml.disabled = true;
  btnConfirmAdd.disabled = true;
  showModalMessage("Preparing import…", "loading");

  // Subscribe to per-feed progress events emitted by the Rust backend.
  const unlisten = await listen<{
    current: number;
    total: number;
    imported: number;
    skipped: number;
    failed: number;
  }>("opml-progress", (event) => {
    const { current, total } = event.payload;
    showModalMessage(
      total > 0
        ? `Importing ${current} / ${total} feeds…`
        : "Importing OPML…",
      "loading"
    );
  });

  try {
    const content = await file.text();
    const result = await feedService.importOpml(content);
    const message = `Imported ${result.imported}/${result.total} feeds (${result.skipped} skipped, ${result.failed} failed).`;
    const hasFailures = result.failed > 0;

    showModalMessage(message, hasFailures ? "error" : "success");
    await loadFeeds({ reloadArticles: true });
    opmlFileInput.value = "";

    showImportToast(
      hasFailures ? "Import finished with issues" : "Import finished",
      message,
      hasFailures ? "error" : "success"
    );

    if (!hasFailures) {
      closeAddFeedModal();
    }
  } catch (error: any) {
    const errorMsg =
      (typeof error === "string" && error) ||
      error?.message ||
      error?.toString?.() ||
      "Failed to import OPML";
    showModalMessage(errorMsg, "error");
    showImportToast("Import failed", errorMsg, "error");
  } finally {
    unlisten();
    btnImportOpml.disabled = false;
    btnConfirmAdd.disabled = false;
  }
}

function showImportToast(
  title: string,
  message: string,
  type: "success" | "error"
) {
  importToastTitle.textContent = title;
  importToastMessage.textContent = message;
  importToast.className = `toast ${type} active`;
}

function hideImportToast() {
  importToast.className = "toast";
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

