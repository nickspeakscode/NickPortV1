# Homepage

The homepage is the public landing page. A visitor sees a `Hello, Nick Here.` headline that types in with a caret, the HVAC hero sentence, an interactive card portrait, About (including a `redacted` Sumlino teaser), Today I Learned highlights, musings highlights, an eight-symbol market ticker, GitHub among the header socials, and header links to the rest of the site.

## Sub-features

- `home-hero` shows the headline, the HVAC one-liner, and Contact me mailto action.
- `home-about` lands on the About section from the header About link.
- `home-sumlino` opens the About `redacted` teaser. The popup shows the Sumlino logo and a `Sumlino on X` link to `https://x.com/sumlinoapp`.
- `home-github` exposes a header social named `GitHub` to `https://github.com/nickspeakscode`.
- `home-nav` reaches Musings, Library, and TIL from the main navigation.
- `home-featured-writing` lists up to three musing highlight rows that open `/writing/?article=<slug>`, or empty copy when none are published.
- `home-til-teaser` lists up to three note highlight rows that open `/notes/<slug>`, or empty copy, plus `all notes`.
- `home-pokemon` releases a named Pokemon from the pokeball button.
- `home-cards` shuffles the portrait from its named button.
- `home-chrome` uses the shared mobile drawer and desktop compact header. See [Site chrome](./chrome.md).

## How to get to it (user POV)

- Open `/` in the browser.
- Choose `Home` in the header on the homepage (jumps to `#home`).
- Choose `Home` or the `Nicholas Thomas` wordmark on an interior page.
- Choose the homepage wordmark button `Nicholas Thomas` to reload `/`.
- On production only, open `/about` or `/about/`. Vercel redirects that path to `/#about`. Local Vite has no `/about` page.

## Driving it with control-resume

Preconditions:

- Resume is healthy at `http://127.0.0.1:5173`.
- `control-resume doctor` reports `ok`.

