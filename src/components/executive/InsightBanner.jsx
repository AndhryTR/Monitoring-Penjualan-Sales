import { useState, useMemo } from "react";
import {
  BellRing, AlertTriangle, CheckCircle2, Users, Package, FileQuestion,
  ChevronRight, ChevronDown, X, ShieldAlert, Copy,
} from "lucide-react";

/* ============================================================================
   INSIGHT BANNER — REDESIGN (Sprint 14)
   ⚠️ Sebelumnya: semua isu ditampilkan flat dalam 1 list panjang tanpa
   prioritas. User bisa kewalahan kalau banyak alerts + data quality issues
   campur jadi satu.

   Improvements:
   1. Priority levels: critical (coral) > warning (gold) > info (blue)
   2. Critical issues selalu tampil; warning/info di-collapse (expand on click)
   3. Summary badge di header: "X critical · Y warning"
   4. Setiap kategori pakai card terpisah dengan icon + count badge
   5. Alert items (sales/fokus 0%) collapsible dengan badge count
   6. Dismiss per kategori — user bisa sembunyikan isu yang sudah aware
   7. Font lebih besar (text-sm bukan text-xs), spacing lebih lega

   Props tetap sama (backward compatible):
   - alerts, dataQualityNotes, colors, onNavigate, onDrilldown
============================================================================ */

// Severity levels untuk prioritas visual
const SEVERITY = {
  critical: { color: "coral", label: "Kritis" },
  warning: { color: "gold", label: "Peringatan" },
  info: { color: "blue", label: "Info" },
};

