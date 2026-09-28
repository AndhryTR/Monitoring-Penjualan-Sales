import { useState, useRef, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  Bell, AlertCircle, AlertTriangle, Sparkles, CheckCircle2,
  X, RefreshCw, ChevronRight, Layers,
} from "lucide-react";
import { useScrollLock } from "../../hooks/useModalA11y.js";
import { useFloatingDropdown } from "../../hooks/useFloatingDropdown.js";
import { ALERT_LEVELS } from "../../utils/smartAlerts.js";

/* ============================================================================
   NOTIFICATION BELL & SMART ALERT CENTER (Fitur B2)
   
   Pusat notifikasi dan deteksi anomali penjualan di header navigasi utama.
   Mendukung penuh Tema Terang (Light Mode) & Tema Gelap (Dark Mode).
   - Trigger lonceng dengan dynamic badge counter & severity pulse.
   - Popover dropdown di desktop (portal ke document.body).
   - Bottom sheet drawer di mobile (portal ke document.body).
   - Tab filter severity: Semua, Kritis, Peringatan, Prestasi.
   - Kartu anomali dengan quick actions: Drilldown Outlet, Buka Tab, Dismiss.
============================================================================ */

export function NotificationBell({
  alerts = [],
  colors,
  onDrilldown,
  onNavigate,
  disabled = false,
}) {
  const [open, setOpen] = useState(false);
  const [activeFilter, setActiveFilter] = useState("all"); // "all" | "critical" | "warning" | "positive"
  const [dismissedIds, setDismissedIds] = useState(() => {
    try {
      const stored = localStorage.getItem("sm_dismissed_alerts");
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch {
      return new Set();
    }
  });
  const [dismissingId, setDismissingId] = useState(null);

  const sheetRef = useRef(null);

  const {
    triggerRef,
    floatingRef: dropdownRef,
    position: desktopDropdownPos,
  } = useFloatingDropdown({
    isOpen: open,
    onClose: () => setOpen(false),
    align: "right",
    width: 400,
    gap: 8,
    margin: 16,
    additionalRefs: [sheetRef],
  });

  // Status tema terang
  const isLight = colors?.colorScheme === "light";

  // Sinkronisasi dismissedIds ke localStorage
  const saveDismissed = useCallback((newSet) => {
    setDismissedIds(newSet);
    try {
      localStorage.setItem("sm_dismissed_alerts", JSON.stringify(Array.from(newSet)));
    } catch {
      // Ignore quota error
    }
  }, []);

  const handleDismiss = useCallback((id, e) => {
    e?.stopPropagation();
    setDismissingId(id);
    setTimeout(() => {
      setDismissedIds((prev) => {
        const next = new Set(prev);
        next.add(id);
        try {
          localStorage.setItem("sm_dismissed_alerts", JSON.stringify(Array.from(next)));
        } catch {
          // Ignore
        }
        return next;
      });
      setDismissingId((curr) => (curr === id ? null : curr));
    }, 280);
  }, []);

  const handleDismissAll = useCallback(() => {
    const next = new Set(dismissedIds);
    alerts.forEach((a) => next.add(a.id));
    saveDismissed(next);
  }, [alerts, dismissedIds, saveDismissed]);

  const handleResetDismissed = useCallback(() => {
    saveDismissed(new Set());
  }, [saveDismissed]);

  // Lock scroll background khusus saat mobile drawer terbuka
  useScrollLock(open && typeof window !== "undefined" && window.innerWidth < 768);

  // Pisahkan alert aktif (belum di-dismiss) dan ter-dismiss
  const activeAlerts = useMemo(() => {
    return alerts.filter((a) => !dismissedIds.has(a.id));
  }, [alerts, dismissedIds]);

  const dismissedCount = useMemo(() => {
    return alerts.filter((a) => dismissedIds.has(a.id)).length;
  }, [alerts, dismissedIds]);

  // Hitung metrik per kategori untuk tab & badge
  const counts = useMemo(() => {
    let critical = 0;
    let warning = 0;
    let positive = 0;

    activeAlerts.forEach((a) => {
      if (a.level === ALERT_LEVELS.CRITICAL) critical++;
      else if (a.level === ALERT_LEVELS.WARNING) warning++;
      else if (a.level === ALERT_LEVELS.POSITIVE) positive++;
    });

    return {
      total: activeAlerts.length,
      critical,
      warning,
      positive,
    };
  }, [activeAlerts]);

  // Filter alert yang tampil berdasarkan activeFilter
  const displayedAlerts = useMemo(() => {
    if (activeFilter === "all") return activeAlerts;
    return activeAlerts.filter((a) => a.level === activeFilter);
  }, [activeAlerts, activeFilter]);

  // Action handlers
  const handleDrilldown = (alert) => {
    if (onDrilldown && alert.predicate) {
      onDrilldown(alert.salesName || alert.title, "Outlet", alert.predicate);
      setOpen(false);
    }
  };

  const handleNavigate = (tab) => {
    if (onNavigate && tab) {
      onNavigate(tab);
      setOpen(false);
    }
  };

  const hasCritical = counts.critical > 0;
  const hasWarning = counts.warning > 0;

  // Warna aksen badge
  const badgeBg = hasCritical ? colors.coral : hasWarning ? colors.gold : colors.mint;

  // Token pembatas dan background yang adaptif terhadap tema
  const dividerBorder = isLight ? "rgba(0,0,0,0.09)" : "rgba(255,255,255,0.09)";
  const headerIconBg = isLight
    ? hasCritical ? "#FEE2E2" : hasWarning ? "#FEF3C7" : "#D1FAE5"
    : hasCritical ? `${colors.coral}22` : hasWarning ? `${colors.gold}22` : `${colors.mint}22`;

  return (
    <>
      {/* Trigger Button */}
      <button
        ref={triggerRef}
        onClick={() => setOpen((v) => !v)}
        disabled={disabled}
        className="sm-btn w-9 h-9 rounded-xl relative flex items-center justify-center transition-all disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
        style={{
          background: open ? (isLight ? `${colors.gold}22` : `${colors.gold}1F`) : colors.glassFill,
          color: hasCritical ? colors.coral : hasWarning ? colors.gold : colors.text,
          border: `1px solid ${open ? colors.gold + "88" : colors.glassBorder}`,
        }}
        aria-label={`Notifikasi & Smart Alert (${counts.total} aktif)`}
        title={`Notifikasi & Smart Alert (${counts.total} aktif)`}
      >
        <Bell size={15} className={hasCritical ? "sm-bell-ring" : ""} />

        {/* Dynamic Badge Counter */}
        {counts.total > 0 && (
          <span
            key={counts.total}
            className={`absolute -top-1 -right-1 min-w-[17px] h-[17px] px-1 text-[10px] font-bold rounded-full flex items-center justify-center text-white sm-badge-pop ${
              hasCritical ? "animate-pulse" : ""
            }`}
            style={{
              background: badgeBg,
              boxShadow: `0 0 8px ${hasCritical ? colors.coral + "88" : colors.gold + "55"}`,
            }}
          >
            {counts.total > 99 ? "99+" : counts.total}
          </span>
        )}
      </button>

      {/* Popover / Drawer via Portal ke document.body */}
      {open &&
        createPortal(
          <>
            {/* Backdrop Mobile */}
            <div
              className="md:hidden"
              style={{
                position: "fixed",
                inset: 0,
                zIndex: 80,
                background: "rgba(0,0,0,0.5)",
                backdropFilter: "blur(4px)",
                WebkitBackdropFilter: "blur(4px)",
              }}
              onClick={() => setOpen(false)}
            />

            {/* Container Dialog: Desktop Dropdown + Mobile Bottom Sheet */}
            <div
              ref={(node) => {
                dropdownRef.current = node;
                sheetRef.current = node;
              }}
              className="sm-slide-up md:sm-dropdown-pop"
              style={{
                position: "fixed",
                zIndex: 85,
                color: colors.text,
                ...(typeof window !== "undefined" && window.innerWidth < 768
                  ? {
                      left: 0,
                      right: 0,
                      bottom: 0,
                      maxHeight: "85vh",
                      borderTopLeftRadius: "20px",
                      borderTopRightRadius: "20px",
                    }
                  : {
                      top: desktopDropdownPos.top,
                      left: desktopDropdownPos.left,
                      width: "400px",
                      maxHeight: "560px",
                      borderRadius: "16px",
                    }),
                background: isLight
                  ? (colors.dropdownBg || "rgba(255, 255, 255, 0.96)")
                  : `radial-gradient(120% 60% at 15% -5%, ${colors.glassSheen || "rgba(255,255,255,0.10)"}, transparent 55%), ${colors.dropdownBg || "rgba(17, 24, 39, 0.96)"}`,
                border: `1px solid ${isLight ? (colors.dropdownBorder || "rgba(0,0,0,0.10)") : (colors.dropdownBorder || "rgba(255,255,255,0.14)")}`,
                boxShadow: isLight
                  ? "0 20px 48px -10px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.06)"
                  : "0 20px 48px -10px rgba(0,0,0,0.65), inset 0 1px 0 rgba(255,255,255,0.08)",
                backdropFilter: "blur(32px) saturate(1.4)",
                WebkitBackdropFilter: "blur(32px) saturate(1.4)",
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
              }}
            >
              {/* Mobile drag handle */}
              <div className="md:hidden pt-2.5 pb-0">
                <div className="sm-bottom-sheet-handle" />
              </div>

              {/* Header Panel */}
              <div
                className="p-3.5 flex items-center justify-between gap-3 border-b"
                style={{ borderColor: dividerBorder }}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className="p-2 rounded-lg shrink-0"
                    style={{ background: headerIconBg }}
                  >
                    <Bell
                      size={15}
                      style={{
                        color: hasCritical
                          ? colors.coral
                          : hasWarning
                          ? colors.gold
                          : colors.mint,
                      }}
                    />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold truncate" style={{ color: colors.text }}>
                        Smart Alert & Anomali
                      </span>
                      {counts.total > 0 && (
                        <span
                          className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                          style={{
                            background: isLight ? `${badgeBg}1A` : `${badgeBg}26`,
                            color: badgeBg,
                            border: isLight ? `1px solid ${badgeBg}33` : "none",
                          }}
                        >
                          {counts.total} Baru
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] truncate mt-0.5" style={{ color: colors.textMuted }}>
                      Monitoring performa & aktivitas otomatis
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  {counts.total > 0 && (
                    <button
                      onClick={handleDismissAll}
                      className="sm-btn text-[11px] px-2 py-1 rounded-md font-medium transition-colors"
                      style={{
                        background: isLight ? "#F3F4F6" : colors.glassFill,
                        color: isLight ? "#374151" : colors.textMuted,
                        border: `1px solid ${isLight ? "#E5E7EB" : colors.glassBorder}`,
                      }}
                      title="Sembunyikan semua alert aktif saat ini"
                    >
                      Tandai Dibaca
                    </button>
                  )}
                  <button
                    onClick={() => setOpen(false)}
                    className="sm-btn p-1.5 rounded-md transition-colors"
                    style={{ color: colors.textMuted, background: "transparent" }}
                    aria-label="Tutup panel notifikasi"
                  >
                    <X size={15} />
                  </button>
                </div>
              </div>

              {/* Filter Tabs / Chips */}
              <div
                className="px-3 py-2 flex items-center gap-1.5 overflow-x-auto border-b text-xs"
                style={{
                  borderColor: dividerBorder,
                  background: isLight ? "rgba(0,0,0,0.02)" : "rgba(255,255,255,0.02)",
                  scrollbarWidth: "none",
                }}
              >
                <button
                  onClick={() => setActiveFilter("all")}
                  className="px-2.5 py-1 rounded-lg font-medium transition-all shrink-0 flex items-center gap-1.5"
                  style={{
                    background: activeFilter === "all" ? (isLight ? "#FEF3C7" : `${colors.gold}22`) : "transparent",
                    color: activeFilter === "all" ? (isLight ? "#92400E" : colors.gold) : colors.textMuted,
                    border: `1px solid ${activeFilter === "all" ? (isLight ? "#FCD34D" : colors.gold + "55") : "transparent"}`,
                  }}
                >
                  <span>Semua</span>
                  <span className="text-[10px] opacity-80 font-semibold">({counts.total})</span>
                </button>

                <button
                  onClick={() => setActiveFilter(ALERT_LEVELS.CRITICAL)}
                  className="px-2.5 py-1 rounded-lg font-medium transition-all shrink-0 flex items-center gap-1.5"
                  style={{
                    background:
                      activeFilter === ALERT_LEVELS.CRITICAL
                        ? isLight ? "#FEE2E2" : `${colors.coral}22`
                        : "transparent",
                    color:
                      activeFilter === ALERT_LEVELS.CRITICAL
                        ? isLight ? "#B91C1C" : colors.coral
                        : colors.textMuted,
                    border: `1px solid ${
                      activeFilter === ALERT_LEVELS.CRITICAL
                        ? isLight ? "#FCA5A5" : colors.coral + "55"
                        : "transparent"
                    }`,
                  }}
                >
                  <span>🚨 Kritis</span>
                  <span className="text-[10px] opacity-80 font-semibold">({counts.critical})</span>
                </button>

                <button
                  onClick={() => setActiveFilter(ALERT_LEVELS.WARNING)}
                  className="px-2.5 py-1 rounded-lg font-medium transition-all shrink-0 flex items-center gap-1.5"
                  style={{
                    background:
                      activeFilter === ALERT_LEVELS.WARNING
                        ? isLight ? "#FEF3C7" : `${colors.gold}22`
                        : "transparent",
                    color:
                      activeFilter === ALERT_LEVELS.WARNING
                        ? isLight ? "#92400E" : colors.gold
                        : colors.textMuted,
                    border: `1px solid ${
                      activeFilter === ALERT_LEVELS.WARNING
                        ? isLight ? "#FCD34D" : colors.gold + "55"
                        : "transparent"
                    }`,
                  }}
                >
                  <span>⚠️ Peringatan</span>
                  <span className="text-[10px] opacity-80 font-semibold">({counts.warning})</span>
                </button>

                <button
                  onClick={() => setActiveFilter(ALERT_LEVELS.POSITIVE)}
                  className="px-2.5 py-1 rounded-lg font-medium transition-all shrink-0 flex items-center gap-1.5"
                  style={{
                    background:
                      activeFilter === ALERT_LEVELS.POSITIVE
                        ? isLight ? "#D1FAE5" : `${colors.mint}22`
                        : "transparent",
                    color:
                      activeFilter === ALERT_LEVELS.POSITIVE
                        ? isLight ? "#047857" : colors.mint
                        : colors.textMuted,
                    border: `1px solid ${
                      activeFilter === ALERT_LEVELS.POSITIVE
                        ? isLight ? "#6EE7B7" : colors.mint + "55"
                        : "transparent"
                    }`,
                  }}
                >
                  <span>🌟 Prestasi</span>
                  <span className="text-[10px] opacity-80 font-semibold">({counts.positive})</span>
                </button>
              </div>

              {/* List Notifikasi */}
              <div
                className="flex-1 overflow-y-auto p-3 space-y-2.5"
                style={{
                  maxHeight:
                    typeof window !== "undefined" && window.innerWidth < 768 ? "60vh" : "400px",
                }}
              >
                {displayedAlerts.length === 0 ? (
                  <div className="py-8 text-center flex flex-col items-center justify-center">
                    <div
                      className="p-3 rounded-full mb-2"
                      style={{ background: isLight ? "#D1FAE5" : `${colors.mint}14` }}
                    >
                      <CheckCircle2 size={24} style={{ color: colors.mint }} />
                    </div>
                    <div className="text-sm font-semibold" style={{ color: colors.text }}>
                      Semua Kondisi Baik
                    </div>
                    <div
                      className="text-xs max-w-xs mt-1 leading-relaxed"
                      style={{ color: colors.textMuted }}
                    >
                      Tidak ada anomali atau isu yang memerlukan perhatian pada kategori ini.
                    </div>
                  </div>
                ) : (
                  displayedAlerts.map((a) => {
                    const isCrit = a.level === ALERT_LEVELS.CRITICAL;
                    const isWarn = a.level === ALERT_LEVELS.WARNING;
                    const isPos = a.level === ALERT_LEVELS.POSITIVE;

                    const accentColor = isCrit
                      ? colors.coral
                      : isWarn
                      ? colors.gold
                      : colors.mint;

                    const cardBg = isLight
                      ? isCrit
                        ? "#FFF1F2"
                        : isWarn
                        ? "#FFFBEB"
                        : "#F0FDF4"
                      : isCrit
                      ? "rgba(248, 113, 113, 0.08)"
                      : isWarn
                      ? "rgba(251, 191, 36, 0.08)"
                      : "rgba(52, 211, 153, 0.08)";

                    const cardBorder = isLight
                      ? isCrit
                        ? "#FECDD3"
                        : isWarn
                        ? "#FDE68A"
                        : "#BBF7D0"
                      : `${accentColor}33`;

                    return (
                      <div
                        key={a.id}
                        className={`rounded-xl p-3 relative group transition-all ${
                          dismissingId === a.id ? "sm-card-dismiss" : "sm-fadeup"
                        }`}
                        style={{
                          background: cardBg,
                          border: `1px solid ${cardBorder}`,
                          borderLeft: `4px solid ${accentColor}`,
                          boxShadow: isLight ? "0 1px 3px rgba(0,0,0,0.05)" : "none",
                        }}
                      >
                        {/* Baris Atas: Badge severity + Tag + Tombol Dismiss */}
                        <div className="flex items-center justify-between gap-2 mb-1.5">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span
                              className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded flex items-center gap-1"
                              style={{
                                background: isLight ? `${accentColor}1A` : `${accentColor}22`,
                                color: accentColor,
                                border: isLight ? `1px solid ${accentColor}33` : "none",
                              }}
                            >
                              {isCrit ? <AlertTriangle size={10} /> : isWarn ? <AlertCircle size={10} /> : <Sparkles size={10} />}
                              <span>{isCrit ? "Kritis" : isWarn ? "Peringatan" : isPos ? "Prestasi" : "Info"}</span>
                            </span>

                            {a.tag && (
                              <span
                                className="text-[10px] font-medium px-1.5 py-0.5 rounded"
                                style={{
                                  background: isLight ? "#FFFFFF" : colors.glassFill,
                                  color: isLight ? "#4B5563" : colors.textMuted,
                                  border: `1px solid ${isLight ? "#E5E7EB" : colors.glassBorder}`,
                                }}
                              >
                                {a.tag}
                              </span>
                            )}
                          </div>

                          {/* Tombol Dismiss */}
                          <button
                            onClick={(e) => handleDismiss(a.id, e)}
                            className="sm-btn p-1 rounded hover:opacity-100 opacity-60 hover:scale-110 active:scale-90 transition-all cursor-pointer"
                            style={{ color: colors.textMuted }}
                            title="Sembunyikan notifikasi ini"
                            aria-label="Sembunyikan"
                          >
                            <X size={12} />
                          </button>
                        </div>

                        {/* Judul Anomali */}
                        <div
                          className="text-xs font-semibold leading-snug"
                          style={{ color: colors.text }}
                        >
                          {a.title}
                        </div>

                        {/* Pesan Deskripsi */}
                        <div
                          className="text-[11px] mt-1 leading-relaxed"
                          style={{ color: colors.textMuted }}
                        >
                          {a.message}
                        </div>

                        {/* Tombol Aksi Cepat */}
                        <div
                          className="flex items-center gap-2 mt-2.5 pt-2 border-t"
                          style={{ borderColor: isLight ? "rgba(0,0,0,0.06)" : `${accentColor}22` }}
                        >
                          {onDrilldown && a.predicate && (
                            <button
                              onClick={() => handleDrilldown(a)}
                              className="sm-btn text-[11px] font-semibold px-2.5 py-1 rounded-lg flex items-center gap-1 transition-colors"
                              style={{
                                background: isLight ? accentColor : `${accentColor}1C`,
                                color: isLight ? "#FFFFFF" : accentColor,
                                boxShadow: isLight ? "0 1px 2px rgba(0,0,0,0.12)" : "none",
                              }}
                            >
                              <Layers size={11} />
                              <span>Lihat Outlet</span>
                            </button>
                          )}

                          {onNavigate && a.targetTab && (
                            <button
                              onClick={() => handleNavigate(a.targetTab)}
                              className="sm-btn text-[11px] font-medium px-2 py-1 rounded-lg flex items-center gap-1 text-xs transition-colors"
                              style={{
                                background: isLight ? "#FFFFFF" : colors.glassFill,
                                color: isLight ? "#1F2937" : colors.text,
                                border: `1px solid ${isLight ? "#D1D5DB" : colors.glassBorder}`,
                                boxShadow: isLight ? "0 1px 2px rgba(0,0,0,0.05)" : "none",
                              }}
                            >
                              <span>{a.actionLabel || "Buka Halaman"}</span>
                              <ChevronRight size={11} style={{ color: colors.textMuted }} />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Footer Panel: info reset dismiss bila ada yang disembunyikan */}
              {dismissedCount > 0 && (
                <div
                  className="px-3.5 py-2 text-[11px] flex items-center justify-between border-t"
                  style={{
                    borderColor: dividerBorder,
                    background: isLight ? "#F9FAFB" : "rgba(255,255,255,0.02)",
                    color: colors.textMuted,
                  }}
                >
                  <span>{dismissedCount} alert disembunyikan</span>
                  <button
                    onClick={handleResetDismissed}
                    className="sm-btn text-[11px] font-medium px-2 py-0.5 rounded hover:underline flex items-center gap-1 transition-colors"
                    style={{ color: colors.gold }}
                  >
                    <RefreshCw size={10} />
                    <span>Tampilkan Kembali</span>
                  </button>
                </div>
              )}
            </div>
          </>,
          document.body
        )}
    </>
  );
}
