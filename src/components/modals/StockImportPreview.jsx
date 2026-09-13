import { useState } from "react";
import { createPortal } from "react-dom";
import {
  AlertTriangle, CheckCircle2, Plus, Minus, X, FileSpreadsheet, PackageX,
} from "lucide-react";
import { useScrollLock, useEscapeKey } from "../../hooks/useModalA11y.js";
import { fmtRp, fmtNum } from "../../utils/formatters.js";

/* ============================================================================
   STOCK IMPORT PREVIEW — Sprint 19 / Sprint 2: Reconciliation
   Modal preview untuk reconciliation stok. Tampilkan diff antara stok sistem
   (current) vs stok dari upload baru. User review → konfirmasi → adjust.

   Saat ada existing snapshot → tampilkan diff (reconciliation mode).
   Saat first upload (no existing snapshot) → tampilkan summary saja (save mode).

   Props:
   - isOpen: boolean
   - onClose: () => void
   - onConfirm: () => void
   - diffResult: { items, summary, warnings } | null
   - parsedData: { products, stats } | null
   - isFirstUpload: boolean — true jika no existing snapshot
   - colors
============================================================================ */
export function StockImportPreview({
  isOpen, onClose, onConfirm,
  diffResult, parsedData, isFirstUpload, colors,
}) {
  const [activeTab, setActiveTab] = useState("summary");

  useScrollLock(isOpen);
  useEscapeKey(isOpen, onClose);

  if (!isOpen) return null;

  const { items = [], summary = {}, warnings = [] } = diffResult || {};
  const hasDiff = !!diffResult && !isFirstUpload;
  const hasWarnings = warnings.length > 0;
  const hasAnomalies = (summary.anomalousProducts || 0) > 0;

  const significantItems = items.filter((i) => i.isAnomalous);
  const newItems = items.filter((i) => i.type === "new");
  const removedItems = items.filter((i) => i.type === "removed");

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.6)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl max-h-[90vh] rounded-2xl overflow-hidden flex flex-col"
        style={{ background: colors.modalPanelBg, border: `1px solid ${colors.glassBorder}` }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="p-5 flex items-center justify-between shrink-0"
          style={{ borderBottom: `1px solid ${colors.glassBorder}` }}
        >
          <div className="flex items-center gap-2.5">
            <div
              className="p-2 rounded-lg"
              style={{ background: hasWarnings ? colors.gold + "1A" : colors.mint + "1A" }}
            >
              <FileSpreadsheet
                size={18}
                style={{ color: hasWarnings ? colors.gold : colors.mint }}
              />
            </div>
            <div>
              <div className="text-lg font-bold disp" style={{ color: colors.text }}>
                {isFirstUpload ? "Upload Master Stok" : "Penyesuaian Stok"}
              </div>
              <p className="text-xs" style={{ color: colors.textMuted }}>
                {parsedData?.stats?.count || 0} produk
                {parsedData?.stats?.totalValue ? ` · ${fmtRp(parsedData.stats.totalValue)}` : ""}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg"
            style={{ background: colors.glassSubtle, color: colors.textMuted }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5">
          {/* Warnings */}
          {hasWarnings && (
            <div
              className="mb-4 p-3 rounded-lg flex items-start gap-2"
              style={{ background: colors.gold + "14", border: `1px solid ${colors.gold}33` }}
            >
              <AlertTriangle size={14} className="shrink-0 mt-0.5" style={{ color: colors.gold }} />
              <div>
                <div className="text-sm font-semibold" style={{ color: colors.gold }}>Peringatan</div>
                <ul className="text-xs mt-1" style={{ color: colors.text }}>
                  {warnings.map((w, i) => (
                    <li key={i}>• {w}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {hasDiff ? (
            <>
              {/* Summary stats */}
              <div className="grid grid-cols-4 gap-2 mb-4">
                <StatCard
                  label="Total Produk"
                  value={summary.totalProducts || 0}
                  color={colors.blue}
                  colors={colors}
                />
                <StatCard
                  label="Baru"
                  value={summary.newProducts || 0}
                  color={colors.mint}
                  colors={colors}
                  icon={Plus}
                />
                <StatCard
                  label="Hilang"
                  value={summary.removedProducts || 0}
                  color={colors.coral}
                  colors={colors}
                  icon={PackageX}
                />
                <StatCard
                  label="Signifikan"
                  value={summary.anomalousProducts || 0}
                  color={colors.gold}
                  colors={colors}
                  icon={AlertTriangle}
                />
              </div>

              {/* Qty/Value change */}
              <div className="grid grid-cols-2 gap-2 mb-4">
                <div className="p-3 rounded-lg" style={{ background: colors.glassSubtle }}>
                  <div className="text-xs" style={{ color: colors.textMuted }}>
                    Perubahan Qty (total)
                  </div>
                  <div
                    className="text-lg font-bold mono"
                    style={{
                      color: (summary.totalQtyChange || 0) >= 0 ? colors.mint : colors.coral,
                    }}
                  >
                    {(summary.totalQtyChange || 0) >= 0 ? "+" : ""}
                    {fmtNum(summary.totalQtyChange || 0)}
                  </div>
                </div>
                <div className="p-3 rounded-lg" style={{ background: colors.glassSubtle }}>
                  <div className="text-xs" style={{ color: colors.textMuted }}>
                    Perubahan Nilai
                  </div>
                  <div
                    className="text-lg font-bold mono"
                    style={{
                      color: (summary.totalValueChange || 0) >= 0 ? colors.mint : colors.coral,
                    }}
                  >
                    {(summary.totalValueChange || 0) >= 0 ? "+" : ""}
                    {fmtRp(summary.totalValueChange || 0)}
                  </div>
                </div>
              </div>

              {/* Tabs for detail */}
              <div className="flex gap-1.5 mb-3 flex-wrap">
                <TabButton
                  active={activeTab === "summary"}
                  onClick={() => setActiveTab("summary")}
                  label={`Ringkasan (${summary.totalProducts || 0})`}
                  colors={colors}
                />
                <TabButton
                  active={activeTab === "significant"}
                  onClick={() => setActiveTab("significant")}
                  label={`Signifikan (${significantItems.length})`}
                  colors={colors}
                />
                <TabButton
                  active={activeTab === "new"}
                  onClick={() => setActiveTab("new")}
                  label={`Baru (${newItems.length})`}
                  colors={colors}
                />
                <TabButton
                  active={activeTab === "removed"}
                  onClick={() => setActiveTab("removed")}
                  label={`Hilang (${removedItems.length})`}
                  colors={colors}
                />
              </div>

              {/* Items list */}
              <div
                className="max-h-64 overflow-y-auto rounded-lg"
                style={{ border: `1px solid ${colors.glassBorder}` }}
              >
                {activeTab === "summary" && (
                  <SummaryList items={items} colors={colors} />
                )}
                {activeTab === "significant" &&
                  (significantItems.length > 0 ? (
                    significantItems.map((item) => (
                      <DiffItem key={item.productCode} item={item} colors={colors} />
                    ))
                  ) : (
                    <EmptyDetail text="Tidak ada perubahan signifikan" colors={colors} />
                  ))}
                {activeTab === "new" &&
                  (newItems.length > 0 ? (
                    newItems.map((item) => (
                      <DiffItem key={item.productCode} item={item} colors={colors} />
                    ))
                  ) : (
                    <EmptyDetail text="Tidak ada produk baru" colors={colors} />
                  ))}
                {activeTab === "removed" &&
                  (removedItems.length > 0 ? (
                    removedItems.map((item) => (
                      <DiffItem key={item.productCode} item={item} colors={colors} />
                    ))
                  ) : (
                    <EmptyDetail text="Tidak ada produk hilang" colors={colors} />
                  ))}
              </div>
            </>
          ) : (
            // First upload — no diff, just summary
            <div className="text-center py-8">
              <CheckCircle2
                size={32}
                className="mx-auto mb-3"
                style={{ color: colors.mint, opacity: 0.5 }}
              />
              <p className="text-sm" style={{ color: colors.text }}>
                {parsedData?.stats?.count || 0} produk siap diimpor
              </p>
              <p className="text-xs mt-1" style={{ color: colors.textMuted }}>
                {parsedData?.stats?.totalQtyBase
                  ? `Total qty: ${fmtNum(parsedData.stats.totalQtyBase)} unit`
                  : ""}
                {parsedData?.stats?.totalValue
                  ? ` · Nilai: ${fmtRp(parsedData.stats.totalValue)}`
                  : ""}
              </p>
              <p className="text-xs mt-3" style={{ color: colors.textMuted }}>
                Stok akan otomatis berkurang saat ada transaksi penjualan
                (untuk tanggal setelah snapshot).
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className="p-5 flex gap-2 shrink-0"
          style={{ borderTop: `1px solid ${colors.glassBorder}` }}
        >
          <button
            onClick={onClose}
            className="flex-1 sm-btn px-4 py-2 rounded-lg text-sm font-semibold"
            style={{
              background: colors.glassFill,
              color: colors.text,
              border: `1px solid ${colors.glassBorder}`,
            }}
          >
            Batal
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 px-4 py-2 rounded-lg text-sm font-semibold"
            style={{
              background: hasWarnings ? colors.gold : colors.mint,
              color: "#0A1120",
            }}
          >
            {hasDiff
              ? hasWarnings
                ? "Konfirmasi & Sesuaikan"
                : "Simpan & Sesuaikan"
              : "Simpan Stok"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

/* ---- Helper components ---- */
function StatCard({ label, value, color, colors, icon: Icon }) {
  return (
    <div
      className="p-3 rounded-lg text-center"
      style={{ background: color + "0D", border: `1px solid ${color}33` }}
    >
      <div className="flex items-center justify-center gap-1">
        {Icon && <Icon size={12} style={{ color }} />}
        <div className="text-2xl font-bold mono" style={{ color }}>
          {value}
        </div>
      </div>
      <div className="text-xs mt-0.5" style={{ color: colors.textMuted }}>
        {label}
      </div>
    </div>
  );
}

function TabButton({ active, onClick, label, colors }) {
  return (
    <button
      onClick={onClick}
      className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
      style={{
        background: active ? colors.mint + "1A" : colors.glassFill,
        color: active ? colors.mint : colors.textMuted,
        border: `1px solid ${active ? colors.mint + "55" : colors.glassBorder}`,
      }}
    >
      {label}
    </button>
  );
}

function DiffItem({ item, colors }) {
  const isAdd = item.diff > 0;
  const isRemove = item.type === "removed";
  const color = isRemove ? colors.coral : isAdd ? colors.mint : colors.gold;

  return (
    <div
      className="px-3 py-2 flex items-center gap-2"
      style={{ borderBottom: `1px solid ${colors.glassBorder}` }}
    >
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate" style={{ color: colors.text }}>
          {item.productName}
        </div>
        <div className="text-xs mono" style={{ color: colors.textMuted }}>
          {item.productCode}
          {item.group ? ` · ${item.group}` : ""}
        </div>
      </div>
      <div className="text-right shrink-0">
        <div className="text-xs" style={{ color: colors.textMuted }}>
          {fmtNum(item.oldQty)} → {item.newQty !== null ? fmtNum(item.newQty) : "—"}
        </div>
        <div className="text-sm font-bold mono" style={{ color }}>
          {isAdd ? "+" : ""}
          {fmtNum(item.diff)} ({item.diffPct.toFixed(1)}%)
        </div>
      </div>
    </div>
  );
}

function SummaryList({ items, colors }) {
  // Show top 20 by absolute diff (most impactful first)
  const top = [...items]
    .sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff))
    .slice(0, 20);

  if (!top.length) {
    return <EmptyDetail text="Tidak ada perubahan" colors={colors} />;
  }

  return top.map((item) => <DiffItem key={item.productCode} item={item} colors={colors} />);
}

function EmptyDetail({ text, colors }) {
  return (
    <div className="p-8 text-center text-sm" style={{ color: colors.textMuted }}>
      {text}
    </div>
  );
}
