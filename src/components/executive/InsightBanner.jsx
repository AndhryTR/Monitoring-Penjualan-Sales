import { BellRing, AlertTriangle, CheckCircle2, Users, Package, FileQuestion, ChevronRight } from "lucide-react";

/* ============================================================================
   InsightBanner — Banner terintegrasi yang menggabungkan alerts (sales/fokus 0%),
   data quality issues (unknown sales, missing columns, unconvertible products),
   dan navigasi cepat ke tab terkait.

   Props:
     alerts             — agg.alerts (dari computeAggregates)
     dataQualityNotes   — dari useDataQualityNotes()
     colors             — theme colors
     onNavigate         — callback(tabKey) untuk navigasi cepat
============================================================================ */

export function InsightBanner({ alerts, dataQualityNotes, colors, onNavigate }) {
  const alertCount = alerts.length;
  const unknownSalesCount = dataQualityNotes?.unknownSales?.length ?? 0;
  const missingFieldsCount = dataQualityNotes?.missingFields?.length ?? 0;
  const unconvertibleCount = dataQualityNotes?.unconvertibleProducts?.length ?? 0;
  const unknownGroupsCount = dataQualityNotes?.unknownGroups?.length ?? 0;
  const duplicateCount = dataQualityNotes?.duplicateRowsRemoved ?? 0;
  const totalIssues = alertCount + unknownSalesCount + missingFieldsCount + unconvertibleCount + unknownGroupsCount + (duplicateCount > 0 ? 1 : 0);

  if (totalIssues === 0) {
    return (
      <div className="sm-card p-4 sm-fadeup flex items-center gap-3" style={{ borderColor: `${colors.mint}44`, background: `${colors.mint}08` }}>
        <div className="p-2 rounded-lg shrink-0" style={{ background: `${colors.mint}1A` }}>
          <CheckCircle2 size={16} style={{ color: colors.mint }} />
        </div>
        <div>
          <div className="text-sm font-semibold" style={{ color: colors.mint }}>Semua dalam kondisi baik</div>
          <div className="text-xs" style={{ color: colors.textMuted }}>
            Tidak ada issues atau peringatan pada data saat ini.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="sm-card p-4 sm-fadeup" style={{ borderColor: alertCount > 0 ? `${colors.coral}44` : `${colors.gold}44`, background: alertCount > 0 ? `${colors.coral}06` : `${colors.gold}06` }}>
      {/* Header */}
      <div className="flex items-center gap-2.5 mb-3">
        <div className="p-2 rounded-lg shrink-0" style={{ background: alertCount > 0 ? `${colors.coral}1A` : `${colors.gold}1A` }}>
          {alertCount > 0 ? <BellRing size={16} style={{ color: colors.coral }} /> : <AlertTriangle size={16} style={{ color: colors.gold }} />}
        </div>
        <div className="text-sm font-semibold" style={{ color: colors.text }}>
          {alertCount > 0
            ? `${alertCount} item perlu perhatian`
            : `${totalIssues} isu data terdeteksi`}
        </div>
      </div>

      {/* Issues list */}
      <div className="space-y-1.5">
        {alertCount > 0 && (
          <IssueRow
            icon={BellRing}
            color={colors.coral}
            label={`${alertCount} sales/produk belum ada realisasi`}
            onClick={() => onNavigate?.("sales")}
            colors={colors}
            cta="Lihat Sales"
          />
        )}
        {unknownSalesCount > 0 && (
          <IssueRow
            icon={Users}
            color={colors.gold}
            label={`${unknownSalesCount} kode sales tidak dikenal dalam data`}
            onClick={() => onNavigate?.("quality")}
            colors={colors}
            cta="Cek Data"
          />
        )}
        {unknownGroupsCount > 0 && (
          <IssueRow
            icon={Package}
            color={colors.gold}
            label={`${unknownGroupsCount} grup produk tidak dikenal`}
            onClick={() => onNavigate?.("quality")}
            colors={colors}
            cta="Cek Data"
          />
        )}
        {missingFieldsCount > 0 && (
          <IssueRow
            icon={FileQuestion}
            color={colors.coral}
            label={`${missingFieldsCount} kolom tidak terdeteksi dari file`}
            onClick={() => onNavigate?.("quality")}
            colors={colors}
            cta="Cek Data"
          />
        )}
        {unconvertibleCount > 0 && (
          <IssueRow
            icon={AlertTriangle}
            color={colors.gold}
            label={`${unconvertibleCount} produk tidak bisa dikonversi ke KARTON`}
            onClick={() => onNavigate?.("quality")}
            colors={colors}
            cta="Detail"
          />
        )}
        {duplicateCount > 0 && (
          <IssueRow
            icon={AlertTriangle}
            color={colors.gold}
            label={`${duplicateCount} baris duplikat telah dihapus`}
            onClick={() => onNavigate?.("quality")}
            colors={colors}
            cta="Detail"
          />
        )}
      </div>
    </div>
  );
}

function IssueRow({ icon: Icon, color, label, onClick, colors, cta }) {
  return (
    <div
      className="sm-row flex items-center justify-between gap-2 px-3 py-2 rounded-lg cursor-pointer"
      style={{ background: `${color}08` }}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && onClick?.()}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <Icon size={13} className="shrink-0" style={{ color }} />
        <span className="text-xs truncate" style={{ color: colors.text }}>{label}</span>
      </div>
      <span className="text-[10px] font-semibold shrink-0 flex items-center gap-0.5" style={{ color }}>
        {cta} <ChevronRight size={11} />
      </span>
    </div>
  );
}
