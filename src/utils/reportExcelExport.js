import * as XLSX_MODULE from "xlsx-js-style";
const XLSX = XLSX_MODULE.default || XLSX_MODULE;
import { todayLocalDateStr } from "./excelParse.js";
import { XL_COLORS, XL_NUMFMT_MONEY, XL_NUMFMT_INT, XL_NUMFMT_QTY, XL_NUMFMT_PCT1, achGradientColor, makeSheetBuilder, writeTitleBlock, writeHeaderRow, sanitizeFilename } from "./xlsxStyle.js";
import { getProductBreakdownForGroup } from "./aggregation.js";
import { getStoredSchedule, DAY_LABELS, DAY_COLORS } from "./visitScheduleStorage.js";

/* ============================================================================
   EXPORT EXCEL — Sales Report, Product Report, Product Focus, Analisis Outlet
   Setiap fungsi di sini membangun workbook yang isinya PERSIS mencerminkan
   tabel yang sudah tampil di layar pada halaman masing-masing — bukan format
   baru. Style (header fill, border, gradient ACH) reuse dari xlsxStyle.js
   supaya semua file export terasa konsisten satu sama lain.
============================================================================ */

/* ---------------------------------------------------------------------------
   1. SALES REPORT — 2 sheet: Per Grup, Total vs Hari Terakhir
--------------------------------------------------------------------------- */
export function exportSalesReportExcel(agg, groupRows, totalVsLastDayRows, opts = {}) {
  const { depotName = "", dateRangeLabel = "" } = opts;
  const wb = XLSX.utils.book_new();

  // Sheet 1: Per Grup
  const b1 = makeSheetBuilder();
  writeTitleBlock(b1, "Sales Report — Per Grup Produk", `${depotName} · ${dateRangeLabel} · Dibuat ${todayLocalDateStr()}`, 4);
  writeHeaderRow(b1, 4, ["Sales", "Grup Produk", "Realisasi", "AO"]);
  groupRows.forEach((r, i) => {
    const row = 5 + i;
    b1.setCell(row, 1, r.salesName);
    b1.setCell(row, 2, r.groupName);
    b1.setCell(row, 3, r.value, { numFmt: XL_NUMFMT_MONEY });
    b1.setCell(row, 4, r.ao, { numFmt: XL_NUMFMT_INT });
  });
  XLSX.utils.book_append_sheet(wb, b1.finalize([22, 22, 18, 10]), "Per Grup");

  // Sheet 2: Total vs Hari Terakhir
  const b2 = makeSheetBuilder();
  writeTitleBlock(b2, "Sales Report — Total Periode vs Hari Terakhir", `${depotName} · ${dateRangeLabel} · Dibuat ${todayLocalDateStr()}`, 7);
  writeHeaderRow(b2, 4, ["Sales", "Realisasi Total", "AO Total", "ACH Value Total", "ACH AO Total", "Realisasi Hari Terakhir", "AO Hari Terakhir"]);
  totalVsLastDayRows.forEach((r, i) => {
    const row = 5 + i;
    const achValueFill = achGradientColor(r.totalAch);
    const achAoFill = achGradientColor(r.totalAchAo);
    b2.setCell(row, 1, r.salesName);
    b2.setCell(row, 2, r.totalValue, { numFmt: XL_NUMFMT_MONEY });
    b2.setCell(row, 3, r.totalAo, { numFmt: XL_NUMFMT_INT });
    b2.setCell(row, 4, r.totalAch !== null && r.totalAch !== undefined ? r.totalAch : "", { numFmt: XL_NUMFMT_PCT1, fill: achValueFill || undefined });
    b2.setCell(row, 5, r.totalAchAo !== null && r.totalAchAo !== undefined ? r.totalAchAo : "", { numFmt: XL_NUMFMT_PCT1, fill: achAoFill || undefined });
    b2.setCell(row, 6, r.lastDayValue, { numFmt: XL_NUMFMT_MONEY });
    b2.setCell(row, 7, r.lastDayAo, { numFmt: XL_NUMFMT_INT });
  });
  XLSX.utils.book_append_sheet(wb, b2.finalize([22, 18, 12, 14, 14, 20, 16]), "Total vs Hari Terakhir");

  XLSX.writeFile(wb, `Sales_Report_${(depotName || "depo").replace(/[^a-z0-9]+/gi, "_")}_${todayLocalDateStr()}.xlsx`);
}

