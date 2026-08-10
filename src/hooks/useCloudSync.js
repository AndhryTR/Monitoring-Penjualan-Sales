import { useState, useCallback, useEffect, useRef } from "react";
import { supabase } from "../utils/cloud.js";
import {
  fetchMasterMaxDate, fetchAllMasterRows, fetchMasterRowsSince, pushMasterRows,
  deleteMasterRange, pushSettings, pullSettings,
} from "../utils/syncEngine.js";
import { loadSettings, loadMasterMax, saveMasterMax } from "../utils/storage.js";

/* ============================================================================
   useCloudSync — hook untuk sinkronisasi cloud (settings LWW + master data)
   + admin/supervisor master data management (save, delete range).

   ⚠️ Sprint 6 / R6: sebelumnya inline di SalesMonitoringApp.jsx (~150 baris
   state + handlers + runSync logic). Dipisah ke hook supaya SalesMonitoringApp.jsx
   fokus jadi orchestrator.

   Hook ini menerima:
   - isAuthedRef: ref boolean (apakah user sudah login)
   - isEditor: boolean (admin/supervisor role)
   - settingsGetters: { targets, workDays, depotName, theme, projectionMethod, sidebarCollapsed }
   - settingsSetters: { setTargets, setWorkDays, setDepotName, setTheme, setProjectionMethod, setSidebarCollapsed }
   - dataState: { rawRows, setRawRows, setFileName, setParseMeta }

   Hook ini mengelola:
   - syncState ("idle" | "syncing" | "done" | "error")
   - syncMsg (error message string)
   - lastSyncAt (timestamp)
   - masterAction, masterBusy, masterResult (untuk admin modal)
   - handleSaveMaster, handleDeleteRange, runSync, syncNow
   - syncNowRef (ref ke syncNow, untuk dipanggil dari header button)
============================================================================ */
export function useCloudSync({
  isAuthedRef,
  isEditor,
  settingsGetters,
  settingsSetters,
  dataState,
}) {
  const { targets, workDays, depotName, theme, projectionMethod, sidebarCollapsed } = settingsGetters;
  const { setTargets, setWorkDays, setDepotName, setTheme, setProjectionMethod, setSidebarCollapsed } = settingsSetters;
  const { rawRows, setRawRows, setFileName, setParseMeta } = dataState;

  const [syncState, setSyncState] = useState("idle"); // idle | syncing | done | error
  const [syncMsg, setSyncMsg] = useState("");
  const [lastSyncAt, setLastSyncAt] = useState(0);
  const syncNowRef = useRef(null);

  const [masterAction, setMasterAction] = useState(null); // 'save'|'range'|'reset'|null
  const [masterBusy, setMasterBusy] = useState(false);
  const [masterResult, setMasterResult] = useState("");

  // Simpan data penjualan lokal ke master (admin/supervisor). Incremental:
  // hanya baris dengan date > max_date master yang dimasukkan.
  const handleSaveMaster = useCallback(async () => {
    if (!isEditor || !rawRows.length) return;
    setMasterBusy(true); setMasterResult("");
    const maxDate = await fetchMasterMaxDate();
    const res = await pushMasterRows(rawRows, maxDate);
    setMasterBusy(false);
    if (res.ok) setMasterResult(`${res.inserted} baris ditambahkan, ${res.skipped} dilewati (sudah ada).`);
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

  // Sinkronisasi MANUAL — hanya via tombol "Sinkronkan Sekarang".
  //   1) SETTINGS+TARGETS: last-write-wins per timestamp.
  //      - lokal lebih baru -> PUSH ke cloud (timpa)
  //      - cloud lebih baru  -> PULL & terapkan ke lokal
  //   2) MASTER DATA: tarik, master MENANG utk tanggal yang sama.
  const runSync = useCallback(async () => {
    if (!supabase) return;
    // --- 1) settings+targets LWW ---
    const localNow = loadSettings() || {};
    const localTs = Number(localNow.updated_at) || 0;
    const localDoc = { targets, workDays, depotName, theme, projectionMethod, sidebarCollapsed };
    const cloud = await pullSettings();
    if (!cloud.ok) { setSyncState("error"); setSyncMsg("Gagal menarik pengaturan: " + cloud.reason); return; }
    const cloudTs = cloud.data ? Number(cloud.data.updated_at) || 0 : 0;
    if (cloudTs > localTs) {
      // cloud lebih baru -> terapkan ke lokal
      const d = cloud.data;
      if (d.targets) setTargets(d.targets);
      if (d.work_days) setWorkDays(d.work_days);
      if (d.depot_name) setDepotName(d.depot_name);
      if (d.theme) setTheme(d.theme);
      if (d.projection_method) setProjectionMethod(d.projection_method);
      if (typeof d.sidebar_collapsed === "boolean") setSidebarCollapsed(d.sidebar_collapsed);
    } else {
      // lokal lebih baru (atau cloud kosong) -> push lokal ke cloud.
      // ⚠️ Bug fix (Sprint 2 / H8): sebelumnya `await pushSettings(localDoc);` abaikan
      // return value { ok, reason }. Bila push gagal (network / RLS / quota),
      // sync tetap lanjut ke master data dan set `lastSyncAt` — UI tunjuk
      // hijau "synced" padahal settings cloud belum ter-update.
      const pushRes = await pushSettings(localDoc);
      if (!pushRes.ok) {
        setSyncState("error");
        setSyncMsg("Gagal mengirim pengaturan ke cloud: " + (pushRes.reason || ""));
        return;
      }
    }

    // --- 2) master data (pull delta) ---
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
    if (!res.ok) { setSyncState("error"); setSyncMsg("Gagal mengambil data master: " + res.reason); return; }
    if (res.rows.length) {
      // ⚠️ Bug fix: dedup berbasis COMPOSITE KEY (date|invoice_no|product_code|sales_code),
      // bukan per-tanggal saja. Sebelumnya, semua baris lokal yang tanggalnya ada di
      // master cloud dihapus — termasuk transaksi yang berbeda (outlet/produk lain) di
      // tanggal yang sama. Akibatnya: realisasi value di HP lebih kecil dari cloud karena
      // transaksi lokal yang unik hilang.
      // Sekarang: hanya baris lokal yang composite key-nya sama persis dengan baris
      // cloud yang dihapus (duplikat). Baris lokal dengan transaksi berbeda tetap dipertahankan.
      const masterKeys = new Set(res.rows.map((r) =>
        `${r.date}|${r.invoice_no || ""}|${r.product_code || ""}|${r.sales_code || ""}`
      ));
      const keptLocal = (rawRows || []).filter((r) =>
        !masterKeys.has(`${r.date}|${r.invoiceNo || ""}|${r.productCode || ""}|${r.salesCode || ""}`)
      );
      const masterMapped = res.rows.map((r) => ({
        date: r.date, salesCode: r.sales_code, salesName: r.sales_name,
        outletCode: r.outlet_code, outletName: r.outlet_name,
        invoiceNo: r.invoice_no, productCode: r.product_code, productName: r.product_name,
        group: r.group_name, qty: r.qty, qtyKarton: r.qty_karton, unconvertible: r.unconvertible,
        value: r.value, unit: r.unit,
      }));
      const merged = [...keptLocal, ...masterMapped];
      setRawRows(merged);
      setFileName("Master data (sinkron)" + (merged.length ? ` · ${merged.length} baris` : ""));
      // parseMeta untuk master sync — tidak ada dedup lokal yang dijalankan
      // (data sudah unik di level DB), jadi duplicateRowsRemoved = 0.
      setParseMeta({ sourceFiles: [], detectedFields: [], missingFields: [], totalDataRows: merged.length, duplicateRowsRemoved: 0 });
      // catat max tanggal yang barusan dimuat utk pull delta berikutnya
      let max = loadMasterMax();
      res.rows.forEach((r) => { if (r.date && (!max || r.date > max)) max = r.date; });
      saveMasterMax(max);
    }
    setLastSyncAt(Date.now());
  }, [targets, workDays, depotName, theme, projectionMethod, sidebarCollapsed, rawRows, setTargets, setWorkDays, setDepotName, setTheme, setProjectionMethod, setSidebarCollapsed, setRawRows, setFileName, setParseMeta]);

  // Sinkronisasi manual hanya dijalankan saat tombol ditekan.
  //
  // ⚠️ Bug fix (Sprint 2 / H1): sebelumnya TANPA try/catch. Bila `runSync` melempar
  // (network error, Supabase error tak terduga), exception propagate,
  // `setSyncState("done")` tak pernah tercapai → UI stuck "syncing"
  // selamanya. Sekarang: catch → set "error" + pesan. State "done" hanya
  // di-set bila `runSync` tidak set state "error" di tengah jalan (cek
  // ulang lewat functional update untuk hindari race).
  const syncNow = useCallback(async () => {
    if (!supabase || !isAuthedRef.current) return;
    setSyncState("syncing"); setSyncMsg("");
    try {
      await runSync();
      // Hanya set "done" kalau runSync tidak set state error di tengah jalan.
      setSyncState((cur) => (cur === "syncing" ? "done" : cur));
    } catch (e) {
      setSyncState("error");
      setSyncMsg(String(e?.message || e || "Terjadi kesalahan saat sinkronisasi"));
    }
  }, [runSync, isAuthedRef]);

  // ⚠️ Bug fix (Sprint 2 / H4): sebelumnya `syncNowRef.current = syncNow;` ditulis saat
  // render — mutasi ref sebagai side-effect render melanggar aturan React
  // (khususnya garansi StrictMode dev). Concurrent mode bisa invoke render
  // berkali-kali sebelum commit, meninggalkan ref menunjuk ke closure stale
  // atau ke closure yang tak pernah commit. Sekarang: assign di useEffect
  // dengan cleanup null di unmount.
  useEffect(() => {
    syncNowRef.current = syncNow;
    return () => { syncNowRef.current = null; };
  }, [syncNow]);

  return {
    syncState, setSyncState,
    syncMsg, setSyncMsg,
    lastSyncAt, setLastSyncAt,
    syncNowRef,
    masterAction, setMasterAction,
    masterBusy, setMasterBusy,
    masterResult, setMasterResult,
    handleSaveMaster,
    handleDeleteRange,
    syncNow,
  };
}
