import React, { useState, useMemo, useCallback, useEffect, useRef } from "react";
import sumBy from "lodash/sumBy";
import {
  X, RefreshCw, Sun, Moon, CloudUpload, User as UserIcon,
  Smartphone, Share, History, Loader2, Search,
  FileSpreadsheet, AlertTriangle, CheckCircle2,
} from "lucide-react";
import { saveSession, loadSession, clearSession, saveHistory, loadHistory, clearHistory, clearCompareState, saveMasterMax } from "./utils/storage.js";
import { supabase, getSession, onAuthChange, signOutAccount } from "./utils/cloud.js";
// ⚠️ Sprint 6 / R6: syncEngine imports (fetchRole, pushSettings, dll) sekarang
// dipakai di hook useCloudSync.js. SalesMonitoringApp hanya butuh fetchRole
// untuk refreshRole callback.
import { fetchRole } from "./utils/syncEngine.js";
import { LoginModal } from "./components/LoginModal.jsx";
import {
  parseWorkbookFile, dedupeRows,
} from "./utils/excelParse.js";
import {
  useAggregates, computeAggregates, detectMonths, monthKey, getOutletBreakdown, getProductBreakdownForOutlet, getProductBreakdownForGroup,
} from "./utils/aggregation.js";
import { useDataQualityNotes } from "./utils/dataQuality.js";
import { buildHistorySnapshot, computeComparison, computeMultiPeriodComparison } from "./utils/history.js";
import { generateSampleRows } from "./utils/sampleData.js";
import { ALIASES } from "./constants/aliases.js";
import { TABS } from "./constants/tabs.js";
import { Sidebar } from "./components/layout/Sidebar.jsx";
import { HISTORY_MAX_ENTRIES } from "./constants/thresholds.js";
// ⚠️ Sprint 6 / R4: WORK_DAYS_DEFAULT dan DEFAULT_TARGETS sekarang dipakai di
// hook useSettings.js, bukan di SalesMonitoringApp.jsx. Hapus import di sini.
// ⚠️ Sprint 5 / S5: Web Vitals monitoring — track real-user FCP/LCP/INP/CLS/TTFB.
import { useWebVitals } from "./hooks/useWebVitals.js";
// ⚠️ Sprint 6 / R4: settings state + auto-save dipindah ke hook useSettings.js.
import { useSettings } from "./hooks/useSettings.js";
// Modul virtual dari vite-plugin-pwa — hanya ada saat plugin ini terpasang &
// dijalankan lewat Vite (dev atau build), bukan package npm biasa.
// ⚠️ Sprint 6 / R5: useRegisterSW dipakai di hook usePwaInstall.js sekarang.
import { usePwaInstall } from "./hooks/usePwaInstall.js";
// ⚠️ Sprint 6 / R6: cloud sync (settings LWW + master data) dipindah ke hook.
import { useCloudSync } from "./hooks/useCloudSync.js";
// ⚠️ Sprint 9 / GS1: global search / command palette hook.
import { useGlobalSearch } from "./hooks/useGlobalSearch.js";
import { GlobalSearch } from "./components/GlobalSearch.jsx";
// ⚠️ Sprint 10 / OB1: Onboarding welcome screen untuk first-time users.
import { OnboardingWelcome } from "./components/OnboardingWelcome.jsx";
// ⚠️ Sprint 17 / SS1+SS2: Slideshow mode untuk display monitor.
import { useSlideshow } from "./hooks/useSlideshow.js";
// ⚠️ Sprint 19 / Stock Module
import { useStock } from "./hooks/useStock.js";
import { SlideshowMode } from "./components/SlideshowMode.jsx";
import { Monitor } from "lucide-react";
import { FilterBar } from "./components/ui/FilterBar.jsx";
import { DashboardSkeleton } from "./components/ui/DashboardSkeleton.jsx";
import { UploadDropzone, MobileBottomNav, MobileFab, ExportMenu } from "./components/upload/index.jsx";
// ⚠️ Sprint 18 / Header Redesign: AvatarButton untuk header baru
import { AvatarButton } from "./components/ui/AvatarButton.jsx";
import { TrendPeriodePage } from "./components/trend/index.jsx";
import { MainReportPage } from "./pages/MainReportPage.jsx";
import { SalesReportPage } from "./pages/SalesReportPage.jsx";
import { ProductReportPage } from "./pages/ProductReportPage.jsx";
import { ProductFocusReportPage } from "./pages/ProductFocusReportPage.jsx";
import { OutletAnalysisPage } from "./pages/OutletAnalysisPage.jsx";
import { ComparisonPage } from "./pages/ComparisonPage.jsx";
import { DataQualityPage } from "./pages/DataQualityPage.jsx";
import { ExecutiveSummaryPage } from "./pages/ExecutiveSummaryPage.jsx";
import { TransactionsPage } from "./pages/TransactionsPage.jsx";
// ⚠️ Sprint 19 / Stock Module
import { StockPage } from "./pages/StockPage.jsx";
// ⚠️ Sprint 19 / Sprint 2: Reconciliation preview modal
import { StockImportPreview } from "./components/modals/StockImportPreview.jsx";
// ⚠️ Sprint 19e / Focus Group Drilldown
import { GroupFocusDrilldownModal } from "./components/modals/GroupFocusDrilldownModal.jsx";
import { OutletDrilldownModal } from "./components/modals/OutletDrilldownModal.jsx";
import { OutletDetailModal } from "./components/modals/OutletDetailModal.jsx";
import { DataPreviewModal } from "./components/modals/DataPreviewModal.jsx";
import { HistoryModal } from "./components/modals/HistoryModal.jsx";
import { SettingsModal } from "./components/modals/SettingsModal.jsx";
import { AboutModal } from "./components/modals/AboutModal.jsx";
import { RangeDeleteModal } from "./components/modals/RangeDeleteModal.jsx";

