import React, { createContext, useContext, useState, useMemo, useCallback, useEffect } from "react";
import sumBy from "lodash/sumBy";
import {
  parseWorkbookFile, dedupeRows,
} from "../utils/excelParse.js";
import {
  useAggregates, computeAggregates, detectMonths, getOutletBreakdown, getProductBreakdownForOutlet,
} from "../utils/aggregation.js";
import { useDataQualityNotes } from "../utils/dataQuality.js";
import { buildHistorySnapshot, computeComparison, computeMultiPeriodComparison } from "../utils/history.js";
import { generateSampleRows } from "../utils/sampleData.js";
import { ALIASES } from "../constants/aliases.js";
import { WORK_DAYS_DEFAULT } from "../constants/thresholds.js";
import DEFAULT_TARGETS from "../constants/defaultTargets.json";
import { saveSettings, loadSettings, clearSettings, saveSession, loadSession, clearSession, saveHistory, loadHistory, clearHistory } from "../utils/storage.js";

const DataContext = createContext(null);

export function DataProvider({ children }) {
  const [persistedSettings] = useState(() => loadSettings());

  const [rawRows, setRawRows] = useState([]);
  const [fileName, setFileName] = useState("");
  const [loading, setLoading] = useState(false);
  const [sampleLoading, setSampleLoading] = useState(false);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("main");
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
  const [outletThresholds, setOutletThresholds] = useState({ activeMaxDays: 14, dormantMinDays: 30 });
  const [outletDetail, setOutletDetail] = useState(null);

  // Persist theme settings
  const [theme, setTheme] = useState(persistedSettings?.theme || 'dark');

  // Load session on mount
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

  // Auto-save settings
  useEffect(() => {
    saveSettings({ theme, filters, workDays, targets, depotName, projectionMethod, sidebarCollapsed });
  }, [theme, filters, workDays, targets, depotName, projectionMethod, sidebarCollapsed]);

  // Auto-save session data
  useEffect(() => {
    if (rawRows.length) saveSession({ rawRows, fileName, parseMeta });
  }, [rawRows, fileName, parseMeta]);

  const groupOptions = useMemo(() => {
    const s = new Set();
    targets.forEach((t) => t.groups.forEach((g) => s.add(g.name)));
    rawRows.forEach((r) => r.group && s.add(r.group));
    return Array.from(s).sort();
  }, [targets, rawRows]);

  const salesOptions = useMemo(() => targets.map((t) => ({ name: t.name, code: t.code })), [targets]);
  const aggFinal = useAggregates(rawRows, targets, filters, workDays);
  const dataQualityNotes = useDataQualityNotes(rawRows, targets, parseMeta);

  const openDrilldown = useCallback((title, subtitle, predicate) => {
    setDrilldown({ title, subtitle, outlets: getOutletBreakdown(aggFinal.filteredRows, predicate) });
  }, [aggFinal.filteredRows]);

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

  const saveHistorySnapshot = useCallback((label) => {
    const snap = buildHistorySnapshot(aggFinal, filters, fileName, label);
    setHistory((prev) => {
      const next = [snap, ...prev].slice(0, 8);
      saveHistory(next);
      return next;
    });
    setIsHistoryOpen(false);
  }, [aggFinal, filters, fileName]);

  const deleteHistorySnapshot = useCallback((id) => {
    setHistory((prev) => {
      const next = prev.filter((h) => h.id !== id);
      saveHistory(next);
      return next;
    });
    setComparisonSnapshot((cur) => (cur && cur.id === id ? null : cur));
    setTrendSnapshotIds((cur) => cur.filter((x) => x !== id));
  }, []);

  const importHistoryMerge = useCallback((importedHistory) => {
    setHistory((prev) => {
      const byId = new Map(prev.map((h) => [h.id, h]));
      (importedHistory || []).forEach((h) => byId.set(h.id, h));
      const next = Array.from(byId.values())
        .sort((a, b) => (b.dateFrom || b.savedAt || "").localeCompare(a.dateFrom || a.savedAt || ""))
        .slice(0, 8);
      saveHistory(next);
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

  const value = useMemo(() => ({
    rawRows, fileName, loading, sampleLoading, sessionLoading, error,
    activeTab, setActiveTab, sidebarCollapsed, setSidebarCollapsed,
    isSettingsOpen, setIsSettingsOpen, drilldown, setDrilldown,
    pendingPreview, setPendingPreview, parseMeta, setParseMeta,
    history, comparisonSnapshot, setComparisonSnapshot,
    isHistoryOpen, setIsHistoryOpen, trendSnapshotIds, setTrendSnapshotIds,
    filters, setFilters, workDays, setWorkDays,
    targets, setTargets, depotName, setDepotName,
    projectionMethod, setProjectionMethod,
    outletThresholds, setOutletThresholds,
    outletDetail, setOutletDetail, outletDetailProducts,
    theme, setTheme,
    groupOptions, salesOptions, aggFinal, dataQualityNotes,
    openDrilldown, comparison,
    finalTrendComparisonData, isAutoTrend,
    applyHistorySelection, saveHistorySnapshot, deleteHistorySnapshot,
    importHistoryMerge, handleFile, confirmPreview, cancelPreview,
    handleSample, handleReset, handleClearAll,
  }), [
    rawRows, fileName, loading, sampleLoading, sessionLoading, error,
    activeTab, sidebarCollapsed, isSettingsOpen, drilldown,
    pendingPreview, parseMeta, history, comparisonSnapshot,
    isHistoryOpen, trendSnapshotIds, filters, workDays, targets, depotName,
    projectionMethod, outletThresholds, outletDetail, outletDetailProducts,
    theme, groupOptions, salesOptions, aggFinal, dataQualityNotes,
    comparison, finalTrendComparisonData, isAutoTrend,
  ]);

  return (
    <DataContext.Provider value={value}>
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useData must be used within DataProvider");
  return ctx;
}
