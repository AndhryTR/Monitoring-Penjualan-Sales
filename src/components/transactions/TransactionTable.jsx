import { fmtRp, fmtNum } from "../../utils/formatters.js";
import { DataTable } from "../ui/DataTable.jsx";
import { DrilldownButton } from "../ui/index.jsx";

/* ============================================================================
   TRANSACTION TABLE
   Wrapper DataTable dengan columns khusus transaksi. Incremental load (500
   baris per klik "Muat lebih banyak") sekarang ditangani DI DALAM DataTable
   lewat prop pageSize — supaya search & sort tetap bekerja di SELURUH `rows`
   yang dikirim ke sini (hasil filter global+lokal), bukan cuma di baris yang
   kebetulan sudah "dimuat". Mobile: card-stack otomatis dari DataTable existing.
============================================================================ */

const PAGE_SIZE = 500;

export function TransactionTable({ rows, colors, onOutletDrilldown }) {
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
    <DataTable
      colors={colors}
      columns={columns}
      rows={rows}
      pageSize={PAGE_SIZE}
      initialSortKey="date"
      searchable
      searchKeys={["date", "salesName", "outletName", "productName", "invoiceNo"]}
      searchPlaceholder="Cari tanggal, sales, outlet, produk, atau no invoice..."
    />
  );
}
