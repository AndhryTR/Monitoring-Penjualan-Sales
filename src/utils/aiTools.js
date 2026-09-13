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

function pickColumns(rows, kolom) {
  if (!Array.isArray(kolom) || kolom.length === 0) return rows;
  return rows.map((r) => {
    const o = {};
    for (const k of kolom) o[k] = r?.[k];
    return o;
  });
}

// ---------- READ (pure) ----------

export function queryData(ctx = {}, params = {}) {
  const sales = asArray(ctx.sales).slice(0, 10).map((s) => ({
    kode: s.kode ?? s.id ?? "",
    nama: s.nama ?? s.name ?? "",
    ach: num(s.ach ?? s.achievement ?? 0, 1),
    total: num(s.total ?? s.value ?? 0, 0),
  }));
  return {
    ok: true,
    data: {
      total: num(ctx.total ?? 0, 0),
      ao: num(ctx.ao ?? 0, 0),
      achGlobal: num(ctx.achGlobal ?? 0, 1),
      nBaris: num(ctx.nBaris ?? sales.length, 0),
      filterAktif: ctx.filterAktif ?? {},
      topSales: sales,
      q: str(params.q ?? "", 80),
    },
  };
}

export function bacaTarget(ctx = {}, params = {}) {
  const t = ctx.targets;
  const list = Array.isArray(t)
    ? t
    : t && typeof t === "object"
      ? Object.entries(t).map(([kode, nilai]) => ({ kode, nilai }))
      : [];
  const kode = str(params.kode ?? "", 40).toLowerCase();
  const out = kode ? list.filter((x) => String(x.kode ?? "").toLowerCase().includes(kode)) : list;
  return { ok: true, data: out.slice(0, 100) };
}

export function bacaJadwal(ctx = {}, params = {}) {
  const jadwal = ctx.jadwal ?? ctx.extra?.jadwal ?? {};
  const hari = str(params.hari ?? "", 20).toLowerCase();
  const depot = str(params.depot ?? "", 40);
  const entries = Object.entries(jadwal || {}).map(([outlet, v]) => ({
    outlet,
    day: v?.day ?? v?.hari ?? "",
    areaCode: v?.areaCode ?? "",
  }));
  const out = hari ? entries.filter((e) => String(e.day).toLowerCase() === hari) : entries;
  return { ok: true, depot, data: out.slice(0, 200) };
}

export function bacaStok(ctx = {}, params = {}) {
  const stok = asArray(ctx.stok ?? ctx.extra?.stok);
  const q = str(params.q ?? params.kode ?? "", 40).toLowerCase();
  const out = q
    ? stok.filter((r) =>
        [r.kode, r.nama, r.name, r.sku].some((f) => String(f ?? "").toLowerCase().includes(q)),
      )
    : stok;
  return { ok: true, data: out.slice(0, 100) };
}

export function bacaTransaksi(ctx = {}, params = {}) {
  const rows = asArray(ctx.transaksi ?? ctx.extra?.transaksi ?? ctx.extra?.rows ?? ctx.rows);
  const q = str(params.q ?? "", 80).toLowerCase();
  const limit = Math.min(Math.max(num(params.limit ?? 20, 0), 1), 100);
  const out = q
    ? rows.filter((r) => JSON.stringify(r).toLowerCase().includes(q))
    : rows;
  return { ok: true, n: rows.length, data: out.slice(0, limit) };
}

export function analisis(ctx = {}, _params = {}) {
  const sales = asArray(ctx.sales);
  const ranked = [...sales].sort(
    (a, b) => num(a.ach ?? a.achievement ?? 0) - num(b.ach ?? b.achievement ?? 0),
  );
  const rendah = ranked.filter((s) => num(s.ach ?? s.achievement ?? 0) < 100).slice(0, 5);
  const ringkasan =
    `ACH global ${num(ctx.achGlobal ?? 0, 1)}% dari ${num(ctx.nBaris ?? sales.length, 0)} baris. ` +
    (rendah.length
      ? `Perlu perhatian: ${rendah.map((s) => str(s.nama ?? s.kode ?? "?", 30)).join(", ")}.`
      : "Semua sales mencapai target.");
  return {
    ok: true,
    data: {
      achGlobal: num(ctx.achGlobal ?? 0, 1),
      nBaris: num(ctx.nBaris ?? sales.length, 0),
      terbawah5: rendah,
      ringkasan,
    },
  };
}

export function runReadTool(tool, params = {}, ctx = {}) {
  switch (tool) {
    case "queryData": return queryData(ctx, params);
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
      .map((t) => ({ kode: String(t.kode), nilai: Number(t.nilai ?? t.value ?? 0) }));
  }
  if (params.targets && typeof params.targets === "object") {
    return Object.entries(params.targets).map(([kode, nilai]) => ({ kode, nilai: Number(nilai) }));
  }
  if (params.kode != null) return [{ kode: String(params.kode), nilai: Number(params.nilai ?? 0) }];
  return [];
}