/* ---------------------------------------------------------------------------
   2. PRODUCT REPORT — 1 sheet: Per Grup Produk
--------------------------------------------------------------------------- */
export function exportProductReportExcel(byGroup, opts = {}) {
  const { depotName = "", dateRangeLabel = "" } = opts;
  const wb = XLSX.utils.book_new();
  const b = makeSheetBuilder();
  writeTitleBlock(b, "Product Report — Pencapaian per Grup Produk", `${depotName} · ${dateRangeLabel} · Dibuat ${todayLocalDateStr()}`, 5);
  writeHeaderRow(b, 4, ["Grup Produk", "Target", "Realisasi", "ACH%", "Jumlah Outlet"]);
  byGroup.forEach((r, i) => {
    const row = 5 + i;
    const achFill = achGradientColor(r.ach);
    b.setCell(row, 1, r.name);
    b.setCell(row, 2, r.targetValue, { numFmt: XL_NUMFMT_MONEY });
    b.setCell(row, 3, r.realisasiValue, { numFmt: XL_NUMFMT_MONEY });
    b.setCell(row, 4, r.ach !== null && r.ach !== undefined ? r.ach : "", { numFmt: XL_NUMFMT_PCT1, fill: achFill || undefined });
    b.setCell(row, 5, r.realisasiAo, { numFmt: XL_NUMFMT_INT });
  });
  XLSX.utils.book_append_sheet(wb, b.finalize([24, 18, 18, 10, 14]), "Per Grup Produk");
  XLSX.writeFile(wb, `Product_Report_${(depotName || "depo").replace(/[^a-z0-9]+/gi, "_")}_${todayLocalDateStr()}.xlsx`);
}

