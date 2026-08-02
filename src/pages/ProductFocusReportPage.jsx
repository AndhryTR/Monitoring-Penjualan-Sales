import { useState, useMemo } from "react";
import { Crosshair, Package, AlertTriangle, Download } from "lucide-react";
import { fmtRp, fmtNum, fmtPct } from "../utils/formatters.js";
import { AchBadge } from "../components/AchBadge.jsx";
import { MultiSelect } from "../components/ui/MultiSelect.jsx";
import { DataTable } from "../components/ui/DataTable.jsx";
import { SectionTitle, DrilldownButton } from "../components/ui/index.jsx";
import { exportProductFocusExcel } from "../utils/reportExcelExport.js";

/* ============================================================================
   TAB: PRODUCT FOCUS
   Dua view, toggle di atas:
   - "Produk Fokus": MultiSelect filter produk fokus + grid kartu progress bar
     per sales×produk + tabel detail. (Konten lama, tidak berubah.)
   - "Grup Fokus": highlight grup yang ditandai `focus: true` di Pengaturan —
     kartu progress per sales×grup + tabel detail. ACH pakai target grup
     existing (value Rp), bukan target baru.
============================================================================ */
export function ProductFocusReportPage({ agg, colors, onDrilldown, depotName }) {
  const [viewMode, setViewMode] = useState("product"); // "product" | "group"
  const [focusFilter, setFocusFilter] = useState([]);

  // ---- View: Produk Fokus (konten lama) ----
  const focusNames = useMemo(() => Array.from(new Set(agg.focusRows.map((f) => f.name))), [agg.focusRows]);
  const productRows = focusFilter.length ? agg.focusRows.filter((f) => focusFilter.includes(f.name)) : agg.focusRows;
  const handleExportProduct = () => exportProductFocusExcel(productRows, {
    depotName, dateRangeLabel: agg.meta.firstDate ? `${agg.meta.firstDate} — ${agg.meta.lastDate}` : "",
  });

  // ---- View: Grup Fokus ----
  const groupNames = useMemo(() => Array.from(new Set(agg.focusGroupRows.map((g) => g.name))), [agg.focusGroupRows]);
  const [groupFilter, setGroupFilter] = useState([]);
  const groupRows = groupFilter.length ? agg.focusGroupRows.filter((g) => groupFilter.includes(g.name)) : agg.focusGroupRows;

  return (
    <div className="sm-page-enter">
      {/* Toggle Produk Fokus | Grup Fokus */}
      <div className="flex items-center gap-2 mb-6">
        <div className="flex p-1 rounded-xl" style={{ background: colors.glassSubtle, border: `1px solid ${colors.glassBorder}` }}>
          <button onClick={() => setViewMode("product")}
            className="sm-tab-btn px-3 py-1.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5"
            style={{ background: viewMode === "product" ? colors.glassFillStrong : "transparent", color: viewMode === "product" ? colors.coral : colors.textMuted }}>
            <Crosshair size={13} /> Produk Fokus
          </button>
          <button onClick={() => setViewMode("group")}
            className="sm-tab-btn px-3 py-1.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5"
            style={{ background: viewMode === "group" ? colors.glassFillStrong : "transparent", color: viewMode === "group" ? colors.violet : colors.textMuted }}>
            <Package size={13} /> Grup Fokus
          </button>
        </div>
      </div>

      {viewMode === "product" ? (
        <>
          <div className="mb-6">
            <MultiSelect label="Produk Fokus" icon={Crosshair} options={focusNames} selected={focusFilter} onChange={setFocusFilter} placeholder="Cari produk fokus..." colors={colors} />
          </div>
          <SectionTitle title="Pencapaian Produk Fokus per Sales" sub="Target & realisasi dalam satuan karton (kecuali ditandai lain, memakai satuan asli produk)" icon={Crosshair} colors={colors} accent={colors.coral} />
          {productRows.length === 0 && (
            <div className="sm-card p-8 text-center" style={{ color: colors.textMuted }}>
              <AlertTriangle size={24} className="mx-auto mb-2" style={{ color: colors.gold }} />
              Tidak ada data produk fokus untuk sales/filter terpilih.
            </div>
          )}
          <div className="grid md:grid-cols-2 gap-4 mb-8">
            {productRows.map((f, i) => {
              const pct = Math.min(150, (f.pct || 0) * 100);
              const color = pct >= 100 ? colors.mint : pct >= 50 ? colors.gold : colors.coral;
              return (
                <div key={i} className="sm-card p-4 sm-fadeup" style={{ animationDelay: `${i * 25}ms` }}>
                  <div className="flex justify-between items-baseline mb-2">
                    <div>
                      <div className="text-sm font-semibold disp flex items-center gap-1.5">
                        {f.name}
                        {f.hasUnconvertible && (
                          <AlertTriangle size={12} style={{ color: colors.gold }} title={`Tidak ada referensi KARTON untuk produk ini di data — realisasi ditampilkan dalam satuan asli (${f.unit})`} />
                        )}
                      </div>
                      <div className="text-xs" style={{ color: colors.textMuted }}>{f.salesName}</div>
                    </div>
                    <span className="mono text-sm font-semibold" style={{ color }}>{fmtPct(f.pct)}</span>
                  </div>
                  <div className="h-2.5 rounded-full overflow-hidden" style={{ background: colors.glassFill }}>
                    <div className="sm-progress-fill h-full rounded-full" style={{ width: `${Math.min(100, pct)}%`, background: color }} />
                  </div>
                  <div className="flex justify-between mt-1.5 text-xs mono" style={{ color: colors.textMuted }}>
                    <span>{fmtNum(f.realisasi)} {f.unit.toLowerCase()}</span>
                    <span>Target {fmtNum(f.target)}</span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-between flex-wrap gap-3 mb-0">
            <SectionTitle title="Detail Tabel" icon={Crosshair} colors={colors} />
            <button onClick={handleExportProduct}
              className="sm-btn inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
              style={{ background: colors.glassFill, border: `1px solid ${colors.glassBorder}`, color: colors.text }}>
              <Download size={13} /> Export Excel
            </button>
          </div>
          <DataTable
            colors={colors}
            initialSortKey="pct"
            searchable
            searchKeys={["salesName", "name"]}
            searchPlaceholder="Cari nama sales atau produk fokus..."
            columns={[
              { key: "salesName", label: "Sales" },
              { key: "name", label: "Produk Fokus", render: (r) => (
                <span className="flex items-center gap-1.5">
                  {r.name}
                  {r.hasUnconvertible && <AlertTriangle size={12} style={{ color: colors.gold }} title={`Satuan asli: ${r.unit}`} />}
                </span>
              ) },
              { key: "target", label: "Target", render: (r) => <span className="mono">{fmtNum(r.target)}</span> },
              { key: "realisasi", label: "Realisasi", render: (r) => <span className="mono">{fmtNum(r.realisasi)} <span style={{ color: colors.textMuted, fontSize: 10 }}>{r.unit}</span></span> },
              { key: "pct", label: "%", render: (r) => <AchBadge ach={r.pct} colors={colors} /> },
              { key: "_drilldown", label: "", render: (r) => onDrilldown && <DrilldownButton colors={colors} onClick={() => onDrilldown(`${r.salesName} — ${r.name}`, "Outlet", r.predicate)} /> },
            ]}
            rows={productRows}
          />
        </>
      ) : (
        <>
          <div className="mb-6">
            <MultiSelect label="Grup Fokus" icon={Package} options={groupNames} selected={groupFilter} onChange={setGroupFilter} placeholder="Cari grup fokus..." colors={colors} />
          </div>
          <SectionTitle title="Pencapaian Grup Fokus per Sales" sub="Grup yang ditandai fokus di Pengaturan — target & realisasi dalam Rupiah (pakai target grup existing)" icon={Package} colors={colors} accent={colors.violet} />
          {groupRows.length === 0 && (
            <div className="sm-card p-8 text-center" style={{ color: colors.textMuted }}>
              <AlertTriangle size={24} className="mx-auto mb-2" style={{ color: colors.gold }} />
              Belum ada grup fokus — tandai di Pengaturan → Target Grup Produk (tombol Fokus), atau ubah filter di atas.
            </div>
          )}
          <div className="grid md:grid-cols-2 gap-4 mb-8">
            {groupRows.map((g, i) => {
              const pct = Math.min(150, (g.ach || 0) * 100);
              const color = pct >= 100 ? colors.mint : pct >= 50 ? colors.gold : colors.coral;
              return (
                <div key={i} className="sm-card p-4 sm-fadeup" style={{ animationDelay: `${i * 25}ms` }}>
                  <div className="flex justify-between items-baseline mb-2">
                    <div>
                      <div className="text-sm font-semibold disp flex items-center gap-1.5">
                        {g.name}
                      </div>
                      <div className="text-xs" style={{ color: colors.textMuted }}>{g.salesName}</div>
                    </div>
                    <span className="mono text-sm font-semibold" style={{ color }}>{fmtPct(g.ach)}</span>
                  </div>
                  <div className="h-2.5 rounded-full overflow-hidden" style={{ background: colors.glassFill }}>
                    <div className="sm-progress-fill h-full rounded-full" style={{ width: `${Math.min(100, pct)}%`, background: color }} />
                  </div>
                  <div className="flex justify-between mt-1.5 text-xs mono" style={{ color: colors.textMuted }}>
                    <span>{fmtRp(g.realisasiValue)}</span>
                    <span>Target {fmtRp(g.targetValue)}</span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-between flex-wrap gap-3 mb-0">
            <SectionTitle title="Detail Tabel" icon={Package} colors={colors} />
          </div>
          <DataTable
            colors={colors}
            initialSortKey="ach"
            searchable
            searchKeys={["salesName", "name"]}
            searchPlaceholder="Cari nama sales atau grup fokus..."
            columns={[
              { key: "salesName", label: "Sales" },
              { key: "name", label: "Grup Fokus" },
              { key: "targetValue", label: "Target", render: (r) => <span className="mono">{fmtRp(r.targetValue)}</span> },
              { key: "realisasiValue", label: "Realisasi", render: (r) => <span className="mono">{fmtRp(r.realisasiValue)}</span> },
              { key: "ach", label: "ACH", render: (r) => <AchBadge ach={r.ach} colors={colors} /> },
              { key: "realisasiAo", label: "AO", render: (r) => <span className="mono">{fmtNum(r.realisasiAo)}/{fmtNum(r.targetAo)}</span> },
              { key: "_drilldown", label: "", render: (r) => onDrilldown && <DrilldownButton colors={colors} onClick={() => onDrilldown(`${r.salesName} — ${r.name}`, "Outlet", r.predicate)} /> },
            ]}
            rows={groupRows}
          />
        </>
      )}
    </div>
  );
}