function currentTargetValue(targets, kode) {
  if (Array.isArray(targets)) {
    const f = targets.find((t) => String(t.kode ?? t.id ?? "") === kode);
    return f?.nilai ?? f?.value ?? f?.target ?? null;
  }
  if (targets && typeof targets === "object") return targets[kode] ?? null;
  return null;
}

function buildSetTarget(params = {}, ctx = {}, deps = {}) {
  const updates = normalizeTargetUpdates(params);
  if (updates.length === 0) return { ok: false, reason: "setTarget: params.targets kosong." };
  const baris = updates.map((u) => {
    const lama = currentTargetValue(ctx.targets, u.kode);
    return `${u.kode}: ${lama ?? "-"} -> ${u.nilai}`;
  });
  const preview = { judul: `Ubah target (${updates.length} item)`, baris };
  let ran = false;
  const run = async () => {
    ran = true;
    const setTargets = deps.setTargets;
    if (typeof setTargets === "function") {
      // Pola setter existing (useSettings): setTargets(next|updaterFn) update depo aktif.
      const next = Array.isArray(ctx.targets)
        ? ctx.targets.map((t) => {
            const k = String(t.kode ?? t.id ?? "");
            const u = updates.find((x) => x.kode === k);
            return u ? { ...t, nilai: u.nilai } : t;
          })
        : { ...(ctx.targets || {}), ...Object.fromEntries(updates.map((u) => [u.kode, u.nilai])) };
      // Dukung setter sync maupun updater-fn.
      await setTargets(next);
      return { ok: true, changed: updates.length };
    }
    return { ok: false, reason: "setTargets tak tersedia — teruskan via props AiChatDrawer." };
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

function resolveActiveRows(ctx = {}, deps = {}, params = {}) {
  if (typeof deps.getActiveRows === "function") {
    try {
      const r = deps.getActiveRows();
      if (Array.isArray(r)) return r;
    } catch { /* abaikan, pakai ctx */ }
  }
  if (Array.isArray(params.rows)) return params.rows;
  const fromCtx =
    ctx.extra?.activeRows ?? ctx.activeRows ?? ctx.extra?.rows ?? ctx.rows ?? [];
  return Array.isArray(fromCtx) ? fromCtx : [];
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

const EXPORT_JENIS = {
  excel: { module: "./excelExport.js", fn: "exportToExcel" },
  report: { module: "./reportExcelExport.js", fn: "exportSalesReportExcel" },
  transaksi: { module: "./reportExcelExport.js", fn: "exportTransactionsExcel" },
  produk: { module: "./reportExcelExport.js", fn: "exportProductReportExcel" },
  fokus: { module: "./focusGroupExport.js", fn: "exportFocusGroupExcel" },
  pdf: { module: "./pdfExport.js", fn: "exportSummaryPDF" },
  gambar: { module: "./imageExport.js", fn: "exportHtmlAsImage" },
};

function buildExportCustom(params = {}, ctx = {}, deps = {}) {
  const jenis = str(params.jenis ?? "excel", 20).toLowerCase();
  const spec = EXPORT_JENIS[jenis];
  if (!spec) {
    return { ok: false, reason: `exportCustom: jenis tak dikenal (${jenis}). Pilih: ${Object.keys(EXPORT_JENIS).join(", ")}.` };
  }
  const kolom = Array.isArray(params.kolom) ? params.kolom.map(String) : [];
  const rows = asArray(ctx.extra?.transaksi ?? ctx.extra?.rows ?? ctx.rows ?? ctx.sales);
  const filtered = pickColumns(rows, kolom);
  const preview = {
    judul: `Export ${jenis} (${filtered.length} baris${kolom.length ? `, ${kolom.length} kolom` : ""})`,
    baris: (kolom.length ? kolom : ["(semua kolom)"]).slice(0, 20),
  };
  const run = async () => {
    const injected = deps.exporters?.[jenis] ?? deps.exporters?.[spec.fn];
    if (typeof injected === "function") {
      await injected(filtered, { kolom, ctx });
      return { ok: true, jenis, baris: filtered.length, kolom };
    }
    // Modul export existing (dinamis — panggil sesuai jenis).
    const mod = await import(spec.module);
    const fn = mod[spec.fn];
    if (typeof fn !== "function") return { ok: false, reason: `Fungsi ${spec.fn} tak ada di ${spec.module}.` };
    if (jenis === "excel") await fn(ctx.agg ?? ctx, ctx.targets ?? {}, { kolom });
    else if (jenis === "pdf") await fn(ctx.agg ?? ctx, ctx.targets ?? {}, { kolom });
    else await fn(filtered, { kolom });
    return { ok: true, jenis, baris: filtered.length, kolom };
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
