import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, Cell } from "recharts";
import { createChartTooltipStyle } from "../ui/index.jsx";
import { fmtRp, fmtNum, fmtPct } from "../../utils/formatters.js";

/* ============================================================================
   GROUPEDBARCHART — bar per entitas, warna per periode.
   Data: [{ name, [periodLabel]: value }]. Legend pakai warna periode.
   Tooltip mengikuti metrik aktif (money / pct / angka).
============================================================================ */
export function GroupedBarChart({ data, periods, periodColor, metricKey, isMoney, isPct, colors }) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={colors.chartGrid} vertical={false} />
        <XAxis dataKey="name" tick={{ fill: colors.textMuted, fontSize: 11 }} axisLine={{ stroke: colors.border }} tickLine={false} interval={0} angle={-12} dy={10} height={44} />
        <YAxis tick={{ fill: colors.textMuted, fontSize: 11 }} axisLine={false} tickLine={false} width={64} tickFormatter={(v) => isMoney ? fmtRp(v).replace(/Rp\s?/, "Rp ") : isPct ? fmtPct(v) : fmtNum(v)} />
        <Tooltip
          contentStyle={createChartTooltipStyle(colors)}
          formatter={(v, name) => {
            const label = name;
            const val = isPct ? fmtPct(v) : isMoney ? fmtRp(v) : fmtNum(v);
            return [val, label];
          }}
          cursor={{ fill: colors.glassSubtle }}
        />
        <Legend wrapperStyle={{ fontSize: 11, color: colors.textMuted }} />
        {periods.map((p, i) => (
          <Bar key={p.id} dataKey={p.label} stackId={undefined} fill={periodColor(p, i)} radius={i === periods.length - 1 ? [4, 4, 0, 0] : 0} maxBarSize={40} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

// Warna bar per periode: palet 5 tema -> 10 ekstra -> HSL golden-angle.
export function periodColorPicker(colors) {
  const BASE = ["gold", "mint", "violet", "blue", "coral"];
  const EXTRA = ["#F472B6", "#38BDF8", "#A3E635", "#FB923C", "#818CF8", "#2DD4BF", "#E879F9", "#FACC15", "#4ADE80", "#FB7185"];
  return (p, i) => {
    if (i < BASE.length) return colors[BASE[i]];
    const x = i - BASE.length;
    if (x < EXTRA.length) return EXTRA[x];
    return `hsl(${((x - EXTRA.length) * 137.508) % 360}, 70%, 55%)`;
  };
}
