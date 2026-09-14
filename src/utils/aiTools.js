// aiTools — eksekusi tool AI via setter/modul existing (Task 4).
// ALLOWLIST tunggal dari aiDispatcher (re-export).
// Baca: pure, tanpa side-effect. Tulis: { preview:{judul,baris}, run } —
// dispatcher/UI JANGAN panggil run sebelum ConfirmDialog.

export { ALLOWLIST } from "./aiDispatcher.js";

export const WRITE_TOOLS = ["setTarget", "setJadwal", "hapusDataAktif", "exportCustom"];
const WRITE_SET = new Set(WRITE_TOOLS);

export function isWriteTool(tool) {
  return WRITE_SET.has(tool);
}

function num(n, d = 0) {
  const v = Number(n);
  return Number.isFinite(v) ? Number(v.toFixed(d)) : 0;
}

function str(v, max = 80) {
  const s = String(v ?? "");
  return s.length > max ? s.slice(0, max) + "…" : s;
}

function asArray(v) {
  return Array.isArray(v) ? v : [];
}

// ---------- READ (pure) ----------

// Obrolan umum — tanpa data, tanpa efek. Jawaban langsung dari params.
export function chat(_ctx = {}, params = {}) {
  const j = typeof params.jawaban === "string" ? params.jawaban.trim().slice(0, 2000) : "";
  if (!j) return { ok: false, reason: "chat butuh params.jawaban." };
  return { ok: true, data: { jawaban: j } };
}

export function queryData(ctx = {}, params = {}) {
  // Cakupan: "semua" (default — seluruh data tanpa filter tanggal) atau
  // "filter" (hanya bila user eksplisit sebut "di filter ini / yang tampil").
  const cakupan = String(params.rentang ?? params.cakupan ?? "semua").toLowerCase() === "filter" ? "filter" : "semua";
  const src = cakupan === "semua" && ctx.semua && typeof ctx.semua === "object" ? ctx.semua : ctx;
  const salesSrc = Array.isArray(src.sales) && src.sales.length ? src.sales : asArray(ctx.sales);
  let sales = salesSrc.map((s) => ({
    kode: s.kode ?? s.id ?? "",
    nama: s.nama ?? s.name ?? "",
    ach: num(s.ach ?? s.achievement ?? 0, 1),
    total: num(s.total ?? s.realisasi ?? s.value ?? 0, 0),
  }));
  // Filter + urut + batasi sesuai params (contoh: 3 ACH terendah).
  if (params.minAch != null && Number.isFinite(Number(params.minAch))) {
    sales = sales.filter((s) => s.ach < Number(params.minAch));
  }
  const sortBy = String(params.sortBy ?? "").toLowerCase();
  const order = String(params.order ?? "desc").toLowerCase() === "asc" ? 1 : -1;
  if (sortBy === "ach" || sortBy === "total" || sortBy === "nama") {
    const key = sortBy === "nama" ? "nama" : sortBy;
    sales = [...sales].sort((a, b) =>
      key === "nama" ? order * String(a.nama).localeCompare(String(b.nama)) : order * (a[key] - b[key]));
  }
  const limit = Math.min(Math.max(num(params.limit ?? 10, 0), 1), 30);
  const rows = sales.slice(0, limit);
  return {
    ok: true,
    data: {
      cakupan,
      total: num(src.total ?? ctx.total ?? 0, 0),
      ao: num(src.ao ?? ctx.ao ?? 0, 0),
      achGlobal: src.ach != null ? num(src.ach, 1) : num(ctx.achGlobal ?? 0, 1),
      nBaris: num(src.nBaris ?? ctx.nBaris ?? 0, 0),
      periode: src.dari || src.sampai ? { dari: src.dari, sampai: src.sampai, hari: src.hari } : (ctx.periode ?? {}),
      rows,
      sortBy: sortBy || null, order: order === 1 ? "asc" : "desc", limit,
      q: str(params.q ?? "", 80),
    },
  };
}

