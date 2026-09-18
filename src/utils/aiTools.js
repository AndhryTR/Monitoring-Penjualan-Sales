// aiTools — eksekusi tool AI via setter/modul existing (Task 4).
// ALLOWLIST tunggal dari aiDispatcher (re-export).
// Baca: pure, tanpa side-effect. Tulis: { preview:{judul,baris}, run } —
// dispatcher/UI JANGAN panggil run sebelum ConfirmDialog.
// Tahap 1: cariOutlet, cariProduk, detailSales, analisisDrop — query rawRows lokal.
// Tahap 2: navigasiTab, aturFilter, resetFilter — aksi langsung ke state UI dashboard.

import { matchRanked } from "../hooks/useGlobalSearch.js";

export { ALLOWLIST, WRITE_TOOLS } from "./aiDispatcher.js";
import { WRITE_TOOLS_SET } from "./aiDispatcher.js";

export function isWriteTool(tool) {
  return WRITE_TOOLS_SET.has(tool);
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

// ---------- HELPERS CLIENT-SIDE QUERY ----------

// Bangun index outlet dari rawRows — O(n) linear, dipakai cariOutlet & detailSales.
function buildOutletIndex(rawRows) {
  const map = new Map();
  for (const r of rawRows) {
    const key = r.outletCode || r.outletName || "";
    if (!key) continue;
    let o = map.get(key);
    if (!o) {
      o = {
        code: key,
        name: r.outletName || r.outletCode || key,
        address: r.outletAddress || "",
        value: 0, invoiceCount: 0, invoices: new Set(),
        salesCodes: new Set(), salesNames: new Set(),
        lastDate: null, firstDate: null,
        dates: new Set(),
      };
      map.set(key, o);
    }
    o.value += r.value || 0;
    if (r.invoiceNo) o.invoices.add(r.invoiceNo);
    if (r.salesCode) o.salesCodes.add(r.salesCode);
    if (r.salesName) o.salesNames.add(r.salesName);
    if (r.date) {
      o.dates.add(r.date);
      if (!o.lastDate || r.date > o.lastDate) o.lastDate = r.date;
      if (!o.firstDate || r.date < o.firstDate) o.firstDate = r.date;
    }
  }
  return Array.from(map.values()).map((o) => ({
    ...o,
    invoiceCount: o.invoices.size,
    salesList: Array.from(o.salesNames).slice(0, 5).join(", ") || "-",
    activeDays: o.dates.size,
  }));
}

// Bangun index produk dari rawRows — O(n) linear, dipakai cariProduk.
function buildProductIndex(rawRows) {
  const map = new Map();
  for (const r of rawRows) {
    const key = r.productCode || r.productName || "";
    if (!key) continue;
    let p = map.get(key);
    if (!p) {
      p = {
        code: key,
        name: r.productName || r.productCode || key,
        group: r.group || "-",
        value: 0, qty: 0, invoices: new Set(), outlets: new Set(), salesCodes: new Set(),
      };
      map.set(key, p);
    }
    p.value += r.value || 0;
    p.qty += r.qty || 0;
    if (r.invoiceNo) p.invoices.add(r.invoiceNo);
    if (r.outletCode) p.outlets.add(r.outletCode);
    if (r.salesCode) p.salesCodes.add(r.salesCode);
  }
  return Array.from(map.values()).map((p) => ({
    ...p,
    invoiceCount: p.invoices.size,
    outletCount: p.outlets.size,
    salesCount: p.salesCodes.size,
  }));
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
    ? matchRanked(
        list.map((x) => ({ ...x, name: x.nama || x.name || "", code: x.kode || "" })),
        kode,
        30
      )
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

export function bacaStok(ctx = {}, params = {}, deps = {}) {
  const stockInfo = typeof deps.getStockData === "function" ? deps.getStockData() : null;
  const s = stockInfo?.stockSummary || ctx.stok;
  if (!s || typeof s !== "object") return { ok: false, reason: "Data stok belum tersedia — silakan upload stok di tab Stok Barang." };
  const q = str(params.q ?? params.kode ?? "", 40).toLowerCase();
  // Jika mencari SKU spesifik, alihkan atau cari dari stockMetrics
  if (q && stockInfo?.stockMetrics) {
    return cariStok(ctx, params, deps);
  }
  return {
    ok: true,
    data: {
      totalSku: s.total ?? s.totalItems ?? 0,
      habis: s.habis ?? s.stockout ?? 0,
      kritis: s.menipis ?? s.low ?? 0,
      overstock: s.overstock ?? 0,
      totalNilai: s.totalValue ?? 0,
      ringkasan: `Total ${s.total ?? 0} SKU. ${s.habis ?? 0} habis (stockout), ${s.menipis ?? 0} kritis/menipis (< 7 hari coverage).`,
    },
  };
}

// cariStok: mencari status inventaris per SKU atau filter barang kritis/habis/overstock
export function cariStok(_ctx = {}, params = {}, deps = {}) {
  const stockInfo = typeof deps.getStockData === "function" ? deps.getStockData() : null;
  const metrics = stockInfo?.stockMetrics || [];
  if (!metrics.length) return { ok: false, reason: "Data rincian stok belum dimuat. Buka tab Stok Barang atau upload data stok." };

  const q = str(params.q ?? params.nama ?? params.kode ?? "", 60).toLowerCase();
  const statusFilter = str(params.status ?? "", 20).toLowerCase(); // "habis" | "kritis" | "overstock" | "normal" | "semua"
  const grup = str(params.grup ?? params.group ?? "", 40).toLowerCase();
  const limit = Math.min(Math.max(num(params.limit ?? 15, 0), 1), 50);

  let filtered = metrics;
  if (q) {
    filtered = matchRanked(
      filtered.map((p) => ({ ...p, name: p.productName || "", code: p.productCode || "" })),
      q,
      filtered.length
    );
  }
  if (grup) {
    filtered = filtered.filter((p) => String(p.group || "").toLowerCase().includes(grup));
  }
  if (statusFilter === "habis") {
    filtered = filtered.filter((p) => p.isStockout || p.currentQty <= 0);
  } else if (statusFilter === "kritis" || statusFilter === "menipis") {
    filtered = filtered.filter((p) => p.isLowStock || (p.coverageDays !== null && p.coverageDays < 7 && p.currentQty > 0));
  } else if (statusFilter === "overstock") {
    filtered = filtered.filter((p) => p.isOverstock || (p.coverageDays !== null && p.coverageDays > 60));
  }

  // Sort: barang habis & kritis di paling atas (coverage terendah)
  filtered.sort((a, b) => {
    if (a.currentQty <= 0 && b.currentQty > 0) return -1;
    if (b.currentQty <= 0 && a.currentQty > 0) return 1;
    const covA = a.coverageDays ?? 999;
    const covB = b.coverageDays ?? 999;
    return covA - covB;
  });

  const rows = filtered.slice(0, limit).map((p) => ({
    kode: p.productCode,
    nama: p.productName,
    grup: p.group || "-",
    currentQty: num(p.currentQty, 0),
    unit: p.unit || "PCS",
    currentQtyKarton: num(p.currentQtyKarton || 0, 1),
    coverageDays: p.coverageDays !== null ? num(p.coverageDays, 1) : null,
    isStockout: Boolean(p.isStockout || p.currentQty <= 0),
    isLowStock: Boolean(p.isLowStock),
    isOverstock: Boolean(p.isOverstock),
  }));

  const stockSummary = stockInfo?.stockSummary;
  return {
    ok: true,
    data: {
      totalDitemukan: filtered.length,
      ditampilkan: rows.length,
      statusFilter: statusFilter || "semua",
      q: q || null,
      habisTotal: stockSummary?.habis ?? stockSummary?.stockout ?? 0,
      kritisTotal: stockSummary?.menipis ?? stockSummary?.low ?? 0,
      rows,
    },
  };
}

export function bacaTransaksi(_ctx = {}, params = {}, deps = {}) {
  const rawRows = typeof deps.getRawRows === "function" ? deps.getRawRows() : [];
  if (!rawRows.length) {
    return { ok: false, reason: "Data transaksi belum dimuat. Silakan upload file penjualan terlebih dahulu." };
  }

  const invoiceNo = str(params.invoiceNo ?? params.noFaktur ?? params.faktur ?? "", 40).toLowerCase();
  const outlet = str(params.outlet ?? params.namaOutlet ?? params.outletCode ?? "", 40).toLowerCase();
  const sales = str(params.sales ?? params.namaSales ?? params.salesCode ?? "", 40).toLowerCase();
  const produk = str(params.produk ?? params.namaProduk ?? params.productCode ?? "", 40).toLowerCase();
  const dari = str(params.dari ?? params.dateFrom ?? "", 20);
  const sampai = str(params.sampai ?? params.dateTo ?? "", 20);
  const limit = Math.min(Math.max(num(params.limit ?? 15, 0), 1), 50);

  // Single-pass linear filter & agregasi (mengeliminasi 9 iterasi berulang & alokasi memori berlebih)
  const filtered = [];
  let totalNilai = 0;
  let totalQty = 0;
  const uniqueInvoicesSet = new Set();
  const uniqueOutletsSet = new Set();

  for (let i = 0; i < rawRows.length; i++) {
    const r = rawRows[i];
    if (invoiceNo && !String(r.invoiceNo ?? "").toLowerCase().includes(invoiceNo)) continue;
    if (outlet) {
      const oName = String(r.outletName ?? "").toLowerCase();
      const oCode = String(r.outletCode ?? "").toLowerCase();
      if (!oName.includes(outlet) && !oCode.includes(outlet)) continue;
    }
    if (sales) {
      const sName = String(r.salesName ?? "").toLowerCase();
      const sCode = String(r.salesCode ?? "").toLowerCase();
      if (!sName.includes(sales) && !sCode.includes(sales)) continue;
    }
    if (produk) {
      const pName = String(r.productName ?? "").toLowerCase();
      const pCode = String(r.productCode ?? "").toLowerCase();
      if (!pName.includes(produk) && !pCode.includes(produk)) continue;
    }
    if (dari && (!r.date || r.date < dari)) continue;
    if (sampai && (!r.date || r.date > sampai)) continue;

    filtered.push(r);
    totalNilai += r.value || 0;
    totalQty += r.qty || 0;
    if (r.invoiceNo) uniqueInvoicesSet.add(r.invoiceNo);
    const ok = r.outletCode || r.outletName;
    if (ok) uniqueOutletsSet.add(ok);
  }

  // Urutkan transaksi terbaru di atas
  filtered.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  const rows = filtered.slice(0, limit).map((r) => ({
    date: r.date,
    invoiceNo: r.invoiceNo || "-",
    salesName: r.salesName || r.salesCode || "-",
    outletName: r.outletName || r.outletCode || "-",
    productName: r.productName || r.productCode || "-",
    qty: num(r.qty, 0),
    unit: r.unit || "PCS",
    value: num(r.value, 0),
  }));

  return {
    ok: true,
    data: {
      totalBaris: filtered.length,
      ditampilkan: rows.length,
      totalNilai: num(totalNilai, 0),
      totalQty: num(totalQty, 0),
      uniqueInvoices: uniqueInvoicesSet.size,
      uniqueOutlets: uniqueOutletsSet.size,
      filterDipakai: { invoiceNo: invoiceNo || null, outlet: outlet || null, sales: sales || null, produk: produk || null, dari: dari || null, sampai: sampai || null },
      rows,
    },
  };
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

export function runReadTool(tool, params = {}, ctx = {}, deps = {}) {
  switch (tool) {
    case "chat": return chat(ctx, params);
    case "queryData": return queryData(ctx, params);
    case "bacaBulanan": return bacaBulanan(ctx, params);
    case "bacaTarget": return bacaTarget(ctx, params);
    case "bacaJadwal": return bacaJadwal(ctx, params);
    case "bacaStok": return bacaStok(ctx, params, deps);
    case "cariStok": return cariStok(ctx, params, deps);
    case "bacaTransaksi": return bacaTransaksi(ctx, params, deps);
    case "analisis": return analisis(ctx, params);
    case "cariOutlet": return cariOutlet(ctx, params, deps);
    case "cariProduk": return cariProduk(ctx, params, deps);
    case "detailSales": return detailSales(ctx, params, deps);
    case "analisisDrop": return analisisDrop(ctx, params, deps);
    default: return { ok: false, reason: `Tool baca tak dikenal: ${String(tool)}.` };
  }
}


// ---------- TOOL BARU (Tahap 1): Smart Client-Side Search ----------

// cariOutlet: cari outlet berdasarkan nama/kode, filter status, sort omzet/transaksi/relevansi.
// Menggunakan ranking berbobot matchRanked (exact > starts-with > contains).
// Semua proses lokal di browser — rawRows diambil via deps.getRawRows().
export function cariOutlet(_ctx = {}, params = {}, deps = {}) {
  const rawRows = typeof deps.getRawRows === "function" ? deps.getRawRows() : [];
  if (!rawRows.length) return { ok: false, reason: "Data transaksi belum tersedia — upload file Excel dulu." };

  const outlets = buildOutletIndex(rawRows);
  const q = str(params.q ?? params.nama ?? params.kode ?? "", 60).toLowerCase();
  const status = str(params.status ?? "", 20).toLowerCase(); // "aktif" | "dormant" | "berisiko"
  const sortBy = str(params.sortBy ?? "", 20).toLowerCase(); // "value" | "transaksi" | "terakhir" | "relevansi"
  const limit = Math.min(Math.max(num(params.limit ?? 10, 0), 1), 30);

  // Hitung refDate HANYA jika status filter digunakan (hindari double iteration O(N) sia-sia)
  let refDate = null;
  if (status && (status === "aktif" || status === "berisiko" || status === "dormant")) {
    for (let i = 0; i < outlets.length; i++) {
      const d = outlets[i].lastDate;
      if (d && (!refDate || d > refDate)) refDate = d;
    }
  }

  let filtered = outlets;
  // Filter kata kunci berbobot (exact > starts-with > contains)
  if (q) {
    filtered = matchRanked(outlets, q, outlets.length);
  }
  // Filter status berdasarkan daysSinceLast
  if (status && refDate) {
    const refMs = new Date(refDate).getTime();
    filtered = filtered.filter((o) => {
      if (!o.lastDate) return status === "dormant";
      const days = Math.round((refMs - new Date(o.lastDate).getTime()) / 86400000);
      if (status === "aktif") return days <= 7;
      if (status === "berisiko") return days > 7 && days <= 30;
      if (status === "dormant") return days > 30;
      return true;
    });
  }
  // Sort: jika ada q dan tanpa sortBy eksplisit, pertahankan urutan relevansi matchRanked.
  if (sortBy === "transaksi") {
    filtered.sort((a, b) => b.invoiceCount - a.invoiceCount);
  } else if (sortBy === "terakhir") {
    filtered.sort((a, b) => ((b.lastDate || "") > (a.lastDate || "") ? 1 : -1));
  } else if (sortBy === "value" || (!q && !sortBy)) {
    filtered.sort((a, b) => b.value - a.value);
  }

  const rows = filtered.slice(0, limit).map((o) => ({
    code: str(o.code, 30), name: str(o.name, 40),
    value: num(o.value, 0), invoiceCount: o.invoiceCount,
    salesList: str(o.salesList, 60), lastDate: o.lastDate,
    activeDays: o.activeDays,
  }));
  return { ok: true, data: { total: filtered.length, ditampilkan: rows.length, q: q || null, status: status || null, sortBy: sortBy || (q ? "relevansi" : "value"), rows } };
}

// cariProduk: cari produk/SKU berdasarkan nama, grup, sort omzet/qty/relevansi.
export function cariProduk(_ctx = {}, params = {}, deps = {}) {
  const rawRows = typeof deps.getRawRows === "function" ? deps.getRawRows() : [];
  if (!rawRows.length) return { ok: false, reason: "Data transaksi belum tersedia — upload file Excel dulu." };

  const products = buildProductIndex(rawRows);
  const q = str(params.q ?? params.nama ?? params.kode ?? "", 60).toLowerCase();
  const grup = str(params.grup ?? params.group ?? "", 40).toLowerCase();
  const sortBy = str(params.sortBy ?? "", 20).toLowerCase(); // "value" | "qty" | "outlet" | "relevansi"
  const limit = Math.min(Math.max(num(params.limit ?? 10, 0), 1), 30);

  let filtered = products;
  if (q) {
    filtered = matchRanked(products, q, products.length);
  }
  if (grup) filtered = filtered.filter((p) => p.group.toLowerCase().includes(grup));

  if (sortBy === "qty") {
    filtered.sort((a, b) => b.qty - a.qty);
  } else if (sortBy === "outlet") {
    filtered.sort((a, b) => b.outletCount - a.outletCount);
  } else if (sortBy === "value" || (!q && !sortBy)) {
    filtered.sort((a, b) => b.value - a.value);
  }

  const rows = filtered.slice(0, limit).map((p) => ({
    code: str(p.code, 30), name: str(p.name, 50), group: str(p.group, 30),
    value: num(p.value, 0), qty: num(p.qty, 0),
    outletCount: p.outletCount, invoiceCount: p.invoiceCount,
  }));
  return { ok: true, data: { total: filtered.length, ditampilkan: rows.length, q: q || null, grup: grup || null, sortBy: sortBy || (q ? "relevansi" : "value"), rows } };
}

// detailSales: profil mendalam satu orang sales — ACH, outlet, produk top, tren bulanan.
export function detailSales(ctx = {}, params = {}, deps = {}) {
  const rawRows = typeof deps.getRawRows === "function" ? deps.getRawRows() : [];
  const kodeParam = str(params.kode ?? params.nama ?? "", 60).toLowerCase();
  if (!kodeParam) return { ok: false, reason: "detailSales butuh params.kode atau params.nama sales." };
  if (!rawRows.length) return { ok: false, reason: "Data transaksi belum tersedia." };

  // Temukan sales dari ctx atau targets dengan scoring matchRanked (exact > starts-with > contains)
  const ctxSales = asArray(ctx.semua?.sales?.length ? ctx.semua.sales : ctx.sales);
  const rankedSales = matchRanked(
    ctxSales.map((s) => ({ ...s, name: s.nama || s.name || "", code: s.kode || s.id || "" })),
    kodeParam,
    1
  );
  const matchedSales = rankedSales[0] || null;
  const salesCode = matchedSales?.code || matchedSales?.kode || kodeParam;
  const salesNama = matchedSales?.name || matchedSales?.nama || salesCode;

  // Filter rawRows untuk sales ini (cache lowerSalesCode agar tidak toLowerCase berulang pada N baris)
  const lowerCode = salesCode.toLowerCase();
  const rows = rawRows.filter((r) =>
    String(r.salesCode ?? "").toLowerCase() === lowerCode ||
    String(r.salesName ?? "").toLowerCase().includes(kodeParam)
  );
  if (!rows.length) return { ok: false, reason: `Sales "${kodeParam}" tidak ditemukan di data transaksi.` };

  // Hitung total & ACH dari ctx jika ada, fallback hitung dari rawRows
  const ctxData = matchedSales ?? {};
  const total = ctxData.realisasi ?? ctxData.total ?? rows.reduce((s, r) => s + (r.value || 0), 0);
  const target = ctxData.target ?? 0;
  const ach = target > 0 ? num((total / target) * 100, 1) : null;

  // Top 5 outlet berdasarkan nilai
  const outletMap = new Map();
  const monthMap = new Map();
  for (const r of rows) {
    // Outlet
    const ok = r.outletCode || r.outletName || "";
    if (ok) {
      const o = outletMap.get(ok) || { name: r.outletName || ok, value: 0, count: 0, lastDate: null };
      o.value += r.value || 0; o.count++;
      if (!o.lastDate || r.date > o.lastDate) o.lastDate = r.date;
      outletMap.set(ok, o);
    }
    // Tren bulanan
    if (r.date?.length >= 7) {
      const mk = r.date.slice(0, 7);
      const m = monthMap.get(mk) || { bulan: mk, value: 0, count: 0 };
      m.value += r.value || 0; m.count++;
      monthMap.set(mk, m);
    }
  }
  const topOutlet = Array.from(outletMap.values()).sort((a, b) => b.value - a.value).slice(0, 5).map((o) => ({
    name: str(o.name, 40), value: num(o.value, 0), count: o.count, lastDate: o.lastDate,
  }));
  const tren = Array.from(monthMap.values()).sort((a, b) => a.bulan > b.bulan ? 1 : -1).slice(-6).map((m) => ({
    bulan: m.bulan, value: num(m.value, 0), count: m.count,
  }));

  // Total AO (outlet unik)
  const ao = outletMap.size;
  return {
    ok: true, data: {
      salesCode, nama: str(salesNama, 50), total: num(total, 0), target: num(target, 0),
      ach, ao, nBaris: rows.length, topOutlet, tren,
    },
  };
}

// analisisDrop: bandingkan cakupan filter saat ini vs semua data, temukan gap terbesar.
// Tidak butuh rawRows mentah — cukup agregat dari ctx.
export function analisisDrop(ctx = {}, _params = {}, _deps = {}) {
  const salesFilter = asArray(ctx.sales); // Sales di layar saat ini
  const salesAll = asArray(ctx.semua?.sales); // Semua sales
  if (!salesAll.length && !salesFilter.length) {
    return { ok: false, reason: "Data sales belum tersedia — upload data dan pastikan AI Chat dibuka." };
  }

  const src = salesAll.length ? salesAll : salesFilter;
  // Urutkan dari ACH terendah
  const sorted = [...src].sort((a, b) => num(a.ach ?? 0) - num(b.ach ?? 0));
  const merahTotal = sorted.filter((s) => num(s.ach ?? 0) < 100);
  const merah5 = merahTotal.slice(0, 5).map((s) => ({
    nama: str(s.nama ?? s.kode ?? "", 40), ach: num(s.ach ?? 0, 1),
    realisasi: num(s.realisasi ?? s.total ?? 0, 0), target: num(s.target ?? 0, 0),
  }));
  const achGlobal = ctx.semua?.ach ?? ctx.achGlobal ?? null;
  const nBaris = ctx.semua?.nBaris ?? ctx.nBaris ?? 0;

  // Hitung potensi gap (total target - total realisasi untuk yang merah)
  const gapTotal = merahTotal.reduce((s, x) => {
    const t = num(x.target ?? 0); const r = num(x.realisasi ?? x.total ?? 0);
    return s + Math.max(t - r, 0);
  }, 0);
  return {
    ok: true, data: {
      achGlobal: num(achGlobal ?? 0, 1), nBaris: num(nBaris, 0),
      totalSales: src.length, salesMerah: merahTotal.length,
      merah5, gapTotal: num(gapTotal, 0),
      ringkasan: `ACH global ${num(achGlobal ?? 0, 1)}%. ${merahTotal.length} dari ${src.length} sales di bawah 100% target. ` +
        (merah5.length ? `Terendah: ${merah5.map((s) => s.nama + " " + s.ach + "%").join(", ")}. ` : "") +
        (gapTotal > 0 ? `Gap total dari sales merah: ${(gapTotal / 1e6).toFixed(1)}jt.` : ""),
    },
  };
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
    // Tahap 2: UI Action Tools
    case "navigasiTab": return buildNavigasiTab(params, ctx, deps);
    case "aturFilter": return buildAturFilter(params, ctx, deps);
    case "resetFilter": return buildResetFilter(params, ctx, deps);
    default: return { ok: false, reason: `Tool tulis tak dikenal: ${String(tool)}.` };
  }
}

// Dispatcher UI: baca langsung jalan; tulis WAJIB lewat preview + run() sesudah konfirmasi.
export function executeAiTool(tool, params = {}, ctx = {}, deps = {}) {
  if (isWriteTool(tool)) return buildWriteTool(tool, params, ctx, deps);
  return runReadTool(tool, params, ctx, deps);
}

// ---------- WRITE TOOLS BARU (Tahap 2): UI Action ----------

// Peta tab: key → nama tampilan Bahasa Indonesia.
const TAB_LABELS = {
  executive: "Executive Summary",
  main: "Main Report",
  sales: "Sales Report",
  product: "Product Report",
  focus: "Produk Fokus",
  outlet: "Analisis Outlet",
  trend: "Tren Periode",
  compare: "Perbandingan",
  transactions: "Transaksi",
  stock: "Stok Barang",
  quality: "Catatan Data",
};
const VALID_TABS = new Set(Object.keys(TAB_LABELS));

// navigasiTab: pindahkan tab dashboard aktif ke tab yang diminta.
// deps.goToTab harus tersedia dari SalesMonitoringApp.
export function buildNavigasiTab(params = {}, _ctx = {}, deps = {}) {
  const tab = str(params.tab ?? "", 30).toLowerCase().trim();
  if (!tab) return { ok: false, reason: "navigasiTab butuh params.tab (nama tab)." };
  if (!VALID_TABS.has(tab)) {
    return {
      ok: false,
      reason: `Tab "${tab}" tidak dikenal. Tab yang tersedia: ${[...VALID_TABS].join(", ")}.`,
    };
  }
  const namaTab = TAB_LABELS[tab];
  const preview = {
    judul: `Pindah ke halaman: ${namaTab}`,
    baris: [`Tab tujuan: ${namaTab} (key: "${tab}")`],
  };
  const run = () => {
    if (typeof deps.goToTab === "function") {
      deps.goToTab(tab);
      return { ok: true, pesan: `Berhasil berpindah ke ${namaTab}.` };
    }
    return { ok: false, reason: "deps.goToTab tidak tersedia." };
  };
  return { ok: true, preview, run };
}

// aturFilter: ubah filter dashboard (salesCodes, groups, dateFrom, dateTo, datePreset).
// Hanya field yang dikirim LLM yang berubah — field lain tetap (merge dengan prev).
export function buildAturFilter(params = {}, _ctx = {}, deps = {}) {
  const filtersAktif = typeof deps.getFilters === "function" ? deps.getFilters() : {};

  // Normalisasi params
  const salesCodes = Array.isArray(params.salesCodes)
    ? params.salesCodes.map((s) => String(s).trim()).filter(Boolean)
    : null;
  const groups = Array.isArray(params.groups)
    ? params.groups.map((g) => String(g).trim()).filter(Boolean)
    : null;
  const dateFrom = typeof params.dateFrom === "string" && params.dateFrom ? params.dateFrom.trim() : null;
  const dateTo = typeof params.dateTo === "string" && params.dateTo ? params.dateTo.trim() : null;
  const datePreset = typeof params.datePreset === "string" && params.datePreset ? params.datePreset.trim() : null;

  // Susun ringkasan perubahan untuk preview
  const perubahanBaris = [];
  if (salesCodes !== null) {
    perubahanBaris.push(salesCodes.length
      ? `Sales: ${salesCodes.join(", ")} (${salesCodes.length} dipilih)`
      : "Sales: semua (filter sales dihapus)");
  } else {
    perubahanBaris.push(`Sales: tidak berubah (saat ini: ${(filtersAktif.salesCodes || []).length || "semua"})`);
  }
  if (groups !== null) {
    perubahanBaris.push(groups.length
      ? `Grup produk: ${groups.join(", ")}`
      : "Grup produk: semua (filter grup dihapus)");
  }
  if (dateFrom || dateTo) {
    perubahanBaris.push(`Tanggal: ${dateFrom || "awal"} s/d ${dateTo || "akhir"}`);
  }
  if (datePreset) {
    perubahanBaris.push(`Preset tanggal: ${datePreset}`);
  }
  if (perubahanBaris.length === 1 && perubahanBaris[0].includes("tidak berubah")) {
    return { ok: false, reason: "aturFilter tidak menerima perubahan valid — minimal satu dari salesCodes, groups, dateFrom, dateTo, atau datePreset harus dikirim." };
  }

  const preview = {
    judul: "Terapkan Filter Dashboard",
    baris: perubahanBaris,
  };
  const run = () => {
    if (typeof deps.setFilters !== "function") return { ok: false, reason: "deps.setFilters tidak tersedia." };
    deps.setFilters((prev) => ({
      ...prev,
      ...(salesCodes !== null ? { salesCodes } : {}),
      ...(groups !== null ? { groups } : {}),
      ...(dateFrom !== null ? { dateFrom } : {}),
      ...(dateTo !== null ? { dateTo } : {}),
      ...(datePreset !== null ? { datePreset } : {}),
      // Jika tanggal diset manual tanpa preset, tandai sebagai custom
      ...(dateFrom !== null || dateTo !== null ? { datePreset: datePreset ?? "custom" } : {}),
    }));
    return { ok: true, pesan: "Filter berhasil diterapkan. Dashboard diperbarui." };
  };
  return { ok: true, preview, run };
}

// resetFilter: hapus semua filter aktif — kembalikan ke default "tampilkan semua".
export function buildResetFilter(_params = {}, _ctx = {}, deps = {}) {
  const filtersAktif = typeof deps.getFilters === "function" ? deps.getFilters() : {};
  const salesAktif = (filtersAktif.salesCodes || []).length;
  const groupsAktif = (filtersAktif.groups || []).length;
  const tanggalAktif = filtersAktif.dateFrom || filtersAktif.dateTo;

  const info = [];
  if (salesAktif) info.push(`${salesAktif} filter sales akan dihapus`);
  if (groupsAktif) info.push(`${groupsAktif} filter grup akan dihapus`);
  if (tanggalAktif) info.push(`Filter tanggal (${filtersAktif.dateFrom || "?"} – ${filtersAktif.dateTo || "?"}) akan dihapus`);
  if (!info.length) info.push("Tidak ada filter aktif saat ini");

  const preview = {
    judul: "Reset Semua Filter Dashboard",
    baris: [...info, "→ Semua data akan ditampilkan kembali"],
  };
  const run = () => {
    if (typeof deps.setFilters !== "function") return { ok: false, reason: "deps.setFilters tidak tersedia." };
    deps.setFilters({ salesCodes: [], groups: [], dateFrom: "", dateTo: "", datePreset: "all" });
    return { ok: true, pesan: "Semua filter dihapus. Dashboard menampilkan seluruh data." };
  };
  return { ok: true, preview, run };
}
