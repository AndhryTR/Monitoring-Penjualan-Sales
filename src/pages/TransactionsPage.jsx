import { useState, useMemo } from "react";
import { Receipt } from "lucide-react";
import { fmtRp, fmtNum } from "../utils/formatters.js";
import { filterTransactions, summarizeTransactions } from "../utils/transactions.js";
import { SectionTitle } from "../components/ui/index.jsx";
import { TransactionFilters } from "../components/transactions/TransactionFilters.jsx";
import { TransactionTable } from "../components/transactions/TransactionTable.jsx";

/* ============================================================================
   TAB: TRANSAKSI
   Tampilkan baris transaksi mentah hasil upload (rawRows) yang sudah difilter
   oleh FilterBar global (date/sales/grup) + filter lokal tambahan (outlet,
   qty range, value range, satuan). Menghormati filter global supaya konsisten
   dengan tab lain — user bisa lihat transaksi yang berkontribusi ke angka
   agregat di tab Main/Sales/Product.
============================================================================ */

const DEFAULT_LOCAL_FILTERS = {
  outletCodes: [],
  qtyMin: null,
  qtyMax: null,
  valueMin: null,
  valueMax: null,
  unit: "",
};

export function TransactionsPage({ agg, colors, onOutletDrilldown }) {
  // agg.filteredRows sudah apply filter global (date/sales/grup) di useAggregates.
  // Filter lokal di sini untuk outlet spesifik, qty range, value range, satuan.
  const [localFilters, setLocalFilters] = useState(DEFAULT_LOCAL_FILTERS);

  // Filter baris berdasarkan filter lokal
  const filteredRows = useMemo(
    () => filterTransactions(agg.filteredRows, localFilters),
    [agg.filteredRows, localFilters]
  );

  // Statistik ringkas untuk header
  const summary = useMemo(
    () => summarizeTransactions(filteredRows),
    [filteredRows]
  );

  // Periode label untuk header
  const periodLabel = agg.meta.firstDate && agg.meta.lastDate
    ? `${agg.meta.firstDate} — ${agg.meta.lastDate}`
    : "Tidak ada tanggal";

  return (
    <div className="sm-page-enter">
      <SectionTitle
        title="Transaksi"
        sub={`${fmtNum(summary.rowCount)} baris · ${summary.uniqueSales} sales · ${summary.uniqueOutlets} outlet · ${periodLabel}`}
        icon={Receipt}
        colors={colors}
      />

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="sm-card p-4">
          <div className="text-xs mb-1" style={{ color: colors.textMuted }}>Total Baris</div>
          <div className="mono text-lg font-bold">{fmtNum(summary.rowCount)}</div>
        </div>
        <div className="sm-card p-4">
          <div className="text-xs mb-1" style={{ color: colors.textMuted }}>Sales Unik</div>
          <div className="mono text-lg font-bold">{fmtNum(summary.uniqueSales)}</div>
        </div>
        <div className="sm-card p-4">
          <div className="text-xs mb-1" style={{ color: colors.textMuted }}>Outlet Unik</div>
          <div className="mono text-lg font-bold">{fmtNum(summary.uniqueOutlets)}</div>
        </div>
        <div className="sm-card p-4">
          <div className="text-xs mb-1" style={{ color: colors.textMuted }}>Total Value</div>
          <div className="mono text-lg font-bold">{fmtRp(summary.totalValue)}</div>
        </div>
      </div>

      {/* Filter lokal (collapsible) */}
      <TransactionFilters
        rows={agg.filteredRows}
        filters={localFilters}
        setFilters={setLocalFilters}
        colors={colors}
      />

      {/* Tabel transaksi dengan incremental load */}
      {filteredRows.length === 0 ? (
        <div className="sm-card p-12 text-center">
          <div className="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center" style={{ background: colors.glassFill }}>
            <Receipt size={24} style={{ color: colors.textMuted }} />
          </div>
          <div className="disp text-base font-semibold mb-1">Tidak ada transaksi</div>
          <p className="text-sm" style={{ color: colors.textMuted }}>
            Coba ubah filter di atas, atau periksa filter global (tanggal/sales/grup) di bar filter utama.
          </p>
        </div>
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
