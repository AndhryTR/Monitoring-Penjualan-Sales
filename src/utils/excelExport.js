import * as XLSX from "xlsx-js-style";
import { dateStrToLocalDate, todayLocalDateStr } from "./excelParse.js";
import { ACH_TIERS } from "../constants/thresholds.js";

/* ============================================================================
   EXCEL EXPORT
   Membangun worksheet `.xlsx` kompleks dengan style (warna, merge, numFmt)
   dari agg hasil useAggregates. Dipakai oleh ExportMenu saat user klik
   "Export ke Excel".

   Konstanta XL_* dan fungsi exportToExcel dipindah utuh dari SalesMonitoringApp.jsx
   tanpa perubahan behavior — hanya lokasi file saja.
============================================================================ */

export const XL_NUMFMT_MONEY = '_(* #,##0_);_(* \\(#,##0\\);_(* "-"??_);_(@_)';
export const XL_NUMFMT_INT = "#,##0";
export const XL_NUMFMT_PCT = "0.00%";
export const XL_NUMFMT_PCT1 = "0.0%";
export const XL_COLORS = { headerCyan: "6DD9FF", headerPurple: "7030A0", mint: "4BFF9C", yellowTier: "FFFF00", gold: "FFC000", navy: "002060" };
export const XL_TIER_FILL = { mint: XL_COLORS.mint, amber: XL_COLORS.yellowTier, violet: XL_COLORS.gold };

// Titik warna gradien pencapaian: 0% merah -> 70% kuning -> 100%+ hijau,
// selaras dengan ACH_TIERS yang dipakai di UI live app (70% = waspada,
// 100% = target tercapai). Interpolasi RGB linear di antara titik-titik ini,
// bukan lompat diskrit — jadi 85% akan terlihat warna transisi kuning-hijau.
const ACH_GRADIENT_STOPS = [
  { pct: 0, rgb: [248, 105, 107] },   // merah pastel
  { pct: ACH_TIERS.warning, rgb: [255, 235, 132] }, // kuning pastel
  { pct: ACH_TIERS.onPace, rgb: [99, 190, 123] },  // hijau pastel
];

function achGradientColor(pct) {
  if (pct === null || pct === undefined || Number.isNaN(pct)) return null;
  const p = Math.max(0, pct); // klem batas bawah di 0% (ach negatif tidak masuk akal)
  const stops = ACH_GRADIENT_STOPS;
  // Cari 2 titik yang mengapit `p` (kalau p >= titik terakhir, dianggap solid hijau)
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
  return `${hex(r)}${hex(g)}${hex(b)}`;
}

