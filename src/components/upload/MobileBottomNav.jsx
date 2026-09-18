import React, { useRef, useEffect, useMemo } from "react";

/* ============================================================================
   MOBILE NAVIGATION (H6) — Enhanced Horizontal Scroll
   - MobileBottomNav: bottom tab bar untuk mobile (md:hidden) dengan
     horizontal scroll. SEMUA tab ditampilkan — tidak ada lagi pemisahan
     primary/more — user bisa swipe/geser untuk melihat tab yang tidak muat.
   - Scroll indicator dots di bawah menunjukkan posisi tab aktif.
   - Aktif secara otomatis scroll ke tengah via scrollIntoView.
   Keduanya menghormati iOS safe-area-inset supaya tidak tertutup home indicator.
============================================================================ */

export function MobileBottomNav({ tabs, activeTab, onChange, colors }) {
  const containerRef = useRef(null);
  const activeRef = useRef(null);

  // Auto-scroll ke posisi tab aktif saat activeTab berubah
  useEffect(() => {
    if (activeRef.current && containerRef.current) {
      activeRef.current.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }
  }, [activeTab]);

  const activeIndex = useMemo(() => tabs.findIndex((t) => t.key === activeTab), [tabs, activeTab]);

  const navStyle = {
    overflowX: 'auto',
    scrollSnapType: 'x mandatory',
    WebkitOverflowScrolling: 'touch',
    scrollbarWidth: 'none',
    msOverflowStyle: 'none',
  };
  const itemStyle = { scrollSnapAlign: 'center', flexShrink: 0, width: 72 };

  return (
    <nav
      className="md:hidden fixed left-3 right-3 z-40 sm-mobile-nav-glass"
      style={{
        bottom: "calc(12px + env(safe-area-inset-bottom))",
        borderRadius: "24px",
        paddingBottom: 0,
      }}
    >
      <div ref={containerRef} style={navStyle} className="flex items-stretch px-1 pt-1.5 sm-scrollhide">
        {tabs.map((t) => {
          const Icon = t.icon;
          const isActive = t.key === activeTab;
          return (
            <button
              key={t.key}
              ref={isActive ? activeRef : undefined}
              onClick={() => onChange(t.key)}
              style={itemStyle}
              className="flex flex-col items-center justify-center gap-0.5 py-1.5 px-1 rounded-2xl transition-colors shrink-0"
              aria-label={t.label}
              aria-current={isActive ? "page" : undefined}
            >
              <div className="relative flex items-center justify-center" style={{ width: 20, height: 20 }}>
                {isActive && (
                  <div className="absolute inset-0 rounded-full" style={{ background: colors.mint, opacity: 0.25, filter: "blur(8px)" }} />
                )}
                <Icon size={20} style={{ strokeWidth: isActive ? 2.4 : 2, position: "relative", color: isActive ? colors.mint : colors.textMuted }} />
              </div>
              <span className="text-[10px] font-medium leading-tight truncate w-full text-center whitespace-nowrap" style={{ color: isActive ? colors.mint : colors.textMuted, maxWidth: 64 }}>
                {t.shortLabel}
              </span>
            </button>
          );
        })}
      </div>

      {/* Scroll indicator dots */}
      {tabs.length > 0 && (
        <div className="flex justify-center items-center gap-1 pb-1.5 pt-0.5">
          {tabs.map((t, i) => {
            const isActiveDot = i === activeIndex;
            return (
              <div
                key={t.key}
                className="transition-all duration-250 rounded-full"
                style={{
                  width: isActiveDot ? 16 : 5,
                  height: 3,
                  borderRadius: 2,
                  background: isActiveDot ? colors.gold : colors.glassBorder,
                }}
              />
            );
          })}
        </div>
      )}
    </nav>
  );
}
