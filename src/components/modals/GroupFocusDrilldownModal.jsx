import { useMemo } from "react";
import { createPortal } from "react-dom";
import { X, Package } from "lucide-react";
import { useScrollLock, useEscapeKey } from "../../hooks/useModalA11y.js";
import { fmtRp, fmtNum } from "../../utils/formatters.js";
import { DataTable } from "../ui/DataTable.jsx";

/* ============================================================================
   GROUP FOCUS DRILLDOWN MODAL — Sprint 19e
   Modal yang menampilkan detail per-SKU untuk grup fokus + sales tertentu.

   Trigger: klik card grup fokus di FocusGroupMini (Executive Summary) atau
   card grup fokus di ProductFocusReportPage.

   Layout:
   - Header: title (Grup Fokus: KOKOLA) + subtitle (AGUNG MULIADI) + summary
   - Search bar untuk filter SKU
   - DataTable: Kode, Nama, Qty, Value, Frek, Outlet, Sales
   - Footer: total SKU + total value

   Props:
   - isOpen, onClose, colors
   - title: string — "Grup Fokus: KOKOLA"
   - subtitle: string — "AGUNG MULIADI"
   - products: array dari getProductBreakdownForGroup
   - groupSummary: { realisasiValue, targetValue, ach, realisasiAo, targetAo }
============================================================================ */
export function GroupFocusDrilldownModal({
  isOpen, onClose, colors,
  title, subtitle, products = [], groupSummary,
}) {
  useScrollLock(isOpen);
  useEscapeKey(isOpen, onClose);

  // ⚠️ Hooks MUST be called before any early return (React rules of hooks)
  const totalSKU = products.length;
  const _totalValue = useMemo(() => products.reduce((s, p) => s + (p.value || 0), 0), [products]);
  const totalQty = useMemo(() => products.reduce((s, p) => s + (p.qty || 0), 0), [products]);

  if (!isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.6)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-4xl max-h-[90vh] rounded-2xl overflow-hidden flex flex-col"
        style={{ background: colors.modalPanelBg, border: `1px solid ${colors.glassBorder}` }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="p-5 flex items-center justify-between shrink-0"
          style={{ borderBottom: `1px solid ${colors.glassBorder}` }}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="p-2 rounded-lg shrink-0"
              style={{ background: colors.violet + "1A" }}
            >
              <Package size={18} style={{ color: colors.violet }} />
            </div>
            <div className="min-w-0">
              <div className="text-lg font-bold disp truncate" style={{ color: colors.text }}>
                {title || "Detail Grup Fokus"}
              </div>
              <p className="text-xs truncate" style={{ color: colors.textMuted }}>
                {subtitle || "Semua sales"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg shrink-0"
            style={{ background: colors.glassSubtle, color: colors.textMuted }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Summary cards */}
        <div className="px-5 py-3 flex items-center gap-3 shrink-0 flex-wrap"
          style={{ borderBottom: `1px solid ${colors.glassBorder}` }}>
          {groupSummary && (
            <>
              <SummaryChip
                label="Realisasi"
                value={fmtRp(groupSummary.realisasiValue)}
                color={colors.mint}
                colors={colors}
              />
              {groupSummary.targetValue > 0 && (
                <SummaryChip
                  label="Target"
                  value={fmtRp(groupSummary.targetValue)}
                  color={colors.gold}
                  colors={colors}
                />
              )}
              {groupSummary.ach !== null && groupSummary.ach !== undefined && (
                <SummaryChip
                  label="ACH"
                  value={`${(groupSummary.ach * 100).toFixed(1)}%`}
                  color={groupSummary.ach >= 0.7 ? colors.mint : groupSummary.ach >= 0.5 ? colors.gold : colors.coral}
                  colors={colors}
                />
              )}
              {groupSummary.realisasiAo > 0 && (
                <SummaryChip
                  label="Outlet"
                  value={`${groupSummary.realisasiAo}`}
                  color={colors.blue}
                  colors={colors}
                />
              )}
            </>
          )}
          <SummaryChip label="SKU" value={`${totalSKU}`} color={colors.violet} colors={colors} />
          <SummaryChip label="Total Qty" value={`${fmtNum(totalQty)} KRT`} color={colors.text} colors={colors} />
        </div>

        {/* Tabel SKU */}
        <div className="flex-1 overflow-y-auto">
          {products.length === 0 ? (
            <div className="text-center py-16">
              <Package size={32} className="mx-auto mb-3" style={{ color: colors.textMuted, opacity: 0.3 }} />
              <p className="text-sm" style={{ color: colors.textMuted }}>
                Tidak ada data SKU untuk filter ini.
              </p>
            </div>
          ) : (
            <DataTable
              colors={colors}
              initialSortKey="value"
              searchable
              searchKeys={["productCode", "productName", "salesLabel"]}
              searchPlaceholder="Cari kode/nama produk atau sales..."
              rows={products}
              columns={[
                {
                  key: "productCode",
                  label: "Kode",
                  render: (p) => (
                    <span className="mono text-xs" style={{ color: colors.textMuted }}>
                      {p.productCode}
                    </span>
                  ),
                },
                {
                  key: "productName",
                  label: "Nama Produk",
                  render: (p) => (
                    <span className="text-sm truncate inline-block max-w-[200px]" title={p.productName}>
                      {p.productName}
                    </span>
                  ),
                },
                {
                  key: "qty",
                  label: "Qty (KRT)",
                  render: (p) => (
                    <span className="mono text-sm" style={{ color: colors.text }}>
                      {fmtNum(p.qty)}
                    </span>
                  ),
                },
                {
                  key: "value",
                  label: "Value",
                  render: (p) => (
                    <span className="mono text-sm font-semibold" style={{ color: colors.mint }}>
                      {fmtRp(p.value)}
                    </span>
                  ),
                },
                {
                  key: "invoiceCount",
                  label: "Frek",
                  render: (p) => (
                    <span className="mono text-sm" style={{ color: colors.textMuted }}>
                      {p.invoiceCount}×
                    </span>
                  ),
                },
                {
                  key: "outletCount",
                  label: "Outlet",
                  render: (p) => (
                    <span className="mono text-sm" style={{ color: colors.blue }}>
                      {p.outletCount}
                    </span>
                  ),
                },
                {
                  key: "salesLabel",
                  label: "Sales",
                  render: (p) => (
                    <span className="text-xs truncate inline-block max-w-[120px]" title={p.salesLabel}
                      style={{ color: colors.textMuted }}>
                      {p.salesLabel}
                    </span>
                  ),
                },
              ]}
            />
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

function SummaryChip({ label, value, color, colors }) {
  return (
    <div
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs"
      style={{ background: color + "0D", border: `1px solid ${color}33` }}
    >
      <span style={{ color: colors.textMuted }}>{label}:</span>
      <span className="font-bold mono" style={{ color }}>{value}</span>
    </div>
  );
}
