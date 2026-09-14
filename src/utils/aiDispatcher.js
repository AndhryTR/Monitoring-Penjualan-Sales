// aiDispatcher — konteks ringkas + transport Direct + parse + validasi (Task 3).
// Catatan: ALLOWLIST didefinisikan di sini; Task 4 (aiTools.js) akan memilikinya
// dan modul ini cukup re-export agar impor tunggal dari aiTools.

export const ALLOWLIST = [
  "queryData",
  "bacaTarget",
  "bacaJadwal",
  "bacaStok",
  "bacaTransaksi",
  "analisis",
  "setTarget",
  "setJadwal",
  "hapusDataAktif",
  "exportCustom",
];

const WRITE_TOOLS = new Set(["setTarget", "setJadwal", "hapusDataAktif", "exportCustom"]);

function num(n, d = 0) {
  const v = Number(n);
  return Number.isFinite(v) ? Number(v.toFixed(d)) : 0;
}

function str(v, max = 80) {
  const s = String(v ?? "");
  return s.length > max ? s.slice(0, max) + "…" : s;
}

// Ringkasan konteks — TIDAK pernah menyertakan rawRows mentah.
export function buildContext(input = {}) {
  const { agg = {}, targets = {}, filters = {}, sales = [], extra = {} } = input;
  const salesList = Array.isArray(sales)
    ? sales.slice(0, 100).map((s) => ({
        kode: str(s.kode ?? s.id ?? "", 24),
        nama: str(s.nama ?? s.name ?? "", 40),
        ach: num(s.ach ?? s.achievement ?? 0, 1),
        total: num(s.total ?? s.value ?? 0, 0),
      }))
    : [];
  return {
    total: num(agg.total ?? agg.totalValue ?? 0, 0),
    ao: num(agg.ao ?? agg.activeOutlet ?? 0, 0),
    achGlobal: num(agg.ach ?? agg.achGlobal ?? 0, 1),
    nBaris: num(agg.nBaris ?? agg.rows ?? salesList.length, 0),
    filterAktif: filters && typeof filters === "object" ? filters : {},
    sales: salesList,
    targets: targets && typeof targets === "object" ? targets : {},
    extra: extra && typeof extra === "object" ? extra : {},
  };
}

export const SYSTEM_PROMPT = [
  "Kamu dispatcher tool untuk aplikasi monitoring sales.",
  "Jawab HANYA JSON valid: {\"tool\": string, \"params\": object, \"ringkasan\": string}.",
  "Tanpa markdown, tanpa kode fence, tanpa teks di luar JSON.",
  "tool wajib salah satu dari: " + ALLOWLIST.join(", ") + ".",
  "Selain daftar itu DILARANG — jangan buat nama tool lain.",
  "params wajib object (boleh {}). ringkasan wajib string Bahasa Indonesia singkat.",
  "Bila perintah tak jelas, pilih tool baca paling dekat dan jelaskan di ringkasan.",
].join("\n");

export function mapDispatchError(err, res, opts) {
  const status = res?.status ?? err?.status;
  if (status === 401) return new Error("API key salah / habis (401). Periksa key di setelan AI.");
  if (status === 429) return new Error("Limit tercapai (429). Tunggu sebentar lalu coba lagi.");
  if (err instanceof TypeError || err?.name === "TypeError") {
    return new Error("Base URL tak reachable / CORS diblokir — periksa baseURL atau coba mode Proxy.");
  }
  if (err?.name === "AbortError") {
    // Sumber reason: signal pemanggil (drawer) > reason error > default timeout.
    // Chrome: DOMException AbortError tak bawa .reason ("aborted without reason"),
    // tapi opts.signal.reason selalu ada bila batal manual.
    const fromSignal = opts?.signal?.reason;
    const fromErr = err?.reason ?? err?.cause;
    const pick = fromSignal ?? fromErr;
    const msg = pick instanceof Error ? pick.message : (typeof pick === "string" && pick ? pick : "");
    return new Error(msg || "Request dibatalkan (timeout 90 detik — server AI tak merespons).");
  }
  return err instanceof Error ? err : new Error(String(err ?? "Gagal memanggil AI."));
}

