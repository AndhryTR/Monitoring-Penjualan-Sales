import * as XLSX_MODULE from "xlsx-js-style";
const XLSX = XLSX_MODULE.default || XLSX_MODULE;
import {
  XL_COLORS,
  XL_NUMFMT_INT,
  makeSheetBuilder,
  writeTitleBlock,
  writeHeaderRow,
  sanitizeFilename,
} from "./xlsxStyle.js";
import { fmtMixedUnits } from "./formatters.js";
import { todayLocalDateStr } from "./excelParse.js";

/* ============================================================================
   EXPORT EXCEL — Stok Barang & Inventaris
   Membangun workbook Excel untuk posisi stok fisik per produk.
   Sesuai spesifikasi:
   1) Kolom nilai / rupiah ditiadakan sepenuhnya.
   2) Satuan barang dibuat sangat jelas:
      - Satuan dasar terkecil (PCS, BTL, BKS, KG, dll.)
      - Kuantitas numerik murni untuk perhitungan formula Excel (Stok Awal, Terjual, Sisa Fisik)
      - Kuantitas kombinasi bertingkat (mis. "12 KRT 5 PCS")
      - Coverage hari & Status operasional stok
============================================================================ */

const STATUS_FILLS = {
  HABIS: "FCA5A5",       // merah pastel
  KRITIS: "FDE047",      // kuning pastel
  OVERSTOCK: "BAE6FD",   // biru muda
  DEAD_STOCK: "E2E8F0",  // abu-abu
  AMAN: "BBF7D0",        // hijau pastel
};

/**
 * Ekspor data stok barang ke file Excel (.xlsx)
 * @param {Array} stockItems - daftar produk dari stockMetrics / filteredStock
 * @param {object} opts - { depotName, snapshotDate }
 */
export function exportStockExcel(stockItems = [], opts = {}) {
  const { depotName = "", snapshotDate = "" } = opts;
  const wb = XLSX.utils.book_new();

  const b = makeSheetBuilder();
  const title = "Laporan Posisi Stok Barang & Inventaris";
  const sub = `${depotName || "Depo"} · Snapshot ${snapshotDate || "-"} · Dibuat ${todayLocalDateStr()}`;

  // Judul Laporan (Kolom 1-11)
  writeTitleBlock(b, title, sub, 11);

  // Header Kolom pada baris ke-4
  const headers = [
    "No",
    "Kode Produk",
    "Nama Produk",
    "Grup Produk",
    "Satuan Dasar",
    "Stok Awal",
    "Terjual",
    "Sisa Stok Fisik",
    "Sisa Stok (Kombinasi Satuan)",
    "Coverage (Hari)",
    "Status Stok",
  ];
  writeHeaderRow(b, 4, headers, XL_COLORS.headerCyan);

  // Tulis Baris Data
  stockItems.forEach((p, idx) => {
    const row = 5 + idx;
    const baseUnit = p.unit || "PCS";
    const statusText = p.isStockout
      ? "HABIS"
      : p.isLowStock
        ? "KRITIS"
        : p.isOverstock
          ? "OVERSTOCK"
          : p.isDeadStock
            ? "DEAD STOCK"
            : "AMAN";

    const statusFill = p.isStockout
      ? STATUS_FILLS.HABIS
      : p.isLowStock
        ? STATUS_FILLS.KRITIS
        : p.isOverstock
          ? STATUS_FILLS.OVERSTOCK
          : p.isDeadStock
            ? STATUS_FILLS.DEAD_STOCK
            : STATUS_FILLS.AMAN;

    // 1. No
    b.setCell(row, 1, idx + 1, { align: "center" });

    // 2. Kode Produk
    b.setCell(row, 2, p.productCode || "-", { align: "center" });

    // 3. Nama Produk
    b.setCell(row, 3, p.productName || "-");

    // 4. Grup Produk
    b.setCell(row, 4, p.group || "-", { align: "center" });

    // 5. Satuan Dasar (Sangat Jelas)
    b.setCell(row, 5, baseUnit, { align: "center", bold: true });

    // 6. Stok Awal (Numerik Fisik)
    b.setCell(row, 6, p.openingQty ?? 0, { numFmt: XL_NUMFMT_INT });

    // 7. Terjual (Numerik Fisik)
    b.setCell(row, 7, p.soldQty ?? 0, { numFmt: XL_NUMFMT_INT });

    // 8. Sisa Stok Fisik (Numerik Fisik)
    b.setCell(row, 8, p.currentQty ?? 0, { numFmt: XL_NUMFMT_INT, bold: true });

    // 9. Sisa Stok Kombinasi Satuan (mis. "12 KRT 5 PCS")
    const mixedUnits = fmtMixedUnits(p.currentQty ?? 0, p.conversions, baseUnit);
    b.setCell(row, 9, mixedUnits, { align: "left" });

    // 10. Coverage Hari
    if (p.coverageDays !== null && p.coverageDays !== undefined && !Number.isNaN(p.coverageDays)) {
      b.setCell(row, 10, Math.round(p.coverageDays), { numFmt: XL_NUMFMT_INT, align: "right" });
    } else {
      b.setCell(row, 10, "-", { align: "center", color: XL_COLORS.textMuted });
    }

    // 11. Status Stok (dengan badge fill warna)
    b.setCell(row, 11, statusText, {
      align: "center",
      bold: true,
      fill: statusFill,
    });
  });

  // Lebar kolom yang proporsional
  const colWidths = [6, 16, 36, 18, 14, 14, 14, 16, 26, 16, 16];
  XLSX.utils.book_append_sheet(wb, b.finalize(colWidths), "Stok Barang");

  const safeDepot = sanitizeFilename(depotName || "depo");
  const safeDate = sanitizeFilename(snapshotDate || todayLocalDateStr());
  XLSX.writeFile(wb, `Stok_Barang_${safeDepot}_${safeDate}.xlsx`);
  return true;
}
