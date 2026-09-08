import { useState, useMemo, useEffect } from "react";
import { Receipt, Filter, X, Store, Receipt as ReceiptIcon } from "lucide-react";
import { fmtRp, fmtNum } from "../utils/formatters.js";
import { filterTransactions, summarizeTransactions, getOutletOptions, getUnitOptions } from "../utils/transactions.js";
import { SectionTitle } from "../components/ui/index.jsx";
import { TransactionTable } from "../components/transactions/TransactionTable.jsx";
import { EmptyState } from "../components/ui/EmptyState.jsx";
import { MultiSelect } from "../components/ui/MultiSelect.jsx";
import { notifyExportSuccess } from "../utils/notifyExport.js";

/* ============================================================================
   TAB: TRANSAKSI — REDESIGN (Sprint 12)
   ⚠️ Sebelumnya: 4 summary card generik + filter collapsible duplicating
   content (desktop vs mobile) + tabel mentah tanpa pagination info.

   Improvements:
   1. Inline stats di header (bukan 4 card terpisah) — lebih ringkas
   2. Filter inline (bukan collapsible) — langsung kelihatan, tidak perlu klik
   3. Pagination info "Menampilkan X-Y dari Z baris" — user tahu posisi
   4. Empty state contextual dengan action hint
   5. Summary card kecil untuk Total Value + Avg/baris (lebih actionable)
============================================================================ */

const DEFAULT_LOCAL_FILTERS = {
  outletCodes: [],
  qtyMin: null,
  qtyMax: null,
  valueMin: null,
  valueMax: null,
  unit: "",
};

