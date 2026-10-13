import "./style.css";
// Not used by the homepage itself, but keeps writing.css in the CSS chunk shared
// by every page; dropping it reorders the cascade and changes the Library shelf.
import "./writing.css";
import "./homeRefinements.css";
import { initializeMarketTicker } from "./lib/marketTicker.js";
import { initializeNavPrefetch, readCache, sameContent, writeCache } from "./lib/pageData.js";
import { initializePokemonRelease } from "./lib/pokemonRelease.js";
import { createCardPortrait } from "./lib/cardPortrait.js";
import { initializeSumlinoCharacter } from "./lib/sumlinoCharacter.js";
import { syncHeaderOffset } from "./lib/pageUi.js";
import { selectHighlights } from "./lib/highlights.js";
import { buildNowItems } from "./lib/nowStrip.js";
import { activityDays, bookLoop, streak } from "./lib/learningLoop.js";
import { relativeDay, renderGlowBar } from "./lib/loopUi.js";
import { initializeMobileNav } from "./lib/mobileNav.js";
import { renderSocialLinks } from "./lib/siteChrome.js";
import {
  buildSanityImageUrl,
  escapeHtml,
  loadArticleSummaries,
  loadLearningResources,
  loadNoteSummaries,
} from "./lib/sanity.js";

const app = document.querySelector("#app");
// Keep the timeline available in code while its homepage entry is on hold.
const showTimelineLink = false;

function renderHomeRows(items, hrefFor, state = "ready") {
  if (state === "pending") {
    return `<ul class="highlights-list highlights-pending" aria-busy="true"><li><span></span></li><li><span></span></li><li><span></span></li></ul><p class="visually-hidden" role="status">Loading…</p>`;
  }
  if (state === "error" && !items.length) return `<p class="highlights-empty is-visible" role="status">Couldn’t load right now. Please try again shortly.</p>`;
  if (!items.length) return `<p class="highlights-empty reveal-on-scroll">Nothing published yet.</p>`;

  return `
    <ul class="highlights-list">
      ${items
        .map(
          (item, index) => `
            <li>
              <a class="highlights-row reveal-on-scroll" href="${hrefFor(item)}" style="--reveal-delay: ${90 + index * 90}ms">
                <span class="highlights-row-title">${escapeHtml(item.title)}</span>
                <time class="highlights-row-meta"${item.publishedAt ? ` datetime="${escapeHtml(String(item.publishedAt))}"` : ""}>${escapeHtml(item.displayDate)}</time>
              </a>
            </li>
          `
        )
        .join("")}
    </ul>
  `;
}

const cachedArticles = readCache("articles");
const featuredWritingCards = renderHomeRows(
  selectHighlights(cachedArticles ?? []),
  (article) => `/writing/${encodeURIComponent(article.slug)}`,
  cachedArticles ? "ready" : "pending"
);
const cachedNotes = readCache("notes");
const cachedResources = readCache("resources");

// What Nick is doing right now, from the same data the other pages use.
const nowData = { resources: cachedResources ?? [], notes: cachedNotes ?? [], articles: cachedArticles ?? [] };
function renderNowFeature(item) {
  const resource = nowData.resources.find((entry) => entry.slug === item.slug);
  const loop = resource ? bookLoop(resource, nowData.notes) : null;
  const detail = [
    item.progress ? `${item.progress}% complete` : "Just started",
    loop?.entries.length ? `Next: ${loop.nextStep}` : "",
    loop?.lastStep ? `${loop.lastStep.step} ${relativeDay(loop.lastStep.day)}` : "",
  ].filter(Boolean);
  return `
    <a class="now-feature" href="${escapeHtml(item.href)}">
      ${item.cover
        ? `<img class="now-cover" src="${escapeHtml(buildSanityImageUrl(item.cover, 120))}" alt="" width="44" height="66" loading="lazy" />`
        : `<span class="now-cover now-cover--empty" aria-hidden="true"></span>`}
      <span class="now-feature-copy">
        <span class="now-label">${escapeHtml(item.label)}</span>
        <strong class="now-feature-title">${escapeHtml(item.title)}</strong>
        ${renderGlowBar(Math.max(2, item.progress) / 100, "now-bar")}
        <span class="now-feature-meta">${detail.map(escapeHtml).join('<span aria-hidden="true"> · </span>')}</span>
      </span>
      <span class="now-arrow" aria-hidden="true">→</span>
    </a>`;
}

