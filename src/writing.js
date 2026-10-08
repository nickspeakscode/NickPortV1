import "./style.css";
import "./writing.css";
import { escapeHtml, loadArticle, loadArticleSummaries, recordPageView } from "./lib/sanity.js";
import { readCache, sameContent, writeCache } from "./lib/pageData.js";
import { getRouteSlug, initializeRevealAnimations, setNoIndex, setPageMeta } from "./lib/pageUi.js";
import {
  initializeInteriorChrome,
  renderInteriorHeader,
  renderSiteFooter,
} from "./lib/siteChrome.js";

const app = document.querySelector("#app");
let cleanupPokemonRelease = () => {};
let cleanupReveals = () => {};

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

// state: "pending" with nothing to show, "ready" once Sanity answers, "error" if it cannot.
function renderIndex(articles, state) {
  let status = `<p class="index-empty index-enter" style="--stagger: 1">Nothing published yet.</p>`;
  if (state === "pending") status = `<p class="index-empty" role="status">Loading musings…</p>`;
  if (state === "error") {
    status = `<p class="index-empty index-enter" role="status" style="--stagger: 1">Musings could not be loaded right now. Please try again shortly.</p>`;
  }

  return `
    <main class="index-page">
      <header class="index-intro index-enter">
        <h1>musings</h1>
        <p>philosophy, markets, books, technology, and whatever else is worth thinking through.</p>
      </header>
      ${articles.length ? `<ul class="index-list">${articles.map(renderArticleRow).join("")}</ul>` : status}
    </main>
  `;
}

function renderPending() {
  return `
    <main class="index-page">
      <header class="index-intro">
        <p class="index-empty" role="status">Loading article…</p>
      </header>
    </main>
  `;
}

// A summary from the list (no body yet) renders its header straight away.
function renderArticle(article) {
  const meta = [article.displayDate, article.readTime].filter(Boolean).join(" · ");
  const body = article.bodyHtml ?? `<p class="index-empty" role="status">Loading article…</p>`;

  return `
    <main class="writing-page article-page">
      <article class="article-detail">
        <a class="article-back" href="/writing/">← All musings</a>
        <header class="article-header">
          <span class="writing-category">${escapeHtml(article.category)}</span>
          <h1>${escapeHtml(article.title)}</h1>
          <p>${escapeHtml(article.excerpt)}</p>
          <span class="writing-meta">${escapeHtml(meta)}</span>
        </header>
        <div class="article-signal" aria-hidden="true"><span></span></div>
        <div class="article-body">
          ${body}
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

function renderPage(content) {
  cleanupPokemonRelease();
  cleanupReveals();
  app.innerHTML = `
    ${renderInteriorHeader("/writing/")}
    ${content}
    ${renderSiteFooter()}
  `;
  cleanupPokemonRelease = initializeInteriorChrome();
  cleanupReveals = initializeRevealAnimations(app);
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

async function initializeIndex() {
  setPageMeta({ title: "Nick's Musings", path: "/writing/" });
  const cached = readCache("articles");
  renderPage(renderIndex(cached ?? [], cached ? "ready" : "pending"));

  try {
    const articles = await loadArticleSummaries();
    writeCache("articles", articles);
    if (!cached || !sameContent(cached, articles)) renderPage(renderIndex(articles, "ready"));
  } catch {
    if (!cached) renderPage(renderIndex([], "error"));
  }
}

function showArticle(article) {
  setPageMeta({
    title: article.title,
    description: article.excerpt,
    path: `/writing/${encodeURIComponent(article.slug)}`,
  });
  renderPage(renderArticle(article));
}

async function initializeArticle(slug) {
  const cacheKey = `article:${slug}`;
  const cached = readCache(cacheKey);
  const summary = (readCache("articles") ?? []).find((article) => article.slug === slug);
  if (cached) showArticle(cached);
  else if (summary) showArticle(summary);
  else renderPage(renderPending());

  try {
    const article = await loadArticle(slug);
    if (!article) {
      setPageMeta({ title: "Article Not Found" });
      setNoIndex();
      renderPage(renderNotFound());
      return;
    }
    writeCache(cacheKey, article);
    if (!cached || !sameContent(cached, article)) showArticle(article);
    recordPageView("article", article.slug);
  } catch {
    if (cached) return;
    setPageMeta({ title: "Nick's Musings" });
    renderPage(renderNotFound("this article could not be loaded right now. please try again shortly."));
  }
}

canonicalizeArticleUrl();
const selectedSlug = getRouteSlug("writing", "article");
if (selectedSlug) initializeArticle(selectedSlug);
else initializeIndex();
