/* ============================================================================
   PERSISTENSI DATA
   Dua lapisan penyimpanan lokal di browser (tidak pernah dikirim ke server):

   1) SETTINGS (localStorage) — kecil, jarang berubah: target sales, hari
      kerja, nama depo, tema, dan filter terakhir. Sinkron & instan.

   2) SESSION (IndexedDB) — data transaksi hasil upload (bisa ribuan baris),
      terlalu besar/beresiko untuk localStorage (quota ~5-10MB & operasi
      sinkron bisa bikin lag). IndexedDB bersifat async & jauh lebih longgar
      soal ukuran.

   Semua fungsi di sini SENGAJA tidak pernah melempar (throw) ke pemanggil —
   kalau storage diblokir (mis. mode private/incognito di beberapa browser)
   atau datanya korup, fungsi ini akan gagal secara diam-diam (return null /
   false) supaya aplikasi tetap berjalan normal (hanya jadi in-memory saja),
   bukan crash.

   ⚠️ Sprint 18 / Multi-Depo: settings key "smapp:settings:v1" tetap dipakai
   (key string, bukan version), tapi payload _v:2 sekarang menampung
   depots[] + activeDepotId. Migrasi v1→v2 otomatis di loadSettings() bila
   payload lama (tanpa _v atau _v:1) ditemukan — wrap targets/workDays/
   depotName lama ke depots[0].
============================================================================ */

const SETTINGS_KEY = "smapp:settings:v1";
const SETTINGS_VERSION = 2; // ⚠️ Sprint 18: bump 1 → 2 (multi-depo schema)

const DB_NAME = "smapp-db";
const DB_VERSION = 1;
const STORE_NAME = "session";
const SESSION_KEY = "current";
const SESSION_VERSION = 1;

/* ---------------------------- Settings (localStorage) --------------------------- */

const HISTORY_KEY = "smapp:history:v1";
const HISTORY_VERSION = 1;
// ⚠️ Sprint 5 / S1: import HISTORY_MAX_ENTRIES dari constants/thresholds.js
// (sebelumnya dideklarasi lokal di sini — duplikat dengan constants).
import { HISTORY_MAX_ENTRIES } from "../constants/thresholds.js";
// ⚠️ Sprint 18: import template helpers untuk migrasi v1→v2
import { generateDepotId, generateDepotCode, DEFAULT_DEPOT_NAME } from "../constants/depoTemplate.js";

// ⚠️ Sprint 18: Migrasi settings dari schema v1 (flat targets/workDays/depotName)
// ke v2 (depots[] + activeDepotId). Aman bila input sudah v2 (idempotent).
// Bila input null/undefined → return null (caller akan pakai default di hook).
function migrateV1ToV2(parsed) {
  if (!parsed || typeof parsed !== "object") return null;

  // Sudah v2 — return apa adanya
  if (parsed._v === 2 && Array.isArray(parsed.depots)) return parsed;

  // v1 (atau tanpa _v) — wrap ke depots[0]
  // Ambil field lama dengan fallback default
  const oldTargets = Array.isArray(parsed.targets) ? parsed.targets : [];
  const oldWorkDays = typeof parsed.workDays === "number" ? parsed.workDays : 26;
  const oldDepotName = typeof parsed.depotName === "string" && parsed.depotName ? parsed.depotName : DEFAULT_DEPOT_NAME;
  const now = new Date().toISOString();

  const depotId = generateDepotId(oldDepotName);
  const depot = {
    id: depotId,
    name: oldDepotName,
    code: generateDepotCode(oldDepotName),
    workDays: oldWorkDays,
    targets: oldTargets,
    createdAt: now,
    updatedAt: now,
  };

  return {
    ...parsed, // pertahankan field lain (theme, filters, slideshowConfig, dll)
    _v: 2,
    depots: [depot],
    activeDepotId: depotId,
    // ⚠️ Field lama targets/workDays/depotName sengaja TIDAK dihapus dari root
    // — bila user downgrade aplikasi ke versi lama, field lama masih ada dan
    // aplikasi lama masih bisa load. Backup kompatibilitas. Setelah 30 hari
    // stabil, bisa di-cleanup.
    targets: oldTargets,
    workDays: oldWorkDays,
    depotName: oldDepotName,
  };
}

export function saveSettings(settings) {
  try {
    const payload = JSON.stringify({ _v: SETTINGS_VERSION, ...settings });
    window.localStorage.setItem(SETTINGS_KEY, payload);
    return true;
  } catch (e) {
    console.warn("Gagal menyimpan pengaturan ke localStorage:", e);
    return false;
  }
}

