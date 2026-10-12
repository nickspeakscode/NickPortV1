import { toHTML } from "@portabletext/to-html";
import { safeHref } from "./safeUrl.js";

const projectId = import.meta.env.VITE_SANITY_PROJECT_ID || "vzrug3c0";
const dataset = import.meta.env.VITE_SANITY_DATASET || "production";

// Counted by /api/record-view in separate viewcount-<id> documents.
const viewsField = `"views": coalesce(*[_type == "viewCount" && _id == "viewcount-" + ^._id][0].count, 0)`;

// Published, dated, and not scheduled for later. Ordered by the real instant
// (stored strings mix UTC and offset forms, so string order is not reliable).
const publishedFilter = `defined(slug.current) && defined(publishedAt) && dateTime(publishedAt) <= dateTime(now())`;
const newestFirst = `order(dateTime(publishedAt) desc)`;

// Lists only need what a row shows; bodies load on the detail page.
const articleSummaryFields = `
  _id,
  title,
  "slug": slug.current,
  category,
  excerpt,
  publishedAt,
  readTime,
  featured,
  ${viewsField}
`;

const articleDetailFields = `
  ${articleSummaryFields},
  "coverImage": coverImage.asset->url,
  body[]{
    ...,
    _type == "image" => {
      "url": asset->url,
      alt,
      caption
    },
    _type == "video" => {
      "url": asset->url,
      "mimeType": asset->mimeType,
      title,
      caption,
      "posterUrl": poster.asset->url
    }
  }
`;

const learningResourceFields = `
  _id,
  _createdAt,
  title,
  "slug": slug.current,
  resourceType,
  customResourceType,
  createdByMe,
  authorCreator,
  "coverImage": coverImage.asset->url,
  "coverAlt": coverImage.alt,
  category,
  tags,
  status,
  progress,
  rating,
  startDate,
  finishDate,
  description,
  personalSummary,
  keyTakeaways,
  externalUrl,
  featured,
  displayOrder,
  studyLog[]{ _key, date, step, where, minutes, entry }
`;

const noteSummaryFields = `
  _id,
  title,
  "slug": slug.current,
  publishedAt,
  category,
  featured,
  ${viewsField},
  "resourceSlug": relatedResource->slug.current
`;

const learningNoteFields = `
  ${noteSummaryFields},
  body,
  tags,
  readTime,
  "relatedResource": relatedResource->{
    _id,
    title,
    "slug": slug.current,
    resourceType,
    authorCreator,
    "coverImage": coverImage.asset->url,
    "coverAlt": coverImage.alt
  }
`;

