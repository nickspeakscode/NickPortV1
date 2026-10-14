import { initializeIndexPointer, initializeNavPrefetch } from "./pageData.js";
import { initializePokemonRelease } from "./pokemonRelease.js";
import { initializePokedex } from "./pokedex.js";
import { syncHeaderOffset } from "./pageUi.js";
import { initializeMobileNav } from "./mobileNav.js";

function navLink(href, label, activePath) {
  const current = href === activePath ? ' aria-current="page"' : "";
  return `<a href="${href}"${current}>${label}</a>`;
}

// Shared by the homepage and interior headers.
export function renderSocialLinks() {
  return `
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
  <button class="pokedex-open" id="pokedexOpen" type="button" aria-haspopup="dialog" aria-label="Open Pokédex">
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="4" y="2.2" width="16" height="19.6" rx="2.6" fill="none" stroke="currentColor" stroke-width="1.6"/>
      <path d="M4 10h16" fill="none" stroke="currentColor" stroke-width="1.4"/>
      <circle class="pokedex-glyph-lens" cx="8.6" cy="6.2" r="2.1"/>
      <circle class="pokedex-glyph-light" cx="12.6" cy="4.9" r=".85" fill="#ff6b78"/>
      <circle class="pokedex-glyph-light" cx="15.1" cy="4.9" r=".85" fill="#f2c56d"/>
      <circle class="pokedex-glyph-light" cx="17.6" cy="4.9" r=".85" fill="#59f1d7"/>
      <rect x="7" y="12.6" width="10" height="5.8" rx="1.1" fill="none" stroke="currentColor" stroke-width="1.4"/>
    </svg>
    <span class="pokedex-badge" aria-hidden="true"></span>
  </button>
  <button class="pokeball-release" id="pokeballRelease" type="button" aria-label="Release a random Pokémon">
    <img src="/pokemon/pokeball.png" alt="" />
  </button>
  `;
}

export function renderInteriorHeader(activePath) {
  return `
    <a class="skip-link" href="#main-content">Skip to content</a>
    <header class="site-header writing-site-header">
      <div class="header-left">
        <a class="wordmark" href="/">Nicholas Thomas</a>
        <nav aria-label="Main navigation">
          ${navLink("/", "Home", activePath)}
          ${navLink("/#about", "About", activePath)}
          ${navLink("/writing/", "Musings", activePath)}
          ${navLink("/library/", "Library", activePath)}
          ${navLink("/notes/", "TIL", activePath)}
        </nav>
      </div>
      <div class="social-icons writing-socials" role="group" aria-label="Social links">
        ${renderSocialLinks()}
      </div>
      <div class="pokemon-walker" id="pokemonWalker" aria-hidden="true">
        <img id="pokemonSprite" alt="" />
      </div>
    </header>
  `;
}

export function renderSiteFooter() {
  return `
    <footer class="site-footer">
      <p>Built by Nicholas Thomas. All rights reserved.</p>
    </footer>
  `;
}

export function initializeInteriorChrome() {
  // Pages render their own <main>; give it the skip link's target.
  const main = document.querySelector("main");
  if (main) {
    main.id = "main-content";
    main.tabIndex = -1;
  }
  const stopMobileNav = initializeMobileNav();
  const stopHeaderSync = syncHeaderOffset();
  const stopPokemon = initializePokemonRelease();
  const stopPokedex = initializePokedex();
  const stopPointer = initializeIndexPointer();
  initializeNavPrefetch();

  return () => {
    stopMobileNav();
    stopHeaderSync();
    stopPokemon?.();
    stopPokedex?.();
    stopPointer?.();
  };
}
