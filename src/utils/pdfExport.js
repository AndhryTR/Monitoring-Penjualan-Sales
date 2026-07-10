import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { fmtRp, fmtNum, fmtPct } from "./formatters.js";

/* ============================================================================
   EXPORT PDF
   Dua jenis dokumen:
   1) Laporan Ringkasan — 1 dokumen: KPI utama + leaderboard sales + rekap grup
      produk. Cocok untuk dicetak/dibagikan sebagai laporan harian/mingguan.
   2) Scorecard Sales — 1 halaman per sales: pencapaian, peringkat, breakdown
      per grup produk & produk fokus. Bisa untuk 1 orang saja atau digabung
      jadi 1 file berisi semua sales (1 halaman per orang).
============================================================================ */

const COLORS = {
  ink: [10, 17, 32],
  gold: [217, 119, 6],
  coral: [220, 38, 38],
  mint: [5, 150, 105],
  textMuted: [107, 114, 128],
  text: [17, 24, 39],
  border: [229, 231, 235],
  headerFill: [17, 24, 39],
};

const MONTHS_ID = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

function formatDateID(dateStr) {
  if (!dateStr) return "-";
  const [y, m, d] = dateStr.split("-").map(Number);
  if (!y || !m || !d) return dateStr;
  return `${d} ${MONTHS_ID[m - 1]} ${y}`;
}

function formatGeneratedAt() {
  const now = new Date();
  const d = String(now.getDate()).padStart(2, "0");
  const mo = MONTHS_ID[now.getMonth()];
  const y = now.getFullYear();
  const h = String(now.getHours()).padStart(2, "0");
  const mi = String(now.getMinutes()).padStart(2, "0");
  return `${d} ${mo} ${y}, ${h}:${mi}`;
}

/** Menggambar letterhead/header di halaman aktif. Mengembalikan posisi Y setelah header. */
function drawHeader(doc, { depotName, title, subtitle }) {
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setFillColor(...COLORS.headerFill);
  doc.rect(0, 0, pageWidth, 26, "F");

  doc.setTextColor(...COLORS.gold);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(depotName || "DEPO", 14, 11);

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(title, 14, 18);

  doc.setFontSize(8);
  doc.setTextColor(200, 200, 200);
  doc.text(subtitle, 14, 23);

  doc.setTextColor(...COLORS.text);
  return 34;
}

/** Menggambar footer (nomor halaman + timestamp) di SEMUA halaman yang sudah dibuat. */
function drawFooterOnAllPages(doc) {
  const pageCount = doc.internal.getNumberOfPages();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...COLORS.textMuted);
    doc.text(`Dibuat otomatis oleh Monitoring Penjualan — ${formatGeneratedAt()}`, 14, pageHeight - 8);
    doc.text(`Halaman ${i} / ${pageCount}`, pageWidth - 14, pageHeight - 8, { align: "right" });
  }
}

function achColor(ach) {
  if (ach === null || ach === undefined) return COLORS.textMuted;
  if (ach >= 1) return COLORS.mint;
  if (ach >= 0.8) return COLORS.gold;
  return COLORS.coral;
}

/** Kotak KPI kecil (dipakai di laporan ringkasan). */
function drawKpiBox(doc, x, y, w, h, label, value, accentColor) {
  doc.setDrawColor(...COLORS.border);
  doc.setFillColor(250, 250, 250);
  doc.roundedRect(x, y, w, h, 2, 2, "FD");
  doc.setFillColor(...accentColor);
  doc.roundedRect(x, y, 2.5, h, 1, 1, "F");

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...COLORS.textMuted);
  doc.text(label, x + 6, y + 7);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11.5);
  doc.setTextColor(...COLORS.text);
  doc.text(value, x + 6, y + 15);
}

/* --------------------------------------------------------------------------
   1) LAPORAN RINGKASAN
-------------------------------------------------------------------------- */

