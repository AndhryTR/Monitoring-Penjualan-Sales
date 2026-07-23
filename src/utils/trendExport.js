import * as XLSX from "xlsx-js-style";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import html2canvas from "html2canvas";
import { fmtRp, fmtNum, fmtPct } from "./formatters.js";
import { todayLocalDateStr } from "./excelParse.js";
import { ACH_TIERS } from "../constants/thresholds.js";

/* ============================================================================
   EXPORT TREN PERIODE
   Export untuk tab "Tren Periode": Excel (2 sheet: Value & AO) + gambar chart
   terpisah (karena xlsx-js-style versi gratis tidak bisa embed gambar ke
   sheet), dan PDF (chart di-embed langsung + tabel Value & AO).

   Warna & format numerik di file ini SENGAJA DIDUPLIKASI (bukan di-import)
   dari excelExport.js / pdfExport.js — mengikuti konvensi yang sudah ada di
   imageExport.js, supaya perubahan di sini tidak berisiko mengubah perilaku
   fitur export lain yang sudah berjalan.
============================================================================ */

const MONTHS_ID = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

function formatGeneratedAt() {
  const now = new Date();
  const d = String(now.getDate()).padStart(2, "0");
  const mo = MONTHS_ID[now.getMonth()];
  const y = now.getFullYear();
  const h = String(now.getHours()).padStart(2, "0");
  const mi = String(now.getMinutes()).padStart(2, "0");
  return `${d} ${mo} ${y}, ${h}:${mi}`;
}

/** Ambil hanya baris sales yang namanya ada di `selectedNames`, urutan mengikuti selectedNames. */
function filterSelectedSales(bySales, selectedNames) {
  const byName = new Map(bySales.map((s) => [s.name, s]));
  return selectedNames.map((name) => byName.get(name)).filter(Boolean);
}

/* ----------------------------------------------------------------------------
   CAPTURE CHART -> GAMBAR (dipakai untuk PNG terpisah di Excel & embed di PDF)
----------------------------------------------------------------------------- */

/**
 * Memfoto elemen chart (DOM node) apa adanya seperti yang sedang tampil di
 * layar (termasuk warna tema aktif, light/dark). `backgroundColor` diisi
 * warna surface tema aktif supaya area transparan di sekitar SVG tidak jadi
 * hitam/putih polos yang tidak sesuai tema.
 * Mengembalikan { dataUrl, width, height } (width/height = ukuran natural
 * canvas hasil capture, dipakai buat menjaga rasio saat ditempel ke PDF).
 */
export async function captureChartImage(node, backgroundColor) {
  const canvas = await html2canvas(node, { scale: 2, backgroundColor, useCORS: true });
  return { dataUrl: canvas.toDataURL("image/png"), width: canvas.width, height: canvas.height };
}

