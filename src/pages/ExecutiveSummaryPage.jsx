import { useMemo } from "react";
import { Gauge, Users, Crosshair, Package, Store, Target } from "lucide-react";
import { SnapshotHariIni } from "../components/executive/SnapshotHariIni.jsx";
import { QuickActions } from "../components/executive/QuickActions.jsx";
import { MiniLeaderboard } from "../components/executive/MiniLeaderboard.jsx";
import { FocusProductMini } from "../components/executive/FocusProductMini.jsx";
import { FocusGroupMini } from "../components/executive/FocusGroupMini.jsx";
import { GroupMiniSummary } from "../components/executive/GroupMiniSummary.jsx";
import { OutletHealthMini } from "../components/executive/OutletHealthMini.jsx";
import { SectionCard } from "../components/executive/SectionCard.jsx";
import { EmptyState } from "../components/ui/EmptyState.jsx";
import { computeOutletAnalysis } from "../utils/aggregation.js";
// ⚠️ Sprint 16: useGrowthMoM tidak lagi dipakai di Executive Summary —
// Growth MoM card dihapus bersama CompactKpiGrid. Dipakai di Main Report saja.
import { OUTLET_DEFAULT_THRESHOLDS } from "../constants/thresholds.js";

/* ============================================================================
   EXECUTIVE SUMMARY PAGE — REDESIGN (Sprint 16)
   ⚠️ Diferensiasi tajam dengan Main Report:
   - SEBELUMNYA: CompactKpiGrid (8 KPI duplikasi) + InsightBanner (duplikasi)
   - SEKARANG: "Snapshot Hari Ini" (4 card performance hari terakhir) +
     Quick Actions bar + komponen unique (leaderboard, focus, outlet health)

   InsightBanner DIHAPUS dari sini — sekarang hanya ada di Main Report.
   CompactKpiGrid DIHAPUS — KPI lengkap ada di Main Report.

   Yang tetap (unique ke Executive):
   - MiniLeaderboard, FocusProductMini, FocusGroupMini, GroupMiniSummary,
     OutletHealthMini, Growth MoM
============================================================================ */

export function ExecutiveSummaryPage({ agg, colors, workDays, onDrilldown, comparison, onNavigate, rawRows, targets, filters }) {
  // ⚠️ Sprint 16: dataQualityNotes tidak lagi dipakai di sini — InsightBanner
  // hanya ada di Main Report sekarang. Tetap di props untuk backward-compat.

  const outletHealthSummary = useMemo(() => {
    try {
      return computeOutletAnalysis(agg.filteredRows, agg.meta, OUTLET_DEFAULT_THRESHOLDS).summary;
    } catch {
      return { total: 0, active: 0, atRisk: 0, dormant: 0 };
    }
  }, [agg.filteredRows, agg.meta]);

  if (!agg.filteredRows.length) {
    return (
      <EmptyState
        icon={Gauge}
        title="Executive Summary"
        description="Upload data sell-out untuk melihat snapshot hari ini, leaderboard sales, status outlet, dan produk fokus dalam satu halaman."
        actionLabel="Buka Main Report"
        onAction={() => onNavigate?.("main")}
        hint="Atau upload file Excel di area upload di bagian atas halaman."
        colors={colors}
      />
    );
  }

  return (
    <div className="sm-page-enter space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="disp text-lg font-bold" style={{ color: colors.text }}>Executive Summary</h2>
          <p className="text-xs" style={{ color: colors.textMuted }}>
            {agg.meta.firstDate && agg.meta.lastDate
              ? `${agg.meta.firstDate} — ${agg.meta.lastDate} · ${agg.meta.uniqueDays} hari data`
              : "Ringkasan performa sales, produk, dan outlet"}
          </p>
        </div>
      </div>

      {/* 1. Snapshot Hari Ini — 4 card performance hari terakhir */}
      <SnapshotHariIni agg={agg} workDays={workDays} colors={colors} />

      {/* 2. Quick Actions bar */}
      <QuickActions
        colors={colors}
        onViewDetail={() => onNavigate?.("main")}
      />

      {/* 3. Grid: Leaderboard + FocusProduct (baris 1) */}
      <div className="grid md:grid-cols-2 gap-5">
        <SectionCard
          title="Performa Sales"
          icon={Users}
          accent={colors.blue}
          colors={colors}
          actionLabel="Detail Sales"
          onAction={() => onNavigate?.("sales")}
        >
          <MiniLeaderboard agg={agg} colors={colors} />
        </SectionCard>

        <SectionCard
          title="Produk Fokus"
          icon={Crosshair}
          accent={colors.violet}
          colors={colors}
          actionLabel="Detail Fokus"
          onAction={() => onNavigate?.("focus")}
        >
          <FocusProductMini focusRows={agg.focusRows} colors={colors} />
        </SectionCard>
      </div>

      {/* 4. Grid: Grup Produk + Outlet Health (baris 2) */}
      <div className="grid md:grid-cols-2 gap-5">
        <SectionCard
          title="Grup Produk"
          icon={Package}
          accent={colors.gold}
          colors={colors}
          actionLabel="Detail Produk"
          onAction={() => onNavigate?.("product")}
        >
          <GroupMiniSummary byGroup={agg.byGroup} colors={colors} />
        </SectionCard>

        <SectionCard
          title="Kesehatan Outlet"
          icon={Store}
          accent={colors.mint}
          colors={colors}
          actionLabel="Analisis Outlet"
          onAction={() => onNavigate?.("outlet")}
        >
          <OutletHealthMini outletSummary={outletHealthSummary} colors={colors} />
        </SectionCard>
      </div>

      {/* 5. Grup Fokus — full width */}
      <SectionCard
        title="Grup Fokus"
        icon={Target}
        accent={colors.violet}
        colors={colors}
        actionLabel="Detail Fokus"
        onAction={() => onNavigate?.("focus")}
      >
        <FocusGroupMini focusGroupRows={agg.focusGroupRows} colors={colors} />
      </SectionCard>
    </div>
  );
}
