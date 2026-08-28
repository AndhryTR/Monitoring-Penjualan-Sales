import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell,
} from "recharts";
import { Boxes, Package, Download } from "lucide-react";
import { fmtRp, fmtNum, fmtMixedUnits } from "../utils/formatters.js";
import { notifyExportSuccess } from "../utils/notifyExport.js";
import { AchBadge } from "../components/AchBadge.jsx";
import { ACH_TIERS } from "../constants/thresholds.js";
import { DataTable } from "../components/ui/DataTable.jsx";
import { SectionTitle, DrilldownButton, AchBarChartTooltip } from "../components/ui/index.jsx";

/* ============================================================================
   TAB: PRODUCT REPORT
   Bar chart vertical per grup produk + tabel detail grup.
   ⚠️ Sprint G1: tambah kolom Stok Tersisa + Coverage dari stockData.
============================================================================ */
export function ProductReportPage({ agg, colors, onDrilldown, onGroupDrilldown, depotName, currentStock, stockSummary, slideshowMode = false }) {
  const handleExport = async () => {
    const { exportProductReportExcel } = await import("../utils/reportExcelExport.js");
    exportProductReportExcel(agg.byGroup, {
      depotName, dateRangeLabel: agg.meta.firstDate ? `${agg.meta.firstDate} — ${agg.meta.lastDate}` : "",
    });
    await notifyExportSuccess("Export berhasil", "Laporan Produk (Excel)");
  };

  // Hitung stok per grup dari currentStock Map
  // currentStock = Map<productCode, StockItem>
  // agg.byGroup = [{ name, targetValue, realisasiValue, ach, realisasiAo, predicate }]
  // Kita aggregate stok per grup dengan filter transaksi by predicate
  const stockByGroup = agg.byGroup.map((g) => {
    if (!currentStock || !currentStock.size) return { ...g, stockQty: null, stockValue: null, stockKarton: null, coverageDays: null };
    let totalQty = 0, totalValue = 0, totalKarton = 0;
    let productCount = 0, criticalCount = 0;
    for (const [, stock] of currentStock) {
      if (stock.group !== g.name) continue;
      totalQty += stock.currentQty || 0;
      totalValue += stock.currentValue || 0;
      totalKarton += stock.currentQtyKarton || 0;
      productCount++;
      if (stock.currentQty <= 0 || (stock.openingQty > 0 && stock.currentQty < stock.openingQty * 0.2)) criticalCount++;
    }
    // Coverage: berapa hari stok aman berdasarkan rate penjualan
    // realisasiValue per grup / uniqueDays = avg daily value
    // stockValue / avgDailyValue = coverage days
    const avgDailyValue = agg.meta.uniqueDays > 0 ? (g.realisasiValue / agg.meta.uniqueDays) : 0;
    const coverageDays = avgDailyValue > 0 && totalValue > 0 ? totalValue / avgDailyValue : null;
    return { ...g, stockQty: totalQty, stockValue: totalValue, stockKarton: totalKarton, coverageDays, productCount, criticalCount };
  });
  // ⚠️ Bug fix (Sprint 3 / P4): sebelumnya `CustomTooltip` didefinisikan DI DALAM
  // body komponen. Setiap render produce new function ref → Recharts anggap
  // new component type → `<Tooltip content={<CustomTooltip />}>` unmount+remount
  // subtree di setiap render. Fix: pakai shared `AchBarChartTooltip` yang sudah
  // di-hoist ke module scope di components/ui/index.jsx, pass `colors` lewat
  // props. Hilangkan duplikasi dengan SalesReportPage.

  return (
    <div className="sm-page-enter">
      <SectionTitle title="Pencapaian per Grup Produk" sub="Ranking berdasarkan realisasi" icon={Boxes} colors={colors} accent={colors.mint} />
      <ResponsiveContainer width="100%" height={Math.max(240, agg.byGroup.length * 42)}>
        <BarChart data={agg.byGroup} layout="vertical" margin={{ left: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={colors.chartGrid} horizontal={false} />
          <XAxis type="number" tick={{ fill: colors.textMuted, fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => fmtNum(v / 1e6) + "jt"} />
          <YAxis type="category" dataKey="name" width={170} tick={{ fill: colors.text, fontSize: 12 }} axisLine={false} tickLine={false} />
          <Tooltip content={<AchBarChartTooltip colors={colors} />} cursor={{ fill: colors.glassSubtle }} />
          <Bar dataKey="realisasiValue" radius={[0, 6, 6, 0]}>
            {agg.byGroup.map((r, i) => <Cell key={i} fill={r.ach >= ACH_TIERS.onPace ? colors.mint : r.ach >= ACH_TIERS.warning ? colors.gold : colors.coral} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {/* Detail Grup Produk — di-hide di mode slideshow */}
      {!slideshowMode && (
      <div className="mt-8">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-0">
          <SectionTitle title="Detail Grup Produk" icon={Package} colors={colors} />
          <button onClick={handleExport}
            className="sm-btn inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
            style={{ background: colors.glassFill, border: `1px solid ${colors.glassBorder}`, color: colors.text }}>
            <Download size={13} /> Export Excel
          </button>
        </div>
        <DataTable
          key="product-report-table"
          rowKey="name"
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
            { key: "_sku", label: "", render: (r) => onGroupDrilldown && (
              <DrilldownButton colors={colors} onClick={() => onGroupDrilldown(r.name, r.predicate)} label="SKU" />
            ) },
            { key: "_drilldown", label: "", render: (r) => onDrilldown && <DrilldownButton colors={colors} onClick={() => onDrilldown(r.name, "Outlet", r.predicate)} /> },
          ]}
          rows={agg.byGroup}
        />
      </div>
      )}
    </div>
  );
}
