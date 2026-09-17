import "./style.css";
import "./writing.css";
import "./homeRefinements.css";
import { initializeMarketTicker } from "./lib/marketTicker.js";
import { initializeIndexPointer, initializeNavPrefetch, readCache, writeCache } from "./lib/pageData.js";
import { initializePokemonRelease } from "./lib/pokemonRelease.js";
import { createCardPortrait } from "./lib/cardPortrait.js";
import { syncHeaderOffset } from "./lib/pageUi.js";
import { initializeMobileNav } from "./lib/mobileNav.js";
import {
  escapeHtml,
  loadLearningNotes,
  loadPublishedArticles,
} from "./lib/sanity.js";

const app = document.querySelector("#app");
function selectHighlights(source) {
  return [...source]
    .sort((left, right) => {
      const views = (Number(right.views) || 0) - (Number(left.views) || 0);
      if (views) return views;
      if (Boolean(right.featured) !== Boolean(left.featured)) return right.featured ? 1 : -1;
      return new Date(right.publishedAt || 0) - new Date(left.publishedAt || 0);
    })
    .slice(0, 3);
}

function renderHomeRows(items, hrefFor) {
  if (!items.length) return `<p class="highlights-empty reveal-on-scroll">Nothing published yet.</p>`;

  return `
    <ul class="highlights-list">
      ${items
        .map(
          (item, index) => `
            <li>
              <a class="highlights-row reveal-on-scroll" href="${hrefFor(item)}" style="--reveal-delay: ${90 + index * 90}ms">
                <span class="highlights-row-title">${escapeHtml(item.title)}</span>
                <time class="highlights-row-meta">${escapeHtml(item.displayDate)}</time>
              </a>
            </li>
          `
        )
        .join("")}
    </ul>
  `;
}

const cachedArticles = (readCache("articles") ?? []).filter((article) => article && !article.sample);
const featuredWritingCards = renderHomeRows(
  selectHighlights(cachedArticles),
  (article) => `/writing/?article=${encodeURIComponent(article.slug)}`
);
const cachedNotes = readCache("notes");
const featuredNotes = renderHomeRows(
  selectHighlights(cachedNotes ?? []),
  (note) => `/notes/${encodeURIComponent(note.slug)}`
);

