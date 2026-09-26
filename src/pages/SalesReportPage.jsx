import { useState, useMemo, useCallback } from "react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell,
} from "recharts";
import { UserRound, Boxes, CalendarClock, Coins } from "lucide-react";
import { fmtRp, fmtNum, formatDateIDShort, fmtCompactNum } from "../utils/formatters.js";
// ⚠️ Sprint 5 / S3: pdfExport.js & reportExcelExport.js tidak di-import saat
// initial bundle. Mereka berat (jspdf ~600KB, xlsx-js-style ~620KB). Sekarang
// di-load lazy via dynamic import() saat user benar-benar klik Export button.
// save: ~1.2MB dari initial bundle.
import { getLastDaySalesMap } from "../utils/aggregation.js";
import { notifyExportSuccess } from "../utils/notifyExport.js";
import { DataTable } from "../components/ui/DataTable.jsx";
import { SectionTitle, DrilldownButton, AchBarChartTooltip } from "../components/ui/index.jsx";
import { Leaderboard } from "../components/cards/index.jsx";
import { AchBadge } from "../components/AchBadge.jsx";
import { getAchColor } from "../constants/thresholds.js";
import { SalesCommissionView } from "../components/sales/SalesCommissionView.jsx";

/* ============================================================================
   TAB: SALES REPORT
   Leaderboard + bar chart vertical per sales + tabel detail per Sales × Grup
   + Sub-tab Kalkulator Komisi & Skema Insentif Sales.
============================================================================ */

