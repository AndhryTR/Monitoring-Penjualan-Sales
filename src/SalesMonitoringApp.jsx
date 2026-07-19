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
import { THEMES } from "./constants/colors.js";

/* Global style is now in index.css - no more createGlobalStyle injection */

export default function SalesMonitoringApp() {
  const [persistedSettings] = useState(() => loadSettings());

  const [rawRows, setRawRows] = useState([]);
  const [fileName, setFileName] = useState("");
  const [loading, setLoading] = useState(false);
  const [sampleLoading, setSampleLoading] = useState(false);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("main");
  const [theme, setTheme] = useState(persistedSettings?.theme || 'dark');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(persistedSettings?.sidebarCollapsed ?? false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [drilldown, setDrilldown] = useState(null);
  const [pendingPreview, setPendingPreview] = useState(null);
  const [parseMeta, setParseMeta] = useState(null);
  const [history, setHistory] = useState(() => loadHistory());
  const [comparisonSnapshot, setComparisonSnapshot] = useState(null);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [trendSnapshotIds, setTrendSnapshotIds] = useState([]);

  const [filters, setFilters] = useState(persistedSettings?.filters || { salesCodes: [], groups: [], dateFrom: "", dateTo: "" });
  const [workDays, setWorkDays] = useState(persistedSettings?.workDays ?? WORK_DAYS_DEFAULT);
  const [targets, setTargets] = useState(persistedSettings?.targets ?? DEFAULT_TARGETS);
  const [depotName, setDepotName] = useState(persistedSettings?.depotName ?? "DEPO LOTIM");
  const [projectionMethod, setProjectionMethod] = useState(persistedSettings?.projectionMethod ?? "linear");

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

  useEffect(() => {
    saveSettings({ theme, filters, workDays, targets, depotName, projectionMethod, sidebarCollapsed });
  }, [theme, filters, workDays, targets, depotName, projectionMethod, sidebarCollapsed]);

  useEffect(() => {
    if (rawRows.length) saveSession({ rawRows, fileName, parseMeta });
  }, [rawRows, fileName, parseMeta]);

  // Apply theme class for CSS targeting
  useEffect(() => {
    const root = document.querySelector(".smapp");
    if (root) root.classList.toggle("light", theme === "light");
  }, [theme]);

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
    const handler = (e) => { e.preventDefault(); setInstallPromptEvent(e); };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstallClick = useCallback(async () => {
    if (installPromptEvent) {
      installPromptEvent.prompt();
      await installPromptEvent.userChoice;
      setInstallPromptEvent(null);
    } else if (isIOS) { setShowIosInstallHint(true); }
  }, [installPromptEvent, isIOS]);

  const canShowInstallButton = !isStandalone && (!!installPromptEvent || isIOS);

  const colors = useMemo(() => THEMES[theme], [theme]);

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

  const trendSnapshots = useMemo(() => history.filter((h) => trendSnapshotIds.includes(h.id)), [history, trendSnapshotIds]);
  const trendComparisonData = useMemo(
    () => trendSnapshots.length > 0 ? computeMultiPeriodComparison(aggFinal, trendSnapshots, filters, fileName) : null,
    [aggFinal, trendSnapshots, filters, fileName]
  );

  const detectedMonths = useMemo(() => detectMonths(rawRows), [rawRows]);
  const autoTrendComparisonData = useMemo(() => {
    if (detectedMonths.length < 2) return null;
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

  const isAutoTrend = trendSnapshotIds.length === 0 && !!autoTrendComparisonData;
  const finalTrendComparisonData = trendSnapshotIds.length > 0 ? trendComparisonData : autoTrendComparisonData;

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
    setHistory((prev) => { const next = [snap, ...prev].slice(0, 8); saveHistory(next); return next; });
    setIsHistoryOpen(false);
  };
  const deleteHistorySnapshot = (id) => {
    setHistory((prev) => { const next = prev.filter((h) => h.id !== id); saveHistory(next); return next; });
    setComparisonSnapshot((cur) => (cur && cur.id === id ? null : cur));
    setTrendSnapshotIds((cur) => cur.filter((x) => x !== id));
  };

  const importHistoryMerge = (importedHistory) => {
    setHistory((prev) => {
      const byId = new Map(prev.map((h) => [h.id, h]));
      (importedHistory || []).forEach((h) => byId.set(h.id, h));
      const next = Array.from(byId.values()).sort((a, b) => (b.dateFrom || b.savedAt || "").localeCompare(a.dateFrom || a.savedAt || "")).slice(0, 8);
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
      if (!combinedRowsRaw.length) { setError("File terbaca tapi tidak ada baris data yang cocok."); setLoading(false); return; }
      const { rows: combinedRows, duplicateCount } = dedupeRows(combinedRowsRaw);
      const detectedSet = new Set();
      results.forEach((r) => r.parseMeta.detectedFields.forEach((f) => detectedSet.add(f)));
      const missingInAll = Object.keys(ALIASES).filter((f) => results.every((r) => r.parseMeta.missingFields.includes(f)));
      const combinedMeta = {
        totalDataRows: sumBy(results, (r) => r.parseMeta.totalDataRows),
        skippedBlankRows: sumBy(results, (r) => r.parseMeta.skippedBlankRows),
        rowsWithMissingDate: sumBy(results, (r) => r.parseMeta.rowsWithMissingDate),
        detectedFields: Array.from(detectedSet), missingFields: missingInAll, duplicateRowsRemoved: duplicateCount,
        sourceFiles: results.map((r, i) => ({ name: fileList[i].name, rowCount: r.rows.length })),
      };
      const combinedName = fileList.length > 1 ? `${fileList.length} file digabung (${fileList.map((f) => f.name).join(", ")})` : fileList[0].name;
      setPendingPreview({ rows: combinedRows, parseMeta: combinedMeta, fileName: combinedName });
    } catch (e) { setError("Gagal membaca salah satu file."); } finally { setLoading(false); }
  }, []);

  const confirmPreview = useCallback(() => {
    if (!pendingPreview) return;
    const { rows, parseMeta: meta, fileName: name } = pendingPreview;
    setRawRows(rows); setParseMeta(meta); setFileName(name);
    const dateStrs = rows.map(r => r.date).filter(Boolean).sort();
    if (dateStrs.length) setFilters(f => ({ ...f, dateFrom: dateStrs[0], dateTo: dateStrs[dateStrs.length - 1] }));
    setPendingPreview(null);
  }, [pendingPreview]);
  const cancelPreview = useCallback(() => setPendingPreview(null), []);

  const handleSample = useCallback(() => {
    setSampleLoading(true);
    setTimeout(() => {
      const sampleRows = generateSampleRows();
      setRawRows(sampleRows); setFileName("Data Contoh (demo)");
      setParseMeta({ totalDataRows: sampleRows.length, skippedBlankRows: 0, rowsWithMissingDate: 0, detectedFields: Object.keys(ALIASES), missingFields: [] });
      setFilters({ salesCodes: [], groups: [], dateFrom: "2026-07-01", dateTo: "2026-07-03" });
      setSampleLoading(false);
    }, 300);
  }, []);

  const handleReset = useCallback(() => { setRawRows([]); setFileName(""); setParseMeta(null); clearSession(); }, []);

  const handleClearAll = useCallback(() => {
    clearSettings(); clearSession(); clearHistory();
    setRawRows([]); setFileName(""); setParseMeta(null);
    setFilters({ salesCodes: [], groups: [], dateFrom: "", dateTo: "" });
    setWorkDays(WORK_DAYS_DEFAULT); setTargets(DEFAULT_TARGETS); setDepotName("DEPO LOTIM");
    setTheme('dark'); setHistory([]); setComparisonSnapshot(null); setTrendSnapshotIds([]);
  }, []);

  return (
    <div className={`smapp min-h-screen transition-colors duration-300 ${theme === 'light' ? 'light' : ''}`} style={{ background: theme === 'dark' ? '#0A1120' : '#F9FAFB', color: colors.text }}>
      {/* Animated gradient blobs */}
      <div className="blob-container">
        <div className="blob blob-1" />
        <div className="blob blob-2" />
        <div className="blob blob-3" />
        <div className="blob blob-4" />
        <div className="blob blob-5" />
      </div>

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
      <div className="flex items-start relative z-[1]">
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
              <button onClick={handleInstallClick} className="glass-btn flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold">
                <Smartphone size={15} /> <span className="hidden sm:inline">Instal Aplikasi</span>
              </button>
            )}
            <button onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}
              className="glass-btn flex items-center gap-2 px-2.5 py-2.5 rounded-xl text-sm font-semibold">
              {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
            </button>
            <button onClick={() => setIsHistoryOpen(true)} disabled={!rawRows.length}
              className="glass-btn flex md:hidden items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-40">
              <History size={15} />
            </button>
            <button onClick={() => setIsSettingsOpen(true)}
              className="glass-btn flex md:hidden items-center gap-2 px-2.5 py-2.5 rounded-xl text-sm font-semibold">
              <Settings size={15} />
            </button>
            <ExportMenu agg={aggFinal} targets={targets} workDays={workDays} depotName={depotName} disabled={!rawRows.length} colors={colors} />
          </div>
        </div>

        {/* PWA notifications */}
        {offlineReady && !needRefresh && (
          <div className="mb-6 sm-fadeup glass-panel flex items-center justify-between gap-3 px-4 py-3" style={{ background: colors.mint + "14", border: `1px solid ${colors.mint}44` }}>
            <div className="flex items-center gap-2.5 text-sm">
              <CheckCircle2 size={15} style={{ color: colors.mint }} />
              <span>Aplikasi siap dipakai walau tanpa internet.</span>
            </div>
            <button onClick={() => setOfflineReady(false)} className="glass-btn p-1.5 rounded-lg" style={{ color: colors.textMuted }}><X size={14} /></button>
          </div>
        )}
        {needRefresh && (
          <div className="mb-6 sm-fadeup glass-panel flex items-center justify-between gap-3 px-4 py-3" style={{ background: colors.gold + "14", border: `1px solid ${colors.gold}44` }}>
            <div className="flex items-center gap-2.5 text-sm">
              <RefreshCw size={15} style={{ color: colors.gold }} />
              <span>Versi baru aplikasi tersedia.</span>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => updateServiceWorker(true)} className="glass-btn px-3 py-1.5 rounded-lg text-xs font-semibold" style={{ background: colors.gold, color: "#0A1120" }}>Perbarui Sekarang</button>
              <button onClick={() => setNeedRefresh(false)} className="glass-btn px-3 py-1.5 rounded-lg text-xs font-semibold">Nanti</button>
            </div>
          </div>
        )}

        {showIosInstallHint && (
          <div className="fixed inset-0 z-50 flex items-center justify-center glass-backdrop sm-fadein" onClick={() => setShowIosInstallHint(false)}>
            <div className="glass-modal sm-scale-in w-full max-w-sm p-5" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl" style={{ background: colors.gold + "1A" }}><Smartphone size={16} style={{ color: colors.gold }} /></div>
                  <div className="disp text-base font-semibold">Instal di iPhone/iPad</div>
                </div>
                <button onClick={() => setShowIosInstallHint(false)} className="glass-btn p-2 rounded-full"><X size={16} /></button>
              </div>
              <ol className="text-sm space-y-2.5" style={{ color: colors.text }}>
                <li className="flex items-start gap-2.5"><span className="mono font-semibold shrink-0" style={{ color: colors.gold }}>1.</span><span className="flex items-center gap-1.5 flex-wrap">Tap ikon <Share size={14} style={{ color: colors.gold }} /> <b>Share</b> di bar bawah Safari</span></li>
                <li className="flex items-start gap-2.5"><span className="mono font-semibold shrink-0" style={{ color: colors.gold }}>2.</span><span>Pilih <b>"Add to Home Screen"</b></span></li>
                <li className="flex items-start gap-2.5"><span className="mono font-semibold shrink-0" style={{ color: colors.gold }}>3.</span><span>Tap <b>"Add"</b> di pojok kanan atas</span></li>
              </ol>
            </div>
          </div>
        )}

        {/* upload */}
        <div className="mb-6 sm-fadeup" style={{ animationDelay: "40ms" }}>
          <UploadDropzone onFile={handleFile} hasData={!!rawRows.length} fileName={fileName} onReset={handleReset} onSample={handleSample} loading={loading} sampleLoading={sampleLoading} colors={colors} />
          {error && (
            <div className="mt-3 glass-panel flex items-center gap-2 text-sm px-4 py-2.5" style={{ background: colors.coral + "14", color: colors.coral, border: `1px solid ${colors.coral}33` }}>
              <AlertTriangle size={14} /> {error}
            </div>
          )}
        </div>

        {sessionLoading ? (
          <DashboardSkeleton colors={colors} />
        ) : !rawRows.length ? (
          <div className="glass-panel p-16 text-center sm-fadeup">
            <div className="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center" style={{ background: "rgba(255,255,255,0.06)" }}>
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
  );
}
