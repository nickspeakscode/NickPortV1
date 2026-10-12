import "./style.css";
import "./writing.css";
import "./learning.css";
import "./libraryShelf.css";
import "./loop.css";
import { initializeLibraryShelf } from "./lib/libraryShelf.js";
import { safeHref } from "./lib/safeUrl.js";
import { isRecent } from "./lib/freshness.js";
import { bookLoop, progressSince } from "./lib/learningLoop.js";
import { renderGainToast, renderLoopPanel, renderShelfLoop, renderStudyHud, renderStudyLog } from "./lib/loopUi.js";
import {
  buildSanityImageUrl,
  escapeHtml,
  loadLearningResource,
  loadLearningResources,
  loadNoteSummaries,
  renderPortableText,
} from "./lib/sanity.js";
import {
  initializeInteriorChrome,
  renderInteriorHeader,
  renderSiteFooter,
} from "./lib/siteChrome.js";
import { readCache, sameContent, writeCache } from "./lib/pageData.js";
import { getRouteSlug, initializeRevealAnimations, setNoIndex, setPageMeta, setPageTitle } from "./lib/pageUi.js";

const app = document.querySelector("#app");
const resourceSlug = getRouteSlug("library");
let cleanupChrome = () => {};
let cleanupReveals = () => {};
let cleanupShelf = () => {};
let cleanupFilters = () => {};
let currentResources = [];
// All published notes: linked ones count toward a book's loop, and every one
// shows on the study heatmap.
let currentNotes = readCache("notes") ?? [];

function notesFor(resource, linked = []) {
  const bySlug = new Map();
  for (const note of [...currentNotes, ...linked]) if (note?.slug) bySlug.set(note.slug, { resourceSlug: resource.slug, ...note });
  return [...bySlug.values()].filter((note) => note.resourceSlug === resource.slug);
}
let activeFilter = new URLSearchParams(location.search).get("shelf") || "all";

function resourceTypeLabel(resource) {
  return (resource.resourceType === "Other" && resource.customResourceType?.trim()) || resource.resourceType || "Other";
}

function libraryFilters(resources) {
  const types = [...new Set(["Book", "Certification", ...resources.map(resourceTypeLabel)])];
  const labels = { Book: "Books", Certification: "Certifications", Course: "Courses", "Research Paper": "Research papers", Video: "Videos", Podcast: "Podcasts" };
  return [
    { key: "all", label: "Everything", matches: () => true },
    { key: "mine", label: "Written by me", matches: resource => resource.createdByMe === true },
    ...types.map(type => ({ key: `type:${type}`, label: Object.hasOwn(labels, type) ? labels[type] : type, matches: resource => resourceTypeLabel(resource) === type })),
  ];
}

function filteredResources(resources) {
  const filter = libraryFilters(resources).find(item => item.key === activeFilter);
  return filter ? resources.filter(filter.matches) : [];
}

function renderLibraryFilters(resources) {
  // Empty collections stay hidden until they have an entry, unless linked to directly.
  const visible = libraryFilters(resources).filter(filter =>
    filter.key === "all" || filter.key === activeFilter || resources.some(filter.matches));
  return `<div class="library-filters" role="group" aria-label="Filter library">${visible.map(filter => `
    <button type="button" class="library-filter" data-filter="${escapeHtml(filter.key)}" aria-pressed="${activeFilter === filter.key}" aria-controls="library-results">
      ${escapeHtml(filter.label)} <span>${resources.filter(filter.matches).length}</span>
    </button>`).join("")}</div>`;
}

function initializeLibraryFilters() {
  const update = () => {
    const filters = app.querySelector(".library-filters");
    if (!filters) return;
    filters.outerHTML = renderLibraryFilters(currentResources);
    app.querySelector("#library-results").innerHTML = renderLibraryResults(currentResources);
    const count = filteredResources(currentResources).length;
    app.querySelector(".library-filter-status").textContent = `${count} ${count === 1 ? "entry" : "entries"} shown.`;
  };
  const onClick = event => {
    const button = event.target.closest("[data-filter]");
    if (!button || button.dataset.filter === activeFilter) return;
    activeFilter = button.dataset.filter;
    const url = new URL(location.href);
    if (activeFilter === "all") url.searchParams.delete("shelf");
    else url.searchParams.set("shelf", activeFilter);
    history.pushState(null, "", url);
    update();
  };
  const onPopState = () => {
    activeFilter = new URLSearchParams(location.search).get("shelf") || "all";
    if (!libraryFilters(currentResources).some(filter => filter.key === activeFilter)) activeFilter = "all";
    const reader = document.querySelector(".library-reader[open]");
    if (reader) {
      reader.addEventListener("close", () => {
        update();
        app.querySelector('.library-filter[aria-pressed="true"]')?.focus({ preventScroll: true });
      }, { once: true });
      reader.dispatchEvent(new Event("cancel", { cancelable: true }));
    } else update();
  };
  app.addEventListener("click", onClick);
  window.addEventListener("popstate", onPopState);
  return () => {
    app.removeEventListener("click", onClick);
    window.removeEventListener("popstate", onPopState);
  };
}

