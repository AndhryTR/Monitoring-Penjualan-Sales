import { ArrowUpRight, ArrowDownRight } from "lucide-react";
import { fmtRp, fmtNum, fmtPct } from "../../utils/formatters.js";
import { useCountUp } from "../../hooks/useCountUp.js";

/* ============================================================================
   CompactKpiGrid — 8 KPI ringkas dalam grid 4×2 (desktop) / 2×4 (mobile)
   Lebih padat dari KpiCard biasa: tanpa ikon besar, tanpa gradient text,
   tanpa sparkline — supaya 8 card muat dalam satu grid.
============================================================================ */

function CompactKpiItem({ label, value, isMoney, isPct, accent, colors, delay }) {
  const numeric = isPct ? (value || 0) * 100 : (value || 0);
  const animated = useCountUp(numeric);
  const displayText = isMoney ? fmtRp(animated) : isPct ? animated.toFixed(1) + "%" : fmtNum(animated);

  return (
    <div className="sm-fadeup min-w-0" style={{ animationDelay: `${delay}ms` }}>
      <div className="sm-card p-3.5 min-w-0 h-full" style={{ position: "relative", overflow: "hidden" }}>
        <div className="absolute top-0 left-0 w-1 h-full rounded-l" style={{ background: accent }} />
        <div className="pl-2.5">
          <div className="text-[10px] uppercase tracking-wider font-semibold mb-0.5 truncate" style={{ color: colors.textMuted }}>
            {label}
          </div>
          <div className="disp text-base md:text-lg font-bold mono" style={{ color: colors.text }}>
            {displayText}
          </div>
        </div>
      </div>
    </div>
  );
}

function GrowthKpiItem({ growth, colors, delay }) {
  const growthAccent = growth === null ? colors.textMuted : growth >= 0 ? colors.mint : colors.coral;
  const GrowthIcon = growth === null ? null : growth >= 0 ? ArrowUpRight : ArrowDownRight;
  const displayText = growth === null ? "-" : fmtPct(Math.abs(growth));

  return (
    <div className="sm-fadeup min-w-0" style={{ animationDelay: `${delay}ms` }}>
      <div className="sm-card p-3.5 min-w-0 h-full" style={{ position: "relative", overflow: "hidden" }}>
        <div className="absolute top-0 left-0 w-1 h-full rounded-l" style={{ background: growthAccent }} />
        <div className="pl-2.5">
          <div className="text-[10px] uppercase tracking-wider font-semibold mb-0.5 truncate" style={{ color: colors.textMuted }}>
            Growth MoM
          </div>
          <div className="disp text-base md:text-lg font-bold flex items-center gap-1" style={{ color: growthAccent }}>
            {GrowthIcon && <GrowthIcon size={16} />}
            {displayText}
          </div>
        </div>
      </div>
    </div>
  );
}

function ProjectionKpiItem({ proj, colors, delay }) {
  const accent = proj?.projectedAch !== null && proj?.projectedAch >= 1 ? colors.mint : colors.gold;
  return (
    <div className="sm-fadeup min-w-0" style={{ animationDelay: `${delay}ms` }}>
      <div className="sm-card p-3.5 min-w-0 h-full" style={{ position: "relative", overflow: "hidden" }}>
        <div className="absolute top-0 left-0 w-1 h-full rounded-l" style={{ background: accent }} />
        <div className="pl-2.5">
          <div className="text-[10px] uppercase tracking-wider font-semibold mb-0.5 truncate" style={{ color: colors.textMuted }}>
            Proyeksi ACH
          </div>
          <div className="disp text-base md:text-lg font-bold" style={{ color: accent }}>
            {proj?.projectedAch !== null ? fmtPct(proj.projectedAch) : "-"}
          </div>
        </div>
      </div>
    </div>
  );
}

function PaceKpiItem({ paceStatus, paceAccent, colors, delay }) {
  return (
    <div className="sm-fadeup min-w-0" style={{ animationDelay: `${delay}ms` }}>
      <div className="sm-card p-3.5 min-w-0 h-full" style={{ position: "relative", overflow: "hidden" }}>
        <div className="absolute top-0 left-0 w-1 h-full rounded-l" style={{ background: paceAccent }} />
        <div className="pl-2.5">
          <div className="text-[10px] uppercase tracking-wider font-semibold mb-0.5 truncate" style={{ color: colors.textMuted }}>
            Pace
          </div>
          <div className="disp text-base md:text-lg font-bold truncate" style={{ color: paceAccent }}>
            {paceStatus}
          </div>
        </div>
      </div>
    </div>
  );
}

export function CompactKpiGrid({ agg, growth, workDays, colors }) {
  const t = agg.totals;
  const proj = agg.projection;

  // agg.meta.uniqueDays sudah dihitung sekali di aggregation.js (computeAggregates)
  // — reuse langsung di sini supaya tidak ada logic hari-unik yang terduplikasi.
  const uniqueDays = agg.meta.uniqueDays;
  const timeGonePct = workDays ? Math.min(1, uniqueDays / workDays) : 0;
  const isAhead = t.ach !== null && t.ach >= timeGonePct;
  const paceStatus = t.ach === null ? "Belum cukup data" : isAhead ? "✓ Di atas pace" : "✗ Di bawah pace";
  const paceAccent = t.ach === null ? colors.textMuted : isAhead ? colors.mint : colors.coral;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <CompactKpiItem label="Target Value" value={t.targetValue} isMoney accent={colors.blue} colors={colors} delay={0} />
      <CompactKpiItem label="Realisasi" value={t.realisasiValue} isMoney accent={colors.mint} colors={colors} delay={40} />
      <CompactKpiItem label="ACH" value={t.ach} isPct accent={colors.gold} colors={colors} delay={80} />
      <CompactKpiItem label="Deviasi" value={t.deviasiValue} isMoney accent={colors.coral} colors={colors} delay={120} />

      <CompactKpiItem label="AO Aktif" value={t.realisasiAo} accent={colors.violet} colors={colors} delay={160} />
      <CompactKpiItem label="Target AO" value={t.targetAo} accent={colors.textMuted} colors={colors} delay={200} />
      <GrowthKpiItem growth={growth} colors={colors} delay={240} />
      <ProjectionKpiItem proj={proj} colors={colors} delay={280} />

      {/* Pace — full width card sebagai penutup */}
      <div className="col-span-2 md:col-span-4">
        <PaceKpiItem paceStatus={paceStatus} paceAccent={paceAccent} colors={colors} delay={320} />
      </div>
    </div>
  );
}
