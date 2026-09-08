import * as XLSX from "xlsx-js-style";
import { STOCK_ALIASES } from "../constants/stockAliases.js";
import { normalizeHeader } from "./excelParse.js";

/* ============================================================================
   STOCK PARSE — Sprint 19 / Stock Module
   Parser Excel master stok → array products. Pure function, no React deps.
   Dipakai oleh hook useStock saat user upload file Excel master stok.

   Output: { products, stats, errors }
   - products: array of stock product objects (siap simpan ke snapshot)
   - stats: { count, totalQtyBase, totalValue, groupBreakdown, skipped }
   - errors: array of { row, message } untuk baris invalid (di-skip, tidak throw)

   ⚠️ Tidak pernah throw — semua error dikumpulkan di return.errors supaya
   caller bisa tampilkan preview sebelum konfirmasi simpan.
============================================================================ */

function buildStockFieldMap(headerRow) {
  const normalized = headerRow.map(normalizeHeader);
  const map = {};
  Object.entries(STOCK_ALIASES).forEach(([field, variants]) => {
    for (const v of variants) {
      const idx = normalized.indexOf(v);
      if (idx !== -1) { map[field] = idx; break; }
    }
  });
  return map;
}

function cellStr(v) {
  if (v === null || v === undefined) return "";
  return String(v).trim();
}

function cellNum(v) {
  if (v === null || v === undefined || v === "") return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Parse file Excel master stok → objek products.
 *
 * @param {File} file - File .xlsx dari input type="file"
 * @returns {Promise<{products: StockProduct[], stats: object, errors: Array}>}
 */
export async function parseStockExcel(file) {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const sheetName = wb.SheetNames[0]; // pakai sheet pertama
  if (!sheetName) {
    return {
      products: [],
      stats: { count: 0, totalQtyBase: 0, totalValue: 0, groupBreakdown: {}, skipped: 0 },
      errors: [{ row: 0, message: "File tidak memiliki sheet" }],
    };
  }

  const aoa = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], {
    header: 1, defval: null, raw: true,
  });

  if (aoa.length < 2) {
    return {
      products: [],
      stats: { count: 0, totalQtyBase: 0, totalValue: 0, groupBreakdown: {}, skipped: 0 },
      errors: [{ row: 0, message: "Sheet kosong atau tidak ada baris data" }],
    };
  }

  const fmap = buildStockFieldMap(aoa[0]);
  if (fmap.productCode === undefined || fmap.productName === undefined) {
    return {
      products: [],
      stats: { count: 0, totalQtyBase: 0, totalValue: 0, groupBreakdown: {}, skipped: 0 },
      errors: [{
        row: 0,
        message: "Header wajib tidak ditemukan. Pastikan ada kolom KDBR/KODE BARANG dan NMBR/NAMA BARANG.",
      }],
    };
  }

  const products = [];
  const errors = [];
  let skipped = 0;
  const seenCodes = new Set();

  for (let i = 1; i < aoa.length; i++) {
    const r = aoa[i];
    if (!r || r.every((c) => c === null || c === "")) { skipped++; continue; }

    const code = cellStr(r[fmap.productCode]);
    const name = cellStr(r[fmap.productName]);

    if (!code || !name) {
      skipped++;
      continue;
    }

    if (seenCodes.has(code)) {
      errors.push({
        row: i + 1,
        message: `Kode produk "${code}" duplikat — baris kedua di-skip`,
      });
      skipped++;
      continue;
    }
    seenCodes.add(code);

    // Build conversions array (3 level)
    const conversions = [];
    if (fmap.conv1Factor !== undefined && r[fmap.conv1Factor]) {
      conversions.push({
        qty: cellNum(r[fmap.conv1Factor]) || 1,
        unit: cellStr(r[fmap.conv1Unit]) || "UNIT1",
      });
    }
    if (fmap.conv2Factor !== undefined && r[fmap.conv2Factor]) {
      conversions.push({
        qty: cellNum(r[fmap.conv2Factor]) || 1,
        unit: cellStr(r[fmap.conv2Unit]) || "UNIT2",
      });
    }
    if (fmap.conv3Factor !== undefined && r[fmap.conv3Factor]) {
      conversions.push({
        qty: cellNum(r[fmap.conv3Factor]) || 1,
        unit: cellStr(r[fmap.conv3Unit]) || "UNIT3",
      });
    }

    // Find karton conversion (highest factor, usually "KARTON")
    const kartonConv = conversions.find((c) => c.unit?.toUpperCase() === "KARTON");
    const qtyBase = cellNum(r[fmap.qtyBase]);
    const qtyKarton = kartonConv && kartonConv.qty > 0 ? qtyBase / kartonConv.qty : 0;

    const unit = cellStr(r[fmap.unit]) || "PCS";
    const unitCost = cellNum(r[fmap.unitCost]);
    const totalValue = cellNum(r[fmap.totalValue]) || qtyBase * unitCost;

    products.push({
      productCode: code,
      productName: name,
      group: cellStr(r[fmap.group]),
      groupCode: cellStr(r[fmap.groupCode]),
      branchCode: cellStr(r[fmap.branchCode]),
      branchName: cellStr(r[fmap.branchName]),
      qtyBase,
      qtyKarton,
      unit,
      unitCost,
      totalValue,
      conversions,
    });
  }

  // Hitung summary
  const totalQtyBase = products.reduce((s, p) => s + p.qtyBase, 0);
  const totalValue = products.reduce((s, p) => s + p.totalValue, 0);
  const groupBreakdown = {};
  products.forEach((p) => {
    if (!groupBreakdown[p.group]) groupBreakdown[p.group] = { count: 0, qty: 0, value: 0 };
    groupBreakdown[p.group].count++;
    groupBreakdown[p.group].qty += p.qtyBase;
    groupBreakdown[p.group].value += p.totalValue;
  });

  return {
    products,
    stats: {
      count: products.length,
      totalQtyBase,
      totalValue,
      groupBreakdown,
      skipped,
    },
    errors,
  };
}
