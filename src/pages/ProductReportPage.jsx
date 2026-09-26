import { useState, useMemo } from "react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell,
} from "recharts";
import { Boxes, Package, Tag, Store, Hash, TrendingUp, X, Sparkles, AlertTriangle, Award } from "lucide-react";
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
  // ── Ringkasan Kinerja Produk (Header KPI) ──────────────────────────────────
  const totalVolume = useMemo(() => {
    return skuList.reduce((s, p) => s + (p.qty || 0), 0);
  }, [skuList]);

  const championGroup = useMemo(() => {
    if (!agg.byGroup || agg.byGroup.length === 0) return null;
    const sorted = [...agg.byGroup].sort((a, b) => (b.ach || 0) - (a.ach || 0));
    return sorted[0];
  }, [agg.byGroup]);

  const heroSku = useMemo(() => {
    return skuList[0] || null;
  }, [skuList]);

  const overallAvgPenetration = useMemo(() => {
    if (!skuList.length) return 0;
    return (skuList.reduce((s, p) => s + p.penetrationPct, 0) / skuList.length).toFixed(1);
  }, [skuList]);

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

  // ── Top 5 Bintang vs Top 5 Slow-Moving (Opsi A: Nilai Omset) ───────────────
  const topStarSkus = useMemo(() => {
    return [...filteredSkuList]
      .sort((a, b) => (b.value || 0) - (a.value || 0))
      .slice(0, 5);
  }, [filteredSkuList]);

  const bottomSlowSkus = useMemo(() => {
    const starCodes = new Set(topStarSkus.map((s) => s.productCode));
    const sortedAsc = [...filteredSkuList].sort((a, b) => (a.value || 0) - (b.value || 0));
    const available = sortedAsc.filter((s) => !starCodes.has(s.productCode));
    return available.slice(0, 5);
  }, [filteredSkuList, topStarSkus]);

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
                color: activeSubTab === "group" ? (colors.onBlue || "#FFFFFF") : colors.textMuted,
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
                color: activeSubTab === "sku" ? (colors.onBlue || "#FFFFFF") : colors.textMuted,
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
          {/* ── KPI Cards Ringkasan Kinerja Produk (Di Bagian Atas) ─────── */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5 mb-6">
            <KpiCard
              label="Total Volume"
              value={Math.round(totalVolume)}
              sub={`Karton/satuan · ${fmtNum(skuList.length)} SKU`}
              icon={Package}
              accent={colors.blue}
              colors={colors}
            />
            <KpiCard
              label="Grup Terbaik"
              value={championGroup ? championGroup.name : "-"}
              sub={championGroup ? `${championGroup.ach}% ACH · ${fmtCompactNum(championGroup.realisasiValue)}` : "-"}
              icon={Award}
              accent={colors.mint || colors.green}
              colors={colors}
            />
            <KpiCard
              label="Hero SKU"
              value={heroSku ? heroSku.productName : "-"}
              sub={heroSku ? `${fmtCompactNum(heroSku.value)} · ${heroSku.contributionPct}% omset` : "-"}
              icon={Boxes}
              accent={colors.violet || colors.accent}
              colors={colors}
            />
            <KpiCard
              label="Rata Penetrasi"
              value={Number(overallAvgPenetration) / 100}
              isPct={true}
              sub={`vs ${fmtNum(totalActiveOutlets)} total AO`}
              icon={Store}
              accent={colors.gold}
              colors={colors}
            />
          </div>

          <div className="sm-card p-5 mb-6">
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
          </div>

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

          {/* ── Sorotan Top 5 Bintang vs Slow-Moving (Opsi A) ─────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
            {/* Card 1: Top 5 Bintang */}
            <div
              className="sm-card p-4 rounded-xl flex flex-col justify-between"
              style={{
                background: colors.cardBg,
                border: `1px solid ${colors.border}`,
                boxShadow: "0 4px 20px rgba(0,0,0,0.06)",
              }}
            >
              <div>
                <div className="flex items-center justify-between pb-3 mb-3 border-b" style={{ borderColor: colors.border }}>
                  <div className="flex items-center gap-2">
                    <div
                      className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                      style={{ background: (colors.gold || "#FBBF24") + "20", color: colors.gold || "#FBBF24" }}
                    >
                      <Sparkles size={16} />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider" style={{ color: colors.text }}>
                        Top 5 Bintang (Hero SKUs)
                      </h4>
                      <p className="text-[11px]" style={{ color: colors.textMuted }}>
                        Penyumbang omset terbesar di periode terpilih
                      </p>
                    </div>
                  </div>
                  <span
                    className="text-[10px] font-bold px-2 py-0.5 rounded-full mono shrink-0"
                    style={{
                      background: (colors.gold || "#FBBF24") + "18",
                      color: colors.gold || "#FBBF24",
                      border: `1px solid ${(colors.gold || "#FBBF24")}33`,
                    }}
                  >
                    FAST-MOVING
                  </span>
                </div>

                {topStarSkus.length === 0 ? (
                  <div className="py-8 text-center text-xs" style={{ color: colors.textMuted }}>
                    Tidak ada SKU aktif.
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    {topStarSkus.map((p, idx) => (
                      <div
                        key={p.productCode || idx}
                        className="flex items-center justify-between p-2.5 rounded-lg transition-all"
                        style={{ background: colors.glassFill || "rgba(255,255,255,0.02)", border: `1px solid ${colors.border}44` }}
                      >
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          <span
                            className="w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-bold shrink-0 mono"
                            style={{
                              background: idx === 0 ? (colors.gold || "#FBBF24") : idx === 1 ? (colors.mint || "#34D399") : colors.glassBorder,
                              color: idx <= 1 ? "#000000" : colors.text,
                            }}
                          >
                            #{idx + 1}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-semibold text-xs truncate max-w-[200px]" style={{ color: colors.text }} title={p.productName}>
                                {p.productName}
                              </span>
                              <span style={getGroupBadgeStyle(p.group)}>{p.group || "-"}</span>
                            </div>
                            <div className="flex items-center gap-2 text-[10px] mono mt-0.5" style={{ color: colors.textMuted }}>
                              <span>{fmtNum(p.outletCount)} toko ({p.penetrationPct}%)</span>
                              <span>·</span>
                              <span>{fmtNum(Math.round(p.qty))} {p.unit || ""}</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0 pl-2">
                          <div className="text-right">
                            <div className="mono text-xs font-semibold" style={{ color: colors.text }}>
                              {fmtRp(p.value)}
                            </div>
                            <div className="text-[10px] mono font-medium" style={{ color: colors.mint || colors.green || "#34D399" }}>
                              {p.contributionPct}% omset
                            </div>
                          </div>
                          {onDrilldown && (
                            <DrilldownButton
                              colors={colors}
                              onClick={() =>
                                onDrilldown(
                                  p.productName,
                                  "Outlet",
                                  (row) => row.productCode === p.productCode || row.productName === p.productName
                                )
                              }
                            />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Card 2: Top 5 Slow-Moving */}
            <div
              className="sm-card p-4 rounded-xl flex flex-col justify-between"
              style={{
                background: colors.cardBg,
                border: `1px solid ${colors.border}`,
                boxShadow: "0 4px 20px rgba(0,0,0,0.06)",
              }}
            >
              <div>
                <div className="flex items-center justify-between pb-3 mb-3 border-b" style={{ borderColor: colors.border }}>
                  <div className="flex items-center gap-2">
                    <div
                      className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                      style={{ background: (colors.coral || "#F87171") + "20", color: colors.coral || "#F87171" }}
                    >
                      <AlertTriangle size={16} />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider" style={{ color: colors.text }}>
                        Top 5 Butuh Perhatian (Slow-Moving)
                      </h4>
                      <p className="text-[11px]" style={{ color: colors.textMuted }}>
                        Omset terendah, perlu program dorongan promo
                      </p>
                    </div>
                  </div>
                  <span
                    className="text-[10px] font-bold px-2 py-0.5 rounded-full mono shrink-0"
                    style={{
                      background: (colors.coral || "#F87171") + "18",
                      color: colors.coral || "#F87171",
                      border: `1px solid ${(colors.coral || "#F87171")}33`,
                    }}
                  >
                    SLOW-MOVING
                  </span>
                </div>

                {bottomSlowSkus.length === 0 ? (
                  <div className="py-8 text-center text-xs" style={{ color: colors.textMuted }}>
                    Semua SKU masuk dalam kategori Bintang (≤ 5 produk aktif).
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    {bottomSlowSkus.map((p, idx) => (
                      <div
                        key={p.productCode || idx}
                        className="flex items-center justify-between p-2.5 rounded-lg transition-all"
                        style={{ background: colors.glassFill || "rgba(255,255,255,0.02)", border: `1px solid ${colors.border}44` }}
                      >
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          <span
                            className="w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-bold shrink-0 mono"
                            style={{
                              background: (colors.coral || "#F87171") + "22",
                              color: colors.coral || "#F87171",
                            }}
                          >
                            #{idx + 1}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-semibold text-xs truncate max-w-[200px]" style={{ color: colors.text }} title={p.productName}>
                                {p.productName}
                              </span>
                              <span style={getGroupBadgeStyle(p.group)}>{p.group || "-"}</span>
                            </div>
                            <div className="flex items-center gap-2 text-[10px] mono mt-0.5" style={{ color: colors.textMuted }}>
                              <span>{fmtNum(p.outletCount)} toko ({p.penetrationPct}%)</span>
                              <span>·</span>
                              <span>{fmtNum(Math.round(p.qty))} {p.unit || ""}</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0 pl-2">
                          <div className="text-right">
                            <div className="mono text-xs font-semibold" style={{ color: colors.text }}>
                              {fmtRp(p.value)}
                            </div>
                            <div className="text-[10px] mono font-medium" style={{ color: colors.coral || "#F87171" }}>
                              {p.contributionPct}% omset
                            </div>
                          </div>
                          {onDrilldown && (
                            <DrilldownButton
                              colors={colors}
                              onClick={() =>
                                onDrilldown(
                                  p.productName,
                                  "Outlet",
                                  (row) => row.productCode === p.productCode || row.productName === p.productName
                                )
                              }
                            />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
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