export function bacaTarget(ctx = {}, params = {}) {
  const t = ctx.targets;
  const list = Array.isArray(t) ? t : [];
  const kode = str(params.kode ?? "", 40).toLowerCase();
  const out = kode
    ? list.filter((x) => String(x.kode ?? "").toLowerCase().includes(kode) || String(x.nama ?? "").toLowerCase().includes(kode))
    : list;
  return { ok: true, data: out.slice(0, 30) };
}

export function bacaJadwal(ctx = {}, params = {}) {
  const r = ctx.jadwalRingkasan && typeof ctx.jadwalRingkasan === "object" ? ctx.jadwalRingkasan : null;
  if (!r) return { ok: false, reason: "Ringkasan jadwal tak tersedia — buka tab Jadwal Kunjungan." };
  const hari = str(params.hari ?? "", 20).toLowerCase();
  if (hari && r.perHari && typeof r.perHari === "object") {
    const n = r.perHari[hari] ?? r.perHari[hari.toUpperCase()] ?? 0;
    return { ok: true, data: { hari, terjadwal: n } };
  }
  return { ok: true, data: r };
}

export function bacaStok(ctx = {}, params = {}) {
  const s = ctx.stok;
  if (!s || typeof s !== "object") return { ok: false, reason: "Ringkasan stok tak tersedia — buka tab Stok." };
  const q = str(params.q ?? params.kode ?? "", 40).toLowerCase();
  // ctx.stok hanya ringkasan agregat; pencarian SKU butuh tab Stok.
  if (q) return { ok: false, reason: "Pencarian SKU butuh tab Stok — ringkasan saja yang tersedia di sini." };
  return { ok: true, data: s };
}

export function bacaTransaksi(ctx = {}, _params = {}) {
  // Transaksi mentah SENGAJA tak dikirim ke LLM (payload raksasa).
  // AI tetap tahu volume via ctx.nBaris.
  return { ok: false, reason: `Transaksi mentah tak tersedia di AI (${num(ctx.nBaris ?? 0, 0)} baris di dashboard). Minta analisis/queryData, atau filter di tab Transaksi.` };
}

export function analisis(ctx = {}, params = {}) {
  // Default cakupan semua (tanpa filter tanggal); "filter" hanya bila eksplisit.
  const cakupan = String(params.rentang ?? params.cakupan ?? "semua").toLowerCase() === "filter" ? "filter" : "semua";
  const src = cakupan === "semua" && ctx.semua && typeof ctx.semua === "object" ? ctx.semua : ctx;
  const salesSrc = Array.isArray(src.sales) && src.sales.length ? src.sales : asArray(ctx.sales);
  const sales = salesSrc;
  const achG = src.ach != null ? num(src.ach, 1) : num(ctx.achGlobal ?? 0, 1);
  const nB = num(src.nBaris ?? ctx.nBaris ?? sales.length, 0);
  const ranked = [...sales].sort(
    (a, b) => num(a.ach ?? a.achievement ?? 0) - num(b.ach ?? b.achievement ?? 0),
  );
  const rendah = ranked.filter((s) => num(s.ach ?? s.achievement ?? 0) < 100).slice(0, 5);
  const ringkasan =
    `ACH global ${achG}% dari ${nB} baris (cakupan: ${cakupan === "semua" ? "seluruh data" : "filter layar"}). ` +
    (rendah.length
      ? `Perlu perhatian: ${rendah.map((s) => str(s.nama ?? s.kode ?? "?", 30)).join(", ")}.`
      : "Semua sales mencapai target.");
  return {
    ok: true,
    data: {
      cakupan,
      achGlobal: achG,
      nBaris: nB,
      terbawah5: rendah,
      ringkasan,
    },
  };
}

