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
  if (!rows || !rows.length) return [];
  const {
    outletCodes = [],
    qtyMin = null,
    qtyMax = null,
    valueMin = null,
    valueMax = null,
    unit = "",
  } = localFilters || {};

  const hasOutletFilter = outletCodes.length > 0;
  const outletSet = hasOutletFilter ? new Set(outletCodes) : null;
  const minQ = (qtyMin !== null && qtyMin !== "") ? Number(qtyMin) : null;
  const maxQ = (qtyMax !== null && qtyMax !== "") ? Number(qtyMax) : null;
  const minV = (valueMin !== null && valueMin !== "") ? Number(valueMin) : null;
  const maxV = (valueMax !== null && valueMax !== "") ? Number(valueMax) : null;

  const result = [];
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (hasOutletFilter && !outletSet.has(r.outletCode)) continue;
    if (minQ !== null && (r.qty || 0) < minQ) continue;
    if (maxQ !== null && (r.qty || 0) > maxQ) continue;
    if (minV !== null && (r.value || 0) < minV) continue;
    if (maxV !== null && (r.value || 0) > maxV) continue;
    if (unit && r.unit !== unit) continue;
    result.push(r);
  }
  return result;
}

/**
 * Hitung statistik ringkas untuk header TransactionsPage dalam single-pass loop linear.
 * Mengembalikan: rowCount, uniqueSales, uniqueOutlets, totalValue.
 */
export function summarizeTransactions(rows) {
  if (!rows || !rows.length) {
    return {
      rowCount: 0,
      uniqueSales: 0,
      uniqueOutlets: 0,
      totalValue: 0,
    };
  }

  const uniqueSales = new Set();
  const uniqueOutlets = new Set();
  let totalValue = 0;

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (r.salesCode) uniqueSales.add(r.salesCode);
    if (r.outletCode) uniqueOutlets.add(r.outletCode);
    totalValue += (r.value || 0);
  }

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
