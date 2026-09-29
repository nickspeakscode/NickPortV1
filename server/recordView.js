const PROJECT_ID = process.env.VITE_SANITY_PROJECT_ID || process.env.SANITY_PROJECT_ID || "vzrug3c0";
const DATASET = process.env.VITE_SANITY_DATASET || process.env.SANITY_DATASET || "production";
const API_VERSION = "2026-08-23";
const TYPES = new Map([["article", "article"], ["note", "learningNote"]]);

export async function recordDocumentView(input = {}) {
  const docType = TYPES.get(input?.type);
  const cleanSlug = typeof input?.slug === "string" ? input.slug.trim() : "";
  if (!docType || !cleanSlug || cleanSlug.length > 200) {
    return { ok: false, status: 400, error: "A valid type and slug are required" };
  }

  const token = process.env.SANITY_API_WRITE_TOKEN;
  if (!token) return { ok: false, status: 204, skipped: true };

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

    const mutation = await fetch(`https://${PROJECT_ID}.api.sanity.io/v${API_VERSION}/data/mutate/${DATASET}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(5000),
      body: JSON.stringify({ mutations: [{ patch: { id: documentId, setIfMissing: { views: 0 }, inc: { views: 1 } } }] }),
    });
    if (!mutation.ok) return { ok: false, status: 502, error: "Could not record the view" };
    return { ok: true, status: 200 };
  } catch {
    return { ok: false, status: 502, error: "View recording is temporarily unavailable" };
  }
}