// Deret penjualan per bulan (tanpa filter tanggal) — jawab "3 bulan terakhir",
// "tren penjualan", perbandingan antar bulan, per sales per bulan.
export function bacaBulanan(ctx = {}, params = {}) {
  const list = Array.isArray(ctx.bulanan) ? ctx.bulanan : [];
  if (!list.length) return { ok: false, reason: "Deret bulanan tak tersedia — upload data transaksi dulu." };
  const n = Math.min(Math.max(num(params.bulanTerakhir ?? params.n ?? list.length, 0), 1), list.length);
  const potong = list.slice(-n);
  const kode = str(params.kode ?? "", 40).toLowerCase();
  const tren = potong.map((m) => ({
    bulan: m.bulan, label: m.label, total: m.total, target: m.target, ach: m.ach, ao: m.ao, nBaris: m.nBaris,
  }));
  const out = { nBulan: n, dari: potong[0]?.bulan ?? null, sampai: potong[potong.length - 1]?.bulan ?? null, tren };
  if (kode) {
    const perSales = potong.map((m) => {
      const s = (m.sales || []).find((x) =>
        String(x.kode ?? "").toLowerCase().includes(kode) || String(x.nama ?? "").toLowerCase().includes(kode));
      return { bulan: m.bulan, label: m.label, ach: s?.ach ?? null, realisasi: s?.realisasi ?? 0, target: s?.target ?? 0 };
    });
    out.sales = perSales;
  }
  return { ok: true, data: out };
}

export function runReadTool(tool, params = {}, ctx = {}) {
  switch (tool) {
    case "chat": return chat(ctx, params);
    case "queryData": return queryData(ctx, params);
    case "bacaBulanan": return bacaBulanan(ctx, params);
    case "bacaTarget": return bacaTarget(ctx, params);
    case "bacaJadwal": return bacaJadwal(ctx, params);
    case "bacaStok": return bacaStok(ctx, params);
    case "bacaTransaksi": return bacaTransaksi(ctx, params);
    case "analisis": return analisis(ctx, params);
    default: return { ok: false, reason: `Tool baca tak dikenal: ${String(tool)}.` };
  }
}

// ---------- WRITE (preview + run, TANPA auto-run) ----------

function normalizeTargetUpdates(params) {
  if (Array.isArray(params.targets)) {
    return params.targets
      .filter((t) => t && t.kode != null)
      .map((t) => ({
        kode: String(t.kode),
        nilai: Number(t.nilai ?? t.value ?? 0),
        ao: t.ao != null ? Number(t.ao) : null,
      }));
  }
  if (params.targets && typeof params.targets === "object" && !Array.isArray(params.targets)) {
    return Object.entries(params.targets).map(([kode, v]) => {
      if (v && typeof v === "object") return { kode, nilai: Number(v.nilai ?? v.value ?? 0), ao: v.ao != null ? Number(v.ao) : null };
      return { kode, nilai: Number(v), ao: null };
    });
  }
  if (params.kode != null) return [{ kode: String(params.kode), nilai: Number(params.nilai ?? 0), ao: params.ao != null ? Number(params.ao) : null }];
  return [];
}

function currentTargetValue(targets, kode) {
  if (Array.isArray(targets)) {
    const f = targets.find((t) => String(t.code ?? t.id ?? "") === kode);
    return f ? { value: f.total?.value ?? f.value ?? null, ao: f.total?.ao ?? f.ao ?? null } : null;
  }
  if (targets && typeof targets === "object") {
    const v = targets[kode];
    if (v == null) return null;
    if (typeof v === "object") return { value: v.total?.value ?? v.value ?? null, ao: v.total?.ao ?? v.ao ?? null };
    return { value: v, ao: null };
  }
  return null;
}

function targetAsli(deps) {
  if (typeof deps.getTargets === "function") {
    try {
      const t = deps.getTargets();
      if (Array.isArray(t)) return t;
    } catch { /* abaikan */ }
  }
  return null;
}