// Parse respons OpenAI-compatible, mendukung JSON standar maupun fallback stream SSE (data: {...}).
// Respons kosong = ERROR (bukan sukses diam) — pernah tampilkan "Terhubung!" palsu
// padahal request tak sampai ke provider (tanpa riwayat di dashboard).
export function parseOpenAiResponseText(rawText) {
  const text = String(rawText || "").trim();
  if (!text) throw new Error("Respons kosong dari server AI — request tak sampai ke provider (cek tunnel/Base URL).");

  // 1. Coba parse sebagai JSON biasa
  try {
    const data = JSON.parse(text);
    const content = data?.choices?.[0]?.message?.content;
    if (content !== undefined) return content;
    // Jika format alternatif (mis. non-standard wrapper)
    if (data?.text) return data.text;
    if (data?.response) return data.response;
  } catch {
    // Bukan JSON standar, lanjut ke fallback SSE
  }

  // 2. Fallback: Parse Server-Sent Events (data: {...})
  const lines = text.split("\n");
  let combinedContent = "";
  let hasValidSse = false;
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed === "data: [DONE]") continue;
    if (trimmed.startsWith("data:")) {
      try {
        const jsonStr = trimmed.slice(5).trim();
        const parsed = JSON.parse(jsonStr);
        const delta =
          parsed?.choices?.[0]?.delta?.content ??
          parsed?.choices?.[0]?.message?.content ??
          "";
        combinedContent += delta;
        hasValidSse = true;
      } catch {
        // Abaikan baris SSE yang tidak valid
      }
    }
  }

  if (hasValidSse) return combinedContent;
  throw new Error(`Format respons AI tidak valid: ${text.slice(0, 120)}`);
}

// Deteksi runtime Tauri (desktop exe) — invoke IPC, bebas CORS/CSP WebView.
export function isTauriRuntime() {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

// POST via command Rust `ai_chat` (reqwest) — khusus Tauri desktop.
// Key tetap di device (disimpan via setelan), request keluar dari Rust.
// Catatan: invoke yang sudah jalan tak bisa dibatalkan dari JS;
// timeout 90s ditegakkan di sisi Rust (reqwest + tokio).
export async function callTauri(settings, messages) {
  const baseURL = String(settings?.baseURL ?? "").replace(/\/+$/, "");
  if (!baseURL) throw new Error("baseURL kosong — isi di setelan AI.");
  if (!settings?.model) throw new Error("model kosong — isi di setelan AI.");
  const { invoke } = await import("@tauri-apps/api/core");
  try {
    const rawText = await invoke("ai_chat", {
      req: {
        base_url: baseURL,
        api_key: settings?.key || "",
        model: settings.model,
        messages,
        json_mode: settings?.apiType !== "custom",
      },
    });
    return parseOpenAiResponseText(rawText);
  } catch (e) {
    const msg = typeof e === "string" ? e : (e?.message || String(e));
    throw new Error(msg);
  }
}

// POST ke backend proxy same-origin; API key provider tetap berada di server.
export async function callProxy(settings, messages, opts = {}) {
  const proxyURL = String(settings?.backendURL || "/api/ai").trim().replace(/\/+$/, "") || "/api/ai";
  if (!settings?.model) throw new Error("model kosong — isi di setelan AI.");
  const fetchFn = opts.fetchFn ?? fetch;
  const timeoutMs = opts.timeoutMs ?? 60000;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetchFn(proxyURL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: settings.model, messages, stream: false }),
      signal: ctrl.signal,
    });
    if (!res.ok) throw Object.assign(mapDispatchError(null, res), { status: res.status });
    return parseOpenAiResponseText(await res.text());
  } catch (e) {
    throw e instanceof TypeError ? mapDispatchError(e) : e;
  } finally {
    clearTimeout(timer);
  }
}

