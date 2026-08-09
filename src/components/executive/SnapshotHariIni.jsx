import { useMemo } from "react";
import {
  CalendarDays, TrendingUp, Users, Trophy, ArrowUp, ArrowDown, Minus,
} from "lucide-react";
import { fmtRp, fmtNum, fmtPct } from "../../utils/formatters.js";

/* ============================================================================
   SNAPSHOT HARI INI — 4 card performance hari terakhir.
   ⚠️ Sprint 16 / EX1: mengganti CompactKpiGrid yang duplikasi dengan Main
   Report. Fokus ke "apa yang terjadi hari ini" — bukan periode penuh.

   Cards:
   1. Realisasi hari terakhir (Rp) + delta vs hari sebelumnya
   2. AO hari terakhir (outlet aktif) + delta
   3. Pencapaian hari ini vs target harian (%)
   4. Top performer hari ini (sales dengan realisasi terbesar)

   Data source: agg.filteredRows + agg.daily + agg.meta.lastDate + targets
============================================================================ */
export function SnapshotHariIni({ agg, workDays, colors }) {
  const { filteredRows, daily, meta, bySales } = agg;
  const lastDate = meta?.lastDate;
  const targetValue = agg.totals.targetValue;

  // ---- Compute hari terakhir stats ----
  const stats = useMemo(() => {
    if (!lastDate || !filteredRows.length) return null;

    // Baris hari terakhir
    const lastDayRows = filteredRows.filter((r) => r.date === lastDate);
    const lastDayValue = lastDayRows.reduce((sum, r) => sum + (r.value || 0), 0);
    const lastDayOutlets = new Set(lastDayRows.map((r) => r.outletCode).filter(Boolean));

    // Baris hari sebelumnya (untuk delta)
    const dailySorted = [...daily].sort((a, b) => a.date.localeCompare(b.date));
    const lastIdx = dailySorted.length - 1;
    const prevDay = lastIdx > 0 ? dailySorted[lastIdx - 1] : null;
    const prevDayValue = prevDay?.value || 0;
    const prevDayOutlets = prevDay?.ao || 0;

    // Delta
    const valueDelta = lastDayValue - prevDayValue;
    const aoDelta = lastDayOutlets.size - prevDayOutlets;

    // Target harian = total target / hari kerja
    const targetPerDay = workDays && targetValue ? targetValue / workDays : 0;
    const dailyAch = targetPerDay > 0 ? lastDayValue / targetPerDay : null;

    // Top performer hari terakhir
    const salesMap = new Map();
    lastDayRows.forEach((r) => {
      if (!r.salesCode) return;
      const cur = salesMap.get(r.salesCode) || { code: r.salesCode, name: r.salesName || r.salesCode, value: 0, outlets: new Set() };
      cur.value += r.value || 0;
      if (r.outletCode) cur.outlets.add(r.outletCode);
      salesMap.set(r.salesCode, cur);
    });
    const topPerformer = Array.from(salesMap.values()).sort((a, b) => b.value - a.value)[0] || null;

    return {
      lastDayValue, lastDayOutlets: lastDayOutlets.size,
      valueDelta, aoDelta,
      prevDayValue, prevDayOutlets,
      targetPerDay, dailyAch,
      topPerformer,
      rowCount: lastDayRows.length,
    };
  }, [lastDate, filteredRows, daily, workDays, targetValue]);

  if (!stats) {
    return (
      <div className="sm-card p-6 text-center" style={{ borderLeft: `3px solid ${colors.gold}` }}>
        <CalendarDays size={20} className="mx-auto mb-2" style={{ color: colors.textMuted, opacity: 0.4 }} />
        <p className="text-sm" style={{ color: colors.textMuted }}>Belum ada data transaksi untuk hari terakhir.</p>
      </div>
    );
  }

  const DeltaIndicator = ({ delta, isMoney }) => {
    if (delta === 0) return <span className="flex items-center gap-0.5 text-xs" style={{ color: colors.textMuted }}><Minus size={11} /> sama</span>;
    const isPos = delta > 0;
    return (
      <span className="flex items-center gap-0.5 text-xs font-semibold" style={{ color: isPos ? colors.mint : colors.coral }}>
        {isPos ? <ArrowUp size={11} /> : <ArrowDown size={11} />}
        {isMoney ? (isPos ? "+" : "") + fmtRp(Math.abs(delta)) : (isPos ? "+" : "") + fmtNum(Math.abs(delta))}
      </span>
    );
  };

  return (
    <div>
      {/* Section label */}
      <div className="flex items-center gap-2 mb-3">
        <CalendarDays size={15} style={{ color: colors.gold }} />
        <span className="disp text-sm font-semibold" style={{ color: colors.text }}>
          Snapshot Hari Ini
        </span>
        <span className="text-xs mono" style={{ color: colors.textMuted }}>
          {lastDate}
        </span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {/* Card 1: Realisasi hari terakhir */}
        <div className="sm-card p-4" style={{ borderLeft: `3px solid ${colors.mint}` }}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs uppercase tracking-wider font-semibold" style={{ color: colors.textMuted }}>Realisasi</span>
            <div className="p-1 rounded-lg" style={{ background: colors.mint + "1A" }}>
              <TrendingUp size={12} style={{ color: colors.mint }} />
            </div>
          </div>
          <div className="mono text-xl font-bold" style={{ color: colors.mint }}>{fmtRp(stats.lastDayValue)}</div>
          <div className="flex items-center justify-between mt-2">
            <span className="text-[11px]" style={{ color: colors.textMuted }}>vs kemarin</span>
            <DeltaIndicator delta={stats.valueDelta} isMoney />
          </div>
        </div>

        {/* Card 2: AO hari terakhir */}
        <div className="sm-card p-4" style={{ borderLeft: `3px solid ${colors.violet}` }}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs uppercase tracking-wider font-semibold" style={{ color: colors.textMuted }}>Outlet Aktif</span>
            <div className="p-1 rounded-lg" style={{ background: colors.violet + "1A" }}>
              <Users size={12} style={{ color: colors.violet }} />
            </div>
          </div>
          <div className="mono text-xl font-bold" style={{ color: colors.violet }}>{fmtNum(stats.lastDayOutlets)}</div>
          <div className="flex items-center justify-between mt-2">
            <span className="text-[11px]" style={{ color: colors.textMuted }}>vs kemarin</span>
            <DeltaIndicator delta={stats.aoDelta} />
          </div>
        </div>

        {/* Card 3: Pencapaian harian vs target harian */}
        <div className="sm-card p-4" style={{ borderLeft: `3px solid ${colors.gold}` }}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs uppercase tracking-wider font-semibold" style={{ color: colors.textMuted }}>Target Harian</span>
            <div className="p-1 rounded-lg" style={{ background: colors.gold + "1A" }}>
              <CalendarDays size={12} style={{ color: colors.gold }} />
            </div>
          </div>
          <div className="mono text-xl font-bold" style={{ color: colors.gold }}>
            {stats.dailyAch !== null ? fmtPct(stats.dailyAch) : "-"}
          </div>
          <div className="flex items-center justify-between mt-2">
            <span className="text-[11px]" style={{ color: colors.textMuted }}>
              {fmtRp(stats.lastDayValue)} / {fmtRp(stats.targetPerDay)}
            </span>
          </div>
        </div>

        {/* Card 4: Top performer hari terakhir */}
        <div className="sm-card p-4" style={{ borderLeft: `3px solid ${colors.blue}` }}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs uppercase tracking-wider font-semibold" style={{ color: colors.textMuted }}>Top Hari Ini</span>
            <div className="p-1 rounded-lg" style={{ background: colors.blue + "1A" }}>
              <Trophy size={12} style={{ color: colors.blue }} />
            </div>
          </div>
          {stats.topPerformer ? (
            <>
              <div className="text-sm font-semibold truncate" style={{ color: colors.blue }} title={stats.topPerformer.name}>
                {stats.topPerformer.name}
              </div>
              <div className="flex items-center justify-between mt-2">
                <span className="text-[11px] mono" style={{ color: colors.textMuted }}>
                  {fmtRp(stats.topPerformer.value)} · {fmtNum(stats.topPerformer.outlets.size)} outlet
                </span>
              </div>
            </>
          ) : (
            <div className="text-sm" style={{ color: colors.textMuted }}>Tidak ada data</div>
          )}
        </div>
      </div>
    </div>
  );
}
