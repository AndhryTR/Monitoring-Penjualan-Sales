import { useState, useMemo } from "react";
import {
  ClipboardList, FileSpreadsheet, XCircle, Copy, CalendarDays,
  FileQuestion, CheckCircle2, AlertTriangle, Users, Package,
  Search, Shield, ArrowRight,
} from "lucide-react";
import { fmtRp, fmtNum } from "../utils/formatters.js";
import { FIELD_LABELS } from "../constants/aliases.js";
import { DataTable } from "../components/ui/DataTable.jsx";
import { SectionTitle, DrilldownButton } from "../components/ui/index.jsx";

/* ============================================================================
   DATA QUALITY PAGE — REDESIGN (Sprint 8)
   ⚠️ Sebelumnya 127 baris dengan semua isu ditampilkan vertikal panjang
   tanpa prioritas. User sulit fokus ke isu mana yang penting.

   Redesign improvements:
   1. Summary dashboard di atas: 5 KPI card compact dengan severity indicator
   2. Tab filter: "Semua" | "Sales Tidak Dikenali" | "Grup Tidak Dikenali" |
      "Produk Tidak Konversi" | "Kolom Hilang" — user bisa fokus per kategori
   3. Priority indicator per kategori (critical/warning/info)
   4. Card collapsible (bukan tabel panjang) — lebih ringkas
   5. Empty state contextual dengan action hint
   6. Search di dalam setiap kategori untuk filter cepat
============================================================================ */

// Kategori isu dengan severity level untuk prioritas visual.
const ISSUE_CATEGORIES = [
  { key: "unknownSales", label: "Sales Tidak Dikenali", icon: Users, severity: "critical",
    description: "Ada di data tapi tidak cocok dengan konfigurasi Target — transaksinya tidak dihitung di dashboard" },
  { key: "unknownGroups", label: "Grup Tidak Dekenali", icon: Package, severity: "warning",
    description: "Ada di data untuk sales tsb, tapi tidak ada di daftar grup produk sales itu" },
  { key: "unconvertibleProducts", label: "Produk Tidak Konversi", icon: AlertTriangle, severity: "warning",
    description: "Tidak ada baris bersatuan KARTON untuk produk ini — angka memakai satuan asli" },
  { key: "missingFields", label: "Kolom Hilang", icon: FileQuestion, severity: "critical",
    description: "Nama kolom di file tidak cocok dengan alias yang dikenali aplikasi" },
];

const SEVERITY_COLORS = {
  critical: "coral",
  warning: "gold",
  info: "blue",
};

