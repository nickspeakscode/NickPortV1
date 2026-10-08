# Nicholas Thomas Portfolio

Personal portfolio and writing site for [bynickthomas.com](https://www.bynickthomas.com/).

## Local development

```powershell
npm install
npm run dev
```

The public site runs at `http://127.0.0.1:5173/` when Vite is started with the host option used in this workspace.

## Production build

```powershell
npm run build
```

Vite writes the public site to `dist/`. Vercel also deploys the serverless Yahoo Finance proxy at `/api/market-data`.

## Environment variables

Configure these in **Vercel → Project Settings → Environment Variables** for Production, Preview, and Development:

```text
VITE_SANITY_PROJECT_ID=vzrug3c0
VITE_SANITY_DATASET=production
```

These values identify a public Sanity dataset and are not secrets. Never add a Sanity write token to a `VITE_` environment variable.

### View counts (homepage "most viewed" highlights)

`/api/record-view` counts one view per visitor per post and stores it in a separate `viewcount-<document id>` document, so editing and republishing a post never resets its count. It only accepts same-site JSON requests from browsers and ignores bots and quick repeats.

It needs one server-only variable in **Vercel → Project Settings → Environment Variables** (Production, and Preview if wanted):

```text
SANITY_API_WRITE_TOKEN=<token>
```

Create the token in **Sanity Manage → API → Tokens → Add API token** with the **Editor** permission. Without it the site works normally but no views are counted (the function logs a warning). Redeploy after adding it.

## Sanity CORS origins

In **Sanity Manage → API → CORS Origins**, add these origins with credentials disabled:

```text
http://127.0.0.1:5173
http://localhost:5173
https://www.bynickthomas.com
https://bynickthomas.com
```

Add the exact Vercel preview domain separately if article data should load on preview deployments.

## Writing Studio

The private editor is maintained separately inside `studio/`:

```powershell
cd studio
npm install
npm run dev
```

To publish the Studio to a private Sanity-hosted address:

```powershell
cd studio
npm run deploy
```

## Learning Library and Today I Learned

Published `learningResource` documents appear at `/library`, with clean detail URLs at `/library/[slug]`.
`/library` pins a currently-learning CMA book at the top of the list when a published resource matches on status plus CMA/Gleim identity in existing fields.
Published `learningNote` documents appear newest-first at `/notes`, with detail URLs at `/notes/[slug]`.

A Learning Note can optionally reference a Learning Resource. Resource pages derive their related notes directly from that reference, so the relationship is never entered twice.

## Deployment

The Vercel project should use:

- Framework preset: `Vite`
- Root directory: repository root
- Build command: `npm run build`
- Output directory: `dist`
- Node.js: 20 or newer
- Production branch: `main`

Pushing a commit to `main` triggers the production deployment. Pull requests and non-production branches create Vercel preview deployments.

After deployment, verify:

- `/`
- `/writing`
- `/library`
- `/notes`
- `/api/market-data`
- A published article selected from `/writing`
- A published Library resource and Learning Note detail page
