import { useState, useEffect, useRef } from "react";

/* ============================================================================
   useScrollDirection — deteksi arah scroll untuk sticky-hide header mobile.
   Return { hidden }: true saat scroll ke bawah (header disembunyikan), false
   saat scroll ke atas atau di atas ambang awal. Debounce kecil supaya tidak
   berkedip saat scroll pelan. Hanya aktif di breakpoint mobile (md: ke bawah —
   dicek via matchMedia di dalam), jadi di desktop header selalu tampil.
============================================================================ */
export function useScrollDirection(threshold = 8) {
  const [hidden, setHidden] = useState(false);
  const lastYRef = useRef(0);
  const tickingRef = useRef(false);

  useEffect(() => {
    // Deteksi mobile (breakpoint < 768px = md). Desktop: header selalu tampil.
    const mq = window.matchMedia("(max-width: 767px)");

    const onScroll = () => {
      if (!mq.matches) return;
      if (tickingRef.current) return;
      tickingRef.current = true;
      requestAnimationFrame(() => {
        const y = window.scrollY;
        const delta = y - lastYRef.current;
        lastYRef.current = y;
        if (Math.abs(delta) >= threshold) {
          setHidden(delta > 0);
        }
        tickingRef.current = false;
      });
    };

    lastYRef.current = window.scrollY;
    window.addEventListener("scroll", onScroll, { passive: true });
    const onChange = (e) => {
      if (!e.matches) setHidden(false);
    };
    mq.addEventListener?.("change", onChange);
    return () => {
      window.removeEventListener("scroll", onScroll);
      mq.removeEventListener?.("change", onChange);
    };
  }, [threshold]);

  return { hidden };
}
