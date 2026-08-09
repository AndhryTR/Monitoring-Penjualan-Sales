import * as XLSX from "xlsx-js-style";
import { todayLocalDateStr } from "./excelParse.js";
// ⚠️ Sprint 4 / Q1: import dari xlsxStyle.js (sebelumnya dari excelExport.js,
// yang re-export dari xlsxStyle.js — sekarang langsung dari sumber supaya
// tidak ada indirection).
import { XL_COLORS, XL_NUMFMT_MONEY, XL_NUMFMT_INT, XL_NUMFMT_PCT, achGradientColor, makeSheetBuilder } from "./xlsxStyle.js";
import { COMPARISON_METRICS, cellMetric } from "./comparison.js";

/* ============================================================================
   EXPORT EXCEL — Tab Perbandingan
   Matriks entitas × periode yang sedang tampil di layar (mode + metrik aktif)
   menjadi worksheet .xlsx, konsisten dengan export lain (title block, header
   berstyle, gradien ACH). Karena xlsx-js-style (versi gratis) tidak bisa
   embed gambar, grafik bar ter-export sebagai file .png TERPISAH — pola sama
   persis dengan tab "Tren Periode" (trendExport.js).

   Kolom ACH: tiap periode punya 2 kolom — metrik aktif + ACH. Kecuali metrik
   aktifnya sendiri "ach" (cuma 1 kolom ACH per periode). Total & Growth di
   kolom terakhir, konsisten dengan tabel di layar.
============================================================================ */

// makeSheetBuilder sekarang di-import dari utils/xlsxStyle.js (Sprint 4 / Q1).
// Wrapper ini dihapus, kode langsung pakai versi shared di xlsxStyle.js.

const MODE_LABEL = { sales: "Sales", group: "Grup Produk", outlet: "Outlet" };

/**
 * Export Excel + PNG chart.
 * @param {Array} kpiRows   dari ComparisonPage (punya cells[], _total, growth)
 * @param {Array} periods   [{id, label, ...}]
 * @param {string} mode     sales|group|outlet
 * @param {string} metricKey
 * @param {object} opts     { depotName, metricLabel, rangeLabel, chartImage }
 */
export function exportComparisonExcel(kpiRows, periods, opts = {}) {
  const { depotName = "", metricKey = "value", metricLabel = "Value", rangeLabel = "", chartImage, mode = "sales" } = opts;
  const metricMeta = COMPARISON_METRICS.find((m) => m.key === metricKey) || COMPARISON_METRICS[0];
  const isMoney = metricMeta.money;
  const isPct = metricMeta.pct;
  // Metrik aktif "ach" -> ACH jadi kolom utama, tak bisa ditambah kolom ACH kedua.
  const addAchCol = metricKey !== "ach";
  // 1 kolom entitas + 2 kolom per periode (metrik + ACH) + Total + Growth
  const totalCols = 1 + periods.length * (addAchCol ? 2 : 1) + 2;

  const b = makeSheetBuilder();

  // ---- Title block ----
  b.setCell(1, 1, `Perbandingan — Mode: ${MODE_LABEL[mode] || mode}`, { bold: true, size: 13, color: XL_COLORS.navy });
  b.merge(1, 1, 1, totalCols);
  const sub = [depotName, rangeLabel, `Dibuat ${todayLocalDateStr()}`].filter(Boolean).join(" · ");
  b.setCell(2, 1, sub, { size: 9, color: "6B7280" });
  b.merge(2, 1, 2, totalCols);

  // ---- Header (2 baris: periode merged, di bawah metrik + ACH) ----
  const HROW1 = 4, HROW2 = 5;
  b.setCell(HROW1, 1, "Entitas", { bold: true, fill: XL_COLORS.headerCyan, align: "center" });
  b.merge(HROW1, 1, HROW2, 1);
  let c = 2;
  periods.forEach((p) => {
    const span = addAchCol ? 2 : 1;
    b.setCell(HROW1, c, p.label, { bold: true, fill: XL_COLORS.headerCyan, align: "center" });
    b.merge(HROW1, c, HROW1, c + span - 1);
    b.setCell(HROW2, c, metricLabel, { bold: true, fill: XL_COLORS.headerCyan, align: "center", size: 9 });
    if (addAchCol) b.setCell(HROW2, c + 1, "ACH", { bold: true, fill: XL_COLORS.headerCyan, align: "center", size: 9 });
    c += span;
  });
  b.setCell(HROW1, c, "Total", { bold: true, fill: XL_COLORS.navy, color: "FFFFFF", align: "center" });
  b.merge(HROW1, c, HROW2, c);
  const growthCol = c + 1;
  b.setCell(HROW1, growthCol, "Growth", { bold: true, fill: XL_COLORS.navy, color: "FFFFFF", align: "center" });
  b.merge(HROW1, growthCol, HROW2, growthCol);

  // ---- Data per entitas ----
  let r = HROW2 + 1;
  kpiRows.forEach((row) => {
    b.setCell(r, 1, row.name, { bold: true });
    const numFmt = isPct ? XL_NUMFMT_PCT : isMoney ? XL_NUMFMT_MONEY : XL_NUMFMT_INT;
    let col = 2;
    row.cells.forEach((cell, i) => {
      if (!cell.exists) {
        // Sel kosong (entitas belum aktif di periode itu) -> "-"
        b.setCell(r, col, "-", { align: "center" });
        if (addAchCol) b.setCell(r, col + 1, "-", { align: "center" });
        col += addAchCol ? 2 : 1;
        return;
      }
      const v = cellMetric(cell, row.qtyByPeriod ? row.qtyByPeriod[i].qty : null, metricKey);
      b.setCell(r, col, v, { numFmt, align: "right" });
      if (addAchCol) {
        const ach = cell.ach;
        b.setCell(r, col + 1, ach === null || ach === undefined ? "-" : ach, {
          numFmt: ach === null || ach === undefined ? undefined : XL_NUMFMT_PCT,
          align: "center", bold: true,
          fill: ach === null || ach === undefined ? undefined : achGradientColor(ach),
        });
      }
      col += addAchCol ? 2 : 1;
    });
    b.setCell(r, c, row._total, { bold: true, numFmt, align: "right" });
    const g = row.growth;
    b.setCell(r, growthCol, g === null || g === undefined ? "-" : g, {
      bold: true, align: "center", numFmt: g === null || g === undefined ? undefined : XL_NUMFMT_PCT,
      color: g === null || g === undefined ? undefined : (g >= 0 ? "059669" : "DC2626"),
    });
    r++;
  });

  // ---- Catatan chart PNG terpisah ----
  const noteRow = r + 1;
  b.setCell(noteRow, 1, "* Grafik perbandingan tersedia di file gambar (.png) terpisah yang ikut ter-download.", { size: 9, color: "6B7280", border: false });
  b.merge(noteRow, 1, noteRow, totalCols);

  const widths = [22];
  periods.forEach(() => widths.push(addAchCol ? 16 : 16, 10));
  widths.push(16, 10);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, b.finalize(widths), "Perbandingan");

  XLSX.writeFile(wb, `Perbandingan_${todayLocalDateStr()}.xlsx`);
  if (chartImage && chartImage.dataUrl) {
    const a = document.createElement("a");
    a.href = chartImage.dataUrl;
    a.download = `Perbandingan_Chart_${todayLocalDateStr()}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }
}