import html2canvas from "html2canvas";
import { fmtRp, fmtNum, fmtPct } from "./formatters.js";
import { dateStrToLocalDate } from "./excelParse.js";

/* ============================================================================
   IMAGE EXPORT
   Karena jsPDF dan xlsx-js-style tidak bisa menghasilkan gambar langsung,
   pendekatan di sini: bangun ulang laporan yang sama sebagai HTML biasa
   (warna & struktur meniru template PDF/Excel yang sudah ada), render ke
   elemen tersembunyi di luar layar, lalu "difoto" pakai html2canvas jadi
   PNG/JPEG.

   PENTING — warna di file ini SENGAJA DIDUPLIKASI (bukan di-import) dari
   pdfExport.js dan excelExport.js, supaya perubahan di sini tidak berisiko
   mengubah perilaku 2 fitur export yang sudah berjalan. Kalau warna/struktur
   template PDF atau Excel diubah di masa depan, sesuaikan juga manual di sini.
============================================================================ */

// ---- Warna khusus mirror "Laporan Perbandingan Sales" (PDF) ----
const PDF_COLORS = {
  headerFill: "#111827",
  goldTint: "#F9EBDA",
  gold: "#D97706",
  text: "#111827",
  textMuted: "#6B7280",
  border: "#E5E7EB",
  mint: "#059669",
  coral: "#DC2626",
};

// Mirror PERSIS dari achColor() di pdfExport.js — PDF laporan ini TIDAK pakai
// gradien background (itu cuma fitur Excel), cuma warna TEKS 3-tingkat.
// Jangan pakai achGradientColor (di bawah) untuk mirror PDF — beda template.
function pdfAchTextColor(ach) {
  if (ach === null || ach === undefined) return PDF_COLORS.textMuted;
  if (ach >= 1) return PDF_COLORS.mint;
  if (ach >= 0.8) return PDF_COLORS.gold;
  return PDF_COLORS.coral;
}

// ---- Warna khusus mirror "Export ke Excel" ----
const XL_COLORS_HTML = {
  headerCyan: "#6DD9FF",
  headerPurple: "#7030A0",
  mint: "#4BFF9C",
  yellowTier: "#FFFF00",
  gold: "#FFC000",
  navy: "#002060",
  border: "#D9D9D9",
};
const XL_TIER_FILL_HTML = { mint: XL_COLORS_HTML.mint, amber: XL_COLORS_HTML.yellowTier, violet: XL_COLORS_HTML.gold };

// Gradien pencapaian — duplikat persis dari excelExport.js (lihat komentar di sana).
const ACH_GRADIENT_STOPS = [
  { pct: 0, rgb: [248, 105, 107] },
  { pct: 0.7, rgb: [255, 235, 132] },
  { pct: 1.0, rgb: [99, 190, 123] },
];
function achGradientColor(pct) {
  if (pct === null || pct === undefined || Number.isNaN(pct)) return null;
  const p = Math.max(0, pct);
  const stops = ACH_GRADIENT_STOPS;
  let lo = stops[0], hi = stops[stops.length - 1];
  for (let i = 0; i < stops.length - 1; i++) {
    if (p >= stops[i].pct && p <= stops[i + 1].pct) { lo = stops[i]; hi = stops[i + 1]; break; }
    if (p > stops[stops.length - 1].pct) { lo = stops[stops.length - 1]; hi = stops[stops.length - 1]; }
  }
  const range = hi.pct - lo.pct;
  const t = range > 0 ? Math.min(1, Math.max(0, (p - lo.pct) / range)) : 1;
  const hex = (n) => Math.round(n).toString(16).padStart(2, "0").toUpperCase();
  const r = lo.rgb[0] + (hi.rgb[0] - lo.rgb[0]) * t;
  const g = lo.rgb[1] + (hi.rgb[1] - lo.rgb[1]) * t;
  const b = lo.rgb[2] + (hi.rgb[2] - lo.rgb[2]) * t;
  return `#${hex(r)}${hex(g)}${hex(b)}`;
}

