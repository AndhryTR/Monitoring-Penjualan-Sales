import { fmtRp, fmtNum } from "../../utils/formatters.js";
import { DataTable } from "../ui/DataTable.jsx";
import { DrilldownButton } from "../ui/index.jsx";
import { TABLE_PAGE_SIZE } from "../../constants/thresholds.js";

/* ============================================================================
   TRANSACTION TABLE — REDESIGN (Sprint 12)
   ⚠️ Sebelumnya: font text-xs (12px) cramped, tidak ada pagination info.
   Sekarang: font text-sm (14px), kolom lebih readable, dan DataTable sudah
   punya pagination info bawaan.

   Columns dipertahankan sama, tapi render function pakai text-sm bukan text-xs.
============================================================================ */

const PAGE_SIZE = TABLE_PAGE_SIZE;

export function TransactionTable({ rows, colors, onOutletDrilldown }) {
  const columns = [
    { key: "date", label: "Tanggal", render: (r) => (
      <span className="mono text-sm">{r.date || "-"}</span>
    ) },
    { key: "salesName", label: "Sales", render: (r) => (
      <span className="text-sm">{r.salesName || "-"}</span>
    ) },
    { key: "outletName", label: "Outlet", render: (r) => (
      <span className="text-sm truncate inline-block max-w-[160px]" title={r.outletName}>{r.outletName || "-"}</span>
    ) },
    { key: "productName", label: "Produk", render: (r) => (
      <span className="text-sm truncate inline-block max-w-[180px]" title={r.productName}>{r.productName || "-"}</span>
    ) },
    { key: "group", label: "Grup", render: (r) => (
      <span className="text-sm" style={{ color: colors.textMuted }}>{r.group || "-"}</span>
    ) },
    { key: "qty", label: "Qty", render: (r) => (
      <span className="mono text-sm">
        {fmtNum(r.qty)} <span style={{ color: colors.textMuted, fontSize: 11 }}>{r.unit}</span>
      </span>
    ) },
    { key: "qtyKarton", label: "Karton", render: (r) => (
      r.unconvertible ? (
        <span className="mono text-sm" style={{ color: colors.textMuted }} title="Tidak bisa dikonversi ke KARTON">—</span>
      ) : (
        <span className="mono text-sm">{fmtNum(r.qtyKarton)}</span>
      )
    ) },
    { key: "value", label: "Value", render: (r) => (
      <span className="mono text-sm font-semibold">{fmtRp(r.value)}</span>
    ) },
    { key: "invoiceNo", label: "Invoice", render: (r) => (
      <span className="mono text-sm" style={{ color: colors.textMuted }}>{r.invoiceNo || "-"}</span>
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
      rowKey={(r, i) => `${r.date}|${r.invoiceNo}|${r.productCode}|${i}`}
      columns={columns}
      rows={rows}
      pageSize={PAGE_SIZE}
      initialSortKey="date"
      searchable
      searchKeys={["date", "salesName", "outletName", "productName", "invoiceNo"]}
      searchPlaceholder="Cari tanggal, sales, outlet, produk, atau no invoice..."
      mobileTitleKey="outletName"
      mobileSubtitleKey="productName"
      mobileCornerKey="date"
    />
  );
}
