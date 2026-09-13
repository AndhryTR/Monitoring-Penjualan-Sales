import * as XLSX from "xlsx-js-style";
import { todayLocalDateStr } from "./excelParse.js";

/* ============================================================================
   MASTER EXPORT — Sprint 18 / Multi-Depo
   Export localTargets (sales+grup+fokus) ke file Excel 3-sheet dengan format
   SAMA dengan template master. Output bisa di-import balik via masterImport.js
   tanpa kehilangan data (round-trip sukses).

   Format Excel 3-sheet:
   - "Sales": KDSL, NMSL, TIER, TARGET, AO — 1 row per sales
   - "Grup":  KDSL, GRUP, TARGET, AO, FOCUS — 1 row per grup per sales
   - "Fokus": KDSL, NMBR, TARGET, KEYWORD, SATUAN — 1 row per fokus per sales

   Sheet kosong bila tidak ada data grup/fokus — header tetap ada supaya
   re-import struktur tetap dikenali.
============================================================================ */

const HEADER_FILL = { patternType: "solid", fgColor: { rgb: "0F172A" } };
const HEADER_FONT = { bold: true, color: { rgb: "FFFFFF" }, sz: 11 };
const BODY_FONT = { color: { rgb: "111827" }, sz: 11 };
const NUMFMT_MONEY = '_(* #,##0_);_(* \\(#,##0\\);_(* "-"??_);_(@_)';
const NUMFMT_INT = "#,##0";
const COL_WIDTHS = {
  sales: [12, 28, 10, 18, 10],
  grup: [12, 20, 18, 10, 10],
  fokus: [12, 32, 12, 26, 12],
};

function headerCell(label) {
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

function textCell(value) {
  return {
    v: String(value ?? ""),
    t: "s",
    s: {
      font: BODY_FONT,
      alignment: { horizontal: "left", vertical: "center" },
      border: {
        top: { style: "thin", color: { rgb: "E5E7EB" } },
        bottom: { style: "thin", color: { rgb: "E5E7EB" } },
        left: { style: "thin", color: { rgb: "E5E7EB" } },
        right: { style: "thin", color: { rgb: "E5E7EB" } },
      },
    },
  };
}

function numCell(value, numFmt = NUMFMT_INT) {
  return {
    v: Number(value) || 0,
    t: "n",
    s: {
      font: BODY_FONT,
      numFmt,
      alignment: { horizontal: "right", vertical: "center" },
      border: {
        top: { style: "thin", color: { rgb: "E5E7EB" } },
        bottom: { style: "thin", color: { rgb: "E5E7EB" } },
        left: { style: "thin", color: { rgb: "E5E7EB" } },
        right: { style: "thin", color: { rgb: "E5E7EB" } },
      },
    },
  };
}

function buildSheetFromAOA(headers, rows, colWidths) {
  const ws = {};
  // Header row
  headers.forEach((h, c) => {
    const cellRef = XLSX.utils.encode_cell({ r: 0, c });
    ws[cellRef] = headerCell(h);
  });
  // Data rows
  rows.forEach((row, r) => {
    row.forEach((cell, c) => {
      const cellRef = XLSX.utils.encode_cell({ r: r + 1, c });
      ws[cellRef] = cell;
    });
  });
  // Range
  ws["!ref"] = XLSX.utils.encode_range({
    s: { r: 0, c: 0 },
    e: { r: rows.length, c: headers.length - 1 },
  });
  // Col widths
  ws["!cols"] = colWidths.map((w) => ({ wch: w }));
  // Row heights
  ws["!rows"] = [{ hpt: 24 }, ...rows.map(() => ({ hpt: 18 }))];
  return ws;
}

/**
 * Export daftar targets ke file Excel 3-sheet dan trigger download.
 *
 * @param {Target[]} targets - daftar sales dengan struktur { code, name, tier,
 *   total: { value, ao }, groups: [{ name, value, ao, focus }], focus: [{ name,
 *   target, keyword, unit }] }
 * @param {object} opts - { depotName, depotCode } untuk nama file
 */
export function exportMasterExcel(targets, opts = {}) {
  const { depotName = "depo", depotCode = "" } = opts;
  const safeTargets = Array.isArray(targets) ? targets : [];
  const wb = XLSX.utils.book_new();

  // ===== Sheet 1: Sales =====
  const salesHeaders = ["KDSL", "NMSL", "TIER", "TARGET", "AO"];
  const salesRows = safeTargets.map((t) => [
    textCell(t.code || ""),
    textCell(t.name || ""),
    textCell(t.tier || "mint"),
    numCell(t.total?.value ?? 0, NUMFMT_MONEY),
    numCell(t.total?.ao ?? 0, NUMFMT_INT),
  ]);
  const salesSheet = buildSheetFromAOA(salesHeaders, salesRows, COL_WIDTHS.sales);
  XLSX.utils.book_append_sheet(wb, salesSheet, "Sales");

  // ===== Sheet 2: Grup =====
  const grupHeaders = ["KDSL", "GRUP", "TARGET", "AO", "FOCUS"];
  const grupRows = [];
  safeTargets.forEach((t) => {
    (t.groups || []).forEach((g) => {
      grupRows.push([
        textCell(t.code || ""),
        textCell(g.name || ""),
        numCell(g.value ?? 0, NUMFMT_MONEY),
        numCell(g.ao ?? 0, NUMFMT_INT),
        textCell(g.focus ? "TRUE" : "FALSE"),
      ]);
    });
  });
  const grupSheet = buildSheetFromAOA(grupHeaders, grupRows, COL_WIDTHS.grup);
  XLSX.utils.book_append_sheet(wb, grupSheet, "Grup");

  // ===== Sheet 3: Fokus =====
  const fokusHeaders = ["KDSL", "NMBR", "TARGET", "KEYWORD", "SATUAN"];
  const fokusRows = [];
  safeTargets.forEach((t) => {
    (t.focus || []).forEach((f) => {
      fokusRows.push([
        textCell(t.code || ""),
        textCell(f.name || ""),
        numCell(f.target ?? 0, NUMFMT_INT),
        textCell(f.keyword || ""),
        textCell(f.unit || "KARTON"),
      ]);
    });
  });
  const fokusSheet = buildSheetFromAOA(fokusHeaders, fokusRows, COL_WIDTHS.fokus);
  XLSX.utils.book_append_sheet(wb, fokusSheet, "Fokus");

  // Filename: Master_<depoName>_<depotCode>_<date>.xlsx
  const safeName = String(depotName).replace(/[^a-z0-9]+/gi, "_").replace(/^_|_$/g, "");
  const safeCode = String(depotCode).replace(/[^a-z0-9]+/gi, "_").replace(/^_|_$/g, "");
  const filename = `Master_${safeName || "depo"}${safeCode ? `_${safeCode}` : ""}_${todayLocalDateStr()}.xlsx`;
  XLSX.writeFile(wb, filename);
}
