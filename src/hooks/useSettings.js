import { useState, useEffect, useRef } from "react";
import { saveSettings, loadSettings, clearSettings } from "../utils/storage.js";
import { WORK_DAYS_DEFAULT } from "../constants/thresholds.js";
import DEFAULT_TARGETS from "../constants/defaultTargets.json";

/* ============================================================================
   useSettings — hook untuk state settings + auto-save (debounced) ke localStorage.
   ⚠️ Sprint 6 / R4: sebelumnya inline di SalesMonitoringApp.jsx (~100 baris
   state declarations + auto-save effect dengan debounce). Dipisah ke hook
   supaya SalesMonitoringApp.jsx fokus jadi orchestrator.

   Hook ini mengelola:
   - persistedSettings (lazy load dari localStorage sekali saat mount)
   - 9 state settings: theme, powerSaveMode, sidebarCollapsed, filters,
     workDays, targets, depotName, projectionMethod, comparisonBase
   - Auto-save dengan debounce 400ms + dirty-flag tracking (Sprint 1 + H7)
   - Reset ke default (dipakai "Clear All" di SettingsModal)

   Catatan:
   - persistedSettings.updated_at dipakai untuk sync LWW (lihat useCloudSync).
     Save pertama (mount) TIDAK bump updated_at — pakai nilai yang sudah ada.
   - Save berikutnya (perubahan nilai) debounce 400ms untuk hindari
     JSON.stringify 28KB targets di setiap keystroke (Sprint 2 / H7).
============================================================================ */
export function useSettings() {
  const [persistedSettings] = useState(() => loadSettings());

  const [theme, setTheme] = useState(persistedSettings?.theme || "dark");
  const [powerSaveMode, setPowerSaveMode] = useState(persistedSettings?.powerSaveMode ?? false);
  // Status collapse sidebar desktop — diingat lintas sesi sama seperti tema.
  const [sidebarCollapsed, setSidebarCollapsed] = useState(persistedSettings?.sidebarCollapsed ?? false);

  const [filters, setFilters] = useState(() => {
    const saved = persistedSettings?.filters;
    if (!saved) return { salesCodes: [], groups: [], dateFrom: "", dateTo: "", datePreset: "all" };
    // Settings lama (sebelum fitur preset ada) belum punya field datePreset —
    // kalau dateFrom/dateTo sudah keisi manual, anggap "custom" biar tidak
    // tiba-tiba ketimpa jadi "Semua Data".
    return { ...saved, datePreset: saved.datePreset ?? (saved.dateFrom || saved.dateTo ? "custom" : "all") };
  });
  const [workDays, setWorkDays] = useState(persistedSettings?.workDays ?? WORK_DAYS_DEFAULT);
  const [targets, setTargets] = useState(persistedSettings?.targets ?? DEFAULT_TARGETS);
  const [depotName, setDepotName] = useState(persistedSettings?.depotName ?? "DEPO LOTIM");
  // Metode proyeksi terpilih di ProjectionCard (linear/trend7/weekday) —
  // disimpan lintas sesi seperti pengaturan lain, konsisten dengan preferensi
  // user yang sifatnya "cara pandang data", bukan data itu sendiri.
  const [projectionMethod, setProjectionMethod] = useState(persistedSettings?.projectionMethod ?? "linear");
  // Opsi pembanding growth di tab Tren Periode & Perbandingan.
  const [comparisonBase, setComparisonBase] = useState(persistedSettings?.comparisonBase ?? "prev");

  // ---- Auto-save (debounced, dirty-flag tracked) ----
  //
  // ⚠️ Bug fix (Sprint 1): sebelumnya effect ini selalu menulis
  // `updated_at: Date.now()` di setiap mount → lokal selalu tampak lebih baru
  // dari cloud → sync LWW rusak. Fix: bandingkan snapshot serialized dengan
  // `lastSavedSettingsRef`. Hanya tulis + bump updated_at saat snapshot
  // BENAR-BENAR berubah. Saat mount pertama, pakai persistedSettings.updated_at.
  //
  // ⚠️ Bug fix (Sprint 2 / H7): sebelumnya effect juga langsung tulis ke
  // localStorage saat setiap perubahan. Karena `targets` ≈28KB dan bisa di-
  // modify per-keystroke (input di SettingsModal) atau per-slider, ini
  // menyebabkan `JSON.stringify` synchronous 28KB + localStorage write di
  // setiap input event → input lag, terutama di device low-end. Fix: debounce
  // 400ms dengan setTimeout + cleanup. Save pertama (mount) tetap immediate
  // supaya state awal tersimpan walau user langsung tutup tab.
  const lastSavedSettingsRef = useRef(null);
  const saveSettingsTimerRef = useRef(null);
  useEffect(() => {
    const settingsSnapshot = { theme, powerSaveMode, filters, workDays, targets, depotName, projectionMethod, comparisonBase, sidebarCollapsed };
    const serialized = JSON.stringify(settingsSnapshot);
    if (lastSavedSettingsRef.current === serialized) {
      // Tidak ada perubahan nilai — jangan tulis, jangan bump updated_at,
      // dan clear timer debounce yang mungkin masih pending.
      if (saveSettingsTimerRef.current) {
        clearTimeout(saveSettingsTimerRef.current);
        saveSettingsTimerRef.current = null;
      }
      return;
    }
    const isFirstSave = lastSavedSettingsRef.current === null;
    // Save pertama (mount) = immediate, supaya state awal langsung tersimpan.
    // Save berikutnya (perubahan nilai) = debounce 400ms untuk hindari
    // stringify + localStorage write di setiap keystroke/slider-drag.
    const performSave = () => {
      const prevUpdatedAt = isFirstSave
        ? (persistedSettings?.updated_at || 0)
        : Date.now();
      saveSettings({ ...settingsSnapshot, updated_at: prevUpdatedAt });
      lastSavedSettingsRef.current = serialized;
      saveSettingsTimerRef.current = null;
    };
    if (isFirstSave) {
      performSave();
    } else {
      // Clear timer debounce sebelumnya (bila ada) supaya hanya nilai terbaru
      // yang ditulis. Tanpa ini, perubahan cepat bisa numpuk beberapa write.
      if (saveSettingsTimerRef.current) clearTimeout(saveSettingsTimerRef.current);
      saveSettingsTimerRef.current = setTimeout(performSave, 400);
    }
    // Cleanup: clear timer pending saat effect re-run atau unmount.
    return () => {
      if (saveSettingsTimerRef.current) {
        clearTimeout(saveSettingsTimerRef.current);
        saveSettingsTimerRef.current = null;
      }
    };
  }, [theme, powerSaveMode, filters, workDays, targets, depotName, projectionMethod, comparisonBase, sidebarCollapsed, persistedSettings]);

  // Helper: reset semua settings ke default (dipakai "Clear All" SettingsModal)
  // ⚠️ Bug fix: reset juga lastSavedSettingsRef + persistedSettings.updated_at
  // supaya auto-save effect TIDAK bump updated_at ke Date.now(). Sebelumnya,
  // resetAllSettings() set state ke default → auto-save effect trigger → tulis
  // ke localStorage dengan updated_at = Date.now() (karena isFirstSave=false) →
  // sync LWW menganggap lokal lebih baru dari cloud → push setting default ke
  // cloud → overwrite setting cloud yang asli.
  //
  // Fix: set updated_at ke 0 (epoch) supaya cloudTs > localTs → sync PULL dari
  // cloud, bukan push. lastSavedSettingsRef di-reset ke null supaya next save
  // isFirstSave=true → pakai persistedSettings.updated_at (yang 0).
  // ⚠️ Sprint 14 / H16: terapkan settings dari cloud ke state + localStorage
  // dengan `updated_at = cloudTs` persis (BUKAN Date.now()).
  //
  // TANPA ini, auto-save effect melihat snapshot berubah (state baru dari
  // cloud) → menulis ke localStorage dengan updated_at = Date.now() → sync
  // LWW berikutnya mengira lokal lebih baru → push balik → cloud updated_at
  // baru → pull lagi… **ping-pong tak berujung** saat auto-sync settings
  // berjalan. Dengan menulis updated_at = cloudTs dan me-set
  // lastSavedSettingsRef ke serialized hasil, auto-save effect melihat
  // snapshot IDENTIK → tidak menulis, tidak bump, tidak re-push.
  const applyCloudSettings = (doc, cloudTs) => {
    const ts = Number(cloudTs) || 0;
    if (doc.targets) setTargets(doc.targets);
    if (doc.work_days) setWorkDays(doc.work_days);
    if (doc.depot_name) setDepotName(doc.depot_name);
    if (doc.theme) setTheme(doc.theme);
    if (doc.projection_method) setProjectionMethod(doc.projection_method);
    if (typeof doc.sidebar_collapsed === "boolean") setSidebarCollapsed(doc.sidebar_collapsed);
    // Tulis direct ke localStorage dengan ts cloud — auto-save tidak menyentuh
    // bidang ini lagi (filters & comparisonBase TIDAK ikut sync cloud; nilai
    // mereka tetap dari localStorage/state yang sudah ada — tidak di-overwrite).
    const snapshot = {
      theme: doc.theme ?? theme, powerSaveMode,
      filters, workDays: doc.work_days ?? workDays, targets: doc.targets ?? targets,
      depotName: doc.depot_name ?? depotName,
      projectionMethod: doc.projection_method ?? projectionMethod,
      comparisonBase,
      sidebarCollapsed: typeof doc.sidebar_collapsed === "boolean" ? doc.sidebar_collapsed : sidebarCollapsed,
    };
    saveSettings({ ...snapshot, updated_at: ts });
    lastSavedSettingsRef.current = JSON.stringify(snapshot);
  };

  const resetAllSettings = () => {
    setTheme("dark");
    setPowerSaveMode(false);
    setSidebarCollapsed(false);
    setFilters({ salesCodes: [], groups: [], dateFrom: "", dateTo: "", datePreset: "all" });
    setWorkDays(WORK_DAYS_DEFAULT);
    setTargets(DEFAULT_TARGETS);
    setDepotName("DEPO LOTIM");
    setProjectionMethod("linear");
    setComparisonBase("prev");
    clearSettings();
    // ⚠️ Kritikal: reset ref + tulis localStorage dengan updated_at=0.
    // Tanpa ini, auto-save effect akan bump updated_at ke Date.now() saat
    // state berubah dari nilai lama ke default — LWW salah kira lokal baru.
    lastSavedSettingsRef.current = null;
    saveSettingsTimerRef.current = null;
    // Tulis setting default ke localStorage dengan updated_at=0 (epoch).
    // 0 < cloudTs manapun → sync LWW akan PULL dari cloud, bukan push.
    saveSettings({
      theme: "dark", powerSaveMode: false, sidebarCollapsed: false,
      filters: { salesCodes: [], groups: [], dateFrom: "", dateTo: "", datePreset: "all" },
      workDays: WORK_DAYS_DEFAULT, targets: DEFAULT_TARGETS,
      depotName: "DEPO LOTIM", projectionMethod: "linear", comparisonBase: "prev",
      updated_at: 0,
    });
    // Set ref ke serialized default supaya auto-save effect tidak trigger lagi
    // (karena state sudah sama dengan yang tersimpan).
    const defaultSnapshot = {
      theme: "dark", powerSaveMode: false,
      filters: { salesCodes: [], groups: [], dateFrom: "", dateTo: "", datePreset: "all" },
      workDays: WORK_DAYS_DEFAULT, targets: DEFAULT_TARGETS,
      depotName: "DEPO LOTIM", projectionMethod: "linear", comparisonBase: "prev",
      sidebarCollapsed: false,
    };
    lastSavedSettingsRef.current = JSON.stringify(defaultSnapshot);
  };

  return {
    persistedSettings,
    theme, setTheme,
    powerSaveMode, setPowerSaveMode,
    sidebarCollapsed, setSidebarCollapsed,
    filters, setFilters,
    workDays, setWorkDays,
    targets, setTargets,
    depotName, setDepotName,
    projectionMethod, setProjectionMethod,
    comparisonBase, setComparisonBase,
    resetAllSettings,
    applyCloudSettings,
  };
}
