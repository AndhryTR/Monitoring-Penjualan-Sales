import {
  ClipboardList, FileSpreadsheet, XCircle, Copy, CalendarDays,
  FileQuestion, CheckCircle2, AlertTriangle, Users, Package,
} from "lucide-react";
import { fmtRp, fmtNum } from "../utils/formatters.js";
import { FIELD_LABELS } from "../constants/aliases.js";
import { KpiCard } from "../components/KpiCard.jsx";
import { DataTable } from "../components/ui/DataTable.jsx";
import { SectionTitle, DrilldownButton } from "../components/ui/index.jsx";

/* ============================================================================
   TAB: CATATAN DATA
   Ringkasan kualitas data dari seluruh file yang diupload (tidak terpengaruh
   filter). Menampilkan: jumlah baris, duplikat, kolom tidak terdeteksi, sales
   tidak dikenali, grup tidak dikenali, produk tidak bisa dikonversi ke KARTON.
============================================================================ */
export function DataQualityPage({ notes, colors, onDrilldown }) {
  const hasIssues = notes.missingFields.length || notes.unknownSales.length || notes.unconvertibleProducts.length ||
    notes.unknownGroups.length || notes.skippedBlankRows > 0 || notes.rowsWithMissingDate > 0 || notes.duplicateRowsRemoved > 0;

  return (
    <div className="sm-fadein">
      <SectionTitle title="Catatan Data" sub="Ringkasan kualitas data dari seluruh file yang diupload (tidak terpengaruh filter)" icon={ClipboardList} colors={colors} />

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
        <KpiCard label="Total Baris Terbaca" value={notes.totalDataRows} icon={FileSpreadsheet} accent={colors.blue} colors={colors} />
        <KpiCard label="Baris Dilewati (Kosong)" value={notes.skippedBlankRows} icon={XCircle} accent={colors.textMuted} colors={colors} />
        <KpiCard label="Duplikat Dihapus" value={notes.duplicateRowsRemoved} icon={Copy} accent={notes.duplicateRowsRemoved > 0 ? colors.gold : colors.textMuted} colors={colors} />
        <KpiCard label="Tanggal Tidak Terbaca" value={notes.rowsWithMissingDate} icon={CalendarDays} accent={notes.rowsWithMissingDate > 0 ? colors.coral : colors.textMuted} colors={colors} />
        <KpiCard label="Kolom Tidak Terdeteksi" value={notes.missingFields.length} icon={FileQuestion} accent={notes.missingFields.length > 0 ? colors.coral : colors.textMuted} colors={colors} />
      </div>

      {!hasIssues && (
        <div className="sm-card p-8 text-center mb-6">
          <CheckCircle2 size={28} className="mx-auto mb-2" style={{ color: colors.mint }} />
          <div className="font-semibold mb-1">Tidak ada masalah kualitas data terdeteksi</div>
          <p className="text-sm" style={{ color: colors.textMuted }}>Semua kolom terbaca dan cocok dengan konfigurasi Target saat ini.</p>
        </div>
      )}

      {notes.missingFields.length > 0 && (
        <div className="sm-card p-5 mb-6">
          <SectionTitle title="Kolom Tidak Terdeteksi" sub="Nama kolom di file tidak cocok dengan alias yang dikenali aplikasi" icon={FileQuestion} colors={colors} />
          <div className="flex flex-wrap gap-2">
            {notes.missingFields.map((f) => (
              <span key={f} className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs" style={{ background: colors.coral + "1A", color: colors.coral }}>
                <XCircle size={12} /> {FIELD_LABELS[f] || f}
              </span>
            ))}
          </div>
        </div>
      )}

      {notes.unknownSales.length > 0 && (
        <div className="mb-8">
          <SectionTitle title="Kode Sales Tidak Dikenali" sub="Ada di data, tapi tidak cocok dengan konfigurasi Target — transaksinya tidak ikut dihitung di dashboard manapun" icon={Users} colors={colors} />
          <DataTable
            colors={colors}
            initialSortKey="value"
            columns={[
              { key: "salesCode", label: "Kode Sales" },
              { key: "salesName", label: "Nama (di data)" },
              { key: "rowCount", label: "Jumlah Baris", render: (r) => <span className="mono">{fmtNum(r.rowCount)}</span> },
              { key: "value", label: "Total Value", render: (r) => <span className="mono">{fmtRp(r.value)}</span> },
              { key: "_drilldown", label: "", render: (r) => onDrilldown && <DrilldownButton colors={colors} onClick={() => onDrilldown(r.salesCode, "Outlet", (row) => row.salesCode === r.salesCode)} /> },
            ]}
            rows={notes.unknownSales}
          />
        </div>
      )}

      {notes.unknownGroups.length > 0 && (
        <div className="mb-8">
          <SectionTitle title="Grup Produk Tidak Dikenali" sub="Ada di data untuk sales tsb, tapi tidak ada di daftar grup produk sales itu pada konfigurasi Target" icon={Package} colors={colors} />
          <DataTable
            colors={colors}
            initialSortKey="value"
            columns={[
              { key: "salesName", label: "Sales" },
              { key: "group", label: "Grup Produk" },
              { key: "rowCount", label: "Jumlah Baris", render: (r) => <span className="mono">{fmtNum(r.rowCount)}</span> },
              { key: "value", label: "Total Value", render: (r) => <span className="mono">{fmtRp(r.value)}</span> },
              { key: "_drilldown", label: "", render: (r) => onDrilldown && <DrilldownButton colors={colors} onClick={() => onDrilldown(`${r.salesName} — ${r.group}`, "Outlet", (row) => row.salesCode === r.salesCode && row.group === r.group)} /> },
            ]}
            rows={notes.unknownGroups}
          />
        </div>
      )}

      {notes.unconvertibleProducts.length > 0 && (
        <div className="mb-8">
          <SectionTitle title="Produk Tidak Bisa Dikonversi ke KARTON" sub="Tidak ada baris bersatuan KARTON untuk produk ini di data, jadi angkanya memakai satuan asli" icon={AlertTriangle} colors={colors} />
          <DataTable
            colors={colors}
            initialSortKey="rowCount"
            columns={[
              { key: "productName", label: "Nama Produk" },
              { key: "unit", label: "Satuan Asli" },
              { key: "rowCount", label: "Jumlah Baris", render: (r) => <span className="mono">{fmtNum(r.rowCount)}</span> },
              { key: "qty", label: "Total Qty", render: (r) => <span className="mono">{fmtNum(r.qty)}</span> },
            ]}
            rows={notes.unconvertibleProducts}
          />
        </div>
      )}
    </div>
  );
}