/* ---------------------------------------------------------------------------
   2b. SKU ANALYSIS — 1 sheet: Analisis SKU Lengkap
--------------------------------------------------------------------------- */
export function exportSkuAnalysisExcel(aggOrSkuList, opts = {}) {
  const { depotName = "", dateRangeLabel = "", selectedGroup = "Semua Grup" } = opts;
  let skuList = [];

  if (Array.isArray(aggOrSkuList)) {
    skuList = aggOrSkuList;
  } else if (aggOrSkuList && aggOrSkuList.filteredRows) {
    const totalActiveOutlets = (aggOrSkuList.byOutlet && aggOrSkuList.byOutlet.length > 0)
      ? aggOrSkuList.byOutlet.length
      : new Set((aggOrSkuList.filteredRows || []).map((r) => r.outletCode || r.outletName).filter(Boolean)).size || 1;
    const totalPeriodValue = aggOrSkuList.totals?.realisasiValue || (aggOrSkuList.byGroup || []).reduce((s, g) => s + (g.realisasiValue || 0), 0) || 1;
    const raw = getProductBreakdownForGroup(aggOrSkuList.filteredRows, null);
    skuList = raw.map((p) => ({
      ...p,
      penetrationPct: totalActiveOutlets > 0 ? Number(((p.outletCount / totalActiveOutlets) * 100).toFixed(1)) : 0,
      contributionPct: totalPeriodValue > 0 ? Number(((p.value / totalPeriodValue) * 100).toFixed(1)) : 0,
    }));
  }

  const wb = XLSX.utils.book_new();
  const b = makeSheetBuilder();

  // Mini summary
  const totalSku = skuList.length;
  const totalVolume = skuList.reduce((s, p) => s + (p.qty || 0), 0);
  const totalValue = skuList.reduce((s, p) => s + (p.value || 0), 0);
  const avgPenetration = totalSku > 0
    ? (skuList.reduce((s, p) => s + (p.penetrationPct || 0), 0) / totalSku)
    : 0;

  const filterInfo = selectedGroup && selectedGroup !== "all" && selectedGroup !== "Semua Grup"
    ? ` · Filter Grup: ${selectedGroup}`
    : "";
  writeTitleBlock(
    b,
    "Laporan Analisis Produk & SKU Lengkap",
    `${depotName} · ${dateRangeLabel}${filterInfo} · Dibuat ${todayLocalDateStr()}`,
    14
  );

  // Baris 4: Header Ringkasan
  b.setCell(4, 1, "RINGKASAN EKSEKUTIF", { bold: true, size: 10, fill: "F3F4F6", color: XL_COLORS.navy });
  for (let c = 2; c <= 14; c++) {
    b.setCell(4, c, "", { fill: "F3F4F6" });
  }
  b.merge(4, 1, 4, 14);

  // Baris 5: Indikator Ringkasan
  b.setCell(5, 1, "Total SKU Aktif:", { bold: true, size: 9, color: "4B5563" });
  b.setCell(5, 2, totalSku, { bold: true, numFmt: XL_NUMFMT_INT });
  b.setCell(5, 4, "Total Volume Terjual:", { bold: true, size: 9, color: "4B5563" });
  const roundedTotalVolume = Math.round(totalVolume * 100) / 100;
  b.setCell(5, 5, roundedTotalVolume, { bold: true, numFmt: Number.isInteger(roundedTotalVolume) ? XL_NUMFMT_INT : XL_NUMFMT_QTY });
  b.setCell(5, 7, "Total Realisasi Omset:", { bold: true, size: 9, color: "4B5563" });
  b.setCell(5, 8, totalValue, { bold: true, numFmt: XL_NUMFMT_MONEY });
  b.setCell(5, 10, "Rata-rata Penetrasi Toko:", { bold: true, size: 9, color: "4B5563" });
  b.setCell(5, 11, avgPenetration / 100, { bold: true, numFmt: XL_NUMFMT_PCT1 });

  // Baris 7: Header Kolom
  const headers = [
    "No",
    "Kode SKU",
    "Nama Produk",
    "Grup Produk",
    "Klasifikasi",
    "Volume Terjual",
    "Satuan",
    "Nilai Penjualan (Rp)",
    "% Kontribusi Omset",
    "Sebaran Toko (AO)",
    "% Penetrasi Toko",
    "Frekuensi Faktur",
    "Tim Sales",
    "Transaksi Terakhir",
  ];
  writeHeaderRow(b, 7, headers, XL_COLORS.headerCyan);

  // Sort descending by value
  const sorted = [...skuList].sort((a, b) => (b.value || 0) - (a.value || 0));

  sorted.forEach((r, i) => {
    const row = 8 + i;
    let classification = "Reguler";
    let classFill = undefined;
    if (i < 5) {
      classification = `Bintang #${i + 1}`;
      classFill = "FEF3C7"; // Amber pastel
    } else if (sorted.length > 5 && i >= sorted.length - 5) {
      classification = `Slow-Moving #${sorted.length - i}`;
      classFill = "FEE2E2"; // Coral pastel
    }

    b.setCell(row, 1, i + 1, { align: "center", numFmt: XL_NUMFMT_INT });
    b.setCell(row, 2, r.productCode || "-");
    b.setCell(row, 3, r.productName || "-");
    b.setCell(row, 4, r.group || "-");
    b.setCell(row, 5, classification, { align: "center", bold: classification !== "Reguler", fill: classFill });
    const qtyVal = typeof r.qty === "number" ? Math.round(r.qty * 100) / 100 : 0;
    b.setCell(row, 6, qtyVal, { numFmt: Number.isInteger(qtyVal) ? XL_NUMFMT_INT : XL_NUMFMT_QTY, align: "right" });
    b.setCell(row, 7, r.unit || "-", { align: "center" });
    b.setCell(row, 8, r.value || 0, { numFmt: XL_NUMFMT_MONEY, align: "right" });
    b.setCell(row, 9, (r.contributionPct || 0) / 100, { numFmt: XL_NUMFMT_PCT1, align: "right" });
    b.setCell(row, 10, r.outletCount || 0, { numFmt: XL_NUMFMT_INT, align: "right" });
    b.setCell(row, 11, (r.penetrationPct || 0) / 100, { numFmt: XL_NUMFMT_PCT1, align: "right" });
    b.setCell(row, 12, r.invoiceCount || 0, { numFmt: XL_NUMFMT_INT, align: "right" });
    b.setCell(row, 13, r.salesLabel || "-");
    b.setCell(row, 14, r.lastDate || "-", { align: "center" });
  });

  if (sorted.length > 0) {
    const totalRow = 8 + sorted.length;
    b.setCell(totalRow, 1, "TOTAL", { bold: true, fill: XL_COLORS.headerCyan, align: "center" });
    for (let c = 2; c <= 5; c++) {
      b.setCell(totalRow, c, "", { fill: XL_COLORS.headerCyan });
    }
    b.merge(totalRow, 1, totalRow, 5);
    b.setCell(totalRow, 6, Math.round(totalVolume), { bold: true, numFmt: XL_NUMFMT_INT, fill: XL_COLORS.headerCyan, align: "right" });
    b.setCell(totalRow, 7, "", { fill: XL_COLORS.headerCyan });
    b.setCell(totalRow, 8, totalValue, { bold: true, numFmt: XL_NUMFMT_MONEY, fill: XL_COLORS.headerCyan, align: "right" });
    b.setCell(totalRow, 9, 1.0, { bold: true, numFmt: XL_NUMFMT_PCT1, fill: XL_COLORS.headerCyan, align: "right" });
    for (let c = 10; c <= 14; c++) {
      b.setCell(totalRow, c, "", { fill: XL_COLORS.headerCyan });
    }
  }

  // Lebar kolom adaptif
  const colWidths = [6, 16, 32, 18, 18, 16, 10, 22, 18, 16, 16, 16, 26, 16];
  XLSX.utils.book_append_sheet(wb, b.finalize(colWidths), "Analisis SKU");

  const depotPart = sanitizeFilename(depotName || "depo");
  XLSX.writeFile(wb, `Analisis_SKU_${depotPart}_${todayLocalDateStr()}.xlsx`);
}

