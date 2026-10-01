import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";
import { createChartTooltipStyle } from "../../styles/globalStyle.js";
import { fmtRp, fmtNum, fmtPct, fmtDeviasi } from "../../utils/formatters.js";

/* ============================================================================
   GROUPEDBARCHART — bar per entitas, warna per periode.
   Data: [{ name, [periodLabel]: value }]. Legend pakai warna periode.
   Tooltip mengikuti metrik aktif (money / pct / angka).
============================================================================ */
export function GroupedBarChart({ data, periods, periodColor, _metricKey, isMoney, isPct, isDeviasi, colors }) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={colors.chartGrid} vertical={false} />
        <XAxis dataKey="name" tick={{ fill: colors.textMuted, fontSize: 11 }} axisLine={{ stroke: colors.border }} tickLine={false} interval={0} angle={-12} dy={10} height={44} />
        <YAxis tick={{ fill: colors.textMuted, fontSize: 11 }} axisLine={false} tickLine={false} width={64} tickFormatter={(v) => isDeviasi ? fmtDeviasi(v).replace(/\\+Rp\\s?/, "+Rp ") : isMoney ? fmtRp(v).replace(/Rp\s?/, "Rp ") : isPct ? fmtPct(v) : fmtNum(v)} />
        <Tooltip
          contentStyle={createChartTooltipStyle(colors)}
          formatter={(v, name) => {
            const label = name;
            const val = isPct ? fmtPct(v) : isDeviasi ? fmtDeviasi(v) : isMoney ? fmtRp(v) : fmtNum(v);
            return [val, label];
          }}
          cursor={{ fill: colors.glassSubtle }}
        />
        <Legend wrapperStyle={{ fontSize: 11, color: colors.textMuted }} />
        {periods.map((p, i) => (
          <Bar key={p.id} dataKey={p.label} fill={periodColor(p, i)} radius={i === periods.length - 1 ? [4, 4, 0, 0] : 0} maxBarSize={40} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
