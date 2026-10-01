# Learning Library

The Learning Library is the public shelf of published learning resources. A visitor filters the shelf, opens a cover into a reader, and can continue to the full resource page. A currently-learning CMA resource, when published and the Everything filter is active, is called out above the shelf. Missing slugs and a failed load have their own copy.

## Sub-features

- `library-index` lists cover links or the empty shelf copy under `library`.
- `library-filters` filters the shelf with `Everything`, `Written by me`, and one button per resource type. The active button is `aria-pressed="true"`.
- `library-cma` shows a `currently learning` callout when a published Currently Learning CMA/Gleim resource exists and the Everything filter is selected.
- `library-reader` opens a cover or CMA row into `dialog.library-reader` without leaving `/library/`.
- `library-detail` opens `/library/<slug>` with progress, facts, and `Notes From This Resource`.
- `library-404` shows `nothing on this shelf` for an unknown slug.
- `library-related-notes` links related TIL notes when the resource has them.

## How to get to it (user POV)

- Choose `Library` in the header.
- Open `/library/` or `/library/<slug>` directly.
- Choose a cover on the shelf, or the CMA row when it is present. That opens the reader. Choose `Open full page` for the resource URL.
- Choose a `Learning From` link on a note detail page.

## Driving it with control-resume

Preconditions:

- Resume is healthy at `http://127.0.0.1:5173`.
- `control-resume doctor` reports `ok`.

- **Open shelf.** Choose `Library`. Run `control-resume browser goto --path /` then `control-resume browser click --role link --name "Library"`. URL is `/library/`. Wait with `control-resume browser wait --selector '.shelf-link, .index-empty, .index-featured'`. `h1` is `library` or the error shelf heading. A group named `Filter library` is present. `Everything` is pressed on a fresh visit.
- **Index content.** After load, either `.shelf-link` covers exist or the empty copy `Nothing on the shelf yet.` is visible. Cover accessible names are `Open <title>`.
- **Filter the shelf.** Choose a filter whose name starts with its label, for example `control-resume browser click --role button --name "Books"`. The URL gains `?shelf=` unless the filter is `Everything`, which clears `shelf`. The pressed button's accessible name includes its count (`Books 3`). An empty collection says `Nothing in this collection yet. Choose another filter to explore the shelf.` Return with `control-resume browser click --role button --name "Everything"`.
- **Currently learning CMA.** On `Everything`, if `.index-featured` is present, heading `#cmaStudyTitle` is `currently learning` and its `.index-row` opens the reader. If the callout is absent, record that no matching Currently Learning CMA resource is published. Other filters hide the callout.
- **Open the reader.** If a cover exists, choose it. Run `control-resume browser click --selector '.shelf-link'`. URL stays `/library/` (filters may keep `?shelf=`). `dialog.library-reader` is open. Its title is the resource title. A button named `← Return to shelf` is present. A progressbar named `Progress` is present. The heading `Notes From This Resource` is present, with either `.index-row` links to `/notes/<slug>` or the empty copy `No notes yet.`
- **Open the full page.** From the reader, choose `Open full page`. Run `control-resume browser click --role link --name "Open full page"`. URL is `/library/<slug>`. `h1.learning-detail-title` matches the cover title. `.detail-back` reads `← Learning Library`. The same progressbar name and notes section are on the page. Direct `control-resume browser goto --path /library/<slug>` is the same page.
- **Unknown slug.** Run `control-resume browser goto --path /library/this-slug-does-not-exist-verify`. `h1` is `nothing on this shelf`. Body includes `That resource is not on this shelf.` A link `Back to the Library` returns to `/library/`.
- **Proof.** Save ARIA and a screenshot of the shelf, the open reader, and the full page or the unknown-slug page. Run `control-resume browser snapshot --aria --path .cursor/skills/verify-resume/evidence/library/action-index.aria.txt` on the shelf, then `result-reader.aria.txt` with the dialog open, and `result-detail.aria.txt` on the full page. Record whether the shelf had covers, which filter was pressed, a CMA callout, related notes, or empty copy.

## Gotchas

- The index `h1` paints before Sanity settles. Wait for `.shelf-link`, `.index-empty`, or `.index-featured`. While Sanity is in flight the shelf can show `Loading the shelf…` on a `[role="status"]`. The filter live region `.library-filter-status` and the closed reader's `.reader-notice` stay in the DOM and are not loading gates.
- Cover clicks do not navigate. `control-resume` clicking `.shelf-link` or the CMA `.index-row` opens the reader. The full page is `Open full page` or a direct `/library/<slug>` URL.
- Filter accessible names include the count (`Everything 3`). `--name "Everything"` and `--name "Books"` still match. Do not look for `#learningCount` or `.resource-card`.
- Empty shelf and an empty filter are valid. They are not a failed launch.
- The CMA callout is data-driven and only rendered for the Everything filter. Absence is a published-data miss, not a harness failure. Do not create a Sanity resource to force it.
- Direct `/library/<slug>` and `/library/?slug=<slug>` are the same full-page entry. Vite rewrites the clean path. The address bar stays on `/library/<slug>`.
- Do not create Sanity resources to satisfy this feature.