/* ---------------------------------------------------------------------------
   3. PRODUCT FOCUS — 1 sheet
--------------------------------------------------------------------------- */
export function exportProductFocusExcel(rows, opts = {}) {
  const { depotName = "", dateRangeLabel = "" } = opts;
  const wb = XLSX.utils.book_new();
  const b = makeSheetBuilder();
  writeTitleBlock(b, "Product Focus — Pencapaian Produk Fokus per Sales", `${depotName} · ${dateRangeLabel} · Dibuat ${todayLocalDateStr()}`, 6);
  writeHeaderRow(b, 4, ["Sales", "Produk Fokus", "Target", "Realisasi", "Satuan", "%"]);
  let hasUnconvertible = false;
  rows.forEach((r, i) => {
    const row = 5 + i;
    if (r.hasUnconvertible) hasUnconvertible = true;
    const achFill = achGradientColor(r.pct);
    b.setCell(row, 1, r.salesName);
    b.setCell(row, 2, r.name + (r.hasUnconvertible ? " *" : ""));
    b.setCell(row, 3, r.target, { numFmt: XL_NUMFMT_INT });
    b.setCell(row, 4, r.realisasi, { numFmt: XL_NUMFMT_INT });
    b.setCell(row, 5, r.unit || "-");
    b.setCell(row, 6, r.pct !== null && r.pct !== undefined ? r.pct : "", { numFmt: XL_NUMFMT_PCT1, fill: achFill || undefined });
  });
  let lastRow = b.getLastRow();
  if (hasUnconvertible) {
    lastRow += 1;
    b.setCell(lastRow, 1, "* Sebagian transaksi produk ini tidak bisa dikonversi ke satuan karton — angka realisasi memakai satuan asli.", { size: 8, color: "6B7280" });
    b.merge(lastRow, 1, lastRow, 6);
  }
  XLSX.utils.book_append_sheet(wb, b.finalize([22, 26, 14, 14, 10, 10]), "Produk Fokus");
  XLSX.writeFile(wb, `Product_Focus_${(depotName || "depo").replace(/[^a-z0-9]+/gi, "_")}_${todayLocalDateStr()}.xlsx`);
}

