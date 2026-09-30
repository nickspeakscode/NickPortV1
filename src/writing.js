import "./style.css";
import "./writing.css";
import { escapeHtml, loadPublishedArticles, recordPageView } from "./lib/sanity.js";
import { readCache, writeCache } from "./lib/pageData.js";
import { getRouteSlug, initializeRevealAnimations } from "./lib/pageUi.js";
import {
  initializeInteriorChrome,
  renderInteriorHeader,
  renderSiteFooter,
} from "./lib/siteChrome.js";

const app = document.querySelector("#app");
let writingArticles = [];
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
      <a class="index-row index-enter" href="/writing/?article=${encodeURIComponent(article.slug)}" style="--stagger: ${index + 1}">
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
          : `<p class="index-empty index-enter" style="--stagger: 1">Nothing published yet.</p>`
      }
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

function renderNotFound() {
  return `
    <main class="index-page">
      <header class="index-intro index-enter">
        <h1>musings</h1>
        <p>this article could not be found. it may have been unpublished or moved.</p>
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
  const content = selectedSlug
    ? selectedArticle
      ? renderArticle(selectedArticle)
      : renderNotFound()
    : renderLibrary();

  app.innerHTML = `
    ${renderInteriorHeader("/writing/")}
    ${content}
    ${renderSiteFooter()}
  `;
  cleanupPokemonRelease = initializeInteriorChrome();
  cleanupReveals = initializeRevealAnimations(app);
  if (selectedArticle) recordPageView("article", selectedArticle.slug);
}

async function initializeWriting() {
  const cached = realArticles(readCache("articles"));
  if (cached.length) writingArticles = cached;
  renderWritingPage();

  try {
    const publishedArticles = await loadPublishedArticles();
    writeCache("articles", publishedArticles);
    if (JSON.stringify(writingArticles) === JSON.stringify(publishedArticles) && cached.length) return;
    writingArticles = publishedArticles;
    renderWritingPage();
  } catch {
    if (!cached.length) {
      writingArticles = [];
      renderWritingPage();
    }
  }
}

initializeWriting();
