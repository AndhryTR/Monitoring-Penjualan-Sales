import { useState } from "react";
import { Sparkles, TrendingUp, TrendingDown, Minus, Gauge, BarChart2, ChevronDown, Calendar, Flame } from "lucide-react";
import { fmtPct, fmtRp } from "../utils/formatters.js";
import { computePaceStatus } from "../utils/aggregation.js";
import { GoalTrackerChart } from "./GoalTrackerChart.jsx";

/* ============================================================================
   PACE STRIP & GOAL TRACKER (Sprint 19)
   Diperkaya dengan:
   1. 3 KPI Pill actionable: Realisasi Kumulatif, Target Harian Sisa, Run-rate
   2. Toggle interaktif untuk membuka Burn-up Chart Progress Harian
   3. GoalTrackerChart: Kurva akumulasi vs garis target linear s/d akhir bulan
============================================================================ */
export function PaceStrip({
  timeGonePct, achPct, colors, targetValue, realisasiValue,
  workDays, uniqueDays, dailySeries = [], _dateMeta,
}) {
  const achCapped = Math.min(100, (achPct || 0) * 100);
  const timeCapped = Math.min(100, (timeGonePct || 0) * 100);
  const { isAhead } = computePaceStatus(achPct, timeGonePct);

  // Delta absolut: ACH - TimeGone (dalam percentage points)
  const deltaPct = (achPct !== null && achPct !== undefined)
    ? ((achPct - timeGonePct) * 100)
    : null;

  // Status: ahead / behind / on pace (within ±2% margin)
  const isOnPace = deltaPct !== null && Math.abs(deltaPct) <= 2;
  const status = isAhead === null ? "unknown" : isOnPace ? "onpace" : isAhead ? "ahead" : "behind";

  const statusConfig = {
    ahead: { color: colors.mint, icon: TrendingUp, label: "Di atas pace", deltaPrefix: "+" },
    behind: { color: colors.coral, icon: TrendingDown, label: "Di bawah pace", deltaPrefix: "" },
    onpace: { color: colors.gold, icon: Minus, label: "Sesuai pace", deltaPrefix: "" },
    unknown: { color: colors.textMuted, icon: Gauge, label: "Belum cukup data", deltaPrefix: "" },
  };
  const cfg = statusConfig[status];
  const StatusIcon = cfg.icon;

  const [showChart, setShowChart] = useState(false);

  const sisaHari = (workDays && uniqueDays) ? Math.max(0, workDays - uniqueDays) : 0;
  const sisaTarget = (targetValue || 0) - (realisasiValue || 0);
  const rateSekarang = uniqueDays > 0 ? (realisasiValue || 0) / uniqueDays : 0;
  const perluPerHari = sisaHari > 0 && sisaTarget > 0 ? sisaTarget / sisaHari : 0;
  const hasDailyData = dailySeries && dailySeries.length > 0;

  // Contextual hint: berapa perlu per hari untuk capai target
  let hint = null;
  if (targetValue && realisasiValue !== undefined && workDays && uniqueDays) {
    if (sisaTarget <= 0) {
      hint = `Target tercapai! Realisasi ${fmtRp(realisasiValue)} dari target ${fmtRp(targetValue)}`;
    } else if (sisaHari > 0) {
      const rasio = rateSekarang > 0 ? (perluPerHari / rateSekarang) : null;

      if (rasio !== null && rasio <= 1) {
        hint = `Perlu ${fmtRp(perluPerHari)}/hari — dengan rate saat ini (${fmtRp(rateSekarang)}/hari), target tercapai`;
      } else if (rasio !== null) {
        hint = `Perlu ${fmtRp(perluPerHari)}/hari — ${rasio.toFixed(1)}× rate saat ini (${fmtRp(rateSekarang)}/hari)`;
      } else {
        hint = `Perlu ${fmtRp(perluPerHari)}/hari selama ${sisaHari} hari kerja tersisa`;
      }
    } else {
      hint = `Periode berakhir — realisasi ${fmtRp(realisasiValue)} dari target ${fmtRp(targetValue)}`;
    }
  }

  return (
    <div className="sm-card sm-fadeup p-5 mb-6" style={{ borderLeft: `3px solid ${cfg.color}` }}>
      {/* Header row */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl shrink-0" style={{ background: cfg.color + "1A" }}>
            <StatusIcon size={16} style={{ color: cfg.color }} />
          </div>
          <div>
            <div className="disp text-sm font-semibold" style={{ color: colors.text }}>Pace ke Target</div>
            <div className="text-xs" style={{ color: cfg.color }}>
              {cfg.label}
              {deltaPct !== null && !isOnPace && (
                <span className="mono font-bold ml-1.5">
                  ({cfg.deltaPrefix}{deltaPct.toFixed(1)}%)
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Action buttons & ACH summary */}
        <div className="flex items-center gap-3 shrink-0">
          {hasDailyData && (
            <button
              onClick={() => setShowChart(!showChart)}
              className="sm-btn inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer select-none"
              style={{
                background: showChart ? cfg.color + "22" : colors.glassFill,
                border: `1px solid ${showChart ? cfg.color + "66" : colors.glassBorder}`,
                color: showChart ? cfg.color : colors.text,
              }}
              title={showChart ? "Tutup grafik progress harian" : "Buka grafik burn-up progress harian"}
            >
              <BarChart2 size={13} />
              <span>{showChart ? "Tutup Grafik" : "Grafik Harian"}</span>
              <ChevronDown
                size={13}
                style={{
                  transform: showChart ? "rotate(180deg)" : "rotate(0deg)",
                  transition: "transform 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                }}
              />
            </button>
          )}

          <div className="text-right">
            <div className="text-xs" style={{ color: colors.textMuted }}>Achievement</div>
            <div className="mono text-lg font-bold" style={{ color: cfg.color }}>
              {achPct !== null && achPct !== undefined ? fmtPct(achPct) : "-"}
            </div>
          </div>
        </div>
      </div>

      {/* Dual progress bars: ACH (top) vs Time Gone (bottom) */}
      <div className="space-y-2">
        {/* ACH bar */}
        <div>
          <div className="flex justify-between text-xs mb-1" style={{ color: colors.textMuted }}>
            <span>Achievement</span>
            <span className="mono" style={{ color: cfg.color }}>{achPct !== null ? fmtPct(achPct) : "-"}</span>
          </div>
          <div className="relative h-3 rounded-full overflow-hidden" style={{ background: colors.glassFill }}>
            <div
              className="sm-progress-fill h-full rounded-full"
              style={{ width: `${achCapped}%`, background: `linear-gradient(90deg, ${cfg.color}88, ${cfg.color})` }}
            />
            {/* Target marker at 100% */}
            <div className="absolute top-0 h-full w-[2px]" style={{ right: 0, background: colors.text, opacity: 0.3 }} />
          </div>
        </div>

        {/* Time Gone bar */}
        <div>
          <div className="flex justify-between text-xs mb-1" style={{ color: colors.textMuted }}>
            <span>Waktu Berjalan</span>
            <span className="mono">{timeGonePct > 0 ? fmtPct(timeGonePct) : "-"}</span>
          </div>
          <div className="relative h-3 rounded-full overflow-hidden" style={{ background: colors.glassFill }}>
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{ width: `${timeCapped}%`, background: colors.textMuted + "55" }}
            />
            {/* ACH marker on time bar — visual comparison */}
            {achPct !== null && (
              <div
                className="absolute top-0 h-full w-[2px] rounded-full"
                style={{ left: `${achCapped}%`, background: cfg.color, boxShadow: `0 0 6px ${cfg.color}88` }}
                title={`ACH: ${fmtPct(achPct)}`}
              />
            )}
          </div>
        </div>
      </div>

      {/* Mini KPI Pills: Realisasi, Target Harian Sisa, Run-Rate */}
      {targetValue > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 mt-3 pt-3" style={{ borderTop: `1px solid ${colors.glassBorder}` }}>
          {/* Pill 1: Realisasi vs Target */}
          <div className="p-2.5 rounded-xl flex items-center justify-between sm:flex-col sm:items-start gap-1" style={{ background: colors.glassFill }}>
            <span className="text-[11px] flex items-center gap-1.5" style={{ color: colors.textMuted }}>
              <Flame size={12} style={{ color: cfg.color }} /> Realisasi / Target
            </span>
            <div className="text-xs mono font-bold truncate" style={{ color: colors.text }}>
              {fmtRp(realisasiValue)}{" "}
              <span className="text-[10px] font-normal" style={{ color: colors.textMuted }}>
                / {fmtRp(targetValue)}
              </span>
            </div>
          </div>

          {/* Pill 2: Target Harian Sisa */}
          <div className="p-2.5 rounded-xl flex items-center justify-between sm:flex-col sm:items-start gap-1" style={{ background: colors.glassFill }}>
            <span className="text-[11px] flex items-center gap-1.5" style={{ color: colors.textMuted }}>
              <Calendar size={12} style={{ color: colors.blue }} /> Target Sisa Hari
            </span>
            <div className="text-xs mono font-bold truncate" style={{ color: sisaTarget <= 0 ? colors.mint : colors.blue }}>
              {sisaTarget <= 0 ? "Target Tercapai!" : (sisaHari > 0 ? `${fmtRp(perluPerHari)}/hari` : "Periode Selesai")}
            </div>
          </div>

          {/* Pill 3: Run-Rate Aktual */}
          <div className="p-2.5 rounded-xl flex items-center justify-between sm:flex-col sm:items-start gap-1" style={{ background: colors.glassFill }}>
            <span className="text-[11px] flex items-center gap-1.5" style={{ color: colors.textMuted }}>
              <TrendingUp size={12} style={{ color: colors.mint }} /> Run-rate Aktual
            </span>
            <div className="text-xs mono font-bold truncate" style={{ color: colors.text }}>
              {rateSekarang > 0 ? `${fmtRp(rateSekarang)}/hari` : "—"}{" "}
              <span className="text-[10px] font-normal" style={{ color: colors.textMuted }}>
                ({sisaHari} HK sisa)
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center gap-4 mt-3 text-xs" style={{ color: colors.textMuted }}>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: cfg.color }} />
          Achievement
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: colors.textMuted, opacity: 0.55 }} />
          Waktu berjalan
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-[2px] h-3 rounded-full" style={{ background: cfg.color }} />
          Posisi ACH di timeline waktu
        </span>
      </div>

      {/* Contextual hint */}
      {hint && (
        <div className="mt-3 pt-3 flex items-start gap-2.5" style={{ borderTop: `1px solid ${colors.glassBorder}` }}>
          <Sparkles size={13} style={{ color: colors.gold, flexShrink: 0, marginTop: 1 }} />
          <p className="text-xs" style={{ color: colors.text }}>
            {hint}
          </p>
        </div>
      )}

      {/* Expandable Daily Goal Tracker Chart */}
      {showChart && hasDailyData && (
        <GoalTrackerChart
          dailySeries={dailySeries}
          targetValue={targetValue}
          workDays={workDays || 27}
          uniqueDays={uniqueDays || dailySeries.length}
          colors={colors}
          isAhead={isAhead}
        />
      )}
    </div>
  );
}