/* ---------------------------------------------------------------------------
   4. ANALISIS OUTLET — ringkasan + 1 sheet detail
   ⚠️ Sprint 17i: tambah kolom "Kode Outlet" di awal + "Alamat" setelah Nama.
   Urutan baru: Kode Outlet | Nama Outlet | Alamat | Sales | Total Value |
   Frekuensi | Grup Produk | Terakhir Transaksi | Jeda (hari) | Status
   Alamat bersifat opsional — bila file Excel sumber tidak punya kolom alamat,
   cell akan berisi "-" (lebih jelas daripada kosong).
--------------------------------------------------------------------------- */
export function exportOutletAnalysisExcel(list, summary, opts = {}) {
  const { depotName = "", dateRangeLabel = "" } = opts;
  const wb = XLSX.utils.book_new();
  const b = makeSheetBuilder();
  // 11 kolom: Kode Outlet | Nama Outlet | Alamat | Sales | Hari Kunjungan | Total Value | Frekuensi | Grup Produk | Terakhir Transaksi | Jeda (hari) | Status
  writeTitleBlock(b, "Analisis Outlet", `${depotName} · ${dateRangeLabel} · Dibuat ${todayLocalDateStr()}`, 11);

  // Ringkasan kecil (Total/Aktif/Berisiko/Dormant)
  b.setCell(3, 1, "Total Outlet", { bold: true, size: 9, color: "6B7280" });
  b.setCell(3, 2, summary.total, { numFmt: XL_NUMFMT_INT });
  b.setCell(3, 3, "Aktif", { bold: true, size: 9, color: "6B7280" });
  b.setCell(3, 4, summary.active, { numFmt: XL_NUMFMT_INT, fill: XL_COLORS.mint });
  b.setCell(3, 5, "Berisiko", { bold: true, size: 9, color: "6B7280" });
  b.setCell(3, 6, summary.atRisk, { numFmt: XL_NUMFMT_INT, fill: XL_COLORS.yellowTier });
  b.setCell(3, 7, "Dormant", { bold: true, size: 9, color: "6B7280" });
  b.setCell(3, 8, summary.dormant, { numFmt: XL_NUMFMT_INT });

  // Header row: 11 kolom
  writeHeaderRow(b, 5, [
    "Kode Outlet", "Nama Outlet", "Alamat", "Sales", "Hari Kunjungan",
    "Total Value", "Frekuensi", "Grup Produk",
    "Terakhir Transaksi", "Jeda (hari)", "Status",
  ]);
  const STATUS_LABEL = { active: "Aktif", at_risk: "Berisiko", dormant: "Dormant" };
  const schedule = opts.schedule || getStoredSchedule(depotName);

  list.forEach((o, i) => {
    const row = 6 + i;
    b.setCell(row, 1, o.outletCode || "-");
    b.setCell(row, 2, o.outletName);
    b.setCell(row, 3, o.outletAddress || "-");
    b.setCell(row, 4, o.salesLabel);

    // Hari Kunjungan dengan warna selaras badge aplikasi
    const sched = schedule[o.outletCode];
    const dayKey = String(sched?.day || "").trim().toLowerCase();
    const colorConf = DAY_COLORS[dayKey];
    if (colorConf) {
      b.setCell(row, 5, DAY_LABELS[dayKey] || sched.day, {
        bold: true,
        align: "center",
        fill: colorConf.lightBg.replace("#", ""),
        color: colorConf.lightText.replace("#", ""),
      });
    } else {
      b.setCell(row, 5, "Belum", {
        bold: true,
        align: "center",
        fill: "FFE4E6",
        color: "E11D48",
      });
    }

    b.setCell(row, 6, o.value, { numFmt: XL_NUMFMT_MONEY });
    b.setCell(row, 7, o.invoiceCount, { numFmt: XL_NUMFMT_INT });
    b.setCell(row, 8, o.groupCount, { numFmt: XL_NUMFMT_INT });
    b.setCell(row, 9, o.lastDate || "-");
    b.setCell(row, 10, o.daysSinceLastPurchase ?? "-", { numFmt: XL_NUMFMT_INT });
    b.setCell(row, 11, STATUS_LABEL[o.status] || o.status, {
      fill: o.status === "active" ? XL_COLORS.mint : o.status === "at_risk" ? XL_COLORS.yellowTier : undefined,
    });
  });

  // Lebar kolom array 11 elemen
  XLSX.utils.book_append_sheet(wb, b.finalize([14, 26, 32, 22, 16, 18, 12, 12, 16, 12, 12]), "Analisis Outlet");
  XLSX.writeFile(wb, `Analisis_Outlet_${(depotName || "depo").replace(/[^a-z0-9]+/gi, "_")}_${todayLocalDateStr()}.xlsx`);
}