// POST {baseURL}/chat/completions, timeout 90s (tunnel lambat), TANPA retry
// otomatis (request pertama bisa masih jalan saat kedua mulai = beban ganda).
export async function callDirect(settings, messages, opts = {}) {
  const baseURL = String(settings?.baseURL ?? "").replace(/\/+$/, "");
  if (!baseURL) throw new Error("baseURL kosong — isi di setelan AI.");
  if (!settings?.model) throw new Error("model kosong — isi di setelan AI.");
  const url = baseURL + "/chat/completions";
  const body = {
    model: settings.model,
    messages,
    stream: false,
    ...(settings?.apiType !== "custom" ? { response_format: { type: "json_object" } } : {}),
  };
  const fetchFn = opts.fetchFn ?? fetch;
  const timeoutMs = opts.timeoutMs ?? 90000;

  const ctrl = new AbortController();
  // Abort manual dari UI (ganti pesan / tutup drawer) ikut batalkan request ini.
  if (opts.signal) {
    if (opts.signal.aborted) ctrl.abort(opts.signal.reason);
    else opts.signal.addEventListener("abort", () => ctrl.abort(opts.signal.reason), { once: true });
  }
  const t = setTimeout(() => ctrl.abort(new Error("Timeout 90 detik — server AI tak merespons.")), timeoutMs);
  try {
    const res = await fetchFn(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(settings?.key ? { Authorization: "Bearer " + settings.key } : {}),
      },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    if (!res.ok) throw Object.assign(mapDispatchError(null, res), { status: res.status });
    const rawText = await res.text();
    return parseOpenAiResponseText(rawText);
  } catch (e) {
    throw mapDispatchError(e, null, opts);
  } finally {
    clearTimeout(t);
  }
}

// Validasi tool call. Sukses: {ok:true, tool, params, ringkasan}.
// Gagal: {ok:false, reason, raw}.
export function parseToolCall(text) {
  const raw = String(text ?? "");
  let obj;
  try {
    obj = JSON.parse(raw);
  } catch {
    return { ok: false, reason: "JSON rusak — tampilkan mentah.", raw };
  }
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) {
    return { ok: false, reason: "Format bukan object JSON.", raw };
  }
  const { tool, params, ringkasan } = obj;
  if (typeof tool !== "string" || !ALLOWLIST.includes(tool)) {
    return { ok: false, reason: `Tool asing/dilarang: ${String(tool ?? "?")}.`, raw };
  }
  if (params !== undefined && (typeof params !== "object" || params === null || Array.isArray(params))) {
    return { ok: false, reason: "params harus object.", raw };
  }
  if (typeof ringkasan !== "string") {
    return { ok: false, reason: "ringkasan harus string.", raw };
  }
  const out = { ok: true, tool, params: params ?? {}, ringkasan };
  if (WRITE_TOOLS.has(tool) && (!out.params || typeof out.params !== "object")) {
    return { ok: false, reason: "Tool tulis wajib params object.", raw };
  }
  return out;
}

// Orkestrasi satu putaran: konteks -> pesan -> panggil -> parse.
// Transport otomatis: Tauri desktop -> Rust (callTauri, bebas CORS/CSP);
// browser -> proxy bila mode proxy, direct bila mode direct.
export async function dispatch(userText, ctxInput, settings, opts = {}) {
  const ctx = buildContext(ctxInput);
  const messages = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: JSON.stringify({ perintah: String(userText ?? ""), konteks: ctx }) },
  ];
  const text = isTauriRuntime()
    ? await callTauri(settings, messages)
    : settings?.mode === "proxy"
      ? await callProxy(settings, messages, opts)
      : await callDirect(settings, messages, opts);
  const parsed = parseToolCall(text);
  return { text, parsed, ctx };
}
