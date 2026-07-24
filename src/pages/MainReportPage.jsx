import { useMemo } from "react";
import {
  ResponsiveContainer, BarChart, Bar, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip,
} from "recharts";
import {
  Target, TrendingUp, TrendingDown, Sparkles, Users, Boxes,
  CalendarDays, LayoutDashboard,
} from "lucide-react";
import { fmtRp, fmtNum } from "../utils/formatters.js";
import { dateKey } from "../utils/aggregation.js";
import { KpiCard } from "../components/KpiCard.jsx";
import { PaceStrip } from "../components/PaceStrip.jsx";
import { AchBadge } from "../components/AchBadge.jsx";
import { DataTable } from "../components/ui/DataTable.jsx";
import { SectionTitle, DrilldownButton, createChartTooltipStyle } from "../components/ui/index.jsx";
import { ProjectionCard, PeriodComparisonCard } from "../components/cards/index.jsx";
import { InsightBanner } from "../components/executive/InsightBanner.jsx";

/* ============================================================================
   TAB: MAIN REPORT
   Pace strip + alerts + comparison + 6 KPI + proyeksi + 2 chart + tabel sales.
============================================================================ */
export function MainReportPage({ agg, workDays, colors, onDrilldown, comparison, onClearComparison, projectionMethod, onProjectionMethodChange, dataQualityNotes, onNavigate }) {
  const uniqueDaysInData = useMemo(() => new Set(agg.filteredRows.map(r => dateKey(r.date))).size, [agg.filteredRows]);
  const t = agg.totals;
  // Calculate time gone based on unique work days found in the data vs total work days in the month.
  const timeGone = workDays ? Math.min(1, uniqueDaysInData / workDays) : 0;
  return (
    <div className="sm-page-enter">
      <PaceStrip timeGonePct={timeGone} achPct={t.ach} colors={colors} />
      {(agg.alerts.length > 0 || dataQualityNotes) && (
        <div className="mb-6">
          <InsightBanner alerts={agg.alerts} dataQualityNotes={dataQualityNotes} colors={colors} onNavigate={onNavigate} onDrilldown={onDrilldown} />
        </div>
      )}
      <PeriodComparisonCard comparison={comparison} colors={colors} onClear={onClearComparison} />
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
        <KpiCard label="Target Value" value={t.targetValue} isMoney icon={Target} accent={colors.blue} delay={0} colors={colors} />
        <KpiCard label="Realisasi Value" value={t.realisasiValue} isMoney icon={TrendingUp} accent={colors.mint} delay={40} colors={colors} trend={agg.daily.map((d) => d.value)} />
        <KpiCard label="Achievement" value={t.ach} isPct icon={Sparkles} accent={colors.gold} delay={80} colors={colors} />
        <KpiCard label="Deviasi Value" value={t.deviasiValue} isMoney icon={TrendingDown} accent={colors.coral} delay={120} colors={colors} />
        <KpiCard label="Active Outlet" value={t.realisasiAo} icon={Users} accent={colors.violet} delay={160} colors={colors} />
        <KpiCard label="Target AO" value={t.targetAo} icon={Boxes} accent={colors.textMuted} delay={200} colors={colors} />
      </div>

      <ProjectionCard projection={agg.projection} totals={t} colors={colors} method={projectionMethod} onMethodChange={onProjectionMethodChange} />

      <div className="grid lg:grid-cols-2 gap-6 mb-8">
        <div className="sm-card p-5 sm-fadeup">
          <SectionTitle title="Tren Harian" sub="Realisasi value per tanggal" icon={CalendarDays} colors={colors} accent={colors.gold} />
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={agg.daily}>
              <defs>
                <linearGradient id="gGold" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={colors.gold} stopOpacity={0.5} />
                  <stop offset="100%" stopColor={colors.gold} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={colors.chartGrid} vertical={false} />
              <XAxis dataKey="date" tick={{ fill: colors.textMuted, fontSize: 11 }} axisLine={{ stroke: colors.border }} tickLine={false} />
              <YAxis tick={{ fill: colors.textMuted, fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => fmtNum(v / 1e6) + "jt"} />
              <Tooltip contentStyle={createChartTooltipStyle(colors)} formatter={(v) => fmtRp(v)} />
              <Area type="monotone" dataKey="value" stroke={colors.gold} fill="url(#gGold)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="sm-card p-5 sm-fadeup" style={{ animationDelay: "60ms" }}>
          <SectionTitle title="Kumulatif Bulanan" sub="Total realisasi per bulan" icon={LayoutDashboard} colors={colors} accent={colors.mint} />
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={agg.monthly}>
              <defs>
                <linearGradient id="gMint" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={colors.mint} stopOpacity={0.85} />
                  <stop offset="100%" stopColor={colors.mint} stopOpacity={0.15} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={colors.chartGrid} vertical={false} />
              <XAxis dataKey="month" tick={{ fill: colors.textMuted, fontSize: 11 }} axisLine={{ stroke: colors.border }} tickLine={false} />
              <YAxis tick={{ fill: colors.textMuted, fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => fmtNum(v / 1e6) + "jt"} />
              <Tooltip contentStyle={createChartTooltipStyle(colors)} formatter={(v) => fmtRp(v)} cursor={{ fill: colors.glassSubtle }} />
              <Bar dataKey="value" fill="url(#gMint)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <SectionTitle title="Ringkasan Semua Sales" icon={Users} colors={colors} accent={colors.blue} />
      <DataTable
        colors={colors}
        initialSortKey="realisasiValue"
        columns={[
          { key: "name", label: "Sales" },
          { key: "targetValue", label: "Target", render: (r) => <span className="mono">{fmtRp(r.targetValue)}</span> },
          { key: "realisasiValue", label: "Realisasi", render: (r) => <span className="mono">{fmtRp(r.realisasiValue)}</span> },
          { key: "ach", label: "ACH", render: (r) => <AchBadge ach={r.ach} colors={colors} /> },
          { key: "deviasiValue", label: "Deviasi", render: (r) => <span className="mono" style={{ color: colors.textMuted }}>{fmtRp(r.deviasiValue)}</span> },
          { key: "realisasiAo", label: "AO", render: (r) => <span className="mono">{r.realisasiAo}/{r.targetAo}</span> },
          { key: "_drilldown", label: "", render: (r) => onDrilldown && <DrilldownButton colors={colors} onClick={() => onDrilldown(r.name, "Semua outlet", r.predicate)} /> },
        ]}
        rows={agg.bySales}
      />
    </div>
  );
}
