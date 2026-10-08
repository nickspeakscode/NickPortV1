const PROJECT_ID = process.env.VITE_SANITY_PROJECT_ID || process.env.SANITY_PROJECT_ID || "vzrug3c0";
const DATASET = process.env.VITE_SANITY_DATASET || process.env.SANITY_DATASET || "production";
const API_VERSION = "2026-08-23";
const TYPES = new Map([["article", "article"], ["note", "learningNote"]]);
const BOT_PATTERN = /bot|crawl|spider|slurp|preview|headless|lighthouse|facebookexternalhit|embedly|curl|wget|python-requests/i;
const REPEAT_WINDOW_MS = 30 * 60 * 1000;
const recentViews = new Map();

// Counts live in their own `viewcount-<document id>` documents, not on the
// article or note, so editing and republishing a post never resets them. The
// ID deliberately has no "." so the public dataset can read it.
export function viewCountId(documentId) {
  return `viewcount-${documentId}`;
}

function header(headers = {}, name) {
  const value = typeof headers.get === "function" ? headers.get(name) : headers[name];
  return Array.isArray(value) ? value[0] : value || "";
}

// Screens a request before any Sanity call. Browsers always send Origin on a
// POST; it must match the host serving the site (production, previews and
// local dev alike). JSON-only bodies force cross-site pages through a CORS
// preflight this endpoint never grants. Returns null when the view may count.
export function screenViewRequest({ headers, remoteAddress = "", type = "", slug = "", now = Date.now() } = {}) {
  const contentType = header(headers, "content-type");
  if (!contentType.toLowerCase().startsWith("application/json")) {
    return { status: 415, error: "Expected application/json" };
  }

  const origin = header(headers, "origin");
  const host = header(headers, "x-forwarded-host") || header(headers, "host");
  let originHost = "";
  try {
    originHost = new URL(origin).host;
  } catch {
    // Missing or malformed Origin.
  }
  if (!originHost || !host || originHost !== host) return { status: 403, error: "Cross-site requests are not accepted" };

  if (BOT_PATTERN.test(header(headers, "user-agent"))) return { status: 204, skipped: true };

  // Best-effort repeat suppression per warm instance; the browser also sends
  // at most one view per post per session.
  const ip = header(headers, "x-forwarded-for").split(",")[0].trim() || remoteAddress;
  const key = `${ip}|${type}|${slug}`;
  const last = recentViews.get(key);
  if (last && now - last < REPEAT_WINDOW_MS) return { status: 204, skipped: true };
  recentViews.set(key, now);
  if (recentViews.size > 5000) {
    for (const [entry, time] of recentViews) if (now - time >= REPEAT_WINDOW_MS) recentViews.delete(entry);
  }
  return null;
}

export async function recordDocumentView(input = {}) {
  const docType = TYPES.get(input?.type);
  const cleanSlug = typeof input?.slug === "string" ? input.slug.trim() : "";
  if (!docType || !cleanSlug || cleanSlug.length > 200) {
    return { ok: false, status: 400, error: "A valid type and slug are required" };
  }

  const token = process.env.SANITY_API_WRITE_TOKEN;
  if (!token) {
    console.warn("record-view: SANITY_API_WRITE_TOKEN is not set; view not counted");
    return { ok: false, status: 204, skipped: true };
  }

  try {
    const queryUrl = new URL(`https://${PROJECT_ID}.api.sanity.io/v${API_VERSION}/data/query/${DATASET}`);
    queryUrl.searchParams.set("query", `*[_type == $type && slug.current == $slug][0]._id`);
    queryUrl.searchParams.set("perspective", "published");
    queryUrl.searchParams.set("$type", JSON.stringify(docType));
    queryUrl.searchParams.set("$slug", JSON.stringify(cleanSlug));
    const lookup = await fetch(queryUrl, {
      headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(5000),
    });
    if (!lookup.ok) return { ok: false, status: 502, error: "Could not look up the document" };
    const { result: documentId } = await lookup.json();
    if (typeof documentId !== "string" || !documentId || documentId.startsWith("drafts.")) {
      return { ok: false, status: 404, error: "Document not found" };
    }

    const counterId = viewCountId(documentId);
    const mutation = await fetch(`https://${PROJECT_ID}.api.sanity.io/v${API_VERSION}/data/mutate/${DATASET}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(5000),
      body: JSON.stringify({
        mutations: [
          {
            createIfNotExists: {
              _id: counterId,
              _type: "viewCount",
              // Weak, so a post can still be deleted while it has a counter.
              document: { _type: "reference", _ref: documentId, _weak: true },
              count: 0,
            },
          },
          { patch: { id: counterId, inc: { count: 1 } } },
        ],
      }),
    });
    if (!mutation.ok) {
      console.warn(`record-view: Sanity mutation failed with ${mutation.status}`);
      return { ok: false, status: 502, error: "Could not record the view" };
    }
    return { ok: true, status: 200 };
  } catch {
    return { ok: false, status: 502, error: "View recording is temporarily unavailable" };
  }
}
