import "./style.css";
import "./writing.css";
import { escapeHtml } from "./lib/sanity.js";
import { initializeRevealAnimations } from "./lib/pageUi.js";
import { initializeInteriorChrome, renderInteriorHeader, renderSiteFooter } from "./lib/siteChrome.js";

// Vercel serves this page with a real 404 status for any unmatched URL. The
// static markup in 404.html already reads correctly without JavaScript.
const app = document.querySelector("#app");
const path = window.location.pathname;

app.innerHTML = `
  ${renderInteriorHeader("")}
  <main class="index-page">
    <header class="index-intro index-enter">
      <h1>page not found</h1>
      <p>there's nothing at <code>${escapeHtml(path)}</code>. it may have been moved, or the link may be mistyped.</p>
    </header>
    <ul class="index-list">
      ${[
        ["/", "Home"],
        ["/writing/", "Musings"],
        ["/library/", "Library"],
        ["/notes/", "Today I Learned"],
      ]
        .map(
          ([href, label], index) => `
            <li>
              <a class="index-row index-enter" href="${href}" style="--stagger: ${index + 1}">
                <span class="index-row-title">${label}</span>
                <span class="index-row-meta" aria-hidden="true">→</span>
              </a>
            </li>`
        )
        .join("")}
    </ul>
  </main>
  ${renderSiteFooter()}
`;
initializeInteriorChrome();
initializeRevealAnimations(app);