- **Open landing.** Go to `/`. Run `control-resume browser goto --path /`. Title is `Nicholas Thomas`. An `h1` named `Hello, Nick Here.` exists. A button named `Shuffle Nicholas Thomas’s portrait cards` is present.
- **Read the hero sentence.** The first hero paragraph is `I do financial planning and analysis for HVAC businesses, then spend probably too much of my free time testing trading ideas and tinkering with AI tools and automations, with some time left to recharge.`
- **Watch the type-in.** Visual text in `.intro-before`, `.intro-name`, and `.intro-after` types in once. `.intro-cursor` is visible and blinks. The accessible name stays `Hello, Nick Here.` while characters appear. With `prefers-reduced-motion: reduce`, the full sentence is painted immediately and `.intro-cursor` is hidden.
- **Read About.** Choose `About`. Run `control-resume browser click --role link --name "About"`. URL contains `#about`. Heading `about me` is visible. The About photo alt is `Nick and his girlfriend taking a mirror selfie`. A button named `redacted, Sumlino preview` sits in the copy.
- **Open Sumlino teaser.** Choose `redacted, Sumlino preview`. Run `control-resume browser click --role button --name "redacted, Sumlino preview"`. `.redacted-wrap` has `is-open`. A link named `Sumlino on X` (`#sumlino-teaser`) points to `https://x.com/sumlinoapp`. Its logo `src` is `/sumlino-mark.svg`. Record `href` and a screenshot of the open popup. Do not follow the X URL off-site as proof. Hover on a fine pointer also opens it; Escape and an outside click close it. A mouse click on a fine-pointer desktop does not toggle (hover already opened it).
- **Confirm GitHub.** Run `control-resume browser eval --js "document.querySelector('.social-icons a[aria-label=GitHub]')?.href"`. Result is `https://github.com/nickspeakscode`. Do not click it off-site as proof.
- **Open Musings from header.** Choose `Musings`. Run `control-resume browser click --role link --name "Musings"`. URL is `/writing/`. Heading is `musings`.
- **Return home.** Choose `Home`. Run `control-resume browser click --role link --name "Home"`. URL is `/` and the headline is back.
- **Open Library.** Choose `Library`. Run `control-resume browser click --role link --name "Library"`. URL is `/library/`. Heading is `library` or the missing-resource heading.
- **Open TIL.** From `/`, choose `TIL`. Run `control-resume browser goto --path /` then `control-resume browser click --role link --name "TIL"`. URL is `/notes/`. Heading is `today i learned` or the missing-note heading.
- **Featured musing.** From `/`, wait for a highlight row or empty copy. Run `control-resume browser goto --path /` and `control-resume browser wait --selector '#featuredWritingGrid .highlights-row, #featuredWritingGrid .highlights-empty'`. A row click uses `control-resume browser click --selector '#featuredWritingGrid .highlights-row'`. Result URL matches `/writing/?article=` and an article `h1` appears. If only empty copy `Nothing published yet.` is shown, record that and do not invent a row.
- **Latest note teaser.** On `/`, inspect `#latestLearningNote`. Wait with `control-resume browser wait --selector '#latestLearningNote .highlights-row, #latestLearningNote .highlights-empty'`. A `.highlights-row` opens `/notes/<slug>`. Empty copy reads `Nothing published yet.` Choose `all notes` with `control-resume browser click --role link --name "all notes"` to reach `/notes/`.
- **Release Pokemon.** Choose `Release a random Pokemon`. Run `control-resume browser click --role button --name "Release a random Pokemon"`. `#pokemonWalker` has class `is-released`. `#pokemonSprite` `alt` is one of Bulbasaur, Shinx, Flareon, Gengar, Pikachu, Blastoise, Dragonite, Mewtwo, Charizard, Giratina.
- **Shuffle portrait.** Choose `Shuffle Nicholas Thomas’s portrait cards`. Run `control-resume browser click --role button --name "Shuffle Nicholas Thomas’s portrait cards"`. Capture a screenshot of the hero. The button remains on the page.
- **One intro, then idle.** Leave the visible portrait untouched for at least 14 seconds. It shuffles once on load (silent), settles after three seconds, and does not replay. Fan, riffle, and Hindu techniques remain unchanged.
- **Interactions.** Click/tap and Enter/Space shuffle without an audio check. Hover and Pokemon-collision replay call `audio.canPlay()` first: they do nothing until a trusted gesture has unlocked Web Audio and the context is `running`. After unlock, enter the hero with a mouse, then after four seconds enter the card, then after another four seconds move at least 12px over it. Each unlocked action triggers a shuffle; a still cursor does not. In-flight actions never restart or queue motion. Touch pointerenter does not shuffle.
- **Photo rotation.** Verify on local port 5173. The childhood photo is visible initially. The next decoded photo is staged while the Joker is face-down, before the final flip. Observe at least two full shuffles: the new photo must already be present at the reveal, with no post-settle pop or letterboxing. Completion commits the new photo node. Cancel a shuffle by scrolling offscreen and confirm the current photo remains. Enabling reduced motion restores the childhood photo, and subsequent activation does not change it.
- **Skin.** Verify the custom tick-mark SVG back and Oxanium NT/ranks. No eyebrow or replacement tagline, large suit centers, metaphor captions, sparkles, or glass contact button. The type-in caret, childhood photo, market ticker, and Pokemon remain.
- **Reduced motion.** With the browser's reduced-motion preference enabled, the portrait remains assembled, even when activated. Enabling the preference during a shuffle cancels it immediately. The headline caret is hidden.
- **Offscreen.** Choose About or hide the tab during a shuffle; the cards settle. Returning leaves the portrait still until another interaction.
- **Proof.** Run `control-resume browser snapshot --aria --path .cursor/skills/verify-resume/evidence/homepage/result.aria.txt` and `control-resume browser screenshot --path .cursor/skills/verify-resume/evidence/homepage/result.png`. The artifacts show the wordmark `Nicholas Thomas` and the heading for the screen you left on.

## Gotchas

- Header labels render in CSS uppercase. Drive them as `Home`, `About`, `Musings`, `Library`, and `TIL` as in the markup. `control-resume` matches those names case-insensitively.
- The About teaser visible text is `redacted`. Drive the button by accessible name `redacted, Sumlino preview`. The popup link name is `Sumlino on X`, not `Sumlino`.
- Header socials include LinkedIn, YouTube, X, GitHub, and email. GitHub is `https://github.com/nickspeakscode`. The pokeball is a button in the same strip, not a social link.
- The homepage wordmark is a reload button, not a link. Interior wordmarks are links to `/`.
- The accessible headline is complete immediately (`aria-label="Hello, Nick Here."`). The visible letters type in once; reduced motion skips the type-in and hides `.intro-cursor`. Do not treat a mid-type screenshot as a missing heading.
- Hover and Pokemon-overlap shuffles are gated on `audio.canPlay()`. A first hover before any click/key will not move the cards when Web Audio is present. The load intro uses `shuffle({ silent: true })` and is not gated.
- `/about` is a production-only entry (Vercel redirect to `/#about`). Do not expect `GET /about` to 200 on local Vite.
- At `≤900px`, use `Open menu` / `#mobileMenu` instead of the inline header links. Desktop scroll adds `.is-compact` to `.site-header`. Recipes are in [Site chrome](./chrome.md).
- Homepage highlights are title-and-date rows (`.highlights-row`), not card grids. Do not wait for `.writing-card` or `.til-home-card`.
- The homepage musings CTA is `all musings`. The TIL CTA is `all notes`.
- Empty highlight copy is `Nothing published yet.` Do not expect older empty strings.
- Pokemon `alt` is random. Do not assert a specific species.
- Do not call internal portrait or walker functions. Click the named buttons.