export function InsightBanner({ alerts, dataQualityNotes, colors, onNavigate, onDrilldown }) {
  const [alertsExpanded, setAlertsExpanded] = useState(false);
  // ⚠️ Sprint 14 / IB2: dismiss state per kategori — user bisa sembunyikan
  // isu yang sudah aware. State lokal (tidak persist) — reset saat reload.
  const [dismissed, setDismissed] = useState({});

  const alertCount = alerts?.length ?? 0;
  const unknownSalesCount = dataQualityNotes?.unknownSales?.length ?? 0;
  const missingFieldsCount = dataQualityNotes?.missingFields?.length ?? 0;
  const unconvertibleCount = dataQualityNotes?.unconvertibleProducts?.length ?? 0;
  const unknownGroupsCount = dataQualityNotes?.unknownGroups?.length ?? 0;
  const duplicateCount = dataQualityNotes?.duplicateRowsRemoved ?? 0;

  // Build issue categories dengan severity
  const categories = useMemo(() => {
    const cats = [];

    // Critical: sales/produk belum ada realisasi (alert)
    if (alertCount > 0 && !dismissed.alerts) {
      cats.push({
        key: "alerts",
        severity: "critical",
        icon: BellRing,
        label: "Sales/Produk Belum Ada Realisasi",
        count: alertCount,
        sublabel: "Sales atau produk fokus yang realisasinya masih 0 padahal sudah lewat beberapa hari kerja",
        expandable: true,
        onClick: () => setAlertsExpanded((v) => !v),
        expanded: alertsExpanded,
      });
    }

    // Critical: kolom tidak terdeteksi
    if (missingFieldsCount > 0 && !dismissed.missingFields) {
      cats.push({
        key: "missingFields",
        severity: "critical",
        icon: FileQuestion,
        label: "Kolom Tidak Terdeteksi",
        count: missingFieldsCount,
        sublabel: "Nama kolom di file tidak cocok dengan alias yang dikenali aplikasi",
        ctaLabel: "Cek Data",
        onClick: () => onNavigate?.("quality"),
      });
    }

    // Warning: sales tidak dikenal
    if (unknownSalesCount > 0 && !dismissed.unknownSales) {
      cats.push({
        key: "unknownSales",
        severity: "warning",
        icon: Users,
        label: "Kode Sales Tidak Dikenal",
        count: unknownSalesCount,
        sublabel: "Ada di data tapi tidak cocok dengan konfigurasi Target — transaksinya tidak dihitung",
        ctaLabel: "Cek Data",
        onClick: () => onNavigate?.("quality"),
      });
    }

    // Warning: grup tidak dikenal
    if (unknownGroupsCount > 0 && !dismissed.unknownGroups) {
      cats.push({
        key: "unknownGroups",
        severity: "warning",
        icon: Package,
        label: "Grup Produk Tidak Dikenal",
        count: unknownGroupsCount,
        sublabel: "Ada di data tapi tidak ada di daftar grup produk sales itu",
        ctaLabel: "Cek Data",
        onClick: () => onNavigate?.("quality"),
      });
    }

    // Warning: produk tidak konversi
    if (unconvertibleCount > 0 && !dismissed.unconvertible) {
      cats.push({
        key: "unconvertible",
        severity: "warning",
        icon: AlertTriangle,
        label: "Produk Tidak Bisa Dikonversi ke KARTON",
        count: unconvertibleCount,
        sublabel: "Tidak ada baris bersatuan KARTON untuk produk ini",
        ctaLabel: "Detail",
        onClick: () => onNavigate?.("quality"),
      });
    }

    // Info: duplikat dihapus
    if (duplicateCount > 0 && !dismissed.duplicate) {
      cats.push({
        key: "duplicate",
        severity: "info",
        icon: Copy,
        label: "Duplikat Dihapus",
        count: duplicateCount,
        sublabel: "Baris duplikat otomatis dihapus saat upload",
        ctaLabel: "Detail",
        onClick: () => onNavigate?.("quality"),
      });
    }

    return cats;
  }, [alertCount, missingFieldsCount, unknownSalesCount, unknownGroupsCount, unconvertibleCount, duplicateCount, dismissed, alertsExpanded, onNavigate]);

  const criticalCount = categories.filter((c) => c.severity === "critical").length;
  const warningCount = categories.filter((c) => c.severity === "warning").length;
  const infoCount = categories.filter((c) => c.severity === "info").length;
  const totalVisible = categories.length;

  // Dismiss handler
  const handleDismiss = (key) => {
    setDismissed((prev) => ({ ...prev, [key]: true }));
  };

  // All clear state
  if (totalVisible === 0) {
    return (
      <div className="sm-card p-4 sm-fadeup flex items-center gap-3" style={{ borderColor: `${colors.mint}44`, background: `${colors.mint}08` }}>
        <div className="p-2 rounded-lg shrink-0" style={{ background: `${colors.mint}1A` }}>
          <CheckCircle2 size={16} style={{ color: colors.mint }} />
        </div>
        <div className="flex-1">
          <div className="text-sm font-semibold" style={{ color: colors.mint }}>Semua dalam kondisi baik</div>
          <div className="text-xs" style={{ color: colors.textMuted }}>
            Tidak ada isu atau peringatan pada data saat ini.
          </div>
        </div>
        <ShieldAlert size={16} style={{ color: colors.mint, opacity: 0.3 }} />
      </div>
    );
  }

  return (
    <div className="sm-card p-4 sm-fadeup" style={{ borderColor: criticalCount > 0 ? `${colors.coral}44` : `${colors.gold}44`, background: criticalCount > 0 ? `${colors.coral}06` : `${colors.gold}06` }}>
      {/* Header dengan summary badges */}
      <div className="flex items-center gap-2.5 mb-3">
        <div className="p-2 rounded-lg shrink-0" style={{ background: criticalCount > 0 ? `${colors.coral}1A` : `${colors.gold}1A` }}>
          {criticalCount > 0 ? <BellRing size={16} style={{ color: colors.coral }} /> : <AlertTriangle size={16} style={{ color: colors.gold }} />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold" style={{ color: colors.text }}>
            {criticalCount > 0 ? `${criticalCount} isu kritis` : `${warningCount + infoCount} isu terdeteksi`}
          </div>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            {criticalCount > 0 && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: colors.coral + "1A", color: colors.coral }}>
                {criticalCount} KRITIS
              </span>
            )}
            {warningCount > 0 && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: colors.gold + "1A", color: colors.gold }}>
                {warningCount} PERINGATAN
              </span>
            )}
            {infoCount > 0 && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: colors.blue + "1A", color: colors.blue }}>
                {infoCount} INFO
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Issue categories */}
      <div className="space-y-2">
        {categories.map((cat) => {
          const Icon = cat.icon;
          const sevColor = colors[SEVERITY[cat.severity].color];

          return (
            <div
              key={cat.key}
              className="rounded-lg overflow-hidden"
              style={{ background: sevColor + "08", border: `1px solid ${sevColor}22` }}
            >
              {/* Row header */}
              <div
                className="flex items-center gap-2.5 px-3 py-2.5 cursor-pointer"
                onClick={cat.onClick}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === "Enter" && cat.onClick?.()}
              >
                <div className="p-1.5 rounded-lg shrink-0" style={{ background: sevColor + "1A" }}>
                  <Icon size={14} style={{ color: sevColor }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium" style={{ color: colors.text }}>{cat.label}</span>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: sevColor + "1A", color: sevColor }}>
                      {cat.count}
                    </span>
                  </div>
                  <div className="text-xs mt-0.5 truncate" style={{ color: colors.textMuted }}>{cat.sublabel}</div>
                </div>

                {/* CTA or expand/collapse */}
                {cat.ctaLabel && (
                  <span className="text-xs font-semibold shrink-0 flex items-center gap-0.5" style={{ color: sevColor }}>
                    {cat.ctaLabel} <ChevronRight size={12} />
                  </span>
                )}
                {cat.expandable && (
                  <ChevronDown
                    size={14}
                    className="shrink-0"
                    style={{ color: colors.textMuted, transform: cat.expanded ? "rotate(180deg)" : "none", transition: "transform .2s" }}
                  />
                )}

                {/* Dismiss button */}
                <button
                  onClick={(e) => { e.stopPropagation(); handleDismiss(cat.key); }}
                  className="sm-btn p-1 rounded-md shrink-0"
                  style={{ color: colors.textMuted, background: "transparent" }}
                  title="Sembunyikan isu ini"
                  aria-label={`Sembunyikan ${cat.label}`}
                >
                  <X size={12} />
                </button>
              </div>

              {/* Expandable content (untuk alerts) */}
              {cat.expandable && cat.expanded && alerts && (
                <div className="px-3 pb-3 space-y-1.5" style={{ borderTop: `1px solid ${sevColor}22` }}>
                  {alerts.map((a) => (
                    <div
                      key={a.title + "|" + a.message}
                      className="flex items-center gap-3 px-3 py-2 rounded-lg mt-2"
                      style={{ background: colors.glassFill }}
                    >
                      <AlertTriangle size={13} style={{ color: colors.coral, flexShrink: 0 }} />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate" style={{ color: colors.text }}>{a.title}</div>
                        <div className="text-xs" style={{ color: colors.textMuted }}>{a.message}</div>
                      </div>
                      {onDrilldown && (
                        <button
                          onClick={() => onDrilldown(a.title, a.message, a.predicate)}
                          className="sm-btn text-xs font-semibold shrink-0 px-2.5 py-1 rounded-md"
                          style={{ color: colors.coral, background: `${colors.coral}14` }}
                        >
                          Detail
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