const CMA_IDENTITY_PATTERN = /\b(cma|gleim|certified management accountant)\b/i;

function statusKey(status = "") {
  return status.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function resourceIdentityText(resource = {}) {
  return [resource.title, resource.resourceType, resource.category, resource.authorCreator, ...(resource.tags ?? [])]
    .filter(Boolean)
    .join(" ");
}

function isCmaStudyResource(resource) {
  return CMA_IDENTITY_PATTERN.test(resourceIdentityText(resource));
}

function findCurrentlyLearningCma(resources = []) {
  const matches = resources.filter(
    (resource) => resource.status === "Currently Learning" && isCmaStudyResource(resource)
  );
  return matches.find((resource) => resource.featured) ?? matches[0] ?? null;
}

function clampProgress(value) {
  return Math.min(100, Math.max(0, Number(value) || 0));
}

function resourceInitials(title = "Learning") {
  return title
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
}

function renderCover(resource, className = "resource-cover") {
  const image = resource.coverImage
    ? `<img src="${escapeHtml(buildSanityImageUrl(resource.coverImage, 720))}" alt="${escapeHtml(resource.coverAlt || `${resource.title} cover`)}" loading="lazy" />`
    : `<div class="book-face book-face-fallback" aria-hidden="true"><span class="book-cover-type">${escapeHtml(resourceTypeLabel(resource))}</span><span class="book-cover-title">${escapeHtml(resource.title)}</span><span class="book-cover-author">${escapeHtml(resource.authorCreator || "")}</span></div>`;

  return `<div class="${className}">${image}</div>`;
}

const RARITY_LABELS = {
  legendary: "Legendary", epic: "Epic", rare: "Rare", active: "In progress", unique: "Unique", unread: "Unread", common: "Common",
};

// Your own work is unique; in-progress items glow aqua; finished items earn
// their tier from your rating.
function rarityFor(resource) {
  let key = "common";
  const rating = Number(resource.rating);
  if (resource.createdByMe) key = "unique";
  else if (resource.status === "Currently Learning" || resource.status === "In Progress") key = "active";
  else if (rating >= 5) key = "legendary";
  else if (rating >= 4) key = "epic";
  else if (rating >= 3) key = "rare";
  else if (!resource.status || resource.status === "Want to Learn") key = "unread";
  return { key, label: RARITY_LABELS[key] };
}

function renderTier(resource) {
  const { key, label } = rarityFor(resource);
  return `<span class="item-tier" data-rarity="${key}"><span aria-hidden="true">◆</span> ${escapeHtml(label)}</span>`;
}

// Progress as a ten-segment XP bar.
function renderXp(resource) {
  const progress = clampProgress(resource.progress);
  const filled = Math.round(progress / 10);
  return `
    <div class="item-xp" role="progressbar" aria-label="Progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${progress}">
      <div class="item-xp-label"><span>Progress</span><span>${progress}%</span></div>
      <div class="item-xp-track" aria-hidden="true">${Array.from({ length: 10 }, (_, index) => `<i${index < filled ? ' class="is-filled"' : ""}></i>`).join("")}</div>
    </div>
  `;
}

// Rating as five diamond pips (halves allowed).
function renderPips(rating) {
  if (rating == null || rating === "" || !Number.isFinite(Number(rating)) || Number(rating) < 1 || Number(rating) > 5) return "";
  const value = Number(rating);
  const pips = Array.from({ length: 5 }, (_, index) => {
    const state = value >= index + 1 ? "is-full" : value >= index + 0.5 ? "is-half" : "";
    return `<i${state ? ` class="${state}"` : ""}></i>`;
  }).join("");
  return `<div class="resource-rating item-pips" role="img" aria-label="Rated ${escapeHtml(rating)} out of 5"><span class="item-pips-row" aria-hidden="true">${pips}</span><span class="item-pips-value" aria-hidden="true">${escapeHtml(rating)} / 5</span></div>`;
}

function renderProgress(resource) {
  const progress = clampProgress(resource.progress);
  return `
    <div
      class="resource-progress"
      role="progressbar"
      aria-label="Progress"
      aria-valuemin="0"
      aria-valuemax="100"
      aria-valuenow="${progress}"
    >
      <div class="resource-progress-label">
        <span>Progress</span>
        <span>${progress}%</span>
      </div>
      <div class="resource-progress-track" aria-hidden="true">
        <span style="--progress: ${progress}%"></span>
      </div>
    </div>
  `;
}

function renderRating(rating) {
  if (rating == null || rating === "" || !Number.isFinite(Number(rating)) || Number(rating) < 1 || Number(rating) > 5) return "";
  return `<div class="resource-rating" role="img" aria-label="Rated ${escapeHtml(rating)} out of 5">★ ${escapeHtml(rating)} / 5</div>`;
}

function renderResourceRow(resource, index) {
  const cover = resource.coverImage
    ? `<img class="index-row-cover" src="${escapeHtml(buildSanityImageUrl(resource.coverImage, 160))}" alt="" width="40" height="56" loading="lazy" />`
    : `<span class="index-row-cover-fallback" aria-hidden="true">${escapeHtml(resourceInitials(resource.title))}</span>`;
  const meta = resource.status || resource.resourceType || "";

  return `
    <li>
      <a class="index-row index-row-book index-enter" data-resource="${escapeHtml(resource.slug)}" data-rarity="${rarityFor(resource).key}" href="/library/${encodeURIComponent(resource.slug)}" style="--stagger: ${index + 1}">
        ${cover}
        <span class="index-row-copy">
          <span class="index-row-title">${escapeHtml(resource.title)}</span>
          ${resource.authorCreator ? `<span class="index-row-sub">${escapeHtml(resource.authorCreator)}</span>` : ""}
        </span>
        <span class="index-row-meta">${escapeHtml(meta)}</span>
      </a>
    </li>
  `;
}

function renderCmaStudyCallout(resource) {
  if (!resource) return "";

  return `
    <section class="index-featured" aria-labelledby="cmaStudyTitle">
      <h2 id="cmaStudyTitle" class="index-featured-label">currently learning</h2>
      <ul class="index-list">${renderResourceRow(resource, 0)}</ul>
    </section>
  `;
}

function shorten(text = "", length = 96) {
  const clean = String(text ?? "").replace(/\s+/g, " ").trim();
  return clean.length > length ? `${clean.slice(0, length).replace(/\s+\S*$/, "")}…` : clean;
}

// The page under the cover, glimpsed when a hovered book falls slightly open.
function renderBookPage(resource) {
  const progress = clampProgress(resource.progress);
  const { label: tier } = rarityFor(resource);
  const label = resource.status === "Currently Learning" && progress
    ? `${tier} · ${progress}%`
    : `${tier} · ${resource.status || resourceTypeLabel(resource)}`;
  const line = shorten(resource.keyTakeaways?.[0] || resource.description, 74);
  return `<span class="book-page">
    <span class="book-page-label">${escapeHtml(label)}</span>
    ${line ? `<span class="book-page-line">${escapeHtml(line)}</span>` : ""}
    <span class="book-page-cta">Inspect <span aria-hidden="true">›</span></span>
  </span>`;
}

const NEW_TAG = `<span class="item-new">New</span>`;
// A sealed item waits on the shelf for its first viewer; see initializeLibraryShelf.
const SEAL = `<span class="book-seal" aria-hidden="true"><span class="book-seal-wrap book-seal-wrap--a"></span><span class="book-seal-wrap book-seal-wrap--b"></span><span class="book-seal-glint"></span><span class="book-seal-tag">New</span></span>`;

function renderShelfBook(resource, index) {
  const fresh = isRecent(resource._createdAt);
  // Only an unstarted new item arrives sealed; one already in progress just carries the tag.
  const sealed = fresh && (!resource.status || resource.status === "Want to Learn");
  const cover = resource.coverImage
    ? `<img src="${escapeHtml(buildSanityImageUrl(resource.coverImage, 720))}" alt="" loading="lazy" />`
    : `<span class="book-cover-type">${escapeHtml(resourceTypeLabel(resource))}</span>
       <span class="book-cover-title">${escapeHtml(resource.title)}</span>
       <span class="book-cover-author">${escapeHtml(resource.authorCreator || "")}</span>`;
  return `<li class="shelf-item${sealed ? " is-new" : ""}" style="--book-delay: ${Math.min(index, 5) * 65}ms">
    <a class="shelf-link" href="/library/${encodeURIComponent(resource.slug)}" data-resource="${escapeHtml(resource.slug)}" data-rarity="${rarityFor(resource).key}">
      <span class="book-stage" aria-hidden="true">
        <span class="book-sparks"><i></i><i></i><i></i><i></i><i></i></span>
        <span class="book-object">${renderBookPage(resource)}<span class="book-face${resource.coverImage ? "" : " book-face-fallback"}">${cover}</span>${resource.status === "Currently Learning" ? '<span class="book-ribbon"></span>' : ""}${sealed ? SEAL : ""}</span>
      </span>
      <span class="shelf-caption">
        <span class="shelf-meta">${fresh ? NEW_TAG : ""}${renderTier(resource)}<span class="shelf-type">${escapeHtml(resourceTypeLabel(resource))}${resource.createdByMe ? " · My work" : ""}</span></span>
        <span class="shelf-title">${escapeHtml(resource.title)}</span>
        ${resource.authorCreator ? `<span class="shelf-author">${escapeHtml(resource.authorCreator)}</span>` : ""}
        ${resource.status ? `<span class="shelf-status" data-status="${statusKey(resource.status)}">${escapeHtml(resource.status)}</span>` : ""}
        ${renderShelfLoop(bookLoop(resource, currentNotes))}
      </span>
    </a>
  </li>`;
}

function renderLibraryResults(resources, { pending = false } = {}) {
  const filtered = filteredResources(resources);
  const cmaResource = activeFilter === "all" ? findCurrentlyLearningCma(filtered) : null;
  const shelf = cmaResource
    ? filtered.filter((resource) => resource.slug !== cmaResource.slug)
    : filtered;
  const label = libraryFilters(resources).find(filter => filter.key === activeFilter)?.label || "Selected collection";

  return `
      ${renderCmaStudyCallout(cmaResource)}
      <div class="shelf-heading">
        <h2>${activeFilter === "all" ? "On the shelf" : escapeHtml(label)} <span>${String(filtered.length).padStart(2, "0")}</span></h2>
        <p>Pick a cover. Take a closer look.</p>
      </div>
      ${
        shelf.length
          ? `<ul class="library-shelf">${shelf.map(renderShelfBook).join("")}</ul>`
          : cmaResource || pending
            ? (pending ? `<p class="index-empty" role="status">Loading the shelf…</p>` : "")
            : `<p class="index-empty index-enter" style="--stagger: 1">${activeFilter === "all" ? "Nothing on the shelf yet." : "Nothing in this collection yet. Choose another filter to explore the shelf."}</p>`
      }`;
}

function renderLibrary(resources, options = {}) {
  if (resources.length && !libraryFilters(resources).some(filter => filter.key === activeFilter)) activeFilter = "all";
  return `
    <main class="index-page library-shelf-page">
      <header class="index-intro index-enter">
        <h1>library</h1>
        <p>what I’m reading, learning, and creating. A closer look at the work behind the profile.</p>
      </header>
      <div id="study-hud">${renderStudyHud(resources, currentNotes)}</div>
      ${renderLibraryFilters(resources)}
      <p class="library-filter-status" role="status" aria-atomic="true"></p>
      <div id="library-results">${renderLibraryResults(resources, options)}</div>
    </main>
  `;
}

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(date);
}