function buildSetTarget(params = {}, ctx = {}, deps = {}) {
  const updates = normalizeTargetUpdates(params);
  if (updates.length === 0) return { ok: false, reason: "setTarget: params.targets kosong." };
  // Data asli via deps.getTargets (lokal, tak dikirim ke LLM).
  // ctx.targets hanya ringkas {kode,nama,value,ao} untuk preview.
  const asli = targetAsli(deps);
  const ringkas = Array.isArray(ctx.targets) ? ctx.targets : [];
  const baris = updates.map((u) => {
    const a = asli
      ? currentTargetValue(asli, u.kode)
      : (() => {
        const r = ringkas.find((x) => x.kode === u.kode);
        return r ? { value: r.value ?? null, ao: r.ao ?? null } : null;
      })();
    const lamaTxt = a != null ? `${a.value}${a.ao != null ? ` (AO ${a.ao})` : ""}` : "-";
    const aoTxt = u.ao != null ? ` (AO ${u.ao})` : "";
    return `${u.kode}: ${lamaTxt} -> ${u.nilai}${aoTxt}`;
  });
  const preview = { judul: `Ubah target (${updates.length} item)`, baris };
  let ran = false;
  const run = async () => {
    ran = true;
    const setTargets = deps.setTargets;
    const src = targetAsli(deps);
    if (typeof setTargets !== "function" || !src) {
      return { ok: false, reason: "setTargets/getTargets tak tersedia — teruskan via props AiChatDrawer." };
    }
    // Skema target asli: { code, name, total:{value,ao}, groups[], focus[] }.
    const next = src.map((t) => {
      const k = String(t.code ?? t.id ?? "");
      const u = updates.find((x) => x.kode === k);
      if (!u) return t;
      return { ...t, total: { ...(t.total || {}), value: u.nilai, ...(u.ao != null ? { ao: u.ao } : {}) } };
    });
    await setTargets(next);
    return { ok: true, changed: updates.length };
  };
  return { ok: true, preview, run, __ran: () => ran };
}

function buildSetJadwal(params = {}, ctx = {}, deps = {}) {
  const depot = str(params.depot ?? ctx.depotName ?? "", 60);
  const jadwal = params.jadwal;
  if (!depot) return { ok: false, reason: "setJadwal: params.depot wajib." };
  if (!jadwal || typeof jadwal !== "object" || Array.isArray(jadwal)) {
    return { ok: false, reason: "setJadwal: params.jadwal wajib object {outletCode: {day}}." };
  }
  const current = ctx.jadwal ?? ctx.extra?.jadwal ?? {};
  const baris = Object.entries(jadwal).map(([outlet, v]) => {
    const baru = typeof v === "string" ? v : (v?.day ?? "?");
    const lama = current[outlet]?.day ?? "-";
    return `${outlet}: ${lama} -> ${baru}`;
  });
  const preview = { judul: `Ubah jadwal ${depot} (${baris.length} outlet)`, baris: baris.slice(0, 50) };
  const run = async () => {
    const merged = { ...current, ...jadwal };
    if (typeof deps.saveStoredSchedule === "function") {
      // Setter existing: saveStoredSchedule(depotName, scheduleMap).
      await deps.saveStoredSchedule(depot, merged);
      return { ok: true, changed: baris.length };
    }
    // Fallback: modul existing (dinamis agar smoke node tanpa localStorage tetap jalan).
    const mod = await import("./visitScheduleStorage.js");
    mod.saveStoredSchedule(depot, merged);
    return { ok: true, changed: baris.length };
  };
  return { ok: true, preview, run };
}

function resolveActiveRows(_ctx = {}, deps = {}, params = {}) {
  if (typeof deps.getActiveRows === "function") {
    try {
      const r = deps.getActiveRows();
      if (Array.isArray(r)) return r;
    } catch { /* abaikan */ }
  }
  // params.rows eksplisit dari AI (kecil) masih diterima.
  if (Array.isArray(params.rows)) return params.rows;
  // ctx mentah SUDAH dibuang di buildContext (jadi *Count) — tak ada fallback.
  return [];
}