export function escapeHtml(value = "") {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function estimateReadTime(body = []) {
  const wordCount = (body ?? [])
    .filter((block) => block?._type === "block")
    .flatMap((block) => block.children ?? [])
    .map((child) => child.text ?? "")
    .join(" ")
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;

  return Math.max(1, Math.ceil(wordCount / 220));
}

export function formatPublishedDate(value, fallback = "Published") {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

export function portableTextToPlainText(body = []) {
  return (body ?? [])
    .filter((block) => block?._type === "block")
    .flatMap((block) => block.children ?? [])
    .map((child) => child.text ?? "")
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

export function createExcerpt(body = [], maxLength = 180) {
  const text = portableTextToPlainText(body);
  if (text.length <= maxLength) return text;
  const shortened = text.slice(0, maxLength + 1).replace(/\s+\S*$/, "");
  return `${shortened || text.slice(0, maxLength)}…`;
}

export function buildSanityImageUrl(url, width = 720) {
  if (!url) return "";
  const imageUrl = new URL(url);
  imageUrl.searchParams.set("auto", "format");
  imageUrl.searchParams.set("fit", "max");
  imageUrl.searchParams.set("w", String(width));
  return imageUrl.toString();
}

export function renderPortableText(body = []) {
  return toHTML(body ?? [], {
    // Unknown block types render nothing rather than a developer warning.
    onMissingComponent: false,
    components: {
      types: {
        image: ({ value }) => {
          if (!value?.url) return "";
          const alt = escapeHtml(value.alt || "Article image");
          const caption = value.caption
            ? `<figcaption>${escapeHtml(value.caption)}</figcaption>`
            : "";
          return `<figure><img src="${escapeHtml(buildSanityImageUrl(value.url, 1400))}" alt="${alt}" loading="lazy" decoding="async" />${caption}</figure>`;
        },
        video: ({ value }) => {
          if (!value?.url) return "";
          const title = escapeHtml(value.title || "Article video");
          const poster = value.posterUrl ? ` poster="${escapeHtml(value.posterUrl)}"` : "";
          const mimeType = value.mimeType
            ? ` type="${escapeHtml(value.mimeType)}"`
            : "";
          const caption = value.caption
            ? `<figcaption>${escapeHtml(value.caption)}</figcaption>`
            : "";
          return `<figure class="article-video"><video controls preload="metadata"${poster} aria-label="${title}"><source src="${escapeHtml(value.url)}"${mimeType} />Your browser does not support embedded video.</video>${caption}</figure>`;
        },
      },
      marks: {
        link: ({ children, value }) => {
          const href = safeHref(value?.href);
          if (!href) return children;
          const external = /^(https?:)?\/\//i.test(href);
          return `<a href="${escapeHtml(href)}"${external ? ' target="_blank" rel="noreferrer"' : ""}>${children}</a>`;
        },
      },
    },
  });
}

function normalizeArticleSummary(article) {
  return {
    ...article,
    views: Number(article.views) || 0,
    displayDate: formatPublishedDate(article.publishedAt),
  };
}

export async function loadArticleSummaries() {
  const query = `*[_type == "article" && ${publishedFilter}] | ${newestFirst} { ${articleSummaryFields} }`;
  return ((await fetchSanity(query)) ?? []).map(normalizeArticleSummary);
}

export async function loadArticle(slug) {
  const query = `*[_type == "article" && slug.current == $slug && ${publishedFilter}][0] { ${articleDetailFields} }`;
  const article = await fetchSanity(query, { slug });
  if (!article) return null;
  const minutes = Number(article.readTime) || estimateReadTime(article.body);
  return {
    ...normalizeArticleSummary(article),
    readTime: `${minutes} min read`,
    bodyHtml: renderPortableText(article.body),
  };
}

// AbortSignal.timeout is missing before Safari 16.
function timeoutSignal(ms) {
  if (typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function") return AbortSignal.timeout(ms);
  const controller = new AbortController();
  setTimeout(() => controller.abort(), ms);
  return controller.signal;
}

async function fetchSanity(query, params = {}) {
  const endpoint = new URL(
    // The API CDN serves published content and reflects edits within seconds.
    `https://${projectId}.apicdn.sanity.io/v2026-08-23/data/query/${dataset}`
  );
  endpoint.searchParams.set("query", query);
  endpoint.searchParams.set("perspective", "published");

  Object.entries(params).forEach(([name, value]) => {
    endpoint.searchParams.set(`$${name}`, JSON.stringify(value));
  });

  const response = await fetch(endpoint, {
    headers: { Accept: "application/json" },
    cache: "no-store",
    signal: timeoutSignal(5000),
  });

  if (!response.ok) {
    throw new Error(`Sanity returned ${response.status}`);
  }

  const payload = await response.json();
  return payload.result;
}

function normalizeNoteSummary(note) {
  return {
    ...note,
    views: Number(note.views) || 0,
    displayDate: formatPublishedDate(note.publishedAt),
  };
}

function normalizeLearningNote(note) {
  const minutes = Number(note.readTime) || estimateReadTime(note.body);
  return {
    ...normalizeNoteSummary(note),
    readTimeLabel: `${minutes} min read`,
    excerpt: createExcerpt(note.body),
    bodyHtml: renderPortableText(note.body),
  };
}

export async function loadLearningResources() {
  const query = `
    *[
      _type == "learningResource" &&
      defined(slug.current)
    ] | order(coalesce(displayOrder, 9999) asc, title asc) {
      ${learningResourceFields}
    }
  `;
  return (await fetchSanity(query)) ?? [];
}

export async function loadLearningResource(slug) {
  const query = `
    {
      "resource": *[
        _type == "learningResource" &&
        slug.current == $slug
      ][0] {
        ${learningResourceFields}
      },
      "notes": *[
        _type == "learningNote" &&
        ${publishedFilter} &&
        relatedResource->slug.current == $slug
      ] | ${newestFirst} {
        ${noteSummaryFields}
      }
    }
  `;
  const result = await fetchSanity(query, { slug });
  return {
    resource: result?.resource ?? null,
    notes: (result?.notes ?? []).map(normalizeNoteSummary),
  };
}

export async function loadNoteSummaries() {
  const query = `*[_type == "learningNote" && ${publishedFilter}] | ${newestFirst} { ${noteSummaryFields} }`;
  return ((await fetchSanity(query)) ?? []).map(normalizeNoteSummary);
}

export async function loadLearningNote(slug) {
  const query = `
    *[
      _type == "learningNote" &&
      slug.current == $slug &&
      ${publishedFilter}
    ][0] {
      ${learningNoteFields}
    }
  `;
  const note = await fetchSanity(query, { slug });
  return note ? normalizeLearningNote(note) : null;
}

export function recordPageView(type, slug) {
  if (!slug || typeof window === "undefined") return;

  const key = `nt-viewed:${type}:${slug}`;
  try {
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");
  } catch {
    // Private mode should still attempt a single increment.
  }

  fetch("/api/record-view", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type, slug }),
    keepalive: true,
  }).catch(() => {});
}
