import { useMemo } from "react";
import { Gauge, Users, Crosshair, Package, Store } from "lucide-react";
import { CompactKpiGrid } from "../components/executive/CompactKpiGrid.jsx";
import { MiniLeaderboard } from "../components/executive/MiniLeaderboard.jsx";
import { FocusProductMini } from "../components/executive/FocusProductMini.jsx";
import { GroupMiniSummary } from "../components/executive/GroupMiniSummary.jsx";
import { OutletHealthMini } from "../components/executive/OutletHealthMini.jsx";
import { InsightBanner } from "../components/executive/InsightBanner.jsx";
import { SectionCard } from "../components/executive/SectionCard.jsx";
import { computeOutletAnalysis, detectMonths, computeAggregates } from "../utils/aggregation.js";
import { OUTLET_DEFAULT_THRESHOLDS } from "../constants/thresholds.js";

/* ============================================================================
   EXECUTIVE SUMMARY PAGE
   Halaman ringkasan eksekutif sekali-lihat untuk manajer/supervisor.

   Menampilkan:
   1. CompactKpiGrid — 8 KPI ringkas (target, realisasi, ACH, deviasi, dll)
   2. MiniLeaderboard — Top 3 + bottom 2 sales
   3. FocusProductMini — Ringkasan produk fokus (on track, at risk, critical)
   4. GroupMiniSummary — Top 4 grup produk + bar mini
   5. OutletHealthMini — Distribusi status outlet (aktif/berisiko/dormant)
   6. InsightBanner — Alerts + data quality issues terintegrasi

   Growth MoM bersifat cascade:
   - Prioritas 1: dari snapshot perbandingan yang dipilih user
   - Prioritas 2: auto-detect dari multi-bulan data (jika >=2 bulan)
   - Fallback: null (tampilkan "-")
============================================================================ */

export function ExecutiveSummaryPage({ agg, colors, workDays, onDrilldown, comparison, dataQualityNotes, onNavigate, rawRows, targets, filters }) {
  // ==========================================================================
  // DERIVED DATA
  // ==========================================================================

  // Growth MoM — cascade: snapshot > auto-detect > null
  const growth = useMemo(() => {
    // Prioritas 1: snapshot riwayat
    if (comparison?.growth !== null && comparison?.growth !== undefined) {
      return comparison.growth;
    }
    // Prioritas 2: auto-detect dari multi-bulan data
    try {
      const months = detectMonths(rawRows);
      if (months.length >= 2) {
        const latest = months[months.length - 1];
        const prev = months[months.length - 2];
        const latestAgg = computeAggregates(rawRows, targets, {
          salesCodes: filters?.salesCodes ?? [],
          groups: [],
          dateFrom: latest.dateFrom,
          dateTo: latest.dateTo,
        }, workDays);
        const prevAgg = computeAggregates(rawRows, targets, {
          salesCodes: filters?.salesCodes ?? [],
          groups: [],
          dateFrom: prev.dateFrom,
          dateTo: prev.dateTo,
        }, workDays);
        const prevValue = prevAgg.totals.realisasiValue;
        if (prevValue > 0) {
          return (latestAgg.totals.realisasiValue - prevValue) / prevValue;
        }
      }
    } catch (_) {
      // Silently fail — fallback ke null
    }
    return null;
  }, [comparison, rawRows, targets, workDays, filters?.salesCodes]);

  // Kesehatan outlet — dihitung dari filteredRows
  const outletHealthSummary = useMemo(() => {
    try {
      return computeOutletAnalysis(agg.filteredRows, agg.meta, OUTLET_DEFAULT_THRESHOLDS).summary;
    } catch (_) {
      return { total: 0, active: 0, atRisk: 0, dormant: 0 };
    }
  }, [agg.filteredRows, agg.meta]);

  // ==========================================================================
  // EMPTY STATE
  // ==========================================================================

  if (!agg.filteredRows.length) {
    return (
      <div className="sm-page-enter">
        <div className="sm-card p-16 text-center">
          <div className="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center" style={{ background: colors.glassFill }}>
            <Gauge size={24} style={{ color: colors.textMuted }} />
          </div>
          <div className="disp text-base font-semibold mb-1">Executive Summary</div>
          <p className="text-sm" style={{ color: colors.textMuted }}>
            Upload data sell-out untuk melihat ringkasan eksekutif di sini, atau buka tab <b>Main Report</b> untuk dashboard lengkap.
          </p>
        </div>
      </div>
    );
  }

  // ==========================================================================
  // LAYOUT
  // ==========================================================================

  return (
    <div className="sm-page-enter space-y-6">
      {/* Periode label */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="disp text-lg font-bold" style={{ color: colors.text }}>Executive Summary</h2>
          <p className="text-xs" style={{ color: colors.textMuted }}>
            {agg.meta.firstDate && agg.meta.lastDate
              ? `${agg.meta.firstDate} — ${agg.meta.lastDate} · ${agg.meta.uniqueDays} hari data`
              : "Ringkasan pencapaian sales, produk, dan outlet"}
          </p>
        </div>
      </div>

      {/* 1. KPI Grid */}
      <CompactKpiGrid agg={agg} growth={growth} workDays={workDays} colors={colors} />

      {/* 2. Insight Banner — muncul jika ada issues */}
      {(agg.alerts.length > 0 || dataQualityNotes) && (
        <InsightBanner alerts={agg.alerts} dataQualityNotes={dataQualityNotes} colors={colors} onNavigate={onNavigate} />
      )}

      {/* 3. Grid panel: Leaderboard + Focus (baris 1) */}
      <div className="grid md:grid-cols-2 gap-5">
        <SectionCard
          title="Performa Sales"
          icon={Users}
          accent={colors.blue}
          colors={colors}
          actionLabel="Detail Sales"
          onAction={() => onNavigate?.("sales")}
        >
          <MiniLeaderboard agg={agg} colors={colors} onNavigate={onNavigate} />
        </SectionCard>

        <SectionCard
          title="Produk Fokus"
          icon={Crosshair}
          accent={colors.violet}
          colors={colors}
          actionLabel="Detail Fokus"
          onAction={() => onNavigate?.("focus")}
        >
          <FocusProductMini focusRows={agg.focusRows} colors={colors} onNavigate={onNavigate} />
        </SectionCard>
      </div>

      {/* 4. Grid panel: Grup Produk + Outlet Health (baris 2) */}
      <div className="grid md:grid-cols-2 gap-5">
        <SectionCard
          title="Grup Produk"
          icon={Package}
          accent={colors.gold}
          colors={colors}
          actionLabel="Detail Produk"
          onAction={() => onNavigate?.("product")}
        >
          <GroupMiniSummary byGroup={agg.byGroup} colors={colors} onNavigate={onNavigate} />
        </SectionCard>

        <SectionCard
          title="Kesehatan Outlet"
          icon={Store}
          accent={colors.mint}
          colors={colors}
          actionLabel="Analisis Outlet"
          onAction={() => onNavigate?.("outlet")}
        >
          <OutletHealthMini outletSummary={outletHealthSummary} colors={colors} onNavigate={onNavigate} />
        </SectionCard>
      </div>
    </div>
  );
}