export function loadSettings() {
  try {
    const raw = window.localStorage.getItem(SETTINGS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    // ⚠️ Sprint 18: migrasi v1→v2 otomatis bila payload lama ditemukan.
    // Hasil migrasi TIDAK ditulis balik ke localStorage di sini (biar loadSettings
    // tetap pure read). Hook useSettings yang akan detect perubahan _v dan tulis
    // balik lewat auto-save effect saat state di-set.
    return migrateV1ToV2(parsed);
  } catch (e) {
    console.warn("Gagal membaca pengaturan tersimpan, memakai default:", e);
    return null;
  }
}

export function clearSettings() {
  try {
    window.localStorage.removeItem(SETTINGS_KEY);
    return true;
  } catch {
    return false;
  }
}

/* ------------------- Comparison tab (localStorage) ------------------- */
// Pilihan di tab Perbandingan (mode, entitas terpilih, periode terpilih)
// dipersist TERPISAH dari settings: tab ini di-unmount tiap kali pindah tab,
// jadi state lokal biasa akan hilang. Simpan/restore otomatis saat
// mount/unmount supaya pilihan tidak hilang saat pindah tab lalu kembali.

const COMPARE_KEY = "smapp:compare:v1";
const COMPARE_VERSION = 1;

export function saveCompareState(state) {
  try {
    const payload = JSON.stringify({ _v: COMPARE_VERSION, ...state });
    window.localStorage.setItem(COMPARE_KEY, payload);
    return true;
  } catch (e) {
    console.warn("Gagal menyimpan pilihan Perbandingan ke localStorage:", e);
    return false;
  }
}

export function loadCompareState() {
  try {
    const raw = window.localStorage.getItem(COMPARE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    return parsed;
  } catch (e) {
    console.warn("Gagal membaca pilihan Perbandingan tersimpan, memakai default:", e);
    return null;
  }
}

export function clearCompareState() {
  try {
    window.localStorage.removeItem(COMPARE_KEY);
    return true;
  } catch {
    return false;
  }
}

/* ---------------------- Riwayat snapshot periode (localStorage) ---------------------- *
 * Ringan: cuma menyimpan ANGKA HASIL AGREGASI per periode (target/realisasi per
 * sales & grup), BUKAN data transaksi mentah — jadi walau riwayatnya menumpuk,
 * ukurannya tetap kecil dan aman disimpan di localStorage (beda dengan data
 * sesi yang disimpan di IndexedDB karena bisa ribuan baris).
 */

export function saveHistory(history) {
  try {
    const trimmed = (history || []).slice(0, HISTORY_MAX_ENTRIES);
    window.localStorage.setItem(HISTORY_KEY, JSON.stringify({ _v: HISTORY_VERSION, entries: trimmed }));
    return true;
  } catch (e) {
    console.warn("Gagal menyimpan riwayat periode:", e);
    return false;
  }
}

export function loadHistory() {
  try {
    const raw = window.localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.entries)) return [];
    return parsed.entries;
  } catch (e) {
    console.warn("Gagal membaca riwayat periode:", e);
    return [];
  }
}

export function clearHistory() {
  try {
    window.localStorage.removeItem(HISTORY_KEY);
    return true;
  } catch {
    return false;
  }
}

/* ---------------------------- Session data (IndexedDB) --------------------------- */

function openDB() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") { reject(new Error("IndexedDB tidak tersedia")); return; }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveSession({ rawRows, fileName, parseMeta }) {
  try {
    const db = await openDB();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).put({ _v: SESSION_VERSION, rawRows, fileName, parseMeta, savedAt: Date.now() }, SESSION_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
    return true;
  } catch (e) {
    console.warn("Gagal menyimpan data sesi ke IndexedDB:", e);
    return false;
  }
}

export async function loadSession() {
  try {
    const db = await openDB();
    const result = await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const req = tx.objectStore(STORE_NAME).get(SESSION_KEY);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
    db.close();
    if (!result || typeof result !== "object") return null;
    return result;
  } catch (e) {
    console.warn("Gagal membaca data sesi tersimpan:", e);
    return null;
  }
}

export async function clearSession() {
  try {
    const db = await openDB();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).delete(SESSION_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
    return true;
  } catch {
    return false;
  }
}

/* ---------------------- Master data max date (localStorage) ---------------------- *
 * ⚠️ Sprint 6 / R2: dipindah dari SalesMonitoringApp.jsx (sebelumnya inline
 * ~3 baris di sana). Dipakai oleh syncEngine untuk pull delta (hanya unduh
 * baris dengan date > maxDate yang pernah ter-pull di device ini).
 */

const MASTER_MAX_KEY = "smapp:masterMaxLocal";

export function loadMasterMax() {
  try { return window.localStorage.getItem(MASTER_MAX_KEY) || ""; }
  catch { return ""; }
}

export function saveMasterMax(d) {
  try { window.localStorage.setItem(MASTER_MAX_KEY, d || ""); }
  catch { /* abaikan — kalau localStorage diblokir (private mode), sync tetap jalan walau delta tidak efisien */ }
}

/* ---------------------- Terakhir sync master (localStorage) ---------------------- *
 * ⚠️ Sprint 14 / H15: timestamp terakhir kali data master berhasil di-pull
 * (tombol "Sinkronkan Data Penjualan"). Dipersist terpisah dari settings
 * supaya tampil "Terakhir sync: …" di modal walau app sudah dibuka ulang.
 */

const MASTER_SYNC_AT_KEY = "smapp:masterSyncAt";

export function loadLastMasterSyncAt() {
  try { return Number(window.localStorage.getItem(MASTER_SYNC_AT_KEY)) || 0; }
  catch { return 0; }
}

export function saveLastMasterSyncAt(ts) {
  try { window.localStorage.setItem(MASTER_SYNC_AT_KEY, String(ts || 0)); }
  catch { /* abaikan — non-kritikal */ }
}
