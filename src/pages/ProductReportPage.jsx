import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell,
} from "recharts";
import { Boxes, Package } from "lucide-react";
import { fmtRp, fmtNum } from "../utils/formatters.js";
import { AchBadge } from "../components/AchBadge.jsx";
import { DataTable } from "../components/ui/DataTable.jsx";
import { SectionTitle, DrilldownButton } from "../components/ui/index.jsx";

/* ============================================================================
   TAB: PRODUCT REPORT
   Bar chart vertical per grup produk + tabel detail grup.
============================================================================ */
export function ProductReportPage({ agg, colors, onDrilldown }) {
  // Custom Tooltip yang sama untuk Product Report
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      const barColor = data.ach >= 1 ? colors.mint : data.ach >= 0.7 ? colors.gold : colors.coral;
      return (
        <div className="p-3 shadow-lg" style={{ background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: 10, fontSize: 12 }}>
          <div className="font-semibold mb-1" style={{ color: colors.text }}>{label}</div>
          <div className="mono font-semibold" style={{ color: barColor }}>
            Realisasi: {fmtRp(data.realisasiValue)}
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="sm-fadein">
      <SectionTitle title="Pencapaian per Grup Produk" sub="Ranking berdasarkan realisasi" icon={Boxes} colors={colors} />
      <ResponsiveContainer width="100%" height={Math.max(240, agg.byGroup.length * 42)}>
        <BarChart data={agg.byGroup} layout="vertical" margin={{ left: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={colors.border} horizontal={false} />
          <XAxis type="number" tick={{ fill: colors.textMuted, fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => fmtNum(v / 1e6) + "jt"} />
          <YAxis type="category" dataKey="name" width={170} tick={{ fill: colors.text, fontSize: 12 }} axisLine={false} tickLine={false} />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: colors.surface2 }} />
          <Bar dataKey="realisasiValue" radius={[0, 6, 6, 0]}>
            {agg.byGroup.map((r, i) => <Cell key={i} fill={r.ach >= 1 ? colors.mint : r.ach >= 0.7 ? colors.gold : colors.coral} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      <div className="mt-8">
        <SectionTitle title="Detail Grup Produk" icon={Package} colors={colors} />
        <DataTable
          colors={colors}
          initialSortKey="realisasiValue"
          searchable
          searchKeys={["name"]}
          searchPlaceholder="Cari grup produk..."
          columns={[
            { key: "name", label: "Grup Produk" },
            { key: "targetValue", label: "Target", render: (r) => <span className="mono">{fmtRp(r.targetValue)}</span> },
            { key: "realisasiValue", label: "Realisasi", render: (r) => <span className="mono">{fmtRp(r.realisasiValue)}</span> },
            { key: "ach", label: "ACH", render: (r) => <AchBadge ach={r.ach} colors={colors} /> },
            { key: "realisasiAo", label: "Outlet", render: (r) => <span className="mono">{r.realisasiAo}</span> },
            { key: "_drilldown", label: "", render: (r) => onDrilldown && <DrilldownButton colors={colors} onClick={() => onDrilldown(r.name, "Outlet", r.predicate)} /> },
          ]}
          rows={agg.byGroup}
        />
      </div>
    </div>
  );
}