function renderRelatedNote(note, index) {
  const published = note.publishedAt ? ` datetime="${escapeHtml(String(note.publishedAt).slice(0, 10))}"` : "";
  return `
    <li>
      <a class="index-row index-enter" href="/notes/${encodeURIComponent(note.slug)}" style="--stagger: ${index + 1}">
        <span class="index-row-title">${escapeHtml(note.title)}</span>
        <time class="index-row-meta"${published}>${escapeHtml(note.displayDate)}</time>
      </a>
    </li>
  `;
}

function renderResourceDetail(resource, notes) {
  if (!resource) {
    setPageTitle("Resource Not Found");
    setNoIndex();
    return renderNotFound("That resource is not on this shelf.", "/library/", "Back to the Library");
  }

  setPageMeta({
    title: `${resource.title} — Learning Library`,
    description: resource.description,
    path: `/library/${encodeURIComponent(resource.slug)}`,
  });
  const status = resource.status || "Want to Learn";
  const externalUrl = safeHref(resource.externalUrl, ['http:', 'https:']);
  const loop = bookLoop(resource, notesFor(resource, notes));
  const loopSection = loop.entries.length || status === "Currently Learning"
    ? `<section class="learning-detail-section loop-detail reveal-on-scroll">
        ${renderLoopPanel(loop, { heading: "Learning loop" })}
        ${loop.entries.length ? `<h3 class="loop-log-heading">Study log</h3>${renderStudyLog(loop.entries)}` : ""}
      </section>`
    : "";
  const thoughts = resource.personalSummary?.length
    ? `<section class="learning-detail-section reveal-on-scroll">
        <h2>My thoughts</h2>
        <div class="article-body">${renderPortableText(resource.personalSummary)}</div>
      </section>`
    : "";
  const takeaways = resource.keyTakeaways?.length
    ? `<section class="learning-detail-section reveal-on-scroll">
        <h2>Key takeaways</h2>
        <ul class="takeaway-list">${resource.keyTakeaways.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
      </section>`
    : "";

  return `
    <main class="learning-page resource-detail">
      <a class="detail-back" href="/library/">← Learning Library</a>
      <div class="resource-detail-grid">
        ${renderCover(resource, `resource-detail-cover reveal-on-scroll`)}
        <article class="resource-detail-copy reveal-on-scroll">
          <div class="resource-card-topline">
            <span class="resource-type-badge">${escapeHtml(resourceTypeLabel(resource))}${resource.createdByMe ? " · My work" : ""}</span>
            <span class="learning-status" data-status="${statusKey(status)}">${escapeHtml(status)}</span>
          </div>
          <h1 class="learning-detail-title">${escapeHtml(resource.title)}</h1>
          ${resource.authorCreator ? `<p class="resource-creator">By ${escapeHtml(resource.authorCreator)}</p>` : ""}
          <p class="resource-detail-description">${escapeHtml(resource.description)}</p>
          ${renderProgress(resource)}
          ${renderRating(resource.rating)}
          <div class="resource-facts">
            ${resource.category ? `<div class="resource-fact"><span>Category</span><strong>${escapeHtml(resource.category)}</strong></div>` : ""}
            <div class="resource-fact"><span>Type</span><strong>${escapeHtml(resourceTypeLabel(resource))}</strong></div>
            ${resource.startDate ? `<div class="resource-fact"><span>Started</span><strong>${escapeHtml(formatDate(resource.startDate))}</strong></div>` : ""}
            ${resource.finishDate ? `<div class="resource-fact"><span>${resource.status === "Published" ? "Published" : "Finished"}</span><strong>${escapeHtml(formatDate(resource.finishDate))}</strong></div>` : ""}
          </div>
          ${
            externalUrl
              ? `<a class="resource-external" href="${escapeHtml(externalUrl)}" target="_blank" rel="noreferrer">${resource.resourceType === "Certification" ? "View credential" : "Open resource"} <span aria-hidden="true">↗</span></a>`
              : ""
          }
        </article>
      </div>
      ${loopSection}
      ${thoughts}
      ${takeaways}
      <section class="learning-detail-section reveal-on-scroll" aria-labelledby="resourceNotesTitle">
        <h2 id="resourceNotesTitle">Notes From This Resource</h2>
        ${
          notes.length
            ? `<ul class="index-list">${notes.map(renderRelatedNote).join("")}</ul>`
            : `<p class="index-empty" role="status">No notes yet.</p>`
        }
      </section>
    </main>
  `;
}

