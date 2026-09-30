# Cursor Project Context — Nicholas Thomas Portfolio

Last updated: September 30, 2026

## Timeline polish: September 30

- Nick rejected the phone's white timeline. The timeline now stays navy/aqua regardless of system light/dark preference, including initial HTML paint and browser theme color. This supersedes the earlier request to support a separate light palette.
- All nine titles and paragraphs are shorter. Keep the central story: no clear plan at first, following interests, then building on them. Preserve the high-school 4.0, $150,000+ business revenue, CMA in progress, and Sumlino facts.
- Desktop artwork has a reserved lane clear of the card chapter rail. Horizon labels stay left of the center path, outside the illustration; narrow screens use the card rail instead of tiny background labels. Phone artwork begins below the rail.
- Particle rendering uses reusable typed buffers, cached formation routes and shared rotation math. The old 30fps idle throttle is removed because it also throttled pointer and tap animation. Hidden/offscreen pausing and reduced motion remain. Captions fade completely during the chapter handoff, and interrupted animations resume gently.
- Missing/failed sampling images keep a locally generated dot fallback (an S for Sumlino), so a failed asset cannot blank its own or the preceding chapter. The final mountain/sun layer is cached, and the moving horizon path keeps a continuous phase. `tests/timelineResilience.browser.cjs` checks failed-image rendering, browser-frame pacing, and resuming a paused morph in Chromium and WebKit.

## Latest update: My timeline

- `/timeline/` is a standalone Vite entry. **My timeline** sits beside **Contact me** in the homepage hero, clear of the portrait shuffle. Nick rejected both a dangling attachment and a link directly beneath the cards. Existing primary navigation is unchanged.
- Nine concise first-person chapters in `src/data/timeline.js` use Nick's latest account: South Carolina and competitive basketball; a **4.0 high-school GPA**, graduating during COVID without a set plan; college-era crypto/NFT interest; **The Tribe, now Primate Trading, and over $150,000 in revenue**; missing face-to-face work after two or three years and joining HVAC accounting/FP&A; studying for the CMA and statistics; trading his own live account, primarily index futures; founding **Sumlino in August 2026** (Nick said a month ago on September 29); and a closing chapter about always being a student, learning and being excited for the future. Do not describe the CMA as earned or move the 4.0 GPA to college.
- Sumlino's description was checked against its local README: a browser month-end close assistant for accountants using QuickBooks. The supplied `public/sumlino-founder.png` is an offscreen sampling source only; its blue character is rendered entirely in dots, without showing the image or its white background.
- Nick's final reference shows a central dotted timeline receding toward a mountain/sunset, then branching at the end. This supersedes his intermediate request to remove the background. `timelineHorizon.js` draws the mountains, sun, perspective chapter stops and branching path entirely as dots; the mountain grows closer with progress. The final chapter streams points upward into the horizon, suggesting the story continues.
- `src/lib/timelineParticles.ts` is a dependency-free TypeScript canvas engine, with 3,500 dots on desktop and 1,800 on phones. Points have normalized x/y/z coordinates, perspective projection and ten depth-opacity levels down to 20%. The basketball is a real Fibonacci-sampled sphere, spinning at 0.035 turns/second; other illustrations are sampled into shallow volumes with a slow 3D turn. SVGs/PNG remain offscreen sampling sources, not visible image elements.
- Each transition releases the existing formation, then assembles the next object's parts using distinct paths: a cap gathers from above, crypto blocks join from opposite sides, bars and candlesticks build upward, the book meets at its spine, and Sumlino's two halves weave together. There is no page-turn or slide-away effect. Captions fade gently without sliding. The fixed viewport, one-gesture chapter selection and existing copy remain; the supplied generic hero-template placeholders were not used as content.
- Pointer lean and 70–110px local repulsion spring back on departure. Clicking, tapping or pressing Enter/Space triggers a bounded burst and return. Rendering follows requestAnimationFrame; DPR is capped at 2. IntersectionObserver pauses offscreen rendering, and hidden tabs suspend frames. Reduced motion disables spin, pointer response, bursts and the final stream. No animation library or additional runtime dependency is used.
- The timeline uses navy/aqua stage tokens in both system themes. Mountains use staggered depth layers; the sunset is a circular point cloud with a restrained atmospheric halo. The homepage and other pages retain their existing theme.
- **One scroll gesture or swipe selects one complete chapter**, not a partial scrub. A 320ms wheel quiet threshold groups trackpad inertia, and a same-direction transition cannot be retriggered mid-flight. Direction reversal is immediate. Arrow keys, PageUp/Down, Home/End, Space and chapter buttons also navigate. Browser zoom remains available; the document never scrolls. A swipe beginning on the artwork navigates without firing a ghost-click burst. Pointer capture releases naturally after pointerup; manual release previously swallowed the next tap at narrow phone widths.
- Timeline controls activate touch taps on pointerup and deduplicate the following compatibility click. Chromium can omit that first click after a captured swipe even with natural capture release; direct tap activation keeps both the chapter rail and artwork responsive. Keyboard and mouse activation remain ordinary clicks.
- `tests/timelineThemes.browser.cjs` checks desktop Chromium and a 390px WebKit phone under both system themes, verifies the stage remains navy, captures both ends of the journey, and checks DPR, idle motion, offscreen/hidden pausing and reduced motion.
- Final kit checks pass in desktop Chromium and 390px WebKit, including all nine chapter interactions, and all four desktop/phone light/dark visual scenarios. The visibility test waits for IntersectionObserver delivery before asserting an offscreen pause. The mobile horizon/path fades behind copy. The production build and 22 API/unit tests pass; these are browser-emulated phone checks, not a fresh physical-iPhone test.
- The header contains only a top-right Close link and a screen-reader heading. Desktop pairs story and artwork; phone/tablet stack them. The chapter rail uses miniature spade cards ranked A, 2–9, with matching ranks in the story and counter. Story text remains accessible DOM content; the decorative canvas sits inside an accessible scatter button.
- `tests/timeline.browser.cjs` covers desktop, portrait/narrow mobile and landscape in Chromium/WebKit: fixed document, continuous dot morphing, hover and click/tap/keyboard dispersion and return, card ranks, scroll settling, all nine chapters, touch, reduced motion, restoration, text bounds and a homepage link clear of the shuffle. It normalizes Chromium's DPR-scaled emulated wheel input. Native superseded cross-document transition cancellation is logged separately from application errors.
- Nick requested pushing this update after the final checks. Dev server: `http://localhost:5173/timeline/`; same-Wi-Fi phone: `http://192.168.1.74:5173/timeline/`.

