import { useState, useEffect, useCallback, useMemo, useRef } from "react";
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
import { todayLocalDateStr } from "../utils/excelParse.js";

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

  // ⚠️ Fix bug #2 (race depot): ref yang selalu menyimpan depotId TERKINI.
  // dipakai sebagai guard saat uploadSnapshot in-flight — kalau depot berubah
  // ketika async work sedang jalan, kita abort agar stok depot A tidak bocor
  // ke depot B. useRef agar selalu baca nilai terbaru tanpa re-create callback.
  const depotIdRef = useRef(depotId);
  depotIdRef.current = depotId;

  // Load active snapshot + history + adjustments on mount / depot change
  useEffect(() => {
    if (!depotId) {
      setLoading(false);
      return;
    }
    // ⚠️ Fix bug #2 (race ganti depo cepat): cancel flag. Kalau depot berubah
    // sebelum Promise.all resolve, hasil depot lama DIBUANG (tidak menimpa
    // depot baru). Pola sama dengan SalesMonitoringApp.jsx loadSession.
    let cancelled = false;
    setLoading(true);
    Promise.all([
      getActiveSnapshot(depotId),
      getSnapshotHistory(depotId),
      getAdjustmentHistory(depotId),
    ]).then(([snap, history, adjs]) => {
      if (cancelled) return;
      setActiveSnapshot(snap);
      setSnapshotHistory(history || []);
      setAdjustments(adjs || []);
      setLoading(false);
    }).catch((err) => {
      console.error("Failed to load stock:", err);
      if (cancelled) return;
      setActiveSnapshot(null);
      setSnapshotHistory([]);
      setAdjustments([]);
      setLoading(false);
    });
    return () => { cancelled = true; };
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
      // ⚠️ Merge barang lama yang tidak ada di file master baru → qty 0 (bukan dihapus).
      // Master stok hanya memuat barang dengan qty > 0; barang yang habis (qty 0)
      // tidak ikut di file. Kalau kita simpan products apa adanya, barang habis itu
      // HILANG dari daftar stok app. Solusi: gabungkan snapshot lama — produk lama
      // yang tidak muncul di file baru dipertahankan dengan qtyBase/totalValue = 0
      // (info produk lain diambil dari data lama), sehingga barang tetap tampil 0.
      const newProductCodes = new Set(parsedData.products.map((p) => p.productCode));
      const orphanOld = (activeSnapshot?.products || []).filter(
        (p) => !newProductCodes.has(p.productCode)
      );
      // ⚠️ Fix bug #1: dedupe by productCode supaya TIDAK pernah ada duplikat kode di
      // snapshot. File baru (parsedData.products) MENANG — karena dibangun duluan.
      // Barang lama yang tidak ada di file baru dipertahankan qty 0 hanya kalau
      // kodenya belum ada (defensive — mencegah snapshot lama yang terlanjur korup
      // berisi duplikat menyebarkan barang qty-0 ganda yang menimpa via Map.set).
      const mergedMap = new Map();
      parsedData.products.forEach((p) => mergedMap.set(p.productCode, p));
      orphanOld.forEach((p) => {
        if (!mergedMap.has(p.productCode)) {
          mergedMap.set(p.productCode, { ...p, qtyBase: 0, qtyKarton: 0, totalValue: 0 });
        }
      });
      const mergedProducts = Array.from(mergedMap.values());

      const newSnapshot = {
        id: `snap_${depotId}_${Date.now()}`,
        depotId,
        uploadedAt: now,
        // ⚠️ Bugfix off-by-one UTC: `now` adalah ISO (UTC). Di zona UTC+8, upload
        // sebelum jam 08:00 lokal menghasilkan tanggal HARI SEBELUMNYA jika
        // di-slice dari ISO → batas snapshot geser 1 hari → stok minus.
        // Pakai tanggal LOKAL untuk snapshotDate; uploadedAt tetap ISO.
        snapshotDate: todayLocalDateStr(),
        isActive: true,
        products: mergedProducts,
        // ⚠️ summary dihitung ulang dari mergedProducts (bukan parsedData.stats)
        // supaya total qty/value konsisten dengan daftar yang benar-benar disimpan.
        summary: {
          ...parsedData.stats,
          count: mergedProducts.length,
          totalQtyBase: mergedProducts.reduce((s, p) => s + (p.qtyBase || 0), 0),
          totalValue: mergedProducts.reduce((s, p) => s + (p.totalValue || 0), 0),
        },
      };

      // Save snapshot (marks old as inactive)
      const ok = await saveStockSnapshot(newSnapshot);
      if (!ok) {
        setUploading(false);
        return { success: false, error: "Gagal menyimpan ke IndexedDB" };
      }
      // ⚠️ Fix bug #2 (race depot): kalau depot BERUBAH selama `saveStockSnapshot`
      // in-flight, jangan izinkan snapshot depot lama meng-override UI depot baru.
      // Data sudah tersimpan (saveStockSnapshot memakai depotId dari closure —
      // aman untuk DB), tapi kita BENTAL setState reload & jangan tulis adjustment
      // log yang mengarah ke `activeSnapshot` depot lain.
      if (depotIdRef.current !== depotId) {
        setUploading(false);
        return { success: false, error: "Depot berubah saat upload — snapshot tersimpan, tampilan tidak diperbarui" };
      }

      // Save adjustment log if there was a diff (reconciliation)
      const diff = opts.diff;
      if (diff && depotIdRef.current === depotId) {
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
      // ⚠️ Fix bug #2: cek sekali lagi sebelum setState — kalau depot sudah
      // berubah sejak reload dimulai, jangan timpa state depot baru.
      if (depotIdRef.current !== depotId) {
        setUploading(false);
        return { success: false, error: "Depot berubah saat upload — tampilan tidak diperbarui" };
      }
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
