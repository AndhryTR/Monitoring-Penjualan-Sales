import React, { useState, useMemo, useCallback, useEffect, useRef } from "react";
import {
  Search, Sparkles,
  FileSpreadsheet, AlertTriangle, Monitor,
} from "lucide-react";
import { saveSession, loadSession, clearSession, saveHistory, loadHistory, clearHistory, clearCompareState, saveMasterMax, saveLastMasterSyncAt } from "./utils/storage.js";
import { supabase, getSession, onAuthChange, signOutAccount } from "./utils/cloud.js";
// ⚠️ Sprint 6 / R6: syncEngine imports (fetchRole, pushSettings, dll) sekarang
// dipakai di hook useCloudSync.js. SalesMonitoringApp hanya butuh fetchRole
// untuk refreshRole callback.
import { fetchRole } from "./utils/syncEngine.js";
import { notifyError } from "./utils/notifyExport.js";
import {
  dedupeRows,
} from "./utils/excelParse.js";
import { useExcelParseWorker } from "./hooks/useExcelParseWorker.js";
import {
  computeAggregates, detectMonths, monthKey, getOutletBreakdown, getProductBreakdownForOutlet, getProductBreakdownForGroup,
} from "./utils/aggregation.js";
import { useAggregatesWorker } from "./hooks/useAggregatesWorker.js";
import { useDataQualityNotes } from "./utils/dataQuality.js";
import { buildHistorySnapshot, computeComparison, computeMultiPeriodComparison } from "./utils/history.js";
import { generateSampleRows } from "./utils/sampleData.js";
import { ALIASES } from "./constants/aliases.js";
import { TABS } from "./constants/tabs.js";
import { Sidebar } from "./components/layout/Sidebar.jsx";
import { HISTORY_MAX_ENTRIES } from "./constants/thresholds.js";
// ⚠️ Sprint 6 / R4: WORK_DAYS_DEFAULT dan DEFAULT_TARGETS sekarang dipakai di
// hook useSettings.js, bukan di SalesMonitoringApp.jsx. Hapus import di sini.
// ⚠️ Sprint 6 / R4: settings state + auto-save dipindah ke hook useSettings.js.
import { useSettings } from "./hooks/useSettings.js";
// Modul virtual dari vite-plugin-pwa — hanya ada saat plugin ini terpasang &
// dijalankan lewat Vite (dev atau build), bukan package npm biasa.
// ⚠️ Sprint 6 / R5: useRegisterSW dipakai di hook usePwaInstall.js sekarang.
import { usePwaInstall } from "./hooks/usePwaInstall.js";
import { PwaBanners } from "./components/pwa/PwaBanners.jsx";
// ⚠️ Sprint 6 / R6: cloud sync (settings LWW + master data) dipindah ke hook.
import { useCloudSync } from "./hooks/useCloudSync.js";
// ⚠️ Sprint 9 / GS1: global search / command palette hook.
import { useGlobalSearch } from "./hooks/useGlobalSearch.js";
// ⚠️ Sprint 10 / OB1: Onboarding welcome screen untuk first-time users.
import { OnboardingWelcome } from "./components/OnboardingWelcome.jsx";
// ⚠️ Sprint 17 / SS1+SS2: Slideshow mode untuk display monitor.
import { useSlideshow } from "./hooks/useSlideshow.js";
import { AppLogo } from "./components/ui/AppLogo.jsx";
import { useScrollDirection } from "./hooks/useScrollDirection.js";
// ⚠️ Sprint 19 / Stock Module
import { useStock } from "./hooks/useStock.js";
import { useAiContext } from "./hooks/useAiContext.js";
// ⚠️ Superuser Admin Dashboard: permissions engine
import { usePermissions } from "./hooks/usePermissions.js";
import { useWhatsNew } from "./hooks/useWhatsNew.js";
import { FilterBar } from "./components/ui/FilterBar.jsx";
import { DashboardSkeleton } from "./components/ui/DashboardSkeleton.jsx";
import { UploadDropzone } from "./components/upload/UploadDropzone.jsx";
import { MobileBottomNav } from "./components/upload/MobileBottomNav.jsx";
import { MobileFab } from "./components/upload/MobileFab.jsx";
import { ExportMenu } from "./components/upload/ExportMenu.jsx";
import { GlobalDragOverlay } from "./components/upload/GlobalDragOverlay.jsx";
import { useWindowDragDrop } from "./hooks/useWindowDragDrop.js";
// ⚠️ Sprint 18 / Header Redesign: AvatarButton untuk header baru
import { AvatarButton } from "./components/ui/AvatarButton.jsx";
import { MobileHeaderMenu } from "./components/ui/MobileHeaderMenu.jsx";
import { NotificationBell } from "./components/ui/NotificationBell.jsx";
import { ThemeToggle } from "./components/ui/ThemeToggle.jsx";
import { useSmartAlertsWorker } from "./hooks/useSmartAlertsWorker.js";
import { UploadLoading } from "./components/ui/UploadLoading.jsx";
import { AccessRestricted } from "./components/ui/index.jsx";
import { TrendPeriodePage } from "./components/trend/index.jsx";
import { DataQualityPage } from "./pages/DataQualityPage.jsx";
import { lazy, Suspense } from "react";
// ⚠️ Lazy-load per halaman (code splitting): tiap page di-mount per tab, di-load
// async saat pertama dibuka. Menghilangkan freeze ganti tab (chunk dari cache
// setelah pertama), memperkecil bundle initial, dan memungkinkan fallback
// skeleton via Suspense. Halaman yang kecil/jarang tetap eager.
const MainReportPage = lazy(() => import("./pages/MainReportPage.jsx").then(m => ({ default: m.MainReportPage })));
const ExecutiveSummaryPage = lazy(() => import("./pages/ExecutiveSummaryPage.jsx").then(m => ({ default: m.ExecutiveSummaryPage })));
const SalesReportPage = lazy(() => import("./pages/SalesReportPage.jsx").then(m => ({ default: m.SalesReportPage })));
const ProductReportPage = lazy(() => import("./pages/ProductReportPage.jsx").then(m => ({ default: m.ProductReportPage })));
const ProductFocusReportPage = lazy(() => import("./pages/ProductFocusReportPage.jsx").then(m => ({ default: m.ProductFocusReportPage })));
const OutletAnalysisPage = lazy(() => import("./pages/OutletAnalysisPage.jsx").then(m => ({ default: m.OutletAnalysisPage })));
const ComparisonPage = lazy(() => import("./pages/ComparisonPage.jsx").then(m => ({ default: m.ComparisonPage })));
const TransactionsPage = lazy(() => import("./pages/TransactionsPage.jsx").then(m => ({ default: m.TransactionsPage })));
const StockPage = lazy(() => import("./pages/StockPage.jsx").then(m => ({ default: m.StockPage })));
// ⚠️ Superuser Admin Dashboard: lazy-loaded, hanya dibuka saat isSuperuser
const SuperuserAdminPage = lazy(() => import("./pages/SuperuserAdminPage.jsx").then(m => ({ default: m.SuperuserAdminPage })));
// Modals & Drawers lazy loaded (Fase 2 code splitting)
const LoginModal = lazy(() => import("./components/LoginModal.jsx").then(m => ({ default: m.LoginModal })));
const GlobalSearch = lazy(() => import("./components/GlobalSearch.jsx").then(m => ({ default: m.GlobalSearch })));
const SlideshowMode = lazy(() => import("./components/SlideshowMode.jsx").then(m => ({ default: m.SlideshowMode })));
const StockImportPreview = lazy(() => import("./components/modals/StockImportPreview.jsx").then(m => ({ default: m.StockImportPreview })));
const GroupFocusDrilldownModal = lazy(() => import("./components/modals/GroupFocusDrilldownModal.jsx").then(m => ({ default: m.GroupFocusDrilldownModal })));
const OutletDrilldownModal = lazy(() => import("./components/modals/OutletDrilldownModal.jsx").then(m => ({ default: m.OutletDrilldownModal })));
const OutletDetailModal = lazy(() => import("./components/modals/OutletDetailModal.jsx").then(m => ({ default: m.OutletDetailModal })));
const DataPreviewModal = lazy(() => import("./components/modals/DataPreviewModal.jsx").then(m => ({ default: m.DataPreviewModal })));
const HistoryModal = lazy(() => import("./components/modals/HistoryModal.jsx").then(m => ({ default: m.HistoryModal })));
const SettingsModal = lazy(() => import("./components/modals/SettingsModal.jsx").then(m => ({ default: m.SettingsModal })));
const AboutModal = lazy(() => import("./components/modals/AboutModal.jsx").then(m => ({ default: m.AboutModal })));
const WhatsNewModal = lazy(() => import("./components/modals/WhatsNewModal.jsx").then(m => ({ default: m.WhatsNewModal })));
const RangeDeleteModal = lazy(() => import("./components/modals/RangeDeleteModal.jsx").then(m => ({ default: m.RangeDeleteModal })));
const DailyReportModal = lazy(() => import("./components/modals/DailyReportModal.jsx").then(m => ({ default: m.DailyReportModal })));
const AiChatDrawer = lazy(() => import("./components/ai/AiChatDrawer.jsx").then(m => ({ default: m.AiChatDrawer })));
import { ToastHost } from "./components/ui/ToastHost.jsx";

/* ============================================================================
   DESIGN TOKENS
   Ink navy surface, gold = on-pace, coral = behind pace, mint = growth,
   violet = focus-product accent. Display: Space Grotesk, Body: Inter,
   Data/mono: JetBrains Mono.
============================================================================ */
import { THEMES, applyPowerSaveColors, applyTauriScrimColors } from "./constants/colors.js";
// ⚠️ Sprint 6 / R3: createGlobalStyle dipindah dari inline (130+ baris CSS)
// ke file sendiri supaya SalesMonitoringApp.jsx lebih ramping.
import { createGlobalStyle } from "./styles/globalStyle.js";