function esc(s) {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/* ----------------------------------------------------------------------------
   Fungsi generik: render HTML string di elemen tersembunyi, screenshot pakai
   html2canvas, download sebagai PNG/JPEG. `scale: 2` supaya teks tetap tajam
   walau di-zoom (setara retina/HiDPI).
---------------------------------------------------------------------------- */
export async function exportHtmlAsImage(html, filenameBase, format = "png") {
  const container = document.createElement("div");
  container.style.position = "absolute";
  container.style.left = "-99999px";
  container.style.top = "0";
  container.style.background = "#ffffff";
  container.style.width = "fit-content";
  container.innerHTML = html;
  document.body.appendChild(container);
  try {
    const canvas = await html2canvas(container, { scale: 2, backgroundColor: "#ffffff", useCORS: true });
    const mime = format === "jpeg" ? "image/jpeg" : "image/png";
    const dataUrl = canvas.toDataURL(mime, format === "jpeg" ? 0.92 : undefined);
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `${filenameBase}.${format === "jpeg" ? "jpg" : "png"}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  } finally {
    document.body.removeChild(container);
  }
}

/* ----------------------------------------------------------------------------
   1) MIRROR "Laporan Perbandingan Sales" (PDF) sebagai HTML
---------------------------------------------------------------------------- */
function formatDateIDHtml(dateStr) {
  if (!dateStr) return "-";
  const MONTHS_ID = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
  const [y, m, d] = dateStr.split("-").map(Number);
  if (!y) return "-";
  return `${d} ${MONTHS_ID[m - 1]} ${y}`;
}

function pdfTd(content, { bg, color, bold, align = "left", fontSize = 11 } = {}) {
  const style = [
    "padding:5px 8px", `text-align:${align}`, `font-size:${fontSize}px`,
    "font-family:Helvetica,Arial,sans-serif", bold ? "font-weight:bold" : "font-weight:normal",
    `color:${color || PDF_COLORS.text}`, bg ? `background:${bg}` : "",
    `border:1px solid ${PDF_COLORS.border}`, "white-space:nowrap",
  ].filter(Boolean).join(";");
  return `<td style="${style}">${esc(content)}</td>`;
}
function pdfTh(content, { align = "center" } = {}) {
  return `<th style="padding:5px 8px;text-align:${align};font-size:11px;font-family:Helvetica,Arial,sans-serif;font-weight:bold;color:#fff;background:${PDF_COLORS.headerFill};border:1px solid ${PDF_COLORS.border};white-space:nowrap;">${esc(content)}</th>`;
}

function buildSalesRowHtml(cols, achIndex = -1) {
  // cols = array of {content, align, fontSize} — semua di-highlight gold tint +
  // bold (baris "sales"). Kolom ach (kalau ada, achIndex) teksnya JUGA diwarnai
  // 3-tingkat — persis seperti didParseCell di PDF asli yang menerapkan
  // textColor=achColor(...) ke SEMUA baris (sales maupun grup), bukan cuma grup.
  return `<tr>${cols.map((c, i) => pdfTd(c.content, { bg: PDF_COLORS.goldTint, bold: true, align: c.align, fontSize: c.fontSize, color: i === achIndex ? c.achColor : undefined })).join("")}</tr>`;
}
function buildGroupRowHtml(cols, achIndex) {
  // cols = array of {content, align} — baris "grup" polos, kolom ach (kalau ada)
  // diwarnai TEKS 3-tingkat (mint/gold/coral), BUKAN background gradien —
  // sesuai template PDF asli (achColor), beda dengan template Excel.
  return `<tr>${cols.map((c, i) => pdfTd(c.content, { align: c.align, bold: i === achIndex, color: i === achIndex ? c.achColor : undefined })).join("")}</tr>`;
}

export function buildSalesGroupComparisonHTML(agg, opts) {
  const { depotName } = opts || {};
  const periodLabel = `${formatDateIDHtml(agg.meta.firstDate)} — ${formatDateIDHtml(agg.meta.lastDate)}`;
  const groupLabel = agg.byGroup.length ? agg.byGroup.map((g) => g.name).join(", ") : "Semua Grup";
  const sortedGroups = [...agg.byGroup].sort((a, b) => b.realisasiValue - a.realisasiValue);
  const sortedSales = [...agg.bySales].sort((a, b) => (b.ach ?? -1) - (a.ach ?? -1));
  const lastDateRows = agg.meta.lastDate ? agg.filteredRows.filter((r) => r.date === agg.meta.lastDate) : [];

  const wrap = "font-family:Helvetica,Arial,sans-serif;width:820px;padding:24px;background:#fff;";
  let html = `<div style="${wrap}">`;
  html += `<div style="font-size:16px;font-weight:bold;color:${PDF_COLORS.text};">${esc(depotName || "DEPO")}</div>`;
  html += `<div style="font-size:13px;font-weight:bold;color:${PDF_COLORS.text};margin-top:4px;">LAPORAN PERBANDINGAN PENCAPAIAN SALES</div>`;
  html += `<div style="font-size:10px;color:${PDF_COLORS.textMuted};margin-bottom:14px;">Grup: ${esc(groupLabel)} &nbsp;·&nbsp; ${esc(periodLabel)}</div>`;

  // Section 1
  html += `<div style="font-size:11px;font-weight:bold;color:${PDF_COLORS.text};margin:10px 0 4px;">Rekap per Grup Produk</div>`;
  html += `<table style="border-collapse:collapse;width:100%;margin-bottom:14px;"><thead><tr>${pdfTh("Grup Produk", { align: "left" })}${pdfTh("Target")}${pdfTh("Realisasi")}${pdfTh("Ach%")}</tr></thead><tbody>`;
  sortedGroups.forEach((g) => {
    html += `<tr>${pdfTd(g.name)}${pdfTd(fmtRp(g.targetValue), { align: "right" })}${pdfTd(fmtRp(g.realisasiValue), { align: "right" })}${pdfTd(fmtPct(g.ach), { align: "right", bold: true, color: pdfAchTextColor(g.ach) })}</tr>`;
  });
  html += `</tbody></table>`;

  // Section 2
  html += `<div style="font-size:11px;font-weight:bold;color:${PDF_COLORS.text};margin:10px 0 4px;">Rekap per Sales — Total Periode</div>`;
  html += `<table style="border-collapse:collapse;width:100%;margin-bottom:14px;"><thead><tr>${pdfTh("#")}${pdfTh("Nama", { align: "left" })}${pdfTh("Target")}${pdfTh("Realisasi")}${pdfTh("Ach%")}${pdfTh("Deviasi")}${pdfTh("AO")}</tr></thead><tbody>`;
  sortedSales.forEach((s, idx) => {
    html += buildSalesRowHtml([
      { content: idx + 1, align: "center" }, { content: s.name, align: "left" },
      { content: fmtRp(s.targetValue), align: "right" }, { content: fmtRp(s.realisasiValue), align: "right" },
      { content: fmtPct(s.ach), align: "right", achColor: pdfAchTextColor(s.ach) }, { content: s.deviasiValue !== null ? fmtRp(s.deviasiValue) : "-", align: "right" },
      { content: fmtNum(s.realisasiAo), align: "right" },
    ], 4);
    s.groups.forEach((g) => {
      html += buildGroupRowHtml([
        { content: "", align: "center" }, { content: g.name, align: "left" },
        { content: fmtRp(g.targetValue), align: "right" }, { content: fmtRp(g.realisasiValue), align: "right" },
        { content: fmtPct(g.ach), align: "right", achColor: pdfAchTextColor(g.ach) },
        { content: g.deviasiValue !== null ? fmtRp(g.deviasiValue) : "-", align: "right" },
        { content: fmtNum(g.realisasiAo), align: "right" },
      ], 4);
    });
  });
  html += `</tbody></table>`;

  // Section 3
  html += `<div style="font-size:11px;font-weight:bold;color:${PDF_COLORS.text};margin:10px 0 4px;">Pencapaian Hari Terakhir — ${esc(formatDateIDHtml(agg.meta.lastDate))}</div>`;
  if (lastDateRows.length === 0) {
    html += `<div style="font-size:10px;color:${PDF_COLORS.textMuted};">Tidak ada transaksi pada tanggal ini untuk grup yang difilter.</div>`;
  } else {
    html += `<table style="border-collapse:collapse;width:100%;"><thead><tr>${pdfTh("#")}${pdfTh("Nama", { align: "left" })}${pdfTh("Realisasi")}${pdfTh("AO")}</tr></thead><tbody>`;
    sortedSales.forEach((s, idx) => {
      const salesLastRows = lastDateRows.filter((r) => r.salesCode === s.code);
      const realAoToday = new Set(salesLastRows.map((r) => r.outletCode)).size;
      const salesLastValue = salesLastRows.reduce((sum, r) => sum + r.value, 0);
      html += buildSalesRowHtml([
        { content: idx + 1, align: "center" }, { content: s.name, align: "left" },
        { content: salesLastRows.length ? fmtRp(salesLastValue) : "-", align: "right" },
        { content: salesLastRows.length ? fmtNum(realAoToday) : "-", align: "right" },
      ]);
      if (salesLastRows.length === 0) return;
      s.groups.forEach((g) => {
        const grs = salesLastRows.filter((r) => r.group === g.name);
        if (grs.length === 0) return;
        html += buildGroupRowHtml([
          { content: "", align: "center" }, { content: g.name, align: "left" },
          { content: fmtRp(grs.reduce((sum, r) => sum + r.value, 0)), align: "right" },
          { content: fmtNum(new Set(grs.map((r) => r.outletCode)).size), align: "right" },
        ], -1);
      });
    });
    html += `</tbody></table>`;
  }

  html += `</div>`;
  return html;
}

/* ----------------------------------------------------------------------------
   2) MIRROR "Export ke Excel" sebagai HTML
   Info block (BULAN/HARI KERJA/dst) dirender sebagai blok kecil terpisah di
   atas tabel utama — sama datanya dengan Excel, tapi tidak dipaksa masuk ke
   grid 14-kolom yang sama persis (tidak perlu untuk kebutuhan screenshot).
---------------------------------------------------------------------------- */
function xlTd(content, { bg, color, bold, align = "left", colSpan, rowSpan, italic } = {}) {
  const style = [
    "padding:4px 7px", `text-align:${align}`, "font-size:10.5px", "font-family:Calibri,Arial,sans-serif",
    bold ? "font-weight:bold" : "font-weight:normal", italic ? "font-style:italic" : "",
    `color:${color || "#111827"}`, bg ? `background:${bg}` : "",
    `border:1px solid ${XL_COLORS_HTML.border}`, "white-space:nowrap",
  ].filter(Boolean).join(";");
  const attrs = `${colSpan ? ` colspan="${colSpan}"` : ""}${rowSpan ? ` rowspan="${rowSpan}"` : ""}`;
  return `<td style="${style}"${attrs}>${esc(content)}</td>`;
}

export function buildExcelReportHTML(agg, targets, opts) {
  const { workDays, depotName } = opts || {};
  const firstDateObj = dateStrToLocalDate(agg.meta.firstDate) || new Date();
  const lastDateObj = dateStrToLocalDate(agg.meta.lastDate) || new Date();
  const sdHariIni = agg.meta.uniqueDays;
  const sisaHk = Math.max(0, (workDays || 0) - sdHariIni);
  const timeGone = workDays ? sdHariIni / workDays : 0;
  const MONTHS_ID = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
  const fmtMonYY = (d) => `${MONTHS_ID[d.getMonth()]}-${String(d.getFullYear()).slice(2)}`;
  const fmtDMonYY = (d) => `${d.getDate()}-${MONTHS_ID[d.getMonth()]}-${String(d.getFullYear()).slice(2)}`;

  const wrap = "font-family:Calibri,Arial,sans-serif;width:fit-content;padding:20px;background:#fff;";
  let html = `<div style="${wrap}">`;

  // Info block
  html += `<table style="border-collapse:collapse;margin-bottom:10px;"><tbody>`;
  html += `<tr>${xlTd("BULAN", { bold: true })}${xlTd(fmtMonYY(firstDateObj))}<td style="border:none;padding:0 24px;"></td>${xlTd(depotName || "DEPO LOTIM", { bold: true, align: "center" })}<td style="border:none;padding:0 24px;"></td>${xlTd(fmtDMonYY(lastDateObj), { bold: true, align: "right" })}</tr>`;
  html += `<tr>${xlTd("HARI KERJA", { bold: true })}${xlTd(fmtNum(workDays || 0), { bold: true })}</tr>`;
  html += `<tr>${xlTd("SD HARI INI", { bold: true })}${xlTd(fmtNum(sdHariIni), { bold: true })}</tr>`;
  html += `<tr>${xlTd("SISA HK", { bold: true })}${xlTd(fmtNum(sisaHk), { bold: true })}</tr>`;
  html += `<tr>${xlTd("TIME GONE", { bold: true })}${xlTd(fmtPct(timeGone), { bold: true, bg: XL_COLORS_HTML.gold })}</tr>`;
  html += `</tbody></table>`;

  // Header baris 1 & 2
  html += `<table style="border-collapse:collapse;"><thead>`;
  html += `<tr>`;
  html += `<th rowspan="2" style="padding:4px 7px;background:${XL_COLORS_HTML.headerCyan};border:1px solid ${XL_COLORS_HTML.border};font-size:10.5px;">NO</th>`;
  html += `<th rowspan="2" style="padding:4px 7px;background:${XL_COLORS_HTML.headerCyan};border:1px solid ${XL_COLORS_HTML.border};font-size:10.5px;">SALESMAN</th>`;
  ["TARGET", "REALISASI", "ACH", "DEVIASI"].forEach((label) => {
    html += `<th colspan="2" style="padding:4px 7px;background:${XL_COLORS_HTML.headerCyan};border:1px solid ${XL_COLORS_HTML.border};font-size:10.5px;">${label}</th>`;
  });
  html += `<th colspan="4" style="padding:4px 7px;background:${XL_COLORS_HTML.headerPurple};color:#fff;border:1px solid ${XL_COLORS_HTML.border};font-size:10.5px;">PRODUK FOKUS</th>`;
  html += `</tr><tr>`;
  ["VALUE", "AO", "VALUE", "AO", "VALUE", "AO", "VALUE", "AO"].forEach((label) => {
    html += `<th style="padding:4px 7px;background:${XL_COLORS_HTML.headerCyan};border:1px solid ${XL_COLORS_HTML.border};font-size:10.5px;">${label}</th>`;
  });
  ["NAMA", "TARGET", "REALISASI", "%"].forEach((label) => {
    html += `<th style="padding:4px 7px;background:${XL_COLORS_HTML.headerPurple};color:#fff;border:1px solid ${XL_COLORS_HTML.border};font-size:10.5px;">${label}</th>`;
  });
  html += `</tr></thead><tbody>`;

  // Data per sales
  const totalTargetV = [], totalTargetAo = [], totalRealV = [], totalRealAo = [];
  agg.bySales.forEach((sm, idx) => {
    const fill = XL_TIER_FILL_HTML[sm.tier] || XL_COLORS_HTML.yellowTier;
    const maxSub = Math.max(sm.groups.length, sm.focus.length);

    html += `<tr>`;
    html += `<td rowspan="${maxSub + 1}" style="padding:4px 7px;text-align:center;font-weight:bold;border:1px solid ${XL_COLORS_HTML.border};font-size:10.5px;">${idx + 1}</td>`;
    html += xlTd(sm.name, { bold: true, bg: fill });
    html += xlTd(fmtRp(sm.targetValue), { bg: fill, align: "right" });
    html += xlTd(fmtNum(sm.targetAo), { bg: fill, align: "center" });
    html += xlTd(fmtRp(sm.realisasiValue), { bg: fill, align: "right" });
    html += xlTd(fmtNum(sm.realisasiAo), { bg: fill, align: "center" });
    html += xlTd(sm.targetValue ? fmtPct(sm.ach) : "-", { bold: true, align: "center", bg: sm.targetValue ? achGradientColor(sm.ach) : undefined });
    html += xlTd(sm.targetAo ? fmtPct(sm.achAo) : "-", { bold: true, align: "center", bg: sm.targetAo ? achGradientColor(sm.achAo) : undefined });
    html += xlTd(sm.targetValue ? fmtRp(sm.deviasiValue) : "0", { bg: XL_COLORS_HTML.yellowTier, align: "right" });
    html += xlTd(sm.targetAo ? fmtNum(sm.deviasiAo) : "0", { bg: XL_COLORS_HTML.yellowTier, align: "center" });
    if (sm.focus.length) {
      html += `<td colspan="4" style="padding:4px 7px;text-align:center;font-weight:bold;background:${XL_COLORS_HTML.headerPurple};color:#fff;border:1px solid ${XL_COLORS_HTML.border};font-size:10.5px;">${esc(sm.name)}</td>`;
    } else {
      html += `<td colspan="4" style="padding:4px 7px;font-size:9px;background:${fill};border:1px solid ${XL_COLORS_HTML.border};">*PRODUK FOKUS DALAM SATUAN KARTON</td>`;
    }
    html += `</tr>`;

    totalTargetV.push(sm.targetValue); totalTargetAo.push(sm.targetAo);
    totalRealV.push(sm.realisasiValue); totalRealAo.push(sm.realisasiAo);

    for (let i = 0; i < maxSub; i++) {
      html += `<tr>`;
      if (i < sm.groups.length) {
        const g = sm.groups[i];
        html += xlTd(g.name);
        html += xlTd(fmtRp(g.targetValue), { align: "right" });
        html += xlTd(fmtNum(g.targetAo), { bg: fill, align: "center" });
        html += xlTd(fmtRp(g.realisasiValue), { align: "right" });
        html += xlTd(fmtNum(g.realisasiAo), { align: "center" });
        html += xlTd(g.targetValue ? fmtPct(g.ach) : "-", { bold: true, align: "center", bg: g.targetValue ? achGradientColor(g.ach) : undefined });
        html += xlTd(g.targetAo ? fmtPct(g.achAo) : "-", { bold: true, align: "center", bg: g.targetAo ? achGradientColor(g.achAo) : undefined });
        html += xlTd(fmtRp(g.deviasiValue), { bg: XL_COLORS_HTML.yellowTier, align: "right" });
        html += xlTd(fmtNum(g.deviasiAo), { bg: XL_COLORS_HTML.yellowTier, align: "center" });
      } else {
        for (let c = 0; c < 8; c++) html += xlTd("");
      }
      if (i < sm.focus.length) {
        const f = sm.focus[i];
        html += xlTd(f.hasUnconvertible ? `${f.name} *` : f.name);
        html += xlTd(fmtNum(f.target), { align: "center" });
        html += xlTd(fmtNum(f.realisasi), { align: "center" });
        html += xlTd(f.target ? fmtPct(f.pct) : fmtPct(0), { bold: true, align: "center", bg: f.target ? achGradientColor(f.pct) : undefined });
      } else {
        for (let c = 0; c < 4; c++) html += xlTd("");
      }
      html += `</tr>`;
    }
  });

  // TOTAL
  const sum = (arr) => arr.reduce((a, b) => a + (b || 0), 0);
  const tTargetV = sum(totalTargetV), tTargetAo = sum(totalTargetAo);
  const tRealV = sum(totalRealV), tRealAo = sum(totalRealAo);
  const navyCell = (content, align = "right") => `<td style="padding:4px 7px;text-align:${align};font-weight:bold;background:${XL_COLORS_HTML.navy};color:#fff;border:1px solid ${XL_COLORS_HTML.border};font-size:10.5px;">${esc(content)}</td>`;
  html += `<tr>`;
  html += navyCell("", "center");
  html += navyCell("TOTAL", "left");
  html += navyCell(fmtRp(tTargetV));
  html += navyCell(fmtNum(tTargetAo), "center");
  html += navyCell(fmtRp(tRealV));
  html += navyCell(fmtNum(tRealAo), "center");
  html += xlTd(tTargetV ? fmtPct(tRealV / tTargetV) : "-", { bold: true, align: "center", bg: tTargetV ? achGradientColor(tRealV / tTargetV) : undefined });
  html += xlTd(tTargetAo ? fmtPct(tRealAo / tTargetAo) : "-", { bold: true, align: "center", bg: tTargetAo ? achGradientColor(tRealAo / tTargetAo) : undefined });
  html += navyCell(fmtRp(tTargetV - tRealV));
  html += navyCell(fmtNum(tTargetAo - tRealAo), "center");
  for (let c = 0; c < 4; c++) html += navyCell("", "center");
  html += `</tr></tbody></table>`;

  const anyUnconvertible = agg.bySales.some((sm) => sm.focus.some((f) => f.hasUnconvertible));
  if (anyUnconvertible) {
    html += `<div style="font-size:9px;color:${PDF_COLORS.textMuted};margin-top:8px;">* Sebagian transaksi produk ini tidak bisa dikonversi ke satuan karton (tidak ada baris satuan KARTON untuk produk tsb di data mentah) — angka realisasi memakai satuan asli.</div>`;
  }

  html += `</div>`;
  return html;
}
