import { toHTML } from "@portabletext/to-html";
import { safeHref } from "./safeUrl.js";

const projectId = import.meta.env.VITE_SANITY_PROJECT_ID || "vzrug3c0";
const dataset = import.meta.env.VITE_SANITY_DATASET || "production";

const articleQuery = `
  *[
    _type == "article" &&
    defined(slug.current) &&
    defined(publishedAt)
  ] | order(publishedAt desc) {
    _id,
    title,
    "slug": slug.current,
    category,
    excerpt,
    publishedAt,
    readTime,
    featured,
    views,
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
  }
`;

const learningResourceFields = `
  _id,
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
  displayOrder
`;

const learningNoteFields = `
  _id,
  title,
  "slug": slug.current,
  publishedAt,
  body,
  category,
  tags,
  featured,
  views,
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
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function estimateReadTime(body = []) {
  const wordCount = body
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
  return body
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
  return toHTML(body, {
    components: {
      types: {
        image: ({ value }) => {
          if (!value?.url) return "";
          const alt = escapeHtml(value.alt || "Article image");
          const caption = value.caption
            ? `<figcaption>${escapeHtml(value.caption)}</figcaption>`
            : "";
          return `<figure><img src="${escapeHtml(value.url)}" alt="${alt}" loading="lazy" />${caption}</figure>`;
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

export async function loadPublishedArticles() {
  const documents = (await fetchSanity(articleQuery)) ?? [];

  return documents.map((article) => {
    const minutes = Number(article.readTime) || estimateReadTime(article.body);
    return {
      ...article,
      views: Number(article.views) || 0,
      displayDate: formatPublishedDate(article.publishedAt),
      readTime: `${minutes} min read`,
      bodyHtml: renderPortableText(article.body),
    };
  });
}

async function fetchSanity(query, params = {}) {
  const endpoint = new URL(
    `https://${projectId}.api.sanity.io/v2026-08-23/data/query/${dataset}`
  );
  endpoint.searchParams.set("query", query);
  endpoint.searchParams.set("perspective", "published");

  Object.entries(params).forEach(([name, value]) => {
    endpoint.searchParams.set(`$${name}`, JSON.stringify(value));
  });

  const response = await fetch(endpoint, {
    headers: { Accept: "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(5000),
  });

  if (!response.ok) {
    throw new Error(`Sanity returned ${response.status}`);
  }

  const payload = await response.json();
  return payload.result;
}

function normalizeLearningNote(note) {
  const minutes = Number(note.readTime) || estimateReadTime(note.body);
  return {
    ...note,
    views: Number(note.views) || 0,
    displayDate: formatPublishedDate(note.publishedAt),
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
        defined(slug.current) &&
        relatedResource->slug.current == $slug
      ] | order(publishedAt desc) {
        ${learningNoteFields}
      }
    }
  `;
  const result = await fetchSanity(query, { slug });
  return {
    resource: result?.resource ?? null,
    notes: (result?.notes ?? []).map(normalizeLearningNote),
  };
}

export async function loadLearningNotes() {
  const query = `
    *[
      _type == "learningNote" &&
      defined(slug.current) &&
      defined(publishedAt)
    ] | order(publishedAt desc) {
      ${learningNoteFields}
    }
  `;
  return ((await fetchSanity(query)) ?? []).map(normalizeLearningNote);
}

export async function loadLearningNote(slug) {
  const query = `
    *[
      _type == "learningNote" &&
      slug.current == $slug
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

export async function loadLatestLearningNote() {
  const query = `
    *[
      _type == "learningNote" &&
      defined(slug.current) &&
      defined(publishedAt)
    ] | order(publishedAt desc) [0] {
      ${learningNoteFields}
    }
  `;
  const note = await fetchSanity(query);
  return note ? normalizeLearningNote(note) : null;
}
