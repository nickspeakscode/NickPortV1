# Site chrome

Shared header chrome: a mobile navigation drawer at narrow widths, and a compact sticky header on desktop scroll. Both run on `/` and on interior pages.

## Sub-features

- `chrome-mobile-menu` shows `Open menu` at `≤900px`. That button opens `#mobileMenu` (`Navigation`) with the same Home / About / Musings / Library / TIL links plus social icons (LinkedIn, YouTube, X, GitHub, email). The pokeball stays in the header bar.
- `chrome-desktop-compact` adds `.is-compact` to `.site-header` on desktop (`≥901px`) after the visitor scrolls down past the top of the page.

## How to get to it (user POV)

- Open any public page (`/`, `/writing/`, `/library/`, `/notes/`) and shrink the viewport to `900px` or narrower. Choose `Open menu`.
- On a desktop-width window, scroll down the homepage or an interior index until the sticky header shrinks.

## Driving it with control-resume

Preconditions:

- Resume is healthy at `http://127.0.0.1:5173`.
- `control-resume doctor` reports `ok`.

- **Narrow the viewport.** Run `control-resume browser viewport --width 390 --height 844`. Default Chrome is `1280x800`, which hides the drawer toggle.
- **Open a page.** Run `control-resume browser goto --path /` (or `/writing/`, `/library/`, `/notes/`). A button named `Open menu` exists (`aria-controls="mobileMenu"`, `aria-expanded="false"`).
- **Open the drawer.** Run `control-resume browser click --role button --name "Open menu"`. `#mobileMenu` is an open `dialog`. `aria-expanded` on the toggle is `true`. The dialog heading is `Navigation`. Home, About, Musings, Library, and TIL are inside `#mobileMenu`. The drawer footer (`Elsewhere`) includes a link named `GitHub` to `https://github.com/nickspeakscode`.
- **Close the drawer.** Run `control-resume browser click --role button --name "Close menu"`. The dialog is closed and `aria-expanded` is `false`. Escape and a backdrop click also close it. Following a link closes it immediately.
- **Reset width.** Run `control-resume browser viewport --width 1280 --height 800`. `Open menu` stays in the DOM but is not the desktop control; the inline `nav[aria-label="Main navigation"]` is back in the header.
- **Compact on scroll.** At `≥901px`, run `control-resume browser goto --path /` then `control-resume browser eval --js "window.scrollTo(0, 240)"` and `control-resume browser pause --ms 200`. `.site-header` has `desktop-scroll-header` and `is-compact`. Near the top (`scrollY < 80`), or after a visible keyboard focus in the header, `is-compact` is absent.
- **Proof.** Capture the open drawer at `390px` and the compact header at `1280px`. Run `control-resume browser snapshot --aria --path .cursor/skills/verify-resume/evidence/chrome/menu.aria.txt` and `control-resume browser screenshot --path .cursor/skills/verify-resume/evidence/chrome/menu.png` while `#mobileMenu` is open. Repeat for the compact header as `compact.aria.txt` / `compact.png`.

## Gotchas

- `Open menu` is injected on every page that calls the shared chrome. It is only meant to be used at `≤900px`. Clicking it at `1280px` does not open the dialog.
- Nav link accessible names are the labels `Home`, `About`, `Musings`, `Library`, and `TIL`. Decorative rank/suit marks inside the drawer are `aria-hidden`. `control-resume` skips `aria-hidden` text when matching `--name`.
- Interior About is `/#about`. Production also redirects `/about` and `/about/` to `/#about`. Local Vite has no About rewrite: `GET /about` can 200 the homepage shell without `#about`.
- Desktop compaction only runs at `min-width: 901px`. Do not look for `.is-compact` in the mobile drawer recipe.
- The homepage ticker row changes header height; interior headers stay a single row. Offset is measured, not hardcoded.
