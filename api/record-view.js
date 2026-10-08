import { recordDocumentView, screenViewRequest } from "../server/recordView.js";

export default async function handler(request, response) {
  if (request.method && request.method !== "POST") {
    response.setHeader("Allow", "POST");
    response.status(405).json({ error: "Method not allowed" });
    return;
  }

  let body = request.body ?? {};
  if (typeof body === "string") {
    try {
      body = JSON.parse(body || "{}");
    } catch {
      response.status(400).json({ error: "Invalid JSON" });
      return;
    }
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    response.status(400).json({ error: "A valid type and slug are required" });
    return;
  }

  const rejected = screenViewRequest({
    headers: request.headers ?? {},
    remoteAddress: request.socket?.remoteAddress,
    type: body?.type,
    slug: body?.slug,
  });
  if (rejected?.skipped) {
    response.status(204).end();
    return;
  }
  if (rejected) {
    response.status(rejected.status).json({ error: rejected.error });
    return;
  }

  const result = await recordDocumentView(body);

  if (result.skipped) {
    response.status(204).end();
    return;
  }

  response.status(result.status).json(result.ok ? { ok: true } : { error: result.error });
}
