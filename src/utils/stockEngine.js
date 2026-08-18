/* ============================================================================
   STOCK ENGINE — Sprint 19 / Stock Module
   Pure functions untuk compute current stock dari snapshot + transactions.

   Konsep (Sprint 1 — Stock Movement Basic):
   - Snapshot = opening stock per produk pada tanggal tertentu
   - Current stock = opening - sum(qty sold AFTER snapshot date)
   - Transaksi SEBELUM snapshot date diabaikan (sudah include di snapshot)
   - Tidak ada adjustment/reconciliation di Sprint 1 (menyusul di Sprint 2)

   Input:
   - snapshot: { products: [{ productCode, qtyBase, ... }], snapshotDate, ... }
   - transactions: array of { productCode, date, qty, ... }
   - salesData (optional): { productCode -> { totalQty, avgDailyQty } } untuk metrics

   Output: Map<productCode, StockItem>
============================================================================ */

/**
 * Compute current stock = snapshot opening - sales after snapshot date.
 *
 * @param {StockSnapshot} snapshot - active stock snapshot
 * @param {Array} transactions - filtered rows (any date — hook will filter)
 * @returns {Map<string, StockItem>}
 */
export function computeCurrentStock(snapshot, transactions) {
  const stockMap = new Map();

  if (!snapshot || !snapshot.products) return stockMap;

  const snapshotDate = snapshot.snapshotDate;

  // 1. Initialize with opening stock from snapshot
  snapshot.products.forEach((p) => {
    stockMap.set(p.productCode, {
      productCode: p.productCode,
      productName: p.productName,
      group: p.group,
      branchCode: p.branchCode,
      branchName: p.branchName,
      unit: p.unit,
      conversions: p.conversions || [],
      openingQty: p.qtyBase,
      qtyKarton: p.qtyKarton || 0,
      unitCost: p.unitCost || 0,
      openingValue: p.totalValue || 0,
      soldQty: 0,
      soldQtyKarton: 0,
      currentQty: p.qtyBase,
      currentValue: p.totalValue || 0,
      lastSoldDate: null,
      transactionCount: 0,
    });
  });

  // 2. Subtract sales (only transactions AFTER snapshot date)
  // ⚠️ Sprint 19g3 / Bugfix: konversi qty transaksi ke satuan dasar (PCS)
  // sebelum mengurangi stok. Sebelumnya pakai r.qty mentah — kalau transaksi
  // mencatat "1 KARTON" (qty=1, unit=KARTON), stok berkurang 1, padahal
  // seharusnya berkurang 30 PCS (jika KONV=30). Sekarang:
  // - Kalau r.unit == stock.unit (sama-sama PCS) → pakai r.qty langsung
  // - Kalau beda → cari conversion factor dari r.konv atau dari stock.conversions
  // - Kalau tidak ada konversi → fallback pakai r.qty (better than crash)
  if (transactions && transactions.length) {
    transactions.forEach((r) => {
      // Skip transactions before snapshot date (already included in opening stock)
      if (snapshotDate && r.date && r.date < snapshotDate) return;

      const stock = stockMap.get(r.productCode);
      if (!stock) return;

      // Convert transaction qty to stock's base unit (PCS)
      const txnUnit = String(r.unit || "").toUpperCase();
      const stockUnit = String(stock.unit || "").toUpperCase();
      let qtySold;
      if (txnUnit === stockUnit || !txnUnit) {
        // Same unit or no unit info — use qty as-is
        qtySold = Number(r.qty) || 0;
      } else if (r.konv && r.konv > 0) {
        // Transaction has its own conversion factor (r.konv converts r.unit → baseUnit)
        qtySold = (Number(r.qty) || 0) * r.konv;
      } else {
        // Try to find conversion from stock's conversions array
        const conv = stock.conversions?.find(
          (c) => String(c.unit || "").toUpperCase() === txnUnit
        );
        if (conv && conv.qty > 0) {
          qtySold = (Number(r.qty) || 0) * conv.qty;
        } else {
          // Fallback: use qty as-is (may be inaccurate but won't crash)
          qtySold = Number(r.qty) || 0;
        }
      }

      stock.soldQty += qtySold;
      stock.currentQty = stock.openingQty - stock.soldQty;
      stock.transactionCount++;

      // Track last sold date
      if (!stock.lastSoldDate || r.date > stock.lastSoldDate) {
        stock.lastSoldDate = r.date;
      }
    });
  }

  // 3. Recompute current value (qty-based, using unitCost)
  for (const [, stock] of stockMap) {
    stock.currentValue = stock.currentQty * stock.unitCost;
    // Recompute qtyKarton based on current qty
    const kartonConv = stock.conversions.find((c) => c.unit?.toUpperCase() === "KARTON");
    if (kartonConv) {
      stock.currentQtyKarton = stock.currentQty / kartonConv.qty;
      stock.soldQtyKarton = stock.soldQty / kartonConv.qty;
    } else {
      stock.currentQtyKarton = 0;
      stock.soldQtyKarton = 0;
    }
  }

  return stockMap;
}

/**
 * Compute stock metrics per product (turnover, coverage, status flags).
 * Needs sales data (avg daily qty) for coverage calculation.
 *
 * @param {Map<string, StockItem>} stockMap
 * @param {Object} salesByProduct - { productCode -> { totalQty, avgDailyQty, daysWithData } }
 * @param {number} workDays - days in period (for turnover ratio)
 * @returns {Array<StockItem & metrics>}
 */
