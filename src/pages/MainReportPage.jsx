import { useMemo } from "react";
import {
  ResponsiveContainer, BarChart, Bar, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip,
} from "recharts";
import {
  Target, TrendingUp, TrendingDown, Sparkles, Users,
  CalendarDays, LayoutDashboard,
} from "lucide-react";
import { fmtRp, fmtNum, fmtCompactNum } from "../utils/formatters.js";
import { dateKey } from "../utils/aggregation.js";
import { ACH_TIERS } from "../constants/thresholds.js";
import { KpiBigCard } from "../components/KpiBigCard.jsx";
import { PaceStrip } from "../components/PaceStrip.jsx";
import { AchBadge } from "../components/AchBadge.jsx";
import { DataTable } from "../components/ui/DataTable.jsx";
import { SectionTitle, DrilldownButton } from "../components/ui/index.jsx";
import { createChartTooltipStyle } from "../styles/globalStyle.js";
import { ProjectionCard, PeriodComparisonCard } from "../components/cards/index.jsx";

/* ============================================================================
   TAB: MAIN REPORT — REDESIGN (Sprint 11)
   ⚠️ Sebelumnya: 6 KPI card di grid-cols-6 (cramped, angka tumpah).
   Sekarang: 6 KpiBigCard di grid-cols-3 (2 baris × 3 kolom) dengan:
   - Mini sparkline / progress bar per card
   - Delta vs kemarin/bulan lalu
   - Contextual hints ("Pace: X hari", "Perlu Rp X/hari")
   - Card 6 diganti: Target AO → Proyeksi Akhir Bulan (lebih actionable)
============================================================================ */
export function MainReportPage({ agg, workDays, colors, onDrilldown, comparison, onClearComparison, projectionMethod, onProjectionMethodChange, rawRows, filters, slideshowMode = false, loading = false }) {
  const isAggLoading = loading || Boolean(agg?.aggregationLoading && !agg?.totals?.targetValue && !agg?.totals?.realisasiValue);
  const uniqueDaysInData = useMemo(() => new Set((agg?.filteredRows || []).map(r => dateKey(r.date))).size, [agg?.filteredRows]);
  const t = agg?.totals || {};
  const timeGone = workDays ? Math.min(1, uniqueDaysInData / workDays) : 0;

  // Kumulatif bulanan untuk sparkline Target Value card — agregasi ringan tanpa computeAggregates
  const monthlyCumulative = useMemo(() => {
    if (!rawRows || !rawRows.length) return [];
    const salesFilter = filters?.salesCodes || filters?.sales;
    const allowedSales = salesFilter?.length ? new Set(salesFilter) : null;
    const allowedGroups = filters?.groups?.length ? new Set(filters.groups) : null;
    const monthMap = {};
    for (let i = 0; i < rawRows.length; i++) {
      const r = rawRows[i];
      if (allowedSales && (!r.salesCode || !allowedSales.has(r.salesCode))) continue;
      if (allowedGroups && (!r.group || !allowedGroups.has(r.group))) continue;
      if (!r.date) continue;
      const m = r.date.slice(0, 7);
      if (!m) continue;
      monthMap[m] = (monthMap[m] || 0) + (Number(r.value) || 0);
    }
    return Object.entries(monthMap)
      .map(([month, value]) => ({ month, value }))
      .sort((a, b) => a.month.localeCompare(b.month))
      .slice(-12);
  }, [rawRows, filters?.salesCodes, filters?.sales, filters?.groups]);

  // Daily values untuk sparkline Realisasi card
  const dailyValues = useMemo(() => agg.daily.map(d => d.value), [agg.daily]);

  // Delta realisasi: hari terakhir vs hari sebelumnya
  const realisasiDelta = useMemo(() => {
    if (agg.daily.length < 2) return null;
    const last = agg.daily[agg.daily.length - 1].value;
    const prev = agg.daily[agg.daily.length - 2].value;
    return last - prev;
  }, [agg.daily]);

  // Delta AO: hari terakhir vs hari sebelumnya
  const aoDelta = useMemo(() => {
    if (agg.daily.length < 2) return null;
    const last = agg.daily[agg.daily.length - 1].ao;
    const prev = agg.daily[agg.daily.length - 2].ao;
    return last - prev;
  }, [agg.daily]);

  // Deviasi: sisa target per hari
  const sisaHari = workDays ? Math.max(0, workDays - uniqueDaysInData) : 0;
  const sisaTarget = (t.targetValue || 0) - (t.realisasiValue || 0);
  const perluPerHari = sisaHari > 0 ? sisaTarget / sisaHari : 0;

  // Pace status
  const isAhead = t.ach !== null && t.ach >= timeGone;

  // ACH progress gradient (merah → kuning → hijau)
  const achGradient = `linear-gradient(90deg, ${colors.coral}, ${colors.gold}, ${colors.mint})`;

  return (
    <div className="sm-page-enter">
      <PaceStrip
        timeGonePct={timeGone}
        achPct={t.ach}
        colors={colors}
        targetValue={t.targetValue}
        realisasiValue={t.realisasiValue}
        workDays={workDays}
        uniqueDays={uniqueDaysInData}
        dailySeries={agg.daily}
        dateMeta={agg.meta}
      />
      <PeriodComparisonCard comparison={comparison} colors={colors} onClear={onClearComparison} />

      {/* ===== KPI GRID: 3-kolom × 2-baris ===== */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">

        {/* Row 1: KPI Utama */}
        {/* Card 1: Target Value */}
        <KpiBigCard
          label="Target Value"
          value={t.targetValue}
          isMoney
          icon={Target}
          accent={colors.blue}
          colors={colors}
          variant="sparkline"
          sparkData={monthlyCumulative.map(m => m.value)}
          footerLabel={monthlyCumulative.length > 1 ? `${monthlyCumulative.length} bulan terakhir` : (monthlyCumulative.length === 1 ? monthlyCumulative[0].month : "Belum ada history")}
          footerDelta={monthlyCumulative.length >= 2 && monthlyCumulative[monthlyCumulative.length-2].value > 0 ? `${((monthlyCumulative[monthlyCumulative.length-1].value / monthlyCumulative[monthlyCumulative.length-2].value - 1) * 100).toFixed(1)}%` : null}
          footerDeltaType={monthlyCumulative.length >= 2 ? (monthlyCumulative[monthlyCumulative.length-1].value >= monthlyCumulative[monthlyCumulative.length-2].value ? "pos" : "neg") : "neutral"}
          delay={0}
          loading={isAggLoading}
        />

        {/* Card 2: Realisasi Value */}
        <KpiBigCard
          label="Realisasi Value"
          value={t.realisasiValue}
          isMoney
          icon={TrendingUp}
          accent={colors.mint}
          colors={colors}
          variant="sparkline"
          sparkData={dailyValues}
          footerLabel={agg.daily.length > 0 ? `${agg.meta.uniqueDays} hari data` : "Belum ada data"}
          footerDelta={realisasiDelta !== null ? (realisasiDelta >= 0 ? `+${fmtRp(realisasiDelta)}` : fmtRp(realisasiDelta)) : null}
          footerDeltaType={realisasiDelta !== null ? (realisasiDelta >= 0 ? "pos" : "neg") : "neutral"}
          delay={40}
          loading={isAggLoading}
        />

        {/* Card 3: Achievement */}
        <KpiBigCard
          label="Achievement"
          value={t.ach}
          isPct
          icon={Sparkles}
          accent={colors.gold}
          colors={colors}
          variant="progress"
          progressValue={t.ach}
          progressGradient={achGradient}
          footerLabel={`Pace: ${uniqueDaysInData} dari ${workDays || 0} HK`}
          footerDelta={isAhead === null ? null : (isAhead ? "Di atas pace" : "Di bawah pace")}
          footerDeltaType={isAhead === null ? "neutral" : (isAhead ? "pos" : "neg")}
          delay={80}
          loading={isAggLoading}
        />

        {/* Row 2: KPI Sekunder */}
        {/* Card 4: Deviasi Value */}
        <KpiBigCard
          label="Deviasi Value"
          value={t.deviasiValue}
          isMoney
          icon={TrendingDown}
          accent={colors.coral}
          colors={colors}
          variant="none"
          footerLabel={`Sisa HK: ${sisaHari} hari`}
          footerDelta={sisaHari > 0 && sisaTarget > 0 ? `Perlu ${fmtRp(perluPerHari)}/hari` : "Target tercapai"}
          footerDeltaType={sisaTarget > 0 ? "neg" : "pos"}
          delay={120}
          loading={isAggLoading}
        />

        {/* Card 5: Active Outlet (AO) */}
        <KpiBigCard
          label="Active Outlet (AO)"
          value={`${fmtNum(t.realisasiAo)} / ${fmtNum(t.targetAo)}`}
          isPlain
          icon={Users}
          accent={colors.violet}
          colors={colors}
          variant="bar"
          progressValue={t.targetAo ? t.realisasiAo / t.targetAo : 0}
          footerLabel={t.targetAo ? `ACH AO: ${((t.realisasiAo / t.targetAo) * 100).toFixed(1)}%` : "-"}
          footerDelta={aoDelta !== null ? (aoDelta >= 0 ? `+${aoDelta} outlet` : `${aoDelta} outlet`) : null}
          footerDeltaType={aoDelta !== null ? (aoDelta >= 0 ? "pos" : "neg") : "neutral"}
          delay={160}
          loading={isAggLoading}
        />

        {/* Card 6: Proyeksi Akhir Bulan (mengganti Target AO) */}
        <KpiBigCard
          label="Proyeksi Akhir Bulan"
          value={agg.projection.projectedValue}
          isMoney
          icon={TrendingUp}
          accent={colors.blue}
          colors={colors}
          variant="sparkline"
          sparkData={dailyValues.length > 0 ? [...dailyValues, agg.projection.projectedValue] : []}
          footerLabel={`Metode: ${projectionMethod === "linear" ? "Linear" : projectionMethod === "trend7" ? "Tren 7 Hari" : "Pola Hari Kerja"}`}
          footerDelta={agg.projection.projectedAch !== null ? `ACH: ${(agg.projection.projectedAch * 100).toFixed(0)}%` : null}
          footerDeltaType={agg.projection.projectedAch !== null ? (agg.projection.projectedAch >= ACH_TIERS.onPace ? "pos" : "neg") : "neutral"}
          delay={200}
          loading={isAggLoading}
        />
      </div>

      {/* Projection card (existing, untuk detail metode proyeksi) */}
      <ProjectionCard projection={agg.projection} totals={t} colors={colors} method={projectionMethod} onMethodChange={onProjectionMethodChange} />

      {/* Charts: Tren Harian + Kumulatif Bulanan */}
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
              <YAxis tick={{ fill: colors.textMuted, fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={fmtCompactNum} />
              <Tooltip contentStyle={createChartTooltipStyle(colors)} formatter={(v) => fmtRp(v)} />
              <Area type="monotone" dataKey="value" stroke={colors.gold} fill="url(#gGold)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="sm-card p-5 sm-fadeup" style={{ animationDelay: "60ms" }}>
          <SectionTitle title="Kumulatif Bulanan" sub={`${monthlyCumulative.length ? `${monthlyCumulative.length > 1 ? `${monthlyCumulative.length} bulan terakhir` : monthlyCumulative[0].month} · ` : ""}Realisasi value per bulan`} icon={LayoutDashboard} colors={colors} accent={colors.mint} />
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={monthlyCumulative}>
              <defs>
                <linearGradient id="gMint" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={colors.mint} stopOpacity={0.85} />
                  <stop offset="100%" stopColor={colors.mint} stopOpacity={0.15} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={colors.chartGrid} vertical={false} />
              <XAxis dataKey="month" tick={{ fill: colors.textMuted, fontSize: 11 }} axisLine={{ stroke: colors.border }} tickLine={false} />
              <YAxis tick={{ fill: colors.textMuted, fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={fmtCompactNum} />
              <Tooltip contentStyle={createChartTooltipStyle(colors)} formatter={(v) => fmtRp(v)} cursor={{ fill: colors.glassSubtle }} />
              <Bar dataKey="value" fill="url(#gMint)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Tabel ringkasan sales */}
      {/* Tabel ringkasan sales — di-hide di mode slideshow */}
      {!slideshowMode && (
        <>
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
          { key: "achAo", label: "ACH AO", render: (r) => <AchBadge ach={r.achAo} colors={colors} /> },
          { key: "_drilldown", label: "", render: (r) => onDrilldown && <DrilldownButton colors={colors} onClick={() => onDrilldown(r.name, "Semua outlet", r.predicate)} /> },
        ]}
        rows={agg.bySales}
      />
        </>
      )}
    </div>
  );
}
