import { useState, useEffect, useMemo } from "react";
import {
  Play, Pause, X, ChevronLeft, ChevronRight,
  Clock,
} from "lucide-react";
import { THEMES } from "../constants/colors.js";
import { useScrollLock } from "../hooks/useModalA11y.js";

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
  isActive, isPlaying, currentTab, currentTabIndex, timeLeft,
  activeTabs, tabDuration, progress,
  _start, stop, togglePlayPause, nextTab, prevTab,
  scrollContainerRef,
  colors,
  // Page render props
  renderPage,
  depotName,
  aggMeta,
  // ⚠️ Sprint 17h / bugfix: flag tampilan dari slideshowConfig
  largeFont = true,
  forceDark = false,
}) {
  const [clock, setClock] = useState("");

  // ⚠️ Sprint 17i / bugfix: kunci scroll body + html saat slideshow aktif
  // supaya scrollbar native browser (yang dirender browser chrome di atas
  // z-index DOM manapun) tidak muncul bersamaan dengan scrollbar internal
  // slideshow content area. Sebelumnya user lihat 2 scrollbar berdampingan:
  // (1) native browser di kanan viewport, (2) webkit-scrollbar di dalam
  // content area slideshow.
  //
  // useScrollLock mengatur document.body.style.overflow = "hidden" (shared
  // counter, aman bila ada modal lain yang juga lock). Tapi <html> element
  // bisa juga menampilkan scrollbar di beberapa browser — kita kunci manual
  // di sini lewat effect sendiri.
  useScrollLock(isActive);
  useEffect(() => {
    if (!isActive) return;
    const prevHtmlOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.documentElement.style.overflow = prevHtmlOverflow;
    };
  }, [isActive]);

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

  // Format last synced time DIHAPUS (audit #12) — slideshow tidak sync otomatis lagi.

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

  // ⚠️ Sprint 17h / bugfix: honor `forceDark` dari slideshowConfig.
  // Sebelumnya flag diabaikan — slideshow selalu pakai theme aktif (bisa light).
  // Sekarang: kalau forceDark=true, override colors dengan THEMES.dark supaya
  // background selalu gelap walau user lagi pakai light theme di app utama.
  // Memo supaya identity colors stabil (tidak trigger re-render berlebihan).
  const effectiveColors = useMemo(() => {
    if (!forceDark) return colors;
    return { ...colors, ...THEMES.dark };
  }, [colors, forceDark]);

  // ⚠️ Sprint 17h / bugfix: honor `largeFont` dari slideshowConfig.
  // Sebelumnya font selalu 1.15em walau user uncheck "Font diperbesar".
  // Sekarang: 1.15em saat on, 1em (= normal) saat off.
  const contentFontSize = largeFont ? "1.15em" : "1em";

  if (!isActive) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex flex-col"
      style={{ background: effectiveColors.ink || "#0A1120", color: effectiveColors.text }}
    >
      {/* ===== Top bar ===== */}
      <div
        className="flex items-center justify-between px-8 py-3 shrink-0"
        style={{ background: effectiveColors.glassFill, borderBottom: `1px solid ${effectiveColors.glassBorder}` }}
      >
        {/* Kiri: depo + periode */}
        <div className="flex items-center gap-4">
          <div>
            <div className="disp text-lg font-bold" style={{ color: effectiveColors.gold }}>
              {depotName || "DEPO"}
            </div>
            {periodeLabel && (
              <div className="text-xs mono" style={{ color: effectiveColors.textMuted }}>
                {periodeLabel} · {aggMeta?.uniqueDays || 0} hari data
              </div>
            )}
          </div>
        </div>

        {/* Tengah: tab aktif */}
        <div className="flex items-center gap-2">
          <div className="disp text-sm font-semibold" style={{ color: effectiveColors.mint }}>
            {TAB_LABELS[currentTab] || currentTab}
          </div>
          <span className="text-xs" style={{ color: effectiveColors.textMuted }}>
            ({currentTabIndex + 1}/{activeTabs.length})
          </span>
        </div>

        {/* Kanan: tanggal + clock + exit */}
        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className="text-xs" style={{ color: effectiveColors.textMuted }}>{dateLabel}</div>
            <div className="mono text-lg font-bold" style={{ color: effectiveColors.text }}>{clock}</div>
          </div>
          <button
            onClick={stop}
            className="p-2 rounded-lg"
            style={{ background: effectiveColors.coral + "1A", color: effectiveColors.coral }}
            title="Keluar (Esc)"
            aria-label="Keluar slideshow"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* ===== Content area ===== */}
      {/* ⚠️ Audit autoscroll fix: TANPA scrollBehavior:"smooth" — loop rAF di
          useSlideshow sudah punya easing sendiri. Di Chromium, scroll-behavior
          smooth bikin tiap penulisan c.scrollTop (60x/dtk) jadi permintaan
          animasi baru yang meng-cancel animasi sebelumnya → posisi nyaris tak
          maju (terlihat "tidak berfungsi"). Firefox konvergensinya beda sehingga
          lolos. Tanpa CSS smooth, scrollTop = lompatan instan → easing rAF
          terkontrol penuh, konsisten di semua browser. */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto p-8"
        onClick={togglePlayPause}
      >
        {/* Render page aktif — wrap dengan stopPropagation supaya klik pada
            button/link di dalam page tidak trigger pause/resume slideshow */}
        <div className="slideshow-content max-w-7xl mx-auto" style={{ fontSize: contentFontSize }} onClick={(e) => e.stopPropagation()}>
          {renderPage(currentTab)}
        </div>
      </div>

      {/* ===== Bottom bar ===== */}
      <div
        className="shrink-0 px-8 py-3"
        style={{ background: effectiveColors.glassFill, borderTop: `1px solid ${effectiveColors.glassBorder}` }}
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
                  background: i === currentTabIndex ? effectiveColors.mint : effectiveColors.glassBorder,
                }}
              />
            ))}
          </div>

          {/* Progress bar */}
          <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: effectiveColors.glassSubtle }}>
            <div
              className="h-full rounded-full transition-all duration-1000 ease-linear"
              style={{ width: `${progress}%`, background: isPlaying ? effectiveColors.mint : effectiveColors.gold }}
            />
          </div>

          {/* Time left */}
          <div className="text-xs mono shrink-0" style={{ color: effectiveColors.textMuted }}>
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
                background: isPlaying ? effectiveColors.mint + "1A" : effectiveColors.gold + "1A",
                color: isPlaying ? effectiveColors.mint : effectiveColors.gold,
              }}
            >
              {isPlaying ? <Pause size={12} /> : <Play size={12} />}
              {isPlaying ? "Auto" : "Dijeda"}
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); prevTab(); }}
              className="p-1.5 rounded-lg"
              style={{ background: effectiveColors.glassSubtle, color: effectiveColors.textMuted }}
              title="Sebelumnya (←)"
            >
              <ChevronLeft size={14} />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); nextTab(); }}
              className="p-1.5 rounded-lg"
              style={{ background: effectiveColors.glassSubtle, color: effectiveColors.textMuted }}
              title="Berikutnya (→)"
            >
              <ChevronRight size={14} />
            </button>
          </div>

          {/* Kanan: info durasi (audit #12: indikator sync dihapus) */}
          <div className="flex items-center gap-3 text-xs" style={{ color: effectiveColors.textMuted }}>
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
