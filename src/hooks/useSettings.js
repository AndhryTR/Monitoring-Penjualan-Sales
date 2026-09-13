import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { saveSettings, loadSettings, clearSettings } from "../utils/storage.js";
import { WORK_DAYS_DEFAULT } from "../constants/thresholds.js";
import DEFAULT_TARGETS from "../constants/defaultTargets.json";
// ⚠️ Sprint 18 / Multi-Depo: import template helpers untuk addDepot/duplicateDepot
import {
  makeBlankDepot, makeStandardDepot, duplicateDepot,
  generateDepotId,
  DEFAULT_DEPOT_NAME, DEFAULT_DEPOT_CODE,
} from "../constants/depoTemplate.js";

/* ============================================================================
   useSettings — hook untuk state settings + auto-save (debounced) ke localStorage.

   ⚠️ Sprint 18 / Multi-Depo: refactor besar-besaran. Sebelumnya `targets`,
   `workDays`, `depotName` adalah state terpisah yang langsung di-persist.
   Sekarang `depots[]` + `activeDepotId` jadi source of truth; ketiga field
   itu menjadi derived value dari `depots[activeDepotId]`.

   Strategi backward-compat:
   - API publik tetap expose `targets`, `setTargets`, `workDays`, `setWorkDays`,
     `depotName`, `setDepotName` — komponen konsumer (TargetSalesEditor,
     SalesMonitoringApp, dll.) tidak perlu diubah.
   - Setter `setTargets(next)` sekarang wrap: update `depots[i].targets` di
     indeks depo aktif, lalu trigger state update `depots`.
   - API baru yang di-expose: `depots`, `activeDepotId`, `setActiveDepot`,
     `addDepot`, `deleteDepot`, `addSales`, `updateSales`, `deleteSales`.

   Catatan:
   - persistedSettings.updated_at dipakai untuk sync LWW (lihat useCloudSync).
     Save pertama (mount) TIDAK bump updated_at — pakai nilai yang sudah ada.
   - Save berikutnya (perubahan nilai) debounce 400ms untuk hindari
     JSON.stringify 28KB targets di setiap keystroke (Sprint 2 / H7).
============================================================================ */

// Default depots saat pertama kali app dibuka tanpa settings tersimpan sama
// sekali — wrap DEFAULT_TARGETS ke depots[0] supaya user existing tidak kena
// dampak (dashboard tetap menampilkan 11 sales DEPO LOTIM).
function makeInitialDepots(persisted) {
  // Persisted sudah migrasi v2 dari storage.js — pakai apa adanya.
  if (persisted?.depots && Array.isArray(persisted.depots) && persisted.depots.length > 0) {
    return persisted.depots;
  }
  // Fallback: bila persisted null/kosong, buat depots[0] dari DEFAULT_TARGETS.
  const now = new Date().toISOString();
  const depotId = generateDepotId(DEFAULT_DEPOT_NAME);
  return [{
    id: depotId,
    name: DEFAULT_DEPOT_NAME,
    code: DEFAULT_DEPOT_CODE,
    workDays: WORK_DAYS_DEFAULT,
    targets: DEFAULT_TARGETS,
    createdAt: now,
    updatedAt: now,
  }];
}

