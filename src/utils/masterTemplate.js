import * as XLSX from "xlsx-js-style";
import { todayLocalDateStr } from "./excelParse.js";

/* ============================================================================
   MASTER TEMPLATE GENERATOR — Sprint 18 / Multi-Depo
   Generate file Excel kosong (3-sheet) sebagai template yang bisa diisi user
   dan di-import kembali lewat masterImport.js. Dipanggil dari tombol
   "Download Template" di TargetSalesEditor.

   3 sheet:
   - "Sales"  (WAJIB): header KDSL, NMSL, TIER, TARGET, AO + 1 baris contoh
   - "Grup"   (opsional): header KDSL, GRUP, TARGET, AO, FOCUS + 1 baris contoh
   - "Fokus"  (opsional): header KDSL, NMBR, TARGET, KEYWORD, SATUAN + 1 contoh

   Style: header dark-fill + bold white text, body cells borderless, width
   optimal untuk editing di Excel/Google Sheets/LibreOffice.
============================================================================ */

const HEADER_FILL = { patternType: "solid", fgColor: { rgb: "0F172A" } };
const HEADER_FONT = { bold: true, color: { rgb: "FFFFFF" }, sz: 11 };
const SAMPLE_FONT = { italic: true, color: { rgb: "6B7280" }, sz: 10 };
const COL_WIDTHS = {
  sales: [12, 28, 8, 16, 8],
  grup: [12, 18, 16, 8, 8],
  fokus: [12, 30, 12, 24, 10],
};

function makeHeaderCell(label) {
  return {
    v: label,
    t: "s",
    s: {
      fill: HEADER_FILL,
      font: HEADER_FONT,
      alignment: { horizontal: "center", vertical: "center" },
      border: {
        top: { style: "thin", color: { rgb: "0F172A" } },
        bottom: { style: "thin", color: { rgb: "0F172A" } },
        left: { style: "thin", color: { rgb: "0F172A" } },
        right: { style: "thin", color: { rgb: "0F172A" } },
      },
    },
  };
}

function makeSampleCell(text, isNumeric = false) {
  return {
    v: text,
    t: isNumeric ? "n" : "s",
    s: {
      font: SAMPLE_FONT,
      alignment: { horizontal: isNumeric ? "right" : "left", vertical: "center" },
    },
  };
}

function makeEmptyCell() {
  return { v: "", t: "s" };
}

function buildSheet(headers, sampleRow, colWidths) {
  const ws = {};
  // Header row (row 1)
  headers.forEach((h, c) => {
    const cellRef = XLSX.utils.encode_cell({ r: 0, c });
    ws[cellRef] = makeHeaderCell(h);
  });
  // Sample row (row 2) — sebagai panduan, user hapus sebelum import
  if (sampleRow) {
    sampleRow.forEach((v, c) => {
      const cellRef = XLSX.utils.encode_cell({ r: 1, c });
      ws[cellRef] = makeSampleCell(v, typeof v === "number");
    });
  }
  // Empty row (row 3) — boundary
  headers.forEach((_, c) => {
    const cellRef = XLSX.utils.encode_cell({ r: 2, c });
    ws[cellRef] = makeEmptyCell();
  });
  // Range
  ws["!ref"] = XLSX.utils.encode_range({
    s: { r: 0, c: 0 },
    e: { r: 2, c: headers.length - 1 },
  });
  // Col widths
  ws["!cols"] = colWidths.map((w) => ({ wch: w }));
  // Row heights
  ws["!rows"] = [{ hpt: 24 }, { hpt: 18 }, { hpt: 18 }];
  return ws;
}

/**
 * Generate file Excel template kosong dan trigger download di browser.
 *
 * @param {object} opts - { depotName } untuk nama file
 * @returns {void}
 */
export function downloadMasterTemplate(opts = {}) {
  const { depotName = "depo" } = opts;

  const wb = XLSX.utils.book_new();

  // Sheet 1: Sales (WAJIB)
  const salesHeaders = ["KDSL", "NMSL", "TIER", "TARGET", "AO"];
  const salesSample = ["AGM", "AGUNG MULIADI", "mint", 150000000, 18];
  const salesSheet = buildSheet(salesHeaders, salesSample, COL_WIDTHS.sales);
  XLSX.utils.book_append_sheet(wb, salesSheet, "Sales");

  // Sheet 2: Grup (opsional)
  const grupHeaders = ["KDSL", "GRUP", "TARGET", "AO", "FOCUS"];
  const grupSample = ["AGM", "BERAT", 50000000, 6, "TRUE"];
  const grupSheet = buildSheet(grupHeaders, grupSample, COL_WIDTHS.grup);
  XLSX.utils.book_append_sheet(wb, grupSheet, "Grup");

  // Sheet 3: Fokus (opsional)
  const fokusHeaders = ["KDSL", "NMBR", "TARGET", "KEYWORD", "SATUAN"];
  const fokusSample = ["AGM", "INDOMIE GORENG 5pcs", 100, "INDOMIE GORENG", "KRT"];
  const fokusSheet = buildSheet(fokusHeaders, fokusSample, COL_WIDTHS.fokus);
  XLSX.utils.book_append_sheet(wb, fokusSheet, "Fokus");

  // Filename: Template_Master_<depo>_<date>.xlsx
  const safeName = String(depotName).replace(/[^a-z0-9]+/gi, "_").replace(/^_|_$/g, "");
  const filename = `Template_Master_${safeName || "depo"}_${todayLocalDateStr()}.xlsx`;
  XLSX.writeFile(wb, filename);
}