## Local review: published content and site reliability

- Writing and notes refreshes now compare content, not just slugs, so edits in Sanity show up even when URLs stay the same. A failed notes-index refresh retains cached entries; an uncached fetch failure reports temporary unavailability rather than claiming a note was deleted. `tests/contentCache.browser.cjs` verifies these cases with isolated fixtures and no real view-count writes.
- Navigation regression tests explicitly target `#mobileMenu`, since the Library now has its own separate dialog as well.
- The API/unit suite passes 22 checks, and both the frontend and Sanity Studio build locally. Read-only checks confirm eight market quote responses, rejected invalid view inputs/methods, public Sanity queries and exact LAN CORS access. WebKit's phone viewport loads the actual published Library via the LAN origin. These are emulated browser checks, not a new physical-iPhone test. CMS content and deployment are unchanged.
- The earlier full-site browser review passed the menu, desktop header, library reader, Sumlino reveal, ticker, content-cache refresh and portrait photo timing. Shuffle-audio playback/alignment passed in Chromium desktop and phone contexts; this Windows WebKit build lacks Web Audio, so Safari audio is explicitly unverified in this run. Generated browser screenshots in `output/playwright/` are ignored by Git.

## Latest update: Interactive library shelf and filters

- Library filters include Everything, Written by me, Books, Certifications, and additional published resource types. `?shelf=mine` or `?shelf=type:Book` persists a selection across reloads and browser history. Counts include the featured CMA entry; filtered certification results put it directly on the shelf. Touch targets, keyboard focus, live result announcements, empty states and reduced motion are supported.
- Sanity's `learningResource` is now labeled **Library Entry**. Optional `createdByMe` flags original work (unset existing entries remain false); optional `customResourceType` supplies a new filter label when resourceType is Other. In Progress and Published statuses support authored work. Both list and detail projections include these fields; no content migration or fabricated authorship is needed. See `studio/README.md` for editor instructions.
- Nick authorized the CMS update: the Studio build passed and the schema plus hosted Studio were successfully deployed to `https://bynickthomas.sanity.studio/` on September 29, 2026. No published documents were changed by this implementation. Nick subsequently authorized publishing the reviewed frontend and backend changes.
- The Library index uses published Sanity resources as dimensional book covers on a navy shelf, with aqua accents and a subtle hover lift. A missing or failed cover gets a text cover. The currently-learning CMA callout remains, and non-book resources are supported.
- `src/libraryShelf.css` scopes the new shelf and modal reader styling. `src/lib/libraryShelf.js` enhances ordinary resource links: the cover lifts into a native modal reader while details unfold from a subtle spine edge. Closing returns the cover in 240ms and fades the whole panel, toolbar and backdrop together. Interrupted opening reverses from the current cover position; a bounded animation wait prevents deferred browser timelines from leaving the modal active. Modified clicks and the “Open full page” link preserve clean `/library/[slug]` routes.
- The reader reuses `renderResourceDetail()` in `src/library.js`, displaying the existing description, progress, rating, dates, thoughts, takeaways and related notes. Index content appears immediately; fresh related notes update in place without replacing the decoded cover. Failed refreshes preserve saved details and show a notice. Request versions prevent stale results after quick closing/reopening. Missing ratings and optional facts are omitted. Certification links read “View credential”; landscape images remain uncropped and missing covers use the entry title.
- Escape, a return button and the backdrop dismiss the reader. Focus is contained and restored to the selected book; body scrolling is locked only while open. Reduced motion skips the cover flight and shelf entrance. Resizing finishes an active flight. Cache refreshes compare full resources, defer shelf rerenders while a reader is open, and retain cached content on network failure.
- `tests/libraryShelf.browser.cjs` exercises Chromium/WebKit desktop and phone layouts with isolated CMS fixtures: filters/history, details, notes, keyboard focus, quick-close races, whole-panel closing, delayed requests, broken/missing covers, landscape credentials, custom resources, unsafe links, resize/pagehide, reduced motion and clean detail URLs. Real published covers/content were also reviewed in desktop and phone screenshots.
- The phone preview failure was a confirmed Sanity CORS 403 for `http://192.168.1.74:5173`. That exact origin is now allowed without credentials. A fresh WebKit phone session at the LAN URL successfully loaded published data. If the PC's LAN address changes, register the new exact preview origin with `sanity cors add ORIGIN --no-credentials`; do not enable wildcard credentialed access. This is emulated WebKit coverage, not a new physical-iPhone confirmation.
- Shared CMS links now use `src/lib/safeUrl.js` to reject executable URL protocols. View recording validates input types, reads only published documents and handles upstream failures/timeouts as controlled responses. `tests/safeUrl.test.js` and `tests/recordView.test.js` cover these fixes without making real mutations.
- Preview runs from `.browser-cache/publish/resume` at port 5173. The top-level workspace remains an older source snapshot; use the Git checkout for changes and publishing.