export function useSettings() {
  const [persistedSettings] = useState(() => loadSettings());

  // ---- Global state (tetap) ----
  const [theme, setTheme] = useState(persistedSettings?.theme || "dark");
  const [powerSaveMode, setPowerSaveMode] = useState(persistedSettings?.powerSaveMode ?? false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(persistedSettings?.sidebarCollapsed ?? false);

  const [filters, setFilters] = useState(() => {
    const saved = persistedSettings?.filters;
    if (!saved) return { salesCodes: [], groups: [], dateFrom: "", dateTo: "", datePreset: "all" };
    return { ...saved, datePreset: saved.datePreset ?? (saved.dateFrom || saved.dateTo ? "custom" : "all") };
  });
  const [projectionMethod, setProjectionMethod] = useState(persistedSettings?.projectionMethod ?? "linear");
  const [comparisonBase, setComparisonBase] = useState(persistedSettings?.comparisonBase ?? "prev");

  const [slideshowConfig, setSlideshowConfig] = useState(persistedSettings?.slideshowConfig ?? {
    tabDuration: 30, syncInterval: 5, scrollDelay: 2,
    enabledTabs: ["executive", "main", "sales", "product", "focus"],
    autoScroll: true, hideAlerts: true, hideTables: true, largeFont: true, forceDark: false,
  });

  // ---- NEW: Multi-Depo state (Sprint 18) ----
  const [depots, setDepots] = useState(() => makeInitialDepots(persistedSettings));
  const [activeDepotId, setActiveDepotId] = useState(
    () => {
      // Pilih activeDepotId dari persisted, fallback ke depots[0].id
      const persistedActiveId = persistedSettings?.activeDepotId;
      if (persistedActiveId && persistedSettings?.depots?.some((d) => d.id === persistedActiveId)) {
        return persistedActiveId;
      }
      // Fallback: depots[0].id dari initial state
      const initial = makeInitialDepots(persistedSettings);
      return initial[0]?.id || generateDepotId(DEFAULT_DEPOT_NAME);
    }
  );

  // ---- Derived: activeDepot + backward-compat fields (targets/workDays/depotName) ----
  // Memo supaya identity stabil — kalau depots/activeDepotId tidak berubah,
  // object reference tetap sama → child memo tidak re-render sia-sia.
  const activeDepot = useMemo(() => {
    return depots.find((d) => d.id === activeDepotId) || depots[0] || null;
  }, [depots, activeDepotId]);

  const targets = activeDepot?.targets ?? [];
  const workDays = activeDepot?.workDays ?? WORK_DAYS_DEFAULT;
  const depotName = activeDepot?.name ?? DEFAULT_DEPOT_NAME;

  // ---- Backward-compat setters (wrap depo mutation) ----
  // setTargets: update targets di depo aktif. Menerima nilai baru atau updater fn.
  const setTargets = useCallback((next) => {
    setDepots((prev) => prev.map((d) => {
      if (d.id !== activeDepotId) return d;
      const newTargets = typeof next === "function" ? next(d.targets) : next;
      return { ...d, targets: newTargets, updatedAt: new Date().toISOString() };
    }));
  }, [activeDepotId]);

  const setWorkDays = useCallback((next) => {
    setDepots((prev) => prev.map((d) => {
      if (d.id !== activeDepotId) return d;
      const value = typeof next === "function" ? next(d.workDays) : next;
      return { ...d, workDays: value, updatedAt: new Date().toISOString() };
    }));
  }, [activeDepotId]);

  const setDepotName = useCallback((next) => {
    setDepots((prev) => prev.map((d) => {
      if (d.id !== activeDepotId) return d;
      const value = typeof next === "function" ? next(d.name) : next;
      return { ...d, name: value, updatedAt: new Date().toISOString() };
    }));
  }, [activeDepotId]);

  // ---- NEW: Multi-depo API ----
  // setActiveDepot: ganti depo aktif. Idempotent — kalau id sama, no-op.
  const setActiveDepot = useCallback((depotId) => {
    setActiveDepotId((prev) => (prev === depotId ? prev : depotId));
  }, []);

  // addDepot: buat depo baru dari template (blank/standard/duplicate).
  // Setelah buat, auto-switch ke depo baru supaya user langsung lihat hasilnya.
  // Return depot baru supaya caller bisa ambil id (mis. untuk langsung edit).
  const addDepot = useCallback((name, code, template = "blank", sourceDepot = null) => {
    let newDepot;
    if (template === "standard") {
      newDepot = makeStandardDepot(name, code);
    } else if (template === "duplicate" && sourceDepot) {
      newDepot = duplicateDepot(sourceDepot, name, code);
    } else {
      // "blank" atau template tidak dikenal → blank.
      newDepot = makeBlankDepot(name, code);
    }
    setDepots((prev) => [...prev, newDepot]);
    setActiveDepotId(newDepot.id);
    return newDepot;
  }, []);

  // updateDepot: patch sebagian field depo (name, code, workDays).
  // Tidak untuk targets — gunakan setTargets/addSales/updateSales/deleteSales.
  const updateDepot = useCallback((depotId, patch) => {
    setDepots((prev) => prev.map((d) => {
      if (d.id !== depotId) return d;
      return { ...d, ...patch, updatedAt: new Date().toISOString() };
    }));
  }, []);

  // deleteDepot: hapus depo. Bila depo aktif dihapus, switch ke depots[0]
  // (atau buat depo blank baru bila depots kosong total — safety net).
  // Return depo aktif baru supaya caller bisa sync UI.
  const deleteDepot = useCallback((depotId) => {
    setDepots((prev) => {
      const next = prev.filter((d) => d.id !== depotId);
      // Safety: bila depots kosong total, buat depo blank baru.
      if (next.length === 0) {
        const fallback = makeBlankDepot(DEFAULT_DEPOT_NAME, DEFAULT_DEPOT_CODE);
        setActiveDepotId(fallback.id);
        return [fallback];
      }
      // Bila depo aktif yang dihapus, switch ke next[0].
      if (depotId === activeDepotId) {
        setActiveDepotId(next[0].id);
      }
      return next;
    });
  }, [activeDepotId]);

  // ---- NEW: Sales CRUD API (per-depo, langsung mutasi depots[i].targets) ----
  const addSales = useCallback((depotId, sales) => {
    setDepots((prev) => prev.map((d) => {
      if (d.id !== depotId) return d;
      return { ...d, targets: [...d.targets, sales], updatedAt: new Date().toISOString() };
    }));
  }, []);

  const updateSales = useCallback((depotId, salesCode, patch) => {
    setDepots((prev) => prev.map((d) => {
      if (d.id !== depotId) return d;
      return {
        ...d,
        targets: d.targets.map((t) => t.code === salesCode ? { ...t, ...patch } : t),
        updatedAt: new Date().toISOString(),
      };
    }));
  }, []);

  const deleteSales = useCallback((depotId, salesCode) => {
    setDepots((prev) => prev.map((d) => {
      if (d.id !== depotId) return d;
      return {
        ...d,
        targets: d.targets.filter((t) => t.code !== salesCode),
        updatedAt: new Date().toISOString(),
      };
    }));
  }, []);

  // ---- Auto-save (debounced, dirty-flag tracked) ----
  // ⚠️ Sprint 18: snapshot sekarang termasuk depots + activeDepotId.
  // Untuk backward-compat cloud sync (yang masih model v1), kita juga tulis
  // field flat targets/workDays/depotName di root level = activeDepot.values.
  // Cloud sync engine (useCloudSync, syncEngine) tetap pakai field flat itu
  // — tidak perlu diubah di sprint ini.
  const lastSavedSettingsRef = useRef(null);
  const saveSettingsTimerRef = useRef(null);
  useEffect(() => {
    // Snapshot v2: depots + activeDepotId sebagai source of truth.
    // Tambahkan field flat (targets, workDays, depotName) untuk backward-compat
    // dengan cloud sync engine yang masih model v1 (bila user sudah login).
    const flatTargets = activeDepot?.targets ?? [];
    const flatWorkDays = activeDepot?.workDays ?? WORK_DAYS_DEFAULT;
    const flatDepotName = activeDepot?.name ?? DEFAULT_DEPOT_NAME;

    const settingsSnapshot = {
      theme, powerSaveMode, filters, projectionMethod, comparisonBase,
      sidebarCollapsed, slideshowConfig,
      // Multi-depo state (Sprint 18)
      depots, activeDepotId,
      // Backward-compat flat fields (sync cloud masih pakai ini)
      targets: flatTargets, workDays: flatWorkDays, depotName: flatDepotName,
    };
    const serialized = JSON.stringify(settingsSnapshot);
    if (lastSavedSettingsRef.current === serialized) {
      if (saveSettingsTimerRef.current) {
        clearTimeout(saveSettingsTimerRef.current);
        saveSettingsTimerRef.current = null;
      }
      return;
    }
    const isFirstSave = lastSavedSettingsRef.current === null;
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
      if (saveSettingsTimerRef.current) clearTimeout(saveSettingsTimerRef.current);
      saveSettingsTimerRef.current = setTimeout(performSave, 400);
    }
    return () => {
      if (saveSettingsTimerRef.current) {
        clearTimeout(saveSettingsTimerRef.current);
        saveSettingsTimerRef.current = null;
      }
    };
  }, [theme, powerSaveMode, filters, projectionMethod, comparisonBase, sidebarCollapsed, slideshowConfig,
      depots, activeDepotId, activeDepot, persistedSettings]);

  // ---- flushPendingSettings (untuk sync) ----
  // ⚠️ Bug fix race sync-vs-autosave: syncSettingsNow membaca localStorage untuk
  // dapat updated_at lokal, tapi auto-save di atas DEBOUNCED 400ms. Kalau sync
  // trigger (fokus window balik saat modal settings tertutup) jalan sebelum
  // timer, localTs = timestamp LAMA → LWW mengira cloud lebih baru → PULL →
  // perubahan user yang belum ke-save KETIMPA nilai cloud. Fungsi ini memaksa
  // tulis pending snapshot SEKARANG (sinkron) — dipanggil di awal
  // syncSettingsNow supaya localTs selalu segar sebelum dibandingkan.
  const flushPendingSettings = useCallback(() => {
    const flatTargets = activeDepot?.targets ?? [];
    const flatWorkDays = activeDepot?.workDays ?? WORK_DAYS_DEFAULT;
    const flatDepotName = activeDepot?.name ?? DEFAULT_DEPOT_NAME;
    const settingsSnapshot = {
      theme, powerSaveMode, filters, projectionMethod, comparisonBase,
      sidebarCollapsed, slideshowConfig,
      depots, activeDepotId,
      targets: flatTargets, workDays: flatWorkDays, depotName: flatDepotName,
    };
    const serialized = JSON.stringify(settingsSnapshot);
    // Tidak ada perubahan pending — biarkan localStorage apa adanya.
    if (lastSavedSettingsRef.current === serialized) return;
    if (saveSettingsTimerRef.current) {
      clearTimeout(saveSettingsTimerRef.current);
      saveSettingsTimerRef.current = null;
    }
    saveSettings({ ...settingsSnapshot, updated_at: Date.now() });
    lastSavedSettingsRef.current = serialized;
  }, [theme, powerSaveMode, filters, projectionMethod, comparisonBase, sidebarCollapsed,
      slideshowConfig, depots, activeDepotId, activeDepot]);

  // ---- applyCloudSettings (untuk sync dari cloud) ----
  // ⚠️ Sprint 18: cloud sync engine masih model v1 — apply ke depo aktif saja.
  // Bila user multi-depo, depo lain di localStorage tidak ter-overwrite.
  // Saat cloud sync multi-depo diimplementasi (Sprint D), fungsi ini akan
  // di-replace dengan apply multi-depo proper.
  // P2-1 helper: terapkan field flat cloud ke depo aktif (fallback bila settings_full null).
  const applyFlatToActiveDepot = useCallback((doc) => {
    const nowIso = new Date().toISOString();
    setDepots((prev) => prev.map((d) => {
      if (d.id !== activeDepotId) return d;
      return {
        ...d,
        targets: doc.targets ?? d.targets,
        workDays: doc.work_days ?? d.workDays,
        name: doc.depot_name ?? d.name,
        updatedAt: nowIso,
      };
    }));
  }, [activeDepotId]);

  const applyCloudSettings = useCallback((doc, cloudTs) => {
    const ts = Number(cloudTs) || 0;
    // P2-1: settings_full (scope penuh) bila ada — terapkan semua field,
    // termasuk depots + activeDepotId. Fallback flat ke depo aktif bila null.
    const full = doc.settings_full && typeof doc.settings_full === "object" ? doc.settings_full : null;
    if (full) {
      if (full.theme) setTheme(full.theme);
      if (typeof full.powerSaveMode === "boolean") setPowerSaveMode(full.powerSaveMode);
      if (full.filters && typeof full.filters === "object") setFilters(full.filters);
      if (full.projectionMethod) setProjectionMethod(full.projectionMethod);
      if (full.comparisonBase) setComparisonBase(full.comparisonBase);
      if (typeof full.sidebarCollapsed === "boolean") setSidebarCollapsed(full.sidebarCollapsed);
      if (full.slideshowConfig && typeof full.slideshowConfig === "object") setSlideshowConfig(full.slideshowConfig);
      if (Array.isArray(full.depots) && full.depots.length > 0) {
        setDepots(full.depots);
        if (full.activeDepotId && full.depots.some((d) => d.id === full.activeDepotId)) {
          setActiveDepotId(full.activeDepotId);
        }
      } else {
        applyFlatToActiveDepot(doc);
      }
      const snapshot = {
        theme: full.theme ?? theme,
        powerSaveMode: typeof full.powerSaveMode === "boolean" ? full.powerSaveMode : powerSaveMode,
        filters: full.filters ?? filters,
        projectionMethod: full.projectionMethod ?? projectionMethod,
        comparisonBase: full.comparisonBase ?? comparisonBase,
        sidebarCollapsed: typeof full.sidebarCollapsed === "boolean" ? full.sidebarCollapsed : sidebarCollapsed,
        slideshowConfig: full.slideshowConfig ?? slideshowConfig,
        depots: Array.isArray(full.depots) && full.depots.length > 0 ? full.depots : depots,
        activeDepotId: full.activeDepotId ?? activeDepotId,
        targets: Array.isArray(full.depots) && full.depots.length > 0
          ? (full.depots.find((d) => d.id === (full.activeDepotId ?? activeDepotId))?.targets ?? activeDepot?.targets ?? [])
          : (doc.targets ?? (activeDepot?.targets ?? [])),
        workDays: Array.isArray(full.depots) && full.depots.length > 0
          ? (full.depots.find((d) => d.id === (full.activeDepotId ?? activeDepotId))?.workDays ?? activeDepot?.workDays ?? WORK_DAYS_DEFAULT)
          : (doc.work_days ?? (activeDepot?.workDays ?? WORK_DAYS_DEFAULT)),
        depotName: Array.isArray(full.depots) && full.depots.length > 0
          ? (full.depots.find((d) => d.id === (full.activeDepotId ?? activeDepotId))?.name ?? activeDepot?.name ?? DEFAULT_DEPOT_NAME)
          : (doc.depot_name ?? (activeDepot?.name ?? DEFAULT_DEPOT_NAME)),
      };
      saveSettings({ ...snapshot, updated_at: ts });
      lastSavedSettingsRef.current = JSON.stringify(snapshot);
      return;
    }
    if (doc.theme) setTheme(doc.theme);
    if (doc.projection_method) setProjectionMethod(doc.projection_method);
    if (typeof doc.sidebar_collapsed === "boolean") setSidebarCollapsed(doc.sidebar_collapsed);

    // Apply targets/workDays/depotName dari cloud ke depo aktif.
    applyFlatToActiveDepot(doc);
    const nowIso = new Date().toISOString();

    // Tulis direct ke localStorage dengan ts cloud — auto-save tidak menyentuh
    // bidang ini lagi.
    const flatTargets = doc.targets ?? (activeDepot?.targets ?? []);
    const flatWorkDays = doc.work_days ?? (activeDepot?.workDays ?? WORK_DAYS_DEFAULT);
    const flatDepotName = doc.depot_name ?? (activeDepot?.name ?? DEFAULT_DEPOT_NAME);
    const snapshot = {
      theme: doc.theme ?? theme, powerSaveMode,
      filters,
      projectionMethod: doc.projection_method ?? projectionMethod,
      comparisonBase,
      sidebarCollapsed: typeof doc.sidebar_collapsed === "boolean" ? doc.sidebar_collapsed : sidebarCollapsed,
      slideshowConfig,
      // Multi-depo state (Sprint 18)
      depots: depots.map((d) => d.id === activeDepotId
        ? { ...d, targets: flatTargets, workDays: flatWorkDays, name: flatDepotName, updatedAt: nowIso }
        : d),
      activeDepotId,
      // Backward-compat flat fields
      targets: flatTargets, workDays: flatWorkDays, depotName: flatDepotName,
    };
    saveSettings({ ...snapshot, updated_at: ts });
    lastSavedSettingsRef.current = JSON.stringify(snapshot);
  }, [activeDepotId, activeDepot, depots, filters, powerSaveMode, projectionMethod, comparisonBase, sidebarCollapsed, slideshowConfig, theme, applyFlatToActiveDepot]);

  // ---- resetAllSettings (dipakai "Clear All" di SettingsModal) ----
  // ⚠️ Sprint 18: reset depots ke single depo DEFAULT (DEFAULT_TARGETS).
  const resetAllSettings = useCallback(() => {
    setTheme("dark");
    setPowerSaveMode(false);
    setSidebarCollapsed(false);
    setFilters({ salesCodes: [], groups: [], dateFrom: "", dateTo: "", datePreset: "all" });
    setProjectionMethod("linear");
    setComparisonBase("prev");
    setSlideshowConfig({
      tabDuration: 30, syncInterval: 5, scrollDelay: 2,
      enabledTabs: ["executive", "main", "sales", "product", "focus"],
      autoScroll: true, hideAlerts: true, hideTables: true, largeFont: true, forceDark: false,
    });
    // Reset depots ke single DEFAULT_DEPOT (DEFAULT_TARGETS).
    const now = new Date().toISOString();
    const defaultDepotId = generateDepotId(DEFAULT_DEPOT_NAME);
    const defaultDepots = [{
      id: defaultDepotId,
      name: DEFAULT_DEPOT_NAME,
      code: DEFAULT_DEPOT_CODE,
      workDays: WORK_DAYS_DEFAULT,
      targets: DEFAULT_TARGETS,
      createdAt: now,
      updatedAt: now,
    }];
    setDepots(defaultDepots);
    setActiveDepotId(defaultDepotId);
    clearSettings();
    // Reset ref + tulis localStorage dengan updated_at=0 (sync LWW PULL bukan PUSH).
    lastSavedSettingsRef.current = null;
    saveSettingsTimerRef.current = null;
    const flatSnapshot = {
      theme: "dark", powerSaveMode: false,
      filters: { salesCodes: [], groups: [], dateFrom: "", dateTo: "", datePreset: "all" },
      depots: defaultDepots,
      activeDepotId: defaultDepotId,
      targets: DEFAULT_TARGETS, workDays: WORK_DAYS_DEFAULT, depotName: DEFAULT_DEPOT_NAME,
      projectionMethod: "linear", comparisonBase: "prev",
      sidebarCollapsed: false,
      slideshowConfig: {
        tabDuration: 30, syncInterval: 5, scrollDelay: 2,
        enabledTabs: ["executive", "main", "sales", "product", "focus"],
        autoScroll: true, hideAlerts: true, hideTables: true, largeFont: true, forceDark: false,
      },
      updated_at: 0,
    };
    saveSettings(flatSnapshot);
    lastSavedSettingsRef.current = JSON.stringify({
      theme: "dark", powerSaveMode: false,
      filters: { salesCodes: [], groups: [], dateFrom: "", dateTo: "", datePreset: "all" },
      depots: defaultDepots, activeDepotId: defaultDepotId,
      targets: DEFAULT_TARGETS, workDays: WORK_DAYS_DEFAULT, depotName: DEFAULT_DEPOT_NAME,
      projectionMethod: "linear", comparisonBase: "prev",
      sidebarCollapsed: false,
      slideshowConfig: {
        tabDuration: 30, syncInterval: 5, scrollDelay: 2,
        enabledTabs: ["executive", "main", "sales", "product", "focus"],
        autoScroll: true, hideAlerts: true, hideTables: true, largeFont: true, forceDark: false,
      },
    });
  }, []);

  return {
    persistedSettings,
    // Global settings
    theme, setTheme,
    powerSaveMode, setPowerSaveMode,
    sidebarCollapsed, setSidebarCollapsed,
    filters, setFilters,
    projectionMethod, setProjectionMethod,
    comparisonBase, setComparisonBase,
    slideshowConfig, setSlideshowConfig,
    // ⚠️ Sprint 18: Backward-compat — derived dari activeDepot
    targets, setTargets,
    workDays, setWorkDays,
    depotName, setDepotName,
    // ⚠️ Sprint 18: Multi-depo API (BARU)
    depots,
    activeDepotId,
    activeDepot,
    setActiveDepot,
    addDepot,
    updateDepot,
    deleteDepot,
    addSales,
    updateSales,
    deleteSales,
    // Reset & sync helpers
    resetAllSettings,
    applyCloudSettings,
    flushPendingSettings,
  };
}
