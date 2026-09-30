import "./style.css";
import "./writing.css";
import "./learning.css";
import {
  buildSanityImageUrl,
  escapeHtml,
  loadLearningNote,
  loadLearningNotes,
  recordPageView,
} from "./lib/sanity.js";
import {
  initializeInteriorChrome,
  renderInteriorHeader,
  renderSiteFooter,
} from "./lib/siteChrome.js";
import { readCache, writeCache } from "./lib/pageData.js";
import { getRouteSlug, initializeRevealAnimations, setPageTitle } from "./lib/pageUi.js";

const app = document.querySelector("#app");
const noteSlug = getRouteSlug("notes");
let cleanupChrome = () => {};
let cleanupReveals = () => {};

function resourceInitials(title = "Learning") {
  return title
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
}

function noteDateTime(note) {
  if (!note.publishedAt) return "";
  return ` datetime="${escapeHtml(String(note.publishedAt).slice(0, 10))}"`;
}

function renderNoteRow(note, index) {
  return `
    <li>
      <a class="index-row index-enter" href="/notes/${encodeURIComponent(note.slug)}" style="--stagger: ${index + 1}">
        <span class="index-row-title">${escapeHtml(note.title)}</span>
        <time class="index-row-meta"${noteDateTime(note)}>${escapeHtml(note.displayDate)}</time>
      </a>
    </li>
  `;
}

function renderNotesIndex(notes, { pending = false } = {}) {
  return `
    <main class="index-page">
      <header class="index-intro index-enter">
        <h1>today i learned</h1>
        <p>short notes from books, courses, markets, and everyday curiosity.</p>
      </header>
      ${
        notes.length
          ? `<ul class="index-list">${notes.map(renderNoteRow).join("")}</ul>`
          : pending
            ? ""
            : `<p class="index-empty index-enter" style="--stagger: 1">Nothing published yet.</p>`
      }
    </main>
  `;
}

function renderLearningFrom(resource) {
  if (!resource) return "";
  const cover = resource.coverImage
    ? `<img src="${escapeHtml(buildSanityImageUrl(resource.coverImage, 180))}" alt="${escapeHtml(resource.coverAlt || `${resource.title} cover`)}" loading="lazy" />`
    : escapeHtml(resourceInitials(resource.title));

  return `
    <a class="learning-from" href="/library/${encodeURIComponent(resource.slug)}">
      <div class="learning-from-cover">${cover}</div>
      <div>
        <span class="learning-from-label">Learning From</span>
        <strong>${escapeHtml(resource.title)}</strong>
      </div>
      <span aria-hidden="true">→</span>
    </a>
  `;
}

function renderNoteDetail(note) {
  if (!note) {
    setPageTitle("Note Not Found");
    return renderNotFound();
  }

  setPageTitle(`${note.title} — Today I Learned`);
  return `
    <main class="learning-page note-detail">
      <article class="note-detail-inner reveal-on-scroll">
        <a class="detail-back" href="/notes/">← Today I Learned</a>
        <header class="note-detail-header">
          <span class="note-category">${escapeHtml(note.category)}</span>
          <h1>${escapeHtml(note.title)}</h1>
          <div class="note-detail-meta">
            <span>${escapeHtml(note.displayDate)}</span>
            <span>${escapeHtml(note.readTimeLabel)}</span>
          </div>
          ${
            note.tags?.length
              ? `<div class="note-tags" aria-label="Tags">${note.tags.map((tag) => `<span>${escapeHtml(tag)}</span>`).join("")}</div>`
              : ""
          }
        </header>
        <div class="article-signal" aria-hidden="true"><span></span></div>
        <div class="article-body">${note.bodyHtml}</div>
        ${renderLearningFrom(note.relatedResource)}
      </article>
    </main>
  `;
}

function renderNotFound(message = "this note could not be found. it may have been unpublished or moved.") {
  return `
    <main class="index-page">
      <header class="index-intro index-enter">
        <h1>still learning</h1>
        <p>${escapeHtml(message)}</p>
        <p class="index-empty"><a href="/notes/">all notes</a></p>
      </header>
    </main>
  `;
}

function renderPage(content) {
  cleanupChrome();
  cleanupReveals();
  app.innerHTML = `${renderInteriorHeader("/notes/")}${content}${renderSiteFooter()}`;
  cleanupChrome = initializeInteriorChrome();
  cleanupReveals = initializeRevealAnimations(app);
}

async function initializeNotes() {
  const saved = noteSlug ? null : readCache("notes");
  const cached = Array.isArray(saved) ? saved : null;
  try {
    if (noteSlug) {
      const note = await loadLearningNote(noteSlug);
      renderPage(renderNoteDetail(note));
      if (note) recordPageView("note", note.slug);
      return;
    }

    setPageTitle("Today I Learned");
    renderPage(renderNotesIndex(cached ?? [], { pending: !cached }));

    const notes = await loadLearningNotes();
    writeCache("notes", notes);
    if (JSON.stringify(cached) !== JSON.stringify(notes)) renderPage(renderNotesIndex(notes));
  } catch {
    if (!noteSlug && cached) return;
    renderPage(renderNotFound("Notes could not be loaded right now. Please try again shortly."));
  }
}

initializeNotes();
