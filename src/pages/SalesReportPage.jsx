import { useMemo } from "react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell,
} from "recharts";
import { UserRound, Boxes, CalendarClock } from "lucide-react";
import { fmtRp, fmtNum } from "../utils/formatters.js";
import { exportSalesScorecardPDF } from "../utils/pdfExport.js";
import { getLastDaySalesMap } from "../utils/aggregation.js";
import { DataTable } from "../components/ui/DataTable.jsx";
import { SectionTitle, DrilldownButton } from "../components/ui/index.jsx";
import { Leaderboard } from "../components/cards/index.jsx";
import { AchBadge } from "../components/AchBadge.jsx";

/* ============================================================================
   TAB: SALES REPORT
   Leaderboard + bar chart vertical per sales + tabel detail per Sales × Grup.
============================================================================ */
const MONTHS_ID_SHORT = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
function formatDateIDShort(dateStr) {
  if (!dateStr) return "-";
  const [y, m, d] = dateStr.split("-").map(Number);
  if (!y || !m || !d) return dateStr;
  return `${d} ${MONTHS_ID_SHORT[m - 1]} ${y}`;
}

export function SalesReportPage({ agg, colors, onDrilldown, workDays, depotName }) {
  const rows = agg.bySales;
  const handleExportScorecard = (salesRow) => exportSalesScorecardPDF(salesRow, agg, { workDays, depotName });
  const groupRows = useMemo(() => rows.flatMap((sm) => sm.groups.map((g) => ({
    salesName: sm.name, groupName: g.name, value: g.realisasiValue, predicate: g.predicate,
  }))), [rows]);

  // Perbandingan pencapaian TOTAL periode vs HARI TERAKHIR per sales.
  // "Hari terakhir" = tanggal transaksi terakhir dalam data yang sedang
  // difilter (agg.meta.lastDate), bukan tanggal sistem hari ini.
  const lastDaySalesMap = useMemo(() => getLastDaySalesMap(agg.filteredRows, agg.meta.lastDate), [agg.filteredRows, agg.meta.lastDate]);
  const totalVsLastDayRows = useMemo(() => rows.map((sm) => {
    const ld = lastDaySalesMap[sm.code] || { valueLastDay: 0, aoLastDay: 0 };
    return {
      code: sm.code, salesName: sm.name,
      totalValue: sm.realisasiValue, totalAo: sm.realisasiAo, totalAch: sm.ach,
      lastDayValue: ld.valueLastDay, lastDayAo: ld.aoLastDay,
      predicate: sm.predicate,
    };
  }), [rows, lastDaySalesMap]);

  // Custom Tooltip untuk menyesuaikan warna teks dengan warna bar
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
      <Leaderboard rows={rows} colors={colors} onDrilldown={onDrilldown} onExportScorecard={handleExportScorecard} />

      <div className="mt-8 mb-8">
        <SectionTitle
          title="Total Periode vs Hari Terakhir"
          sub={agg.meta.lastDate ? `Pencapaian & AO total dibandingkan hari terakhir (${formatDateIDShort(agg.meta.lastDate)})` : "Belum ada data"}
          icon={CalendarClock}
          colors={colors}
        />
        <DataTable
          colors={colors}
          initialSortKey="totalValue"
          searchable
          searchKeys={["salesName"]}
          searchPlaceholder="Cari nama sales..."
          mobileTitleKey="salesName"
          columns={[
            { key: "salesName", label: "Sales" },
            { key: "totalValue", label: "Realisasi Total", render: (r) => <span className="mono">{fmtRp(r.totalValue)}</span> },
            { key: "totalAo", label: "AO Total", render: (r) => <span className="mono">{fmtNum(r.totalAo)}</span> },
            { key: "totalAch", label: "ACH% Total", render: (r) => <AchBadge ach={r.totalAch} colors={colors} /> },
            { key: "lastDayValue", label: "Realisasi H-Terakhir", render: (r) => <span className="mono">{fmtRp(r.lastDayValue)}</span> },
            { key: "lastDayAo", label: "AO H-Terakhir", render: (r) => <span className="mono">{fmtNum(r.lastDayAo)}</span> },
            { key: "_drilldown", label: "", render: (r) => onDrilldown && <DrilldownButton colors={colors} onClick={() => onDrilldown(r.salesName, "Semua outlet", r.predicate)} /> },
          ]}
          rows={totalVsLastDayRows}
        />
      </div>

      <SectionTitle title="Performa per Sales" sub="Pilih Sales pada filter di atas untuk melihat detail" icon={UserRound} colors={colors} />
      <ResponsiveContainer width="100%" height={Math.max(220, rows.length * 46)}>
        <BarChart data={rows} layout="vertical" margin={{ left: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={colors.border} horizontal={false} />
          <XAxis type="number" tick={{ fill: colors.textMuted, fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => fmtNum(v / 1e6) + "jt"} />
          <YAxis type="category" dataKey="name" width={160} tick={{ fill: colors.text, fontSize: 12 }} axisLine={false} tickLine={false} />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: colors.surface2 }} />
          <Bar dataKey="realisasiValue" radius={[0, 6, 6, 0]}>
            {rows.map((r, i) => <Cell key={i} fill={r.ach >= 1 ? colors.mint : r.ach >= 0.7 ? colors.gold : colors.coral} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      <div className="mt-8">
        <SectionTitle title="Detail per Sales × Grup Produk" icon={Boxes} colors={colors} />
        <DataTable
          colors={colors}
          initialSortKey="value"
          searchable
          searchKeys={["salesName", "groupName"]}
          searchPlaceholder="Cari nama sales atau grup produk..."
          columns={[
            { key: "salesName", label: "Sales" },
            { key: "groupName", label: "Grup Produk" },
            { key: "value", label: "Realisasi", render: (r) => <span className="mono">{fmtRp(r.value)}</span> },
            { key: "_drilldown", label: "", render: (r) => onDrilldown && <DrilldownButton colors={colors} onClick={() => onDrilldown(`${r.salesName} — ${r.groupName}`, "Outlet", r.predicate)} /> },
          ]}
          rows={groupRows}
        />
      </div>
    </div>
  );
}