/* ============================ RangeDeleteModal (admin) ============================
   ⚠️ Sprint 6 / R1: komponen ini sekarang di-import dari
   components/modals/RangeDeleteModal.jsx (sebelumnya inline ~65 baris di sini).
   God component refactor — SalesMonitoringApp.jsx fokus jadi orchestrator.
============================================================================ */
// ⚠️ Sprint 6 / R2: loadMasterMax/saveMasterMax dipindah ke utils/storage.js
// (sebelumnya inline ~3 baris di sini). Import di atas file.
// ⚠️ Sprint 6 / R3: createGlobalStyle dipindah ke styles/globalStyle.js
// (sebelumnya inline ~130 baris CSS template di sini). Import di atas file.


/* ============================================================================
   UPLOAD / EXPORT
============================================================================ */

export default function SalesMonitoringApp() {
  // ---- Settings state (theme, filters, targets, etc.) — auto-save debounced ----
  // ⚠️ Sprint 6 / R4: dipindah ke hook useSettings.js (sebelumnya inline
  // ~100 baris state + auto-save effect di sini). Hook mengelola persistensi
  // ke localStorage dengan dirty-flag tracking (Sprint 1) + debounce 400ms
  // (Sprint 2 / H7) supaya edit target di SettingsModal tidak lag.
  const {
    theme, setTheme,
    powerSaveMode, setPowerSaveMode,
    sidebarCollapsed, setSidebarCollapsed,
    filters, setFilters,
    workDays, setWorkDays,
    targets, setTargets,
    depotName, setDepotName,
    projectionMethod, setProjectionMethod,
    comparisonBase, setComparisonBase,
    slideshowConfig, setSlideshowConfig,
    // Multi-Depo: state + setters dari useSettings
    depots, activeDepotId,
    setActiveDepot, addDepot, deleteDepot,
    resetAllSettings,
    applyCloudSettings,
    flushPendingSettings,
  } = useSettings();

  const [rawRows, setRawRows] = useState([]);
  const [fileName, setFileName] = useState("");
  const [loading, setLoading] = useState(false);
  const [sampleLoading, setSampleLoading] = useState(false);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("executive");
  const [tabLoading, setTabLoading] = useState(false);
  const tabFrameRef = useRef(null);
  // ⚠️ Sticky-hide header mobile: header disembunyikan saat scroll ke bawah,
  // muncul lagi saat scroll ke atas. Desktop header selalu tampil.
  const { hidden: headerHidden } = useScrollDirection();
  // ⚠️ Sprint 5 / Worker: parse Excel production-safe di Web Worker; Vite
  // membundle worker + xlsx browser build sebagai asset terpisah.
  const { parseFiles, progress: uploadProgress } = useExcelParseWorker();

  // Registry export per tab: tab dengan state lokal (Comparison, Trend, Transaksi)
  // mendaftarkan handler export ke header agar menu Export selalu context-aware.
  // Disimpan dalam ref stabil tanpa setState agar tidak memicu re-render loop.
  const tabExportsRef = useRef({});
  const registerTabExport = useCallback((tab, handlers) => {
    tabExportsRef.current[tab] = handlers;
  }, []);
  const unregisterTabExport = useCallback((tab) => {
    delete tabExportsRef.current[tab];
  }, []);

  // Tampilkan skeleton sebelum page baru di-mount. Satu frame pertama memberi
  // browser kesempatan paint skeleton; frame berikutnya baru mengganti tab.
  const goToTab = useCallback((tab) => {
    if (!tab || tab === activeTab) return;
    if (tabFrameRef.current) cancelAnimationFrame(tabFrameRef.current);
    setTabLoading(true);
    tabFrameRef.current = requestAnimationFrame(() => {
      tabFrameRef.current = null;
      setActiveTab(tab);
    });
  }, [activeTab]);

  useEffect(() => () => {
    if (tabFrameRef.current) cancelAnimationFrame(tabFrameRef.current);
  }, []);

  useEffect(() => {
    if (!tabLoading) return undefined;
    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => setTabLoading(false));
    });
    return () => cancelAnimationFrame(frame);
  }, [activeTab, tabLoading]);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isAboutOpen, setIsAboutOpen] = useState(false);
  const {
    isOpen: isWhatsNewOpen,
    open: openWhatsNew,
    close: closeWhatsNew,
    currentVersion,
    hasUnread: hasUnreadWhatsNew,
  } = useWhatsNew();
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isDailyReportOpen, setIsDailyReportOpen] = useState(false);
  const [isAiChatOpen, setIsAiChatOpen] = useState(false);
  const [drilldown, setDrilldown] = useState(null);
  const [pendingPreview, setPendingPreview] = useState(null);
  const [parseMeta, setParseMeta] = useState(null);
  const [history, setHistory] = useState(() => loadHistory());
  const [comparisonSnapshot, setComparisonSnapshot] = useState(null);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  // ID snapshot riwayat yang dipilih untuk tab "Tren Periode" (2+ periode
  // sekaligus) — beda dari comparisonSnapshot di atas yang cuma 1-vs-1 untuk
  // card "Bandingkan Periode" di Main Report. Sengaja tidak dipersist ke
  // localStorage: dipilih ulang tiap sesi, konsisten dengan sifatnya yang
  // sementara/eksploratif.
  const [trendSnapshotIds, setTrendSnapshotIds] = useState([]);

  /* ============================ AKUN & SINKRONISASI ============================ */
  const [sessionUser, setSessionUser] = useState(null);
  const [userRole, setUserRole] = useState(null); // 'admin'|'supervisor'|'user'|null
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  // ⚠️ Sprint 14 / H15: settingsSyncState/Msg/lastSettingsSyncAt (otomatis) &
  // masterSyncState/Msg/lastMasterSyncAt (manual) dari useCloudSync hook.
  const isAuthedRef = useRef(false);

  // ⚠️ Superuser Admin Dashboard: permissions engine
  const permissions = usePermissions({ userRole, sessionUser });
  const { canAccess, isSuperuser } = permissions;

  const isEditor = userRole === "admin" || userRole === "supervisor" || userRole === "superuser";

  // Deteksi runtime Tauri (desktop exe) — dipakai class `is-tauri` di root
  // untuk CSS Mica-transparency: latar app transparan supaya material Mica
  // Windows 11 (di belakang WebView) terlihat. Browser/PWA tidak berubah.
  const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

  // Keluar dari akun — didefinisikan SETELAH useCloudSync (butuh setLastMasterSyncAt).
  // Muat role user saat login (dari tabel profiles).
  const refreshRole = useCallback(async () => {
    if (!supabase || !isAuthedRef.current) return;
    const role = await fetchRole();
    setUserRole(role);
  }, []);

  // ---- Cloud sync (settings LWW otomatis + master data manual) ----
  // ⚠️ Sprint 14 / H15: dipisah jadi dua alur — settings (otomatis: login,
  // perubahan, fokus) vs master (tombol manual). Hook mengelola:
  // - settingsSyncState/Msg/lastSettingsSyncAt (UI feedback, otomatis)
  // - masterSyncState/Msg/lastMasterSyncAt (UI feedback, tombol manual)
  // - masterAction/masterBusy/masterResult (admin modal state)
  // - handleSaveMaster, handleDeleteRange (admin actions)
  // - settingsSyncNowRef (dipanggil saat login sukses), syncMasterNow (tombol)
  const {
    settingsSyncState, setSettingsSyncState,
    settingsSyncMsg,
    lastSettingsSyncAt,
    settingsSyncNowRef,
    masterSyncState,
    masterSyncMsg,
    lastMasterSyncAt, setLastMasterSyncAt,
    syncMasterNow,
    masterAction, setMasterAction,
    masterBusy,
    masterResult,
    handleSaveMaster,
    handleDeleteRange,
  } = useCloudSync({
    isAuthedRef,
    isEditor,
    settingsGetters: {
      targets, workDays, depotName, theme, projectionMethod, sidebarCollapsed,
      // P2-1: field penuh ikut sync
      powerSaveMode, filters, comparisonBase, slideshowConfig, depots, activeDepotId,
    },
    settingsSetters: {
      setTargets, setWorkDays, setDepotName, setTheme, setProjectionMethod, setSidebarCollapsed,
      // P2-1: setter penuh untuk fallback bila settings_full null
      setPowerSaveMode, setFilters, setComparisonBase, setSlideshowConfig,
    },
    settingsApplier: applyCloudSettings,
    flushPendingSettings,
    dataState: { rawRows, parseMeta, setRawRows, setFileName, setParseMeta },
  });

  // Keluar dari akun — state app TIDAK diubah (data lokal tetap utuh).
  // ⚠️ Bug fix (audit #9): reset marker sync master saat logout. masterMax &
  // lastMasterSyncAt itu device-wide, bukan per-akun — kalau dibiarkan, user
  // lain yang login di device ini dapat app mengira master sudah pernah
  // disinkronkan dan cuma menarik DELTA (date > maxDate lama). Kalau master
  // cloud berubah/berkurang di rentang lama, data basi bertahan & baris yang
  // hilang tidak akan pernah ter-download. Sama alasan dengan handleReset.
  const handleLogout = useCallback(async () => {
    await signOutAccount();
    saveMasterMax("");
    saveLastMasterSyncAt(0);
    setLastMasterSyncAt(0);
    setIsLoginOpen(false);
    setUserRole(null);
  }, [setLastMasterSyncAt]);

  // Muat data sesi terakhir (hasil upload/demo sebelumnya) dari IndexedDB saat
  // pertama aplikasi dibuka. Async, ditampilkan status loading singkat dulu.
  //
  // ⚠️ Bug fix (H2): sebelumnya async IIFE TANPA try/catch. Bila `loadSession`
  // melempar (IndexedDB diblokir di private mode, atau `indexedDB.open` throw
  // synchronously), promise reject tanpa handler, dan `setSessionLoading(false)`
  // tak pernah tercapai → dashboard stuck di `DashboardSkeleton` selamanya.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const session = await loadSession();
        if (!cancelled && session) {
          setRawRows(session.rawRows || []);
          setFileName(session.fileName || "");
          setParseMeta(session.parseMeta || null);
        }
      } catch (e) {
        // Gagal load sesi IndexedDB — bukan crash fatal, lanjutkan dengan state
        // kosong. User bisa upload ulang atau pakai sample data.
        console.warn("Gagal memuat sesi tersimpan:", e);
      } finally {
        if (!cancelled) setSessionLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Simpan otomatis data transaksi ke IndexedDB tiap kali berubah.
  useEffect(() => {
    if (rawRows.length) saveSession({ rawRows, fileName, parseMeta });
  }, [rawRows, fileName, parseMeta]);

  // Inisialisasi sesi + pasang listener auth + muat role.
  //
  // ⚠️ Bug fix (H2): sebelumnya async IIFE TANPA try/catch. Bila `getSession`
  // atau `fetchRole` melempar (Supabase error, network, token expired), promise
  // reject tanpa handler dan `setSessionLoading(false)` / role assignment tak
  // pernah terjadi → dashboard stuck di skeleton dengan tidak ada pesan error.
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const sess = await getSession();
        if (!alive) return;
        if (sess) {
          isAuthedRef.current = true;
          setSessionUser(sess.user);
          const role = await fetchRole();
          if (alive) setUserRole(role);
          // ⚠️ Sprint 14 / H15: sync settings otomatis saat login (bukan
          // sinkronisasi manual). Master data TIDAK otomatis — via tombol.
          if (alive) settingsSyncNowRef.current?.();
        } else {
          if (alive) setSettingsSyncState("idle");
        }
      } catch (e) {
        // Gagal ambil sesi/role — bukan crash fatal. App tetap jalan dalam mode
        // "non-authenticated" (read-only tanpa sync). Log untuk debugging.
        console.warn("Gagal memuat sesi/role awal:", e);
        if (alive) setSettingsSyncState("idle");
      }
    })();

    const unsub = onAuthChange((session) => {
      if (!alive) return;
      if (session) {
        isAuthedRef.current = true;
        setSessionUser(session.user);
        refreshRole();
        // ⚠️ Sprint 14 / H15: sync settings otomatis saat login.
        settingsSyncNowRef.current?.();
      } else {
        isAuthedRef.current = false;
        setSessionUser(null);
        setUserRole(null);
        setSettingsSyncState("idle");
      }
    });

    return () => { alive = false; unsub(); };
  }, [refreshRole, setSettingsSyncState, settingsSyncNowRef]);

  /* --------------------------- PWA: instal & update --------------------------- */

  // ---- PWA: install prompt + service worker update ----
  // ⚠️ Sprint 6 / R5: dipindah ke hook usePwaInstall.js (sebelumnya inline
  // ~60 baris state + effects + handlers di sini).
  const {
    needRefresh, setNeedRefresh,
    offlineReady, setOfflineReady,
    updateServiceWorker,
    showIosInstallHint, setShowIosInstallHint,
    handleInstallClick,
    canShowInstallButton,
  } = usePwaInstall();

  const colors = useMemo(() => {
    const base = THEMES[theme];
    const themed = powerSaveMode ? applyPowerSaveColors(base) : base;
    // ⚠️ Tauri desktop (Acrylic): scrim hybrid — naikkan alpha token glass
    // supaya header/dropdown kontras tanpa backdrop-filter (blur CSS tidak bisa
    // memblur layer native Acrylic di belakang webview).
    return isTauri ? applyTauriScrimColors(themed) : themed;
  }, [theme, powerSaveMode, isTauri]);
  // ⚠️ Sprint 17h / bugfix: effective colors untuk slideshow saat forceDark.
  // Kalau user centang "Dark mode paksa" di Settings, slideshow (chrome +
  // konten page) harus selalu dark walau app lagi pakai light theme.
  // effectiveSlideshowColors dipakai baik di SlideshowMode chrome maupun di
  // renderPage() supaya konsisten (sebelumnya hanya chrome yg di-override,
  // konten masih pakai theme aktif → light mode "bocor" di slideshow).
  const effectiveSlideshowColors = useMemo(() => {
    if (!slideshowConfig?.forceDark) return colors;
    return { ...colors, ...THEMES.dark };
  }, [colors, slideshowConfig?.forceDark]);
  const globalStyle = useMemo(() => createGlobalStyle(colors, powerSaveMode), [colors, powerSaveMode]);

  const salesOptions = useMemo(() => targets.map((t) => ({ name: t.name, code: t.code })), [targets]);
  const aggFinal = useAggregatesWorker(rawRows, targets, filters, workDays);
  const dataQualityNotes = useDataQualityNotes(rawRows, targets, parseMeta);
  const { alerts: smartAlerts } = useSmartAlertsWorker(aggFinal, targets, workDays, dataQualityNotes);

  // ⚠️ Stock must be initialized before groupOptions so stock-only groups can
  // appear in the global filter without reading a variable in its TDZ.
  const stockData = useStock({
    depotId: activeDepotId,
    transactions: rawRows,
    daysCount: workDays || 30,
  });

  const groupOptions = useMemo(() => {
    const s = new Set();
    targets.forEach((t) => t.groups.forEach((g) => s.add(g.name)));
    rawRows.forEach((r) => r.group && s.add(r.group));
    (stockData.stockMetrics || []).forEach((p) => p.group && s.add(p.group));
    return Array.from(s).sort();
  }, [targets, rawRows, stockData.stockMetrics]);

  // ---- Global Search (Cmd+K / Ctrl+K) ----
  // ⚠️ Sprint 9 / GS1+GS3+GS4: command palette untuk search across semua data.
  const globalSearch = useGlobalSearch({ targets, rawRows, agg: aggFinal });

  // ---- AI Context (RINGKAS untuk asisten automasi via hook useAiContext) ----
  const aiContext = useAiContext({
    isAiChatOpen,
    rawRows,
    targets,
    filters,
    workDays,
    aggFinal,
    depotName,
    depots,
    stockData,
  });

  // ---- Slideshow Mode (Sprint 17 / SS1) ----
  // Auto-rotate antar tab untuk display monitor di ruang sales.
  // ⚠️ Sprint 17h / bugfix: teruskan flag autoScroll dari slideshowConfig
  // supaya checkbox "Auto-scroll halus" di Settings benar-benar berfungsi
  // (sebelumnya flag diabaikan — rAF scroll selalu jalan).
  // ⚠️ Audit #12 fix: onSync/isAuthed DIHAPUS — slideshow tidak lagi memicu
  // syncMasterNow() otomatis. Master sync murni manual via tombol (arsitektur),
  // dan auto-sync saat slideshow + admin klik "Simpan ke Master" berisiko race
  // maxDate (audit #8). Slideshow hanya display; data diperbarui manual.
  const slideshow = useSlideshow({
    enabledTabs: slideshowConfig?.enabledTabs || ["executive", "main", "sales", "product", "focus"],
    tabDuration: slideshowConfig?.tabDuration || 30,
    autoScroll: slideshowConfig?.autoScroll ?? true,
    onTabChange: goToTab,
  });

  // ⚠️ Sprint 19 / Sprint 2: state untuk StockImportPreview modal
  const [stockPreviewData, setStockPreviewData] = useState(null);
  const [stockPreviewOpen, setStockPreviewOpen] = useState(false);

  const handleStockFile = async (file) => {
    if (!file) return;
    try {
      const { parseStockExcel } = await import("./utils/stockParse.js");
      const result = await parseStockExcel(file);
      if (!result.products.length) {
        notifyError("Gagal parse file stok", result.errors[0]?.message || "Format tidak dikenali");
        return;
      }

      // Compute diff (reconciliation) if existing snapshot
      const diff = stockData.computeDiff(result);
      const isFirstUpload = !stockData.activeSnapshot;

      // Show preview modal
      setStockPreviewData({ parsedData: result, diff, isFirstUpload });
      setStockPreviewOpen(true);
    } catch (err) {
      console.error("Stock upload error:", err);
      notifyError("Gagal upload stok", err.message || String(err));
    }
  };

  const handleStockConfirm = async () => {
    if (!stockPreviewData) return;
    const { parsedData, diff } = stockPreviewData;
    setStockPreviewOpen(false);
    setStockPreviewData(null);

    const uploadResult = await stockData.uploadSnapshot(parsedData, { diff });
    if (!uploadResult.success) {
      notifyError("Gagal simpan stok", uploadResult.error || "Unknown error");
    }
  };

  // Keyboard shortcut: Cmd+K (Mac) / Ctrl+K (Windows/Linux)
  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setIsSearchOpen((v) => !v);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  // Navigation handler saat result dipilih dari global search
  const handleSearchNavigate = useCallback((item) => {
    if (!item.action) return;
    const { action } = item;
    // Switch tab
    if (action.tabKey) goToTab(action.tabKey);
    // Apply filter kalau ada
    if (action.filter) {
      setFilters((prev) => ({
        ...prev,
        ...(action.filter.salesCodes ? { salesCodes: action.filter.salesCodes } : {}),
        ...(action.filter.groups ? { groups: action.filter.groups } : {}),
      }));
    }
    // Open drilldown kalau ada (untuk outlet search)
    if (action.drilldown) {
      setDrilldown({
        title: action.drilldown.title,
        subtitle: "Outlet",
        outlets: getOutletBreakdown(aggFinal.filteredRows, action.drilldown.predicate),
      });
    }
  }, [aggFinal, setFilters, goToTab]);

  // ⚠️ Sprint 19h / Code review fix: wrap openDrilldown in useCallback supaya
  // identity stabil → child pages yang memoized tidak re-render sia-sia.
  const openDrilldown = useCallback((title, subtitle, predicate) => {
    setDrilldown({ title, subtitle, outlets: getOutletBreakdown(aggFinal.filteredRows, predicate) });
  }, [aggFinal.filteredRows]);

  // ⚠️ Sprint 19e / Focus Group Drilldown: handler untuk buka modal per-SKU
  const [groupFocusDrilldown, setGroupFocusDrilldown] = useState(null);
  const openGroupFocusDrilldown = useCallback((groupName, salesName, predicate) => {
    const products = getProductBreakdownForGroup(aggFinal.filteredRows, predicate);
    // Find the focus group row for summary
    const groupRow = aggFinal.focusGroupRows?.find(
      (r) => r.name === groupName && r.salesName === salesName
    );
    setGroupFocusDrilldown({
      title: `Grup Fokus: ${groupName}`,
      subtitle: salesName,
      products,
      groupSummary: groupRow || null,
    });
  }, [aggFinal]);

  // Detail SKU untuk grup produk biasa: sama seperti Grup Fokus, tetapi
  // mencakup semua sales yang berada dalam grup tersebut.
  const openProductGroupDrilldown = useCallback((groupName, predicate) => {
    const products = getProductBreakdownForGroup(aggFinal.filteredRows, predicate);
    const groupRow = aggFinal.byGroup.find((r) => r.name === groupName) || null;
    setGroupFocusDrilldown({
      title: `Grup Produk: ${groupName}`,
      subtitle: "Semua sales",
      products,
      groupSummary: groupRow,
    });
  }, [aggFinal]);

  const [outletThresholds, setOutletThresholds] = useState({ activeMaxDays: 14, dormantMinDays: 30 });
  const [outletDetail, setOutletDetail] = useState(null);
  const openOutletDetail = useCallback((outlet) => setOutletDetail(outlet), []);
  const outletDetailProducts = useMemo(
    () => outletDetail ? getProductBreakdownForOutlet(aggFinal.filteredRows, outletDetail.outletCode) : [],
    [outletDetail, aggFinal.filteredRows]
  );

  const comparison = useMemo(() => computeComparison(aggFinal, comparisonSnapshot), [aggFinal, comparisonSnapshot]);

  const trendSnapshots = useMemo(
    () => history.filter((h) => trendSnapshotIds.includes(h.id)),
    [history, trendSnapshotIds]
  );
  const trendComparisonData = useMemo(
    () => (activeTab === "trend" && trendSnapshots.length > 0)
      ? computeMultiPeriodComparison(aggFinal, trendSnapshots, filters, fileName)
      : null,
    [activeTab, aggFinal, trendSnapshots, filters, fileName]
  );

  // ---- Auto-perbandingan per-bulan (Tren Periode) ----
  // Kalau data yang di-UPLOAD (rawRows, bukan cuma yang sedang tampil setelah
  // filter tanggal) mencakup >= 2 bulan kalender berbeda, otomatis hitung
  // agregat penuh PER BULAN dan tampilkan sebagai perbandingan di Tren Periode
  // — tanpa perlu simpan snapshot manual dulu. Manual (trendSnapshots di atas)
  // tetap diprioritaskan kalau user pernah pilih lewat modal Riwayat.
  const detectedMonths = useMemo(() => detectMonths(rawRows), [rawRows]);

  // ---- Peringatan filter lintas-bulan (Lapis 2) ----
  // Target di Settings selalu berarti target UNTUK 1 BULAN. Kalau filter
  // tanggal yang sedang aktif (dateFrom..dateTo) mencakup lebih dari 1 bulan
  // kalender, maka Dashboard/Sales/Produk/Fokus/Outlet Report — yang semuanya
  // menjumlah realisasi lalu membaginya ke target itu apa adanya — akan
  // menghasilkan ACH yang tidak lagi mencerminkan "progres vs target bulanan"
  // yang sebenarnya. Ini TIDAK mengubah kalkulasi apa pun, cuma menandai
  // kondisinya supaya bisa ditampilkan sebagai peringatan di UI.
  const filterSpansMultipleMonths = useMemo(() => {
    if (!filters.dateFrom || !filters.dateTo) return false;
    return monthKey(filters.dateFrom) !== monthKey(filters.dateTo);
  }, [filters.dateFrom, filters.dateTo]);

  const autoTrendComparisonData = useMemo(() => {
    // ⚠️ Perf: hitung HANYA saat tab Tren Periode aktif
    if (activeTab !== "trend" || detectedMonths.length < 2) return null;
    // Filter Sales tetap dihormati (siapa yang ditampilkan tidak berubah
    // antar bulan), TAPI filter Grup Barang (filters.groups) SENGAJA
    // diabaikan di sini — itu mencerminkan pilihan "grup mana yang relevan
    // SEKARANG", dan kalau ikut dipakai untuk menghitung ulang bulan-bulan
    // lain, transaksi dari golongan barang yang tidak kepilih di filter
    // aktif akan tersaring habis dari bulan itu — padahal sales bisa saja
    // menjual golongan berbeda di bulan lalu. Tiap bulan historis di sini
    // SELALU mencakup SEMUA golongan barang yang benar-benar ada di bulan
    // itu, supaya realisasi & AO per bulan (dan totalnya) tetap akurat.
    // dateFrom/dateTo juga dipaksa ke batas bulan masing-masing — mengabaikan
    // filter tanggal global yang mungkin sedang aktif di tab lain (deteksi
    // ini soal DATA YANG DI-UPLOAD, bukan soal apa yang sedang difilter di
    // layar sekarang).
    const monthlyAggs = detectedMonths.map((m) =>
      computeAggregates(rawRows, targets, { salesCodes: filters.salesCodes, groups: [], dateFrom: m.dateFrom, dateTo: m.dateTo }, workDays)
    );
    const latest = detectedMonths[detectedMonths.length - 1];
    const latestAgg = monthlyAggs[monthlyAggs.length - 1];
    const earlierSnapshots = detectedMonths.slice(0, -1).map((m, i) =>
      buildHistorySnapshot(monthlyAggs[i], { dateFrom: m.dateFrom, dateTo: m.dateTo }, fileName, m.label)
    );
    return computeMultiPeriodComparison(latestAgg, earlierSnapshots, { dateFrom: latest.dateFrom, dateTo: latest.dateTo }, fileName);
  }, [activeTab, detectedMonths, rawRows, targets, filters.salesCodes, workDays, fileName]);

  // Manual (lewat modal Riwayat) selalu menang kalau pernah dipilih; kalau
  // belum, fallback ke auto-deteksi bulan (bisa null kalau cuma 1 bulan).
  const isAutoTrend = trendSnapshotIds.length === 0 && !!autoTrendComparisonData;
  const finalTrendComparisonData = trendSnapshotIds.length > 0 ? trendComparisonData : autoTrendComparisonData;

  // Dipanggil dari HistoryModal setelah user pilih 1 atau lebih snapshot.
  // 1 dipilih → isi comparisonSnapshot (perbandingan cepat di Main Report).
  // 2+ dipilih → isi trendSnapshotIds & pindah ke tab "Tren Periode".
  const applyHistorySelection = useCallback((ids) => {
    if (ids.length === 1) {
      const h = history.find((x) => x.id === ids[0]);
      setComparisonSnapshot(h || null);
      setTrendSnapshotIds([]);
    } else {
      setTrendSnapshotIds(ids);
      setComparisonSnapshot(null);
      goToTab("trend");
    }
    setIsHistoryOpen(false);
  }, [history, goToTab]);

  const saveHistorySnapshot = useCallback((label) => {
    const snap = buildHistorySnapshot(aggFinal, filters, fileName, label);
    // ⚠️ Bug fix (H3): sebelumnya `saveHistory(next)` dipanggil DI DALAM state
    // updater `setHistory(prev => ...)`. <React.StrictMode> di main.jsx
    // double-invoke updaters di dev untuk surface impurities — saveHistory
    // akan dipanggil 2× (idempotent, jadi tidak korup, tapi tetap anti-pattern
    // yang break under future React concurrent features). Sekarang: hitung
    // next di luar, panggil setHistory(next) lalu saveHistory(next) terpisah.
    setHistory((prev) => {
      const next = [snap, ...prev].slice(0, HISTORY_MAX_ENTRIES);
      // Jadwalkan side-effect di luar updater pakai microtask, supaya updater
      // tetap pure. (Tidak bisa langsung panggil saveHistory di sini.)
      queueMicrotask(() => saveHistory(next));
      return next;
    });
    setIsHistoryOpen(false);
  }, [aggFinal, filters, fileName]);

  const deleteHistorySnapshot = useCallback((id) => {
    setHistory((prev) => {
      const next = prev.filter((h) => h.id !== id);
      queueMicrotask(() => saveHistory(next));
      return next;
    });
    setComparisonSnapshot((cur) => (cur && cur.id === id ? null : cur));
    setTrendSnapshotIds((cur) => cur.filter((x) => x !== id));
  }, []);

  // Dipanggil dari SettingsModal saat import file backup — GABUNGKAN snapshot
  // dari file dengan riwayat yang sudah ada di device ini (bukan menimpa total),
  // supaya import dari device lain tidak menghapus riwayat lokal yang belum
  // sempat di-backup. Kalau ada id yang sama persis, versi dari file yang menang.
  const importHistoryMerge = useCallback((importedHistory) => {
    setHistory((prev) => {
      const byId = new Map(prev.map((h) => [h.id, h]));
      (importedHistory || []).forEach((h) => byId.set(h.id, h));
      const next = Array.from(byId.values())
        .sort((a, b) => (b.dateFrom || b.savedAt || "").localeCompare(a.dateFrom || a.savedAt || ""))
        .slice(0, HISTORY_MAX_ENTRIES); // konsisten dengan batas di saveHistorySnapshot
      queueMicrotask(() => saveHistory(next));
      return next;
    });
  }, []);


  const handleFile = useCallback(async (files) => {
    const fileList = Array.isArray(files) ? files : [files];
    setLoading(true); setError("");
    try {
      const results = await parseFiles(fileList);
      const combinedRowsRaw = results.flatMap((r) => r.rows);
      if (!combinedRowsRaw.length) {
        setError("File terbaca tapi tidak ada baris data yang cocok. Pastikan kolom sesuai format sell-out.");
        setLoading(false);
        return;
      }
      const { rows: combinedRows, duplicateCount } = dedupeRows(combinedRowsRaw);
      const detectedSet = new Set();
      results.forEach((r) => r.parseMeta.detectedFields.forEach((f) => detectedSet.add(f)));
      // Kolom dianggap benar-benar "tidak terdeteksi" hanya kalau tidak ada di SEMUA file
      // yang digabung — kalau cuma sebagian file yang tidak punya kolom itu, tetap dianggap ada.
      const missingInAll = Object.keys(ALIASES).filter((f) => results.every((r) => r.parseMeta.missingFields.includes(f)));
      const metaCounts = results.reduce(
        (acc, r) => {
          acc.totalDataRows += r.parseMeta?.totalDataRows || 0;
          acc.skippedBlankRows += r.parseMeta?.skippedBlankRows || 0;
          acc.rowsWithMissingDate += r.parseMeta?.rowsWithMissingDate || 0;
          return acc;
        },
        { totalDataRows: 0, skippedBlankRows: 0, rowsWithMissingDate: 0 }
      );
      const combinedMeta = {
        ...metaCounts,
        detectedFields: Array.from(detectedSet),
        missingFields: missingInAll,
        duplicateRowsRemoved: duplicateCount,
        sourceFiles: results.map((r, i) => ({ name: fileList[i].name, rowCount: r.rows.length })),
      };
      const combinedName = fileList.length > 1
        ? `${fileList.length} file digabung (${fileList.map((f) => f.name).join(", ")})`
        : fileList[0].name;
      // Kalau sudah ada data sebelumnya (upload sesi lalu), siapkan juga preview
      // hasil GABUNGAN (data lama + file baru, dedup bersama) — supaya modal bisa
      // menampilkan pilihan "Gabungkan" vs "Ganti semua" dengan angka yang akurat.
      //
      // ⚠️ Bug fix (H6): sebelumnya `mergePreview.mergedRows` menyimpan array
      // puluhan ribu baris hasil dedup lengkap. Memori double (di `rawRows`
      // dan state), `DataPreviewModal` re-render dengan prop raksasa → freeze
      // UI pada upload besar. Sekarang: simpan hanya summary counts; array
      // merged dihitung ulang LAZILY di `confirmPreview("merge")` saat user
      // benar-benar pilih merge. Cost: 1x dedup ekstra saat confirm (cheap
      // dibanding hold array di memori selama preview terbuka).
      let mergePreview = null;
      if (rawRows.length) {
        const merged = dedupeRows([...rawRows, ...combinedRows]);
        const mergedDateStrs = merged.rows.map((r) => r.date).filter(Boolean).sort();
        mergePreview = {
          existingRowCount: rawRows.length,
          newRowsAdded: merged.rows.length - rawRows.length,
          totalAfterMerge: merged.rows.length,
          dateFrom: mergedDateStrs[0] || "",
          dateTo: mergedDateStrs[mergedDateStrs.length - 1] || "",
          // mergedRows sengaja TIDAK disimpan — akan di-recompute di
          // confirmPreview("merge") bila user pilih merge.
        };
      }
      // Data belum langsung dipakai — tampilkan preview dulu, biar kesalahan format
      // (kolom tidak terbaca, tanggal kosong, dsb) ketahuan sebelum masuk ke dashboard.
      setPendingPreview({ rows: combinedRows, parseMeta: combinedMeta, fileName: combinedName, mergePreview });
    } catch {
      // ⚠️ Sprint 5 / S4: optional catch binding (e tidak dipakai di body).
      setError("Gagal membaca salah satu file. Pastikan semua format .xlsx/.xls valid.");
    } finally { setLoading(false); }
  }, [rawRows, parseFiles]);

  const confirmPreview = useCallback((mode) => {
    if (!pendingPreview) return;
    const merge = mode === "merge" && pendingPreview.mergePreview;
    const replaceDates = mode === "replace_dates";
    // ⚠️ Bug fix (H6): mergePreview.mergedRows sudah tidak disimpan (lihat
    // handleFile). Bila user pilih "merge", recompute dedupe di sini dengan
    // data terbaru dari rawRows (yang mungkin berubah sejak preview dibuka,
    // meskipun jarang). Ini lebih akurat dan hemat memori.
    const replacementDates = replaceDates
      ? Array.from(new Set(pendingPreview.rows.map((r) => r.date).filter(Boolean)))
      : [];
    const rows = merge
      ? dedupeRows([...rawRows, ...pendingPreview.rows]).rows
      : replaceDates
        ? [...rawRows.filter((r) => !replacementDates.includes(r.date)), ...pendingPreview.rows]
        : pendingPreview.rows;
    const name = merge
      ? `${pendingPreview.fileName} (digabung dengan data sebelumnya)`
      : replaceDates
        ? `${pendingPreview.fileName} (mengganti tanggal yang sama)`
        : pendingPreview.fileName;
    setRawRows(rows);
    setParseMeta({ ...pendingPreview.parseMeta, replaceDates: replacementDates.length ? replacementDates : undefined });
    setFileName(name);
    // Default filter tanggal setelah upload = BULAN KALENDER TERAKHIR saja
    // (bukan rentang penuh semua data yang diupload). Kalau data mencakup
    // beberapa bulan tapi filter dibiarkan mencakup semuanya, Dashboard utama
    // akan menjumlahkan realisasi banyak bulan lalu membandingkannya ke target
    // yang cuma berlaku untuk 1 bulan — ACH & deviasi jadi salah baca. Bulan-
    // bulan sebelumnya tidak hilang: tetap otomatis muncul di tab "Tren
    // Periode" lewat detectMonths()/autoTrendComparisonData yang sudah ada.
    const months = detectMonths(rows);
    if (months.length) {
      const latest = months[months.length - 1];
      setFilters(f => ({ ...f, dateFrom: latest.dateFrom, dateTo: latest.dateTo, datePreset: "thisMonth" }));
    }
    setPendingPreview(null);
  }, [pendingPreview, rawRows, setFilters]);

  const cancelPreview = useCallback(() => setPendingPreview(null), []);

  const handleSample = useCallback(() => {
    setSampleLoading(true);
    // Simulasi loading agar terasa responsif
    setTimeout(() => {
      const sampleRows = generateSampleRows();
      setRawRows(sampleRows);
      setFileName("Data Contoh (demo)");
      setParseMeta({ totalDataRows: sampleRows.length, skippedBlankRows: 0, rowsWithMissingDate: 0,
        duplicateRowsRemoved: 0, detectedFields: Object.keys(ALIASES), missingFields: [] });
      setFilters({ salesCodes: [], groups: [], dateFrom: "2026-07-01", dateTo: "2026-07-03", datePreset: "custom" });
      setSampleLoading(false);
    }, 300);
  }, [setFilters]);

  const handleReset = useCallback(() => {
    setRawRows([]); setFileName(""); setParseMeta(null);
    clearSession();
    // ⚠️ Bug fix: reset masterMax supaya sync berikutnya ambil SEMUA data cloud
    // (full pull), bukan cuma delta. Sebelumnya masterMax tidak di-reset, jadi
    // sync cuma ambil baris dengan date > maxDate lama — data cloud tidak masuk.
    saveMasterMax("");
  }, []);

  // Global drag-and-drop: mendeteksi file yang di-drag ke mana saja di layar
  const { isDragging: isWindowDragging } = useWindowDragDrop({
    onDropFiles: handleFile,
    enabled: !loading,
  });

  // Hapus TOTAL semua yang tersimpan di perangkat ini: settings (localStorage)
  // + data sesi (IndexedDB) + reset semua state ke default pabrik.
  const handleClearAll = useCallback(() => {
    // ⚠️ Sprint 6 / R4: settings reset didelegasi ke hook useSettings
    // (resetAllSettings clear localStorage + reset semua state settings).
    resetAllSettings();
    clearSession();
    clearHistory();
    clearCompareState();
    // ⚠️ Bug fix: reset masterMax juga di Clear All — sama alasan dengan handleReset.
    saveMasterMax("");
    setRawRows([]); setFileName(""); setParseMeta(null);
    setHistory([]);
    setComparisonSnapshot(null);
    setTrendSnapshotIds([]);
  }, [resetAllSettings]);

  // Optimasi performa scroll & tab tidak aktif (lihat komentar CSS
  // .sm-scrolling): tandai background mesh sebagai "harus dijeda" via ref DOM
  // langsung (bukan useState) supaya toggle ini TIDAK memicu re-render React
  // sama sekali — scroll event bisa nembak puluhan kali per detik, kalau
  // pakai setState di situ malah jadi sumber lag baru. Dua kondisi independen
  // digabung lewat 1 fungsi bersama supaya tidak saling menimpa: (1) sedang
  // scroll (+150ms debounce setelah berhenti), (2) tab browser sedang
  // disembunyikan (pindah tab/aplikasi lain — animasi bahkan tidak terlihat,
  // sayang kalau tetap jalan buang baterai/CPU).
  // .sm-powersave juga ditaruh di <body> (bukan cuma di .smapp) — beberapa
  // elemen (bottom-sheet ExportMenu di mobile) dirender lewat createPortal
  // LANGSUNG ke document.body, di LUAR pohon .smapp, jadi rule CSS
  // ".sm-powersave *" tidak akan menjangkaunya kalau class-nya cuma ada di
  // .smapp. Tanpa ini, elemen itu tetap menghitung blur (sia-sia, tidak
  // kelihatan efeknya karena background-nya sudah solid) — buang GPU percuma.
  useEffect(() => {
    document.body.classList.toggle("sm-powersave", powerSaveMode);
    return () => document.body.classList.remove("sm-powersave");
  }, [powerSaveMode]);

  const meshRef = useRef(null);
  useEffect(() => {
    let timeoutId = null;
    let isScrolling = false;
    const updatePausedClass = () => {
      if (!meshRef.current) return;
      const shouldPause = isScrolling || document.hidden;
      meshRef.current.classList.toggle("sm-scrolling", shouldPause);
    };
    const onScroll = () => {
      isScrolling = true;
      updatePausedClass();
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        isScrolling = false;
        updatePausedClass();
      }, 150);
    };
    const onVisibilityChange = () => updatePausedClass();
    window.addEventListener("scroll", onScroll, { passive: true });
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.removeEventListener("scroll", onScroll);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, []);

  // ---- Unified Tab Renderer (Fase 3 DRY) ----
  // Menyatukan logika render halaman agar tidak ada duplikasi antara Main View dan SlideshowMode.
  const renderTabPage = useCallback((tab, { pageColors = colors, isSlideshow = false } = {}) => {
    const hideTables = isSlideshow ? (slideshowConfig?.hideTables ?? true) : false;
    switch (tab) {
      case "executive":
        return <ExecutiveSummaryPage agg={aggFinal} colors={pageColors} workDays={workDays} onGroupDrilldown={openGroupFocusDrilldown} onNavigate={goToTab} stockSummary={stockData.stockSummary} />;
      case "main":
        return <MainReportPage agg={aggFinal} workDays={workDays} colors={pageColors} onDrilldown={openDrilldown} comparison={comparison} onClearComparison={() => setComparisonSnapshot(null)} projectionMethod={projectionMethod} onProjectionMethodChange={setProjectionMethod} rawRows={rawRows} filters={filters} slideshowMode={hideTables} />;
      case "sales":
        return <SalesReportPage agg={aggFinal} colors={pageColors} onDrilldown={openDrilldown} workDays={workDays} depotName={depotName} slideshowMode={hideTables} />;
      case "product":
        return <ProductReportPage agg={aggFinal} colors={pageColors} onDrilldown={openDrilldown} onGroupDrilldown={openProductGroupDrilldown} slideshowMode={hideTables} />;
      case "focus":
        return <ProductFocusReportPage agg={aggFinal} colors={pageColors} onDrilldown={openDrilldown} onGroupDrilldown={openGroupFocusDrilldown} />;
      case "outlet":
        return <OutletAnalysisPage agg={aggFinal} colors={pageColors} thresholds={outletThresholds} setThresholds={setOutletThresholds} onSelectOutlet={openOutletDetail} rawRows={rawRows} targets={targets} depotName={depotName} canAccess={canAccess} />;
      case "compare":
        return <ComparisonPage rawRows={rawRows} targets={targets} colors={pageColors} workDays={workDays} depotName={depotName} comparisonBase={comparisonBase} onBaseChange={setComparisonBase} registerTabExport={registerTabExport} unregisterTabExport={unregisterTabExport} />;
      case "transactions":
        return <TransactionsPage agg={aggFinal} colors={pageColors} onOutletDrilldown={openOutletDetail} depotName={depotName} registerTabExport={registerTabExport} unregisterTabExport={unregisterTabExport} />;
      case "quality":
        return <DataQualityPage notes={dataQualityNotes} colors={pageColors} onDrilldown={openDrilldown} />;
      case "stock":
        return (
          <StockPage
            stockData={stockData}
            colors={pageColors}
            filters={filters}
            depotName={depotName}
            registerTabExport={registerTabExport}
            unregisterTabExport={unregisterTabExport}
            onUploadStock={() => document.getElementById("stock-file-input")?.click()}
          />
        );
      case "admin-access":
        return isSuperuser ? (
          <SuperuserAdminPage
            colors={pageColors}
            userRole={userRole}
            sessionUser={sessionUser}
            canAccess={canAccess}
            permissions={permissions}
          />
        ) : (
          <AccessRestricted colors={pageColors} message="Halaman ini khusus untuk Superuser." />
        );
      case "trend":
        return (
          <TrendPeriodePage
            comparisonData={finalTrendComparisonData}
            isAutoTrend={isAutoTrend}
            colors={pageColors}
            onOpenPeriodPicker={() => setIsHistoryOpen(true)}
            selectedCount={trendSnapshotIds.length}
            depotName={depotName}
            comparisonBase={comparisonBase}
            onBaseChange={setComparisonBase}
            registerTabExport={registerTabExport}
            unregisterTabExport={unregisterTabExport}
          />
        );
      default:
        return null;
    }
  }, [
    colors, slideshowConfig?.hideTables, aggFinal, workDays, openGroupFocusDrilldown, goToTab, stockData,
    openDrilldown, comparison, projectionMethod, rawRows, filters, depotName, openProductGroupDrilldown,
    outletThresholds, openOutletDetail, targets, canAccess, comparisonBase, setComparisonBase, setProjectionMethod, registerTabExport, unregisterTabExport,
    dataQualityNotes, isSuperuser, userRole, sessionUser, permissions, finalTrendComparisonData, isAutoTrend, trendSnapshotIds.length
  ]);

  return (
    <div className={`smapp min-h-screen transition-colors duration-300 ${powerSaveMode ? "sm-powersave" : ""} ${isTauri ? "is-tauri" : ""}`}>
      <style>{globalStyle}</style>
      {!powerSaveMode && (
        <div className="sm-mesh" aria-hidden="true" ref={meshRef}>
          {colors.blobs.map((b, i) => (
            <div
              key={i}
              className={`blob blob-${i + 1}`}
              style={{ width: b.size, height: b.size, background: `rgba(${b.rgb},${b.opacity})` }}
            />
          ))}
          <div className="sm-noise" />
        </div>
      )}
      <div className="relative" style={{ zIndex: 1 }}>
      {isSettingsOpen && (
        <Suspense fallback={null}>
          <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} targets={targets} setTargets={setTargets} workDays={workDays} setWorkDays={setWorkDays} depotName={depotName} setDepotName={setDepotName} onClearAll={handleClearAll} colors={colors}
            theme={theme} setTheme={setTheme} powerSaveMode={powerSaveMode} setPowerSaveMode={setPowerSaveMode} filters={filters} setFilters={setFilters} projectionMethod={projectionMethod} setProjectionMethod={setProjectionMethod} history={history} onImportHistory={importHistoryMerge}
            slideshowConfig={slideshowConfig} setSlideshowConfig={setSlideshowConfig} onStartSlideshow={() => slideshow.start(activeTab)} />
        </Suspense>
      )}
      {isLoginOpen && (
        <Suspense fallback={null}>
          <LoginModal isOpen={isLoginOpen} onClose={() => setIsLoginOpen(false)} colors={colors} onLoginSuccess={() => {}} sessionUser={sessionUser} userRole={userRole} onLogout={handleLogout} settingsSyncState={settingsSyncState} settingsSyncMsg={settingsSyncMsg} lastSettingsSyncAt={lastSettingsSyncAt} onRetrySettings={() => { settingsSyncNowRef.current?.(); }} masterSyncState={masterSyncState} masterSyncMsg={masterSyncMsg} lastMasterSyncAt={lastMasterSyncAt} onMasterSync={syncMasterNow} />
        </Suspense>
      )}
      {isAboutOpen && (
        <Suspense fallback={null}>
          <AboutModal
            isOpen={isAboutOpen}
            onClose={() => setIsAboutOpen(false)}
            colors={colors}
            onOpenWhatsNew={openWhatsNew}
          />
        </Suspense>
      )}
      {isWhatsNewOpen && (
        <Suspense fallback={null}>
          <WhatsNewModal
            isOpen={isWhatsNewOpen}
            onClose={closeWhatsNew}
            colors={colors}
          />
        </Suspense>
      )}
      {isDailyReportOpen && (
        <Suspense fallback={null}>
          <DailyReportModal
            isOpen={isDailyReportOpen}
            onClose={() => setIsDailyReportOpen(false)}
            agg={aggFinal}
            targets={targets}
            workDays={workDays}
            depotName={depotName}
            smartAlerts={smartAlerts}
            colors={colors}
          />
        </Suspense>
      )}
      {/* ⚠️ Sprint 9 / GS2: Global Search / Command Palette (Cmd+K / Ctrl+K) */}
      {isSearchOpen && (
        <Suspense fallback={null}>
          <GlobalSearch
            isOpen={isSearchOpen}
            onClose={() => setIsSearchOpen(false)}
            onNavigate={handleSearchNavigate}
            colors={colors}
            {...globalSearch}
          />
        </Suspense>
      )}
      {/* ⚠️ Sprint 17 / SS2: Slideshow Mode overlay */}
      {slideshow.isActive && (
        <Suspense fallback={null}>
          <SlideshowMode
            {...slideshow}
            colors={effectiveSlideshowColors}
            depotName={depotName}
            aggMeta={aggFinal.meta}
            largeFont={slideshowConfig?.largeFont ?? true}
            forceDark={slideshowConfig?.forceDark ?? false}
            renderPage={(tab) => (
              <Suspense fallback={<DashboardSkeleton colors={effectiveSlideshowColors} />}>
                {renderTabPage(tab, { pageColors: effectiveSlideshowColors, isSlideshow: true })}
              </Suspense>
            )}
          />
        </Suspense>
      )}
      {/* Modal hapus rentang master data (admin) */}
      {masterAction === "range" && (
        <Suspense fallback={null}>
          <RangeDeleteModal
            colors={colors}
            onClose={() => setMasterAction(null)}
            onConfirm={handleDeleteRange}
          />
        </Suspense>
      )}
      {Boolean(drilldown) && (
        <Suspense fallback={null}>
          <OutletDrilldownModal isOpen={!!drilldown} onClose={() => setDrilldown(null)} title={drilldown?.title} subtitle={drilldown?.subtitle} outlets={drilldown?.outlets || []} colors={colors} />
        </Suspense>
      )}
      {/* ⚠️ Sprint 19e / Focus Group Drilldown: modal per-SKU untuk grup fokus */}
      {Boolean(groupFocusDrilldown) && (
        <Suspense fallback={null}>
          <GroupFocusDrilldownModal
            isOpen={!!groupFocusDrilldown}
            onClose={() => setGroupFocusDrilldown(null)}
            title={groupFocusDrilldown?.title}
            subtitle={groupFocusDrilldown?.subtitle}
            products={groupFocusDrilldown?.products || []}
            groupSummary={groupFocusDrilldown?.groupSummary}
            colors={colors}
          />
        </Suspense>
      )}
      {Boolean(outletDetail) && (
        <Suspense fallback={null}>
          <OutletDetailModal isOpen={!!outletDetail} onClose={() => setOutletDetail(null)} outlet={outletDetail} products={outletDetailProducts} colors={colors} />
        </Suspense>
      )}
      {Boolean(pendingPreview) && (
        <Suspense fallback={null}>
          <DataPreviewModal isOpen={!!pendingPreview} onCancel={cancelPreview} onConfirm={(mode) => confirmPreview(mode)} preview={pendingPreview} colors={colors} canReplaceDates={true} />
        </Suspense>
      )}
      {isHistoryOpen && (
        <Suspense fallback={null}>
          <HistoryModal isOpen={isHistoryOpen} onClose={() => setIsHistoryOpen(false)} history={history} onSave={saveHistorySnapshot} onApply={applyHistorySelection}
            onDelete={deleteHistorySnapshot}
            defaultLabel={filters.dateFrom && filters.dateTo ? `${filters.dateFrom} — ${filters.dateTo}` : ""} colors={colors} />
        </Suspense>
      )}
      <MobileFab onFile={handleFile} colors={colors} loading={loading} />
      {/* ⚠️ Overlay loading saat parsing file Excel (upload) */}
      {loading && <UploadLoading colors={colors} fileName={fileName} progress={uploadProgress} />}
      {/* ⚠️ Overlay global drag-and-drop file Excel */}
      <GlobalDragOverlay isDragging={isWindowDragging} colors={colors} />
      <MobileBottomNav tabs={TABS.filter(t => canAccess("page:" + t.key))} activeTab={activeTab} onChange={goToTab} colors={colors} />

      {/* ⚠️ Toast Host — umpan balik export (selalu tampil). */}
      <ToastHost colors={colors} />

      {/* ⚠️ Panel Asisten AI Automasi (Task 5) */}
      {isAiChatOpen && (!canAccess || canAccess("feat:ai_chat")) && (
        <Suspense fallback={null}>
          <AiChatDrawer
            isOpen={isAiChatOpen}
            onClose={() => setIsAiChatOpen(false)}
            colors={colors}
            canAccess={canAccess}
            aiContext={aiContext}
            deps={{
              setTargets,
              getTargets: () => targets,
              getActiveRows: () => rawRows,
              getRawRows: () => rawRows,
              goToTab,
              setFilters,
              getFilters: () => filters,
              getStockData: () => ({
                stockMetrics: stockData.stockMetrics,
                stockSummary: stockData.stockSummary,
                currentStock: stockData.currentStock,
              }),
              saveStoredSchedule: async (depot, schedule) => {
                const mod = await import("./utils/visitScheduleStorage.js");
                mod.saveStoredSchedule(depot, schedule);
              },
              deleteActiveRows: async () => {
                handleReset();
              },
            }}
            notifyError={notifyError}
          />
        </Suspense>
      )}

      {/* ⚠️ Sprint 18d / Header Redesign: layout root kembali ke pola lama
          (Sidebar di kiri sejajar Header+Content di kanan) — user prefer ini.
          Header tetap pakai glass card dengan 3 grup + search prominent. */}
      <div className="flex items-start">

        {/* ===== SIDEBAR (desktop, kiri) ===== */}
        <Sidebar activeTab={activeTab} onChangeTab={goToTab} collapsed={sidebarCollapsed} onToggleCollapse={() => setSidebarCollapsed((v) => !v)}
          onOpenHistory={() => setIsHistoryOpen(true)} onOpenSettings={() => setIsSettingsOpen(true)} historyDisabled={!rawRows.length} colors={colors}
          // ⚠️ Sprint 18 / Multi-Depo: pass depo state + setters ke Sidebar
          depots={depots} activeDepotId={activeDepotId}
          onSelectDepot={setActiveDepot} onAddDepot={addDepot} onDeleteDepot={deleteDepot}
          // ⚠️ Superuser Admin Dashboard: permission props
          isSuperuser={isSuperuser} canAccess={canAccess} />

        {/* ===== MAIN AREA (kanan: header + content) ===== */}
        <div className="flex-1 min-w-0">
      <div className="max-w-7xl mx-auto px-4 md:px-8 py-4 md:py-6 pb-24 md:pb-6">

        {/* ===== HEADER (glass card, di kolom kanan sidebar) ===== */}
        <div
          className="sm-card sm-fadeup sticky top-2 z-40 mb-4"
          style={{
            padding: "10px 12px",
            transition: "transform .32s cubic-bezier(.16,1,.3,1), opacity .32s ease",
            transform: headerHidden ? "translateY(-130%)" : "translateY(0)",
            opacity: headerHidden ? 0 : 1,
            pointerEvents: headerHidden ? "none" : "auto",
          }}
        >
          {/* ⚠️ Sprint 18d9 / Responsive fix (revised per user feedback):
              Desktop: brand di kiri, search + actions di grup kanan (justify-between)
              Mobile: brand + actions sejajar di baris atas (manfaatkan space kosong),
                      search bar pindah ke baris bawah sendiri (full-width).
              Sebelumnya mobile: brand sendirian di atas, actions pindah ke baris
              bawah → space kanan brand kosong sia-sia. Sekarang brand+actions
              1 baris, search saja yang turun. */}
          <div className="flex items-center justify-between gap-2 md:gap-3">

            {/* Blok kiri: Brand — selalu di kiri */}
            <div className="flex items-center gap-2.5 shrink-0">
              <div className="p-1 rounded-xl shrink-0 flex items-center justify-center shadow-sm" style={{ background: colors.glassFill, border: `1px solid ${colors.glassBorder}` }}>
                <AppLogo size={24} />
              </div>
              <div className="min-w-0 block sm:block">
                <h1 className="disp text-sm font-bold truncate tracking-tight" style={{ color: colors.text }}>Monitoring Penjualan</h1>
                <p className="text-[10px] leading-tight hidden sm:block" style={{ color: colors.textMuted }}>Dashboard sales & produk</p>
              </div>
            </div>

            {/* Blok kanan: Search (desktop only) + Actions — grup kanan
                Di mobile, search bar disembunyikan dari sini (akan muncul di
                baris bawah sebagai full-width). Actions tetap di baris atas
                sejajar dengan brand supaya space kanan tidak kosong. */}
            {/* Blok kanan: Search (desktop only) + Actions — grup kanan */}
            <div className="flex items-center gap-2 md:gap-2.5 shrink-0">

              {/* 1. Bilah Pencarian Global (Desktop Only) */}
              {(!canAccess || canAccess("feat:global_search")) && (
                <button onClick={() => setIsSearchOpen(true)} disabled={!rawRows.length}
                  className="sm-header-search hidden md:flex h-9 w-44 lg:w-60 xl:w-72 items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                  title="Pencarian global (Ctrl+K atau Cmd+K)"
                  aria-label="Pencarian global">
                  <Search size={14} className="shrink-0" />
                  <span className="truncate text-left flex-1 text-xs">Cari sales, outlet, produk...</span>
                  <kbd className="px-1.5 py-0.5 rounded text-[10px] hidden lg:inline shrink-0 font-sans"
                    style={{ background: colors.glassSubtle, color: colors.textMuted }}>⌘K</kbd>
                </button>
              )}

              {/* 2. Grup Aksi Laporan: Export + Mode Pajangan */}
              <div className="flex items-center gap-1.5">
                <ExportMenu
                  agg={aggFinal}
                  targets={targets}
                  workDays={workDays}
                  depotName={depotName}
                  disabled={!rawRows.length}
                  colors={colors}
                  activeTab={activeTab}
                  outletThresholds={outletThresholds}
                  tabExports={tabExportsRef}
                  onOpenDailyReport={() => setIsDailyReportOpen(true)}
                  canAccess={canAccess}
                />
                {(!canAccess || canAccess("feat:slideshow")) && (
                  <button onClick={() => slideshow.start(activeTab)} disabled={!rawRows.length}
                    className="sm-btn w-9 h-9 rounded-xl hidden sm:flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
                    style={{ background: colors.glassFill, color: colors.text, border: `1px solid ${colors.glassBorder}` }}
                    title="Mode Pajangan (untuk monitor di ruang sales)"
                    aria-label="Mode Pajangan">
                    <Monitor size={15} />
                  </button>
                )}
              </div>

              {/* Divider — desktop only */}
              <div className="sm-header-divider hidden md:block" />

              {/* 3. Grup Utilitas & Notifikasi: AI Chat + Smart Alert + Ganti Tema */}
              <div className="flex items-center gap-1.5">
                {(!canAccess || canAccess("feat:ai_chat")) && (
                  <button onClick={() => setIsAiChatOpen(true)}
                    className="sm-btn w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-colors"
                    style={{
                      background: isAiChatOpen ? `${colors.mint || '#10B981'}22` : colors.glassFill,
                      color: isAiChatOpen ? colors.mint : colors.text,
                      border: `1px solid ${isAiChatOpen ? (colors.mint || '#10B981') + '55' : colors.glassBorder}`,
                    }}
                    title="Asisten AI Automasi"
                    aria-label="Asisten AI Automasi">
                    <Sparkles size={15} style={{ color: colors.mint }} />
                  </button>
                )}
                {(!canAccess || canAccess("feat:smart_alerts")) && (
                  <NotificationBell
                    alerts={smartAlerts}
                    colors={colors}
                    onDrilldown={openDrilldown}
                    onNavigate={goToTab}
                    disabled={!rawRows.length}
                  />
                )}
                <ThemeToggle
                  theme={theme}
                  onToggle={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                  colors={colors}
                  className="hidden md:flex"
                />
              </div>

              {/* Divider — desktop only */}
              <div className="sm-header-divider hidden md:block" />

              {/* 4. Profil Pengguna & Sinkronisasi Cloud (Desktop Only) */}
              <div className="hidden md:flex items-center shrink-0">
                <AvatarButton
                  sessionUser={sessionUser}
                  syncState={settingsSyncState === "syncing" || masterSyncState === "syncing" ? "syncing"
                    : settingsSyncState === "error" || masterSyncState === "error" ? "error"
                    : settingsSyncState === "done" ? "done" : "idle"}
                  onOpenSettings={() => setIsSettingsOpen(true)}
                  onOpenLogin={() => setIsLoginOpen(true)}
                  onLogout={handleLogout}
                  onInstallPwa={handleInstallClick}
                  canInstallPwa={canShowInstallButton}
                  onOpenBackup={() => { setIsSettingsOpen(true); }}
                  colors={colors}
                />
              </div>

              {/* 5. Menu Hamburger (Mobile Only) */}
              <div className="md:hidden">
                <MobileHeaderMenu
                  colors={colors}
                  theme={theme}
                  sessionUser={sessionUser}
                  syncState={settingsSyncState === "syncing" || masterSyncState === "syncing" ? "syncing"
                    : settingsSyncState === "error" || masterSyncState === "error" ? "error"
                    : settingsSyncState === "done" ? "done" : "idle"}
                  onOpenSettings={() => setIsSettingsOpen(true)}
                  onOpenLogin={() => setIsLoginOpen(true)}
                  onLogout={handleLogout}
                  onOpenBackup={() => { setIsSettingsOpen(true); }}
                  onOpenSearch={() => setIsSearchOpen(true)}
                  searchDisabled={!rawRows.length}
                  onStartSlideshow={() => slideshow.start(activeTab)}
                  slideshowDisabled={!rawRows.length}
                  onOpenHistory={() => setIsHistoryOpen(true)}
                  historyDisabled={!rawRows.length}
                  onToggleTheme={() => setTheme(theme === "dark" ? "light" : "dark")}
                  onInstallPwa={handleInstallClick}
                  canInstallPwa={canShowInstallButton}
                  onOpenAiChat={() => setIsAiChatOpen(true)}
                  showAiChat={!canAccess || canAccess("feat:ai_chat")}
                />
              </div>
            </div>
          </div>
        </div>

        {/* ===== Remaining content: PWA notifications, page content, etc. ===== */}
        <PwaBanners
          offlineReady={offlineReady}
          setOfflineReady={setOfflineReady}
          needRefresh={needRefresh}
          setNeedRefresh={setNeedRefresh}
          updateServiceWorker={updateServiceWorker}
          showIosInstallHint={showIosInstallHint}
          setShowIosInstallHint={setShowIosInstallHint}
          colors={colors}
        />

        {/* upload */}
        <div className="mb-6 sm-fadeup" style={{ animationDelay: "40ms" }}>
          <UploadDropzone
            onFile={handleFile}
            hasData={!!rawRows.length}
            rowCount={rawRows.length}
            fileName={fileName}
            onReset={handleReset}
            onSample={handleSample}
            loading={loading}
            sampleLoading={sampleLoading}
            colors={colors}
            isEditor={isEditor}
            onSaveMaster={handleSaveMaster}
            masterBusy={masterBusy}
            masterResult={masterResult}
            onOpenMasterRange={() => setMasterAction("range")}
            canAccess={canAccess}
          />
          {error && (
            <div className="mt-3 flex items-center gap-2 text-sm px-4 py-2.5 rounded-xl" style={{ background: colors.coral + "14", color: colors.coral, border: `1px solid ${colors.coral}33` }}>
              <AlertTriangle size={14} /> {error}
            </div>
          )}
        </div>

        {/* tabs — desktop sekarang pakai Sidebar kiri (lihat root return),
            bukan tab bar horizontal lagi. Mobile tetap MobileBottomNav. */}

        {sessionLoading ? (
          <DashboardSkeleton colors={colors} />
        ) : !rawRows.length ? (
          // ⚠️ Sprint 10 / OB1: onboarding welcome screen (sebelumnya generic card).
          <OnboardingWelcome
            colors={colors}
            onUpload={handleFile}
            onSample={handleSample}
            onImportBackup={() => setIsSettingsOpen(true)}
            loading={loading}
            sampleLoading={sampleLoading}
          />
        ) : (
          <>
            <FilterBar salesOptions={salesOptions} groupOptions={groupOptions} filters={filters} setFilters={setFilters} colors={colors} theme={theme} rawRows={rawRows} />
            {filterSpansMultipleMonths && ["main", "executive", "sales", "product", "focus", "outlet"].includes(activeTab) && (
              <div className="sm-card p-3 mb-4 flex items-center gap-2.5 sm-fadeup" style={{ background: colors.gold + "0D", border: `1px solid ${colors.gold}33` }}>
                <AlertTriangle size={15} style={{ color: colors.gold, flexShrink: 0 }} />
                <p className="text-xs" style={{ color: colors.text }}>
                  Rentang tanggal yang aktif mencakup lebih dari 1 bulan kalender, sementara target di Pengaturan berlaku per bulan. ACH & deviasi di halaman ini mungkin tidak mencerminkan performa yang sebenarnya — persempit filter ke 1 bulan, atau gunakan tab <b>Tren Periode</b> untuk membandingkan antar bulan dengan benar.
                </p>
              </div>
            )}
            {/* ⚠️ Suspense per tab: page di-load async (lazy), fallback skeleton
                tampil selama chunk di-load / render pertama. Menghilangkan
                freeze ganti tab (main thread tidak blocked oleh render sinkron
                komponen berat + chart). */}
            {tabLoading ? (
              <div className="mt-4" aria-busy="true" aria-label="Memuat tab">
                <DashboardSkeleton colors={colors} />
              </div>
            ) : (
            <Suspense fallback={<div className="mt-4"><DashboardSkeleton colors={colors} /></div>}>
              {!canAccess("page:" + activeTab) && activeTab !== "admin-access" ? (
                <AccessRestricted colors={colors} />
              ) : (
                renderTabPage(activeTab)
              )}
            </Suspense>
            )}
            {/* Hidden file input for stock upload */}
            <input
              id="stock-file-input"
              type="file"
              accept=".xlsx,.xls"
              onChange={(e) => {
                if (e.target.files[0]) handleStockFile(e.target.files[0]);
                e.target.value = "";
              }}
              className="hidden"
            />
            {/* ⚠️ Sprint 19 / Sprint 2: Stock Import Preview modal (reconciliation) */}
            {stockPreviewOpen && (
              <Suspense fallback={null}>
                <StockImportPreview
                  isOpen={stockPreviewOpen}
                  onClose={() => { setStockPreviewOpen(false); setStockPreviewData(null); }}
                  onConfirm={handleStockConfirm}
                  diffResult={stockPreviewData?.diff}
                  parsedData={stockPreviewData?.parsedData}
                  isFirstUpload={stockPreviewData?.isFirstUpload}
                  colors={colors}
                />
              </Suspense>
            )}
          </>
        )}

        <div className="text-center mt-10 pb-4">
          <p className="text-xs mb-2" style={{ color: colors.textMuted }}>
            {sessionUser
              ? `Masuk sebagai ${sessionUser.email || "pengguna"} · Sinkronisasi ${settingsSyncState === "error" || masterSyncState === "error" ? "gagal" : settingsSyncState === "syncing" || masterSyncState === "syncing" ? "berjalan…" : settingsSyncState === "done" || masterSyncState === "done" ? "aktif" : "offline"}`
              : "Data diproses langsung di browser Anda — tidak diunggah ke server manapun."}
          </p>
          <div className="flex items-center justify-center gap-2 flex-wrap">
            <button
              onClick={() => setIsAboutOpen(true)}
              className="sm-btn text-xs font-medium px-3 py-1.5 rounded-lg"
              style={{ color: colors.textMuted }}
            >
              Tentang Aplikasi
            </button>
            <span className="text-xs select-none" style={{ color: colors.textMuted }}>&middot;</span>
            <button
              onClick={openWhatsNew}
              className="sm-btn text-xs font-medium px-3 py-1.5 rounded-lg inline-flex items-center gap-1.5"
              style={{ color: hasUnreadWhatsNew ? colors.gold : colors.textMuted }}
              title="Lihat Catatan Pembaruan"
            >
              {hasUnreadWhatsNew && (
                <span className="w-1.5 h-1.5 rounded-full animate-pulse shrink-0" style={{ background: colors.gold }} />
              )}
              <span>v{currentVersion}</span>
              <span className="hidden sm:inline">&middot; Catatan Pembaruan</span>
            </button>
          </div>
        </div>
      </div>
        </div>
      </div>
      </div>
    </div>
  );
}
