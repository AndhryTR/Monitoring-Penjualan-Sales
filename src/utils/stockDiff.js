import { computeCurrentStock } from "./stockEngine.js";

/* ============================================================================
   STOCK DIFF — Sprint 19 / Sprint 2: Reconciliation
   Diff engine: compare stok sistem (current) vs stok dari upload baru (new snapshot).

   Konsep:
   - Stok sistem = opening (snapshot aktif) - sold (transaksi setelah snapshot)
   - Stok upload baru = nilai dari file Excel baru
   - Diff = new - current → adjustment yang akan diapply
   - Anomaly detection: perubahan > 50% atau > 200 unit absolut

   Return: { items, summary, warnings }
   - items: array of per-product diff
   - summary: agregat (total products, new, removed, anomalous, qty/value change)
   - warnings: array of warning strings untuk display ke user
============================================================================ */

/**
 * Compute diff between current stock (system) and new snapshot (from upload).
 *
 * @param {StockSnapshot} oldSnapshot - current active snapshot
 * @param {Array} transactions - filtered transaction rows
 * @param {StockProduct[]} newProducts - products from new upload
 * @returns {{ items: DiffItem[], summary: DiffSummary, warnings: string[] }}
 */
export function diffStock(oldSnapshot, transactions, newProducts) {
  // 1. Compute current stock (system's view)
  const currentStockMap = computeCurrentStock(oldSnapshot, transactions);

  // 2. Build map of new products
  const newMap = new Map(newProducts.map((p) => [p.productCode, p]));

  // 3. Compare
  const items = [];
  let totalQtyChange = 0;
  let totalValueChange = 0;
  let anomalousCount = 0;
  let newProductCount = 0;
  let removedProductCount = 0;
  let unchangedCount = 0;

  // Check existing products (in current stock)
  for (const [code, stock] of currentStockMap) {
    const newProduct = newMap.get(code);

    if (!newProduct) {
      // Product removed (exists in old, not in new upload)
      items.push({
        productCode: code,
        productName: stock.productName,
        group: stock.group,
        oldQty: stock.currentQty,
        newQty: null,
        oldUnit: stock.unit,
        newUnit: null,
        diff: -stock.currentQty,
        diffPct: stock.currentQty > 0 ? -100 : 0,
        type: "removed",
        isAnomalous: stock.currentQty > 0,
      });
      removedProductCount++;
      totalQtyChange -= stock.currentQty;
      continue;
    }

    const oldQty = stock.currentQty;
    const newQty = newProduct.qtyBase;
    const diff = newQty - oldQty;
    const diffPct = oldQty !== 0
      ? (diff / oldQty) * 100
      : (newQty > 0 ? 100 : 0);

    // Anomaly: diff > 50% AND diff > 20 units, OR diff > 200 units absolute
    const isAnomalous = (
      (Math.abs(diffPct) > 50 && Math.abs(diff) > 20) ||
      Math.abs(diff) > 200
    );

    const type = diff > 0 ? "addition" : diff < 0 ? "reduction" : "unchanged";

    items.push({
      productCode: code,
      productName: stock.productName,
      group: stock.group,
      oldQty,
      newQty,
      oldUnit: stock.unit,
      newUnit: newProduct.unit || stock.unit,
      diff,
      diffPct,
      type,
      isAnomalous,
    });

    if (type === "unchanged") {
      unchangedCount++;
    } else {
      totalQtyChange += diff;
      totalValueChange += (newProduct.totalValue || 0) - (stock.currentValue || 0);
    }
    if (isAnomalous) anomalousCount++;
  }

  // Check new products (in new upload, not in current stock)
  for (const [code, newProduct] of newMap) {
    if (currentStockMap.has(code)) continue; // already processed above

    items.push({
      productCode: code,
      productName: newProduct.productName,
      group: newProduct.group,
      oldQty: 0,
      newQty: newProduct.qtyBase,
      oldUnit: null,
      newUnit: newProduct.unit,
      diff: newProduct.qtyBase,
      diffPct: newProduct.qtyBase > 0 ? 100 : 0,
      type: "new",
      isAnomalous: false,
    });
    newProductCount++;
    totalQtyChange += newProduct.qtyBase;
    totalValueChange += newProduct.totalValue || 0;
  }

  // Sort items: anomalous first, then by abs(diff) descending
  items.sort((a, b) => {
    if (a.isAnomalous && !b.isAnomalous) return -1;
    if (!a.isAnomalous && b.isAnomalous) return 1;
    return Math.abs(b.diff) - Math.abs(a.diff);
  });

  // Generate warnings
  const warnings = [];
  if (anomalousCount > 0) {
    warnings.push(`${anomalousCount} produk dengan selisih signifikan (>50% atau >200 unit)`);
  }
  if (removedProductCount > 0) {
    warnings.push(`${removedProductCount} produk tidak ditemukan di upload baru`);
  }

  // Check if total products dropped drastically
  const oldCount = currentStockMap.size;
  const newCount = newMap.size;
  if (oldCount > 0 && newCount < oldCount * 0.8) {
    warnings.push(`Jumlah produk turun dari ${oldCount} ke ${newCount} — mungkin file tidak lengkap`);
  }

  // Check if total qty dropped drastically (>50%)
  if (oldCount > 0) {
    const oldTotalQty = Array.from(currentStockMap.values())
      .reduce((s, st) => s + st.currentQty, 0);
    const newTotalQty = newProducts.reduce((s, p) => s + p.qtyBase, 0);
    if (oldTotalQty > 0 && newTotalQty < oldTotalQty * 0.5) {
      warnings.push(`Total qty turun drastis dari ${oldTotalQty.toLocaleString()} ke ${newTotalQty.toLocaleString()} — periksa satuan (PCS vs KARTON)`);
    }
  }

  return {
    items,
    summary: {
      totalProducts: newCount,
      oldProducts: oldCount,
      newProducts: newProductCount,
      removedProducts: removedProductCount,
      unchangedProducts: unchangedCount,
      anomalousProducts: anomalousCount,
      totalQtyChange,
      totalValueChange,
    },
    warnings,
  };
}
