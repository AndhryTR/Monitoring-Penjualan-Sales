import { useMemo } from "react";
import {
  ResponsiveContainer, ComposedChart, Area, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ReferenceDot,
} from "recharts";
import { TrendingUp, TrendingDown, Target, Store } from "lucide-react";
import { fmtRp, formatDateIDShort, fmtCompactNum } from "../utils/formatters.js";

/* ============================================================================
   GOAL TRACKER CHART (Burn-up Chart: Kumulatif Harian vs Target Ideal)
   Menampilkan kurva akumulasi omset harian terhadap ritme target linear (ideal
   run-rate) dari hari kerja 1 sampai sisa hari kerja bulan berjalan.
============================================================================ */
export function GoalTrackerChart({ dailySeries = [], targetValue = 0, workDays = 27, uniqueDays = 0, colors, isAhead }) {
  const chartData = useMemo(() => {
    if (!dailySeries || !dailySeries.length) return [];

    const sorted = [...dailySeries].sort((a, b) => a.date.localeCompare(b.date));
    const effectiveDays = Math.max(workDays || 27, sorted.length);
    const dailyTargetStep = targetValue > 0 ? targetValue / effectiveDays : 0;

    let runningSum = 0;
    const points = [];

    // 1. Titik data aktual harian
    sorted.forEach((d, idx) => {
      const dayNum = idx + 1;
      runningSum += (Number(d.value) || 0);
      const idealTarget = Math.round(dailyTargetStep * dayNum);
      const variance = idealTarget > 0 ? runningSum - idealTarget : 0;

      points.push({
        dayNum,
        dayLabel: `HK-${dayNum}`,
        date: d.date,
        dateLabel: formatDateIDShort(d.date),
        dailyValue: Number(d.value) || 0,
        cumulative: runningSum,
        idealTarget,
        variance,
        ao: d.ao || 0,
        isActual: true,
      });
    });

    const lastActualDay = sorted.length;
    const avgDailyRate = lastActualDay > 0 ? runningSum / lastActualDay : 0;

    // 2. Titik proyeksi ke masa depan s/d akhir hari kerja
    for (let dayNum = lastActualDay + 1; dayNum <= effectiveDays; dayNum++) {
      const idealTarget = Math.round(dailyTargetStep * dayNum);
      const projected = Math.round(runningSum + (avgDailyRate * (dayNum - lastActualDay)));

      points.push({
        dayNum,
        dayLabel: `HK-${dayNum}`,
        date: "",
        dateLabel: `Hari ke-${dayNum}`,
        dailyValue: null,
        cumulative: null,
        idealTarget,
        projected,
        variance: null,
        ao: null,
        isActual: false,
      });
    }

    return points;
  }, [dailySeries, targetValue, workDays]);

  const lastActualPoint = useMemo(() => {
    const actuals = chartData.filter((p) => p.isActual);
    return actuals[actuals.length - 1] || null;
  }, [chartData]);

  if (!chartData.length) {
    return (
      <div className="py-8 text-center text-xs" style={{ color: colors.textMuted }}>
        Belum ada data harian untuk ditampilkan pada grafik.
      </div>
    );
  }

  const primaryAccent = isAhead === false ? colors.coral : colors.mint;

  return (
    <div className="mt-4 pt-4" style={{ borderTop: `1px solid ${colors.glassBorder}` }}>
      {/* Chart sub-header & legend */}
      <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold" style={{ color: colors.text }}>
            Kurva Akumulasi vs Ritme Target Ideal
          </span>
          <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: colors.glassFill, color: colors.textMuted }}>
            {uniqueDays} dari {workDays} HK
          </span>
        </div>
        <div className="flex items-center gap-3 text-[11px]" style={{ color: colors.textMuted }}>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm" style={{ background: primaryAccent }} />
            <span>Realisasi</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3 h-0.5 border-t border-dashed" style={{ borderColor: colors.blue }} />
            <span>Target Ideal</span>
          </span>
          {chartData.some((p) => !p.isActual) && (
            <span className="inline-flex items-center gap-1.5">
              <span className="w-3 h-0.5 border-t border-dotted" style={{ borderColor: colors.violet }} />
              <span>Proyeksi</span>
            </span>
          )}
        </div>
      </div>

      {/* Chart container */}
      <div className="h-[240px] sm:h-[280px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 10, right: 12, left: -10, bottom: 0 }}>
            <defs>
              <linearGradient id="goalTrackerGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={primaryAccent} stopOpacity={0.35} />
                <stop offset="95%" stopColor={primaryAccent} stopOpacity={0.02} />
              </linearGradient>
            </defs>

            <CartesianGrid strokeDasharray="3 3" stroke={colors.chartGrid} vertical={false} />

            <XAxis
              dataKey="dayLabel"
              tick={{ fill: colors.textMuted, fontSize: 10 }}
              axisLine={{ stroke: colors.glassBorder }}
              tickLine={false}
              interval={Math.max(1, Math.floor(chartData.length / 8))}
            />

            <YAxis
              tick={{ fill: colors.textMuted, fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={fmtCompactNum}
              domain={[0, "auto"]}
            />

            <Tooltip
              content={<CustomGoalTooltip colors={colors} primaryAccent={primaryAccent} />}
            />

            {/* Area Realisasi Kumulatif */}
            <Area
              type="monotone"
              dataKey="cumulative"
              stroke={primaryAccent}
              strokeWidth={2.5}
              fill="url(#goalTrackerGrad)"
              connectNulls={false}
              isAnimationActive={true}
              animationDuration={800}
            />

            {/* Garis Target Ideal (Linear Pace) */}
            <Line
              type="linear"
              dataKey="idealTarget"
              stroke={colors.blue}
              strokeWidth={2}
              strokeDasharray="4 4"
              dot={false}
              activeDot={false}
              isAnimationActive={false}
            />

            {/* Garis Proyeksi s/d Akhir Bulan */}
            <Line
              type="linear"
              dataKey="projected"
              stroke={colors.violet}
              strokeWidth={1.75}
              strokeDasharray="2 2"
              dot={false}
              activeDot={false}
              connectNulls={true}
              isAnimationActive={false}
            />

            {/* Titik posisi terakhir */}
            {lastActualPoint && (
              <ReferenceDot
                x={lastActualPoint.dayLabel}
                y={lastActualPoint.cumulative}
                r={5}
                fill={primaryAccent}
                stroke={colors.surface}
                strokeWidth={2}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function CustomGoalTooltip({ active, payload, colors, primaryAccent }) {
  if (!active || !payload || !payload.length) return null;
  const data = payload[0]?.payload;
  if (!data) return null;

  const isAhead = data.variance !== null && data.variance >= 0;
  const varColor = isAhead ? colors.mint : colors.coral;
  const VarIcon = isAhead ? TrendingUp : TrendingDown;

  return (
    <div
      className="p-3 rounded-xl text-xs space-y-2 max-w-[240px] pointer-events-none"
      style={{
        background: colors.dropdownBg,
        border: `1px solid ${colors.dropdownBorder}`,
        boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
        backdropFilter: "blur(12px)",
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between pb-1.5 border-b" style={{ borderColor: colors.glassBorder }}>
        <div className="font-bold disp" style={{ color: colors.text }}>
          {data.dayLabel}
        </div>
        <div className="text-[10px]" style={{ color: colors.textMuted }}>
          {data.dateLabel}
        </div>
      </div>

      {data.isActual ? (
        <>
          {/* Omset Hari Ini */}
          <div className="flex items-center justify-between">
            <span style={{ color: colors.textMuted }}>Omset Hari Ini:</span>
            <span className="mono font-semibold" style={{ color: colors.text }}>
              {fmtRp(data.dailyValue)}
            </span>
          </div>

          {/* Outlet Aktif */}
          <div className="flex items-center justify-between text-[11px]">
            <span className="flex items-center gap-1" style={{ color: colors.textMuted }}>
              <Store size={11} /> Outlet Aktif:
            </span>
            <span className="mono font-semibold" style={{ color: colors.text }}>
              {data.ao} outlet
            </span>
          </div>

          {/* Kumulatif vs Target Ideal */}
          <div className="pt-1.5 border-t space-y-1" style={{ borderColor: colors.glassBorder }}>
            <div className="flex items-center justify-between">
              <span style={{ color: colors.textMuted }}>Akumulasi:</span>
              <span className="mono font-bold" style={{ color: primaryAccent }}>
                {fmtRp(data.cumulative)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1" style={{ color: colors.textMuted }}>
                <Target size={11} /> Target Ideal:
              </span>
              <span className="mono" style={{ color: colors.blue }}>
                {fmtRp(data.idealTarget)}
              </span>
            </div>
          </div>

          {/* Variansi */}
          {data.variance !== null && (
            <div
              className="p-1.5 rounded-lg flex items-center justify-between text-[10.5px]"
              style={{ background: varColor + "14", border: `1px solid ${varColor}33` }}
            >
              <span className="flex items-center gap-1" style={{ color: varColor }}>
                <VarIcon size={12} /> {isAhead ? "Surplus Pace" : "Defisit Pace"}:
              </span>
              <span className="mono font-bold" style={{ color: varColor }}>
                {isAhead ? "+" : ""}{fmtRp(data.variance)}
              </span>
            </div>
          )}
        </>
      ) : (
        /* Hari Proyeksi Masa Depan */
        <div className="space-y-1.5">
          <div className="text-[10.5px] italic" style={{ color: colors.textMuted }}>
            Proyeksi berdasarkan run-rate saat ini:
          </div>
          <div className="flex items-center justify-between">
            <span style={{ color: colors.textMuted }}>Target Ideal:</span>
            <span className="mono font-semibold" style={{ color: colors.blue }}>
              {fmtRp(data.idealTarget)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span style={{ color: colors.textMuted }}>Est. Kumulatif:</span>
            <span className="mono font-bold" style={{ color: colors.violet }}>
              {fmtRp(data.projected)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