export function exportSummaryPDF(agg, targets, opts) {
  const { workDays, depotName } = opts || {};
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();

  const periodLabel = `${formatDateID(agg.meta.firstDate)} — ${formatDateID(agg.meta.lastDate)}`;
  const sdInfo = workDays ? `SD hari kerja ke-${agg.meta.uniqueDays} dari ${workDays} HK` : `${agg.meta.uniqueDays} hari transaksi`;
  let y = drawHeader(doc, { depotName, title: "LAPORAN RINGKASAN MONITORING PENJUALAN", subtitle: `${periodLabel}  ·  ${sdInfo}` });

  // ---- KPI boxes ----
  const boxW = (pageWidth - 28 - 3 * 4) / 4;
  const boxH = 20;
  drawKpiBox(doc, 14, y, boxW, boxH, "TOTAL TARGET", fmtRp(agg.totals.targetValue), COLORS.gold);
  drawKpiBox(doc, 14 + (boxW + 4) * 1, y, boxW, boxH, "TOTAL REALISASI", fmtRp(agg.totals.realisasiValue), COLORS.mint);
  drawKpiBox(doc, 14 + (boxW + 4) * 2, y, boxW, boxH, "ACHIEVEMENT", fmtPct(agg.totals.ach), achColor(agg.totals.ach));
  drawKpiBox(doc, 14 + (boxW + 4) * 3, y, boxW, boxH, "PROYEKSI AKHIR", agg.projection.projectedValue !== null ? fmtRp(agg.projection.projectedValue) : "-", COLORS.coral);
  y += boxH + 8;

  // ---- Leaderboard sales ----
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.setTextColor(...COLORS.text);
  doc.text("Leaderboard Sales", 14, y);
  y += 4;

  const sortedSales = [...agg.bySales].sort((a, b) => (b.ach ?? -1) - (a.ach ?? -1));
  autoTable(doc, {
    startY: y,
    head: [["#", "Sales", "Target", "Realisasi", "Ach%", "Deviasi", "AO"]],
    body: sortedSales.map((s, i) => [
      i + 1, s.name, fmtRp(s.targetValue), fmtRp(s.realisasiValue), fmtPct(s.ach),
      s.deviasiValue !== null ? fmtRp(s.deviasiValue) : "-", `${fmtNum(s.realisasiAo)}/${fmtNum(s.targetAo)}`,
    ]),
    theme: "grid",
    styles: { font: "helvetica", fontSize: 8, cellPadding: 2.2, textColor: COLORS.text, lineColor: COLORS.border, lineWidth: 0.1 },
    headStyles: { fillColor: COLORS.headerFill, textColor: [255, 255, 255], fontStyle: "bold", fontSize: 8 },
    columnStyles: { 0: { cellWidth: 8, halign: "center" }, 2: { halign: "right" }, 3: { halign: "right" }, 4: { halign: "right" }, 5: { halign: "right" }, 6: { halign: "center" } },
    didParseCell: (data) => {
      if (data.section === "body" && data.column.index === 4) {
        const ach = sortedSales[data.row.index].ach;
        data.cell.styles.textColor = achColor(ach);
        data.cell.styles.fontStyle = "bold";
      }
    },
  });
  y = doc.lastAutoTable.finalY + 8;

  // ---- Rekap per grup produk ----
  if (y > 250) { doc.addPage(); y = 20; }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.text("Rekap per Grup Produk", 14, y);
  y += 4;

  const sortedGroups = [...agg.byGroup].sort((a, b) => b.realisasiValue - a.realisasiValue);
  autoTable(doc, {
    startY: y,
    head: [["Grup Produk", "Target", "Realisasi", "Ach%"]],
    body: sortedGroups.map((g) => [g.name, fmtRp(g.targetValue), fmtRp(g.realisasiValue), fmtPct(g.ach)]),
    theme: "grid",
    styles: { font: "helvetica", fontSize: 8, cellPadding: 2.2, textColor: COLORS.text, lineColor: COLORS.border, lineWidth: 0.1 },
    headStyles: { fillColor: COLORS.headerFill, textColor: [255, 255, 255], fontStyle: "bold", fontSize: 8 },
    columnStyles: { 1: { halign: "right" }, 2: { halign: "right" }, 3: { halign: "right" } },
    didParseCell: (data) => {
      if (data.section === "body" && data.column.index === 3) {
        const ach = sortedGroups[data.row.index].ach;
        data.cell.styles.textColor = achColor(ach);
        data.cell.styles.fontStyle = "bold";
      }
    },
  });

  drawFooterOnAllPages(doc);
  doc.save(`Laporan-Ringkasan-${(depotName || "Depo").replace(/\s+/g, "-")}-${agg.meta.lastDate || "export"}.pdf`);
}

/* --------------------------------------------------------------------------
   2) SCORECARD PER SALES
-------------------------------------------------------------------------- */

