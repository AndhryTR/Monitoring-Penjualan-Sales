/* ============================================================================
   SYNC ENGINE — sinkronisasi offline-first lintas perangkat (last-write-wins)
   Prinsip: LOKAL tetap raja. Semua baca/tulis aplikasi jalan persis seperti
   sekarang (localStorage + IndexedDB). Ini cuma LAPISAN di bawahnya: sesudah
   simpan lokal berhasil, tandai "pending sync" di queue IndexedDB, lalu push
   ke cloud (Supabase) secara berkala. Saat login, tarik data cloud dan banding.

   KONFLIK: last-write-wins per DOKUMEN. Tiap dokumen punya updated_at (epoch
   ms) + updated_by (device id). Yang timestamp-nya lebih baru menang; kalau
   sama, LOKAL menang (device yang sedang aktif).

   DOKUMEN yang disinkronkan:
     settings   -> profiles  (1 baris per user: targets, workDays, depotName,
                               theme, projectionMethod, sidebarCollapsed)
     session    -> sales_data(1 baris per user: rawRows, fileName, parseMeta)
     history    -> history   (1 baris per user: entries[])

   PERANGKAT id: random string di localStorage, tetap sama walau refresh,
   beda antar perangkat. Dipakai di kolom updated_by untuk log saja.

   Modul ini TIDAK pernah melempar ke pemanggil — kegagalan cloud dinilai
   sebagai "offline/perlu coba lagi" dan statusnya dicatat di queue.
============================================================================ */
import { supabase } from "./cloud.js";

const DEVICE_KEY = "smapp:deviceId";
export function getDeviceId() {
  try {
    let id = window.localStorage.getItem(DEVICE_KEY);
    if (!id) {
      id = "dev_" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
      window.localStorage.setItem(DEVICE_KEY, id);
    }
    return id;
  } catch (_e) { return "dev_unknown"; }
}

const QUEUE_DB = "smapp-sync-db";
const QUEUE_STORE = "pending";

function openQueueDB() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") { reject(new Error("IndexedDB tidak tersedia")); return; }
    const req = indexedDB.open(QUEUE_DB, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(QUEUE_STORE)) req.result.createObjectStore(QUEUE_STORE, { keyPath: "key" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// Lanjut semua pekerjaan queue + operasi, SUKSES atau GAGAL (gagal = biarkan
// tertunda, bukan batal). Kembalikan jumlah perubahan yang berhasil.
async function idbWrite(mode, work) {
  const db = await openQueueDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(QUEUE_STORE, mode);
    const store = tx.objectStore(QUEUE_STORE);
    work(store);
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  }).finally(() => db.close());
}

export function queuePending(key, data) {
  return idbWrite("readwrite", (store) =>
    store.put({ key, ...data, queuedAt: Date.now() })
  ).catch(() => false);
}

export function getPending(key) {
  if (typeof indexedDB === "undefined") return Promise.resolve(null);
  return openQueueDB()
    .then(async (db) => {
      const result = await new Promise((resolve, reject) => {
        const tx = db.transaction(QUEUE_STORE, "readonly");
        const req = tx.objectStore(QUEUE_STORE).get(key);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error);
      });
      db.close();
      return result;
    })
    .catch(() => null);
}

export function clearPending(key) {
  return idbWrite("readwrite", (store) => store.delete(key)).catch(() => false);
}

export function getAllPending() {
  if (typeof indexedDB === "undefined") return Promise.resolve([]);
  return openQueueDB()
    .then(async (db) => {
      const result = await new Promise((resolve, reject) => {
        const tx = db.transaction(QUEUE_STORE, "readonly");
        const req = tx.objectStore(QUEUE_STORE).getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
      });
      db.close();
      return result;
    })
    .catch(() => []);
}

export async function countAllPending() {
  try { return (await getAllPending()).length; } catch (_e) { return 0; }
}

/* ------------------------- upsert ke cloud (LWW) ------------------------- */

const nowMs = () => new Date().getTime();

async function upsertRow(table, payload) {
  const { error } = await supabase.from(table).upsert(payload, { onConflict: "user_id" });
  if (error) throw error;
}