function buildHapusDataAktif(params = {}, ctx = {}, deps = {}) {
  if (params.explicit !== true) {
    return { ok: false, reason: "Tolak: sebut target eksplisit (params.explicit===true wajib)." };
  }
  const rows = resolveActiveRows(ctx, deps, params);
  const n = rows.length || num(params.n ?? ctx.nBaris ?? 0, 0);
  if (n > 100) {
    return { ok: false, reason: `Tolak: terlalu besar (${n} baris, maks 100). Perkecil filter dulu.` };
  }
  if (n === 0) return { ok: false, reason: "Tolak: tak ada baris aktif untuk dihapus." };
  const preview = {
    judul: `Hapus ${n} baris data aktif`,
    baris: rows.slice(0, 10).map((r, i) => `#${i + 1} ${str(typeof r === "string" ? r : (r.kode ?? r.id ?? JSON.stringify(r)), 60)}`),
  };
  const run = async () => {
    if (typeof deps.deleteActiveRows === "function") {
      await deps.deleteActiveRows(rows);
      return { ok: true, deleted: n };
    }
    return { ok: false, reason: "deleteActiveRows tak tersedia — teruskan via props AiChatDrawer." };
  };
  return { ok: true, preview, run };
}

const EXPORT_JENIS = ["excel", "report", "transaksi", "produk", "fokus", "pdf", "gambar"];

function buildExportCustom(params = {}, ctx = {}, deps = {}) {
  const jenis = str(params.jenis ?? "excel", 20).toLowerCase();
  if (!EXPORT_JENIS.includes(jenis)) {
    return { ok: false, reason: `exportCustom: jenis tak dikenal (${jenis}). Pilih: ${EXPORT_JENIS.join(", ")}.` };
  }
  const kolom = Array.isArray(params.kolom) ? params.kolom.map(String).slice(0, 20) : [];
  const nBaris = num(ctx.nBaris ?? 0, 0);
  const preview = {
    judul: `Export ${jenis} (${nBaris} baris${kolom.length ? `, ${kolom.length} kolom` : ""})`,
    baris: (kolom.length ? kolom : ["(semua kolom)"]).slice(0, 20),
  };
  const run = async () => {
    // Eksekusi via handler injeksi (signature benar milik pemilik menu/tab).
    const injected = deps.exporters?.[jenis];
    if (typeof injected === "function") {
      await injected({ kolom, ctx });
      return { ok: true, jenis, baris: nBaris, kolom };
    }
    return { ok: false, reason: `Export ${jenis} belum tersambung di panel ini — pakai menu Export di header.` };
  };
  return { ok: true, preview, run };
}

export function buildWriteTool(tool, params = {}, ctx = {}, deps = {}) {
  if (!isWriteTool(tool)) return { ok: false, reason: `Bukan tool tulis: ${String(tool)}.` };
  if (!params || typeof params !== "object" || Array.isArray(params)) {
    return { ok: false, reason: "Tool tulis wajib params object + preview (ditolak tanpa preview)." };
  }
  switch (tool) {
    case "setTarget": return buildSetTarget(params, ctx, deps);
    case "setJadwal": return buildSetJadwal(params, ctx, deps);
    case "hapusDataAktif": return buildHapusDataAktif(params, ctx, deps);
    case "exportCustom": return buildExportCustom(params, ctx, deps);
    default: return { ok: false, reason: `Tool tulis tak dikenal: ${String(tool)}.` };
  }
}

// Dispatcher UI: baca langsung jalan; tulis WAJIB lewat preview + run() sesudah konfirmasi.
export function executeAiTool(tool, params = {}, ctx = {}, deps = {}) {
  if (isWriteTool(tool)) return buildWriteTool(tool, params, ctx, deps);
  return runReadTool(tool, params, ctx);
}