function downloadDataUrl(dataUrl, filename) {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

/* ----------------------------------------------------------------------------
   EXCEL (.xlsx + .png terpisah untuk chart)
----------------------------------------------------------------------------- */

const XL_NUMFMT_MONEY = '_(* #,##0_);_(* \\(#,##0\\);_(* "-"??_);_(@_)';
const XL_NUMFMT_INT = "#,##0";
const XL_NUMFMT_PCT = "0.0%";
const XL_COLORS = { headerFill: "111827", mint: "059669", coral: "DC2626", textMuted: "6B7280" };

// Gradien pencapaian: 0% merah -> 70% kuning -> 100%+ hijau, selaras ACH_TIERS.
const ACH_GRADIENT_STOPS = [
  { pct: 0, rgb: [248, 105, 107] },
  { pct: ACH_TIERS.warning, rgb: [255, 235, 132] },
  { pct: ACH_TIERS.onPace, rgb: [99, 190, 123] },
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
  return `${hex(r)}${hex(g)}${hex(b)}`;
}

/** Membangun 1 sheet (Value ATAU AO) untuk sales & periode terpilih. */
function buildTrendSheet(XLSX_ws_helpers, { periods, salesRows, metric, depotName, periodRangeLabel }) {
  const ws = {};
  const merges = [];
  let lastRow = 0;
  let lastCol = 0;

  const setCell = (r, c, value, style = {}) => {
    const ref = XLSX.utils.encode_cell({ r: r - 1, c: c - 1 });
    const isNum = typeof value === "number";
    const cellObj = { v: value === null || value === undefined ? "" : value, t: isNum ? "n" : "s" };
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
    if (c > lastCol) lastCol = c;
  };
  const merge = (r1, c1, r2, c2) => merges.push({ s: { r: r1 - 1, c: c1 - 1 }, e: { r: r2 - 1, c: c2 - 1 } });

  const metricLabel = metric === "value" ? "VALUE" : "AO";
  const totalCols = 1 + periods.length * 2 + 1; // SALES + (VALUE/ACH% per periode) + GROWTH

  // ---- Judul & info ----
  setCell(1, 1, `TREN PERIODE — ${metricLabel} PER SALES`, { bold: true, size: 13, fill: XL_COLORS.headerFill, color: "FFFFFF" });
  merge(1, 1, 1, totalCols);
  setCell(2, 1, `Depot: ${depotName || "-"}   |   Periode: ${periodRangeLabel}   |   Dibuat: ${formatGeneratedAt()}`, { size: 9, color: "595959", border: false });
  merge(2, 1, 2, totalCols);

  // ---- Header 2 baris ----
  const HROW1 = 4, HROW2 = 5;
  setCell(HROW1, 1, "SALES", { bold: true, fill: XL_COLORS.headerFill, color: "FFFFFF", align: "center" });
  merge(HROW1, 1, HROW2, 1);
  periods.forEach((p, i) => {
    const c = 2 + i * 2;
    setCell(HROW1, c, p.label, { bold: true, fill: XL_COLORS.headerFill, color: "FFFFFF", align: "center" });
    merge(HROW1, c, HROW1, c + 1);
    setCell(HROW2, c, metricLabel, { bold: true, fill: XL_COLORS.headerFill, color: "FFFFFF", align: "center", size: 9 });
    setCell(HROW2, c + 1, "ACH%", { bold: true, fill: XL_COLORS.headerFill, color: "FFFFFF", align: "center", size: 9 });
  });
  const growthCol = totalCols;
  setCell(HROW1, growthCol, "GROWTH", { bold: true, fill: XL_COLORS.headerFill, color: "FFFFFF", align: "center" });
  merge(HROW1, growthCol, HROW2, growthCol);

  // ---- Baris data per sales ----
  let r = HROW2 + 1;
  salesRows.forEach((s) => {
    setCell(r, 1, s.name, { bold: true, align: "left" });
    periods.forEach((p, i) => {
      const c = 2 + i * 2;
      const pt = s.series[i];
      if (!pt || pt.missing) {
        setCell(r, c, "-", { align: "center" });
        setCell(r, c + 1, "-", { align: "center" });
        return;
      }
      const val = metric === "value" ? pt.value : pt.ao;
      const ach = metric === "value" ? pt.ach : pt.achAo;
      setCell(r, c, val, { numFmt: metric === "value" ? XL_NUMFMT_MONEY : XL_NUMFMT_INT, align: "right" });
      setCell(r, c + 1, ach === null ? "-" : ach, {
        bold: true, align: "center",
        numFmt: ach === null ? undefined : XL_NUMFMT_PCT,
        fill: ach === null ? undefined : achGradientColor(ach),
      });
    });
    const growth = metric === "value" ? s.growthValue : s.growthAo;
    setCell(r, growthCol, growth === null || growth === undefined ? "-" : growth, {
      bold: true, align: "center",
      numFmt: growth === null || growth === undefined ? undefined : XL_NUMFMT_PCT,
      color: growth === null || growth === undefined ? undefined : (growth >= 0 ? XL_COLORS.mint : XL_COLORS.coral),
    });
    r++;
  });

  // ---- Catatan chart ----
  const noteRow = r + 1;
  setCell(noteRow, 1, "* Grafik tren tersedia di file gambar (.png) terpisah yang ikut ter-download.", { size: 9, color: XL_COLORS.textMuted, border: false });
  merge(noteRow, 1, noteRow, totalCols);

  ws["!ref"] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: lastRow - 1, c: lastCol - 1 } });
  ws["!merges"] = merges;
  ws["!cols"] = [24, ...periods.flatMap(() => [16, 10]), 10].map((w) => ({ wch: w }));
  return ws;
}

