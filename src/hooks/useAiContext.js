import { useMemo } from "react";
import { computeAggregates, detectMonths } from "../utils/aggregation.js";

/**
 * Hook untuk menyusun konteks ringkas bagi asisten AI.
 * Komputasi berat hanya berjalan saat laci AI Chat dibuka.
 */
export function useAiContext({
  isAiChatOpen,
  rawRows,
  targets,
  filters,
  workDays,
  aggFinal,
  depotName,
  depots,
  stockData,
}) {
  const aggAll = useMemo(
    () => (isAiChatOpen && rawRows.length
      ? computeAggregates(rawRows, targets, { salesCodes: filters.salesCodes, groups: filters.groups, dateFrom: "", dateTo: "" }, workDays)
      : null),
    [isAiChatOpen, rawRows, targets, filters.salesCodes, filters.groups, workDays]
  );

  const aiBulanan = useMemo(() => {
    if (!isAiChatOpen || !rawRows.length) return [];
    const months = detectMonths(rawRows);
    if (months.length < 1) return [];
    return months.map((m) => {
      try {
        const a = computeAggregates(rawRows, targets, { salesCodes: filters.salesCodes, groups: [], dateFrom: m.dateFrom, dateTo: m.dateTo }, workDays);
        return {
          bulan: m.key,
          label: m.label,
          total: a.totals?.realisasiValue ?? 0,
          target: a.totals?.targetValue ?? 0,
          ach: a.totals?.ach != null ? Math.round(a.totals.ach * 1000) / 10 : null,
          ao: a.totals?.realisasiAo ?? 0,
          nBaris: (a.filteredRows || []).length,
          sales: (a.bySales || []).map((s) => ({
            kode: s.code,
            nama: s.name,
            ach: s.ach != null ? Math.round(s.ach * 1000) / 10 : null,
            realisasi: s.realisasiValue ?? 0,
            target: s.targetValue ?? 0,
          })),
        };
      } catch {
        return { bulan: m.key, label: m.label, total: 0, target: 0, ach: null, ao: 0, nBaris: 0, sales: [] };
      }
    });
  }, [isAiChatOpen, rawRows, targets, filters.salesCodes, workDays]);

  const aiContext = useMemo(() => {
    if (!isAiChatOpen) return null;
    const totals = aggFinal?.totals || {};
    const meta = aggFinal?.meta || {};
    const tAll = aggAll?.totals || {};
    const mAll = aggAll?.meta || {};
    return {
      // Cakupan filter (layar saat ini)
      total: totals.realisasiValue ?? 0,
      targetValue: totals.targetValue ?? 0,
      achGlobal: totals.ach ?? null,
      ao: totals.realisasiAo ?? 0,
      targetAo: totals.targetAo ?? 0,
      nBaris: (aggFinal?.filteredRows || []).length,
      periode: { dari: meta.firstDate || null, sampai: meta.lastDate || null, hari: meta.uniqueDays || 0 },
      // Cakupan semua (tanpa filter tanggal) — default untuk analisis AI
      semua: {
        total: tAll.realisasiValue ?? 0,
        target: tAll.targetValue ?? 0,
        ach: tAll.ach ?? null,
        ao: tAll.realisasiAo ?? 0,
        nBaris: (aggAll?.filteredRows || []).length,
        dari: mAll.firstDate || null,
        sampai: mAll.lastDate || null,
        hari: mAll.uniqueDays || 0,
        sales: (aggAll?.bySales || []).slice(0, 30).map((s) => ({
          kode: s.code,
          nama: s.name,
          ach: s.ach != null ? Math.round(s.ach * 1000) / 10 : null,
          realisasi: s.realisasiValue ?? 0,
          target: s.targetValue ?? 0,
        })),
      },
      // Deret bulanan full ringkas (tanpa filter tanggal)
      bulanan: aiBulanan,
      depotName,
      nDepo: (depots || []).length,
      sales: (aggFinal?.bySales || []).slice(0, 30).map((s) => ({
        kode: s.code,
        nama: s.name,
        ach: s.ach != null ? Math.round(s.ach * 1000) / 10 : null,
        realisasi: s.realisasiValue ?? 0,
        target: s.targetValue ?? 0,
      })),
      targets: (targets || []).slice(0, 30).map((t) => ({
        kode: t.code,
        nama: t.name,
        value: t.total?.value ?? 0,
        ao: t.total?.ao ?? 0,
      })),
      filters: {
        sales: (filters?.salesCodes || []).length,
        groups: filters?.groups || [],
        dari: filters?.dateFrom || "",
        sampai: filters?.dateTo || "",
      },
      stok: stockData?.stockSummary ? {
        total: stockData.stockSummary.total ?? null,
        habis: stockData.stockSummary.habis ?? stockData.stockSummary.stockout ?? null,
        menipis: stockData.stockSummary.menipis ?? stockData.stockSummary.low ?? null,
      } : null,
    };
  }, [isAiChatOpen, aggFinal, aggAll, aiBulanan, targets, filters, depots, depotName, stockData?.stockSummary]);

  return aiContext;
}