/* ---------------------------------------------------------------------------
   6. TRANSAKSI — 1 sheet: Daftar transaksi dengan urutan kolom spesifik:
   tanggal, kode sales, nama sales, kode outlet, nama outlet, alamat outlet,
   produk, grup, qty, satuan, value, nomor invoice.
--------------------------------------------------------------------------- */
export function exportTransactionsExcel(rows, opts = {}) {
  const { depotName = "", dateRangeLabel = "" } = opts;
  const wb = XLSX.utils.book_new();
  const b = makeSheetBuilder();

  const subtitle = [
    depotName,
    dateRangeLabel,
    `${rows.length} transaksi`,
    `Dibuat ${todayLocalDateStr()}`,
  ].filter(Boolean).join(" · ");

  writeTitleBlock(b, "Laporan Transaksi Penjualan", subtitle, 12);

  // Header row: 12 kolom
  writeHeaderRow(b, 4, [
    "Tanggal",
    "Kode Sales",
    "Nama Sales",
    "Kode Outlet",
    "Nama Outlet",
    "Alamat Outlet",
    "Produk",
    "Grup",
    "Qty",
    "Satuan",
    "Value",
    "Nomor Invoice",
  ]);

  let totalQty = 0;
  let totalValue = 0;

  rows.forEach((r, i) => {
    const row = 5 + i;
    const q = Number(r.qty) || 0;
    const v = Number(r.value) || 0;
    totalQty += q;
    totalValue += v;

    b.setCell(row, 1, r.date || "-");
    b.setCell(row, 2, r.salesCode || "-");
    b.setCell(row, 3, r.salesName || "-");
    b.setCell(row, 4, r.outletCode || "-");
    b.setCell(row, 5, r.outletName || "-");
    b.setCell(row, 6, r.outletAddress || "-");
    b.setCell(row, 7, r.productName || r.productCode || "-");
    b.setCell(row, 8, r.group || "-");
    b.setCell(row, 9, q, { numFmt: XL_NUMFMT_INT });
    b.setCell(row, 10, r.unit || "-", { align: "center" });
    b.setCell(row, 11, v, { numFmt: XL_NUMFMT_MONEY });
    b.setCell(row, 12, r.invoiceNo || "-");
  });

  if (rows.length > 0) {
    const totalRow = 5 + rows.length;
    b.setCell(totalRow, 1, "TOTAL", { bold: true, fill: XL_COLORS.headerCyan, align: "center" });
    for (let c = 2; c <= 8; c++) {
      b.setCell(totalRow, c, "", { fill: XL_COLORS.headerCyan });
    }
    b.merge(totalRow, 1, totalRow, 8);
    b.setCell(totalRow, 9, totalQty, { bold: true, numFmt: XL_NUMFMT_INT, fill: XL_COLORS.headerCyan, align: "right" });
    b.setCell(totalRow, 10, "", { fill: XL_COLORS.headerCyan });
    b.setCell(totalRow, 11, totalValue, { bold: true, numFmt: XL_NUMFMT_MONEY, fill: XL_COLORS.headerCyan, align: "right" });
    b.setCell(totalRow, 12, "", { fill: XL_COLORS.headerCyan });
  }

  // Lebar 12 kolom
  XLSX.utils.book_append_sheet(wb, b.finalize([13, 12, 22, 14, 28, 32, 28, 16, 10, 10, 18, 18]), "Transaksi");
  XLSX.writeFile(wb, `Transaksi_${(depotName || "depo").replace(/[^a-z0-9]+/gi, "_")}_${todayLocalDateStr()}.xlsx`);
}
