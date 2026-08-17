import * as XLSX from "xlsx-js-style";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { todayLocalDateStr } from "./excelParse.js";
import { XL_COLORS, XL_NUMFMT_MONEY, XL_NUMFMT_INT, XL_NUMFMT_PCT1, achGradientColor, makeSheetBuilder } from "./xlsxStyle.js";
import { fmtRp, fmtNum, fmtPct } from "./formatters.js";
import { getProductBreakdownForGroup } from "./aggregation.js";

/* ============================================================================
   FOCUS GROUP EXPORT — Sprint 19f
   Export Grup Fokus dalam 2 format:
   - Excel: 2 sheet terpisah (Ringkasan + Detail SKU)
   - PDF: Portrait, per-sales page, KPI grup + detail SKU berdekatan

   Export mengikuti filter aktif (groupRows yang sudah ter-filter di UI).

   Functions:
   - exportFocusGroupExcel(groupRows, filteredRows, opts)
   - exportFocusGroupPDF(groupRows, filteredRows, opts)
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

function formatDateID(dateStr) {
  if (!dateStr) return "-";
  const [y, m, d] = dateStr.split("-").map(Number);
  if (!y || !m || !d) return dateStr;
  return `${d} ${MONTHS_ID[m - 1]} ${y}`;
}

// ---- Excel helpers (reuse pattern from reportExcelExport.js) ----
function writeTitleBlock(b, title, subtitle, colCount) {
  b.setCell(1, 1, title, { bold: true, size: 13, color: XL_COLORS.navy });
  b.merge(1, 1, 1, colCount);
  b.setCell(2, 1, subtitle, { size: 9, color: "6B7280" });
  b.merge(2, 1, 2, colCount);
}

function writeHeaderRow(b, row, labels, fillColor = XL_COLORS.headerCyan) {
  labels.forEach((label, i) => b.setCell(row, i + 1, label, { bold: true, fill: fillColor, align: "center" }));
}

// ============================================================================
//  EXCEL EXPORT — 2 sheet terpisah
// ============================================================================
export function exportFocusGroupExcel(groupRows, filteredRows, opts = {}) {
  const { depotName = "", dateRangeLabel = "" } = opts;
  const wb = XLSX.utils.book_new();

  // ===== Sheet 1: Ringkasan Grup Fokus per Sales =====
  const b1 = makeSheetBuilder();
  writeTitleBlock(b1, "Grup Fokus — Ringkasan per Sales", `${depotName} · ${dateRangeLabel} · Dibuat ${todayLocalDateStr()}`, 7);
  writeHeaderRow(b1, 4, ["Sales", "Grup Fokus", "Target (Rp)", "Realisasi (Rp)", "ACH", "AO (Realisasi/Target)", "Deviasi (Rp)"]);

  let totalTarget = 0, totalRealisasi = 0, totalAoReal = 0, totalAoTarget = 0;

  groupRows.forEach((g, i) => {
    const row = 5 + i;
    const achFill = achGradientColor(g.ach);
    const deviasi = (g.targetValue || 0) - (g.realisasiValue || 0);
    b1.setCell(row, 1, g.salesName);
    b1.setCell(row, 2, g.name);
    b1.setCell(row, 3, g.targetValue, { numFmt: XL_NUMFMT_MONEY });
    b1.setCell(row, 4, g.realisasiValue, { numFmt: XL_NUMFMT_MONEY });
    b1.setCell(row, 5, g.ach !== null && g.ach !== undefined ? g.ach : "", { numFmt: XL_NUMFMT_PCT1, fill: achFill || undefined });
    b1.setCell(row, 6, `${g.realisasiAo || 0}/${g.targetAo || 0}`);
    b1.setCell(row, 7, deviasi, { numFmt: XL_NUMFMT_MONEY });
    totalTarget += g.targetValue || 0;
    totalRealisasi += g.realisasiValue || 0;
    totalAoReal += g.realisasiAo || 0;
    totalAoTarget += g.targetAo || 0;
  });

  // Total row
  const totalRow = 5 + groupRows.length;
  const overallAch = totalTarget ? totalRealisasi / totalTarget : null;
  b1.setCell(totalRow, 1, "TOTAL", { bold: true, fill: XL_COLORS.headerFill, color: "FFFFFF" });
  b1.setCell(totalRow, 2, "", { fill: XL_COLORS.headerFill });
  b1.setCell(totalRow, 3, totalTarget, { bold: true, numFmt: XL_NUMFMT_MONEY, fill: XL_COLORS.headerFill, color: "FFFFFF" });
  b1.setCell(totalRow, 4, totalRealisasi, { bold: true, numFmt: XL_NUMFMT_MONEY, fill: XL_COLORS.headerFill, color: "FFFFFF" });
  b1.setCell(totalRow, 5, overallAch !== null ? overallAch : "", { bold: true, numFmt: XL_NUMFMT_PCT1, fill: XL_COLORS.headerFill, color: "FFFFFF" });
  b1.setCell(totalRow, 6, `${totalAoReal}/${totalAoTarget}`, { bold: true, fill: XL_COLORS.headerFill, color: "FFFFFF" });
  b1.setCell(totalRow, 7, totalTarget - totalRealisasi, { bold: true, numFmt: XL_NUMFMT_MONEY, fill: XL_COLORS.headerFill, color: "FFFFFF" });

  XLSX.utils.book_append_sheet(wb, b1.finalize([22, 20, 18, 18, 10, 16, 18]), "Ringkasan Grup Fokus");

  // ===== Sheet 2: Detail SKU per Grup per Sales =====
  const b2 = makeSheetBuilder();
  writeTitleBlock(b2, "Grup Fokus — Detail SKU per Grup per Sales", `${depotName} · ${dateRangeLabel} · Dibuat ${todayLocalDateStr()}`, 8);
  writeHeaderRow(b2, 4, ["Sales", "Grup Fokus", "Kode Produk", "Nama Produk", "Qty (Karton)", "Value (Rp)", "Frekuensi", "Outlet"]);

  let skuRow = 5;
  groupRows.forEach((g) => {
    const skus = getProductBreakdownForGroup(filteredRows, g.predicate);
    skus.forEach((sku) => {
      b2.setCell(skuRow, 1, g.salesName);
      b2.setCell(skuRow, 2, g.name);
      b2.setCell(skuRow, 3, sku.productCode);
      b2.setCell(skuRow, 4, sku.productName);
      b2.setCell(skuRow, 5, sku.qty, { numFmt: XL_NUMFMT_INT });
      b2.setCell(skuRow, 6, sku.value, { numFmt: XL_NUMFMT_MONEY });
      b2.setCell(skuRow, 7, sku.invoiceCount, { numFmt: XL_NUMFMT_INT });
      b2.setCell(skuRow, 8, sku.outletCount, { numFmt: XL_NUMFMT_INT });
      skuRow++;
    });
    // Subtotal row per sales×group
    const subQty = skus.reduce((s, p) => s + p.qty, 0);
    const subValue = skus.reduce((s, p) => s + p.value, 0);
    const subFrek = skus.reduce((s, p) => s + p.invoiceCount, 0);
    const subOutlet = skus.reduce((s, p) => s + p.outletCount, 0);
    b2.setCell(skuRow, 1, g.salesName, { bold: true, fill: "F3F4F6" });
    b2.setCell(skuRow, 2, `Subtotal ${g.name}`, { bold: true, fill: "F3F4F6" });
    b2.setCell(skuRow, 3, "", { fill: "F3F4F6" });
    b2.setCell(skuRow, 4, `${skus.length} SKU`, { bold: true, fill: "F3F4F6", color: "6B7280" });
    b2.setCell(skuRow, 5, subQty, { bold: true, numFmt: XL_NUMFMT_INT, fill: "F3F4F6" });
    b2.setCell(skuRow, 6, subValue, { bold: true, numFmt: XL_NUMFMT_MONEY, fill: "F3F4F6" });
    b2.setCell(skuRow, 7, subFrek, { bold: true, numFmt: XL_NUMFMT_INT, fill: "F3F4F6" });
    b2.setCell(skuRow, 8, subOutlet, { bold: true, numFmt: XL_NUMFMT_INT, fill: "F3F4F6" });
    skuRow++;
  });

  XLSX.utils.book_append_sheet(wb, b2.finalize([22, 20, 14, 28, 14, 18, 12, 10]), "Detail SKU");

  const safeName = (depotName || "depo").replace(/[^a-z0-9]+/gi, "_");
  XLSX.writeFile(wb, `Grup_Fokus_${safeName}_${todayLocalDateStr()}.xlsx`);
}

// ============================================================================
//  PDF EXPORT — Portrait, per-sales page, KPI + detail SKU berdekatan
// ============================================================================
const PDF_COLORS = {
  ink: [10, 17, 32],
  gold: [217, 119, 6],
  coral: [220, 38, 38],
  mint: [5, 150, 105],
  violet: [124, 58, 237],
  textMuted: [107, 114, 128],
  text: [17, 24, 39],
  border: [229, 231, 235],
  headerFill: [17, 24, 39],
  subtotalFill: [243, 244, 246],
};

export function exportFocusGroupPDF(groupRows, filteredRows, opts = {}) {
  const { depotName = "", dateRangeLabel = "" } = opts;

  // Portrait A4, thin margins (left/right 8mm instead of default 14mm)
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 8; // thin left/right margin

  // Group rows by sales
  const salesMap = new Map();
  groupRows.forEach((g) => {
    if (!salesMap.has(g.salesCode)) {
      salesMap.set(g.salesCode, { salesName: g.salesName, salesCode: g.salesCode, groups: [] });
    }
    salesMap.get(g.salesCode).groups.push(g);
  });

  const salesList = Array.from(salesMap.values());
  let isFirstPage = true;

  salesList.forEach((sales) => {
    if (!isFirstPage) doc.addPage();
    isFirstPage = false;

    let y = 10;

    // ---- Header bar ----
    doc.setFillColor(...PDF_COLORS.headerFill);
    doc.rect(0, 0, pageWidth, 22, "F");
    doc.setTextColor(...PDF_COLORS.gold);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.text(depotName || "DEPO", margin, 9);
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text("Laporan Grup Fokus", margin, 15);
    doc.setFontSize(7.5);
    doc.setTextColor(200, 200, 200);
    doc.text(`${dateRangeLabel} · Dibuat ${formatGeneratedAt()}`, margin, 19);
    y = 28;

    // ---- Sales name ----
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(...PDF_COLORS.violet);
    doc.text(sales.salesName, margin, y);
    y += 5;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...PDF_COLORS.textMuted);
    doc.text(`Kode: ${sales.salesCode} · ${sales.groups.length} grup fokus`, margin, y);
    y += 7;

    // ---- KPI table: group focus summary per sales ----
    const kpiBody = sales.groups.map((g) => {
      const achPct = g.ach !== null && g.ach !== undefined ? (g.ach * 100).toFixed(1) + "%" : "-";
      const deviasi = (g.targetValue || 0) - (g.realisasiValue || 0);
      return [
        g.name,
        fmtRp(g.targetValue),
        fmtRp(g.realisasiValue),
        achPct,
        `${g.realisasiAo || 0}/${g.targetAo || 0}`,
        fmtRp(deviasi),
      ];
    });

    // Subtotal row
    const subTarget = sales.groups.reduce((s, g) => s + (g.targetValue || 0), 0);
    const subReal = sales.groups.reduce((s, g) => s + (g.realisasiValue || 0), 0);
    const subAch = subTarget ? (subReal / subTarget * 100).toFixed(1) + "%" : "-";
    const subAoReal = sales.groups.reduce((s, g) => s + (g.realisasiAo || 0), 0);
    const subAoTarget = sales.groups.reduce((s, g) => s + (g.targetAo || 0), 0);
    kpiBody.push(["SUBTOTAL", fmtRp(subTarget), fmtRp(subReal), subAch, `${subAoReal}/${subAoTarget}`, fmtRp(subTarget - subReal)]);

    autoTable(doc, {
      head: [["Grup Fokus", "Target", "Realisasi", "ACH", "AO", "Deviasi"]],
      body: kpiBody,
      startY: y,
      margin: { left: margin, right: margin },
      styles: { fontSize: 8, cellPadding: 2, textColor: PDF_COLORS.text, lineColor: PDF_COLORS.border, lineWidth: 0.1 },
      headStyles: { fillColor: PDF_COLORS.headerFill, textColor: [255, 255, 255], fontSize: 8, fontStyle: "bold" },
      // Highlight subtotal row (last row)
      didParseCell: (data) => {
        if (data.row.index === kpiBody.length - 1) {
          data.cell.styles.fontStyle = "bold";
          data.cell.styles.fillColor = PDF_COLORS.subtotalFill;
        }
        // ACH color coding (column index 3)
        if (data.column.index === 3 && data.row.index < kpiBody.length - 1) {
          const ach = sales.groups[data.row.index]?.ach;
          if (ach !== null && ach !== undefined) {
            if (ach >= 1) data.cell.styles.textColor = PDF_COLORS.mint;
            else if (ach >= 0.5) data.cell.styles.textColor = PDF_COLORS.gold;
            else data.cell.styles.textColor = PDF_COLORS.coral;
          }
        }
      },
    });
    y = doc.lastAutoTable.finalY + 8;

    // ---- Detail SKU per group ----
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...PDF_COLORS.text);
    doc.text("Detail SKU per Grup", margin, y);
    y += 4;

    sales.groups.forEach((g) => {
      const skus = getProductBreakdownForGroup(filteredRows, g.predicate);
      if (!skus.length) return;

      // Check page break — if not enough space for header + at least 2 rows, add page
      if (y > pageHeight - 40) {
        doc.addPage();
        y = 10;
      }

      // Group header
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      const achPct = g.ach !== null && g.ach !== undefined ? (g.ach * 100).toFixed(1) + "%" : "-";
      const groupColor = g.ach >= 1 ? PDF_COLORS.mint : g.ach >= 0.5 ? PDF_COLORS.gold : PDF_COLORS.coral;
      doc.setTextColor(...groupColor);
      doc.text(`${g.name} — ACH ${achPct} · ${skus.length} SKU`, margin, y);
      y += 3;

      // SKU table
      const skuBody = skus.map((sku) => [
        sku.productCode,
        sku.productName,
        fmtNum(sku.qty),
        fmtRp(sku.value),
        `${sku.invoiceCount}x`,
        `${sku.outletCount}`,
      ]);

      // Subtotal row
      const subQty = skus.reduce((s, p) => s + p.qty, 0);
      const subValue = skus.reduce((s, p) => s + p.value, 0);
      const subFrek = skus.reduce((s, p) => s + p.invoiceCount, 0);
      skuBody.push(["", `Subtotal (${skus.length} SKU)`, fmtNum(subQty), fmtRp(subValue), `${subFrek}x`, ""]);

      autoTable(doc, {
        head: [["Kode", "Nama Produk", "Qty (KRT)", "Value", "Frek", "Outlet"]],
        body: skuBody,
        startY: y,
        margin: { left: margin, right: margin },
        styles: { fontSize: 7.5, cellPadding: 1.5, textColor: PDF_COLORS.text, lineColor: PDF_COLORS.border, lineWidth: 0.1 },
        headStyles: { fillColor: [124, 58, 237], textColor: [255, 255, 255], fontSize: 7.5, fontStyle: "bold" },
        columnStyles: {
          0: { cellWidth: 20 },
          1: { cellWidth: "auto" },
          2: { cellWidth: 18, halign: "right" },
          3: { cellWidth: 25, halign: "right" },
          4: { cellWidth: 14, halign: "center" },
          5: { cellWidth: 14, halign: "center" },
        },
        didParseCell: (data) => {
          if (data.row.index === skuBody.length - 1) {
            data.cell.styles.fontStyle = "bold";
            data.cell.styles.fillColor = PDF_COLORS.subtotalFill;
          }
        },
      });
      y = doc.lastAutoTable.finalY + 6;
    });
  });

  // ---- Footer on all pages ----
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(...PDF_COLORS.textMuted);
    doc.text(`Dibuat otomatis oleh Monitoring Penjualan — ${formatGeneratedAt()}`, margin, pageHeight - 5);
    doc.text(`Halaman ${i} / ${pageCount}`, pageWidth - margin, pageHeight - 5, { align: "right" });
  }

  const safeName = (depotName || "Depo").replace(/\s+/g, "-");
  doc.save(`Grup-Fokus-${safeName}-${todayLocalDateStr()}.pdf`);
}