/** Menggambar 1 halaman scorecard untuk 1 sales. Asumsikan halaman sudah aktif & kosong. */
function drawScorecardPage(doc, salesRow, agg, opts, rank, totalSales) {
  const { workDays, depotName } = opts || {};
  const pageWidth = doc.internal.pageSize.getWidth();

  const periodLabel = `${formatDateID(agg.meta.firstDate)} — ${formatDateID(agg.meta.lastDate)}`;
  const sdInfo = workDays ? `SD hari kerja ke-${agg.meta.uniqueDays} dari ${workDays} HK` : `${agg.meta.uniqueDays} hari transaksi`;
  let y = drawHeader(doc, { depotName, title: "SCORECARD PENCAPAIAN SALES", subtitle: `${periodLabel}  ·  ${sdInfo}` });

  // ---- Identitas sales + peringkat ----
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.setTextColor(...COLORS.text);
  doc.text(salesRow.name, 14, y + 4);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...COLORS.textMuted);
  doc.text(`Kode: ${salesRow.code}   ·   Tier: ${salesRow.tier || "-"}`, 14, y + 10);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...(rank <= Math.ceil(totalSales / 3) ? COLORS.mint : COLORS.textMuted));
  doc.text(`Peringkat ${rank} dari ${totalSales} sales`, pageWidth - 14, y + 7, { align: "right" });
  y += 18;

  // ---- KPI boxes ----
  const boxW = (pageWidth - 28 - 3 * 4) / 4;
  const boxH = 20;
  drawKpiBox(doc, 14, y, boxW, boxH, "TARGET", fmtRp(salesRow.targetValue), COLORS.gold);
  drawKpiBox(doc, 14 + (boxW + 4), y, boxW, boxH, "REALISASI", fmtRp(salesRow.realisasiValue), COLORS.mint);
  drawKpiBox(doc, 14 + (boxW + 4) * 2, y, boxW, boxH, "ACHIEVEMENT", fmtPct(salesRow.ach), achColor(salesRow.ach));
  drawKpiBox(doc, 14 + (boxW + 4) * 3, y, boxW, boxH, "AO", `${fmtNum(salesRow.realisasiAo)}/${fmtNum(salesRow.targetAo)}`, COLORS.textMuted);
  y += boxH + 4;

  if (salesRow.projectedValue !== null && salesRow.projectedValue !== undefined) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...COLORS.textMuted);
    doc.text(`Proyeksi akhir periode: ${fmtRp(salesRow.projectedValue)}  (${fmtPct(salesRow.projectedAch)} dari target)`, 14, y);
    y += 7;
  }

  // ---- Breakdown per grup produk ----
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...COLORS.text);
  doc.text("Breakdown per Grup Produk", 14, y);
  y += 4;

  autoTable(doc, {
    startY: y,
    head: [["Grup Produk", "Target", "Realisasi", "Ach%", "Deviasi"]],
    body: salesRow.groups.map((g) => [g.name, fmtRp(g.targetValue), fmtRp(g.realisasiValue), fmtPct(g.ach), fmtRp(g.deviasiValue)]),
    theme: "grid",
    styles: { font: "helvetica", fontSize: 8, cellPadding: 2.2, textColor: COLORS.text, lineColor: COLORS.border, lineWidth: 0.1 },
    headStyles: { fillColor: COLORS.headerFill, textColor: [255, 255, 255], fontStyle: "bold", fontSize: 8 },
    columnStyles: { 1: { halign: "right" }, 2: { halign: "right" }, 3: { halign: "right" }, 4: { halign: "right" } },
    didParseCell: (data) => {
      if (data.section === "body" && data.column.index === 3) {
        const ach = salesRow.groups[data.row.index].ach;
        data.cell.styles.textColor = achColor(ach);
        data.cell.styles.fontStyle = "bold";
      }
    },
  });
  y = doc.lastAutoTable.finalY + 8;

  // ---- Breakdown produk fokus (kalau ada) ----
  if (salesRow.focus && salesRow.focus.length) {
    if (y > 255) { doc.addPage(); y = 20; }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...COLORS.text);
    doc.text("Produk Fokus", 14, y);
    y += 4;

    autoTable(doc, {
      startY: y,
      head: [["Produk Fokus", "Target", "Realisasi", "%"]],
      body: salesRow.focus.map((f) => [f.name, `${fmtNum(f.target)} ${f.unit || ""}`.trim(), `${fmtNum(f.realisasi)} ${f.unit || ""}`.trim(), fmtPct(f.pct)]),
      theme: "grid",
      styles: { font: "helvetica", fontSize: 8, cellPadding: 2.2, textColor: COLORS.text, lineColor: COLORS.border, lineWidth: 0.1 },
      headStyles: { fillColor: [124, 58, 237], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 8 },
      columnStyles: { 1: { halign: "right" }, 2: { halign: "right" }, 3: { halign: "right" } },
      didParseCell: (data) => {
        if (data.section === "body" && data.column.index === 3) {
          const pct = salesRow.focus[data.row.index].pct;
          data.cell.styles.textColor = achColor(pct);
          data.cell.styles.fontStyle = "bold";
        }
      },
    });
  }
}

export function exportSalesScorecardPDF(salesRow, agg, opts) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const sortedSales = [...agg.bySales].sort((a, b) => (b.ach ?? -1) - (a.ach ?? -1));
  const rank = sortedSales.findIndex((s) => s.code === salesRow.code) + 1;
  drawScorecardPage(doc, salesRow, agg, opts, rank || 1, agg.bySales.length);
  drawFooterOnAllPages(doc);
  doc.save(`Scorecard-${salesRow.name.replace(/\s+/g, "-")}-${agg.meta.lastDate || "export"}.pdf`);
}

export function exportAllScorecardsPDF(agg, opts) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const sortedSales = [...agg.bySales].sort((a, b) => (b.ach ?? -1) - (a.ach ?? -1));
  sortedSales.forEach((salesRow, idx) => {
    if (idx > 0) doc.addPage();
    drawScorecardPage(doc, salesRow, agg, opts, idx + 1, sortedSales.length);
  });
  drawFooterOnAllPages(doc);
  doc.save(`Scorecard-Semua-Sales-${(opts?.depotName || "Depo").replace(/\s+/g, "-")}-${agg.meta.lastDate || "export"}.pdf`);
}