function readerPage(kind, inner, label = "") {
  return `<section class="reader-page reader-page--${kind}"${label ? ` aria-label="${escapeHtml(label)}"` : ""}>${inner}</section>`;
}

// The opened-book reader on the shelf: a title page, an about page, then one
// page per section. Content mirrors renderResourceDetail, which stays the
// canonical full page at /library/<slug>.
function renderReaderPages(resource, notes, { loadingNotes = false } = {}) {
  const status = resource.status || "Want to Learn";
  const externalUrl = safeHref(resource.externalUrl, ["http:", "https:"]);
  const pages = [
    readerPage("title", `
      ${renderCover(resource, "resource-detail-cover")}
      <div class="item-heading">
        <div class="item-tags">${isRecent(resource._createdAt) ? NEW_TAG : ""}${renderTier(resource)}<span class="resource-type-badge">${escapeHtml(resourceTypeLabel(resource))}${resource.createdByMe ? " · My work" : ""}</span></div>
        <h2 class="item-name" id="library-reader-title">${escapeHtml(resource.title)}</h2>
        ${resource.authorCreator ? `<p class="item-creator">${escapeHtml(resource.authorCreator)}</p>` : ""}
      </div>
      <div class="item-status"><span>Status</span><strong>${escapeHtml(status)}</strong></div>
      ${renderXp(resource)}
      ${renderPips(resource.rating)}`),
    readerPage("about", `
      <h3 class="reader-kicker">Item description</h3>
      <p class="item-description">${escapeHtml(resource.description)}</p>
      <h3 class="reader-kicker">Stats</h3>
      <dl class="item-stats">
        ${resource.category ? `<div><dt>Category</dt><dd>${escapeHtml(resource.category)}</dd></div>` : ""}
        <div><dt>Type</dt><dd>${escapeHtml(resourceTypeLabel(resource))}</dd></div>
        ${resource.startDate ? `<div><dt>Started</dt><dd>${escapeHtml(formatDate(resource.startDate))}</dd></div>` : ""}
        ${resource.finishDate ? `<div><dt>${resource.status === "Published" ? "Published" : "Finished"}</dt><dd>${escapeHtml(formatDate(resource.finishDate))}</dd></div>` : ""}
      </dl>
      ${externalUrl ? `<a class="resource-external" href="${escapeHtml(externalUrl)}" target="_blank" rel="noreferrer">${resource.resourceType === "Certification" ? "View credential" : "Open resource"} <span aria-hidden="true">↗</span></a>` : ""}`, "About"),
  ];
  const loop = bookLoop(resource, notesFor(resource, notes));
  if (loop.entries.length || status === "Currently Learning") {
    pages.push(readerPage("loop", renderLoopPanel(loop), "Learning loop"));
    if (loop.entries.length) {
      pages.push(readerPage("section", `<section class="learning-detail-section"><h2 class="reader-heading">Study log</h2>${renderStudyLog(loop.entries, { limit: 6 })}</section>`, "Study log"));
    }
  }
  if (resource.personalSummary?.length) {
    pages.push(readerPage("section", `<section class="learning-detail-section"><h2 class="reader-heading">My thoughts</h2><div class="article-body">${renderPortableText(resource.personalSummary)}</div></section>`, "My thoughts"));
  }
  if (resource.keyTakeaways?.length) {
    pages.push(readerPage("section", `<section class="learning-detail-section"><h2 class="reader-heading">Key takeaways</h2><ul class="takeaway-list">${resource.keyTakeaways.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul></section>`, "Key takeaways"));
  }
  pages.push(readerPage("section", `<section class="learning-detail-section" aria-labelledby="resourceNotesTitle">
      <h2 class="reader-heading" id="resourceNotesTitle">Notes from this ${escapeHtml(resourceTypeLabel(resource).toLowerCase())}</h2>
      ${notes.length
        ? `<ul class="index-list">${notes.map(renderRelatedNote).join("")}</ul>`
        : `<p class="index-empty" role="status">${loadingNotes ? "Loading related notes…" : "No notes yet."}</p>`}
    </section>`, "Notes"));
  // Spreads show two pages; close an odd count with a quiet end page.
  if (pages.length % 2) pages.push(readerPage("end", `<p class="reader-end" aria-hidden="true">◆</p>`));
  return pages;
}

