import { defineConfig } from "vite";
import { recordDocumentView } from "./server/recordView.js";
import { fetchYahooQuotes } from "./server/yahooQuotes.js";

function yahooFinanceDevProxy() {
  return {
    name: "yahoo-finance-dev-proxy",
    configureServer(server) {
      server.middlewares.use("/api/market-data", async (request, response) => {
        if (request.method !== "GET") {
          response.statusCode = 405;
          response.setHeader("Allow", "GET");
          response.end(JSON.stringify({ error: "Method not allowed" }));
          return;
        }

        response.setHeader("Content-Type", "application/json");

        try {
          const payload = await fetchYahooQuotes();
          response.statusCode = 200;
          response.end(JSON.stringify(payload));
        } catch (error) {
          response.statusCode = 502;
          response.end(
            JSON.stringify({
              error: "Market data is temporarily unavailable",
              detail: error instanceof Error ? error.message : "Unknown Yahoo Finance error",
            })
          );
        }
      });
    },
  };
}

function rewriteContentRoute(request) {
  const requestUrl = new URL(request.url, "http://localhost");
  const match = requestUrl.pathname.match(/^\/(library|notes|writing)\/([^/]+)\/?$/);
  if (!match) return;

  const [, section, slug] = match;
  const queryName = section === "writing" ? "article" : "slug";
  requestUrl.pathname = `/${section}/`;
  try {
    requestUrl.searchParams.set(queryName, decodeURIComponent(slug));
  } catch {
    requestUrl.searchParams.set(queryName, slug);
  }
  request.url = `${requestUrl.pathname}${requestUrl.search}`;
}

function learningRouteFallbacks() {
  const configure = (server) => {
    server.middlewares.use((request, _response, next) => {
      rewriteContentRoute(request);
      next();
    });
  };

  return {
    name: "learning-route-fallbacks",
    configureServer: configure,
    configurePreviewServer: configure,
  };
}

function recordViewDevProxy() {
  return {
    name: "record-view-dev-proxy",
    configureServer(server) {
      server.middlewares.use("/api/record-view", async (request, response) => {
        if (request.method !== "POST") {
          response.statusCode = 405;
          response.setHeader("Allow", "POST");
          response.end(JSON.stringify({ error: "Method not allowed" }));
          return;
        }

        const chunks = [];
        for await (const chunk of request) chunks.push(chunk);

        let body = {};
        try {
          body = JSON.parse(Buffer.concat(chunks).toString() || "{}");
        } catch {
          response.statusCode = 400;
          response.setHeader("Content-Type", "application/json");
          response.end(JSON.stringify({ error: "Invalid JSON" }));
          return;
        }

        const result = await recordDocumentView(body);
        response.statusCode = result.skipped ? 204 : result.status;
        response.setHeader("Content-Type", "application/json");
        response.end(result.ok || result.skipped ? "" : JSON.stringify({ error: result.error }));
      });
    },
  };
}

export default defineConfig({
  plugins: [learningRouteFallbacks(), yahooFinanceDevProxy(), recordViewDevProxy()],
  build: {
    rollupOptions: {
      input: {
        main: "index.html",
        writing: "writing/index.html",
        library: "library/index.html",
        notes: "notes/index.html",
        timeline: "timeline/index.html",
      },
    },
  },
});