app.innerHTML = `
  <header class="site-header">
    <div class="header-left">
      <button class="wordmark" type="button" id="reloadSite">Nicholas Thomas</button>
      <nav aria-label="Main navigation">
        <a href="#home" aria-current="page">Home</a>
        <a href="#about">About</a>
        <a href="/writing/">Musings</a>
        <a href="/library/">Library</a>
        <a href="/notes/">TIL</a>
      </nav>
    </div>
    <div class="market-strip" aria-label="Market prices">
      <div class="ticker-track" id="tickerTrack"></div>
    </div>
    <div class="social-icons" aria-label="Social links">
      <a href="https://www.linkedin.com/in/nicktrades/" target="_blank" rel="noreferrer" aria-label="LinkedIn">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.94 8.86H3.2V20h3.74V8.86ZM5.07 7.34c1.2 0 1.95-.8 1.95-1.8-.02-1.02-.75-1.8-1.92-1.8s-1.95.78-1.95 1.8c0 1 .75 1.8 1.9 1.8h.02ZM20.85 13.62c0-3.42-1.82-5.02-4.25-5.02-1.96 0-2.84 1.08-3.33 1.84V8.86H9.53c.05 1.05 0 11.14 0 11.14h3.74v-6.22c0-.33.02-.66.12-.9.27-.66.88-1.35 1.9-1.35 1.34 0 1.88 1.02 1.88 2.52V20h3.74l-.06-6.38Z"/></svg>
      </a>
      <a href="https://www.youtube.com/@NickSpeaksFinance" target="_blank" rel="noreferrer" aria-label="YouTube">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21.62 7.3a3 3 0 0 0-2.11-2.12C17.65 4.68 12 4.68 12 4.68s-5.65 0-7.51.5A3 3 0 0 0 2.38 7.3 31.24 31.24 0 0 0 1.88 12c0 1.64.17 3.28.5 4.7a3 3 0 0 0 2.11 2.12c1.86.5 7.51.5 7.51.5s5.65 0 7.51-.5a3 3 0 0 0 2.11-2.12c.33-1.42.5-3.06.5-4.7s-.17-3.28-.5-4.7ZM9.98 15.55v-7.1L15.9 12l-5.92 3.55Z"/></svg>
      </a>
      <a href="https://x.com/nickonfinance" target="_blank" rel="noreferrer" aria-label="X">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14.42 10.27 22.13 1.3h-1.83l-6.7 7.8-5.35-7.8H2.08l8.08 11.77-8.08 9.4h1.83l7.06-8.22 5.64 8.22h6.17l-8.36-12.2Zm-2.5 2.9-.82-1.17L4.6 2.68h2.77l5.26 7.53.82 1.17 6.84 9.8h-2.77l-5.6-8.01Z"/></svg>
      </a>
      <a href="https://github.com/nickspeakscode" target="_blank" rel="noreferrer" aria-label="GitHub">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12Z"/></svg>
      </a>
      <a href="mailto:nickthomasfx@gmail.com" aria-label="Email Nicholas Thomas">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.75 5.25h16.5A2.75 2.75 0 0 1 23 8v8a2.75 2.75 0 0 1-2.75 2.75H3.75A2.75 2.75 0 0 1 1 16V8a2.75 2.75 0 0 1 2.75-2.75Zm0 1.75a1 1 0 0 0-.72.3L12 13.66l8.97-6.36a1 1 0 0 0-.72-.3H3.75Zm17.5 2.12-8.74 6.2a.88.88 0 0 1-1.02 0l-8.74-6.2V16c0 .55.45 1 1 1h16.5c.55 0 1-.45 1-1V9.12Z"/></svg>
      </a>
      <button class="pokeball-release" id="pokeballRelease" type="button" aria-label="Release a random Pokemon">
        <img src="/pokemon/pokeball.png" alt="" />
      </button>
    </div>
  </header>

  <main>
    <section class="hero" id="home">
      <div class="pokemon-walker" id="pokemonWalker" aria-hidden="true">
        <img id="pokemonSprite" alt="" />
      </div>
      <div class="hero-inner">
        <div class="portrait-stage">
          <button class="portrait-shell" type="button" aria-label="Shuffle Nicholas Thomas’s portrait cards">
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
          <p>
            I do financial planning and analysis for HVAC businesses, then spend probably too much of my free time testing trading ideas and tinkering with AI tools and automations, with some time left to recharge.
          </p>
          <a class="contact-action" href="mailto:nickthomasfx@gmail.com">Contact me</a>
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
            I am also studying for the <strong>CMA</strong>, Certified Management
            Accountant, license to keep sharpening how I think about finance,
            strategy, and business performance.
          </p>
          <p>
            Working on a tool for accountants and CPAs called
            <span class="redacted-wrap">
              <button
                type="button"
                class="redacted-mark"
                aria-expanded="false"
                aria-controls="sumlino-teaser"
                aria-haspopup="true"
                aria-label="redacted, Sumlino preview"
              >
                redacted
              </button>
              <a
                class="redacted-popover"
                id="sumlino-teaser"
                href="https://x.com/sumlinoapp"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Sumlino on X"
                tabindex="-1"
              >
                <img
                  class="redacted-popover-logo"
                  src="/sumlino-mark.svg"
                  alt=""
                  width="64"
                  height="64"
                  decoding="async"
                />
                <span class="redacted-popover-label" aria-hidden="true">Sumlino</span>
              </a>
            </span>
            that takes the month-end recon grind off their plate so they can
            keep the judgment calls.
          </p>
          <div class="about-focus-list" aria-label="Current focus areas">
            <span style="--focus-delay: 120ms">Financial modeling</span>
            <span style="--focus-delay: 240ms">CMA prep</span>
            <span style="--focus-delay: 360ms">Student <small>(always learning)</small></span>
            <span style="--focus-delay: 480ms">AI technology + workflows</span>
            <span style="--focus-delay: 600ms">Trading</span>
            <span style="--focus-delay: 720ms">Basketball</span>
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
    <p>Built by Nick Thomas. All rights reserved.</p>
  </footer>
`;

const tickerTrack = document.getElementById("tickerTrack");
initializeMarketTicker(tickerTrack, import.meta.env.VITE_MARKET_DATA_ENDPOINT || "/api/market-data");

document.getElementById("reloadSite").addEventListener("click", () => {
  window.location.reload();
});

const hero = document.querySelector(".hero");
const portraitShell = document.querySelector(".portrait-shell");
const cardPortrait = createCardPortrait({
  hero,
  image: document.getElementById("portraitSource"),
  shell: portraitShell,
});