function renderNowStrip() {
  const items = buildNowItems(nowData);
  if (!items.length) return "";
  const feature = items[0].kind === "learning" ? items[0] : null;
  const rest = feature ? items.slice(1) : items;
  const days = streak(activityDays(nowData.resources, nowData.notes));
  return `
    <section class="now-card" aria-labelledby="nowTitle">
      <div class="now-card-head">
        <span class="now-live" aria-hidden="true"></span>
        <h2 class="now-card-title" id="nowTitle">Right now</h2>
        ${days ? `<span class="now-streak"><strong>${days}</strong>-day streak</span>` : ""}
      </div>
      ${feature ? renderNowFeature(feature) : ""}
      ${rest.length ? `<ul class="now-list">${rest.map((item) => `
        <li><a class="now-row" href="${escapeHtml(item.href)}">
          <span class="now-label">${escapeHtml(item.label)}</span>
          <span class="now-row-title">${escapeHtml(item.title)}</span>
          ${item.meta ? `<span class="now-row-meta">${escapeHtml(item.meta)}</span>` : ""}
        </a></li>`).join("")}</ul>` : ""}
    </section>
  `;
}
function refreshNowStrip() {
  const mount = document.getElementById("nowStrip");
  const html = renderNowStrip();
  if (mount && mount.innerHTML !== html) mount.innerHTML = html;
}
const featuredNotes = renderHomeRows(
  selectHighlights(cachedNotes ?? []),
  (note) => `/notes/${encodeURIComponent(note.slug)}`,
  cachedNotes ? "ready" : "pending"
);

app.innerHTML = `
  <a class="skip-link" href="#main-content">Skip to content</a>
  <header class="site-header">
    <div class="header-left">
      <a class="wordmark" href="/">Nicholas Thomas</a>
      <nav aria-label="Main navigation">
        <a href="#home" aria-current="page">Home</a>
        <a href="#about">About</a>
        <a href="/writing/">Musings</a>
        <a href="/library/">Library</a>
        <a href="/notes/">TIL</a>
      </nav>
    </div>
    <div class="market-strip" role="region" aria-label="Market prices">
      <div class="ticker-track" id="tickerTrack"></div>
    </div>
    <div class="social-icons" role="group" aria-label="Social links">
      ${renderSocialLinks()}
    </div>
  </header>

  <main id="main-content" tabindex="-1">
    <section class="hero" id="home">
      <div class="pokemon-walker" id="pokemonWalker" aria-hidden="true">
        <img id="pokemonSprite" alt="" />
      </div>
      <div class="hero-inner">
        <div class="portrait-stage">
          <button class="portrait-shell" type="button"><span class="visually-hidden portrait-shell-name">Shuffle Nicholas Thomas’s portrait cards</span>
            <span class="portrait-deck" aria-hidden="true">
              ${[
                { rank: 'A', suit: '♠', color: 'aqua' },
                { rank: 'Q', suit: '♥', color: 'red' },
                { rank: 'K', suit: '♣', color: 'aqua' },
                { rank: 'J', suit: '♦', color: 'red' },
                { rank: 'JOKER', suit: '', color: 'aqua' },
              ].map(({ rank, suit, color }, index) => `
                <span class="portrait-card${index === 4 ? ' portrait-card--photo' : ''}" style="--card-index: ${index}">
                  <span class="portrait-card-back"><span class="card-monogram">NT</span></span>
                  <span class="portrait-card-front card-face--${color}">
                    <span class="card-corner${index === 4 ? ' card-corner--joker' : ''}">${rank}<span>${suit}</span></span>
                    ${index === 4
                      ? '<span class="joker-photo-frame"><img src="/nick-pixel-source.jpg" alt="" id="portraitSource" /></span>'
                      : `<span class="card-face-center">${rank}<span>${suit}</span></span>`}
                    <span class="card-corner card-corner--bottom${index === 4 ? ' card-corner--joker' : ''}">${rank}<span>${suit}</span></span>
                  </span>
                </span>
              `).join('')}
            </span>
          </button>
        </div>
        <div class="hero-copy">
          <h1 class="hero-intro" aria-label="Hello, Nick Here."><span aria-hidden="true"><span class="intro-before">Hello, </span><span class="intro-name">Nick</span><span class="intro-after"> Here.</span><span class="intro-cursor"></span></span></h1>
          <p class="hero-bio">
            I do financial planning and analysis for HVAC businesses, then probably spend too much of my free time testing trading ideas and tinkering with AI tools and automations, with some time left to recharge.
          </p>
          <div class="hero-actions">
            <a class="contact-action" href="mailto:nickthomasfx@gmail.com">Contact me</a>
            ${showTimelineLink ? '<a class="contact-action timeline-action" href="/timeline/" aria-label="Explore my timeline">My timeline <span aria-hidden="true">→</span></a>' : ''}
          </div>
          <div id="nowStrip">${renderNowStrip()}</div>
        </div>
      </div>
    </section>

    <section class="about-section" id="about">
      <div class="section-heading reveal-on-scroll">
        <h2>about me</h2>
        <span></span>
      </div>
      <div class="about-layout">
        <article class="about-copy reveal-on-scroll">
          <p>
            I work in <strong>financial planning</strong> for HVAC businesses,
            building models, forecasts, and revenue projections from the assumptions
            that drive real operating decisions.
          </p>
          <p>
            Outside of work, I stay close to markets and technology. I am continuing
            to develop my trading framework around index futures, mainly
            <strong>NQ, ES, and YM</strong>, while studying AI, machine learning, and
            automation as tools for better analysis.
          </p>
          <p>
            I am also studying for the <strong>CMA</strong> (Certified Management
            Accountant) certification to keep sharpening how I think about finance,
            strategy, and business performance.
          </p>
          <p>
            Some of that same tinkering has turned into a project for accountants
            and CPAs called
            <span class="redacted-wrap">
              <button
                type="button"
                class="redacted-mark"
                aria-expanded="false"
                aria-controls="sumlino-teaser"
                aria-label="redacted: preview Sumlino, a project by Nick"
              >
                <span class="redacted-label" aria-hidden="true">redacted</span>
                <span class="redacted-brand" aria-hidden="true">Sumlino</span>
              </button>

            </span>
            that takes the month-end recon grind off their plate so they can
            keep the judgment calls.
          </p>
          <div class="about-focus-list" role="list" aria-label="Current focus areas">
            <span role="listitem" style="--focus-delay: 120ms">Financial modeling</span>
            <span role="listitem" style="--focus-delay: 240ms">CMA prep</span>
            <span role="listitem" style="--focus-delay: 360ms">Student <small>(always learning)</small></span>
            <span role="listitem" style="--focus-delay: 480ms">AI technology + workflows</span>
            <span role="listitem" style="--focus-delay: 600ms">Trading</span>
            <span role="listitem" style="--focus-delay: 720ms">Basketball</span>
          </div>
        </article>
        <figure class="about-portrait reveal-on-scroll">
          <img
            src="/nick-about.webp"
            alt="Nick and his girlfriend taking a mirror selfie"
            width="471"
            height="1024"
            loading="lazy"
            decoding="async"
          />
        </figure>
      </div>
    </section>

    <section class="highlights-section" id="til">
      <div class="section-heading reveal-on-scroll">
        <h2>today i learned</h2>
        <span></span>
      </div>
      <p class="highlights-label reveal-on-scroll">highlights</p>
      <div id="latestLearningNote">${featuredNotes}</div>
      <a class="highlights-more reveal-on-scroll" href="/notes/">all notes</a>
    </section>

    <section class="highlights-section" id="writing">
      <div class="section-heading reveal-on-scroll">
        <h2>musings</h2>
        <span></span>
      </div>
      <p class="highlights-label reveal-on-scroll">highlights</p>
      <div id="featuredWritingGrid">${featuredWritingCards}</div>
      <a class="highlights-more reveal-on-scroll" href="/writing/">all musings</a>
    </section>
  </main>

  <footer class="site-footer">
    <p>Built by Nicholas Thomas. All rights reserved.</p>
  </footer>
`;

