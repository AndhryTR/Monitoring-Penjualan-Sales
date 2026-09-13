/* ============================================================================
   STOCK STORAGE — Sprint 19 / Stock Module (Sprint 2: + adjustments)
   IndexedDB CRUD untuk stock snapshots + adjustment logs.
   Pakai DB terpisah dari session data supaya tidak konflik.

   Snapshot = opening stock per produk untuk satu depo pada satu titik waktu.
   Hanya 1 snapshot aktif per depo (isActive=true). Snapshot lama dipertahankan
   untuk history (max 12), sisanya dihapus otomatis.

   Adjustment = log perubahan saat reconciliation (upload snapshot baru).
   Menyimpan: perubahan per produk, total change, warnings, timestamp.
   Max 24 adjustment logs per depo.

   ⚠️ Tidak pernah throw — kalau IndexedDB diblokir (private mode), return
   null/false supaya aplikasi tetap jalan (in-memory only).
============================================================================ */

const STOCK_DB_NAME = "smapp-stock-db";
const STOCK_DB_VERSION = 2;  // ⚠️ Sprint 2: bump 1→2 untuk tambah adjustments store
const SNAPSHOT_STORE = "snapshots";
const ADJUSTMENT_STORE = "adjustments";
const MAX_SNAPSHOTS_PER_DEPOT = 12;
const MAX_ADJUSTMENTS_PER_DEPOT = 24;

// Internal: open stock-specific DB (terpisah dari session DB)
function openStockDB() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB tidak tersedia"));
      return;
    }
    const req = indexedDB.open(STOCK_DB_NAME, STOCK_DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(SNAPSHOT_STORE)) {
        const store = db.createObjectStore(SNAPSHOT_STORE, { keyPath: "id" });
        store.createIndex("depotId", "depotId", { unique: false });
        store.createIndex("isActive", "isActive", { unique: false });
      }
      // ⚠️ Sprint 2: tambah adjustment store untuk log reconciliation
      if (!db.objectStoreNames.contains(ADJUSTMENT_STORE)) {
        const adjStore = db.createObjectStore(ADJUSTMENT_STORE, { keyPath: "id" });
        adjStore.createIndex("depotId", "depotId", { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Save stock snapshot. Mark previous snapshots for same depot as inactive.
 * Cleanup old snapshots beyond MAX_SNAPSHOTS_PER_DEPOT.
 *
 * @param {StockSnapshot} snapshot
 * @returns {Promise<boolean>} true if saved, false if failed
 */
export async function saveStockSnapshot(snapshot) {
  try {
    const db = await openStockDB();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(SNAPSHOT_STORE, "readwrite");
      const store = tx.objectStore(SNAPSHOT_STORE);

      // ⚠️ Sprint 19b bugfix: Mark old snapshots inactive DULU (sebelum put new).
      // Sebelumnya pakai cursor loop yang jalan bersamaan dengan store.put —
      // race condition: cursor bisa continue ke record baru di-put dan menandainya
      // inactive juga → new snapshot jadi inactive → getActiveSnapshot return null
      // → semua data stok "hilang".
      // Fix: collect all old snapshots dulu, mark satu per satu, LALU put new.
      const getAllReq = store.getAll();
      getAllReq.onsuccess = () => {
        const allSnaps = getAllReq.result || [];
        // Mark existing snapshots for this depot as inactive
        allSnaps.forEach((existing) => {
          if (existing.depotId === snapshot.depotId && existing.isActive) {
            store.put({ ...existing, isActive: false });
          }
        });
        // NOW put new snapshot (isActive=true) — after all old marked inactive
        store.put({ ...snapshot, isActive: true });
      };
      getAllReq.onerror = () => reject(getAllReq.error);

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();

    // 3. Cleanup old snapshots (keep only MAX_SNAPSHOTS_PER_DEPOT most recent)
    await cleanupOldSnapshots(snapshot.depotId);

    return true;
  } catch (e) {
    console.warn("Gagal menyimpan stock snapshot ke IndexedDB:", e);
    return false;
  }
}

/**
 * Get active snapshot for a depot (the most recent one with isActive=true).
 *
 * @param {string} depotId
 * @returns {Promise<StockSnapshot|null>}
 */
export async function getActiveSnapshot(depotId) {
  try {
    const db = await openStockDB();
    const result = await new Promise((resolve, reject) => {
      const tx = db.transaction(SNAPSHOT_STORE, "readonly");
      const req = tx.objectStore(SNAPSHOT_STORE).getAll();
      req.onsuccess = () => {
        const allSnaps = (req.result || []).filter((s) => s.depotId === depotId);
        // ⚠️ Sprint 19b bugfix: cari active snapshot, kalau tidak ada fallback
        // ke snapshot terbaru regardless of isActive flag. Ini safety net untuk
        // kasus edge dimana isActive flag corrupt/race condition.
        const activeSnaps = allSnaps
          .filter((s) => s.isActive)
          .sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));
        if (activeSnaps.length > 0) {
          resolve(activeSnaps[0]);
          return;
        }
        // Fallback: snapshot terbaru regardless of isActive
        const sorted = allSnaps.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));
        resolve(sorted[0] || null);
      };
      req.onerror = () => reject(req.error);
    });
    db.close();
    return result;
  } catch (e) {
    console.warn("Gagal membaca stock snapshot dari IndexedDB:", e);
    return null;
  }
}

/**
 * Get snapshot history for a depot (all snapshots, sorted by uploadedAt desc).
 *
 * @param {string} depotId
 * @param {number} limit - max snapshots to return (default 12)
 * @returns {Promise<StockSnapshot[]>}
 */