## Latest update: Sumlino project signature

- The current Git checkout includes upstream changes through `1b6bd4e`, including the About teaser, Sumlino link, and JetBrains Mono hero bio.
- Nick requested a professional brand presentation in place of the roaming “Catch me” character. Hover or tap on “redacted” now reveals a fixed, anchored product signature: the supplied cobalt GIF in a framed brand area, Sumlino typography, a concise reconciliation description, and a “Follow on X” link. The inline word resolves into Sumlino without changing paragraph width.
- `src/lib/sumlinoCharacter.js` positions a body-level preview near the trigger, constrained to the viewport and sticky header. The only entrance effect is a short reveal; there is no roaming animation loop. Hover departure, outside tap, Escape, close, scrolling or page hiding dismiss it. Keyboard opening focuses the project link, and Escape restores focus.
- The original GIF is preserved in `public/sumlino-cobalt.gif`. A native picture source selects its first-frame PNG for reduced motion. The link remains `https://x.com/sumlinoapp`. `tests/sumlinoCharacter.browser.cjs` checks Chromium/WebKit desktop and touch views, layout stability, positioning, keyboard/touch/hover, dismissal, reduced motion and the external destination.
- Development runs from `.browser-cache/publish/resume`; the top-level directory remains an older source snapshot. Nick authorized publishing this update. The production build and Chromium/WebKit desktop and touch browser checks passed.

Read this file before making changes. It summarizes the current architecture, working features, content workflow, and important implementation decisions.

## Project overview

This repository powers Nicholas Thomas's personal portfolio at [www.bynickthomas.com](https://www.bynickthomas.com/). It combines a creative portfolio homepage, long-form writing, a Learning Library, short Today I Learned notes, live market data, and interactive Pokemon details.