// Decorative modules must never block the page: content is revealed first,
// and a failure here (e.g. an old browser without the Web Animations API)
// leaves a static portrait instead of hidden sections.
function safely(label, start, fallback) {
  try {
    return start();
  } catch (error) {
    console.warn(`${label} unavailable`, error);
    return fallback;
  }
}

const tickerTrack = document.getElementById("tickerTrack");
safely("Market ticker", () => initializeMarketTicker(tickerTrack, import.meta.env.VITE_MARKET_DATA_ENDPOINT || "/api/market-data"));

const revealItems = document.querySelectorAll(".reveal-on-scroll");
const showAll = { observe: (item) => item.classList.add("is-visible"), unobserve() {} };
const revealObserver = !("IntersectionObserver" in window) ? showAll : new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
        revealObserver.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.18 }
);

revealItems.forEach((item) => revealObserver.observe(item));

const focusList = document.querySelector(".about-focus-list");
const focusObserver = !("IntersectionObserver" in window) ? showAll : new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
        focusObserver.unobserve(entry.target);
      }
    });
  },
  {
    threshold: 0.35,
    rootMargin: "0px 0px -8% 0px",
  }
);

focusObserver.observe(focusList);

const hero = document.querySelector(".hero");
const portraitShell = document.querySelector(".portrait-shell");
const cardPortrait = safely("Card portrait", () => createCardPortrait({
  hero,
  image: document.getElementById("portraitSource"),
  shell: portraitShell,
}), { disturb() {}, pause() {}, resume() {} });

