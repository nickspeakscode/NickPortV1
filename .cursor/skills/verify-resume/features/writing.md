# Nick's Musings

Nick's Musings is the writing index and article reader. A visitor browses published articles as a title-and-date list and opens a single musing. When Sanity has no published articles, the index shows empty copy. Unknown slugs show a not-found page.

## Sub-features

- `writing-index` lists musing rows under the `musings` heading, or empty copy.
- `writing-detail` opens `/writing/?article=<slug>` with title, excerpt, body, and `← All musings`.
- `writing-404` shows not-found copy for an unknown `?article=` slug.
- `writing-empty` shows `Nothing published yet.` when the published list is empty.

## How to get to it (user POV)

- Choose `Musings` in the header from any page.
- Choose `all musings` on the homepage.
- Choose a featured homepage highlight row (opens a detail URL).
- Open `/writing/`, `/writing/?article=<slug>`, or `/writing/<slug>` directly. The path form rewrites to `?article=`.

## Driving it with control-resume

Preconditions:

- Resume is healthy at `http://127.0.0.1:5173`.
- `control-resume doctor` reports `ok`.

- **Open index from header.** From `/`, choose `Musings`. Run `control-resume browser goto --path /` then `control-resume browser click --role link --name "Musings"`. URL ends with `/writing/`. `h1` is `musings`. Title is `Nick's Musings | Nicholas Thomas`.
- **Open index from homepage CTA.** From `/`, choose `all musings`. Run `control-resume browser goto --path /` then `control-resume browser click --role link --name "all musings"`. Same index heading appears.
- **Confirm rows or empty.** Run `control-resume browser wait --selector '.index-row, .index-empty'`. Rows are links whose `href` contains `/writing/?article=`. Empty copy is `Nothing published yet.`
- **Open a musing.** If a row exists, choose it. Run `control-resume browser click --selector '.index-row'`. URL contains `?article=`. An `h1` matches the row title. A link `.article-back` named `← All musings` is present. If the index is empty, skip this step and record the empty copy.
- **Return to index.** If a detail page is open, choose `← All musings`. Run `control-resume browser click --selector '.article-back'`. URL is `/writing/` without `article` and the row list or empty copy is back.
- **Unknown slug.** Run `control-resume browser goto --path '/writing/?article=this-slug-does-not-exist-verify'`. `h1` is `musings`. Body includes `this article could not be found.` A link `all musings` returns to `/writing/`.
- **Path slug.** If a published article exists, run `control-resume browser goto --path '/writing/<slug>'`. It must not be a raw 404. The same title, body, and `← All musings` appear as `/writing/?article=<slug>`. The browser URL may stay `/writing/<slug>`; Vite rewrites the request, it does not require `location.search` to contain `article`.
- **Proof.** Capture the index at the click and the detail after a row opens, or the empty index plus the unknown-slug page when no articles are published. Run `control-resume browser snapshot --aria --path .cursor/skills/verify-resume/evidence/writing/action-index.aria.txt` and `control-resume browser screenshot --path .cursor/skills/verify-resume/evidence/writing/action-index.png` on the list, then the same commands with `result-detail.aria.txt` and `result-detail.png` on the article or not-found page. Detail artifacts must show the musing heading and `← All musings`. Not-found artifacts must show the missing-article copy and `all musings`.

## Gotchas

- The header link name is `Musings` in markup. CSS shows `MUSINGS`. Use `--name "Musings"`.
- The visible `h1` is `musings`. The document title stays `Nick's Musings | Nicholas Thomas`.
- There are no category filter buttons. Do not look for `[data-filter]` or `.writing-library-card`.
- There are no local sample musings. An empty Sanity list is empty copy, not fallback articles.
- A homepage highlight row skips the index. That verifies `writing-detail`, not `writing-index`.
- `curl /writing/` only returns the empty `#app` shell. It is not a musing list.
- Unknown `?article=` slugs render a not-found page with the same `musings` heading, not the index and not a 404 status.
