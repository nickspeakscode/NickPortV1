import "../pokedex.css";
import { pokemonOptions } from "./pokemonRelease.js";

// The Pokedex: every Pokemon released with the Poke Ball is registered here,
// in this browser, until all of them are caught. Entries are in National
// Pokedex order; ones not caught yet show as silhouettes.
const STORE_KEY = "nt-pokedex-v1";
const TIERS = ["common", "uncommon", "rare", "legendary"];
const TIER_LABEL = { common: "Common", uncommon: "Uncommon", rare: "Rare", legendary: "Legendary" };
const BY_NUMBER = [...pokemonOptions].sort((a, b) => a.dex - b.dex);
const KNOWN = new Set(pokemonOptions.map((option) => option.name));
const TOTAL = pokemonOptions.length;
const number = (dex) => `#${String(dex).padStart(3, "0")}`;

function load() {
  try {
    const data = JSON.parse(localStorage.getItem(STORE_KEY)) ?? {};
    return { caught: data.caught ?? {}, fresh: (data.fresh ?? []).filter((name) => KNOWN.has(name)) };
  } catch {
    return { caught: {}, fresh: [] };
  }
}

function save(store) {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(store)); } catch {}
}

export function initializePokedex() {
  const button = document.getElementById("pokedexOpen");
  if (!button) return () => {};
  const badge = button.querySelector(".pokedex-badge");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  let store = load();
  let closeTimer = 0;

  const dialog = document.createElement("dialog");
  dialog.className = "pokedex";
  dialog.setAttribute("aria-labelledby", "pokedexTitle");
  const announcer = document.createElement("span");
  announcer.className = "visually-hidden";
  announcer.setAttribute("aria-live", "polite");
  document.body.append(dialog, announcer);

  const caughtCount = () => BY_NUMBER.filter((option) => store.caught[option.name]).length;

  function syncButton() {
    const count = caughtCount();
    const fresh = store.fresh.length;
    button.setAttribute("aria-label", `Open Pokédex: ${count} of ${TOTAL} caught${fresh ? `, ${fresh} new` : ""}`);
    badge.textContent = fresh ? String(Math.min(fresh, 9)) : "";
    button.classList.toggle("has-new", fresh > 0);
    button.classList.toggle("is-complete", count === TOTAL);
  }

  function render() {
    const count = caughtCount();
    const complete = count === TOTAL;
    const fresh = new Set(store.fresh);
    const fill = Math.round((count / TOTAL) * 100);
    const tiers = TIERS.map((tier) => {
      const all = BY_NUMBER.filter((option) => option.rarity === tier);
      return `<li data-tier="${tier}"><i aria-hidden="true"></i>${TIER_LABEL[tier]} <strong>${all.filter((option) => store.caught[option.name]).length}/${all.length}</strong></li>`;
    }).join("");
    const entries = BY_NUMBER.map((option, index) => {
      const caught = Boolean(store.caught[option.name]);
      const isNew = fresh.has(option.name);
      return `
        <li class="dex-entry${caught ? " is-caught" : ""}${isNew ? " is-new" : ""}" data-tier="${option.rarity}" style="--i: ${Math.min(index, 30)}">
          <span class="dex-sprite" aria-hidden="true"><img src="${option.src}" alt="" loading="lazy" decoding="async" /></span>
          <span class="dex-number">${number(option.dex)}</span>
          ${caught
            ? `<span class="dex-name">${option.name}</span><span class="visually-hidden">, ${option.label ?? TIER_LABEL[option.rarity]}, caught</span>`
            : `<span class="dex-name" aria-hidden="true">???</span><span class="visually-hidden">Not caught yet</span>`}
          ${isNew ? '<span class="dex-new" aria-hidden="true">New</span>' : ""}
        </li>`;
    }).join("");
    dialog.classList.toggle("is-complete", complete);
    return `
      <div class="pokedex-device">
        <header class="pokedex-top">
          <span class="pokedex-lens" aria-hidden="true"></span>
          <span class="pokedex-lights" aria-hidden="true"><i></i><i></i><i></i></span>
          <div class="pokedex-heading">
            <h2 id="pokedexTitle">Pokédex</h2>
            <p>${complete ? "Complete" : `Caught ${count} / ${TOTAL}`}</p>
          </div>
          <button type="button" class="pokedex-close" aria-label="Close Pokédex">×</button>
        </header>
        <div class="pokedex-progress">
          <div role="progressbar" aria-label="Pokédex completion" aria-valuemin="0" aria-valuemax="${TOTAL}" aria-valuenow="${count}">
            <span class="glow-bar" aria-hidden="true" style="--fill: ${fill}%"><span class="glow-bar-fill"${fill ? "" : " hidden"}><i></i></span></span>
          </div>
          <ul class="pokedex-tiers">${tiers}</ul>
        </div>
        <div class="pokedex-screen" role="region" aria-label="Pokédex entries" tabindex="0">
          <ul class="pokedex-grid" aria-label="Pokémon">${entries}</ul>
        </div>
        <p class="pokedex-hint">${complete
          ? "You caught them all. Every entry is filled in."
          : "Tap the Poké Ball to find more. The rarer the Pokémon, the less often it shows up."}</p>
      </div>`;
  }

  function open() {
    clearTimeout(closeTimer);
    dialog.classList.remove("is-closing");
    dialog.innerHTML = render();
    dialog.querySelector(".pokedex-close").addEventListener("click", close);
    dialog.showModal();
    // Opening the Pokedex marks the new entries as seen.
    if (store.fresh.length) {
      store.fresh = [];
      save(store);
      syncButton();
    }
  }

  function close() {
    if (!dialog.open || dialog.classList.contains("is-closing")) return;
    if (reducedMotion.matches) {
      dialog.close();
      return;
    }
    dialog.classList.add("is-closing");
    closeTimer = window.setTimeout(() => {
      dialog.classList.remove("is-closing");
      dialog.close();
    }, 180);
  }

  // A little "new entry" tag drops from the icon.
  function celebrate(option, count) {
    if (reducedMotion.matches) return;
    button.querySelector(".pokedex-pop")?.remove();
    button.classList.remove("is-ping");
    void button.offsetWidth;
    button.classList.add("is-ping");
    const pop = document.createElement("span");
    pop.className = "pokedex-pop";
    pop.setAttribute("aria-hidden", "true");
    pop.textContent = count === TOTAL ? "Pokédex complete!" : `New entry ${number(option.dex)}`;
    button.append(pop);
    window.setTimeout(() => pop.remove(), 1800);
  }

  function register(event) {
    const option = pokemonOptions.find((item) => item.name === event.detail?.name);
    if (!option || store.caught[option.name]) return;
    store = load();
    store.caught[option.name] = new Date().toISOString().slice(0, 10);
    store.fresh = [...store.fresh.filter((name) => name !== option.name), option.name];
    save(store);
    syncButton();
    const count = caughtCount();
    celebrate(option, count);
    announcer.textContent = count === TOTAL
      ? `${option.name} registered. Pokédex complete: all ${TOTAL} caught!`
      : `${option.name} registered in the Pokédex. ${count} of ${TOTAL} caught.`;
  }

  // Another tab caught something.
  function handleStorage(event) {
    if (event.key !== STORE_KEY) return;
    store = load();
    syncButton();
  }

  // Safari doesn't hand focus back to the button on its own.
  function handleClose() {
    if (!button.isConnected) return;
    if (!document.activeElement || document.activeElement === document.body || dialog.contains(document.activeElement)) button.focus({ preventScroll: true });
  }

  function handleCancel(event) {
    event.preventDefault();
    close();
  }

  // The dialog has no padding, so a click on the dialog itself is the backdrop.
  function handleBackdrop(event) {
    if (event.target === dialog) close();
  }

  syncButton();
  button.addEventListener("click", open);
  dialog.addEventListener("cancel", handleCancel);
  dialog.addEventListener("close", handleClose);
  dialog.addEventListener("click", handleBackdrop);
  document.addEventListener("pokemon:release", register);
  window.addEventListener("storage", handleStorage);

  return () => {
    clearTimeout(closeTimer);
    button.removeEventListener("click", open);
    document.removeEventListener("pokemon:release", register);
    window.removeEventListener("storage", handleStorage);
    dialog.remove();
    announcer.remove();
  };
}
