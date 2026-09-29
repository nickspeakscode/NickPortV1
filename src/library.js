import "./style.css";
import "./writing.css";
import "./learning.css";
import "./libraryShelf.css";
import { initializeLibraryShelf } from "./lib/libraryShelf.js";
import { safeHref } from "./lib/safeUrl.js";
import {
  buildSanityImageUrl,
  escapeHtml,
  loadLearningResource,
  loadLearningResources,
  renderPortableText,
} from "./lib/sanity.js";
import {
  initializeInteriorChrome,
  renderInteriorHeader,
  renderSiteFooter,
} from "./lib/siteChrome.js";
import { readCache, writeCache } from "./lib/pageData.js";
import { getRouteSlug, initializeRevealAnimations, setPageTitle } from "./lib/pageUi.js";

const app = document.querySelector("#app");
const resourceSlug = getRouteSlug("library");
let cleanupChrome = () => {};
let cleanupReveals = () => {};
let cleanupShelf = () => {};
let cleanupFilters = () => {};
let currentResources = [];
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
  return `<div class="library-filters" role="group" aria-label="Filter library">${libraryFilters(resources).map(filter => `
    <button type="button" class="library-filter" data-filter="${escapeHtml(filter.key)}" aria-pressed="${activeFilter === filter.key}" aria-controls="library-results">
      ${escapeHtml(filter.label)} <span>${resources.filter(filter.matches).length}</span>
    </button>`).join("")}</div>`;
}