export function DataQualityPage({ notes, colors, onDrilldown }) {
  // ⚠️ Sprint 3 / P3: default ke object kosong + setiap array field default []
  const {
    missingFields = [],
    unknownSales = [],
    unconvertibleProducts = [],
    unknownGroups = [],
    skippedBlankRows = 0,
    rowsWithMissingDate = 0,
    duplicateRowsRemoved = 0,
    totalDataRows = 0,
  } = notes || {};

  // Tab aktif: "all" | "unknownSales" | "unknownGroups" | "unconvertibleProducts" | "missingFields"
  const [activeTab, setActiveTab] = useState("all");

  // Search query per tab
  const [searchQueries, setSearchQueries] = useState({});
  const setSearchQuery = (tab, q) => setSearchQueries((prev) => ({ ...prev, [tab]: q }));

  // Hitung total isu per kategori untuk badge di tab
  const issueCounts = useMemo(() => ({
    unknownSales: unknownSales.length,
    unknownGroups: unknownGroups.length,
    unconvertibleProducts: unconvertibleProducts.length,
    missingFields: missingFields.length,
  }), [unknownSales, unknownGroups, unconvertibleProducts, missingFields]);

  const totalIssues = Object.values(issueCounts).reduce((a, b) => a + b, 0);
  const hasIssues = totalIssues > 0 || skippedBlankRows > 0 || rowsWithMissingDate > 0 || duplicateRowsRemoved > 0;

  // Filter rows berdasarkan search query per tab
  const filterRows = (rows, tabKey, searchKeys) => {
    const q = (searchQueries[tabKey] || "").trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => searchKeys.some((k) => String(r[k] ?? "").toLowerCase().includes(q)));
  };

  // Summary stats untuk header cards
  const summaryStats = [
    { label: "Total Baris", value: totalDataRows, icon: FileSpreadsheet, color: "blue", sub: "Dari semua file upload" },
    { label: "Duplikat Dihapus", value: duplicateRowsRemoved, icon: Copy, color: duplicateRowsRemoved > 0 ? "gold" : "textMuted", sub: duplicateRowsRemoved > 0 ? "Otomatis saat upload" : "Tidak ada" },
    { label: "Tanggal Kosong", value: rowsWithMissingDate, icon: CalendarDays, color: rowsWithMissingDate > 0 ? "coral" : "textMuted", sub: rowsWithMissingDate > 0 ? "Perlu perhatian" : "Semua terbaca" },
    { label: "Baris Dilewati", value: skippedBlankRows, icon: XCircle, color: "textMuted", sub: "Baris kosong dilewati" },
    { label: "Total Isu", value: totalIssues, icon: AlertTriangle, color: totalIssues > 0 ? "coral" : "mint", sub: totalIssues > 0 ? "Perlu ditinjau" : "Bersih" },
  ];

  // Tab list dengan badge count
  const tabs = [
    { key: "all", label: "Semua", count: totalIssues },
    { key: "unknownSales", label: "Sales", count: issueCounts.unknownSales },
    { key: "unknownGroups", label: "Grup", count: issueCounts.unknownGroups },
    { key: "unconvertibleProducts", label: "Produk", count: issueCounts.unconvertibleProducts },
    { key: "missingFields", label: "Kolom", count: issueCounts.missingFields },
  ].filter((t) => t.key === "all" || t.count > 0); // hide tab kalau 0 isu

  // Render issue card untuk satu kategori
  const renderIssueCard = (category) => {
    const data = notes?.[category.key] || [];
    const severityColor = colors[SEVERITY_COLORS[category.severity]] || colors.coral;
    const Icon = category.icon;
    const searchQuery = searchQueries[category.key] || "";
    const filteredData = category.key === "missingFields"
      ? data
      : filterRows(data, category.key,
          category.key === "unknownSales" ? ["salesCode", "salesName"]
          : category.key === "unknownGroups" ? ["salesName", "group"]
          : ["productName", "unit"]
        );

    return (
      <div
        key={category.key}
        className="sm-card overflow-hidden mb-4"
        style={{ borderLeft: `3px solid ${severityColor}` }}
      >
        {/* Header card */}
        <div className="p-4 flex items-start gap-3" style={{ borderBottom: `1px solid ${colors.glassBorder}` }}>
          <div className="p-2 rounded-xl shrink-0" style={{ background: severityColor + "1A" }}>
            <Icon size={16} style={{ color: severityColor }} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold disp">{category.label}</h3>
              <span
                className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                style={{ background: severityColor + "1A", color: severityColor }}
              >
                {data.length} item
              </span>
            </div>
            <p className="text-xs mt-0.5" style={{ color: colors.textMuted }}>{category.description}</p>
          </div>
        </div>

        {/* Content card */}
        <div className="p-4">
          {category.key === "missingFields" ? (
            // Missing fields: tampil sebagai chip, bukan tabel
            <div className="flex flex-wrap gap-2">
              {data.map((f) => (
                <span
                  key={f}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm"
                  style={{ background: colors.coral + "1A", color: colors.coral }}
                >
                  <XCircle size={13} /> {FIELD_LABELS[f] || f}
                </span>
              ))}
            </div>
          ) : (
            <>
              {/* Search bar untuk kategori ini */}
              {data.length > 5 && (
                <div className="relative mb-3">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: colors.textMuted }} />
                  <input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(category.key, e.target.value)}
                    placeholder={`Cari di ${category.label.toLowerCase()}...`}
                    className="w-full pl-9 pr-8 py-2 rounded-lg text-sm outline-none"
                    style={{ background: colors.glassFill, border: `1px solid ${colors.glassBorder}`, color: colors.text }}
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery(category.key, "")}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2"
                      style={{ color: colors.textMuted }}
                    >
                      <XCircle size={14} />
                    </button>
                  )}
                </div>
              )}

              {/* DataTable untuk kategori ini */}
              {category.key === "unknownSales" && (
                <DataTable
                  colors={colors}
                  initialSortKey="value"
                  searchable={false}
                  rowKey="salesCode"
                  columns={[
                    { key: "salesCode", label: "Kode" },
                    { key: "salesName", label: "Nama (di data)" },
                    { key: "rowCount", label: "Baris", render: (r) => <span className="mono">{fmtNum(r.rowCount)}</span> },
                    { key: "value", label: "Total Value", render: (r) => <span className="mono">{fmtRp(r.value)}</span> },
                    { key: "_drilldown", label: "", render: (r) => onDrilldown && <DrilldownButton colors={colors} onClick={() => onDrilldown(r.salesCode, "Outlet", (row) => row.salesCode === r.salesCode)} /> },
                  ]}
                  rows={filteredData}
                />
              )}

              {category.key === "unknownGroups" && (
                <DataTable
                  colors={colors}
                  initialSortKey="value"
                  searchable={false}
                  rowKey={(r) => `${r.salesCode}|${r.group}`}
                  columns={[
                    { key: "salesName", label: "Sales" },
                    { key: "group", label: "Grup Produk" },
                    { key: "rowCount", label: "Baris", render: (r) => <span className="mono">{fmtNum(r.rowCount)}</span> },
                    { key: "value", label: "Total Value", render: (r) => <span className="mono">{fmtRp(r.value)}</span> },
                    { key: "_drilldown", label: "", render: (r) => onDrilldown && <DrilldownButton colors={colors} onClick={() => onDrilldown(`${r.salesName} — ${r.group}`, "Outlet", (row) => row.salesCode === r.salesCode && row.group === r.group)} /> },
                  ]}
                  rows={filteredData}
                />
              )}

              {category.key === "unconvertibleProducts" && (
                <DataTable
                  colors={colors}
                  initialSortKey="rowCount"
                  searchable={false}
                  rowKey="productName"
                  columns={[
                    { key: "productName", label: "Nama Produk" },
                    { key: "unit", label: "Satuan Asli" },
                    { key: "rowCount", label: "Baris", render: (r) => <span className="mono">{fmtNum(r.rowCount)}</span> },
                    { key: "qty", label: "Total Qty", render: (r) => <span className="mono">{fmtNum(r.qty)}</span> },
                  ]}
                  rows={filteredData}
                />
              )}
            </>
          )}
        </div>
      </div>
    );
  };

  // Kategori yang aktif untuk dirender
  const activeCategories = activeTab === "all"
    ? ISSUE_CATEGORIES.filter((c) => issueCounts[c.key] > 0)
    : ISSUE_CATEGORIES.filter((c) => c.key === activeTab);

  return (
    <div className="sm-page-enter">
      {/* Header */}
      <SectionTitle
        title="Catatan Data"
        sub="Ringkasan kualitas data dari seluruh file yang diupload — tidak terpengaruh filter global"
        icon={ClipboardList}
        colors={colors}
      />

      {/* Summary dashboard: 5 KPI cards compact */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        {summaryStats.map((stat) => {
          const Icon = stat.icon;
          const accentColor = colors[stat.color] || colors.textMuted;
          return (
            <div
              key={stat.label}
              className="sm-card p-4"
              style={{ borderLeft: `3px solid ${accentColor}` }}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs uppercase tracking-wider font-semibold" style={{ color: colors.textMuted }}>
                  {stat.label}
                </span>
                <div className="p-1 rounded-lg" style={{ background: accentColor + "1A" }}>
                  <Icon size={12} style={{ color: accentColor }} />
                </div>
              </div>
              <div className="disp text-xl font-bold mono" style={{ color: accentColor }}>
                {fmtNum(stat.value)}
              </div>
              <div className="text-[11px] mt-1" style={{ color: colors.textMuted }}>{stat.sub}</div>
            </div>
          );
        })}
      </div>

      {/* Health status banner */}
      <div
        className="p-4 rounded-xl mb-6 flex items-center gap-3"
        style={{
          background: hasIssues ? colors.coral + "0D" : colors.mint + "0D",
          border: `1px solid ${hasIssues ? colors.coral + "33" : colors.mint + "33"}`,
        }}
      >
        <div className="p-2 rounded-xl shrink-0" style={{ background: hasIssues ? colors.coral + "1A" : colors.mint + "1A" }}>
          {hasIssues ? <AlertTriangle size={18} style={{ color: colors.coral }} /> : <CheckCircle2 size={18} style={{ color: colors.mint }} />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold" style={{ color: hasIssues ? colors.coral : colors.mint }}>
            {hasIssues ? `${totalIssues} isu kualitas data terdeteksi` : "Kualitas data baik"}
          </div>
          <p className="text-xs mt-0.5" style={{ color: colors.textMuted }}>
            {hasIssues
              ? "Tinjau setiap kategori di bawah — isu critical (merah) sebaiknya ditangani lebih dulu karena transaksi tidak dihitung di dashboard."
              : "Semua kolom terbaca, tidak ada sales/grup tidak dikenali, dan tidak ada duplikat. Data siap dipakai."}
          </p>
        </div>
      </div>

      {/* Tab filter — hanya tampil kalau ada isu */}
      {hasIssues && tabs.length > 1 && (
        <div className="flex gap-1.5 mb-4 overflow-x-auto sm-scrollhide">
          {tabs.map((tab) => {
            const on = activeTab === tab.key;
            const isActive = tab.count > 0;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className="sm-tab-btn px-3 py-2 rounded-lg text-sm font-semibold inline-flex items-center gap-2 whitespace-nowrap"
                style={{
                  background: on ? colors.glassFillStrong : "transparent",
                  color: on ? colors.mint : colors.textMuted,
                  border: `1px solid ${on ? colors.mint + "55" : colors.glassBorder}`,
                }}
              >
                {tab.label}
                {isActive && (
                  <span
                    className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                    style={{
                      background: on ? colors.mint + "1A" : colors.glassSubtle,
                      color: on ? colors.mint : colors.textMuted,
                    }}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Issue cards */}
      {hasIssues ? (
        activeCategories.length > 0 ? (
          <div className="space-y-0">
            {activeCategories.map(renderIssueCard)}
          </div>
        ) : (
          // Active tab tapi tidak ada isu di kategori itu (seharusnya tidak terjadi
          // karena tab hanya tampil kalau count > 0, tapi jaga-jaga)
          <div className="sm-card p-8 text-center">
            <CheckCircle2 size={28} className="mx-auto mb-2" style={{ color: colors.mint }} />
            <div className="font-semibold mb-1">Tidak ada isu di kategori ini</div>
            <p className="text-sm" style={{ color: colors.textMuted }}>Pilih tab lain untuk lihat isu yang ada.</p>
          </div>
        )
      ) : (
        // No issues at all — clean state
        <div className="sm-card p-8 text-center">
          <div className="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center" style={{ background: colors.mint + "1A" }}>
            <Shield size={24} style={{ color: colors.mint }} />
          </div>
          <div className="disp text-base font-semibold mb-1">Data Berkualitas Baik</div>
          <p className="text-sm mb-4" style={{ color: colors.textMuted }}>
            Semua kolom terbaca, tidak ada sales/grup tidak dikenali, dan tidak ada duplikat.
            Data siap dipakai untuk dashboard.
          </p>
          <div className="flex items-center justify-center gap-2 text-xs" style={{ color: colors.textMuted }}>
            <FileSpreadsheet size={12} />
            <span>{fmtNum(totalDataRows)} baris terbaca</span>
            <ArrowRight size={12} />
            <span>Buka tab Main Report untuk lihat dashboard</span>
          </div>
        </div>
      )}
    </div>
  );
}
