import { useState, useMemo } from "react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell,
} from "recharts";
import { Boxes, Package, Tag, Store, Hash, TrendingUp, X } from "lucide-react";
import { fmtRp, fmtNum, fmtCompactNum, formatDateIDShort } from "../utils/formatters.js";
import { AchBadge } from "../components/AchBadge.jsx";
import { getAchColor } from "../constants/thresholds.js";
import { DataTable } from "../components/ui/DataTable.jsx";
import { SectionTitle, DrilldownButton, AchBarChartTooltip } from "../components/ui/index.jsx";
import { KpiCard } from "../components/KpiCard.jsx";
import { CustomSelect } from "../components/ui/CustomSelect.jsx";
import { getProductBreakdownForGroup } from "../utils/aggregation.js";

/* ============================================================================
   TAB: PRODUCT REPORT
   Sub-tab: [ 📦 Grup Produk | 🏷️ Analisis SKU Lengkap ]
============================================================================ */
export function ProductReportPage({ agg, colors, onDrilldown, onGroupDrilldown, slideshowMode = false }) {
  const [activeSubTab, setActiveSubTab] = useState("group"); // "group" | "sku"
  const [selectedGroupFilter, setSelectedGroupFilter] = useState("all");

  // ── Agregasi SKU ───────────────────────────────────────────────────────────
  const totalActiveOutlets = useMemo(() => {
    if (agg.byOutlet && agg.byOutlet.length > 0) return agg.byOutlet.length;
    const outletSet = new Set((agg.filteredRows || []).map((r) => r.outletCode || r.outletName).filter(Boolean));
    return outletSet.size || 1;
  }, [agg.byOutlet, agg.filteredRows]);

  const totalPeriodValue = useMemo(
    () => agg.totals?.realisasiValue || agg.byGroup.reduce((s, g) => s + (g.realisasiValue || 0), 0) || 1,
    [agg.totals, agg.byGroup]
  );

  const skuList = useMemo(() => {
    // getProductBreakdownForGroup dengan predicate=null → ambil semua baris
    const raw = getProductBreakdownForGroup(agg.filteredRows, null);
    return raw.map((p) => ({
      ...p,
      penetrationPct:
        totalActiveOutlets > 0
          ? Number(((p.outletCount / totalActiveOutlets) * 100).toFixed(1))
          : 0,
      contributionPct:
        totalPeriodValue > 0
          ? Number(((p.value / totalPeriodValue) * 100).toFixed(1))
          : 0,
    }));
  }, [agg.filteredRows, totalActiveOutlets, totalPeriodValue]);

  const availableGroups = useMemo(
    () => [...new Set(skuList.map((p) => p.group))].filter(Boolean).sort(),
    [skuList]
  );

  const groupSelectOptions = useMemo(() => [
    { value: "all", label: `Semua Grup (${availableGroups.length})` },
    ...availableGroups.map((g) => ({ value: g, label: g })),
  ], [availableGroups]);

  const filteredSkuList = useMemo(() => {
    if (selectedGroupFilter === "all") return skuList;
    return skuList.filter((p) => p.group === selectedGroupFilter);
  }, [skuList, selectedGroupFilter]);

  // ── Mini KPI (SKU tab) ─────────────────────────────────────────────────────
  const skuKpis = useMemo(() => {
    const list = filteredSkuList;
    return {
      total: list.length,
      totalValue: list.reduce((s, p) => s + p.value, 0),
      avgPenetration:
        list.length > 0
          ? (list.reduce((s, p) => s + p.penetrationPct, 0) / list.length).toFixed(1)
          : 0,
      topSku: list[0]?.productName || "-",
    };
  }, [filteredSkuList]);

  // ── Theme-aware Group Badge ────────────────────────────────────────────────
  const getGroupBadgeStyle = (group) => {
    const palette = [
      colors.blue || "#60A5FA",
      colors.mint || "#34D399",
      colors.gold || "#FBBF24",
      colors.violet || "#A78BFA",
      colors.cyan || "#38BDF8",
      colors.coral || "#F87171",
    ];
    const hash = (group || "").split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
    const color = palette[Math.abs(hash) % palette.length];
    return {
      display: "inline-flex",
      alignItems: "center",
      padding: "2px 8px",
      borderRadius: 8,
      fontSize: 11,
      fontWeight: 600,
      background: color + "1A",
      border: `1px solid ${color}44`,
      color,
      whiteSpace: "nowrap",
    };
  };

  return (
    <div className="sm-page-enter">
      {/* ── Sub-tab Switcher ──────────────────────────────────────────────── */}
      {!slideshowMode && (
        <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
          <div
            className="inline-flex p-1 rounded-xl"
            style={{ background: colors.glassFill, border: `1px solid ${colors.glassBorder}` }}
          >
            <button
              onClick={() => setActiveSubTab("group")}
              className="px-3.5 py-1.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition-all cursor-pointer"
              style={{
                background: activeSubTab === "group" ? (colors.accent || colors.blue) : "transparent",
                color: activeSubTab === "group" ? "#FFFFFF" : colors.textMuted,
                boxShadow: activeSubTab === "group" ? "0 2px 8px rgba(0,0,0,0.15)" : "none",
              }}
            >
              <Boxes size={13} /> Grup Produk
            </button>
            <button
              onClick={() => setActiveSubTab("sku")}
              className="px-3.5 py-1.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition-all cursor-pointer"
              style={{
                background: activeSubTab === "sku" ? (colors.accent || colors.blue) : "transparent",
                color: activeSubTab === "sku" ? "#FFFFFF" : colors.textMuted,
                boxShadow: activeSubTab === "sku" ? "0 2px 8px rgba(0,0,0,0.15)" : "none",
              }}
            >
              <Tag size={13} /> Analisis SKU Lengkap
            </button>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          TAB: GRUP PRODUK (konten default/asli)
      ══════════════════════════════════════════════════════════════════════ */}
      {activeSubTab === "group" && (
        <>
          <SectionTitle title="Pencapaian per Grup Produk" sub="Ranking berdasarkan realisasi" icon={Boxes} colors={colors} accent={colors.mint} />
          <ResponsiveContainer width="100%" height={Math.max(240, agg.byGroup.length * 42)}>
            <BarChart data={agg.byGroup} layout="vertical" margin={{ left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={colors.chartGrid} horizontal={false} />
              <XAxis type="number" tick={{ fill: colors.textMuted, fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={fmtCompactNum} />
              <YAxis type="category" dataKey="name" width={170} tick={{ fill: colors.text, fontSize: 12 }} axisLine={false} tickLine={false} />
              <Tooltip content={<AchBarChartTooltip colors={colors} />} cursor={{ fill: colors.glassSubtle }} />
              <Bar dataKey="realisasiValue" radius={[0, 6, 6, 0]}>
                {agg.byGroup.map((r, i) => <Cell key={i} fill={getAchColor(r.ach, colors)} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>

          {/* Detail Grup Produk — di-hide di mode slideshow */}
          {!slideshowMode && (
            <div className="mt-8">
              <SectionTitle title="Detail Grup Produk" icon={Package} colors={colors} />
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
                  )},
                  { key: "_drilldown", label: "", render: (r) => onDrilldown && <DrilldownButton colors={colors} onClick={() => onDrilldown(r.name, "Outlet", r.predicate)} /> },
                ]}
                rows={agg.byGroup}
              />
            </div>
          )}
        </>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          TAB: ANALISIS SKU LENGKAP
      ══════════════════════════════════════════════════════════════════════ */}
      {activeSubTab === "sku" && !slideshowMode && (
        <div>
          <SectionTitle
            title="Analisis SKU Lengkap"
            sub={`${skuList.length} produk aktif · seluruh transaksi periode terpilih`}
            icon={Tag}
            colors={colors}
            accent={colors.mint || colors.accent}
          />

          {/* ── KPI Cards (Menggunakan KpiCard global) ────────────────── */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5 mb-6">
            <KpiCard
              label="Total SKU"
              value={skuKpis.total}
              sub="Produk aktif"
              icon={Hash}
              accent={colors.blue}
              colors={colors}
            />
            <KpiCard
              label="Total Nilai"
              value={skuKpis.totalValue}
              isMoney={true}
              sub="Omset terpilih"
              icon={TrendingUp}
              accent={colors.mint || colors.green}
              colors={colors}
            />
            <KpiCard
              label="Rata Penetrasi"
              value={Number(skuKpis.avgPenetration) / 100}
              isPct={true}
              sub={`vs ${fmtNum(totalActiveOutlets)} total AO`}
              icon={Store}
              accent={colors.gold}
              colors={colors}
            />
            <KpiCard
              label="Produk Teratas"
              value={skuKpis.topSku}
              sub={filteredSkuList[0] ? `${fmtCompactNum(filteredSkuList[0].value)} · ${filteredSkuList[0].contributionPct}% omset` : "-"}
              icon={Boxes}
              accent={colors.violet || colors.accent}
              colors={colors}
            />
          </div>

          {/* ── Toolbar Filter Grup (Menggunakan CustomSelect global) ──── */}
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: colors.textMuted }}>
                Filter Grup:
              </span>
              <CustomSelect
                value={selectedGroupFilter}
                onChange={setSelectedGroupFilter}
                options={groupSelectOptions}
                icon={Package}
                placeholder="Pilih Grup..."
                colors={colors}
                size="sm"
                searchable={availableGroups.length >= 7}
                searchPlaceholder="Cari grup produk..."
                menuWidth={240}
              />
              {selectedGroupFilter !== "all" && (
                <button
                  type="button"
                  onClick={() => setSelectedGroupFilter("all")}
                  className="sm-btn px-2.5 py-1.5 rounded-lg text-xs font-medium inline-flex items-center gap-1 cursor-pointer"
                  style={{ color: colors.coral, background: colors.coral + "14", border: `1px solid ${colors.coral}33` }}
                >
                  <X size={12} /> Reset Grup
                </button>
              )}
            </div>

            <div className="text-xs font-medium" style={{ color: colors.textMuted }}>
              Menampilkan <b style={{ color: colors.text }}>{filteredSkuList.length}</b> dari {skuList.length} SKU
            </div>
          </div>

          {/* ── DataTable SKU (Search bawaan DataTable) ────────────────── */}
          <DataTable
            key="sku-analysis-table"
            rowKey="productCode"
            colors={colors}
            initialSortKey="value"
            searchable
            searchKeys={["productName", "productCode", "group", "salesLabel"]}
            searchPlaceholder="Cari nama, kode produk, grup, atau sales..."
            pageSize={25}
            columns={[
              {
                key: "productName",
                label: "Produk",
                render: (r) => (
                  <div>
                    <div className="font-semibold text-xs" style={{ color: colors.text }}>{r.productName}</div>
                    <div className="text-[11px] mono" style={{ color: colors.textMuted }}>{r.productCode}</div>
                  </div>
                ),
              },
              {
                key: "group",
                label: "Grup",
                render: (r) => <span style={getGroupBadgeStyle(r.group)}>{r.group || "-"}</span>,
              },
              {
                key: "qty",
                label: "Volume",
                render: (r) => (
                  <span className="mono text-xs">
                    {fmtNum(Math.round(r.qty))} {r.unit || ""}
                  </span>
                ),
              },
              {
                key: "value",
                label: "Nilai & Kontribusi",
                render: (r) => (
                  <div>
                    <div className="mono text-xs font-medium">{fmtRp(r.value)}</div>
                    <div className="text-[11px]" style={{ color: colors.textMuted }}>{r.contributionPct}% omset</div>
                  </div>
                ),
              },
              {
                key: "outletCount",
                label: "Penetrasi Toko",
                render: (r) => (
                  <div className="min-w-[130px]">
                    <div className="font-semibold text-xs" style={{ color: colors.text }}>
                      {fmtNum(r.outletCount)} toko
                    </div>
                    {/* Progress bar penetrasi */}
                    <div className="flex items-center gap-1.5 mt-1">
                      <div
                        className="flex-1 h-1.5 rounded-full overflow-hidden"
                        style={{ background: colors.border }}
                      >
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${Math.min(100, r.penetrationPct)}%`,
                            background:
                              r.penetrationPct >= 70
                                ? (colors.mint || colors.green || "#22c55e")
                                : r.penetrationPct >= 40
                                ? (colors.gold || "#f59e0b")
                                : (colors.coral || "#ef4444"),
                          }}
                        />
                      </div>
                      <span className="text-[10px] mono" style={{ color: colors.textMuted }}>
                        {r.penetrationPct}%
                      </span>
                    </div>
                  </div>
                ),
              },
              {
                key: "invoiceCount",
                label: "Frekuensi",
                render: (r) => (
                  <span className="mono text-xs" style={{ color: colors.textMuted }}>
                    {fmtNum(r.invoiceCount)}×
                  </span>
                ),
              },
              {
                key: "salesLabel",
                label: "Sales",
                render: (r) => (
                  <span className="text-xs truncate block max-w-[180px]" style={{ color: colors.textMuted }} title={r.salesLabel}>
                    {r.salesLabel || "-"}
                  </span>
                ),
              },
              {
                key: "lastDate",
                label: "Transaksi Terakhir",
                render: (r) => (
                  <span className="text-xs" style={{ color: colors.textMuted }}>{formatDateIDShort(r.lastDate)}</span>
                ),
              },
              {
                key: "_drilldown",
                label: "",
                render: (r) =>
                  onDrilldown && (
                    <DrilldownButton
                      colors={colors}
                      onClick={() =>
                        onDrilldown(
                          r.productName,
                          "Outlet",
                          (row) =>
                            row.productCode === r.productCode ||
                            row.productName === r.productName
                        )
                      }
                    />
                  ),
              },
            ]}
            rows={filteredSkuList}
          />
        </div>
      )}
    </div>
  );
}
