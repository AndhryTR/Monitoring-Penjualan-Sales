const MAX_BODY_BYTES = 256 * 1024;

function json(res, status, body) {
  res.status(status).setHeader("Content-Type", "application/json").send(JSON.stringify(body));
}

export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.setHeader("Allow", "POST, OPTIONS");
    return res.status(204).end();
  }
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST, OPTIONS");
    return json(res, 405, { error: "Method not allowed" });
  }

  const baseURL = String(globalThis.process?.env?.AI_BASE_URL || "").replace(/\/+$/, "");
  const apiKey = String(globalThis.process?.env?.AI_API_KEY || "");
  if (!baseURL || !apiKey) {
    return json(res, 500, { error: "AI proxy belum dikonfigurasi di environment server." });
  }

  const rawLength = Number(req.headers["content-length"] || 0);
  if (rawLength > MAX_BODY_BYTES) {
    return json(res, 413, { error: "Request AI terlalu besar." });
  }

  const { model, messages } = req.body || {};
  if (typeof model !== "string" || !model.trim() || !Array.isArray(messages)) {
    return json(res, 400, { error: "model dan messages wajib diisi." });
  }

  try {
    const upstream = await globalThis.fetch(`${baseURL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: model.trim(),
        messages,
        stream: false,
        response_format: { type: "json_object" },
      }),
    });
    const text = await upstream.text();
    res.status(upstream.status).setHeader("Content-Type", upstream.headers.get("content-type") || "application/json");
    return res.send(text);
  } catch (error) {
    return json(res, 502, { error: `AI upstream tidak dapat dijangkau: ${error.message}` });
  }
}