export async function getSnapshotHistory(depotId, limit = MAX_SNAPSHOTS_PER_DEPOT) {
  try {
    const db = await openStockDB();
    const result = await new Promise((resolve, reject) => {
      const tx = db.transaction(SNAPSHOT_STORE, "readonly");
      const req = tx.objectStore(SNAPSHOT_STORE).getAll();
      req.onsuccess = () => {
        const snapshots = (req.result || [])
          .filter((s) => s.depotId === depotId)
          .sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt))
          .slice(0, limit);
        resolve(snapshots);
      };
      req.onerror = () => reject(req.error);
    });
    db.close();
    return result;
  } catch (e) {
    console.warn("Gagal membaca snapshot history:", e);
    return [];
  }
}

/**
 * Delete old snapshots beyond MAX_SNAPSHOTS_PER_DEPOT for a depot.
 * Called automatically after saveStockSnapshot.
 *
 * @param {string} depotId
 * @returns {Promise<number>} number of snapshots deleted
 */
async function cleanupOldSnapshots(depotId) {
  try {
    const db = await openStockDB();
    const deleted = await new Promise((resolve, reject) => {
      const tx = db.transaction(SNAPSHOT_STORE, "readwrite");
      const store = tx.objectStore(SNAPSHOT_STORE);
      const req = store.getAll();
      req.onsuccess = () => {
        const snapshots = (req.result || [])
          .filter((s) => s.depotId === depotId)
          .sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));

        // Keep most recent MAX_SNAPSHOTS_PER_DEPOT, delete the rest
        const toDelete = snapshots.slice(MAX_SNAPSHOTS_PER_DEPOT);
        let count = 0;
        toDelete.forEach((snap) => {
          store.delete(snap.id);
          count++;
        });
        resolve(count);
      };
      req.onerror = () => reject(req.error);
    });
    db.close();
    return deleted;
  } catch (e) {
    console.warn("Gagal cleanup old snapshots:", e);
    return 0;
  }
}

/**
 * Clear all stock data (used by "Clear All" in Settings).
 *
 * @returns {Promise<boolean>}
 */
export async function clearAllStockData() {
  try {
    const db = await openStockDB();
    await new Promise((resolve, reject) => {
      const tx = db.transaction([SNAPSHOT_STORE, ADJUSTMENT_STORE], "readwrite");
      tx.objectStore(SNAPSHOT_STORE).clear();
      tx.objectStore(ADJUSTMENT_STORE).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
    return true;
  } catch (e) {
    console.warn("Gagal clear stock data:", e);
    return false;
  }
}

/* ============================================================================
   ADJUSTMENT LOG — Sprint 2: Reconciliation
   Log perubahan saat upload snapshot baru. Menyimpan: perubahan per produk,
   total change, warnings, timestamp. Dipakai untuk audit trail + display
   "Riwayat Penyesuaian" di StockPage.
============================================================================ */

/**
 * Save adjustment log to IndexedDB.
 *
 * @param {AdjustmentLog} log
 * @returns {Promise<boolean>}
 */
export async function saveAdjustmentLog(log) {
  try {
    const db = await openStockDB();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(ADJUSTMENT_STORE, "readwrite");
      tx.objectStore(ADJUSTMENT_STORE).put(log);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();

    // Cleanup old adjustments beyond MAX
    await cleanupOldAdjustments(log.depotId);

    return true;
  } catch (e) {
    console.warn("Gagal menyimpan adjustment log:", e);
    return false;
  }
}

/**
 * Get adjustment history for a depot (sorted by uploadedAt desc).
 *
 * @param {string} depotId
 * @param {number} limit - max items (default 24)
 * @returns {Promise<AdjustmentLog[]>}
 */
export async function getAdjustmentHistory(depotId, limit = MAX_ADJUSTMENTS_PER_DEPOT) {
  try {
    const db = await openStockDB();
    const result = await new Promise((resolve, reject) => {
      const tx = db.transaction(ADJUSTMENT_STORE, "readonly");
      const req = tx.objectStore(ADJUSTMENT_STORE).getAll();
      req.onsuccess = () => {
        const logs = (req.result || [])
          .filter((l) => l.depotId === depotId)
          .sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt))
          .slice(0, limit);
        resolve(logs);
      };
      req.onerror = () => reject(req.error);
    });
    db.close();
    return result;
  } catch (e) {
    console.warn("Gagal membaca adjustment history:", e);
    return [];
  }
}

/**
 * Delete old adjustments beyond MAX_ADJUSTMENTS_PER_DEPOT for a depot.
 *
 * @param {string} depotId
 * @returns {Promise<number>} number of adjustments deleted
 */
async function cleanupOldAdjustments(depotId) {
  try {
    const db = await openStockDB();
    const deleted = await new Promise((resolve, reject) => {
      const tx = db.transaction(ADJUSTMENT_STORE, "readwrite");
      const store = tx.objectStore(ADJUSTMENT_STORE);
      const req = store.getAll();
      req.onsuccess = () => {
        const logs = (req.result || [])
          .filter((l) => l.depotId === depotId)
          .sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));

        const toDelete = logs.slice(MAX_ADJUSTMENTS_PER_DEPOT);
        let count = 0;
        toDelete.forEach((log) => {
          store.delete(log.id);
          count++;
        });
        resolve(count);
      };
      req.onerror = () => reject(req.error);
    });
    db.close();
    return deleted;
  } catch (e) {
    console.warn("Gagal cleanup old adjustments:", e);
    return 0;
  }
}
