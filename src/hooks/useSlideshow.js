import { useState, useEffect, useRef, useCallback } from "react";

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

  // Tabs yang aktif (filter enabledTabs)
  const activeTabs = enabledTabs.filter(Boolean);

  const currentTab = activeTabs[currentTabIndex] || activeTabs[0] || "executive";

  // ---- Start slideshow ----
  const start = useCallback(() => {
    setIsActive(true);
    setIsPlaying(true);
    setCurrentTabIndex(0);
    setTimeLeft(tabDuration);
    // Request fullscreen
    if (document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen().catch(() => {});
    }
  }, [tabDuration]);

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
    // Clear semua timer
    [tabTimerRef, tickTimerRef, scrollTimerRef, syncTimerRef].forEach(ref => {
      if (ref.current) { clearTimeout(ref.current); clearInterval(ref.current); ref.current = null; }
    });
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

  // ---- Main effect: auto-rotate + tick + scroll ----
  useEffect(() => {
    if (!isActive || !isPlaying) return;
    if (activeTabs.length === 0) return;

    // Notify tab change
    onTabChange?.(currentTab);

    // Scroll to top saat ganti tab
    scrollToTop();

    // Tick timer: update timeLeft setiap 1 detik
    tickTimerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) return tabDuration;
        return prev - 1;
      });
    }, 1000);

    // Tab switch timer: ganti tab setelah tabDuration
    tabTimerRef.current = setTimeout(() => {
      nextTab();
    }, tabDuration * 1000);

    // Auto-scroll timer: scroll ke bawah setelah setengah durasi
    scrollTimerRef.current = setTimeout(() => {
      scrollToBottom();
    }, tabDuration * 1000 * SCROLL_DELAY_RATIO);

    return () => {
      if (tickTimerRef.current) { clearInterval(tickTimerRef.current); tickTimerRef.current = null; }
      if (tabTimerRef.current) { clearTimeout(tabTimerRef.current); tabTimerRef.current = null; }
      if (scrollTimerRef.current) { clearTimeout(scrollTimerRef.current); scrollTimerRef.current = null; }
    };
  }, [isActive, isPlaying, currentTabIndex, activeTabs.length, tabDuration, currentTab, nextTab, onTabChange, scrollToTop, scrollToBottom]);

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
