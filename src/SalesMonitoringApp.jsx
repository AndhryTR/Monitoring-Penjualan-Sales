import React, { useState, useMemo, useCallback, useEffect } from "react";
import sumBy from "lodash/sumBy";
import {
  X, RefreshCw, Sun, Moon,
  Smartphone, Share, History, Settings,
  FileSpreadsheet, AlertTriangle, CheckCircle2,
} from "lucide-react";
import { saveSettings, loadSettings, clearSettings, saveSession, loadSession, clearSession, saveHistory, loadHistory, clearHistory } from "./utils/storage.js";
import {
  parseWorkbookFile, dedupeRows,
} from "./utils/excelParse.js";
import {
  useAggregates, computeAggregates, detectMonths, getOutletBreakdown, getProductBreakdownForOutlet,
} from "./utils/aggregation.js";
import { useDataQualityNotes } from "./utils/dataQuality.js";
import { buildHistorySnapshot, computeComparison, computeMultiPeriodComparison } from "./utils/history.js";
import { generateSampleRows } from "./utils/sampleData.js";
import { ALIASES } from "./constants/aliases.js";
import { PRIMARY_TABS, MORE_TABS } from "./constants/tabs.js";
import { Sidebar } from "./components/layout/Sidebar.jsx";
import { WORK_DAYS_DEFAULT } from "./constants/thresholds.js";
import DEFAULT_TARGETS from "./constants/defaultTargets.json";
// Modul virtual dari vite-plugin-pwa — hanya ada saat plugin ini terpasang &
// dijalankan lewat Vite (dev atau build), bukan package npm biasa.
import { useRegisterSW } from "virtual:pwa-register/react";
import { FilterBar } from "./components/ui/FilterBar.jsx";
import { DashboardSkeleton } from "./components/ui/DashboardSkeleton.jsx";
import { UploadDropzone, MobileBottomNav, MobileFab, ExportMenu } from "./components/upload/index.jsx";
import { TrendPeriodePage } from "./components/trend/index.jsx";
import { MainReportPage } from "./pages/MainReportPage.jsx";
import { SalesReportPage } from "./pages/SalesReportPage.jsx";
import { ProductReportPage } from "./pages/ProductReportPage.jsx";
import { ProductFocusReportPage } from "./pages/ProductFocusReportPage.jsx";
import { OutletAnalysisPage } from "./pages/OutletAnalysisPage.jsx";
import { DataQualityPage } from "./pages/DataQualityPage.jsx";
import { TransactionsPage } from "./pages/TransactionsPage.jsx";
import { OutletDrilldownModal } from "./components/modals/OutletDrilldownModal.jsx";
import { OutletDetailModal } from "./components/modals/OutletDetailModal.jsx";
import { DataPreviewModal } from "./components/modals/DataPreviewModal.jsx";
import { HistoryModal } from "./components/modals/HistoryModal.jsx";
import { SettingsModal } from "./components/modals/SettingsModal.jsx";

/* ============================================================================
   DESIGN TOKENS
   Ink navy surface, gold = on-pace, coral = behind pace, mint = growth,
   violet = focus-product accent. Display: Space Grotesk, Body: Inter,
   Data/mono: JetBrains Mono.
============================================================================ */
import { THEMES } from "./constants/colors.js";