// Setiap dokumen: payload di-colok di kolom jsonb tabel masing-masing.
// PENTING: nama kolom harus SNAKE_CASE persis seperti di setup.sql
// (depot_name, work_days, ...) — Supabase menolak kolom yang tidak dikenal.
export async function pushToCloud(docs) {
  if (!supabase) return { ok: false, reason: "not_configured", pushed: 0 };
  const uid = supabase.auth.getUser().then((x) => x.data?.user?.id).catch(() => null);
  const user = await uid;
  if (!user?.id) return { ok: false, reason: "no_session", pushed: 0 };
  const now = nowMs();
  let pushed = 0;
  for (const doc of docs) {
    const { key, data } = doc;
    const device = data.updated_by || getDeviceId();
    const updated_at = data.updated_at || now;
    try {
      if (key === "settings") {
        await upsertRow("profiles", {
          user_id: user.id,
          targets: data.targets ?? null,
          work_days: data.workDays ?? null,
          depot_name: data.depotName ?? null,
          theme: data.theme ?? null,
          projection_method: data.projectionMethod ?? null,
          sidebar_collapsed: data.sidebarCollapsed ?? null,
          updated_at, updated_by: device,
        });
      } else if (key === "session") {
        await upsertRow("sales_data", {
          user_id: user.id,
          file_name: data.fileName ?? null,
          parse_meta: data.parseMeta ?? null,
          raw_rows: data.rawRows ?? null,
          updated_at, updated_by: device,
        });
      } else if (key === "history") {
        await upsertRow("history", {
          user_id: user.id,
          entries: data.entries ?? [],
          updated_at, updated_by: device,
        });
      }
      await clearPending(key);
      pushed++;
    } catch (e) {
      // biarkan di queue, coba lagi nanti
      console.warn(`[sync] gagal push ${key}:`, e.message);
    }
  }
  return { ok: true, reason: "ok", pushed };
}

// Ambil semua dokumen cloud milik user -> array [{key, data}]
export async function pullFromCloud() {
  if (!supabase) return { ok: false, reason: "not_configured", docs: [] };
  const uid = supabase.auth.getUser().then((x) => x.data?.user?.id).catch(() => null);
  const user = await uid;
  if (!user?.id) return { ok: false, reason: "no_session", docs: [] };
  const docs = [];
  const tables = ["profiles", "sales_data", "history"];
  for (const t of tables) {
    try {
      const { data } = await supabase.from(t).select("*").eq("user_id", user.id).maybeSingle();
      if (!data) continue;
      if (t === "profiles") docs.push({ key: "settings", data: data });
      else if (t === "sales_data") docs.push({ key: "session", data: data });
      else if (t === "history") docs.push({ key: "history", data: data });
    } catch (e) {
      console.warn(`[sync] gagal pull ${t}:`, e.message);
    }
  }
  return { ok: true, reason: "ok", docs: docs };
}

// LWW merge per dokumen terhadap data LOKAL.
// `localDocs` = { settings: {...}, session: {...}, history: {...} } (updated_at lokal)
// Kembalikan { apply: Array<{key, data}> (ambil dari cloud), pushBack: Array<{key, data}> }
export function mergeLocalVsCloud(localDocs, cloudDocs) {
  const apply = [];
  const pushBack = [];
  cloudDocs.forEach((cd) => {
    const local = localDocs[cd.key];
    const cTs = Number(cd.data.updated_at) || 0;
    const lTs = local ? Number(local.updated_at) || 0 : 0;
    if (!local) {
      // tidak ada lokal -> ambil dari cloud
      apply.push({ key: cd.key, data: cd.data });
    } else if (cTs > lTs) {
      apply.push({ key: cd.key, data: cd.data });
    } else if (lTs > cTs || (lTs === cTs && lTs !== 0)) {
      // lokal lebih baru (atau sama) -> push balik
      pushBack.push({ key: cd.key, data: local });
    } else {
      // cloud kosong + lokal kosong -> abaikan
    }
  });
  return { apply, pushBack };
}

/* ------------------------------ status ringkas ------------------------------ */
// Ringkas antrian perubahan yang belum terkirim -> { settings, session, history }
export function attachPendingFlags(allPending) {
  const flags = { settings: false, session: false, history: false };
  (allPending || []).forEach((p) => { if (p && p.key) flags[p.key] = true; });
  return flags;
}
