import { useMemo } from "react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell,
} from "recharts";
import {
  Store, Settings, CheckCircle2, AlertTriangle, XCircle,
} from "lucide-react";
import { fmtRp, fmtNum } from "../utils/formatters.js";
import { computeOutletAnalysis } from "../utils/aggregation.js";
import { KpiCard } from "../components/KpiCard.jsx";
import { DataTable } from "../components/ui/DataTable.jsx";
import { CollapsibleSection, createChartTooltipStyle } from "../components/ui/index.jsx";

/* ============================================================================
   TAB: ANALISIS OUTLET
   Segmentasi outlet berdasarkan Recency (Aktif/Berisiko/Dormant) dengan
   threshold yang dapat diatur user. Berisi KPI summary, chart distribusi
   status, dan tabel detail outlet dengan breakdown produk di modal terpisah.
============================================================================ */

export const OUTLET_STATUS_META = {
  active: { label: "Aktif", color: "mint" },
  at_risk: { label: "Berisiko", color: "gold" },
  dormant: { label: "Dormant", color: "coral" },
  unknown: { label: "-", color: "textMuted" },
};

export function OutletStatusBadge({ status, colors }) {
  const meta = OUTLET_STATUS_META[status] || OUTLET_STATUS_META.unknown;
  const color = colors[meta.color];
  return (
    <span className="text-xs font-semibold inline-flex items-center px-2 py-0.5 rounded-full"
      style={{ color, background: color + "1A", border: `1px solid ${color}44` }}>
      {meta.label}
    </span>
  );
}

export function OutletAnalysisPage({ agg, colors, thresholds, setThresholds, onSelectOutlet }) {
  const { list, summary } = useMemo(
    () => computeOutletAnalysis(agg.filteredRows, agg.meta, thresholds),
    [agg.filteredRows, agg.meta, thresholds]
  );

  const chartData = [
    { name: "Aktif", value: summary.active, fill: colors.mint },
    { name: "Berisiko", value: summary.atRisk, fill: colors.gold },
    { name: "Dormant", value: summary.dormant, fill: colors.coral },
  ];

  return (
    <div className="sm-fadein">
      <CollapsibleSection id="outletAnalysis.main" title="Analisis Outlet" sub="Segmentasi outlet berdasarkan aktivitas beli — mengikuti filter yang aktif" icon={Store} colors={colors}>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <KpiCard label="Total Outlet" value={summary.total} icon={Store} accent={colors.blue} colors={colors} />
          <KpiCard label="Outlet Aktif" value={summary.active} icon={CheckCircle2} accent={colors.mint} colors={colors} />
          <KpiCard label="Outlet Berisiko" value={summary.atRisk} icon={AlertTriangle} accent={colors.gold} colors={colors} />
          <KpiCard label="Outlet Dormant" value={summary.dormant} icon={XCircle} accent={colors.coral} colors={colors} />
        </div>

        <div className="sm-card p-4 mb-6 flex flex-wrap items-center gap-4">
          <div className="text-sm font-medium flex items-center gap-2" style={{ color: colors.textMuted }}>
            <Settings size={14} /> Ambang Status:
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span>Aktif ≤</span>
            <input type="number" min={0} value={thresholds.activeMaxDays}
              onChange={(e) => setThresholds((prev) => ({ ...prev, activeMaxDays: Math.max(0, Number(e.target.value) || 0) }))}
              className="w-16 px-2 py-1 rounded-md mono text-sm text-center" style={{ background: colors.surface2, border: `1px solid ${colors.border}` }} />
            <span>hari</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span>Dormant &gt;</span>
            <input type="number" min={0} value={thresholds.dormantMinDays}
              onChange={(e) => setThresholds((prev) => ({ ...prev, dormantMinDays: Math.max(prev.activeMaxDays, Number(e.target.value) || 0) }))}
              className="w-16 px-2 py-1 rounded-md mono text-sm text-center" style={{ background: colors.surface2, border: `1px solid ${colors.border}` }} />
            <span>hari</span>
          </div>
          <div className="text-xs" style={{ color: colors.textMuted }}>
            (di antara keduanya = <b>Berisiko</b>)
          </div>
        </div>

        {list.length === 0 ? (
          <div className="sm-card p-16 text-center">
            <p className="text-sm" style={{ color: colors.textMuted }}>Tidak ada data outlet untuk kombinasi filter ini.</p>
          </div>
        ) : (
          <>
            <div className="sm-card p-5 mb-6">
              <div className="text-xs uppercase tracking-wider mb-3" style={{ color: colors.textMuted }}>Distribusi Status Outlet</div>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={chartData} layout="vertical" margin={{ left: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={colors.border} horizontal={false} />
                  <XAxis type="number" allowDecimals={false} tick={{ fill: colors.textMuted, fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="name" width={70} tick={{ fill: colors.text, fontSize: 12 }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={createChartTooltipStyle(colors)} formatter={(v) => `${v} outlet`} />
                  <Bar dataKey="value" radius={[0, 6, 6, 0]}>
                    {chartData.map((d, i) => <Cell key={i} fill={d.fill} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <DataTable
              colors={colors}
              initialSortKey="value"
              searchable
              searchKeys={["outletName", "salesLabel"]}
              searchPlaceholder="Cari nama outlet atau sales..."
              columns={[
                { key: "outletName", label: "Nama Outlet", render: (o) => (
                  <button onClick={() => onSelectOutlet(o)} className="text-left hover:underline" style={{ color: colors.text }}>{o.outletName}</button>
                ) },
                { key: "salesLabel", label: "Sales", render: (o) => (
                  <span className="inline-flex items-center gap-1.5 min-w-0 max-w-full sm:max-w-[220px]" title={o.salesLabel}>
                    <span className="truncate">{o.salesLabel}</span>
                    {o.salesNames.length > 1 && (
                      <span className="shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded-full" style={{ background: colors.gold + "1A", color: colors.gold }}>
                        {o.salesNames.length}
                      </span>
                    )}
                  </span>
                ) },
                { key: "value", label: "Total Value", render: (o) => <span className="mono">{fmtRp(o.value)}</span> },
                { key: "invoiceCount", label: "Frekuensi", render: (o) => <span className="mono">{fmtNum(o.invoiceCount)}×</span> },
                { key: "groupCount", label: "Grup Produk", render: (o) => <span className="mono">{o.groupCount}</span> },
                { key: "lastDate", label: "Terakhir Transaksi", render: (o) => <span className="mono text-xs" style={{ color: colors.textMuted }}>{o.lastDate || "-"}</span> },
                { key: "daysSinceLastPurchase", label: "Jeda", render: (o) => <span className="mono">{o.daysSinceLastPurchase ?? "-"}</span> },
                { key: "status", label: "Status", render: (o) => <OutletStatusBadge status={o.status} colors={colors} /> },
              ]}
              rows={list}
            />
          </>
        )}
      </CollapsibleSection>
    </div>
  );
}