/**
 * Export Excel Tren Periode: 1 file .xlsx (sheet "Value" + sheet "AO") untuk
 * sales yang dipilih di chart, DAN 1 file .png terpisah (chart) kalau
 * `chartImage` disediakan — didownload bersamaan.
 */
export function exportTrendExcel(comparisonData, selectedNames, opts = {}) {
  const { depotName, chartImage } = opts;
  const { periods, bySales } = comparisonData;
  const salesRows = filterSelectedSales(bySales, selectedNames);
  const periodRangeLabel = periods.length ? `${periods[0].label} — ${periods[periods.length - 1].label}` : "-";

  const wb = XLSX.utils.book_new();
  const wsValue = buildTrendSheet(XLSX, { periods, salesRows, metric: "value", depotName, periodRangeLabel });
  const wsAo = buildTrendSheet(XLSX, { periods, salesRows, metric: "ao", depotName, periodRangeLabel });
  XLSX.utils.book_append_sheet(wb, wsValue, "Value");
  XLSX.utils.book_append_sheet(wb, wsAo, "AO");

  const today = todayLocalDateStr();
  XLSX.writeFile(wb, `Tren_Periode_${today}.xlsx`);

  if (chartImage && chartImage.dataUrl) {
    downloadDataUrl(chartImage.dataUrl, `Tren_Periode_Chart_${today}.png`);
  }
}

/* ----------------------------------------------------------------------------
   PDF (chart di-embed langsung + tabel Value & AO)
----------------------------------------------------------------------------- */

const PDF_COLORS = {
  headerFill: [17, 24, 39],
  gold: [217, 119, 6],
  text: [17, 24, 39],
  textMuted: [107, 114, 128],
  border: [229, 231, 235],
  mint: [5, 150, 105],
  coral: [220, 38, 38],
};

function pdfAchColor(ach) {
  if (ach === null || ach === undefined) return PDF_COLORS.textMuted;
  if (ach >= ACH_TIERS.onPace) return PDF_COLORS.mint;
  if (ach >= ACH_TIERS.warning) return PDF_COLORS.gold;
  return PDF_COLORS.coral;
}

function drawTrendHeader(doc, { depotName, subtitle }) {
  const pageWidth = doc.internal.pageSize.getWidth();
  doc.setFillColor(...PDF_COLORS.headerFill);
  doc.rect(0, 0, pageWidth, 26, "F");
  doc.setTextColor(...PDF_COLORS.gold);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(depotName || "DEPO", 14, 11);
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text("TREN PERIODE — VALUE & AO PER SALES", 14, 18);
  doc.setFontSize(8);
  doc.setTextColor(200, 200, 200);
  doc.text(subtitle, 14, 23);
  doc.setTextColor(...PDF_COLORS.text);
  return 34;
}

function drawTrendFooter(doc) {
  const pageCount = doc.internal.getNumberOfPages();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...PDF_COLORS.textMuted);
    doc.text(`Dibuat otomatis oleh Monitoring Penjualan — ${formatGeneratedAt()}`, 14, pageHeight - 8);
    doc.text(`Halaman ${i} / ${pageCount}`, pageWidth - 14, pageHeight - 8, { align: "right" });
  }
}

function drawTrendSectionTitle(doc, text, y) {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.setTextColor(...PDF_COLORS.text);
  doc.text(text, 14, y);
  return y + 4;
}

