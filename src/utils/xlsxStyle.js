/* ============================================================================
   SHARED XLSX STYLE — Helper untuk modul export Excel
   Sebelumnya `achGradientColor`, `setCell`, `makeSheetBuilder`, dan konstanta
   warna XL_* di-DUPLIKASI di 3 file (excelExport.js, trendExport.js,
   reportExcelExport.js, comparisonExport.js). Setiap perubahan rule ACH (mis.
   ubah threshold di ACH_TIERS) atau style cell harus di-propagate manual ke
   semua file, mudah drift.

   Sekarang: semua helper dipusatkan di sini. Modul export cukup import.
============================================================================ */

import * as XLSX from "xlsx-js-style";
import { ACH_TIERS } from "../constants/thresholds.js";

// ---- Number formats (Indonesia) ----
export const XL_NUMFMT_MONEY = '_(* #,##0_);_(* \\(#,##0\\);_(* "-"??_);_(@_)';
export const XL_NUMFMT_INT = "#,##0";
export const XL_NUMFMT_PCT = "0.0%";       // 1 desimal (tabel utama)
export const XL_NUMFMT_PCT1 = "0.0%";       // alias (untuk compat lama)

// ---- Warna (RGB hex tanpa #) — selaras dengan template Excel original ----
export const XL_COLORS = {
  // Variabel ini dipakai oleh excelExport.js, reportExcelExport.js, comparisonExport.js
  // untuk header fill, accent, dan tier fill. Konsisten dengan tampilan di layar.
  headerCyan: "6DD9FF",
  headerPurple: "7030A0",
  headerFill: "111827",   // untuk trendExport.js (headerFill hitam navy)
  mint: "4BFF9C",
  coral: "DC2626",
  textMuted: "6B7280",
  yellowTier: "FFFF00",
  gold: "FFC000",
  navy: "002060",
  border: "D9D9D9",
};

// Mapping tier (onPace/warning/danger) ke fill warna solid — dipakai di
// baris sales utama (highlight baris, bukan cell ach gradient).
export const XL_TIER_FILL = { mint: XL_COLORS.mint, amber: XL_COLORS.yellowTier, violet: XL_COLORS.gold };

// ---- Gradien ACH (interpolasi RGB linear antar stops) ----
// 0% merah pastel -> 70% kuning pastel -> 100%+ hijau pastel.
// Selaras dengan ACH_TIERS (warning=0.7, onPace=1.0) yang dipakai di UI live.
// Dipakai sebagai background cell ACH di file Excel, BUKAN sebagai text color
// (text color pakai achColor 3-tingkat diskrit di pdfExport.js).
const ACH_GRADIENT_STOPS = [
  { pct: 0, rgb: [248, 105, 107] },                    // merah pastel
  { pct: ACH_TIERS.warning, rgb: [255, 235, 132] },    // kuning pastel
  { pct: ACH_TIERS.onPace, rgb: [99, 190, 123] },      // hijau pastel
];

/**
 * Mengembalikan warna hex (tanpa #) untuk background cell ACH berdasarkan
 * persentase pencapaian. Interpolasi linear antara stops. Returns null untuk
 * null/NaN/undefined supaya caller bisa skip fill.
 *
 * @param {number|null|undefined} pct  - 0..1+ (atau null untuk "no data")
 * @returns {string|null} hex 6-char uppercase (e.g. "5BBF7B") atau null
 */
export function achGradientColor(pct) {
  if (pct === null || pct === undefined || Number.isNaN(pct)) return null;
  const p = Math.max(0, pct); // klem batas bawah di 0% (ach negatif tidak masuk akal)
  const stops = ACH_GRADIENT_STOPS;
  let lo = stops[0], hi = stops[stops.length - 1];
  for (let i = 0; i < stops.length - 1; i++) {
    if (p >= stops[i].pct && p <= stops[i + 1].pct) {
      lo = stops[i]; hi = stops[i + 1]; break;
    }
    if (p > stops[stops.length - 1].pct) {
      lo = stops[stops.length - 1]; hi = stops[stops.length - 1];
      break; // ⚠️ fix dari versi lama yang tidak break (loop terus jalan)
    }
  }
  const range = hi.pct - lo.pct;
  const t = range > 0 ? Math.min(1, Math.max(0, (p - lo.pct) / range)) : 1;
  const hex = (n) => Math.round(n).toString(16).padStart(2, "0").toUpperCase();
  const r = lo.rgb[0] + (hi.rgb[0] - lo.rgb[0]) * t;
  const g = lo.rgb[1] + (hi.rgb[1] - lo.rgb[1]) * t;
  const b = lo.rgb[2] + (hi.rgb[2] - lo.rgb[2]) * t;
  return `${hex(r)}${hex(g)}${hex(b)}`;
}