export function exportToExcel(agg, targets, opts) {
  const { workDays, depotName } = opts || {};
  const ws = {};
  const merges = [];
  let lastRow = 0;

  const setCell = (r, c, value, style = {}) => {
    const ref = XLSX.utils.encode_cell({ r: r - 1, c: c - 1 });
    const isNum = typeof value === "number";
    const cellObj = { v: value === null || value === undefined ? "" : value, t: isNum ? "n" : (value instanceof Date ? "d" : "s") };
    if (value instanceof Date) cellObj.t = "d";
    const s = {
      font: { bold: !!style.bold, sz: style.size || 10, name: "Calibri", color: { rgb: style.color || "000000" } },
      alignment: { horizontal: style.align || (isNum ? "right" : "left"), vertical: "center", wrapText: true },
    };
    if (style.border !== false) {
      s.border = { top: { style: "thin", color: { rgb: "D9D9D9" } }, bottom: { style: "thin", color: { rgb: "D9D9D9" } },
        left: { style: "thin", color: { rgb: "D9D9D9" } }, right: { style: "thin", color: { rgb: "D9D9D9" } } };
    }
    if (style.fill) s.fill = { patternType: "solid", fgColor: { rgb: style.fill } };
    if (style.numFmt) s.numFmt = style.numFmt;
    cellObj.s = s;
    ws[ref] = cellObj;
    if (r > lastRow) lastRow = r;
  };
  const merge = (r1, c1, r2, c2) => merges.push({ s: { r: r1 - 1, c: c1 - 1 }, e: { r: r2 - 1, c: c2 - 1 } });
  const blank = (r, cols) => cols.forEach((c) => setCell(r, c, ""));

  // ---- blok info header ----
  const firstDateObj = dateStrToLocalDate(agg.meta.firstDate) || new Date();
  const lastDateObj = dateStrToLocalDate(agg.meta.lastDate) || new Date();
  const sdHariIni = agg.meta.uniqueDays;
  const sisaHk = Math.max(0, (workDays || 0) - sdHariIni);
  const timeGone = workDays ? sdHariIni / workDays : 0;

  setCell(1, 2, "BULAN", { bold: true });
  setCell(1, 3, firstDateObj, { numFmt: "mmm-yy" });
  setCell(1, 13, lastDateObj, { bold: true, numFmt: "d-mmm-yy", align: "right" });
  setCell(2, 2, "HARI KERJA", { bold: true });
  setCell(2, 3, workDays || 0, { bold: true, numFmt: XL_NUMFMT_INT });
  setCell(3, 2, "SD HARI INI", { bold: true });
  setCell(3, 3, sdHariIni, { bold: true, numFmt: XL_NUMFMT_INT });
  setCell(4, 2, "SISA HK", { bold: true });
  setCell(4, 3, sisaHk, { bold: true, numFmt: XL_NUMFMT_INT });
  setCell(5, 2, "TIME GONE", { bold: true });
  setCell(5, 3, timeGone, { bold: true, numFmt: XL_NUMFMT_PCT, fill: XL_COLORS.gold });
  setCell(5, 7, depotName || "DEPO LOTIM", { bold: true, size: 13, align: "center" });
  merge(5, 7, 5, 10);

  // ---- header kolom (baris 6-7) ----
  const HROW1 = 6, HROW2 = 7;
  setCell(HROW1, 1, "NO", { bold: true, fill: XL_COLORS.headerCyan, align: "center" });
  setCell(HROW1, 2, "SALESMAN", { bold: true, fill: XL_COLORS.headerCyan, align: "center" });
  merge(HROW1, 1, HROW2, 1); merge(HROW1, 2, HROW2, 2);
  [["TARGET", 3], ["REALISASI", 5], ["ACH", 7], ["DEVIASI", 9]].forEach(([label, col]) => {
    setCell(HROW1, col, label, { bold: true, fill: XL_COLORS.headerCyan, align: "center" });
    merge(HROW1, col, HROW1, col + 1);
    setCell(HROW2, col, "VALUE", { bold: true, fill: XL_COLORS.headerCyan, align: "center" });
    setCell(HROW2, col + 1, "AO", { bold: true, fill: XL_COLORS.headerCyan, align: "center" });
  });
  setCell(HROW1, 11, "PRODUK FOKUS", { bold: true, fill: XL_COLORS.headerPurple, color: "FFFFFF", align: "center" });
  merge(HROW1, 11, HROW1, 14);
  ["NAMA", "TARGET", "REALISASI", "%"].forEach((label, i) => {
    setCell(HROW2, 11 + i, label, { bold: true, fill: XL_COLORS.headerPurple, color: "FFFFFF", align: "center" });
  });

  // ---- baris data per sales ----
  let r = HROW2 + 1;
  const totalTargetV = [], totalTargetAo = [], totalRealV = [], totalRealAo = [];

  agg.bySales.forEach((sm, idx) => {
    const startRow = r;
    const fill = XL_TIER_FILL[sm.tier] || XL_COLORS.yellowTier;

    setCell(r, 2, sm.name, { bold: true, fill, align: "left" });
    setCell(r, 3, sm.targetValue, { fill, numFmt: XL_NUMFMT_MONEY });
    setCell(r, 4, sm.targetAo, { fill, numFmt: XL_NUMFMT_INT, align: "center" });
    setCell(r, 5, sm.realisasiValue, { fill, numFmt: XL_NUMFMT_MONEY });
    setCell(r, 6, sm.realisasiAo, { fill, numFmt: XL_NUMFMT_INT, align: "center" });
    setCell(r, 7, sm.targetValue ? sm.ach : "-", { bold: true, fill: sm.targetValue ? achGradientColor(sm.ach) : undefined, numFmt: sm.targetValue ? XL_NUMFMT_PCT : undefined, align: "center" });
    setCell(r, 8, sm.targetAo ? sm.achAo : "-", { bold: true, fill: sm.targetAo ? achGradientColor(sm.achAo) : undefined, numFmt: sm.targetAo ? XL_NUMFMT_PCT : undefined, align: "center" });
    setCell(r, 9, sm.targetValue ? sm.deviasiValue : 0, { fill: XL_COLORS.yellowTier, numFmt: XL_NUMFMT_MONEY });
    setCell(r, 10, sm.targetAo ? sm.deviasiAo : 0, { fill: XL_COLORS.yellowTier, numFmt: XL_NUMFMT_INT, align: "center" });
    if (sm.focus.length) {
      setCell(r, 11, sm.name, { bold: true, fill: XL_COLORS.headerPurple, color: "FFFFFF", align: "center" });
    } else {
      setCell(r, 11, "*PRODUK FOKUS DALAM SATUAN KARTON", { fill, align: "left", size: 9 });
    }
    merge(r, 11, r, 14);

    totalTargetV.push(sm.targetValue); totalTargetAo.push(sm.targetAo);
    totalRealV.push(sm.realisasiValue); totalRealAo.push(sm.realisasiAo);

    r++;
    const maxSub = Math.max(sm.groups.length, sm.focus.length);
    for (let i = 0; i < maxSub; i++) {
      if (i < sm.groups.length) {
        const g = sm.groups[i];
        setCell(r, 2, g.name, { align: "left" });
        setCell(r, 3, g.targetValue, { numFmt: XL_NUMFMT_MONEY });
        setCell(r, 4, g.targetAo, { fill, numFmt: XL_NUMFMT_INT, align: "center" });
        setCell(r, 5, g.realisasiValue, { numFmt: XL_NUMFMT_MONEY });
        setCell(r, 6, g.realisasiAo, { numFmt: XL_NUMFMT_INT, align: "center" });
        setCell(r, 7, g.targetValue ? g.ach : "-", { bold: true, fill: g.targetValue ? achGradientColor(g.ach) : undefined, numFmt: g.targetValue ? XL_NUMFMT_PCT : undefined, align: "center" });
        setCell(r, 8, g.targetAo ? g.achAo : "-", { bold: true, fill: g.targetAo ? achGradientColor(g.achAo) : undefined, numFmt: g.targetAo ? XL_NUMFMT_PCT : undefined, align: "center" });
        setCell(r, 9, g.deviasiValue, { fill: XL_COLORS.yellowTier, numFmt: XL_NUMFMT_MONEY });
        setCell(r, 10, g.deviasiAo, { fill: XL_COLORS.yellowTier, numFmt: XL_NUMFMT_INT, align: "center" });
      } else {
        blank(r, [2, 3, 4, 5, 6, 7, 8, 9, 10]);
      }
      if (i < sm.focus.length) {
        const f = sm.focus[i];
        setCell(r, 11, f.hasUnconvertible ? `${f.name} *` : f.name, { align: "left" });
        setCell(r, 12, f.target, { numFmt: XL_NUMFMT_INT, align: "center" });
        setCell(r, 13, f.realisasi, { numFmt: XL_NUMFMT_INT, align: "center" });
        setCell(r, 14, f.target ? f.pct : 0, { bold: true, fill: f.target ? achGradientColor(f.pct) : undefined, numFmt: XL_NUMFMT_PCT1, align: "center" });
      } else {
        blank(r, [11, 12, 13, 14]);
      }
      r++;
    }
    merge(startRow, 1, r - 1, 1);
    setCell(startRow, 1, idx + 1, { bold: true, align: "center" });
  });

  // ---- baris TOTAL ----
  const sum = (arr) => arr.reduce((a, b) => a + (b || 0), 0);
  const tTargetV = sum(totalTargetV), tTargetAo = sum(totalTargetAo);
  const tRealV = sum(totalRealV), tRealAo = sum(totalRealAo);
  setCell(r, 1, "", { fill: XL_COLORS.navy });
  setCell(r, 2, "TOTAL", { bold: true, fill: XL_COLORS.navy, color: "FFFFFF", align: "left" });
  setCell(r, 3, tTargetV, { bold: true, fill: XL_COLORS.navy, color: "FFFFFF", numFmt: XL_NUMFMT_MONEY });
  setCell(r, 4, tTargetAo, { bold: true, fill: XL_COLORS.navy, color: "FFFFFF", numFmt: XL_NUMFMT_INT, align: "center" });
  setCell(r, 5, tRealV, { bold: true, fill: XL_COLORS.navy, color: "FFFFFF", numFmt: XL_NUMFMT_MONEY });
  setCell(r, 6, tRealAo, { bold: true, fill: XL_COLORS.navy, color: "FFFFFF", numFmt: XL_NUMFMT_INT, align: "center" });
  setCell(r, 7, tTargetV ? tRealV / tTargetV : "-", { bold: true, fill: tTargetV ? achGradientColor(tRealV / tTargetV) : undefined, numFmt: tTargetV ? XL_NUMFMT_PCT : undefined, align: "center" });
  setCell(r, 8, tTargetAo ? tRealAo / tTargetAo : "-", { bold: true, fill: tTargetAo ? achGradientColor(tRealAo / tTargetAo) : undefined, numFmt: tTargetAo ? XL_NUMFMT_PCT : undefined, align: "center" });
  setCell(r, 9, tTargetV - tRealV, { bold: true, fill: XL_COLORS.navy, color: "FFFFFF", numFmt: XL_NUMFMT_MONEY });
  setCell(r, 10, tTargetAo - tRealAo, { bold: true, fill: XL_COLORS.navy, color: "FFFFFF", numFmt: XL_NUMFMT_INT, align: "center" });
  blank(r, [11, 12, 13, 14]);

  const anyUnconvertible = agg.bySales.some((sm) => sm.focus.some((f) => f.hasUnconvertible));
  if (anyUnconvertible) {
    const noteRow = r + 2;
    setCell(noteRow, 2, "* Sebagian transaksi produk ini tidak bisa dikonversi ke satuan karton (tidak ada baris satuan KARTON untuk produk tsb di data mentah) — angka realisasi memakai satuan asli.", { align: "left", size: 9, border: false });
    merge(noteRow, 2, noteRow, 14);
  }

  ws["!ref"] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: lastRow - 1, c: 13 } });
  ws["!merges"] = merges;
  ws["!cols"] = [4, 22, 15, 8, 15, 8, 10, 8, 15, 8, 22, 10, 11, 9].map((w) => ({ wch: w }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Laporan");
  XLSX.writeFile(wb, `Laporan_Sales_${todayLocalDateStr()}.xlsx`);
}