initializeMobileNav();
syncHeaderOffset();
safely("Sumlino preview", initializeSumlinoCharacter);

// The portrait only shuffles with motion allowed; say so to assistive tech.
const portraitMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
function syncPortraitLabel() {
  portraitShell.querySelector(".portrait-shell-name").textContent = portraitMotion.matches ? "Nicholas Thomas’s portrait card" : "Shuffle Nicholas Thomas’s portrait cards";
  if (portraitMotion.matches) portraitShell.setAttribute("aria-disabled", "true");
  else portraitShell.removeAttribute("aria-disabled");
}
syncPortraitLabel();
portraitMotion.addEventListener("change", syncPortraitLabel);

function fillHomeList(id, html) {
  const mount = document.getElementById(id);
  if (!mount) return;
  mount.innerHTML = html;
  mount.querySelectorAll(".reveal-on-scroll").forEach((item) => revealObserver.observe(item));
}

initializeNavPrefetch();

loadLearningResources()
  .then((resources) => {
    writeCache("resources", resources);
    nowData.resources = resources;
    refreshNowStrip();
  })
  .catch(() => {});

loadArticleSummaries()
  .then((articles) => {
    writeCache("articles", articles);
    nowData.articles = articles;
    refreshNowStrip();
    const picks = selectHighlights(articles);
    if (cachedArticles && sameContent(selectHighlights(cachedArticles), picks)) return;
    fillHomeList(
      "featuredWritingGrid",
      renderHomeRows(picks, (article) => `/writing/${encodeURIComponent(article.slug)}`)
    );
  })
  .catch(() => {
    if (!cachedArticles) fillHomeList("featuredWritingGrid", renderHomeRows([], () => "/writing/", "error"));
  });

loadNoteSummaries()
  .then((notes) => {
    writeCache("notes", notes);
    nowData.notes = notes;
    refreshNowStrip();
    const picks = selectHighlights(notes);
    if (cachedNotes && sameContent(selectHighlights(cachedNotes), picks)) return;
    fillHomeList(
      "latestLearningNote",
      renderHomeRows(picks, (note) => `/notes/${encodeURIComponent(note.slug)}`)
    );
  })
  .catch(() => {
    if (!cachedNotes) fillHomeList("latestLearningNote", renderHomeRows([], () => "/notes/", "error"));
  });

function getOverlap(a, b) {
  const x = Math.min(a.right, b.right) - Math.max(a.left, b.left);
  const y = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
  return x > 0 && y > 0 ? { x, y } : null;
}

function disturbPortraitOnWalkerOverlap(walkerRect) {
  const portraitRect = portraitShell.getBoundingClientRect();
  const overlap = getOverlap(walkerRect, {
    left: portraitRect.left,
    top: portraitRect.top,
    right: portraitRect.right,
    bottom: portraitRect.bottom,
  });
  if (!overlap) return;

  const heroRect = hero.getBoundingClientRect();
  cardPortrait.disturb(
    walkerRect.left + walkerRect.width / 2 - heroRect.left,
    walkerRect.top + walkerRect.height / 2 - heroRect.top,
    136
  );
}

safely("Pokemon", () => initializePokemonRelease({
  onMove(rect) {
    disturbPortraitOnWalkerOverlap(rect);
  },
}));

function handleAnimationVisibility() {
  if (document.hidden) {
    cardPortrait.pause();
    return;
  }
  cardPortrait.resume();
}

document.addEventListener("visibilitychange", handleAnimationVisibility);

// Keep the accessible heading complete while its visual text types once.
const headlineMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const headlineParts = [
  [document.querySelector('.intro-before'), 'Hello, '],
  [document.querySelector('.intro-name'), 'Nick'],
  [document.querySelector('.intro-after'), ' Here.'],
];
let headlineTimer;
let headlineIndex = 0;
const headlineLength = headlineParts.reduce((total, [, text]) => total + text.length, 0);
function paintHeadline(count) {
  for (const [node, text] of headlineParts) {
    const length = Math.max(0, Math.min(count, text.length));
    node.textContent = text.slice(0, length).replaceAll(' ', '\u00a0');
    count -= text.length;
  }
}
function typeHeadline() {
  paintHeadline(++headlineIndex);
  if (headlineIndex < headlineLength) {
    headlineTimer = window.setTimeout(typeHeadline, headlineIndex === 6 ? 180 : 80);
  }
}
if (headlineMotion.matches) paintHeadline(headlineLength);
else {
  paintHeadline(0);
  headlineTimer = window.setTimeout(typeHeadline, 250);
}
headlineMotion.addEventListener('change', () => {
  clearTimeout(headlineTimer);
  paintHeadline(headlineLength);
});