const createGlobalStyle = (colors) => `
@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@500;600&display=swap');
* { box-sizing: border-box; }
.smapp { font-family: 'Inter', sans-serif; color: ${colors.text}; background: ${colors.meshBg}; position: relative; }
.smapp .disp { font-family: 'Space Grotesk', sans-serif; }
.smapp .mono { font-family: 'JetBrains Mono', monospace; }
.smapp *::-webkit-scrollbar { height: 8px; width: 8px; }
.smapp *::-webkit-scrollbar-thumb { background: ${colors.border}; border-radius: 4px; border: 2px solid ${colors.ink}; }
.smapp *::-webkit-scrollbar-track { background: transparent; }
/* --- Aurora mesh background (Fase 4 — final spec, 5 blobs) --- */
.sm-mesh { position: fixed; inset: 0; z-index: 0; overflow: hidden; pointer-events: none; }
.sm-mesh .blob { position: absolute; border-radius: 50%; filter: blur(80px); will-change: transform; }
.sm-mesh .blob-1 { top: -12%; left: -10%; animation: smBlobA 28s cubic-bezier(.4,0,.2,1) infinite; }
.sm-mesh .blob-2 { top: 22%; right: -14%; animation: smBlobB 34s cubic-bezier(.4,0,.2,1) infinite; }
.sm-mesh .blob-3 { bottom: -14%; left: 12%; animation: smBlobC 31s cubic-bezier(.4,0,.2,1) infinite; }
.sm-mesh .blob-4 { bottom: -10%; right: 8%; animation: smBlobD 26s cubic-bezier(.4,0,.2,1) infinite; }
.sm-mesh .blob-5 { top: 38%; left: 38%; animation: smBlobE 33s cubic-bezier(.4,0,.2,1) infinite; }
@keyframes smBlobA { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(6%,4%) scale(1.08); } }
@keyframes smBlobB { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(-5%,6%) scale(1.05); } }
@keyframes smBlobC { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(4%,-5%) scale(1.1); } }
@keyframes smBlobD { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(-4%,-4%) scale(1.06); } }
@keyframes smBlobE { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(5%,5%) scale(1.04); } }
@keyframes smFadeUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
@keyframes smFadeIn { from { opacity: 0; } to { opacity: 1; } }
@keyframes smPulse { 0%,100% { opacity:1 } 50% { opacity:.55 } }
@keyframes smShimmer { 0% { background-position: -400px 0; } 100% { background-position: 400px 0; } }
@keyframes smDash { from { stroke-dashoffset: 300; } to { stroke-dashoffset: 0; } }
@media (prefers-reduced-motion: reduce) { .sm-mesh .blob { animation: none; } }
.sm-fadeup { animation: smFadeUp .45s cubic-bezier(.16,1,.3,1) both; transition: background .3s ease, border-color .3s ease, box-shadow .3s ease; }
.sm-fadein { animation: smFadeIn .3s ease both; transition: background .3s ease, border-color .3s ease, box-shadow .3s ease; }
.sm-pulse { animation: smPulse 1.8s ease-in-out infinite; }
.sm-shimmer { background: linear-gradient(90deg, ${colors.surface2} 0%, ${colors.border} 50%, ${colors.surface2} 100%); background-size: 800px 100%; animation: smShimmer 1.4s linear infinite; }
.sm-card { background: ${colors.glassFill}; border: 1px solid ${colors.glassBorder}; border-radius: 16px; backdrop-filter: blur(24px); -webkit-backdrop-filter: blur(24px); transition: transform .25s ease, box-shadow .25s ease, background .3s ease, border-color .3s ease, backdrop-filter .3s ease; box-shadow: ${colors.glassShadow}, inset 0 1px 0 ${colors.glassHighlight}; }
.sm-card:hover { transform: translateY(-2px); background: ${colors.glassFillStrong}; border-color: ${colors.glassBorderElevated}; backdrop-filter: blur(32px); -webkit-backdrop-filter: blur(32px); box-shadow: ${colors.glassShadow}, inset 0 1px 0 ${colors.glassHighlight}; }
.sm-glow-wrap { position: relative; }
.sm-glow-wrap .sm-glow { position: absolute; inset: -18px; border-radius: 26px; filter: blur(28px); opacity: .32; z-index: -1; pointer-events: none; transition: opacity .3s ease; }
.sm-glow-wrap:hover .sm-glow { opacity: .48; }
.sm-kpi-accent-line { position: absolute; top: 0; left: 0; right: 0; height: 3px; border-radius: 16px 16px 0 0; }
.sm-sidebar-glass { background: ${colors.glassFill}; backdrop-filter: blur(32px); -webkit-backdrop-filter: blur(32px); border: 1px solid ${colors.glassBorder}; box-shadow: ${colors.glassShadow}, inset 0 1px 0 ${colors.glassHighlight}; }
.sm-mobile-nav-glass { background: ${colors.glassFillStrong}; backdrop-filter: blur(28px); -webkit-backdrop-filter: blur(28px); border: 1px solid ${colors.glassBorderElevated}; box-shadow: ${colors.glassShadow}, inset 0 1px 0 ${colors.glassHighlight}; }
.sm-modal-glass { background: ${colors.modalBg} !important; border: 1px solid ${colors.modalBorder} !important; backdrop-filter: blur(40px) !important; -webkit-backdrop-filter: blur(40px) !important; }
.sm-tab-btn { position: relative; transition: color .2s ease; }
.sm-chip { transition: all .18s ease; }
.sm-chip:hover { transform: translateY(-1px); }
.sm-row { transition: background .15s ease; }
.sm-row:hover { background: ${colors.glassFillStrong}; }
.sm-btn { background: ${colors.glassFill}; border: 1px solid ${colors.glassBorder}; backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); transition: transform .2s ease, box-shadow .2s ease, background .2s ease; box-shadow: 0 4px 16px rgba(0,0,0,.18), inset 0 1px 0 ${colors.glassHighlight}; }
.sm-btn:hover { transform: translateY(-2px); background: ${colors.glassFillStrong}; box-shadow: 0 6px 20px rgba(0,0,0,.22), inset 0 1px 0 ${colors.glassHighlight}; }
.sm-btn:active { transform: translateY(0); box-shadow: inset 0 2px 8px rgba(0,0,0,.25); }
.sm-progress-fill { transition: width 1s cubic-bezier(.16,1,.3,1); }
.sm-drop { transition: border-color .2s ease, background .2s ease; }
.sm-scale-in { animation: smFadeUp .5s cubic-bezier(.16,1,.3,1) both; }
`;


