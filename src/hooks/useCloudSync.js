import { useState, useCallback, useEffect, useRef } from "react";
import { supabase } from "../utils/cloud.js";
import {
  fetchMasterMaxDate, fetchAllMasterRows, fetchMasterRowsSince, pushMasterRows,
  deleteMasterRange, pushSettings, pullSettings, mergeMasterRows,
} from "../utils/syncEngine.js";
import { loadSettings, loadMasterMax, saveMasterMax, loadLastMasterSyncAt, saveLastMasterSyncAt } from "../utils/storage.js";

/* ============================================================================
   useCloudSync — hook untuk sinkronisasi cloud.

   ⚠️ Sprint 14 / H15: sync dipisah jadi DUA alur independen (sebelumnya satu
   tombol "Sinkronkan Sekarang" menjalankan keduanya sekaligus):

   1) SETTINGS+TARGETS — OTOMATIS (tanpa tombol):
      - Trigger: (a) login sukses, (b) perubahan settings (debounce 3 detik),
        (c) app dibuka kembali (focus/visibilitychange, debounce 1 detik).
      - Logika: LWW per `updated_at` (lokal vs cloud) — PULL kalau cloud lebih
        baru (via settingsApplier agar tidak memicu auto-save re-push),
        PUSH kalau lokal lebih baru.
      - State: settingsSyncState ("idle"|"syncing"|"done"|"error"),
        settingsSyncMsg (error saja), lastSettingsSyncAt (timestamp).

   2) MASTER DATA (data penjualan global) — MURNI TOMBOL MANUAL:
      - Tombol "Sinkronkan Data Penjualan" di modal Akun & Sinkronisasi.
      - Pull delta (date > masterMax lokal; full kalau belum pernah sync),
        master MENANG utk tanggal yang sama (mergeMasterRows).
      - Upload lokal → master (handleSaveMaster) tetap terpisah (aksi admin).
      - State: masterSyncState ("idle"|"syncing"|"done"|"error"),
        masterSyncMsg (hasil/error), lastMasterSyncAt (timestamp, dipersist).

   TIDAK ADA auto-sync master & tidak ada queue — dari rancangan yang
   disetujui: "sync master murni via tombol".

   Hook ini menerima:
   - isAuthedRef: ref boolean (apakah user sudah login)
   - isEditor: boolean (admin/supervisor role)
   - settingsGetters: { targets, workDays, depotName, theme, projectionMethod, sidebarCollapsed }
   - settingsSetters: { setTargets, setWorkDays, setDepotName, setTheme, setProjectionMethod, setSidebarCollapsed }
   - settingsApplier: applyCloudSettings(doc, cloudTs) dari useSettings — terapkan
     settings cloud ke lokal TANPA bump updated_at (anti ping-pong LWW, H16)
   - dataState: { rawRows, setRawRows, setFileName, setParseMeta }
============================================================================ */
export function useCloudSync({
  isAuthedRef,
  isEditor,
  settingsGetters,
  settingsSetters,
  settingsApplier,
  dataState,
}) {
  const { targets, workDays, depotName, theme, projectionMethod, sidebarCollapsed } = settingsGetters;
  const { setTargets, setWorkDays, setDepotName, setTheme, setProjectionMethod, setSidebarCollapsed } = settingsSetters;
  const { rawRows, setRawRows, setFileName, setParseMeta } = dataState;

  // ---- Settings sync (otomatis) ----
  const [settingsSyncState, setSettingsSyncState] = useState("idle"); // idle | syncing | done | error
  const [settingsSyncMsg, setSettingsSyncMsg] = useState("");
  const [lastSettingsSyncAt, setLastSettingsSyncAt] = useState(0);

  // ---- Master sync (manual, tombol) ----
  const [masterSyncState, setMasterSyncState] = useState("idle"); // idle | syncing | done | error
  const [masterSyncMsg, setMasterSyncMsg] = useState("");
  const [lastMasterSyncAt, setLastMasterSyncAt] = useState(() => loadLastMasterSyncAt());
  const settingsSyncNowRef = useRef(null);

  const [masterAction, setMasterAction] = useState(null); // 'save'|'range'|'reset'|null
  const [masterBusy, setMasterBusy] = useState(false);
  const [masterResult, setMasterResult] = useState("");

  // Guard anti-tumpukan: sync settings tidak boleh jalan ganda bersamaan
  // (login + perubahan + focus bisa dekat sekali waktunya).
  const settingsSyncInFlightRef = useRef(false);

  // LWW settings+targets: pull kalau cloud lebih baru, push kalau lokal lebih baru.
  const syncSettingsNow = useCallback(async () => {
    if (!supabase || !isAuthedRef.current) return;
    if (settingsSyncInFlightRef.current) return;
    settingsSyncInFlightRef.current = true;
    setSettingsSyncState("syncing"); setSettingsSyncMsg("");
    try {
      const localNow = loadSettings() || {};
      const localTs = Number(localNow.updated_at) || 0;
      const localDoc = { targets, workDays, depotName, theme, projectionMethod, sidebarCollapsed };
      const cloud = await pullSettings();
      if (!cloud.ok) { setSettingsSyncState("error"); setSettingsSyncMsg("Gagal menarik pengaturan: " + cloud.reason); return; }
      const cloudTs = cloud.data ? Number(cloud.data.updated_at) || 0 : 0;
      // ⚠️ H18 (anti-loop): kalau cloud sudah SAMA PERSIS dengan lokal
      // (nilai identik + timestamp sama), tidak ada yang perlu di-push/di-pull
      // — berhenti di sini supaya tidak menciptakan referensi objek baru yang
      // memicu trigger lagi. Sebelumnya push tetap terjadi (updated_at baru)
      // → cloud selalu "lebih baru" → pull balik → loop tak berujung.
      if (cloud.data && cloudTs === localTs) {
        return;
      }
      if (cloudTs > localTs) {
        // cloud lebih baru -> terapkan ke lokal via settingsApplier.
        // ⚠️ H16: WAJIB pakai settingsApplier (bukan setter biasa) supaya
        // localStorage ditulis dengan updated_at = cloudTs dan auto-save
        // effect identik — kalau tidak, auto-save bump updated_at ke
        // Date.now() → LWW mengira lokal lebih baru → push balik → ping-pong.
        if (settingsApplier) settingsApplier(cloud.data, cloudTs);
        else {
          const d = cloud.data;
          if (d.targets) setTargets(d.targets);
          if (d.work_days) setWorkDays(d.work_days);
          if (d.depot_name) setDepotName(d.depot_name);
          if (d.theme) setTheme(d.theme);
          if (d.projection_method) setProjectionMethod(d.projection_method);
          if (typeof d.sidebar_collapsed === "boolean") setSidebarCollapsed(d.sidebar_collapsed);
        }
      } else {
        // lokal lebih baru (atau cloud kosong) -> push lokal ke cloud.
        // ⚠️ Bug fix (Sprint 2 / H8): sebelumnya `await pushSettings(localDoc);` abaikan
        // return value { ok, reason }. Bila push gagal (network / RLS / quota),
        // sync tetap lanjut dan set `lastSyncAt` — UI tunjuk hijau "synced"
        // padahal settings cloud belum ter-update.
        const pushRes = await pushSettings(localDoc);
        if (!pushRes.ok) {
          setSettingsSyncState("error");
          setSettingsSyncMsg("Gagal mengirim pengaturan ke cloud: " + (pushRes.reason || ""));
          return;
        }
      }
      setSettingsSyncState("done");
      setLastSettingsSyncAt(Date.now());
    } catch (e) {
      setSettingsSyncState("error");
      setSettingsSyncMsg(String(e?.message || e || "Terjadi kesalahan saat sinkronisasi pengaturan"));
    } finally {
      settingsSyncInFlightRef.current = false;
    }
  }, [targets, workDays, depotName, theme, projectionMethod, sidebarCollapsed, setTargets, setWorkDays, setDepotName, setTheme, setProjectionMethod, setSidebarCollapsed, settingsApplier, isAuthedRef]);

  // ---- Master data: PULL (tombol manual) ----
  const syncMasterNow = useCallback(async () => {
    if (!supabase || !isAuthedRef.current) return;
    setMasterSyncState("syncing"); setMasterSyncMsg("");
    try {
      // Device yang sudah pernah sync hanya menarik baris tanggal BARU
      // (date > maxLokal). Device baru/kosong: full (semua baris).
      // ⚠️ Bug fix: localMax yang kosong ("") harus diperlakukan sama dengan
      // null — keduanya berarti "belum pernah sync" → full pull.
      // Sebelumnya `localMax` bisa "" (string kosong dari saveMasterMax("")),
      // yang truthy dalam JS — masuk ke fetchMasterRowsSince("") yang ambil
      // baris dengan date > "" (semua baris), tapi behavior-nya tidak konsisten.
      const localMax = loadMasterMax();
      const hasLocalMax = localMax && localMax.length > 0;
      const res = hasLocalMax ? await fetchMasterRowsSince(localMax) : await fetchAllMasterRows();
      if (!res.ok) { setMasterSyncState("error"); setMasterSyncMsg("Gagal mengambil data master: " + res.reason); return; }
      if (!res.rows.length) {
        setMasterSyncState("done");
        setLastMasterSyncAt(Date.now());
        setMasterSyncMsg("Tidak ada data baru di master.");
        return;
      }
      const { merged, maxDate } = mergeMasterRows(rawRows, res.rows);
      setRawRows(merged);
      setFileName("Master data (sinkron)" + (merged.length ? ` · ${merged.length} baris` : ""));
      // parseMeta untuk master sync — tidak ada dedup lokal yang dijalankan
      // (data sudah unik di level DB), jadi duplicateRowsRemoved = 0.
      setParseMeta({ sourceFiles: [], detectedFields: [], missingFields: [], totalDataRows: merged.length, duplicateRowsRemoved: 0 });
      if (maxDate) saveMasterMax(maxDate);
      const downloadedNow = res.rows.length;
      setLastMasterSyncAt(Date.now());
      saveLastMasterSyncAt(Date.now());
      setMasterSyncState("done");
      setMasterSyncMsg(`${downloadedNow} baris baru dimuat dari master.`);
    } catch (e) {
      setMasterSyncState("error");
      setMasterSyncMsg(String(e?.message || e || "Terjadi kesalahan saat sinkronisasi data penjualan"));
    }
  }, [rawRows, setRawRows, setFileName, setParseMeta, isAuthedRef]);

  // Simpan data penjualan lokal ke master (admin/supervisor). Incremental:
  // hanya baris dengan date > max_date master yang dimasukkan.
  const handleSaveMaster = useCallback(async () => {
    if (!isEditor || !rawRows.length) return;
    setMasterBusy(true); setMasterResult("");
    const maxDate = await fetchMasterMaxDate();
    const res = await pushMasterRows(rawRows, maxDate);
    setMasterBusy(false);
    if (res.ok) {
      // `inserted` dari count:"exact" (baris yang BENAR² masuk DB). `dupInternal`
      // = duplikat dalam file upload (key UNIQUE sama), `dupSkipped` = sudah ada
      // di master dari upload/sync sebelumnya, `skipped` = di luar rentang incremental.
      const parts = [`${res.inserted} baris ditambahkan`];
      if (res.dupInternal > 0) parts.push(`${res.dupInternal} duplikat dalam file`);
      if (res.dupSkipped > 0) parts.push(`${res.dupSkipped} sudah ada di master`);
      if (res.skipped > 0) parts.push(`${res.skipped} di luar rentang`);
      setMasterResult(parts.join(", "));
    }
    else setMasterResult("Gagal simpan ke master: " + (res.reason || ""));
  }, [isEditor, rawRows]);

  // Hapus rentang tanggal di master (admin/supervisor) + opsional data lokal.
  // Kembalikan hasil ({ ok, message|null }) supaya modal bisa menampilkan
  // feedback SEBELUM ditutup.
  const handleDeleteRange = useCallback(async (dateFrom, dateTo, alsoLocal) => {
    if (!isEditor || !dateFrom || !dateTo) return null;
    setMasterBusy(true);
    const res = await deleteMasterRange(dateFrom, dateTo);
    setMasterBusy(false);
    let msg;
    if (res.ok) msg = `Hapus berhasil: ${res.deleted} baris dihapus dari master.`;
    else return { ok: false, message: "Gagal hapus: " + (res.reason || "") };
    // Opsional: hapus juga baris lokal pada rentang tanggal tsb
    if (alsoLocal && rawRows.length) {
      const before = rawRows.length;
      const kept = rawRows.filter((r) => !(r.date >= dateFrom && r.date <= dateTo));
      const removed = before - kept.length;
      setRawRows(kept);
      if (removed > 0) {
        setFileName((cur) => (cur && cur.includes("·") ? cur.replace(/· \d+ baris$/, `· ${kept.length} baris`) : cur));
      }
      msg += ` ${removed} baris lokal dihapus.`;
    }
    return { ok: true, message: msg };
  }, [isEditor, rawRows, setRawRows, setFileName]);

  // ---- Trigger OTOMATIS settings sync ----
  // (a) Login sukses & (b) perubahan settings — gabung dalam satu effect yang
  // watch serialized snapshot. isAuthedRef dibaca dari ref (bukan state) supaya
  // effect TIDAK perlu depend pada auth state — perubahan snapshot ketika belum
  // login (mis. load session IndexedDB) tidak memicu request.
  //
  // ⚠️ Sprint 14 / H18 (bug "modal settings reset tiap 3 detik"): dependensi
  // effect SEBELUMNYA adalah referensi objek (targets, workDays, ...). Setiap
  // state sync berganti referensi (baru dari parse JSON cloud), effect jalan —
  // walau nilai IDENTIK → timer 3 detik di-reset terus → sync loop tak berujung.
  // Fix: snapshot dihitung ONCE sebagai string (`settingsSnapshot`) dan jadi
  // SATU-SATUNYA dependensi. Effect hanya jalan kalau serialized BENAR² berubah
  // (nilai beda, bukan cuma referensi baru).
  const settingsSnapshot = JSON.stringify({ targets, workDays, depotName, theme, projectionMethod, sidebarCollapsed });
  // Recency guard: simpan timestamp sync terakhir + snapshot terakhir yang
  // sudah di-sync. Kalau sync selesai dan nilai TIDAK berubah, jangan sync
  // ulang — LWW berhenti begitu konvergen (anti loop, H18).
  const lastSyncedSnapshotRef = useRef(null);
  const changeTimerRef = useRef(null);
  useEffect(() => {
    if (!isAuthedRef.current) return;
    if (lastSyncedSnapshotRef.current === settingsSnapshot) return;
    if (changeTimerRef.current) clearTimeout(changeTimerRef.current);
    changeTimerRef.current = setTimeout(() => {
      syncSettingsNow();
      lastSyncedSnapshotRef.current = settingsSnapshot;
    }, 3000);
    return () => {
      if (changeTimerRef.current) clearTimeout(changeTimerRef.current);
    };
  }, [settingsSnapshot, syncSettingsNow, isAuthedRef]);

  // (c) Fokus kembali ke app — window focus + visibilitychange (visible) +
  // online. Debounce 1s (kedua event sering fires bareng). Tidak sync saat
  // sudah jalan (guard inFlight di syncSettingsNow).
  const focusTimerRef = useRef(null);
  useEffect(() => {
    const trigger = () => {
      if (!isAuthedRef.current) return;
      if (focusTimerRef.current) clearTimeout(focusTimerRef.current);
      focusTimerRef.current = setTimeout(() => { syncSettingsNow(); }, 1000);
    };
    const onFocus = () => trigger();
    const onVisible = () => { if (document.visibilityState === "visible") trigger(); };
    const onOnline = () => trigger();
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", onOnline);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", onOnline);
      if (focusTimerRef.current) clearTimeout(focusTimerRef.current);
    };
  }, [syncSettingsNow, isAuthedRef]);

  // Panggil dari luar (login sukses) — ref yang diisi setelah hook render.
  useEffect(() => {
    settingsSyncNowRef.current = syncSettingsNow;
    return () => { settingsSyncNowRef.current = null; };
  }, [syncSettingsNow]);

  return {
    settingsSyncState, setSettingsSyncState,
    settingsSyncMsg, setSettingsSyncMsg,
    lastSettingsSyncAt, setLastSettingsSyncAt,
    settingsSyncNowRef,
    masterSyncState, setMasterSyncState,
    masterSyncMsg, setMasterSyncMsg,
    lastMasterSyncAt, setLastMasterSyncAt,
    syncMasterNow,
    masterAction, setMasterAction,
    masterBusy, setMasterBusy,
    masterResult, setMasterResult,
    handleSaveMaster,
    handleDeleteRange,
  };
}