/* ============================================================================
   DESIGN TOKENS
   Ink navy surface, gold = on-pace, coral = behind pace, mint = growth,
   violet = focus-product accent. Display: Space Grotesk, Body: Inter,
   Data/mono: JetBrains Mono.
============================================================================ */
import { THEMES, applyPowerSaveColors } from "./constants/colors.js";
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
    slideshowConfig, setSlideshowConfig,
    // ⚠️ Sprint 18 / Multi-Depo: API baru dari useSettings
    depots, activeDepotId,
    setActiveDepot, addDepot, deleteDepot,
    // addSales, updateSales, deleteSales — akan dipakai di Sprint C (Excel import)
    // tapi tetap di-destructure di sini supaya terlihat di signature.
    // ⚠️ eslint-disable untuk unused — sudah by design.
    // eslint-disable-next-line no-unused-vars
    activeDepot,
    // eslint-disable-next-line no-unused-vars
    addSales,
    // eslint-disable-next-line no-unused-vars
    updateSales,
    // eslint-disable-next-line no-unused-vars
    deleteSales,
    resetAllSettings,
    applyCloudSettings,
  } = useSettings();

  const [rawRows, setRawRows] = useState([]);
  const [fileName, setFileName] = useState("");
  const [loading, setLoading] = useState(false);
  const [sampleLoading, setSampleLoading] = useState(false);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("executive");
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isAboutOpen, setIsAboutOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
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

  const cloudEnabled = !!supabase;
  const isEditor = userRole === "admin" || userRole === "supervisor";

  // Keluar dari akun — state app TIDAK diubah (data lokal tetap utuh).
  const handleLogout = useCallback(async () => {
    await signOutAccount();
    setIsLoginOpen(false);
    setUserRole(null);
  }, []);

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
  } = useCloudSync({
    isAuthedRef,
    isEditor,
    settingsGetters: { targets, workDays, depotName, theme, projectionMethod, sidebarCollapsed },
    settingsSetters: { setTargets, setWorkDays, setDepotName, setTheme, setProjectionMethod, setSidebarCollapsed },
    settingsApplier: applyCloudSettings,
    dataState: { rawRows, setRawRows, setFileName, setParseMeta },
  });

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
  }, [refreshRole]);

  /* --------------------------- PWA: instal & update --------------------------- */

  // ---- PWA: install prompt + service worker update ----
  // ⚠️ Sprint 6 / R5: dipindah ke hook usePwaInstall.js (sebelumnya inline
  // ~60 baris state + effects + handlers di sini).
  const {
    needRefresh, setNeedRefresh,
    offlineReady, setOfflineReady,
    updateServiceWorker,
    installPromptEvent,
    showIosInstallHint, setShowIosInstallHint,
    isIOS,
    isStandalone,
    handleInstallClick,
    canShowInstallButton,
  } = usePwaInstall();

  // ⚠️ Sprint 5 / S5: track Core Web Vitals (FCP/LCP/INP/CLS/TTFB) untuk
  // monitor real-user performance. Saat ini cuma log ke console di dev mode.
  // Production bisa extend dengan post ke analytics endpoint lewat onMetric.
  // Lihat hooks/useWebVitals.js untuk detail.
  useWebVitals({
    onMetric: (metric) => {
      // Hook untuk analytics production — contoh:
      // if (navigator.sendBeacon && metric.rating === "poor") {
      //   navigator.sendBeacon("/api/vitals", JSON.stringify(metric));
      // }
    },
  });

  const colors = useMemo(() => {
    const base = THEMES[theme];
    return powerSaveMode ? applyPowerSaveColors(base) : base;
  }, [theme, powerSaveMode]);
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

  const groupOptions = useMemo(() => {
    const s = new Set();
    targets.forEach((t) => t.groups.forEach((g) => s.add(g.name)));
    rawRows.forEach((r) => r.group && s.add(r.group));
    return Array.from(s).sort();
  }, [targets, rawRows]);

  const salesOptions = useMemo(() => targets.map((t) => ({ name: t.name, code: t.code })), [targets]);
  const aggFinal = useAggregates(rawRows, targets, filters, workDays);
  const dataQualityNotes = useDataQualityNotes(rawRows, targets, parseMeta);

  // ---- Global Search (Cmd+K / Ctrl+K) ----
  // ⚠️ Sprint 9 / GS1+GS3+GS4: command palette untuk search across semua data.
  const globalSearch = useGlobalSearch({ targets, rawRows, agg: aggFinal });

  // ---- Slideshow Mode (Sprint 17 / SS1) ----
  // Auto-rotate antar tab untuk display monitor di ruang sales.
  // ⚠️ Sprint 17h / bugfix: teruskan flag autoScroll dari slideshowConfig
  // supaya checkbox "Auto-scroll halus" di Settings benar-benar berfungsi
  // (sebelumnya flag diabaikan — rAF scroll selalu jalan).
  const slideshow = useSlideshow({
    enabledTabs: slideshowConfig?.enabledTabs || ["executive", "main", "sales", "product", "focus"],
    tabDuration: slideshowConfig?.tabDuration || 30,
    syncInterval: slideshowConfig?.syncInterval || 5,
    autoScroll: slideshowConfig?.autoScroll ?? true,
    onTabChange: (tab) => setActiveTab(tab),
    onSync: () => { if (isAuthedRef.current) syncMasterNow(); },
    isAuthed: isAuthedRef.current,
  });

  // ⚠️ Sprint 19 / Stock Module: hook untuk manage stock data
  // currentStock = snapshot - sales (untuk tanggal >= snapshot date)
  const stockData = useStock({
    depotId: activeDepotId,
    transactions: rawRows,
    daysCount: workDays || 30,
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
        alert("Gagal parse file stok: " + (result.errors[0]?.message || "Format tidak dikenali"));
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
      alert("Gagal upload stok: " + (err.message || String(err)));
    }
  };

  const handleStockConfirm = async () => {
    if (!stockPreviewData) return;
    const { parsedData, diff } = stockPreviewData;
    setStockPreviewOpen(false);
    setStockPreviewData(null);

    const uploadResult = await stockData.uploadSnapshot(parsedData, { diff });
    if (!uploadResult.success) {
      alert("Gagal simpan stok: " + (uploadResult.error || "Unknown error"));
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
    if (action.tabKey) setActiveTab(action.tabKey);
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
  }, [aggFinal, setFilters]);

  const openDrilldown = (title, subtitle, predicate) => {
    setDrilldown({ title, subtitle, outlets: getOutletBreakdown(aggFinal.filteredRows, predicate) });
  };

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

  const [outletThresholds, setOutletThresholds] = useState({ activeMaxDays: 14, dormantMinDays: 30 });
  const [outletDetail, setOutletDetail] = useState(null);
  const openOutletDetail = (outlet) => setOutletDetail(outlet);
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
    () => trendSnapshots.length > 0 ? computeMultiPeriodComparison(aggFinal, trendSnapshots, filters, fileName) : null,
    [aggFinal, trendSnapshots, filters, fileName]
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
    if (detectedMonths.length < 2) return null;
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
  }, [detectedMonths, rawRows, targets, filters.salesCodes, workDays, fileName]);

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
      setActiveTab("trend");
    }
    setIsHistoryOpen(false);
  }, [history]);

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
      const results = await Promise.all(fileList.map((f) => parseWorkbookFile(f)));
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
      const combinedMeta = {
        totalDataRows: sumBy(results, (r) => r.parseMeta.totalDataRows),
        skippedBlankRows: sumBy(results, (r) => r.parseMeta.skippedBlankRows),
        rowsWithMissingDate: sumBy(results, (r) => r.parseMeta.rowsWithMissingDate),
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
  }, [rawRows]);

  const confirmPreview = useCallback((mode) => {
    if (!pendingPreview) return;
    const merge = mode === "merge" && pendingPreview.mergePreview;
    // ⚠️ Bug fix (H6): mergePreview.mergedRows sudah tidak disimpan (lihat
    // handleFile). Bila user pilih "merge", recompute dedupe di sini dengan
    // data terbaru dari rawRows (yang mungkin berubah sejak preview dibuka,
    // meskipun jarang). Ini lebih akurat dan hemat memori.
    const rows = merge
      ? dedupeRows([...rawRows, ...pendingPreview.rows]).rows
      : pendingPreview.rows;
    const name = merge ? `${pendingPreview.fileName} (digabung dengan data sebelumnya)` : pendingPreview.fileName;
    setRawRows(rows);
    setParseMeta(pendingPreview.parseMeta);
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
  }, [pendingPreview, rawRows]);

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
  }, []);

  const handleReset = useCallback(() => {
    setRawRows([]); setFileName(""); setParseMeta(null);
    clearSession();
    // ⚠️ Bug fix: reset masterMax supaya sync berikutnya ambil SEMUA data cloud
    // (full pull), bukan cuma delta. Sebelumnya masterMax tidak di-reset, jadi
    // sync cuma ambil baris dengan date > maxDate lama — data cloud tidak masuk.
    saveMasterMax("");
  }, []);

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

  return (
    <div className={`smapp min-h-screen transition-colors duration-300 ${powerSaveMode ? "sm-powersave" : ""}`}>
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
      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} targets={targets} setTargets={setTargets} workDays={workDays} setWorkDays={setWorkDays} depotName={depotName} setDepotName={setDepotName} onClearAll={handleClearAll} colors={colors}
        theme={theme} setTheme={setTheme} powerSaveMode={powerSaveMode} setPowerSaveMode={setPowerSaveMode} filters={filters} setFilters={setFilters} projectionMethod={projectionMethod} setProjectionMethod={setProjectionMethod} history={history} onImportHistory={importHistoryMerge}
        slideshowConfig={slideshowConfig} setSlideshowConfig={setSlideshowConfig} onStartSlideshow={() => slideshow.start(activeTab)} />
      <LoginModal isOpen={isLoginOpen} onClose={() => setIsLoginOpen(false)} colors={colors} onLoginSuccess={() => {}} sessionUser={sessionUser} userRole={userRole} onLogout={handleLogout} settingsSyncState={settingsSyncState} settingsSyncMsg={settingsSyncMsg} lastSettingsSyncAt={lastSettingsSyncAt} onRetrySettings={() => { settingsSyncNowRef.current?.(); }} masterSyncState={masterSyncState} masterSyncMsg={masterSyncMsg} lastMasterSyncAt={lastMasterSyncAt} onMasterSync={syncMasterNow} />
      <AboutModal isOpen={isAboutOpen} onClose={() => setIsAboutOpen(false)} colors={colors} />
      {/* ⚠️ Sprint 9 / GS2: Global Search / Command Palette (Cmd+K / Ctrl+K) */}
      <GlobalSearch
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        onNavigate={handleSearchNavigate}
        colors={colors}
        {...globalSearch}
      />
      {/* ⚠️ Sprint 17 / SS2: Slideshow Mode overlay */}
      <SlideshowMode
        {...slideshow}
        colors={effectiveSlideshowColors}
        depotName={depotName}
        aggMeta={aggFinal.meta}
        // ⚠️ Sprint 17h / bugfix: teruskan flag tampilan dari slideshowConfig
        // supaya checkbox "Font diperbesar", "Dark mode paksa" benar-benar
        // berfungsi (sebelumnya diabaikan — font selalu 1.15em, colors selalu
        // dari theme aktif).
        largeFont={slideshowConfig?.largeFont ?? true}
        forceDark={slideshowConfig?.forceDark ?? false}
        renderPage={(tab) => {
          // Render page yang sama dengan yang di main content, tapi dengan
          // prop slideshowMode={hideTables} supaya DataTable di-hide hanya
          // kalau user menandai "Sembunyikan tabel" di Settings.
          // ⚠️ Sprint 17h / bugfix: sebelumnya `slideshowMode` hard-coded true
          // → uncheck "Sembunyikan tabel" tidak ada efek, tabel tetap hilang.
          // Sekarang flag diambil dari slideshowConfig.hideTables.
          // ⚠️ Sprint 17h / bugfix: hideAlerts dipisah dari slideshowMode
          // (sebelumnya nge-conflate "hide tables" + "hide alerts" dalam satu
          // prop). Sekarang MainReportPage terima `hideAlerts` terpisah.
          // ⚠️ Sprint 17h / bugfix: pakai effectiveSlideshowColors (bukan
          // colors) supaya forceDark berlaku juga ke konten page.
          const pageColors = effectiveSlideshowColors;
          const hideTables = slideshowConfig?.hideTables ?? true;
          const hideAlerts = slideshowConfig?.hideAlerts ?? true;
          switch (tab) {
            case "executive": return <ExecutiveSummaryPage agg={aggFinal} colors={pageColors} workDays={workDays} onDrilldown={openDrilldown} onGroupDrilldown={openGroupFocusDrilldown} comparison={comparison} onNavigate={setActiveTab} rawRows={rawRows} targets={targets} filters={filters} stockSummary={stockData.stockSummary} slideshowMode={hideTables} />;
            case "main": return <MainReportPage agg={aggFinal} workDays={workDays} colors={pageColors} onDrilldown={openDrilldown} comparison={comparison} onClearComparison={() => setComparisonSnapshot(null)} projectionMethod={projectionMethod} onProjectionMethodChange={setProjectionMethod} dataQualityNotes={dataQualityNotes} onNavigate={setActiveTab} rawRows={rawRows} targets={targets} filters={filters} slideshowMode={hideTables} hideAlerts={hideAlerts} />;
            case "sales": return <SalesReportPage agg={aggFinal} colors={pageColors} onDrilldown={openDrilldown} workDays={workDays} depotName={depotName} slideshowMode={hideTables} />;
            case "product": return <ProductReportPage agg={aggFinal} colors={pageColors} onDrilldown={openDrilldown} depotName={depotName} currentStock={stockData.currentStock} stockSummary={stockData.stockSummary} slideshowMode={hideTables} />;
            case "focus": return <ProductFocusReportPage agg={aggFinal} colors={pageColors} onDrilldown={openDrilldown} onGroupDrilldown={openGroupFocusDrilldown} depotName={depotName} filteredRows={aggFinal.filteredRows} slideshowMode={hideTables} />;
            default: return null;
          }
        }}
      />
      {/* Modal hapus rentang master data (admin) */}
      {masterAction === "range" && (
        <RangeDeleteModal
          colors={colors}
          onClose={() => setMasterAction(null)}
          onConfirm={handleDeleteRange}
        />
      )}
      <OutletDrilldownModal isOpen={!!drilldown} onClose={() => setDrilldown(null)} title={drilldown?.title} subtitle={drilldown?.subtitle} outlets={drilldown?.outlets || []} colors={colors} />
      {/* ⚠️ Sprint 19e / Focus Group Drilldown: modal per-SKU untuk grup fokus */}
      <GroupFocusDrilldownModal
        isOpen={!!groupFocusDrilldown}
        onClose={() => setGroupFocusDrilldown(null)}
        title={groupFocusDrilldown?.title}
        subtitle={groupFocusDrilldown?.subtitle}
        products={groupFocusDrilldown?.products || []}
        groupSummary={groupFocusDrilldown?.groupSummary}
        colors={colors}
      />
      <OutletDetailModal isOpen={!!outletDetail} onClose={() => setOutletDetail(null)} outlet={outletDetail} products={outletDetailProducts} colors={colors} />
      <DataPreviewModal isOpen={!!pendingPreview} onCancel={cancelPreview} onConfirm={(mode) => confirmPreview(mode)} preview={pendingPreview} colors={colors} />
      <HistoryModal isOpen={isHistoryOpen} onClose={() => setIsHistoryOpen(false)} history={history} onSave={saveHistorySnapshot} onApply={applyHistorySelection}
        onDelete={deleteHistorySnapshot}
        defaultLabel={filters.dateFrom && filters.dateTo ? `${filters.dateFrom} — ${filters.dateTo}` : ""} colors={colors} />
      <MobileFab onFile={handleFile} colors={colors} loading={loading} />
      <MobileBottomNav tabs={TABS} activeTab={activeTab} onChange={setActiveTab} colors={colors} />

      {/* ⚠️ Sprint 18d / Header Redesign: layout root kembali ke pola lama
          (Sidebar di kiri sejajar Header+Content di kanan) — user prefer ini.
          Header tetap pakai glass card dengan 3 grup + search prominent. */}
      <div className="flex items-start">

        {/* ===== SIDEBAR (desktop, kiri) ===== */}
        <Sidebar activeTab={activeTab} onChangeTab={setActiveTab} collapsed={sidebarCollapsed} onToggleCollapse={() => setSidebarCollapsed((v) => !v)}
          onOpenHistory={() => setIsHistoryOpen(true)} onOpenSettings={() => setIsSettingsOpen(true)} historyDisabled={!rawRows.length} colors={colors}
          // ⚠️ Sprint 18 / Multi-Depo: pass depo state + setters ke Sidebar
          depots={depots} activeDepotId={activeDepotId}
          onSelectDepot={setActiveDepot} onAddDepot={addDepot} onDeleteDepot={deleteDepot} />

        {/* ===== MAIN AREA (kanan: header + content) ===== */}
        <div className="flex-1 min-w-0">
      <div className="max-w-7xl mx-auto px-4 md:px-8 py-4 md:py-6 pb-24 md:pb-6">

        {/* ===== HEADER (glass card, di kolom kanan sidebar) ===== */}
        <div className="sm-card sm-fadeup sticky top-2 z-40 mb-4" style={{ padding: "10px 12px" }}>
          {/* ⚠️ Sprint 18d9 / Responsive fix (revised per user feedback):
              Desktop: brand di kiri, search + actions di grup kanan (justify-between)
              Mobile: brand + actions sejajar di baris atas (manfaatkan space kosong),
                      search bar pindah ke baris bawah sendiri (full-width).
              Sebelumnya mobile: brand sendirian di atas, actions pindah ke baris
              bawah → space kanan brand kosong sia-sia. Sekarang brand+actions
              1 baris, search saja yang turun. */}
          <div className="flex items-center justify-between gap-2 md:gap-3">

            {/* Blok kiri: Brand — selalu di kiri */}
            <div className="flex items-center gap-2 shrink-0">
              <div className="p-1.5 rounded-lg shrink-0" style={{ background: `linear-gradient(135deg, ${colors.gold}, ${colors.coral})` }}>
                <FileSpreadsheet size={14} color="#0A1120" />
              </div>
              <div className="min-w-0 hidden sm:block">
                <h1 className="disp text-sm font-bold truncate" style={{ color: colors.text }}>Monitoring Penjualan</h1>
                <p className="text-[10px] leading-tight" style={{ color: colors.textMuted }}>Dashboard sales & produk</p>
              </div>
            </div>

            {/* Blok kanan: Search (desktop only) + Actions — grup kanan
                Di mobile, search bar disembunyikan dari sini (akan muncul di
                baris bawah sebagai full-width). Actions tetap di baris atas
                sejajar dengan brand supaya space kanan tidak kosong. */}
            <div className="flex items-center gap-1.5 md:gap-2 shrink-0">

              {/* Search bar — desktop only di grup kanan, mobile di baris bawah */}
              <button onClick={() => setIsSearchOpen(true)} disabled={!rawRows.length}
                className="sm-header-search hidden md:flex md:max-w-xs lg:max-w-sm disabled:opacity-40 disabled:cursor-not-allowed"
                title="Pencarian global (Ctrl+K atau Cmd+K)"
                aria-label="Pencarian global">
                <Search size={14} className="shrink-0" />
                <span className="truncate text-left flex-1">Cari sales, outlet, produk...</span>
                <kbd className="px-1.5 py-0.5 rounded text-[10px] hidden lg:inline shrink-0"
                  style={{ background: colors.glassSubtle, color: colors.textMuted }}>⌘K</kbd>
              </button>

              {/* Actions group */}
              <div className="flex items-center gap-1.5">

                {/* Mobile-only: Search icon button (di baris atas, sejajar actions lainnya).
                    Desktop tidak butuh ini karena search bar prominent sudah ada di grup kanan. */}
                <button onClick={() => setIsSearchOpen(true)} disabled={!rawRows.length}
                  className="sm-btn p-2 rounded-lg flex md:hidden disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{ background: colors.glassFill, color: colors.text, border: `1px solid ${colors.glassBorder}` }}
                  aria-label="Pencarian global"
                  title="Pencarian global (Ctrl+K atau Cmd+K)">
                  <Search size={14} />
                </button>

                {/* Grup 1: Aksi konten — slideshow + export */}
                <button onClick={() => slideshow.start(activeTab)} disabled={!rawRows.length}
                  className="sm-btn p-2 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{ background: colors.glassFill, color: colors.text, border: `1px solid ${colors.glassBorder}` }}
                  title="Mode Pajangan (untuk monitor di ruang sales)"
                  aria-label="Mode Pajangan">
                  <Monitor size={14} />
                </button>
                <ExportMenu agg={aggFinal} targets={targets} workDays={workDays} depotName={depotName} disabled={!rawRows.length} colors={colors} />

                {/* Divider — desktop only */}
                <div className="sm-header-divider hidden md:block" />

                {/* Grup 2: Utility — theme toggle, desktop only */}
                <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                  className="sm-btn p-2 rounded-lg hidden md:flex"
                  style={{ background: colors.glassFill, color: colors.text, border: `1px solid ${colors.glassBorder}` }}
                  aria-label="Ganti tema"
                  title="Ganti tema">
                  {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
                </button>

                {/* Divider — desktop only */}
                <div className="sm-header-divider hidden md:block" />

                {/* Mobile-only: Snapshot — pindah ke SEBELUM avatar (sebelah kiri
                    avatar) supaya urutan: ... | snapshot | avatar. Tombol Settings
                    mobile dihapus karena sudah ada di menu avatar popover. */}
                <button onClick={() => setIsHistoryOpen(true)} disabled={!rawRows.length}
                  className="sm-btn p-2 rounded-lg flex md:hidden disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{ background: colors.glassFill, color: colors.text, border: `1px solid ${colors.glassBorder}` }}
                  aria-label="Snapshot"
                  title="Snapshot Periode">
                  <History size={14} />
                </button>

                {/* Grup 3: Avatar — selalu tampil, terakhir di kanan */}
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
            </div>
          </div>
        </div>

        {/* ===== Remaining content: PWA notifications, page content, etc. ===== */}
        {offlineReady && !needRefresh && (
          <div className="mb-6 sm-fadeup flex items-center justify-between gap-3 px-4 py-3 rounded-xl" style={{ background: colors.mint + "14", border: `1px solid ${colors.mint}44` }}>
            <div className="flex items-center gap-2.5 text-sm">
              <CheckCircle2 size={15} style={{ color: colors.mint }} />
              <span>Aplikasi siap dipakai walau tanpa internet.</span>
            </div>
            <button onClick={() => setOfflineReady(false)}
              className="sm-btn p-1.5 rounded-lg" style={{ color: colors.textMuted }}>
              <X size={14} />
            </button>
          </div>
        )}

        {/* PWA: notifikasi update tersedia */}
        {needRefresh && (
          <div className="mb-6 sm-fadeup flex items-center justify-between gap-3 px-4 py-3 rounded-xl" style={{ background: colors.gold + "14", border: `1px solid ${colors.gold}44` }}>
            <div className="flex items-center gap-2.5 text-sm">
              <RefreshCw size={15} style={{ color: colors.gold }} />
              <span>Versi baru aplikasi tersedia.</span>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => updateServiceWorker(true)}
                className="sm-btn px-3 py-1.5 rounded-lg text-xs font-semibold" style={{ background: colors.gold, color: "#0A1120" }}>
                Perbarui Sekarang
              </button>
              <button onClick={() => setNeedRefresh(false)}
                className="sm-btn px-3 py-1.5 rounded-lg text-xs font-semibold" style={{ border: `1px solid ${colors.glassBorder}` }}>
                Nanti
              </button>
            </div>
          </div>
        )}

        {/* PWA: instruksi manual instal untuk iOS Safari (tidak ada beforeinstallprompt) */}
        {showIosInstallHint && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm sm-fadein" onClick={() => setShowIosInstallHint(false)}>
            <div className="sm-card sm-modal-glass sm-scale-in w-full max-w-sm p-5" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl" style={{ background: colors.gold + "1A" }}><Smartphone size={16} style={{ color: colors.gold }} /></div>
                  <div className="disp text-base font-semibold">Instal di iPhone/iPad</div>
                </div>
                <button onClick={() => setShowIosInstallHint(false)} className="sm-btn p-2 rounded-full" style={{ background: colors.glassFill }}><X size={16} /></button>
              </div>
              <ol className="text-sm space-y-2.5" style={{ color: colors.text }}>
                <li className="flex items-start gap-2.5">
                  <span className="mono font-semibold shrink-0" style={{ color: colors.gold }}>1.</span>
                  <span className="flex items-center gap-1.5 flex-wrap">Tap ikon <Share size={14} style={{ color: colors.gold }} /> <b>Share</b> di bar bawah Safari</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="mono font-semibold shrink-0" style={{ color: colors.gold }}>2.</span>
                  <span>Pilih <b>"Add to Home Screen"</b></span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="mono font-semibold shrink-0" style={{ color: colors.gold }}>3.</span>
                  <span>Tap <b>"Add"</b> di pojok kanan atas</span>
                </li>
              </ol>
            </div>
          </div>
        )}

        {/* upload */}
        <div className="mb-6 sm-fadeup" style={{ animationDelay: "40ms" }}>
          <UploadDropzone onFile={handleFile} hasData={!!rawRows.length} fileName={fileName} onReset={handleReset} onSample={handleSample} loading={loading} sampleLoading={sampleLoading} colors={colors} />

          {/* Panel admin/supervisor: kelola master data */}
          {isEditor && (
            <div className="mt-3 flex flex-wrap items-center gap-2 sm-fadeup">
              <button onClick={handleSaveMaster} disabled={masterBusy || !rawRows.length}
                className="sm-btn flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold disabled:opacity-40"
                style={{ background: colors.mint + "1A", color: colors.mint, border: `1px solid ${colors.mint}44` }}>
                <CloudUpload size={15} /> Simpan ke Master
              </button>
              <button onClick={() => setMasterAction("range")} disabled={masterBusy}
                className="sm-btn flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold disabled:opacity-40"
                style={{ background: colors.glassFill, color: colors.coral, border: `1px solid ${colors.coral}33` }}>
                <AlertTriangle size={15} /> Hapus Rentang
              </button>
              {masterResult && (
                <span className="text-xs" style={{ color: masterResult.startsWith("Gagal") ? colors.coral : colors.mint }}>
                  {masterResult}
                </span>
              )}
            </div>
          )}
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
            {activeTab === "main" && <MainReportPage agg={aggFinal} workDays={workDays} colors={colors} onDrilldown={openDrilldown} comparison={comparison} onClearComparison={() => setComparisonSnapshot(null)} projectionMethod={projectionMethod} onProjectionMethodChange={setProjectionMethod} dataQualityNotes={dataQualityNotes} onNavigate={setActiveTab} rawRows={rawRows} targets={targets} filters={filters} />}
            {activeTab === "executive" && <ExecutiveSummaryPage agg={aggFinal} colors={colors} workDays={workDays} onDrilldown={openDrilldown} onGroupDrilldown={openGroupFocusDrilldown} comparison={comparison} dataQualityNotes={dataQualityNotes} onNavigate={setActiveTab} rawRows={rawRows} targets={targets} filters={filters} stockSummary={stockData.stockSummary} />}
            {activeTab === "sales" && <SalesReportPage agg={aggFinal} colors={colors} onDrilldown={openDrilldown} workDays={workDays} depotName={depotName} />}
            {activeTab === "product" && <ProductReportPage agg={aggFinal} colors={colors} onDrilldown={openDrilldown} depotName={depotName} currentStock={stockData.currentStock} stockSummary={stockData.stockSummary} />}
            {activeTab === "focus" && <ProductFocusReportPage agg={aggFinal} colors={colors} onDrilldown={openDrilldown} onGroupDrilldown={openGroupFocusDrilldown} depotName={depotName} filteredRows={aggFinal.filteredRows} />}
            {activeTab === "outlet" && <OutletAnalysisPage agg={aggFinal} colors={colors} thresholds={outletThresholds} setThresholds={setOutletThresholds} onSelectOutlet={openOutletDetail} rawRows={rawRows} targets={targets} depotName={depotName} />}
            {activeTab === "compare" && <ComparisonPage rawRows={rawRows} targets={targets} colors={colors} workDays={workDays} depotName={depotName} comparisonBase={comparisonBase} onBaseChange={setComparisonBase} />}
            {activeTab === "transactions" && <TransactionsPage agg={aggFinal} colors={colors} onOutletDrilldown={openOutletDetail} />}
            {activeTab === "quality" && <DataQualityPage notes={dataQualityNotes} colors={colors} onDrilldown={openDrilldown} />}
            {/* ⚠️ Sprint 19 / Stock Module */}
            {activeTab === "stock" && (
              <StockPage
                stockData={stockData}
                colors={colors}
                onUploadStock={() => document.getElementById("stock-file-input")?.click()}
              />
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
            <StockImportPreview
              isOpen={stockPreviewOpen}
              onClose={() => { setStockPreviewOpen(false); setStockPreviewData(null); }}
              onConfirm={handleStockConfirm}
              diffResult={stockPreviewData?.diff}
              parsedData={stockPreviewData?.parsedData}
              isFirstUpload={stockPreviewData?.isFirstUpload}
              colors={colors}
            />
            {activeTab === "trend" && <TrendPeriodePage comparisonData={finalTrendComparisonData} isAutoTrend={isAutoTrend} colors={colors} onOpenPeriodPicker={() => setIsHistoryOpen(true)} selectedCount={trendSnapshotIds.length} depotName={depotName} comparisonBase={comparisonBase} onBaseChange={setComparisonBase} />}
          </>
        )}

        <div className="text-center mt-10 pb-4">
          <p className="text-xs mb-2" style={{ color: colors.textMuted }}>
            {sessionUser
              ? `Masuk sebagai ${sessionUser.email || "pengguna"} · Sinkronisasi ${settingsSyncState === "error" || masterSyncState === "error" ? "gagal" : settingsSyncState === "syncing" || masterSyncState === "syncing" ? "berjalan…" : settingsSyncState === "done" || masterSyncState === "done" ? "aktif" : "offline"}`
              : "Data diproses langsung di browser Anda — tidak diunggah ke server manapun."}
          </p>
          <button onClick={() => setIsAboutOpen(true)} className="sm-btn text-xs font-medium px-3 py-1.5 rounded-lg" style={{ color: colors.textMuted }}>
            Tentang Aplikasi
          </button>
        </div>
      </div>
        </div>
      </div>
      </div>
    </div>
  );
}
