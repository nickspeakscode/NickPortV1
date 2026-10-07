import "./style.css";
import "./writing.css";
import { escapeHtml, loadPublishedArticles, recordPageView } from "./lib/sanity.js";
import { readCache, writeCache } from "./lib/pageData.js";
import { getRouteSlug, initializeRevealAnimations, setPageMeta } from "./lib/pageUi.js";
import {
  initializeInteriorChrome,
  renderInteriorHeader,
  renderSiteFooter,
} from "./lib/siteChrome.js";

const app = document.querySelector("#app");
let writingArticles = [];
// "pending" with nothing to show, "cached" while a session copy is shown,
// then "ready" once Sanity answers or "error" if it cannot.
let loadState = "pending";
let cleanupPokemonRelease = () => {};
let cleanupReveals = () => {};

function realArticles(source) {
  return (source ?? []).filter((article) => article && !article.sample);
}

function articleDateTime(article) {
  if (!article.publishedAt) return "";
  return ` datetime="${escapeHtml(String(article.publishedAt).slice(0, 10))}"`;
}

function renderArticleRow(article, index) {
  return `
    <li>
      <a class="index-row index-enter" href="/writing/${encodeURIComponent(article.slug)}" style="--stagger: ${index + 1}">
        <span class="index-row-title">${escapeHtml(article.title)}</span>
        <time class="index-row-meta"${articleDateTime(article)}>${escapeHtml(article.displayDate)}</time>
      </a>
    </li>
  `;
}

function renderLibrary() {
  return `
    <main class="index-page">
      <header class="index-intro index-enter">
        <h1>musings</h1>
        <p>philosophy, markets, books, technology, and whatever else is worth thinking through.</p>
      </header>
      ${
        writingArticles.length
          ? `<ul class="index-list">${writingArticles.map(renderArticleRow).join("")}</ul>`
          : renderListStatus()
      }
    </main>
  `;
}

function renderListStatus() {
  if (loadState === "pending") return `<p class="index-empty" role="status">Loading musings…</p>`;
  if (loadState === "error") {
    return `<p class="index-empty index-enter" role="status" style="--stagger: 1">Musings could not be loaded right now. Please try again shortly.</p>`;
  }
  return `<p class="index-empty index-enter" style="--stagger: 1">Nothing published yet.</p>`;
}

function renderArticlePending() {
  return `
    <main class="index-page">
      <header class="index-intro">
        <p class="index-empty" role="status">Loading article…</p>
      </header>
    </main>
  `;
}

function renderArticle(article) {
  const bodyHtml = article.bodyHtml
    ? article.bodyHtml
    : (article.body ?? []).map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join("");

  return `
    <main class="writing-page article-page">
      <article class="article-detail">
        <a class="article-back" href="/writing/">← All musings</a>
        <header class="article-header">
          <span class="writing-category">${escapeHtml(article.category)}</span>
          <h1>${escapeHtml(article.title)}</h1>
          <p>${escapeHtml(article.excerpt)}</p>
          <span class="writing-meta">${escapeHtml(article.displayDate)} · ${escapeHtml(article.readTime)}</span>
        </header>
        <div class="article-signal" aria-hidden="true"><span></span></div>
        <div class="article-body">
          ${bodyHtml}
        </div>
      </article>
    </main>
  `;
}

function renderNotFound(message = "this article could not be found. it may have been unpublished or moved.") {
  return `
    <main class="index-page">
      <header class="index-intro index-enter">
        <h1>musings</h1>
        <p>${escapeHtml(message)}</p>
        <p class="index-empty"><a href="/writing/">all musings</a></p>
      </header>
    </main>
  `;
}

function renderWritingPage() {
  cleanupPokemonRelease();
  cleanupReveals();
  const selectedSlug = getRouteSlug("writing", "article");
  const selectedArticle = selectedSlug
    ? writingArticles.find((article) => article.slug === selectedSlug)
    : null;
  let content;
  if (!selectedSlug) {
    setPageMeta({ title: "Nick's Musings", path: "/writing/" });
    content = renderLibrary();
  } else if (selectedArticle) {
    setPageMeta({
      title: selectedArticle.title,
      description: selectedArticle.excerpt,
      path: `/writing/${encodeURIComponent(selectedArticle.slug)}`,
    });
    content = renderArticle(selectedArticle);
  } else if (loadState === "pending" || loadState === "cached") {
    // A session cache can predate a newly published article.
    content = renderArticlePending();
  } else if (loadState === "error") {
    setPageMeta({ title: "Nick's Musings" });
    content = renderNotFound("this article could not be loaded right now. please try again shortly.");
  } else {
    setPageMeta({ title: "Article Not Found" });
    content = renderNotFound();
  }

  app.innerHTML = `
    ${renderInteriorHeader("/writing/")}
    ${content}
    ${renderSiteFooter()}
  `;
  cleanupPokemonRelease = initializeInteriorChrome();
  cleanupReveals = initializeRevealAnimations(app);
  if (selectedArticle) recordPageView("article", selectedArticle.slug);
}

// Old links used /writing/?article=slug; show the clean URL instead.
function canonicalizeArticleUrl() {
  const params = new URLSearchParams(window.location.search);
  const slug = params.get("article");
  if (!slug) return;
  params.delete("article");
  const query = params.toString();
  history.replaceState(null, "", `/writing/${encodeURIComponent(slug)}${query ? `?${query}` : ""}${window.location.hash}`);
}

async function initializeWriting() {
  canonicalizeArticleUrl();
  const selectedSlug = getRouteSlug("writing", "article");
  const cached = realArticles(readCache("articles"));
  if (cached.length) {
    writingArticles = cached;
    loadState = "cached";
  }
  renderWritingPage();
  const showingPending = () => selectedSlug && !writingArticles.some((article) => article.slug === selectedSlug);

  try {
    const publishedArticles = await loadPublishedArticles();
    writeCache("articles", publishedArticles);
    const unchanged = cached.length && JSON.stringify(writingArticles) === JSON.stringify(publishedArticles);
    writingArticles = publishedArticles;
    loadState = "ready";
    if (!unchanged || showingPending()) renderWritingPage();
  } catch {
    const wasPending = !cached.length || showingPending();
    loadState = "error";
    if (wasPending) renderWritingPage();
  }
}

initializeWriting();
