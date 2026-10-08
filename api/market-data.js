import { fetchYahooQuotes } from "../server/yahooQuotes.js";

export default async function handler(request, response) {
  if (request.method && !["GET", "HEAD"].includes(request.method)) {
    response.setHeader("Allow", "GET, HEAD");
    response.status(405).json({ error: "Method not allowed" });
    return;
  }

  // The edge cache keys on the full URL; refusing query strings stops
  // `?random` requests from bypassing it and hammering Yahoo.
  if (String(request.url ?? "").includes("?")) {
    response.setHeader("Cache-Control", "s-maxage=3600");
    response.status(400).json({ error: "Query parameters are not supported" });
    return;
  }

  try {
    const payload = await fetchYahooQuotes();
    if (payload.status === "unavailable") {
      // The ticker keeps its last-known prices; do not cache the outage long.
      response.setHeader("Cache-Control", "s-maxage=5");
      response.status(503).json({ error: "Market data is temporarily unavailable" });
      return;
    }
    response.setHeader("Cache-Control", payload.status === "delayed" ? "s-maxage=15, stale-while-revalidate=15" : "s-maxage=5");
    response.status(200).json(payload);
  } catch {
    response.status(502).json({ error: "Market data is temporarily unavailable" });
  }
}
