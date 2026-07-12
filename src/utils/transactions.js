/* ============================================================================
   TRANSACTIONS HELPERS
   Pure functions untuk filter & summarize baris transaksi mentah. Dipakai oleh
   TransactionsPage. Tidak ada dependency ke React — pure logic.
============================================================================ */

/**
 * Filter baris transaksi berdasarkan filter LOKAL (di luar FilterBar global
   yang sudah handle date range, sales, grup).
 *
 * Filter lokal yang didukung:
 * - outletCodes: array kode outlet (kosong = semua)
 * - qtyMin / qtyMax: range qty (null = tidak ada batasan)
 * - valueMin / valueMax: range value dalam Rp (null = tidak ada batasan)
 * - unit: string satuan spesifik (kosong/null = semua satuan)
 */
export function filterTransactions(rows, localFilters) {
  const {
    outletCodes = [],
    qtyMin = null,
    qtyMax = null,
    valueMin = null,
    valueMax = null,
    unit = "",
  } = localFilters || {};

  return rows.filter((r) => {
    if (outletCodes.length && !outletCodes.includes(r.outletCode)) return false;
    if (qtyMin !== null && qtyMin !== "" && (r.qty || 0) < Number(qtyMin)) return false;
    if (qtyMax !== null && qtyMax !== "" && (r.qty || 0) > Number(qtyMax)) return false;
    if (valueMin !== null && valueMin !== "" && (r.value || 0) < Number(valueMin)) return false;
    if (valueMax !== null && valueMax !== "" && (r.value || 0) > Number(valueMax)) return false;
    if (unit && r.unit !== unit) return false;
    return true;
  });
}

/**
 * Hitung statistik ringkas untuk header TransactionsPage.
 * Mengembalikan: rowCount, uniqueSales, uniqueOutlets, totalValue.
 */
export function summarizeTransactions(rows) {
  const uniqueSales = new Set(rows.map((r) => r.salesCode).filter(Boolean));
  const uniqueOutlets = new Set(rows.map((r) => r.outletCode).filter(Boolean));
  const totalValue = rows.reduce((sum, r) => sum + (r.value || 0), 0);
  return {
    rowCount: rows.length,
    uniqueSales: uniqueSales.size,
    uniqueOutlets: uniqueOutlets.size,
    totalValue,
  };
}

/**
 * Ambil daftar unique outlet dari rows, urutkan by name. Dipakai untuk
 * MultiSelect outlet di TransactionFilters.
 */
export function getOutletOptions(rows) {
  const map = new Map();
  rows.forEach((r) => {
    if (r.outletCode && !map.has(r.outletCode)) {
      map.set(r.outletCode, r.outletName || r.outletCode);
    }
  });
  return Array.from(map.entries())
    .map(([code, name]) => ({ code, name }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Ambil daftar unique satuan dari rows, urutkan. Dipakai untuk select satuan
 * di TransactionFilters.
 */
export function getUnitOptions(rows) {
  const set = new Set();
  rows.forEach((r) => { if (r.unit) set.add(r.unit); });
  return Array.from(set).sort();
}