/**
 * Varian HTML — return hex dengan prefix "#" (e.g. "#5BBF7B"). Dipakai oleh
 * imageExport.js yang membangun inline-style HTML (bukan XLSX). Logic-nya
 * identik dengan achGradientColor, hanya format return yang berbeda.
 */
export function achGradientColorHex(pct) {
  const hex = achGradientColor(pct);
  return hex ? `#${hex}` : null;
}

/* ============================================================================
   makeSheetBuilder — factory yang mengembalikan { setCell, merge, finalize }
   Dipakai oleh reportExcelExport.js & comparisonExport.js. Memisahkan logic
   write cell/merge/range dari konten sheet, supaya fungsi export sendiri
   fokus hanya pada layout & data.
============================================================================ */
export function makeSheetBuilder() {
  const ws = {};
  const merges = [];
  let lastRow = 0, lastCol = 0;

  const setCell = (r, c, value, style = {}) => {
    const ref = XLSX.utils.encode_cell({ r: r - 1, c: c - 1 });
    const isNum = typeof value === "number";
    // Cell type: number => "n", Date => "d", else => "s" (string).
    // Null/undefined di-convert ke "" supaya cell kosong tetap ber-style.
    const cellType = isNum ? "n" : (value instanceof Date ? "d" : "s");
    const cellObj = {
      v: value === null || value === undefined ? "" : value,
      t: cellType,
    };
    cellObj.s = {
      font: { bold: !!style.bold, sz: style.size || 10, name: "Calibri", color: { rgb: style.color || "000000" } },
      alignment: {
        horizontal: style.align || (isNum ? "right" : "left"),
        vertical: "center",
        wrapText: !!style.wrap,
      },
      border: style.border !== false ? {
        top: { style: "thin", color: { rgb: XL_COLORS.border } },
        bottom: { style: "thin", color: { rgb: XL_COLORS.border } },
        left: { style: "thin", color: { rgb: XL_COLORS.border } },
        right: { style: "thin", color: { rgb: XL_COLORS.border } },
      } : undefined,
    };
    if (style.fill) cellObj.s.fill = { patternType: "solid", fgColor: { rgb: style.fill } };
    if (style.numFmt) cellObj.s.numFmt = style.numFmt;
    ws[ref] = cellObj;
    if (r > lastRow) lastRow = r;
    if (c > lastCol) lastCol = c;
  };

  const merge = (r1, c1, r2, c2) =>
    merges.push({ s: { r: r1 - 1, c: c1 - 1 }, e: { r: r2 - 1, c: c2 - 1 } });

  const finalize = (colWidths) => {
    ws["!ref"] = XLSX.utils.encode_range({
      s: { r: 0, c: 0 },
      e: { r: Math.max(lastRow, 1) - 1, c: Math.max(lastCol, 1) - 1 },
    });
    ws["!merges"] = merges;
    if (colWidths) ws["!cols"] = colWidths.map((w) => ({ wch: w }));
    return ws;
  };

  return { setCell, merge, finalize, getLastRow: () => lastRow };
}

/**
 * Sanitize string untuk dipakai sebagai nama file Excel/PDF. Konsisten lintas
 * modul export — sebelumnya excelExport pakai `replace(/\s+/g, "-")` (sisakan
 * `/`, `\`, `:`), reportExcelExport pakai `replace(/[^a-z0-9]+/gi, "_")`.
 */
export function sanitizeFilename(s) {
  return String(s || "").trim().replace(/[^a-z0-9]+/gi, "_").replace(/^_+|_+$/g, "") || "export";
}
