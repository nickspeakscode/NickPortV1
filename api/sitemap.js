import { buildSitemap } from "../server/sitemap.js";

export default async function handler(request, response) {
  if (request.method && !["GET", "HEAD"].includes(request.method)) {
    response.setHeader("Allow", "GET, HEAD");
    response.status(405).json({ error: "Method not allowed" });
    return;
  }

  const { xml, complete } = await buildSitemap();
  response.setHeader("Content-Type", "application/xml; charset=utf-8");
  // Fresh within the hour after publishing; retry sooner after a CMS outage.
  response.setHeader("Cache-Control", complete ? "s-maxage=3600, stale-while-revalidate=86400" : "s-maxage=300");
  response.status(200).send(xml);
}