initializeMobileNav();
syncHeaderOffset();
initializeRedactedTeaser();

const revealItems = document.querySelectorAll(".reveal-on-scroll");
const revealObserver = new IntersectionObserver(
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
const focusObserver = new IntersectionObserver(
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

function fillHomeList(id, html) {
  const mount = document.getElementById(id);
  if (!mount) return;
  mount.innerHTML = html;
  mount.querySelectorAll(".reveal-on-scroll").forEach((item) => revealObserver.observe(item));
}

initializeNavPrefetch();
initializeIndexPointer();

loadPublishedArticles()
  .then((publishedArticles) => {
    writeCache("articles", publishedArticles);
    fillHomeList(
      "featuredWritingGrid",
      renderHomeRows(selectHighlights(publishedArticles), (article) => `/writing/?article=${encodeURIComponent(article.slug)}`)
    );
  })
  .catch(() => {
    if (!cachedArticles.length) {
      fillHomeList("featuredWritingGrid", renderHomeRows([], () => "/writing/"));
    }
  });

loadLearningNotes()
  .then((notes) => {
    writeCache("notes", notes);
    fillHomeList(
      "latestLearningNote",
      renderHomeRows(selectHighlights(notes), (note) => `/notes/${encodeURIComponent(note.slug)}`)
    );
  })
  .catch(() => {
    if (!cachedNotes?.length) fillHomeList("latestLearningNote", renderHomeRows([], () => "/notes/"));
  });

function initializeRedactedTeaser() {
  const wrap = document.querySelector(".redacted-wrap");
  const trigger = wrap?.querySelector(".redacted-mark");
  const popover = wrap?.querySelector(".redacted-popover");
  if (!wrap || !trigger || !popover) return;

  const fineHover = window.matchMedia("(hover: hover) and (pointer: fine)");
  let lastPointerType = "mouse";

  const setOpen = (open) => {
    wrap.classList.toggle("is-open", open);
    trigger.setAttribute("aria-expanded", open ? "true" : "false");
    popover.tabIndex = open ? 0 : -1;
  };

  wrap.addEventListener("pointerdown", (event) => {
    lastPointerType = event.pointerType || lastPointerType;
  });

  wrap.addEventListener("pointerenter", (event) => {
    if (event.pointerType === "touch") return;
    if (event.pointerType === "mouse" || fineHover.matches) setOpen(true);
  });

  wrap.addEventListener("pointerleave", (event) => {
    if (event.pointerType === "touch") return;
    if (wrap.contains(document.activeElement)) return;
    setOpen(false);
  });

  wrap.addEventListener("focusout", (event) => {
    if (!wrap.contains(event.relatedTarget)) setOpen(false);
  });

  trigger.addEventListener("click", (event) => {
    const keyboard = event.detail === 0;
    const touchLike =
      lastPointerType === "touch" ||
      lastPointerType === "pen" ||
      !fineHover.matches;
    if (!keyboard && !touchLike) return;
    setOpen(!wrap.classList.contains("is-open"));
  });

  document.addEventListener("pointerdown", (event) => {
    if (!wrap.contains(event.target)) setOpen(false);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || !wrap.classList.contains("is-open")) return;
    setOpen(false);
  });
}

function getOverlap(a, b) {
  const x = Math.min(a.right, b.right) - Math.max(a.left, b.left);
  const y = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
  return x > 0 && y > 0 ? { x, y } : null;
}

function disturbPortraitOnWalkerOverlap(walkerRect, velocity = { vx: 0, vy: 0 }) {
  const portraitRect = portraitShell.getBoundingClientRect();
  const overlap = getOverlap(walkerRect, {
    left: portraitRect.left,
    top: portraitRect.top,
    right: portraitRect.right,
    bottom: portraitRect.bottom,
  });
  if (!overlap) return;

  const heroRect = hero.getBoundingClientRect();
  const walkerSpeed = Math.hypot(velocity.vx, velocity.vy);
  cardPortrait.disturb(
    walkerRect.left + walkerRect.width / 2 - heroRect.left,
    walkerRect.top + walkerRect.height / 2 - heroRect.top,
    136,
    4.5 + Math.min(6, walkerSpeed * 1.6)
  );
}

initializePokemonRelease({
  onMove(rect, velocity) {
    disturbPortraitOnWalkerOverlap(rect, velocity);
  },
});

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
