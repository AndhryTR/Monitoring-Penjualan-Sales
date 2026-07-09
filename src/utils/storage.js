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
============================================================================ */

const SETTINGS_KEY = "smapp:settings:v1";
const SETTINGS_VERSION = 1;

const DB_NAME = "smapp-db";
const DB_VERSION = 1;
const STORE_NAME = "session";
const SESSION_KEY = "current";
const SESSION_VERSION = 1;

/* ---------------------------- Settings (localStorage) --------------------------- */

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
    // Jalur migrasi sederhana: kalau versi struktur berubah di masa depan,
    // tempat untuk menyesuaikan/membersihkan data lama ada di sini,
    // bukan langsung dipakai mentah-mentah.
    if (!parsed || typeof parsed !== "object") return null;
    return parsed;
  } catch (e) {
    console.warn("Gagal membaca pengaturan tersimpan, memakai default:", e);
    return null;
  }
}

export function clearSettings() {
  try {
    window.localStorage.removeItem(SETTINGS_KEY);
    return true;
  } catch (e) {
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
  } catch (e) {
    return false;
  }
}
