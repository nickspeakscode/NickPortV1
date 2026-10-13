import { initializeDesktopHeader } from './desktopHeader.js';

// Canonical and share URLs always point at production, even on previews.
export const SITE_ORIGIN = "https://www.bynickthomas.com";

export function initializeRevealAnimations(root = document, { threshold = 0.12, rootMargin = "0px" } = {}) {
  const items = root.querySelectorAll(".reveal-on-scroll");

  if (!("IntersectionObserver" in window)) {
    items.forEach((item) => item.classList.add("is-visible"));
    return () => {};
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      });
    },
    { threshold, rootMargin }
  );

  items.forEach((item) => observer.observe(item));
  return () => observer.disconnect();
}

// The header is sticky, so anchor targets land underneath it. Its height is
// measured rather than hardcoded: the mobile homepage includes a ticker row,
// while interior pages use a compact single-row header.
export function syncHeaderOffset(header = document.querySelector(".site-header")) {
  if (!header) return () => {};
  const stopDesktopHeader = initializeDesktopHeader(header);

  const apply = () => {
    const height = Math.round(header.getBoundingClientRect().height);
    document.documentElement.style.setProperty("--header-height", `${height}px`);
  };

  apply();

  if (!("ResizeObserver" in window)) {
    window.addEventListener("resize", apply);
    return () => { window.removeEventListener("resize", apply); stopDesktopHeader(); };
  }

  const observer = new ResizeObserver(apply);
  observer.observe(header);
  return () => { observer.disconnect(); stopDesktopHeader(); };
}

export function getRouteSlug(section, queryName = "slug") {
  const querySlug = new URLSearchParams(window.location.search).get(queryName);
  if (querySlug) return querySlug;

  const parts = window.location.pathname.split("/").filter(Boolean);
  const sectionIndex = parts.indexOf(section);
  if (sectionIndex < 0 || !parts[sectionIndex + 1]) return "";

  try {
    return decodeURIComponent(parts[sectionIndex + 1]);
  } catch {
    return parts[sectionIndex + 1];
  }
}

export function setPageTitle(title) {
  document.title = title ? `${title} | Nicholas Thomas` : "Nicholas Thomas";
}

function ensureHead(selector, create, prepare = () => {}) {
  let element = document.head.querySelector(selector);
  if (!element) {
    element = create();
    prepare(element);
    document.head.append(element);
  }
  return element;
}

function setHeadContent(selector, value) {
  if (value) document.head.querySelector(selector)?.setAttribute("content", value);
}

// Not-found states are served with a 200 by the shared shell; keep them out of search results.
export function setNoIndex() {
  let robots = document.head.querySelector('meta[name="robots"]');
  if (!robots) {
    robots = document.createElement("meta");
    robots.name = "robots";
    document.head.append(robots);
  }
  robots.content = "noindex";
}

// Detail pages share one HTML shell, so keep the tab title, description,
// share tags and canonical URL in step with the item actually shown.
export function setPageMeta({ title, description, path } = {}) {
  setPageTitle(title);
  setHeadContent('meta[property="og:title"]', document.title);
  setHeadContent('meta[name="twitter:title"]', document.title);
  if (description) {
    setHeadContent('meta[name="description"]', description);
    setHeadContent('meta[property="og:description"]', description);
    setHeadContent('meta[name="twitter:description"]', description);
  }
  if (path) {
    const url = new URL(path, SITE_ORIGIN).href;
    ensureHead('meta[property="og:url"]', () => Object.assign(document.createElement("meta"), { content: "" }), (meta) => meta.setAttribute("property", "og:url")).setAttribute("content", url);
    ensureHead('link[rel="canonical"]', () => Object.assign(document.createElement("link"), { rel: "canonical" })).setAttribute("href", url);
  }
}
