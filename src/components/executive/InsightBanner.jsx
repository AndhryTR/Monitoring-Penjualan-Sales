import { useState } from "react";
import {
  BellRing, AlertTriangle, CheckCircle2, FileQuestion,
  ChevronRight, ChevronDown, X,
} from "lucide-react";

/* ============================================================================
   InsightBanner — banner alert di Main Report.

   ⚠️ Audit opsi A: HANYA menampilkan insight bisnis (sales/produk belum ada
   realisasi). Kategori teknis (kode sales tak dikenal, grup tak dikenal,
   produk tak konversi, duplikat, kolom hilang) TIDAK lagi tampil di sini —
   semuanya punya rumah sendiri di tab "Cek Data" (DataQualityPage) yang
   lebih lengkap (tabel detail + filter per kategori). Banner teknis penuh
   bikin Main Report ramai; cukup satu bar pengarah ke tab Cek Data.
============================================================================ */

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

  // Total isu teknis — direpresentasikan sebagai SATU bar pengarah ke Cek Data
  const techIssueCount =
    missingFieldsCount + unknownSalesCount + unknownGroupsCount + unconvertibleCount + duplicateCount;

  const hasAlerts = alertCount > 0 && !dismissed.alerts;

  // All clear state — tidak ada alert bisnis & tidak ada isu teknis
  if (!hasAlerts && techIssueCount === 0) {
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
      </div>
    );
  }

  return (
    <div className="sm-card p-4 sm-fadeup" style={{ borderColor: `${colors.coral}44`, background: `${colors.coral}06` }}>
      {/* ===== Alert bisnis: sales/fokus belum ada realisasi (collapsible) ===== */}
      {hasAlerts && (
        <>
          <div
            className="flex items-center gap-2.5 cursor-pointer"
            onClick={() => setAlertsExpanded((v) => !v)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === "Enter" && setAlertsExpanded((v) => !v)}
          >
            <div className="p-2 rounded-lg shrink-0" style={{ background: `${colors.coral}1A` }}>
              <BellRing size={16} style={{ color: colors.coral }} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold" style={{ color: colors.text }}>
                  Sales/Produk Belum Ada Realisasi
                </span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: colors.coral + "1A", color: colors.coral }}>
                  {alertCount}
                </span>
              </div>
              <div className="text-xs mt-0.5" style={{ color: colors.textMuted }}>
                Sales atau produk fokus yang realisasinya masih 0 padahal sudah lewat beberapa hari kerja
              </div>
            </div>
            <ChevronDown
              size={14}
              className="shrink-0"
              style={{ color: colors.textMuted, transform: alertsExpanded ? "rotate(180deg)" : "none", transition: "transform .2s" }}
            />
            {/* Dismiss button */}
            <button
              onClick={(e) => { e.stopPropagation(); setDismissed((prev) => ({ ...prev, alerts: true })); }}
              className="sm-btn p-1 rounded-md shrink-0"
              style={{ color: colors.textMuted, background: "transparent" }}
              title="Sembunyikan alert ini"
              aria-label="Sembunyikan alert realisasi"
            >
              <X size={12} />
            </button>
          </div>

          {/* Expandable content */}
          {alertsExpanded && alerts && (
            <div className="mt-2 space-y-1.5">
              {alerts.map((a) => (
                <div
                  key={a.title + "|" + a.message}
                  className="flex items-center gap-3 px-3 py-2 rounded-lg"
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
        </>
      )}

      {/* ===== Satu bar pengarah isu teknis → tab Cek Data ===== */}
      {techIssueCount > 0 && (
        <div
          className={"rounded-lg flex items-center gap-2.5 px-3 py-2.5 cursor-pointer" + (hasAlerts ? " mt-2" : "")}
          style={{ background: `${colors.gold}08`, border: `1px solid ${colors.gold}22` }}
          onClick={() => onNavigate?.("quality")}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === "Enter" && onNavigate?.("quality")}
        >
          <div className="p-1.5 rounded-lg shrink-0" style={{ background: `${colors.gold}1A` }}>
            <FileQuestion size={14} style={{ color: colors.gold }} />
          </div>
          <div className="flex-1 min-w-0">
            <span className="text-sm font-medium" style={{ color: colors.text }}>
              {techIssueCount} catatan kualitas data
            </span>
            <div className="text-xs mt-0.5 truncate" style={{ color: colors.textMuted }}>
              Kode/grup tidak dikenal, konversi karton, duplikat — lihat detail di tab Cek Data
            </div>
          </div>
          <span className="text-xs font-semibold shrink-0 flex items-center gap-0.5" style={{ color: colors.gold }}>
            Cek Data <ChevronRight size={12} />
          </span>
        </div>
      )}
    </div>
  );
}
