import { useState, useEffect, useRef, useCallback, useMemo } from "react";

/* ============================================================================
   useSlideshow — hook untuk mode pajangan (slideshow) di monitor.
   ⚠️ Sprint 17 / SS1: auto-rotate antar tab, auto-sync data, auto-scroll.

   Features:
   - Auto-rotate: ganti tab setiap N detik (default 30)
   - Auto-sync: sync dari cloud setiap M menit (default 5)
   - Auto-scroll: scroll ke bawah setelah setengah durasi tab
   - Pause/resume via klik layar atau Space
   - Manual navigation via Arrow Left/Right
   - Config: durasi per tab, interval sync, tabs yang ditampilkan
============================================================================ */

const DEFAULT_TABS = [
  "executive", "main", "sales", "product", "focus", "outlet",
];

const DEFAULT_TAB_DURATION = 30; // detik
const DEFAULT_SYNC_INTERVAL = 5; // menit
const SCROLL_DELAY_RATIO = 0.5; // scroll setelah 50% durasi tab

export function useSlideshow({
  enabledTabs = DEFAULT_TABS,
  tabDuration = DEFAULT_TAB_DURATION,
  syncInterval = DEFAULT_SYNC_INTERVAL,
  autoScroll = true,
  onTabChange,
  onSync,
  isAuthed = false,
} = {}) {
  const [isActive, setIsActive] = useState(false);
  const [isPlaying, setIsPlaying] = useState(true);
  const [currentTabIndex, setCurrentTabIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState(tabDuration);
  const [lastSyncedAt, setLastSyncedAt] = useState(0);

  const tabTimerRef = useRef(null);
  const tickTimerRef = useRef(null);
  const scrollTimerRef = useRef(null);
  const syncTimerRef = useRef(null);
  const scrollContainerRef = useRef(null);
  const rafScrollRef = useRef(null);
  // ⚠️ Ref untuk onTabChange supaya effect tidak restart setiap kali
  // parent re-render dan pass callback baru (identity berubah).
  const onTabChangeRef = useRef(onTabChange);
  useEffect(() => { onTabChangeRef.current = onTabChange; }, [onTabChange]);

  // ⚠️ Ref untuk pause/resume rAF scroll — simpan state scroll saat di-pause
  // supaya bisa resume dari posisi terakhir, bukan dari awal.
  const scrollStateRef = useRef({ startTime: null, pausedAt: null, pausedScrollTop: 0 });

  // Tabs yang aktif (filter enabledTabs)
  // ⚠️ Sprint 19h / Code review fix: useMemo supaya identity stabil —
  // sebelumnya new array ref setiap render → useCallback deps berubah.
  const activeTabs = useMemo(() => enabledTabs.filter(Boolean), [enabledTabs]);

  const currentTab = activeTabs[currentTabIndex] || activeTabs[0] || "executive";

  // ---- Start slideshow ----
  // ⚠️ Sprint 17h / SC3: terima startTab — kalau ada di enabledTabs,
  // mulai dari tab itu. Kalau tidak ada, mulai dari tab pertama.
  const start = useCallback((startTab) => {
    const idx = startTab ? activeTabs.indexOf(startTab) : -1;
    setCurrentTabIndex(idx >= 0 ? idx : 0);
    setIsActive(true);
    setIsPlaying(true);
    setTimeLeft(tabDuration);
    if (document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen().catch(() => {});
    }
  }, [tabDuration, activeTabs]);

  // ---- Stop slideshow ----
  const stop = useCallback(() => {
    setIsActive(false);
    setIsPlaying(true);
    setCurrentTabIndex(0);
    setTimeLeft(tabDuration);
    // Exit fullscreen
    if (document.fullscreenElement && document.exitFullscreen) {
      document.exitFullscreen().catch(() => {});
    }
    // Clear semua timer + rAF
    [tabTimerRef, tickTimerRef, scrollTimerRef, syncTimerRef].forEach(ref => {
      if (ref.current) { clearTimeout(ref.current); clearInterval(ref.current); ref.current = null; }
    });
    if (rafScrollRef.current) { cancelAnimationFrame(rafScrollRef.current); rafScrollRef.current = null; }
  }, [tabDuration]);

  // ---- Toggle play/pause ----
  const togglePlayPause = useCallback(() => {
    setIsPlaying(prev => !prev);
  }, []);

  // ---- Next tab ----
  const nextTab = useCallback(() => {
    setCurrentTabIndex(prev => (prev + 1) % activeTabs.length);
    setTimeLeft(tabDuration);
  }, [activeTabs.length, tabDuration]);

  // ---- Prev tab ----
  const prevTab = useCallback(() => {
    setCurrentTabIndex(prev => (prev - 1 + activeTabs.length) % activeTabs.length);
    setTimeLeft(tabDuration);
  }, [activeTabs.length, tabDuration]);

  // ---- Auto-scroll ke bawah ----
  const scrollToBottom = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    container.scrollTo({ top: container.scrollHeight, behavior: "smooth" });
  }, []);

  const scrollToTop = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    container.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  // ---- Main effect: auto-rotate + tick + smooth rAF scroll ----
  // ⚠️ Sprint 17e: ganti setTimeout scrollToBottom dengan requestAnimationFrame
  // loop yang scroll sedikit demi sedikit setiap frame, dengan kecepatan yang
  // menyesuaikan panjang halaman dan durasi tab.
  useEffect(() => {
    if (!isActive || !isPlaying) return;
    if (activeTabs.length === 0) return;

    // Notify tab change
    if (onTabChangeRef.current) onTabChangeRef.current(currentTab);

    // Reset scroll state untuk tab baru
    scrollStateRef.current = { startTime: null, pausedAt: null, pausedScrollTop: 0 };

    // Scroll to top saat ganti tab
    const container = scrollContainerRef.current;
    if (container) container.scrollTop = 0;

    // Tick timer: update timeLeft setiap 1 detik
    tickTimerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) return tabDuration;
        return prev - 1;
      });
    }, 1000);

    // Tab switch timer: ganti tab setelah tabDuration
    tabTimerRef.current = setTimeout(() => {
      setCurrentTabIndex(prev => (prev + 1) % activeTabs.length);
      setTimeLeft(tabDuration);
    }, tabDuration * 1000);

    // ---- rAF smooth scroll ----
    // ⚠️ Sprint 17h / bugfix: honor flag `autoScroll` dari slideshowConfig.
    // Sebelumnya rAF scroll selalu dijadwalkan walau user uncheck "Auto-scroll
    // halus" di Settings — checkbox tidak berfungsi. Sekarang skip seluruh
    // blok rAF bila autoScroll=false (cukup tab rotation + tick timer saja).
    if (!autoScroll) {
      // Tidak ada rAF scroll — return cleanup kosong (tick + tab timer
      // sudah di-setup di atas & dibersihkan via return di bawah).
      return () => {
        if (tickTimerRef.current) { clearInterval(tickTimerRef.current); tickTimerRef.current = null; }
        if (tabTimerRef.current) { clearTimeout(tabTimerRef.current); tabTimerRef.current = null; }
      };
    }
    // ⚠️ Sprint 17f: fix flickering — cache maxScroll sekali di awal,
    // jangan recalculate setiap frame (scrollHeight berubah saat React
    // re-render charts/konten). Jangan pernah return early dari rAF loop.
    const SCROLL_DELAY_START = 2000;
    const SCROLL_DELAY_END = 2000;
    const scrollDuration = Math.max(1000, (tabDuration * 1000) - SCROLL_DELAY_START - SCROLL_DELAY_END);

    const smoothScrollStep = (timestamp) => {
      const c = scrollContainerRef.current;
      if (!c) {
        rafScrollRef.current = requestAnimationFrame(smoothScrollStep);
        return;
      }

      // ⚠️ Sprint 17g: fix Chrome — re-cache maxScroll selama jeda awal
      // (2 detik pertama). Chrome butuh waktu lebih lama untuk render
      // charts Recharts → scrollHeight berubah beberapa kali. Kalau di-cache
      // terlalu cepat (frame pertama), maxScroll = 0 → scroll tidak jalan.
      // Fix: selama jeda awal, update maxScroll ke nilai terbesar yang terlihat.
      if (!scrollStateRef.current.startTime) {
        scrollStateRef.current.startTime = timestamp;
        scrollStateRef.current.maxScroll = 0;
      }

      const elapsed = timestamp - scrollStateRef.current.startTime;

      // Selama jeda awal, re-cache maxScroll (ambil yang terbesar)
      if (elapsed < SCROLL_DELAY_START) {
        const currentMax = c.scrollHeight - c.clientHeight;
        if (currentMax > (scrollStateRef.current.maxScroll || 0)) {
          scrollStateRef.current.maxScroll = currentMax;
        }
      }

      const maxScroll = scrollStateRef.current.maxScroll || 0;

      let progress;
      if (elapsed < SCROLL_DELAY_START) {
        progress = 0;
      } else if (elapsed > SCROLL_DELAY_START + scrollDuration) {
        progress = 1;
      } else {
        progress = (elapsed - SCROLL_DELAY_START) / scrollDuration;
      }

      // Easing: ease-in-out (quadratic)
      const eased = progress < 0.5
        ? 2 * progress * progress
        : 1 - Math.pow(-2 * progress + 2, 2) / 2;

      if (maxScroll > 0) {
        c.scrollTop = maxScroll * eased;
      }

      // SELALU schedule next frame
      if (elapsed < tabDuration * 1000) {
        rafScrollRef.current = requestAnimationFrame(smoothScrollStep);
      }
    };

    // Mulai rAF setelah delay singkat supaya konten sudah render
    scrollTimerRef.current = setTimeout(() => {
      scrollStateRef.current.startTime = null;
      scrollStateRef.current.maxScroll = 0;
      rafScrollRef.current = requestAnimationFrame(smoothScrollStep);
    }, 200);

    return () => {
      if (tickTimerRef.current) { clearInterval(tickTimerRef.current); tickTimerRef.current = null; }
      if (tabTimerRef.current) { clearTimeout(tabTimerRef.current); tabTimerRef.current = null; }
      if (scrollTimerRef.current) { clearTimeout(scrollTimerRef.current); scrollTimerRef.current = null; }
      if (rafScrollRef.current) { cancelAnimationFrame(rafScrollRef.current); rafScrollRef.current = null; }
    };
  }, [isActive, isPlaying, currentTabIndex, activeTabs.length, tabDuration, currentTab, autoScroll]);

  // ---- Auto-sync effect ----
  useEffect(() => {
    if (!isActive || !isAuthed) return;

    // Sync pertama saat slideshow dimulai
    onSync?.();
    setLastSyncedAt(Date.now());

    // Sync berikutnya setiap syncInterval menit
    syncTimerRef.current = setInterval(() => {
      onSync?.();
      setLastSyncedAt(Date.now());
    }, syncInterval * 60 * 1000);

    return () => {
      if (syncTimerRef.current) { clearInterval(syncTimerRef.current); syncTimerRef.current = null; }
    };
  }, [isActive, isAuthed, syncInterval, onSync]);

  // ---- Keyboard handler ----
  useEffect(() => {
    if (!isActive) return;

    const handleKey = (e) => {
      switch (e.key) {
        case "Escape":
          e.preventDefault();
          stop();
          break;
        case " ":
          e.preventDefault();
          togglePlayPause();
          break;
        case "ArrowRight":
          e.preventDefault();
          nextTab();
          break;
        case "ArrowLeft":
          e.preventDefault();
          prevTab();
          break;
      }
    };

    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [isActive, stop, togglePlayPause, nextTab, prevTab]);

  return {
    isActive,
    isPlaying,
    currentTab,
    currentTabIndex,
    timeLeft,
    lastSyncedAt,
    activeTabs,
    tabDuration,
    progress: ((tabDuration - timeLeft) / tabDuration) * 100,
    start,
    stop,
    togglePlayPause,
    nextTab,
    prevTab,
    scrollContainerRef,
  };
}