export function computeStockMetrics(stockMap, salesByProduct = {}, _workDays = 26) {
  const metrics = [];

  for (const [, stock] of stockMap) {
    const sales = salesByProduct[stock.productCode] || { totalQty: 0, avgDailyQty: 0 };
    const soldQty = stock.soldQty;

    // Coverage days: how many days stock will last at current sales rate
    // null = no sales data (can't compute)
    const coverageDays = sales.avgDailyQty > 0
      ? stock.currentQty / sales.avgDailyQty
      : null;

    // Turnover ratio: how many times stock turned over in period
    // null = no opening stock (can't compute)
    const turnoverRatio = stock.openingQty > 0
      ? soldQty / stock.openingQty
      : null;

    // Status flags
    // ⚠️ Sprint 19g4: Low stock criteria changed from "20% of opening" to
    // "coverage < 7 days" (opsi B). Coverage = currentQty / avgDailyQty.
    // Kalau coverage < 7 hari → kritis (stok habis dalam <1 minggu).
    // Kalau coverage null (tidak ada data penjualan) → tidak bisa tentukan kritis.
    const isStockout = stock.currentQty <= 0;
    const isLowStock = !isStockout && coverageDays !== null && coverageDays < 7;
    const isOverstock = coverageDays !== null && coverageDays > 60;
    const isDeadStock = stock.openingQty > 0 && stock.currentQty > 0 && stock.transactionCount === 0;

    metrics.push({
      ...stock,
      soldQty,
      coverageDays,
      turnoverRatio,
      isStockout,
      isLowStock,
      isOverstock,
      isDeadStock,
      salesData: sales,
    });
  }

  return metrics;
}

/**
 * Compute stock summary KPIs from stockMap.
 *
 * @param {Map<string, StockItem>} stockMap
 * @returns {StockSummary}
 */
/**
 * Compute stock summary KPIs from stockMap.
 * ⚠️ Sprint 19g4: lowStockCount sekarang pakai coverage-based (< 7 hari).
 * Butuh salesByProduct untuk hitung avgDailyQty per produk.
 *
 * @param {Map<string, StockItem>} stockMap
 * @param {Object} salesByProduct - { productCode -> { totalQty, avgDailyQty } }
 * @param {number} daysCount - days in period
 * @returns {StockSummary}
 */
export function computeStockSummary(stockMap, salesByProduct = {}, daysCount = 30) {
  if (!stockMap.size) return null;

  let totalQty = 0;
  let totalValue = 0;
  let totalSoldQty = 0;
  let lowStockCount = 0;
  let stockoutCount = 0;
  let deadStockCount = 0;
  let groupBreakdown = {};

  for (const [code, stock] of stockMap) {
    totalQty += stock.currentQty;
    totalValue += stock.currentValue;
    totalSoldQty += stock.soldQty;

    // ⚠️ Sprint 19g4: coverage-based low stock detection
    const sales = salesByProduct[code] || { totalQty: 0, avgDailyQty: 0 };
    const coverageDays = sales.avgDailyQty > 0 ? stock.currentQty / sales.avgDailyQty : null;

    if (stock.currentQty <= 0) stockoutCount++;
    else if (coverageDays !== null && coverageDays < 7) lowStockCount++;
    if (stock.openingQty > 0 && stock.currentQty > 0 && stock.transactionCount === 0) deadStockCount++;

    if (stock.group) {
      if (!groupBreakdown[stock.group]) {
        groupBreakdown[stock.group] = { count: 0, qty: 0, value: 0, soldQty: 0 };
      }
      groupBreakdown[stock.group].count++;
      groupBreakdown[stock.group].qty += stock.currentQty;
      groupBreakdown[stock.group].value += stock.currentValue;
      groupBreakdown[stock.group].soldQty += stock.soldQty;
    }
  }

  return {
    totalProducts: stockMap.size,
    totalQty,
    totalValue,
    totalSoldQty,
    lowStockCount,
    stockoutCount,
    deadStockCount,
    groupBreakdown,
  };
}

/**
 * Compute sales-by-product map from transaction rows.
 * Used as input for computeStockMetrics (coverage/turnover).
 *
 * @param {Array} transactions - filtered rows
 * @param {number} daysCount - number of days in period (for avg daily)
 * @returns {Object} { productCode -> { totalQty, avgDailyQty, daysWithData } }
 */
export function computeSalesByProduct(transactions, daysCount = 30) {
  const map = {};
  if (!transactions || !transactions.length) return map;

  transactions.forEach((r) => {
    if (!r.productCode) return;
    if (!map[r.productCode]) {
      map[r.productCode] = { totalQty: 0, dates: new Set() };
    }
    // ⚠️ Sprint 19g5 / Bugfix: konversi qty transaksi ke PCS (satuan dasar)
    // supaya konsisten dengan currentQty yang juga dalam PCS.
    // Sebelumnya pakai r.qty mentah — kalau transaksi "5 KARTON" (qty=5, konv=30),
    // totalQty = 5, padahal seharusnya 150 PCS.
    // Sekarang: qtyInPCS = qty × konv (kalau konv ada), fallback ke qty.
    const qtyInPCS = (r.konv && r.konv > 0)
      ? (Number(r.qty) || 0) * r.konv
      : Number(r.qty) || 0;
    map[r.productCode].totalQty += qtyInPCS;
    if (r.date) map[r.productCode].dates.add(r.date);
  });

  // Convert to final format
  const result = {};
  for (const [code, data] of Object.entries(map)) {
    const daysWithData = data.dates.size || 1;
    result[code] = {
      totalQty: data.totalQty,
      avgDailyQty: data.totalQty / daysCount,
      daysWithData,
    };
  }
  return result;
}