export function SalesReportPage({ agg, colors, onDrilldown, workDays, depotName, slideshowMode = false }) {
  const [activeSubTab, setActiveSubTab] = useState("performance"); // "performance" | "commission"
  const rows = agg.bySales;
  // ⚠️ Sprint 5 / S3: dynamic import di handler — bundle pdfExport &
  // reportExcelExport (~1.2MB total) hanya di-load saat user klik Export.
  // Sebelumnya: static import → keduanya ada di initial bundle walau user
  // mungkin tidak pernah klik Export.
  const handleExportScorecard = useCallback(async (salesRow) => {
    const { exportSalesScorecardPDF } = await import("../utils/pdfExport.js");
    exportSalesScorecardPDF(salesRow, agg, { workDays, depotName });
    await notifyExportSuccess("Export berhasil", `Scorecard ${salesRow.name}`);
  }, [agg, workDays, depotName]);
  const groupRows = useMemo(() => rows.flatMap((sm) => sm.groups.map((g) => ({
    salesName: sm.name, groupName: g.name,
    value: g.realisasiValue, ao: g.realisasiAo,
    targetValue: g.targetValue || 0, targetAo: g.targetAo || 0,
    ach: g.ach, deviasiValue: g.deviasiValue ?? 0,
    // ⚠️ Deviasi tampilan (R-T): positif = target tercapai. Berbeda dari
    // aggregation (T-R = sisa target). Dipakai render & sort kolom.
    deviasiShow: (g.realisasiValue || 0) - (g.targetValue || 0),
    predicate: g.predicate,
  }))), [rows]);

  // Perbandingan pencapaian TOTAL periode vs HARI TERAKHIR per sales.
  // "Hari terakhir" = tanggal transaksi terakhir dalam data yang sedang
  // difilter (agg.meta.lastDate), bukan tanggal sistem hari ini.
  const lastDaySalesMap = useMemo(() => getLastDaySalesMap(agg.filteredRows, agg.meta.lastDate), [agg.filteredRows, agg.meta.lastDate]);
  const totalVsLastDayRows = useMemo(() => rows.map((sm) => {
    const ld = lastDaySalesMap[sm.code] || { valueLastDay: 0, aoLastDay: 0 };
    return {
      code: sm.code, salesName: sm.name,
      totalValue: sm.realisasiValue, totalAo: sm.realisasiAo, totalAch: sm.ach, totalAchAo: sm.achAo,
      lastDayValue: ld.valueLastDay, lastDayAo: ld.aoLastDay,
      predicate: sm.predicate,
      // Drilldown di tabel ini harus konsisten dengan data yang dilihat user —
      // cuma outlet yang bertransaksi HARI TERAKHIR (bukan seluruh periode).
      predicateLastDay: agg.meta.lastDate
        ? (row) => row.salesCode === sm.code && row.date === agg.meta.lastDate
        : sm.predicate,
    };
  }), [rows, lastDaySalesMap, agg.meta.lastDate]);
  const lastDateLabel = agg.meta.lastDate ? formatDateIDShort(agg.meta.lastDate) : "Hari Terakhir";

  // ⚠️ Bug fix (Sprint 3 / P4): sebelumnya `CustomTooltip` didefinisikan DI DALAM
  // body komponen. Setiap render produce new function ref → Recharts anggap
  // new component type → `<Tooltip content={<CustomTooltip />}>` unmount+remount
  // subtree di setiap render. Fix: pakai shared `AchBarChartTooltip` yang sudah
  // di-hoist ke module scope di components/ui/index.jsx, pass `colors` lewat
  // props. Hilangkan duplikasi dengan ProductReportPage.

  return (
    <div className="sm-page-enter">
      {/* Sub-tab Switcher */}
      {!slideshowMode && (
        <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
          <div
            className="inline-flex p-1 rounded-xl"
            style={{ background: colors.glassFill, border: `1px solid ${colors.glassBorder}` }}
          >
            <button
              onClick={() => setActiveSubTab("performance")}
              className="px-3.5 py-1.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition-all cursor-pointer"
              style={{
                background: activeSubTab === "performance" ? colors.blue : "transparent",
                color: activeSubTab === "performance" ? (colors.onBlue || "#FFFFFF") : colors.textMuted,
                boxShadow: activeSubTab === "performance" ? "0 2px 8px rgba(0,0,0,0.15)" : "none",
              }}
            >
              <UserRound size={13} /> Performa Sales
            </button>
            <button
              onClick={() => setActiveSubTab("commission")}
              className="px-3.5 py-1.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition-all cursor-pointer"
              style={{
                background: activeSubTab === "commission" ? colors.blue : "transparent",
                color: activeSubTab === "commission" ? (colors.onBlue || "#FFFFFF") : colors.textMuted,
                boxShadow: activeSubTab === "commission" ? "0 2px 8px rgba(0,0,0,0.15)" : "none",
              }}
            >
              <Coins size={13} /> Kalkulator Insentif
            </button>
          </div>
        </div>
      )}

      {activeSubTab === "commission" && !slideshowMode ? (
        <SalesCommissionView rows={rows} filteredRows={agg.filteredRows} colors={colors} depotName={depotName} />
      ) : (
        <>
          <Leaderboard rows={rows} colors={colors} onDrilldown={onDrilldown} onExportScorecard={handleExportScorecard} />

          <div className="sm-card p-5 mb-6">
            <div className="flex items-center justify-between flex-wrap gap-3 mb-0">
              <SectionTitle title="Performa per Sales" sub="Pilih Sales pada filter di atas untuk melihat detail" icon={UserRound} colors={colors} accent={colors.mint} />
            </div>
            <ResponsiveContainer width="100%" height={Math.max(220, rows.length * 46)}>
              <BarChart data={rows} layout="vertical" margin={{ left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={colors.chartGrid} horizontal={false} />
                <XAxis type="number" tick={{ fill: colors.textMuted, fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={fmtCompactNum} />
                <YAxis type="category" dataKey="name" width={160} tick={{ fill: colors.text, fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip content={<AchBarChartTooltip colors={colors} />} cursor={{ fill: colors.glassSubtle }} />
                <Bar dataKey="realisasiValue" radius={[0, 6, 6, 0]}>
                  {rows.map((r, i) => <Cell key={i} fill={getAchColor(r.ach, colors)} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Detail per Sales × Grup — di-hide di mode slideshow */}
          {!slideshowMode && (
          <div className="mt-8">
            <SectionTitle title="Detail per Sales × Grup Produk" icon={Boxes} colors={colors} />
            <DataTable
              colors={colors}
              rowKey={(r) => `${r.salesName}|${r.groupName}`}
              initialSortKey="value"
              searchable
              searchKeys={["salesName", "groupName"]}
              searchPlaceholder="Cari nama sales atau grup produk..."
              columns={[
                { key: "salesName", label: "Sales" },
                { key: "groupName", label: "Grup Produk" },
                { key: "targetValue", label: "Target", render: (r) => <span className="mono">{fmtRp(r.targetValue)}</span> },
                { key: "value", label: "Realisasi", render: (r) => <span className="mono">{fmtRp(r.value)}</span> },
                { key: "ach", label: "ACH%", render: (r) => <AchBadge ach={r.ach} colors={colors} /> },
                { key: "deviasiShow", label: "Deviasi", render: (r) => {
                  // ⚠️ Konvensi kolom ini: positif = target TERCAPAI (Realisasi - Target).
                  // (Berbeda dari aggregation.js yang pakai Target - Realisasi = sisa target.)
                  const d = r.deviasiShow;
                  const color = d > 0 ? colors.mint : d < 0 ? colors.coral : colors.textMuted;
                  return <span className="mono" style={{ color }}>{d > 0 ? "+" : ""}{fmtRp(d)}</span>;
                } },
                // AO = realisasi outlet unik / target AO PER GRUP PER SALES (settings: t.groups[].ao).
                // Bukan target AO global (t.total.ao). Grup tanpa target AO (0) tampil "—"
                // supaya tidak terbaca sebagai target nol yang bermakna.
                { key: "ao", label: "AO", render: (r) => (
                  <span className="mono">
                    {fmtNum(r.ao)} / {r.targetAo > 0 ? fmtNum(r.targetAo) : <span style={{ color: colors.textMuted }}>—</span>}
                  </span>
                ) },
                { key: "_drilldown", label: "", render: (r) => onDrilldown && <DrilldownButton colors={colors} onClick={() => onDrilldown(`${r.salesName} — ${r.groupName}`, "Outlet", r.predicate)} /> },
              ]}
              rows={groupRows}
            />
          </div>
          )}

          {/* Total Periode vs Hari Terakhir — di-hide di mode slideshow */}
          {!slideshowMode && (
          <div className="mt-8 mb-8">
            <SectionTitle
              title="Total Periode vs Hari Terakhir"
              sub="Pencapaian & AO total dibandingkan hari terakhir per sales"
              icon={CalendarClock}
              colors={colors}
            />
            <DataTable
              colors={colors}
              rowKey="code"
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
                { key: "lastDayValue", label: `Realisasi (${lastDateLabel})`, render: (r) => <span className="mono">{fmtRp(r.lastDayValue)}</span> },
                { key: "lastDayAo", label: `AO (${lastDateLabel})`, render: (r) => <span className="mono">{fmtNum(r.lastDayAo)}</span> },
                { key: "_drilldown", label: "", render: (r) => onDrilldown && <DrilldownButton colors={colors} onClick={() => onDrilldown(`${r.salesName} — ${lastDateLabel}`, "Outlet (hari terakhir)", r.predicateLastDay)} /> },
              ]}
              rows={totalVsLastDayRows}
            />
          </div>
          )}
        </>
      )}
    </div>
  );
}
