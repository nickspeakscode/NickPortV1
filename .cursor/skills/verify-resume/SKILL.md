---
name: verify-resume
description: Drive the nickspeakscode/NickPortV1 public website (Vite multi-page UI at / , /writing , /library , /notes) the way a user does. Use when proving homepage, About Sumlino teaser, Musings, Library, TIL, ticker, GitHub, or navigation behavior.
---

# Verify resume

This skill drives the public Nicholas Thomas portfolio in nickspeakscode/NickPortV1 (https://www.bynickthomas.com/). The next agent reads it cold. Follow it literally.

Primary surface: the public web UI. Secondary surfaces: `GET /api/market-data` (Yahoo proxy, also mounted by Vite in `npm run dev`) and Sanity Studio in `studio/` (auth-gated, do not drive). There is no public CLI.

## Launch

From the repository root, after `npm install`:

```bash
chmod +x .cursor/skills/verify-resume/bin/control-resume
export PATH="$PWD/.cursor/skills/verify-resume/bin:$PATH"
export RESUME_VERIFY_DIR="${RESUME_VERIFY_DIR:-/tmp/resume-verify}"
export RESUME_VERIFY_PORT="${RESUME_VERIFY_PORT:-5173}"
control-resume launch --host 127.0.0.1 --port "$RESUME_VERIFY_PORT"
```

This runs the documented public-site command `npm run dev -- --host 127.0.0.1 --port <port> --strictPort`.

Ready when stdout is `ready http://127.0.0.1:<port> ...` and `control-resume doctor` prints a line starting with `ok`.

Vite's own ready line is `Local:   http://127.0.0.1:<port>/`. The shell HTML contains `<div id="app"></div>` and is filled by client JS. HTTP 200 on the shell is not proof the UI rendered.

Default env (no `.env` required):

- `VITE_SANITY_PROJECT_ID` defaults to `vzrug3c0` in `src/lib/sanity.js`
- `VITE_SANITY_DATASET` defaults to `production`
- `VITE_MARKET_DATA_ENDPOINT` defaults to `/api/market-data`

No login. No local seed database. Musings, Library, and TIL show empty or 404 copy when Sanity has no published documents.

Teardown: `control-resume stop`. That kills only the PIDs recorded in `$RESUME_VERIFY_DIR/instance.json`.

Isolation:

- Two instances can run if each has its own `RESUME_VERIFY_DIR` and `--port --strictPort`.
- Refuse to drive a Vite process that this run did not launch. If `instance.json` is missing or `doctor` fails, stop and relaunch. Do not attach to a leftover `:5173`.
- The Sanity dataset is shared and read-only from this site. Do not write CMS content as part of verification.
- Do not start Studio unless a task is specifically about `studio/`.

## Doctor

```bash
control-resume doctor
```

Read-only. Pass only when all of these are true:

- The recorded npm pid is alive.
- `lsof` shows this run's listen pid on `RESUME_VERIFY_PORT`.
- `GET /`, `GET /writing/`, `GET /library/`, and `GET /notes/` return 200 and include `#app`.
- `GET /` includes `<title>Nicholas Thomas</title>`.

If anything looks off, run doctor before driving. A foreign pid on the port is a fail: stop and pick another port.

`GET /api/market-data` is not part of doctor. Yahoo can return 200 or 502; both are valid proxy outcomes. Check it only when driving the market ticker feature.

## Drive

Use `control-resume` from this skill. There is no Playwright or Cypress suite in the repo.

```bash
control-resume browser goto --path /
control-resume browser click --role link --name "Musings"
control-resume browser wait --selector '.index-row, .index-empty'
control-resume browser click --selector '.index-row'
control-resume browser text --selector h1
control-resume browser pause --ms 2000
control-resume browser wait --selector '.article-back, .detail-back'
control-resume browser snapshot --aria --path .cursor/skills/verify-resume/evidence/<id>/result.aria.txt
control-resume browser screenshot --path .cursor/skills/verify-resume/evidence/<id>/result.png
control-resume http --path /api/market-data --out .cursor/skills/verify-resume/evidence/<id>/market-data.json --quiet
```

Stable handles from this codebase (use these, not coordinates):

| Handle | What it is |
| --- | --- |
| `nav[aria-label="Main navigation"]` | Header nav on every page |
| link name `Home` | Homepage: `#home`. Interior: `/` |
| link name `About` | `/#about` |
| link name `Musings` | `/writing/` |
| link name `Library` | `/library/` |
| link name `TIL` | `/notes/` |
| link name `GitHub` | `https://github.com/nickspeakscode` (header and `#mobileMenu`) |
| button name `redacted, Sumlino preview` | About teaser `.redacted-mark` |
| link name `Sumlino on X` | `#sumlino-teaser` → `https://x.com/sumlinoapp` |
| link name `all musings` | Homepage CTA to `/writing/` |
| link name `all notes` | Homepage CTA to `/notes/` |
| homepage wordmark `#reloadSite` | Button that reloads `/` |
| interior wordmark `.wordmark` | Link to `/` named `Nicholas Thomas` |
| `h1[aria-label="Hello, Nick Here."]` | Homepage headline |
| button name `Shuffle Nicholas Thomas’s portrait cards` | Hero card deck |
| button name `Release a random Pokemon` | `#pokeballRelease` |
| `#pokemonWalker.is-released` | Pokemon is on screen |
| `[aria-label="Market prices"]` | Homepage eight-symbol ticker |
| `.ticker-item small` | Per-item status: `loading`, `delayed`, `live`, `stale`, or `offline` |
| button name `Open menu` | Mobile drawer toggle (`#mobileMenu`, `≤900px`) |
| `.site-header.is-compact` | Desktop header after scroll (`≥901px`) |
| `/writing/?article=<slug>` | Musing detail |
| `.index-row` | Title-and-date (or title-and-cover) rows on `/writing/`, `/library/`, and `/notes/` |
| `.index-empty` | Empty index copy |
| `.index-featured` / `#cmaStudyTitle` | Library currently-learning CMA callout |
| `.article-back` | `← All musings` on a musing detail |
| `[role="progressbar"][aria-label="Learning progress"]` | Resource progress |
| `.highlights-row` | Homepage musing and TIL highlight rows |
| `.highlights-empty` | Homepage empty highlight copy |
| `.detail-back` | `← Learning Library` or `← Today I Learned` |
| `.learning-from` | Optional note-to-resource link |

Read the feature file for the path you are proving. Drive every entry point it lists, or report the skipped entry with the unmet precondition. One convenient path is not coverage of the others.

## Evidence

Write proof under `.cursor/skills/verify-resume/evidence/<feature-id>/`. Cleanup must not delete this directory.

Minimum for a pass:

- Action artifact: screenshot or ARIA dump taken at the moment of the user action.
- Result artifact: screenshot and ARIA dump of the resulting screen.
- Side-effect check that matches the feature: URL change, visible heading, ticker status plus `/api/market-data` body, or 404 copy.
- Record the feature ID and entry point in the artifact filenames or a `report.txt` beside them.

Proof standards:

- Use the real header links, highlight rows, and index rows. Do not set `location` in eval to skip navigation unless the feature file says that URL is itself an entry point.
- `#app` HTML from `curl` is the empty shell. It is not UI proof.
- Writing, Library, and TIL may be empty. Empty copy is a valid result. Do not invent documents. There are no local sample musings.
- Market ticker: payload `status: "delayed"` means the proxy answered. Each `.ticker-item` carries its own status (`delayed`, `live`, `stale`, `offline`, or `loading`). There is no `.ticker-status` and no demo book. A `502` is a valid proxy miss; the UI shows `offline` / `—` or a `stale` cached price, not `feed offline` plus NQ `23785.25`. Confirm with the `/api/market-data` body. Do not mock Yahoo inside the page.
- Production `/about` and `/about/` redirect to `/#about`. Local Vite does not. Mobile chrome is `Open menu` / `#mobileMenu` at `≤900px`; set `control-resume browser viewport --width 390 --height 844` before driving it.
- Pokemon name is random. Proof is `#pokemonWalker` gaining `is-released` and `#pokemonSprite` getting a non-empty `alt`.
- Card portrait proof is the click on the named portrait button plus a screenshot of the hero. Do not call `cardPortrait.disturb()` from eval.

## Cleanup

```bash
control-resume stop
```

Kills the recorded Vite process group, the recorded Chrome PID, and the Chrome profile under `$RESUME_VERIFY_DIR`. Removes `$RESUME_VERIFY_DIR/instance.json`.

Never `pkill vite`, `pkill node`, or `pkill chrome`.

Do not delete `.cursor/skills/verify-resume/evidence/`. After stop, confirm the evidence files are still on disk.

Scratch only: `$RESUME_VERIFY_DIR` (default `/tmp/resume-verify`). Evidence lives in the skill directory, not in `/tmp`.

## Helpers

`control-resume` is executable at `.cursor/skills/verify-resume/bin/control-resume`. It uses Node and the system Chrome at `/usr/bin/google-chrome-stable` (override with `RESUME_VERIFY_CHROME`). No extra npm package.

```bash
control-resume launch --host 127.0.0.1 --port 5173
control-resume doctor
control-resume http --path /api/market-data --quiet
control-resume browser goto --path /writing/
control-resume browser click --role link --name "Library"
control-resume browser viewport --width 390 --height 844
control-resume stop
```

Keep `/maintain-verification-skill` in mind after product-route or selector changes.