function renderNotFound(message, href, label) {
  return `
    <main class="index-page">
      <header class="index-intro index-enter">
        <h1>nothing on this shelf</h1>
        <p>${escapeHtml(message)}</p>
        <p class="index-empty"><a href="${escapeHtml(href)}">${escapeHtml(label)}</a></p>
      </header>
    </main>
  `;
}

function renderPage(content) {
  cleanupFilters();
  cleanupShelf();
  cleanupChrome();
  cleanupReveals();
  app.innerHTML = `${renderInteriorHeader("/library/")}${content}${renderSiteFooter()}`;
  cleanupChrome = initializeInteriorChrome();
  cleanupReveals = initializeRevealAnimations(app);
  if (!resourceSlug) cleanupFilters = initializeLibraryFilters();
  if (!resourceSlug) cleanupShelf = initializeLibraryShelf(app, {
    findResource: slug => currentResources.find(resource => resource.slug === slug),
    loadResource: loadLearningResource,
    renderPages: renderReaderPages,
  });
}

// Loop progress the visitor has already seen, per book. Only real gains
// since then are celebrated; a first visit just records the baseline.
const SEEN_KEY = "nt-loop-seen-v1";

function rewardProgress(resources, notes) {
  const snapshot = {};
  for (const resource of resources) {
    const loop = bookLoop(resource, notes);
    if (loop.entries.length) snapshot[resource.slug] = { title: resource.title, xp: loop.xp, loops: loop.loops, level: loop.level.level };
  }
  let previous = null;
  try { previous = JSON.parse(localStorage.getItem(SEEN_KEY) || "null"); } catch { /* Unreadable: treat as first visit. */ }
  try { localStorage.setItem(SEEN_KEY, JSON.stringify(snapshot)); } catch { /* Private mode: no memory. */ }
  return previous ? progressSince(previous, snapshot) : [];
}