The public website is a multi-page, vanilla JavaScript Vite application. It is not a React application. Sanity Studio is a separate React-based CMS application inside `studio/`.

Preserve the existing visual language: dark navy backgrounds, aqua accents, rounded cards, subtle borders and glows, pixel/Pokemon details, generous spacing, and scroll-triggered reveals. Extend existing components and CSS before introducing a new visual system.

## Technology and hosting

- Public frontend: Vite 6, HTML, CSS, and ES modules
- Rich text rendering: `@portabletext/to-html`
- CMS: Sanity project `vzrug3c0`, dataset `production`
- Public hosting: Vercel, deployed from the GitHub `main` branch
- Sanity Studio: [bynickthomas.sanity.studio](https://bynickthomas.sanity.studio/)
- Production website: [www.bynickthomas.com](https://www.bynickthomas.com/)
- Required Node.js version: 20 or newer

The repository root is the Vercel project root. Vercel runs `npm run build` and serves `dist/`.

## Important commands

Public site:

```powershell
npm install
npm run dev
npm run build
npm run preview
```

Sanity Studio:

```powershell
cd studio
npm install
npm run dev
npm run build
npm run deploy
```

Always run the public production build after frontend changes. Run the Studio build after schema or Studio configuration changes.

## Public routes

| Route | Purpose | Main entry file |
| --- | --- | --- |
| `/` | Portfolio homepage | `index.html`, `src/main.js` |
| `/writing` | Nick's Musings article index and article details | `writing/index.html`, `src/writing.js` |
| `/writing/[slug]` | Individual musing (`?article=` after rewrite) | `writing/index.html`, `src/writing.js` |
| `/library` | Learning Library index | `library/index.html`, `src/library.js` |
| `/library/[slug]` | Individual Learning Resource | `library/index.html`, `src/library.js` |
| `/notes` | Today I Learned index | `notes/index.html`, `src/notes.js` |
| `/notes/[slug]` | Individual Learning Note | `notes/index.html`, `src/notes.js` |
| `/timeline/` | Nick's interactive story | `timeline/index.html`, `src/timeline.js` |
| `/api/market-data` | Vercel serverless Yahoo Finance proxy | `api/market-data.js` |

Vite uses `vite.config.js` to build five HTML entry points. During local development it rewrites clean Library and Notes detail URLs to their index pages with a `slug` query parameter, and Musings detail URLs (`/writing/:slug`) to `?article=`. `vercel.json` provides equivalent production rewrites. Keep both routing implementations aligned if these routes change. Do not add a `/study` route unless the site owner asks for it.

## Current working features

### Homepage

- Responsive hero and About sections
- Interactive poker-card portrait (see **Card portrait** below)
- Square photo beside the About copy, popping in on scroll
- Scroll-triggered reveal animations
- Animated skill/interest items
- Homepage Musings and Today I Learned highlights show the three most viewed published items
- Opening a musing or note increments `views` through `POST /api/record-view` using `SANITY_API_WRITE_TOKEN` on the server only
- LinkedIn, YouTube, X, GitHub, and email icon links in the header
- Clickable Pokeball with shine animation
- Random released Pokemon that can move and be dragged
- Scrolling futures ticker for NQ, ES, YM, and RTY

The ticker uses `src/lib/marketTicker.js`. It shows NQ, ES, YM, RTY, BTC, ETH, FTSE 100 and Nikkei 225. BTC/USD and ETH/USD receive trade-triggered updates from Kraken's unauthenticated v2 WebSocket; DOM paints are limited to four per second. `/api/market-data` is refreshed every 15 seconds while visible and provides Yahoo delayed quotes for all eight symbols (including crypto fallback). Server requests are coalesced and cached for 15 seconds per warm instance, with a 15-second Vercel edge cache. Each symbol fails independently, retaining its last valid quote as stale. No demo prices are shown: initial labels render immediately, unavailable prices show an em dash and offline status, and the optional local cache retains genuine prices for up to 24 hours. Two equal fixed-width groups scroll seamlessly; price changes update text nodes without replacing the track. Hidden pages pause networking/animation; resuming reconnects the stream and refreshes quotes. Reconnects back off to 30 seconds and a stalled socket is replaced after 45 seconds without messages. Provider, change basis, and quote timestamps are available in each item's title. Yahoo's exchange delays cannot be removed by polling faster.

### Card portrait

The homepage uses `src/lib/cardPortrait.js` and CSS-transformed cards inside `.portrait-shell`. It replaces the canvas jigsaw and its scatter physics.

- Five navy cards use `/nick-card-back.svg`: custom market-tape ticks and registration marks, with an HTML Oxanium NT monogram sharing the site font. Ranks use Oxanium, with small aqua/coral suit marks. The ace of spades, queen of hearts, king of clubs, and jack of diamonds reveal their faces during the shuffle. Nick is the Joker. The original `/nick-pixel-source.jpg` photo fills a double-line inset frame with a subtle edge tint, coordinated matte, retaining the original square childhood photo. Portrait-format photos use cover cropping with individual object positions for the waterfall and snow shots.
- Three bounded sequences — fan, riffle, and Hindu shuffle — run through the Web Animations API, taking three seconds. Riffle separates two packets, hinges and alternately releases cards before squaring up. Hindu pulls successive packets lengthwise into a receiving stack. Each technique has its own recording supplied by Nick, scheduled against the animation timeline after audio is unlocked by a trusted gesture. A shuffled bag plays all three before refilling and prevents consecutive repeats.
- One intro plays when the image loads, then the deck stays still until interaction. Hero/card non-touch pointer entry, movement of at least 12px over the card, mouse clicks, taps, Enter/Space, and Pokemon contact can retrigger it. There is no cooldown. On browsers with Web Audio, hover and Pokemon contact wait until trusted input has unlocked a running audio context, so a silent hover cannot consume the first click. In-flight activations are ignored and no replay is queued. Touch hover is ignored; the native button click handles taps once, including Safari compatibility clicks.
- There is no pause button, metaphor caption, or sparkle on the cards. The childhood Joker photo is the initial and reduced-motion default. After each completed shuffle, the face advances through the curated `PORTRAIT_PHOTOS` array: childhood, summer waterfall, mirror photo, snow portrait, autumn waterfall. The four additional JPEGs were supplied by Nick and copied into `public/` without image edits. The actual decoded image nodes are retained; failed or pending loads are skipped. The next decoded photo is mounted invisibly before the shuffle, and becomes opaque at the last face-down keyframe (81% fan, 85% riffle, 87% Hindu). A separate opacity mask keeps the entire photo frame hidden while the Joker faces away, preventing mobile backface leaks. The frame becomes visible just after the final rotation crosses 90 degrees, so the incoming image is already present on the final face-up turn. Both opacity effects share the card transforms’ WAAPI clock; there is no timeout or post-settle reveal. Completion retains that same node and removes the old image; cancellation removes the staged image and retains the previous photo.
- Nick supplied three recordings on September 7. `src/lib/cardAudio.js` maps Fan Cards to fan, Shuffle to riffle, and Count 4 cards to Hindu. Prepared WAV assets in `public/audio/cards/` have leading silence removed, pitch-preserving timing adjustments, and measured loudness within 0.1 LU of -23 LUFS. Their README records exact source trims, cues and peak levels. Web Audio predecodes the assets and schedules each cue against the card timeline. Trusted pointer/click/touchend/keyboard input unlocks the context (touchend is explicit for iPhone Safari); the initial autoplay trick is explicitly silent, even if input arrives before the image finishes loading. Hover is gated by audio readiness; the first click/tap starts the sound-enabled trick rather than unlocking an already-running silent hover trick. Cancellation, hidden/offscreen state and reduced motion stop scheduled/playing audio. Slow or failed loads are skipped rather than played late. A resumed context does not replay old sound.
- Reduced-motion users receive a static portrait with automatic and manual shuffles disabled. Changing the preference cancels any active animation and restores `/nick-pixel-source.jpg`.
- Hidden tabs and offscreen portraits cancel to the assembled state. Returning does not trigger a shuffle; only a new interaction can do that. There is no interval or timeout in the portrait module.
- Animation uses the existing transform and stacking-order keyframes. The portrait has no continuous animation loop, geometry rebuild, or canvas bitmap allocation.
- `/nick-cutout.webp` is retained as a legacy asset; the Joker uses the untouched original photo.

### Hero copy and typography

The hero has no eyebrow or replacement tagline. The accessible “Hello, Nick Here.” heading stays complete while its visible text types once using Oxanium, with a blinking caret. Nick is solid #5dffd0 with no glow; reduced motion shows the complete text and hides the caret. The contact link has an aqua underline and no glass fill. The introduction is: “I do financial planning and analysis for HVAC businesses, then spend probably too much of my free time testing trading ideas and tinkering with AI tools and automations, with some time left to recharge.” The two-column layout, futures ticker, and Pokemon remain.

### Anchor scrolling

Desktop headers (901px+) now use `src/lib/desktopHeader.js` and `src/desktopHeader.css`, initialized through `syncHeaderOffset()`. After passing 80px from the top, 18px of downward travel contracts the bar; 12px upward expands it, with small reversals ignored to prevent flicker. The wide desktop bar transitions from 60px to 44px over 320ms, keeping navigation and ticker available. A sticky wrapper reserves the expanded height so changing header size never moves document content or produces artificial direction changes. Keyboard focus expands the bar; resize/top-of-page resets it. Mobile uses a `display: contents` wrapper and retains its existing header. Reduced motion skips transitions. These scroll-header changes are local and not included in the previously pushed `b7edb4b`.

Ticker alignment refinement: quotes use identical 204px grids (symbol, right-aligned two-decimal price, right-aligned percentage) with fine separators. Normal live/delayed labels are no longer repeated visually; status remains in the quote title and accessible text. Stale/offline/loading states replace the percentage visibly when needed. The two duplicated groups retain equal widths and update in place.

`html` carries `scroll-padding-top: calc(var(--header-height) + 26px)` so header links such as About land with the section heading visible instead of tucked under the sticky header. `--header-height` is measured by `syncHeaderOffset()` rather than hardcoded. The mobile homepage includes a slim ticker row; interior pages use one compact row.

### Mobile navigation (September 8, local preview)

- `src/lib/mobileNav.js` and `src/mobileNav.css` provide the same right-side drawer on all four pages at 900px and below. The existing navigation and social-link nodes move into a native modal dialog; desktop restores those same nodes to their original positions. The Pokeball stays in the header and the homepage ticker stays visible.
- The drawer uses a short transform animation, 44px controls, large navigation rows, current-page indication, safe-area padding and a scrollable panel for short screens. Escape, the close button and backdrop dismiss it; following an anchor restores page scrolling before navigation. Keyboard focus stays in the dialog and returns to the trigger on dismissal. Reduced motion skips the slide. Cleanup handles interior-page rerenders and crossing the desktop breakpoint.
- Drawer links use 20px labels and decorative spade-card marks in Nick's corrected order: Home A, About 2, Musings 3, Library 4, TIL 5. These marks are hidden on desktop and from assistive technology. Links enter one by one with 65ms staggered delays after the drawer starts opening; reduced motion skips all entrance effects, and closing cleans up pending effects.
- `src/homeRefinements.css` makes the homepage more compact through component sizes and spacing, never CSS/browser zoom: desktop portrait 245px, mobile portrait up to 194px, smaller headline/body text and reduced hero height. Nick confirmed the smaller version feels better on iPhone, then requested more space around the portrait: mobile/tablet hero now uses 28px top inset and a 44px portrait-to-copy gap. At 901–1199px the ticker occupies its own header row to prevent horizontal overflow; wider desktop placement stays the same. The ticker uses fine separators rather than nested pill backgrounds. X links on homepage and interior headers point to `https://x.com/nickonfinance`. GitHub links point to `https://github.com/nickspeakscode`.
- Card audio now requests `navigator.audioSession.type = 'playback'` during trusted gesture unlock when available. WebKit documents this for iOS 17+ to play through media volume with the Ring/Silent switch on. Unsupported or rejected session settings fall back to the existing audio behavior. The intro remains silent. Nick tested the September 8 same-Wi-Fi preview on physical iPhone Safari with the bell muted and reported that sound plays and the side button looks good. Device model/iOS version were not supplied.
- September 7 changes were pushed to `main` as `894fbb2`. September 8 menu/audio-session changes are local only until Nick requests another push.

The anchored sections deliberately do not carry `reveal-on-scroll` themselves; their heading blocks do. While a section held the class, its `translateY(34px)` shifted the element the browser was scrolling to, so the jump overshot by that amount on top of the header overlap.

### Nick's Musings

- Published Sanity `article` documents appear on `/writing`
- Article detail views use their slug
- Portable Text, images, links, and uploaded Sanity videos are supported
- Homepage highlights are the most viewed published articles, then featured, then newest
- The shared header includes Home, About, Musings, Library, TIL, LinkedIn, YouTube, X, GitHub, email, and the Pokeball interaction

### Learning Library

- `/library` queries all published `learningResource` documents
- Responsive cards display covers, titles, creators, resource types, categories, status, progress, and ratings where available
- Lightweight filters: All, Books, Courses, Certifications, Currently Learning, and Completed
- A **Currently learning CMA** callout sits above the shelf. It selects a published resource whose status is `Currently Learning` and whose title, type, category, tags, or author/creator mentions CMA, Gleim, or Certified Management Accountant. No extra CMS field is required.
- If no matching resource is published, the callout shows an empty state that points at [Sanity Studio](https://bynickthomas.sanity.studio/). The frontend does not hardcode a Gleim resource.
- `/library/[slug]` displays the full resource, personal thoughts, key takeaways, progress, rating, external link, and related notes
- Related notes are derived by querying Learning Notes that reference the resource

### Today I Learned

- `/notes` queries all published `learningNote` documents newest first
- Previews display title, date, category, calculated or manually supplied read time, excerpt, and related resource when present
- `/notes/[slug]` displays the note body, metadata, tags, and an optional **Learning From** link back to its resource
- Notes are intentionally lightweight and do not require hero images, SEO descriptions, or complex article fields

## Sanity content model

Schema registration lives in `studio/schemaTypes/index.js`.

### `article`

Used for longer Nick's Musings posts. Its schema is in `studio/schemaTypes/articleType.js`. It supports cover images, rich Portable Text, uploaded videos, and article metadata.

### `learningResource`

Defined in `studio/schemaTypes/learningResourceType.js`.

Important fields include title, generated slug, type, author/creator, cover, category, tags, learning status, progress from 0–100, optional rating from 1–5, dates, description, personal summary, key takeaways, external URL, featured flag, and display order.

### `learningNote`

Defined in `studio/schemaTypes/learningNoteType.js`.

Important fields include title, generated slug, publication date, short Portable Text body, category, tags, optional `relatedResource` reference, featured flag, automatic view count, and optional read time. When read time is blank, the frontend estimates it at approximately 220 words per minute.

The resource/note relationship is deliberately stored only on `learningNote.relatedResource`. Never add a duplicate array of notes to a resource. `loadLearningResource()` derives related notes with a GROQ query.

There is currently no Sanity Project document type, so Learning Notes do not contain a Project reference.

## Sanity data layer

All public Sanity queries and rendering helpers live in `src/lib/sanity.js`.

Key exports:

- `loadPublishedArticles()`
- `loadLearningResources()`
- `loadLearningResource(slug)`
- `loadLearningNotes()`
- `loadLearningNote(slug)`
- `loadLatestLearningNote()`
- `renderPortableText()`
- `estimateReadTime()`
- `buildSanityImageUrl()`

Queries use the published perspective, disable browser caching, and have a five-second timeout. Keep Sanity query fields synchronized with schema field names.

Sanity identifiers default to the production project in code but should also be configured in Vercel:

```text
VITE_SANITY_PROJECT_ID=vzrug3c0
VITE_SANITY_DATASET=production
```

These identifiers are public. Never expose a Sanity write token through a `VITE_` environment variable.

Required Sanity CORS origins include:

```text
http://127.0.0.1:5173
http://localhost:5173
http://localhost:5174
https://www.bynickthomas.com
https://bynickthomas.com
```

These are configured in Sanity Manage under the project's API settings, not in this repository. If a localhost origin is missing, Sanity answers local dev requests with `403 Forbidden`, the browser reports a CORS error, and Musings / homepage article highlights fall back to empty states until CORS is fixed. Production is unaffected. Vite picks the next free port when 5173 is taken, so allow the ports actually used locally.

## Shared frontend modules

- `src/lib/siteChrome.js`: shared interior-page header, footer, navigation, social links, and Pokeball markup
- `src/lib/mobileNav.js`: shared responsive menu, modal interaction and desktop restoration
- `src/lib/cardAudio.js`: normalized card recordings, gesture unlock, scheduled cue playback and cancellation
- `src/lib/cardPortrait.js`: homepage card portrait choreography, exposing `disturb()`, `scatterFrom()`, `resume()`, and `pause()`
- `src/lib/pokemonRelease.js`: Pokemon release, drag, wall bounce, and text-obstacle collisions for every page
- `src/lib/pageData.js`: session cache and nav prefetch so Musings, Library, and TIL paint immediately on repeat visits
- `src/lib/pageUi.js`: shared scroll reveal initialization and safe slug extraction
- `src/learning.css`: shared Library and Today I Learned styles
- `src/style.css`: homepage and shared global visual styles
- `src/writing.css`: Musings-specific styles

Prefer these shared modules over duplicating header, footer, reveal, or Pokemon logic. The homepage and interior pages share `initializePokemonRelease()`.

## Publishing workflow

### Learning Resource

1. Open the hosted Sanity Studio.
2. Create a **Learning Resource**.
3. Enter the required fields and generate the slug from the title.
4. Set status and progress, then add optional details.
5. Publish it. It will appear on `/library`.

### Learning Note

1. Create a **Learning Note** in Sanity.
2. Enter a title, generate the slug, write the short body, and choose a category.
3. Optionally choose a resource under **Learning From**.
4. Publish it. It will appear on `/notes` and on the linked resource page.

### Long-form article

Create and publish an **Article** in Sanity. It will appear under `/writing`. The homepage Musings section shows the most viewed published articles.

## Design and implementation guidelines

- Do not convert the public frontend to React unless the owner explicitly requests a migration.
- Do not rewrite working pages simply to add a feature.
- Reuse existing CSS variables, card treatments, typography, spacing, and motion patterns.
- Keep Library and TIL content driven by Sanity rather than hardcoded frontend arrays.
- Keep the Learning Note → Learning Resource relationship one-way in Sanity and query the reverse relationship.
- Maintain accessible labels, keyboard controls, reduced-motion behavior, and responsive layouts.
- Escape CMS-provided values before inserting them into HTML. Use the existing helpers in `src/lib/sanity.js`.
- Preserve graceful loading, empty, not-found, and API-error states.
- Do not add secret tokens to source control.
- Preserve unrelated user changes in a dirty working tree.

## Verification checklist

After relevant changes:

1. Run `npm run build` from the repository root.
2. If schemas changed, run `npm run build` from `studio/`.
3. Test `/`, `/writing`, `/library`, and `/notes` at desktop and mobile widths.
4. Test one real detail route for each content type when published content is available.
5. Test a nonexistent `/library/[slug]` and `/notes/[slug]` route.
6. Confirm `/api/market-data` returns JSON and that the homepage fallback remains usable when it fails.
7. Check the browser console for errors and confirm there is no horizontal mobile overflow.
8. After pushing `main`, verify the Vercel production pages and clean detail-route rewrites.

## Deployment state

The Learning Library and Today I Learned implementation was introduced in commit `1dd8358` (`Add connected learning library and notes`). At the time of this document, the repository's `main` branch matches `origin/main`, the Sanity Studio schemas are deployed, and the production Library and Notes routes are reachable.


## Local card timing verification (September 7, 2026)

- `node --test tests/cardPortrait.test.js` covers retaining the staged decoded node, immediate interaction replay with no cooldown, touch clicks, offscreen/tab cancellation, reduced motion, failed photo loads, and cycle wraparound.
- `tests/cardPortrait.browser.cjs` runs against an already-started local Vite server with an externally installed Playwright package (`PLAYWRIGHT_MODULE` can specify its path). It checks Chromium and WebKit at desktop and iPhone 13 viewports, all three shuffle techniques at precise animation times and in real time, hidden photo layers while face-down, the incoming photo on the final turn, and identical portrait pixels at settle and 1.1 seconds later. Results/screenshots go to ignored `test-results/card-reveal/`. The older `card-portrait` evidence tested a superseded settle-only reveal and cooldown; it is not evidence for the current behavior.
- Windows WebKit with an iPhone viewport is not physical iOS Safari verification. An actual iPhone check remains necessary before claiming that coverage.
- This workspace was supplied as a source snapshot without `.git`; changes are local and are not published. Push/merge/deploy only when Nick says.

## Audio verification (September 7, 2026)

- `node --test tests/cardAudio.test.js tests/cardPortrait.test.js`: 13 tests cover the first mouse-click/hover interaction, silent autoplay, correct cue mapping, cancellation/interruption, failed/late loads, and existing card behavior.
- `tests/cardAudio.browser.cjs` checks real decoding, trusted input, scheduled times, clip durations and cancellation. Desktop/mobile Chromium passed. The installed Windows WebKit build does not expose Web Audio, so audio testing there is explicitly not tested; it is not a Safari audio pass. Evidence lives in ignored `test-results/audio/`.
- Physical iPhone Safari audio check: Nick tested the same-Wi-Fi preview and reported “All three sound right, including after returning to Safari.” This is user-reported device verification on September 7, 2026. iPhone model and iOS version were not supplied. No remote device instrumentation was used.
