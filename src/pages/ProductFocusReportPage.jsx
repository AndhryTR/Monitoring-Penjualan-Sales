import { useState, useMemo } from "react";
import { Crosshair, AlertTriangle } from "lucide-react";
import { fmtNum, fmtPct } from "../utils/formatters.js";
import { AchBadge } from "../components/AchBadge.jsx";
import { MultiSelect } from "../components/ui/MultiSelect.jsx";
import { DataTable } from "../components/ui/DataTable.jsx";
import { DrilldownButton, CollapsibleSection } from "../components/ui/index.jsx";

/* ============================================================================
   TAB: PRODUCT FOCUS
   MultiSelect filter produk fokus + grid kartu progress bar per sales×produk
   + tabel detail.
============================================================================ */
export function ProductFocusReportPage({ agg, colors, onDrilldown }) {
  const [focusFilter, setFocusFilter] = useState([]);
  const focusNames = useMemo(() => Array.from(new Set(agg.focusRows.map((f) => f.name))), [agg.focusRows]);
  const rows = focusFilter.length ? agg.focusRows.filter((f) => focusFilter.includes(f.name)) : agg.focusRows;
  return (
    <div className="sm-fadein">
      <div className="mb-6">
        <MultiSelect label="Produk Fokus" icon={Crosshair} options={focusNames} selected={focusFilter} onChange={setFocusFilter} placeholder="Cari produk fokus..." colors={colors} />
      </div>
      <CollapsibleSection id="productFocus.pencapaianPerSales" title="Pencapaian Produk Fokus per Sales" sub="Target & realisasi dalam satuan karton (kecuali ditandai lain, memakai satuan asli produk)" icon={Crosshair} colors={colors} className="mb-8">
        {rows.length === 0 && (
          <div className="sm-card p-8 text-center" style={{ color: colors.textMuted }}>
            <AlertTriangle size={24} className="mx-auto mb-2" style={{ color: colors.gold }} />
            Tidak ada data produk fokus untuk sales/filter terpilih.
          </div>
        )}
        <div className="grid md:grid-cols-2 gap-4">
          {rows.map((f, i) => {
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
                <div className="h-2.5 rounded-full overflow-hidden" style={{ background: colors.surface2 }}>
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
      </CollapsibleSection>

      <CollapsibleSection id="productFocus.detailTabel" title="Detail Tabel" icon={Crosshair} colors={colors}>
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
          rows={rows}
        />
      </CollapsibleSection>
    </div>
  );
}