function celebrate(gains) {
  const motion = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  for (const gain of gains) {
    const item = [...app.querySelectorAll(".shelf-link")].find((link) => link.dataset.resource === gain.slug)?.closest(".shelf-item");
    item?.classList.add("has-gain");
  }
  document.querySelector(".gain-toast")?.remove();
  const holder = document.createElement("div");
  holder.innerHTML = renderGainToast(gains);
  const toast = holder.firstElementChild;
  document.body.append(toast);
  const close = () => {
    toast.classList.add("is-leaving");
    setTimeout(() => toast.remove(), motion ? 320 : 0);
  };
  toast.querySelector(".gain-toast-close").addEventListener("click", close);
  const timer = setTimeout(close, 9000);
  const outside = (event) => {
    if (toast.contains(event.target)) return;
    close();
    document.removeEventListener("pointerdown", outside, true);
    document.removeEventListener("keydown", escape, true);
  };
  const escape = (event) => { if (event.key === "Escape") outside(event); };
  document.addEventListener("pointerdown", outside, true);
  document.addEventListener("keydown", escape, true);
  toast.addEventListener("pointerenter", () => clearTimeout(timer), { once: true });
  // Count the XP up, game-style.
  const counter = toast.querySelector("[data-count]");
  const target = Number(counter.dataset.count);
  if (motion && target > 0) {
    const start = performance.now();
    const tick = (now) => {
      const t = Math.min(1, (now - start) / 900);
      counter.textContent = String(Math.round(target * (1 - (1 - t) ** 3)));
      if (t < 1) requestAnimationFrame(tick);
    };
    counter.textContent = "0";
    requestAnimationFrame(tick);
  }
}

