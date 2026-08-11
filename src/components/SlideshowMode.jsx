import { useState, useEffect, useMemo, useRef } from "react";
import {
  Play, Pause, X, ChevronLeft, ChevronRight,
  RefreshCw, Clock, Wifi,
} from "lucide-react";
import { fmtNum } from "../utils/formatters.js";

/* ============================================================================
   SLIDESHOW MODE — fullscreen overlay untuk display monitor di ruang sales.
   ⚠️ Sprint 17 / SS2: auto-rotate antar tab, auto-scroll, auto-sync.

   Layout:
   - Top bar: depo name + tanggal + clock (real-time)
   - Content area: render page aktif (reuse komponen yang ada)
   - Bottom bar: progress bar + tab indicator + controls + last synced
   - Tables di-hide via CSS class `slideshow-mode` di parent

   Controls:
   - Klik layar → pause/resume
   - Esc → exit slideshow
   - Arrow ←/→ → ganti tab manual
   - Space → pause/resume
============================================================================ */

const TAB_LABELS = {
  executive: "Ringkasan",
  main: "Main Report",
  sales: "Sales Report",
  product: "Product Report",
  focus: "Product Focus",
  outlet: "Outlet Analysis",
};

export function SlideshowMode({
  isActive, isPlaying, currentTab, currentTabIndex, timeLeft, lastSyncedAt,
  activeTabs, tabDuration, progress,
  start, stop, togglePlayPause, nextTab, prevTab,
  scrollContainerRef,
  colors,
  // Page render props
  renderPage,
  depotName,
  aggMeta,
}) {
  const [clock, setClock] = useState("");

  // Real-time clock
  useEffect(() => {
    if (!isActive) return;
    const update = () => {
      const now = new Date();
      const h = String(now.getHours()).padStart(2, "0");
      const m = String(now.getMinutes()).padStart(2, "0");
      const s = String(now.getSeconds()).padStart(2, "0");
      setClock(`${h}:${m}:${s}`);
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [isActive]);

  // Format last synced time
  const lastSyncedLabel = useMemo(() => {
    if (!lastSyncedAt) return "Belum sync";
    const diff = Math.floor((Date.now() - lastSyncedAt) / 1000);
    if (diff < 60) return `${diff} dtk lalu`;
    if (diff < 3600) return `${Math.floor(diff / 60)} mnt lalu`;
    return `${Math.floor(diff / 3600)} jam lalu`;
  }, [lastSyncedAt]);

  // Format tanggal
  const dateLabel = useMemo(() => {
    const now = new Date();
    const days = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
    const months = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
    return `${days[now.getDay()]}, ${now.getDate()} ${months[now.getMonth()]} ${now.getFullYear()}`;
  }, []);

  // Periode dari agg meta
  const periodeLabel = aggMeta?.firstDate && aggMeta?.lastDate
    ? `${aggMeta.firstDate} — ${aggMeta.lastDate}`
    : "";

  if (!isActive) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex flex-col"
      style={{ background: colors.ink || "#0A1120", color: colors.text }}
    >
      {/* ===== Top bar ===== */}
      <div
        className="flex items-center justify-between px-8 py-3 shrink-0"
        style={{ background: colors.glassFill, borderBottom: `1px solid ${colors.glassBorder}` }}
      >
        {/* Kiri: depo + periode */}
        <div className="flex items-center gap-4">
          <div>
            <div className="disp text-lg font-bold" style={{ color: colors.gold }}>
              {depotName || "DEPO"}
            </div>
            {periodeLabel && (
              <div className="text-xs mono" style={{ color: colors.textMuted }}>
                {periodeLabel} · {aggMeta?.uniqueDays || 0} hari data
              </div>
            )}
          </div>
        </div>

        {/* Tengah: tab aktif */}
        <div className="flex items-center gap-2">
          <div className="disp text-sm font-semibold" style={{ color: colors.mint }}>
            {TAB_LABELS[currentTab] || currentTab}
          </div>
          <span className="text-xs" style={{ color: colors.textMuted }}>
            ({currentTabIndex + 1}/{activeTabs.length})
          </span>
        </div>

        {/* Kanan: tanggal + clock + exit */}
        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className="text-xs" style={{ color: colors.textMuted }}>{dateLabel}</div>
            <div className="mono text-lg font-bold" style={{ color: colors.text }}>{clock}</div>
          </div>
          <button
            onClick={stop}
            className="p-2 rounded-lg"
            style={{ background: colors.coral + "1A", color: colors.coral }}
            title="Keluar (Esc)"
            aria-label="Keluar slideshow"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* ===== Content area ===== */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto p-8"
        style={{ scrollBehavior: "smooth" }}
        onClick={togglePlayPause}
      >
        {/* Render page aktif */}
        <div className="slideshow-content max-w-7xl mx-auto" style={{ fontSize: "1.15em" }}>
          {renderPage(currentTab)}
        </div>
      </div>

      {/* ===== Bottom bar ===== */}
      <div
        className="shrink-0 px-8 py-3"
        style={{ background: colors.glassFill, borderTop: `1px solid ${colors.glassBorder}` }}
      >
        {/* Progress bar */}
        <div className="flex items-center gap-3 mb-2">
          {/* Tab dots */}
          <div className="flex items-center gap-1.5">
            {activeTabs.map((tab, i) => (
              <div
                key={tab}
                className="rounded-full transition-all duration-300"
                style={{
                  width: i === currentTabIndex ? 24 : 6,
                  height: 6,
                  background: i === currentTabIndex ? colors.mint : colors.glassBorder,
                }}
              />
            ))}
          </div>

          {/* Progress bar */}
          <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: colors.glassSubtle }}>
            <div
              className="h-full rounded-full transition-all duration-1000 ease-linear"
              style={{ width: `${progress}%`, background: isPlaying ? colors.mint : colors.gold }}
            />
          </div>

          {/* Time left */}
          <div className="text-xs mono shrink-0" style={{ color: colors.textMuted }}>
            {isPlaying ? `${timeLeft}s` : "⏸"}
          </div>
        </div>

        {/* Controls row */}
        <div className="flex items-center justify-between">
          {/* Kiri: play/pause + nav */}
          <div className="flex items-center gap-2">
            <button
              onClick={(e) => { e.stopPropagation(); togglePlayPause(); }}
              className="p-1.5 rounded-lg flex items-center gap-1.5 text-xs font-semibold"
              style={{
                background: isPlaying ? colors.mint + "1A" : colors.gold + "1A",
                color: isPlaying ? colors.mint : colors.gold,
              }}
            >
              {isPlaying ? <Pause size={12} /> : <Play size={12} />}
              {isPlaying ? "Auto" : "Dijeda"}
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); prevTab(); }}
              className="p-1.5 rounded-lg"
              style={{ background: colors.glassSubtle, color: colors.textMuted }}
              title="Sebelumnya (←)"
            >
              <ChevronLeft size={14} />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); nextTab(); }}
              className="p-1.5 rounded-lg"
              style={{ background: colors.glassSubtle, color: colors.textMuted }}
              title="Berikutnya (→)"
            >
              <ChevronRight size={14} />
            </button>
          </div>

          {/* Kanan: sync status */}
          <div className="flex items-center gap-3 text-xs" style={{ color: colors.textMuted }}>
            <div className="flex items-center gap-1.5">
              <Wifi size={12} style={{ color: lastSyncedAt ? colors.mint : colors.textMuted }} />
              <span>{lastSyncedLabel}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Clock size={12} />
              <span>Ganti setiap {tabDuration}s</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