function initializeLibraryFilters() {
  const update = () => {
    const filters = app.querySelector(".library-filters");
    if (!filters) return;
    filters.querySelectorAll("[data-filter]").forEach(button => button.setAttribute("aria-pressed", String(button.dataset.filter === activeFilter)));
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
  return `<div class="resource-rating" aria-label="Rated ${escapeHtml(rating)} out of 5">★ ${escapeHtml(rating)} / 5</div>`;
}

function renderResourceRow(resource, index) {
  const cover = resource.coverImage
    ? `<img class="index-row-cover" src="${escapeHtml(buildSanityImageUrl(resource.coverImage, 160))}" alt="${escapeHtml(resource.coverAlt || `${resource.title} cover`)}" width="40" height="56" loading="lazy" />`
    : `<span class="index-row-cover-fallback" aria-hidden="true">${escapeHtml(resourceInitials(resource.title))}</span>`;
  const meta = resource.status || resource.resourceType || "";

  return `
    <li>
      <a class="index-row index-row-book index-enter" data-resource="${escapeHtml(resource.slug)}" href="/library/${encodeURIComponent(resource.slug)}" style="--stagger: ${index + 1}">
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

function renderShelfBook(resource, index) {
  const cover = resource.coverImage
    ? `<img src="${escapeHtml(buildSanityImageUrl(resource.coverImage, 720))}" alt="" loading="lazy" />`
    : `<span class="book-cover-type">${escapeHtml(resourceTypeLabel(resource))}</span>
       <span class="book-cover-title">${escapeHtml(resource.title)}</span>
       <span class="book-cover-author">${escapeHtml(resource.authorCreator || "")}</span>`;
  return `<li class="shelf-item" style="--book-delay: ${Math.min(index, 5) * 65}ms">
    <a class="shelf-link" href="/library/${encodeURIComponent(resource.slug)}" data-resource="${escapeHtml(resource.slug)}" aria-label="Open ${escapeHtml(resource.title)}">
      <span class="book-stage" aria-hidden="true">
        <span class="book-object"><span class="book-face${resource.coverImage ? "" : " book-face-fallback"}">${cover}</span></span>
      </span>
      <span class="shelf-caption">
        <span class="shelf-type">${escapeHtml(resourceTypeLabel(resource))}${resource.createdByMe ? " · My work" : ""}</span>
        <span class="shelf-title">${escapeHtml(resource.title)}</span>
        ${resource.authorCreator ? `<span class="shelf-author">${escapeHtml(resource.authorCreator)}</span>` : ""}
        ${resource.status ? `<span class="shelf-status" data-status="${statusKey(resource.status)}">${escapeHtml(resource.status)}</span>` : ""}
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
  return `
    <main class="index-page library-shelf-page">
      <header class="index-intro index-enter">
        <h1>library</h1>
        <p>what I’m reading, learning, and creating. A closer look at the work behind the profile.</p>
      </header>
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

function renderResourceDetail(resource, notes, { preview = false, loadingNotes = false } = {}) {
  if (!resource) {
    setPageTitle("Resource Not Found");
    return renderNotFound("That resource is not on this shelf.", "/library/", "Back to the Library");
  }

  if (!preview) setPageTitle(`${resource.title} — Learning Library`);
  const status = resource.status || "Want to Learn";
  const externalUrl = safeHref(resource.externalUrl, ['http:', 'https:']);
  const reveal = preview ? "" : "reveal-on-scroll";
  const thoughts = resource.personalSummary?.length
    ? `<section class="learning-detail-section ${reveal}">
        <h2>My thoughts</h2>
        <div class="article-body">${renderPortableText(resource.personalSummary)}</div>
      </section>`
    : "";
  const takeaways = resource.keyTakeaways?.length
    ? `<section class="learning-detail-section ${reveal}">
        <h2>Key takeaways</h2>
        <ul class="takeaway-list">${resource.keyTakeaways.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
      </section>`
    : "";

  return `
    <${preview ? "div" : "main"} class="learning-page resource-detail">
      ${preview ? "" : `<a class="detail-back" href="/library/">← Learning Library</a>`}
      <div class="resource-detail-grid">
        ${renderCover(resource, `resource-detail-cover ${reveal}`)}
        <article class="resource-detail-copy ${reveal}">
          <div class="resource-card-topline">
            <span class="resource-type-badge">${escapeHtml(resourceTypeLabel(resource))}${resource.createdByMe ? " · My work" : ""}</span>
            <span class="learning-status" data-status="${statusKey(status)}">${escapeHtml(status)}</span>
          </div>
          <${preview ? "h2" : "h1"} class="learning-detail-title" ${preview ? 'id="library-reader-title"' : ""}>${escapeHtml(resource.title)}</${preview ? "h2" : "h1"}>
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
      ${thoughts}
      ${takeaways}
      <section class="learning-detail-section ${reveal}" aria-labelledby="resourceNotesTitle">
        <h2 id="resourceNotesTitle">Notes From This Resource</h2>
        ${
          notes.length
            ? `<ul class="index-list">${notes.map(renderRelatedNote).join("")}</ul>`
            : `<p class="index-empty" role="status">${loadingNotes ? "Loading related notes…" : "No notes yet."}</p>`
        }
      </section>
    </${preview ? "div" : "main"}>
  `;
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
    renderDetail: (resource, notes, options = {}) => renderResourceDetail(resource, notes, { ...options, preview: true }),
  });
}

async function initializeLibrary() {
  try {
    if (resourceSlug) {
      const { resource, notes } = await loadLearningResource(resourceSlug);
      renderPage(renderResourceDetail(resource, notes));
      return;
    }

    const cached = readCache("resources");
    currentResources = cached ?? [];
    setPageTitle("Learning Library");
    renderPage(renderLibrary(cached ?? [], { pending: !cached }));

    const resources = await loadLearningResources();
    writeCache("resources", resources);
    currentResources = resources;
    if (JSON.stringify(cached) !== JSON.stringify(resources)) {
      const reader = document.querySelector(".library-reader[open]");
      if (reader) reader.addEventListener("close", () => {
        const selectedSlug = reader.dataset.resource;
        renderPage(renderLibrary(resources));
        [...app.querySelectorAll('[data-resource]')].find(link => link.dataset.resource === selectedSlug)?.focus({ preventScroll: true });
      }, { once: true });
      else renderPage(renderLibrary(resources));
    }
  } catch {
    if (!resourceSlug && currentResources.length) return;
    renderPage(renderNotFound("The Library could not be loaded right now. Please try again shortly.", "/library/", "Try the Library again"));
  }
}

initializeLibrary();