export function TransactionsPage({
  agg, colors, onOutletDrilldown, depotName = "",
  registerTabExport, unregisterTabExport,
}) {
  const [localFilters, setLocalFilters] = useState(DEFAULT_LOCAL_FILTERS);
  const [exportBusy, setExportBusy] = useState(false);

  const filteredRows = useMemo(
    () => filterTransactions(agg.filteredRows, localFilters),
    [agg.filteredRows, localFilters]
  );

  const summary = useMemo(
    () => summarizeTransactions(filteredRows),
    [filteredRows]
  );

  const outletOptions = useMemo(() => getOutletOptions(agg.filteredRows), [agg.filteredRows]);
  const unitOptions = useMemo(() => getUnitOptions(agg.filteredRows), [agg.filteredRows]);

  const periodLabel = agg.meta.firstDate && agg.meta.lastDate
    ? `${agg.meta.firstDate} — ${agg.meta.lastDate}`
    : "Tidak ada tanggal";

  // Filter state untuk MultiSelect outlet (pakai name, convert ke code)
  const outletNames = outletOptions.map((o) => o.name);
  const selectedOutletNames = useMemo(() => {
    const codeToName = Object.fromEntries(outletOptions.map((o) => [o.code, o.name]));
    return localFilters.outletCodes.map((code) => codeToName[code]).filter(Boolean);
  }, [localFilters.outletCodes, outletOptions]);

  const handleOutletChange = (names) => {
    const nameToCode = Object.fromEntries(outletOptions.map((o) => [o.name, o.code]));
    setLocalFilters((f) => ({ ...f, outletCodes: names.map((n) => nameToCode[n]).filter(Boolean) }));
  };

  const activeFilterCount =
    (localFilters.outletCodes.length ? 1 : 0) +
    (localFilters.qtyMin !== null && localFilters.qtyMin !== "" ? 1 : 0) +
    (localFilters.qtyMax !== null && localFilters.qtyMax !== "" ? 1 : 0) +
    (localFilters.valueMin !== null && localFilters.valueMin !== "" ? 1 : 0) +
    (localFilters.valueMax !== null && localFilters.valueMax !== "" ? 1 : 0) +
    (localFilters.unit ? 1 : 0);

  const handleResetFilters = () => setLocalFilters(DEFAULT_LOCAL_FILTERS);

  const handleExportExcel = async () => {
    if (!filteredRows.length || exportBusy) return;
    setExportBusy(true);
    try {
      const { exportTransactionsExcel } = await import("../utils/reportExcelExport.js");
      exportTransactionsExcel(filteredRows, {
        depotName,
        dateRangeLabel: periodLabel,
      });
      await notifyExportSuccess("Export berhasil", "Data Transaksi (Excel)");
    } catch (err) {
      console.error("Export transaksi gagal:", err);
    } finally {
      setExportBusy(false);
    }
  };

  useEffect(() => {
    registerTabExport?.("transactions", {
      onExportExcel: handleExportExcel,
      busy: exportBusy,
      disabled: filteredRows.length === 0,
    });
    return () => unregisterTabExport?.("transactions");
  }, [registerTabExport, unregisterTabExport, handleExportExcel, exportBusy, filteredRows.length]);

  const avgValue = summary.rowCount > 0 ? summary.totalValue / summary.rowCount : 0;

  return (
    <div className="sm-page-enter">
      {/* Header dengan inline stats */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <SectionTitle
          title="Transaksi"
          sub={`${fmtNum(summary.rowCount)} baris · ${summary.uniqueSales} sales · ${summary.uniqueOutlets} outlet · ${periodLabel}`}
          icon={Receipt}
          colors={colors}
        />

        {/* Stats summary (grid 2 kolom di mobile, flex di desktop) */}
        <div className="grid grid-cols-2 sm:flex sm:items-center gap-2.5 w-full sm:w-auto">
          <div className="sm-card px-3.5 py-2 min-w-0">
            <div className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: colors.textMuted }}>Total Value</div>
            <div className="mono text-sm sm:text-base font-bold truncate" style={{ color: colors.mint }}>{fmtRp(summary.totalValue)}</div>
          </div>
          <div className="sm-card px-3.5 py-2 min-w-0">
            <div className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: colors.textMuted }}>Rata-rata/baris</div>
            <div className="mono text-sm sm:text-base font-bold truncate" style={{ color: colors.gold }}>{fmtRp(avgValue)}</div>
          </div>
        </div>
      </div>

      {/* Filter inline (selalu tampil, bukan collapsible) */}
      <div className="sm-card p-4 mb-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 text-sm font-semibold" style={{ color: colors.text }}>
            <Filter size={14} style={{ color: activeFilterCount > 0 ? colors.gold : colors.textMuted }} />
            Filter Transaksi
            {activeFilterCount > 0 && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: colors.gold + "1A", color: colors.gold }}>
                {activeFilterCount} aktif
              </span>
            )}
          </div>
          {activeFilterCount > 0 && (
            <button
              onClick={handleResetFilters}
              className="sm-btn flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold"
              style={{ color: colors.coral, background: colors.coral + "14", border: `1px solid ${colors.coral}33` }}
            >
              <X size={12} /> Reset
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Outlet filter */}
          <div>
            <label className="block text-xs mb-1.5" style={{ color: colors.textMuted }}>Outlet</label>
            <MultiSelect
              label="Outlet"
              icon={Store}
              options={outletNames}
              selected={selectedOutletNames}
              onChange={handleOutletChange}
              placeholder="Cari outlet..."
              colors={colors}
              fullWidth
            />
          </div>

          {/* Qty range */}
          <div>
            <label className="block text-xs mb-1.5" style={{ color: colors.textMuted }}>Rentang Qty</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={localFilters.qtyMin ?? ""}
                onChange={(e) => setLocalFilters((f) => ({ ...f, qtyMin: e.target.value === "" ? null : e.target.value }))}
                placeholder="min"
                className="w-full px-2.5 py-2 rounded-lg text-sm mono outline-none"
                style={{ background: colors.glassFill, border: `1px solid ${colors.glassBorder}`, color: colors.text }}
              />
              <span style={{ color: colors.textMuted }} className="shrink-0">—</span>
              <input
                type="number"
                value={localFilters.qtyMax ?? ""}
                onChange={(e) => setLocalFilters((f) => ({ ...f, qtyMax: e.target.value === "" ? null : e.target.value }))}
                placeholder="max"
                className="w-full px-2.5 py-2 rounded-lg text-sm mono outline-none"
                style={{ background: colors.glassFill, border: `1px solid ${colors.glassBorder}`, color: colors.text }}
              />
            </div>
          </div>

          {/* Value range */}
          <div>
            <label className="block text-xs mb-1.5" style={{ color: colors.textMuted }}>Rentang Value (Rp)</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={localFilters.valueMin ?? ""}
                onChange={(e) => setLocalFilters((f) => ({ ...f, valueMin: e.target.value === "" ? null : e.target.value }))}
                placeholder="min"
                className="w-full px-2.5 py-2 rounded-lg text-sm mono outline-none"
                style={{ background: colors.glassFill, border: `1px solid ${colors.glassBorder}`, color: colors.text }}
              />
              <span style={{ color: colors.textMuted }} className="shrink-0">—</span>
              <input
                type="number"
                value={localFilters.valueMax ?? ""}
                onChange={(e) => setLocalFilters((f) => ({ ...f, valueMax: e.target.value === "" ? null : e.target.value }))}
                placeholder="max"
                className="w-full px-2.5 py-2 rounded-lg text-sm mono outline-none"
                style={{ background: colors.glassFill, border: `1px solid ${colors.glassBorder}`, color: colors.text }}
              />
            </div>
          </div>

          {/* Satuan */}
          <div>
            <label className="block text-xs mb-1.5" style={{ color: colors.textMuted }}>Satuan</label>
            <select
              value={localFilters.unit || ""}
              onChange={(e) => setLocalFilters((f) => ({ ...f, unit: e.target.value }))}
              className="w-full px-2.5 py-2 rounded-lg text-sm outline-none"
              style={{ background: colors.glassFill, border: `1px solid ${colors.glassBorder}`, color: colors.text, colorScheme: colors.colorScheme }}
            >
              <option value="">Semua satuan</option>
              {unitOptions.map((u) => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Tabel atau empty state */}
      {filteredRows.length === 0 ? (
        <EmptyState
          icon={ReceiptIcon}
          title="Tidak ada transaksi"
          description="Coba ubah filter di atas, atau periksa filter global (tanggal/sales/grup) di bar filter utama."
          hint="Filter aktif akan mengecilkan hasil — reset untuk lihat semua transaksi."
          colors={colors}
        />
      ) : (
        <TransactionTable
          rows={filteredRows}
          colors={colors}
          onOutletDrilldown={onOutletDrilldown}
        />
      )}
    </div>
  );
}
