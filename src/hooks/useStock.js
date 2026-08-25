import { useState, useEffect, useCallback, useMemo } from "react";
import {
  getActiveSnapshot,
  saveStockSnapshot,
  getSnapshotHistory,
  getAdjustmentHistory,
  saveAdjustmentLog,
} from "../utils/stockStorage.js";
import {
  computeCurrentStock,
  computeStockMetrics,
  computeStockSummary,
  computeSalesByProduct,
} from "../utils/stockEngine.js";
import { diffStock } from "../utils/stockDiff.js";

/* ============================================================================
   useStock — Sprint 19 / Stock Module (Sprint 2: + reconciliation)
   React hook untuk manage stock data: load snapshot, compute current stock
   (snapshot - sales), upload new snapshot with reconciliation + adjustment log.

   Props:
   - depotId: string — active depot ID
   - transactions: array — filtered transaction rows (any date)
   - daysCount: number — number of days in current period (for avg daily sales)

   Returns:
   - loading, uploading: boolean
   - activeSnapshot, snapshotHistory, adjustments
   - currentStock: Map<productCode, StockItem>
   - stockMetrics: Array<StockItem & metrics>
   - stockSummary: StockSummary | null
   - computeDiff: (parsedData) => diffResult — untuk preview modal
   - uploadSnapshot: (parsedData, { confirmed }) => Promise<{ success, diff }>
============================================================================ */
export function useStock({ depotId, transactions = [], daysCount = 30 }) {
  const [activeSnapshot, setActiveSnapshot] = useState(null);
  const [snapshotHistory, setSnapshotHistory] = useState([]);
  const [adjustments, setAdjustments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  // Load active snapshot + history + adjustments on mount / depot change
  useEffect(() => {
    if (!depotId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    Promise.all([
      getActiveSnapshot(depotId),
      getSnapshotHistory(depotId),
      getAdjustmentHistory(depotId),
    ]).then(([snap, history, adjs]) => {
      setActiveSnapshot(snap);
      setSnapshotHistory(history || []);
      setAdjustments(adjs || []);
      setLoading(false);
    }).catch((err) => {
      console.error("Failed to load stock:", err);
      setActiveSnapshot(null);
      setSnapshotHistory([]);
      setAdjustments([]);
      setLoading(false);
    });
  }, [depotId]);

  // Compute current stock (memoized)
  const currentStock = useMemo(() => {
    if (!activeSnapshot) return new Map();
    return computeCurrentStock(activeSnapshot, transactions);
  }, [activeSnapshot, transactions]);

  // Compute sales-by-product for metrics
  // ⚠️ Sprint 19h4 / Bugfix: JANGAN filter by snapshotDate di sini.
  // snapshotDate = tanggal UPLOAD stok (mis. 2026-08-23), tapi transaksi
  // terbaru mungkin 2026-08-18 (sebelum upload). Filter r.date >= snapshotDate
  // memfilter SEMUA transaksi → kosong → avgDailyQty=0 → coverage=null → "-"
  // Filter snapshotDate HANYA untuk computeCurrentStock (pengurangan stok).
  // Untuk rate penjualan: gunakan SEMUA transaksi (semua rentang data).
  const salesByProduct = useMemo(() => {
    return computeSalesByProduct(transactions, daysCount, null);
  }, [transactions, daysCount]);

  // Stock metrics
  const stockMetrics = useMemo(() => {
    if (!currentStock.size) return [];
    return computeStockMetrics(currentStock, salesByProduct, daysCount);
  }, [currentStock, salesByProduct, daysCount]);

  // Stock summary KPIs
  const stockSummary = useMemo(() => {
    if (!currentStock.size) return null;
    return computeStockSummary(currentStock, salesByProduct, daysCount);
  }, [currentStock, salesByProduct, daysCount]);

  /**
   * Compute diff between current stock and new upload.
   * Called by parent to show preview modal BEFORE saving.
   * Returns diffResult (for StockImportPreview modal) or null if first upload.
   */
  const computeDiff = useCallback((parsedData) => {
    if (!activeSnapshot) {
      // First upload — no diff, just save
      return null;
    }
    return diffStock(activeSnapshot, transactions, parsedData.products);
  }, [activeSnapshot, transactions]);

  /**
   * Upload new snapshot. If existing snapshot exists → reconciliation mode:
   * save snapshot + log adjustment. If first upload → direct save.
   *
   * @param {object} parsedData - { products, stats } from parseStockExcel
   * @param {object} opts - { diff: diffResult } (optional, for adjustment log)
   * @returns {Promise<{ success, error, snapshot, diff }>}
   */
  const uploadSnapshot = useCallback(async (parsedData, opts = {}) => {
    if (!depotId) return { success: false, error: "No active depot" };
    setUploading(true);
    try {
      const now = new Date().toISOString();
      const newSnapshot = {
        id: `snap_${depotId}_${Date.now()}`,
        depotId,
        uploadedAt: now,
        snapshotDate: now.slice(0, 10),
        isActive: true,
        products: parsedData.products,
        summary: parsedData.stats,
      };

      // Save snapshot (marks old as inactive)
      const ok = await saveStockSnapshot(newSnapshot);
      if (!ok) {
        setUploading(false);
        return { success: false, error: "Gagal menyimpan ke IndexedDB" };
      }

      // Save adjustment log if there was a diff (reconciliation)
      const diff = opts.diff;
      if (diff) {
        const adjLog = {
          id: `adj_${newSnapshot.id}`,
          depotId,
          uploadedAt: now,
          previousSnapshotId: activeSnapshot?.id,
          newSnapshotId: newSnapshot.id,
          totalProductsChanged: (diff.summary.newProducts || 0) +
            (diff.summary.removedProducts || 0) +
            (diff.summary.anomalousProducts || 0),
          totalQtyChange: diff.summary.totalQtyChange || 0,
          totalValueChange: diff.summary.totalValueChange || 0,
          items: diff.items.filter((i) => i.type !== "unchanged"),
          warnings: diff.warnings,
          confirmedAt: now,
        };
        await saveAdjustmentLog(adjLog);
      }

      // Reload snapshot + history + adjustments
      const [snap, history, adjs] = await Promise.all([
        getActiveSnapshot(depotId),
        getSnapshotHistory(depotId),
        getAdjustmentHistory(depotId),
      ]);
      setActiveSnapshot(snap);
      setSnapshotHistory(history || []);
      setAdjustments(adjs || []);
      setUploading(false);
      return { success: true, snapshot: newSnapshot, diff };
    } catch (err) {
      console.error("Upload stock error:", err);
      setUploading(false);
      return { success: false, error: err.message || String(err) };
    }
  }, [depotId, activeSnapshot]);

  return {
    loading,
    uploading,
    activeSnapshot,
    snapshotHistory,
    adjustments,
    currentStock,
    stockMetrics,
    stockSummary,
    computeDiff,
    uploadSnapshot,
  };
}