/** Menambahkan 1 tabel Value ATAU AO ke dokumen, mulai dari posisi y. Mengembalikan y setelah tabel. */
function drawTrendTable(doc, { periods, salesRows, metric, y }) {
  const metricLabel = metric === "value" ? "Value" : "AO";
  y = drawTrendSectionTitle(doc, `Detail ${metricLabel} per Sales`, y);

  const head = [["Sales", ...periods.map((p) => p.label), "Growth"]];
  const body = salesRows.map((s) => {
    const cells = [s.name];
    periods.forEach((p, i) => {
      const pt = s.series[i];
      if (!pt || pt.missing) { cells.push("-"); return; }
      const val = metric === "value" ? pt.value : pt.ao;
      const ach = metric === "value" ? pt.ach : pt.achAo;
      const valStr = metric === "value" ? fmtRp(val) : fmtNum(val);
      cells.push(`${valStr}\n${ach === null ? "-" : fmtPct(ach)}`);
    });
    const growth = metric === "value" ? s.growthValue : s.growthAo;
    cells.push(growth === null || growth === undefined ? "-" : fmtPct(Math.abs(growth)) + (growth >= 0 ? " ▲" : " ▼"));
    return cells;
  });

  // achByRowCol dipakai didParseCell untuk mewarnai baris kedua tiap cell periode
  const achByRowCol = salesRows.map((s) =>
    periods.map((p, i) => {
      const pt = s.series[i];
      if (!pt || pt.missing) return null;
      return metric === "value" ? pt.ach : pt.achAo;
    })
  );
  const growthByRow = salesRows.map((s) => (metric === "value" ? s.growthValue : s.growthAo));

  autoTable(doc, {
    startY: y,
    head,
    body,
    theme: "grid",
    styles: { font: "helvetica", fontSize: 7.5, cellPadding: 1.8, textColor: PDF_COLORS.text, lineColor: PDF_COLORS.border, lineWidth: 0.1, valign: "middle" },
    headStyles: { fillColor: PDF_COLORS.headerFill, textColor: [255, 255, 255], fontStyle: "bold", fontSize: 8 },
    columnStyles: Object.fromEntries(periods.map((_, i) => [i + 1, { halign: "center" }]).concat([[periods.length + 1, { halign: "center" }]])),
    margin: { left: 14, right: 14 },
    didParseCell: (data) => {
      if (data.section !== "body") return;
      if (data.column.index === 0) { data.cell.styles.fontStyle = "bold"; return; }
      const lastCol = periods.length + 1;
      if (data.column.index === lastCol) {
        const g = growthByRow[data.row.index];
        data.cell.styles.textColor = g === null || g === undefined ? PDF_COLORS.textMuted : (g >= 0 ? PDF_COLORS.mint : PDF_COLORS.coral);
        data.cell.styles.fontStyle = "bold";
        return;
      }
      const periodIdx = data.column.index - 1;
      const ach = achByRowCol[data.row.index][periodIdx];
      data.cell.styles.textColor = pdfAchColor(ach);
    },
  });
  return doc.lastAutoTable.finalY + 8;
}

/**
 * Export PDF Tren Periode: 1 dokumen berisi gambar chart (sesuai metric yang
 * aktif di layar saat export ditekan) + tabel Value & tabel AO, untuk sales
 * yang dipilih di chart.
 */
export function exportTrendPDF(comparisonData, selectedNames, opts = {}) {
  const { depotName, chartImage } = opts;
  const { periods, bySales } = comparisonData;
  const salesRows = filterSelectedSales(bySales, selectedNames);
  const periodRangeLabel = periods.length ? `${periods[0].label} — ${periods[periods.length - 1].label}` : "-";

  const doc = new jsPDF({ unit: "mm", format: "a4" });
  let y = drawTrendHeader(doc, { depotName, subtitle: `Periode: ${periodRangeLabel}  ·  ${salesRows.length} sales dipilih` });

  if (chartImage && chartImage.dataUrl) {
    const pageWidth = doc.internal.pageSize.getWidth();
    const maxW = pageWidth - 28;
    const ratio = chartImage.height / chartImage.width;
    const imgW = maxW;
    const imgH = imgW * ratio;
    doc.addImage(chartImage.dataUrl, "PNG", 14, y, imgW, imgH);
    y += imgH + 8;
  }

  if (y > 240) { doc.addPage(); y = 20; }
  y = drawTrendTable(doc, { periods, salesRows, metric: "value", y });

  if (y > 240) { doc.addPage(); y = 20; }
  y = drawTrendTable(doc, { periods, salesRows, metric: "ao", y });

  drawTrendFooter(doc);
  doc.save(`Tren_Periode_${todayLocalDateStr()}.pdf`);
}