/* ============================================================================
   UPLOAD / EXPORT
============================================================================ */

export default function SalesMonitoringApp() {
  // Dibaca sekali di render pertama (lazy initializer useState menjamin ini
  // hanya jalan sekali, bukan setiap render) — jadi field-field di bawahnya
  // bisa langsung memakai nilai tersimpan kalau ada, atau fallback ke default.
  const [persistedSettings] = useState(() => loadSettings());

  const [rawRows, setRawRows] = useState([]);
  const [fileName, setFileName] = useState("");
  const [loading, setLoading] = useState(false);
  const [sampleLoading, setSampleLoading] = useState(false);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("main");
  const [theme, setTheme] = useState(persistedSettings?.theme || 'dark');
  // Status collapse sidebar desktop — diingat lintas sesi sama seperti tema.
  const [sidebarCollapsed, setSidebarCollapsed] = useState(persistedSettings?.sidebarCollapsed ?? false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
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

  const [filters, setFilters] = useState(persistedSettings?.filters || { salesCodes: [], groups: [], dateFrom: "", dateTo: "" });
  const [workDays, setWorkDays] = useState(persistedSettings?.workDays ?? WORK_DAYS_DEFAULT);
  const [targets, setTargets] = useState(persistedSettings?.targets ?? DEFAULT_TARGETS);
  const [depotName, setDepotName] = useState(persistedSettings?.depotName ?? "DEPO LOTIM");
  // Metode proyeksi terpilih di ProjectionCard (linear/trend7/weekday) —
  // disimpan lintas sesi seperti pengaturan lain, konsisten dengan preferensi
  // user yang sifatnya "cara pandang data", bukan data itu sendiri.
  const [projectionMethod, setProjectionMethod] = useState(persistedSettings?.projectionMethod ?? "linear");

  // Muat data sesi terakhir (hasil upload/demo sebelumnya) dari IndexedDB saat
  // pertama kali app dibuka. Async, jadi ditampilkan status loading singkat
  // dulu supaya tidak "flash" ke tampilan "Belum ada data" sebelum sempat dicek.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const session = await loadSession();
      if (!cancelled && session) {
        setRawRows(session.rawRows || []);
        setFileName(session.fileName || "");
        setParseMeta(session.parseMeta || null);
      }
      if (!cancelled) setSessionLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  // Simpan otomatis setiap kali pengaturan berubah (tema, filter, target,
  // hari kerja, nama depo) — jadi tidak perlu tombol "simpan" terpisah untuk ini,
  // beda dengan raw data yang lebih berat dan disimpan terpisah di bawah.
  useEffect(() => {
    saveSettings({ theme, filters, workDays, targets, depotName, projectionMethod, sidebarCollapsed });
  }, [theme, filters, workDays, targets, depotName, projectionMethod, sidebarCollapsed]);

  // Simpan otomatis data transaksi ke IndexedDB tiap kali berubah (setelah upload
  // dikonfirmasi atau data contoh dimuat). Di-skip saat kosong karena reset
  // ditangani secara eksplisit lewat clearSession() di handleReset.
  useEffect(() => {
    if (rawRows.length) saveSession({ rawRows, fileName, parseMeta });
  }, [rawRows, fileName, parseMeta]);

  /* --------------------------- PWA: instal & update --------------------------- */

  // registerType: 'prompt' di vite.config.js — jadi kalau ada versi baru ter-deploy,
  // tidak langsung auto-reload (bisa bikin filter/upload yang lagi dikerjakan hilang),
  // tapi tampilkan notifikasi dan biarkan user pilih kapan mau refresh.
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW({});

  const [installPromptEvent, setInstallPromptEvent] = useState(null);
  const [showIosInstallHint, setShowIosInstallHint] = useState(false);

  const isIOS = useMemo(() => /iphone|ipad|ipod/i.test(window.navigator.userAgent), []);
  const isStandalone = useMemo(() =>
    window.matchMedia?.("(display-mode: standalone)").matches || window.navigator.standalone === true
  , []);

  useEffect(() => {
    // Chrome/Android/Edge menembak event ini kalau app memenuhi syarat installability
    // (manifest valid, service worker terdaftar, dsb). Kita cegah prompt otomatis
    // browser (preventDefault), simpan eventnya, lalu munculkan tombol custom sendiri.
    const handler = (e) => { e.preventDefault(); setInstallPromptEvent(e); };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstallClick = useCallback(async () => {
    if (installPromptEvent) {
      installPromptEvent.prompt();
      await installPromptEvent.userChoice;
      setInstallPromptEvent(null);
    } else if (isIOS) {
      // iOS Safari tidak punya beforeinstallprompt — harus manual lewat menu Share.
      setShowIosInstallHint(true);
    }
  }, [installPromptEvent, isIOS]);

  const canShowInstallButton = !isStandalone && (!!installPromptEvent || isIOS);

  const colors = useMemo(() => THEMES[theme], [theme]);
  const globalStyle = useMemo(() => createGlobalStyle(colors), [colors]);

  const groupOptions = useMemo(() => {
    const s = new Set();
    targets.forEach((t) => t.groups.forEach((g) => s.add(g.name)));
    rawRows.forEach((r) => r.group && s.add(r.group));
    return Array.from(s).sort();
  }, [targets, rawRows]);

  const salesOptions = useMemo(() => targets.map((t) => ({ name: t.name, code: t.code })), [targets]);
  const aggFinal = useAggregates(rawRows, targets, filters, workDays);
  const dataQualityNotes = useDataQualityNotes(rawRows, targets, parseMeta);
  const openDrilldown = (title, subtitle, predicate) => {
    setDrilldown({ title, subtitle, outlets: getOutletBreakdown(aggFinal.filteredRows, predicate) });
  };

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

  const autoTrendComparisonData = useMemo(() => {
    if (detectedMonths.length < 2) return null;
    // Filter sales/grup tetap dihormati, tapi dateFrom/dateTo dipaksa ke
    // batas bulan masing-masing — mengabaikan filter tanggal global yang
    // mungkin sedang aktif di tab lain (deteksi ini soal DATA YANG DI-UPLOAD,
    // bukan soal apa yang sedang difilter di layar sekarang).
    const monthlyAggs = detectedMonths.map((m) =>
      computeAggregates(rawRows, targets, { salesCodes: filters.salesCodes, groups: filters.groups, dateFrom: m.dateFrom, dateTo: m.dateTo }, workDays)
    );
    const latest = detectedMonths[detectedMonths.length - 1];
    const latestAgg = monthlyAggs[monthlyAggs.length - 1];
    const earlierSnapshots = detectedMonths.slice(0, -1).map((m, i) =>
      buildHistorySnapshot(monthlyAggs[i], { dateFrom: m.dateFrom, dateTo: m.dateTo }, fileName, m.label)
    );
    return computeMultiPeriodComparison(latestAgg, earlierSnapshots, { dateFrom: latest.dateFrom, dateTo: latest.dateTo }, fileName);
  }, [detectedMonths, rawRows, targets, filters.salesCodes, filters.groups, workDays, fileName]);

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

  const saveHistorySnapshot = (label) => {
    const snap = buildHistorySnapshot(aggFinal, filters, fileName, label);
    setHistory((prev) => {
      const next = [snap, ...prev].slice(0, 8);
      saveHistory(next);
      return next;
    });
    setIsHistoryOpen(false);
  };
  const deleteHistorySnapshot = (id) => {
    setHistory((prev) => {
      const next = prev.filter((h) => h.id !== id);
      saveHistory(next);
      return next;
    });
    setComparisonSnapshot((cur) => (cur && cur.id === id ? null : cur));
    setTrendSnapshotIds((cur) => cur.filter((x) => x !== id));
  };

  // Dipanggil dari SettingsModal saat import file backup — GABUNGKAN snapshot
  // dari file dengan riwayat yang sudah ada di device ini (bukan menimpa total),
  // supaya import dari device lain tidak menghapus riwayat lokal yang belum
  // sempat di-backup. Kalau ada id yang sama persis, versi dari file yang menang.
  const importHistoryMerge = (importedHistory) => {
    setHistory((prev) => {
      const byId = new Map(prev.map((h) => [h.id, h]));
      (importedHistory || []).forEach((h) => byId.set(h.id, h));
      const next = Array.from(byId.values())
        .sort((a, b) => (b.dateFrom || b.savedAt || "").localeCompare(a.dateFrom || a.savedAt || ""))
        .slice(0, 8); // konsisten dengan batas di saveHistorySnapshot
      saveHistory(next);
      return next;
    });
  };


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
      // Data belum langsung dipakai — tampilkan preview dulu, biar kesalahan format
      // (kolom tidak terbaca, tanggal kosong, dsb) ketahuan sebelum masuk ke dashboard.
      setPendingPreview({ rows: combinedRows, parseMeta: combinedMeta, fileName: combinedName });
    } catch (e) {
      setError("Gagal membaca salah satu file. Pastikan semua format .xlsx/.xls valid.");
    } finally { setLoading(false); }
  }, []);

  const confirmPreview = useCallback(() => {
    if (!pendingPreview) return;
    const { rows, parseMeta: meta, fileName: name } = pendingPreview;
    setRawRows(rows);
    setParseMeta(meta);
    setFileName(name);
    const dateStrs = rows.map(r => r.date).filter(Boolean).sort();
    if (dateStrs.length) {
      setFilters(f => ({ ...f, dateFrom: dateStrs[0], dateTo: dateStrs[dateStrs.length - 1] }));
    }
    setPendingPreview(null);
  }, [pendingPreview]);

  const cancelPreview = useCallback(() => setPendingPreview(null), []);

  const handleSample = useCallback(() => {
    setSampleLoading(true);
    // Simulasi loading agar terasa responsif
    setTimeout(() => {
      const sampleRows = generateSampleRows();
      setRawRows(sampleRows);
      setFileName("Data Contoh (demo)");
      setParseMeta({ totalDataRows: sampleRows.length, skippedBlankRows: 0, rowsWithMissingDate: 0,
        detectedFields: Object.keys(ALIASES), missingFields: [] });
      setFilters({ salesCodes: [], groups: [], dateFrom: "2026-07-01", dateTo: "2026-07-03" });
      setSampleLoading(false);
    }, 300);
  }, []);

  const handleReset = useCallback(() => {
    setRawRows([]); setFileName(""); setParseMeta(null);
    clearSession();
  }, []);

  // Hapus TOTAL semua yang tersimpan di perangkat ini: settings (localStorage)
  // + data sesi (IndexedDB) + reset semua state ke default pabrik.
  const handleClearAll = useCallback(() => {
    clearSettings();
    clearSession();
    clearHistory();
    setRawRows([]); setFileName(""); setParseMeta(null);
    setFilters({ salesCodes: [], groups: [], dateFrom: "", dateTo: "" });
    setWorkDays(WORK_DAYS_DEFAULT);
    setTargets(DEFAULT_TARGETS);
    setDepotName("DEPO LOTIM");
    setTheme('dark');
    setHistory([]);
    setComparisonSnapshot(null);
    setTrendSnapshotIds([]);
  }, []);

  return (
    <div className="smapp min-h-screen transition-colors duration-300">
      <style>{globalStyle}</style>
      <div className="sm-mesh" aria-hidden="true">
        {colors.blobs.map((b, i) => (
          <div
            key={i}
            className={`blob blob-${i + 1}`}
            style={{ width: b.size, height: b.size, background: `rgba(${b.rgb},${b.opacity})` }}
          />
        ))}
      </div>
      <div className="relative" style={{ zIndex: 1 }}>
      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} targets={targets} setTargets={setTargets} workDays={workDays} setWorkDays={setWorkDays} depotName={depotName} setDepotName={setDepotName} onClearAll={handleClearAll} colors={colors}
        theme={theme} setTheme={setTheme} filters={filters} setFilters={setFilters} projectionMethod={projectionMethod} setProjectionMethod={setProjectionMethod} history={history} onImportHistory={importHistoryMerge} />
      <OutletDrilldownModal isOpen={!!drilldown} onClose={() => setDrilldown(null)} title={drilldown?.title} subtitle={drilldown?.subtitle} outlets={drilldown?.outlets || []} colors={colors} />
      <OutletDetailModal isOpen={!!outletDetail} onClose={() => setOutletDetail(null)} outlet={outletDetail} products={outletDetailProducts} colors={colors} />
      <DataPreviewModal isOpen={!!pendingPreview} onCancel={cancelPreview} onConfirm={confirmPreview} preview={pendingPreview} colors={colors} />
      <HistoryModal isOpen={isHistoryOpen} onClose={() => setIsHistoryOpen(false)} history={history} onSave={saveHistorySnapshot} onApply={applyHistorySelection}
        onDelete={deleteHistorySnapshot}
        defaultLabel={filters.dateFrom && filters.dateTo ? `${filters.dateFrom} — ${filters.dateTo}` : ""} colors={colors} />
      <MobileFab onFile={handleFile} colors={colors} loading={loading} />
      <MobileBottomNav primaryTabs={PRIMARY_TABS} moreTabs={MORE_TABS} activeTab={activeTab} onChange={setActiveTab} colors={colors} />
      <div className="flex items-start">
        <Sidebar activeTab={activeTab} onChangeTab={setActiveTab} collapsed={sidebarCollapsed} onToggleCollapse={() => setSidebarCollapsed((v) => !v)}
          onOpenHistory={() => setIsHistoryOpen(true)} onOpenSettings={() => setIsSettingsOpen(true)} historyDisabled={!rawRows.length} colors={colors} />
        <div className="flex-1 min-w-0">
      <div className="max-w-7xl mx-auto px-4 md:px-8 py-6 pb-28 md:pb-6">
        {/* header */}
        <div className="relative z-40 flex flex-wrap items-center justify-between gap-4 mb-6 sm-fadeup">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl" style={{ background: `linear-gradient(135deg, ${colors.gold}, ${colors.coral})` }}>
              <FileSpreadsheet size={20} color="#0A1120" />
            </div>
            <div>
              <h1 className="disp text-xl font-bold">Monitoring Penjualan<b className="text-xs" style={{ color: colors.textMuted }}> by</b><b className="disp text-xl font-bold" style={{ color: colors.coral }}> Andri.S</b></h1>
              <p className="text-xs" style={{ color: colors.textMuted }}>Dashboard pencapaian sales, produk & produk fokus</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {canShowInstallButton && (
              <button onClick={handleInstallClick}
                className="sm-btn flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold"
                style={{ background: colors.surface2, color: colors.text, border: `1px solid ${colors.border}` }}>
                <Smartphone size={15} /> <span className="hidden sm:inline">Instal Aplikasi</span>
              </button>
            )}
            <button onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}
              className="sm-btn flex items-center gap-2 px-2.5 py-2.5 rounded-xl text-sm font-semibold"
              style={{ background: colors.surface2, color: colors.text, border: `1px solid ${colors.border}` }}>
              {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
            </button>
            {/* Riwayat & Pengaturan: desktop sekarang lewat Sidebar (section
                Tools), jadi tombol ini disembunyikan mulai breakpoint md.
                Mobile tetap butuh ini karena tidak punya Sidebar sama sekali. */}
            <button onClick={() => setIsHistoryOpen(true)} disabled={!rawRows.length}
              className="sm-btn flex md:hidden items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-40"
              style={{ background: colors.surface2, color: colors.text, border: `1px solid ${colors.border}` }}>
              <History size={15} /> <span className="hidden sm:inline">Riwayat</span>
            </button>
            <button onClick={() => setIsSettingsOpen(true)}
              className="sm-btn flex md:hidden items-center gap-2 px-2.5 py-2.5 rounded-xl text-sm font-semibold"
              style={{ background: colors.surface2, color: colors.text, border: `1px solid ${colors.border}` }}>
              <Settings size={15} />
            </button>
            <ExportMenu agg={aggFinal} targets={targets} workDays={workDays} depotName={depotName} disabled={!rawRows.length} colors={colors} />
          </div>
        </div>

        {/* PWA: notifikasi pertama kali app siap dipakai offline */}
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
                className="sm-btn px-3 py-1.5 rounded-lg text-xs font-semibold" style={{ border: `1px solid ${colors.border}` }}>
                Nanti
              </button>
            </div>
          </div>
        )}

        {/* PWA: instruksi manual instal untuk iOS Safari (tidak ada beforeinstallprompt) */}
        {showIosInstallHint && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm sm-fadein" onClick={() => setShowIosInstallHint(false)}>
            <div className="sm-card sm-scale-in w-full max-w-sm p-5" style={{ background: colors.surface }} onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl" style={{ background: colors.gold + "1A" }}><Smartphone size={16} style={{ color: colors.gold }} /></div>
                  <div className="disp text-base font-semibold">Instal di iPhone/iPad</div>
                </div>
                <button onClick={() => setShowIosInstallHint(false)} className="sm-btn p-2 rounded-full" style={{ background: colors.surface2 }}><X size={16} /></button>
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
          <div className="sm-card p-16 text-center sm-fadeup">
            <div className="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center" style={{ background: colors.surface2 }}>
              <FileSpreadsheet size={24} style={{ color: colors.textMuted }} />
            </div>
            <div className="disp text-base font-semibold mb-1">Belum ada data</div>
            <p className="text-sm" style={{ color: colors.textMuted }}>Upload file Excel sell-out di atas, atau coba dengan data contoh untuk melihat dashboard bekerja.</p>
          </div>
        ) : (
          <>
            <FilterBar salesOptions={salesOptions} groupOptions={groupOptions} filters={filters} setFilters={setFilters} colors={colors} theme={theme} />
            {activeTab === "main" && <MainReportPage agg={aggFinal} workDays={workDays} colors={colors} onDrilldown={openDrilldown} comparison={comparison} onClearComparison={() => setComparisonSnapshot(null)} projectionMethod={projectionMethod} onProjectionMethodChange={setProjectionMethod} />}
            {activeTab === "sales" && <SalesReportPage agg={aggFinal} colors={colors} onDrilldown={openDrilldown} workDays={workDays} depotName={depotName} />}
            {activeTab === "product" && <ProductReportPage agg={aggFinal} colors={colors} onDrilldown={openDrilldown} />}
            {activeTab === "focus" && <ProductFocusReportPage agg={aggFinal} colors={colors} onDrilldown={openDrilldown} />}
            {activeTab === "outlet" && <OutletAnalysisPage agg={aggFinal} colors={colors} thresholds={outletThresholds} setThresholds={setOutletThresholds} onSelectOutlet={openOutletDetail} />}
            {activeTab === "transactions" && <TransactionsPage agg={aggFinal} colors={colors} onOutletDrilldown={openOutletDetail} />}
            {activeTab === "quality" && <DataQualityPage notes={dataQualityNotes} colors={colors} onDrilldown={openDrilldown} />}
            {activeTab === "trend" && <TrendPeriodePage comparisonData={finalTrendComparisonData} isAutoTrend={isAutoTrend} colors={colors} onOpenPeriodPicker={() => setIsHistoryOpen(true)} selectedCount={trendSnapshotIds.length} />}
          </>
        )}

        <div className="text-center text-xs mt-10 pb-4" style={{ color: colors.textMuted }}>
          Data diproses langsung di browser Anda — tidak diunggah ke server manapun. Data & pengaturan disimpan otomatis di perangkat/browser ini agar tidak hilang saat refresh.
        </div>
      </div>
        </div>
      </div>
      </div>
    </div>
  );
}
