import { useState, useMemo } from "react";
import { fmtRp, fmtNum } from "../../utils/formatters.js";
import { DataTable } from "../ui/DataTable.jsx";
import { DrilldownButton } from "../ui/index.jsx";
import { ChevronDown } from "lucide-react";

/* ============================================================================
   TRANSACTION TABLE
   Wrapper DataTable dengan columns khusus transaksi + incremental load
   (500 baris pertama, tombol "Muat lebih banyak" untuk load 500 berikutnya).
   Mobile: card-stack otomatis dari DataTable existing.
============================================================================ */

const INCREMENT = 500;

export function TransactionTable({ rows, colors, onOutletDrilldown }) {
  const [visibleCount, setVisibleCount] = useState(INCREMENT);

  // Reset visibleCount kalau rows berubah signifikan (filter berubah) —
  // supaya user tidak stuck di "showing 500 of 50" kalau filter dipersempit.
  // Pakai key berdasarkan rowCount untuk trigger reset via useEffect.
  const rowSignature = `${rows.length}-${rows[0]?.invoiceNo || ""}`;
  useMemo(() => setVisibleCount(INCREMENT), [rowSignature]);

  const visibleRows = useMemo(() => rows.slice(0, visibleCount), [rows, visibleCount]);
  const hasMore = rows.length > visibleCount;

  const columns = [
    { key: "date", label: "Tanggal", render: (r) => (
      <span className="mono text-xs">{r.date || "-"}</span>
    ) },
    { key: "salesName", label: "Sales", render: (r) => (
      <span className="text-xs">{r.salesName || "-"}</span>
    ) },
    { key: "outletName", label: "Outlet", render: (r) => (
      <span className="text-xs truncate inline-block max-w-[160px]" title={r.outletName}>{r.outletName || "-"}</span>
    ) },
    { key: "productName", label: "Produk", render: (r) => (
      <span className="text-xs truncate inline-block max-w-[180px]" title={r.productName}>{r.productName || "-"}</span>
    ) },
    { key: "group", label: "Grup", render: (r) => (
      <span className="text-xs" style={{ color: colors.textMuted }}>{r.group || "-"}</span>
    ) },
    { key: "qty", label: "Qty", render: (r) => (
      <span className="mono text-xs">
        {fmtNum(r.qty)} <span style={{ color: colors.textMuted, fontSize: 10 }}>{r.unit}</span>
      </span>
    ) },
    { key: "qtyKarton", label: "Qty (Karton)", render: (r) => (
      r.unconvertible ? (
        <span className="mono text-xs" style={{ color: colors.textMuted }} title="Tidak bisa dikonversi ke KARTON">—</span>
      ) : (
        <span className="mono text-xs">{fmtNum(r.qtyKarton)}</span>
      )
    ) },
    { key: "value", label: "Value", render: (r) => (
      <span className="mono text-xs">{fmtRp(r.value)}</span>
    ) },
    { key: "invoiceNo", label: "Invoice", render: (r) => (
      <span className="mono text-xs" style={{ color: colors.textMuted }}>{r.invoiceNo || "-"}</span>
    ) },
    { key: "_drilldown", label: "", render: (r) => onOutletDrilldown && (
      <DrilldownButton
        colors={colors}
        label="Outlet"
        onClick={() => onOutletDrilldown({
          outletCode: r.outletCode,
          outletName: r.outletName,
          salesLabel: r.salesName,
        })}
      />
    ) },
  ];

  return (
    <div>
      <DataTable
        colors={colors}
        columns={columns}
        rows={visibleRows}
        initialSortKey="date"
        searchable
        searchKeys={["date", "salesName", "outletName", "productName", "invoiceNo"]}
        searchPlaceholder="Cari tanggal, sales, outlet, produk, atau no invoice..."
      />
      {hasMore && (
        <div className="text-center mt-4">
          <button
            onClick={() => setVisibleCount((c) => c + INCREMENT)}
            className="sm-btn inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold"
            style={{ background: colors.surface2, color: colors.text, border: `1px solid ${colors.border}` }}
          >
            <ChevronDown size={14} /> Muat lebih banyak ({fmtNum(rows.length - visibleCount)} baris tersisa)
          </button>
          <div className="text-xs mt-2" style={{ color: colors.textMuted }}>
            Menampilkan {fmtNum(visibleCount)} dari {fmtNum(rows.length)} baris
          </div>
        </div>
      )}
    </div>
  );
}
