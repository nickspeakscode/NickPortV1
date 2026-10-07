const PROJECT_ID = process.env.VITE_SANITY_PROJECT_ID || process.env.SANITY_PROJECT_ID || "vzrug3c0";
const DATASET = process.env.VITE_SANITY_DATASET || process.env.SANITY_DATASET || "production";
const API_VERSION = "2026-08-23";
export const SITE_ORIGIN = "https://www.bynickthomas.com";

// /timeline/ is intentionally absent while it is on hold.
const STATIC_PATHS = ["/", "/writing/", "/library/", "/notes/"];
const SECTIONS = { article: "writing", learningNote: "notes", learningResource: "library" };

const QUERY = `*[
  _type in ["article", "learningNote", "learningResource"] &&
  defined(slug.current) &&
  (_type == "learningResource" || defined(publishedAt))
]{ _type, "slug": slug.current, _updatedAt }`;

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

export function renderSitemap(documents = []) {
  const entries = STATIC_PATHS.map((path) => ({ loc: `${SITE_ORIGIN}${path}` }));
  for (const doc of documents) {
    const section = SECTIONS[doc?._type];
    if (!section || typeof doc.slug !== "string" || !doc.slug) continue;
    entries.push({
      loc: `${SITE_ORIGIN}/${section}/${encodeURIComponent(doc.slug)}`,
      lastmod: typeof doc._updatedAt === "string" ? doc._updatedAt.slice(0, 10) : "",
    });
  }

  const urls = entries
    .map(({ loc, lastmod }) => `  <url><loc>${escapeXml(loc)}</loc>${lastmod ? `<lastmod>${escapeXml(lastmod)}</lastmod>` : ""}</url>`)
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

// Published content only, read from Sanity's public CDN. A CMS outage still
// yields a valid sitemap of the static pages rather than an error.
export async function buildSitemap(fetchImpl = fetch) {
  try {
    const url = new URL(`https://${PROJECT_ID}.apicdn.sanity.io/v${API_VERSION}/data/query/${DATASET}`);
    url.searchParams.set("query", QUERY);
    url.searchParams.set("perspective", "published");
    const response = await fetchImpl(url, { headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error(`Sanity returned ${response.status}`);
    const payload = await response.json();
    return { xml: renderSitemap(payload.result ?? []), complete: true };
  } catch {
    return { xml: renderSitemap([]), complete: false };
  }
}