async function initializeLibrary() {
  try {
    if (resourceSlug) {
      renderPage(`<main class="index-page"><header class="index-intro"><p class="index-empty" role="status">Loading…</p></header></main>`);
      const { resource, notes } = await loadLearningResource(resourceSlug);
      renderPage(renderResourceDetail(resource, notes));
      return;
    }

    const cached = readCache("resources");
    const cachedNotes = currentNotes;
    currentResources = cached ?? [];
    setPageMeta({ title: "Learning Library", path: "/library/" });
    renderPage(renderLibrary(cached ?? [], { pending: !cached }));

    const [resources, notes] = await Promise.all([
      loadLearningResources(),
      loadNoteSummaries().catch(() => cachedNotes),
    ]);
    writeCache("resources", resources);
    writeCache("notes", notes);
    currentResources = resources;
    currentNotes = notes;
    const gains = rewardProgress(resources, notes);
    if (!cached || !sameContent(cached, resources) || !sameContent(cachedNotes, notes)) {
      const reader = document.querySelector(".library-reader[open]");
      if (reader) reader.addEventListener("close", () => {
        const selectedSlug = reader.dataset.resource;
        renderPage(renderLibrary(resources));
        [...app.querySelectorAll('[data-resource]')].find(link => link.dataset.resource === selectedSlug)?.focus({ preventScroll: true });
      }, { once: true });
      else renderPage(renderLibrary(resources));
    }
    if (gains.length) celebrate(gains);
  } catch {
    if (!resourceSlug && currentResources.length) return;
    renderPage(renderNotFound("The Library could not be loaded right now. Please try again shortly.", "/library/", "Try the Library again"));
  }
}

initializeLibrary();
