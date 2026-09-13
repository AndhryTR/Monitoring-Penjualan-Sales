import { useEffect, useRef } from "react";

/* ============================================================================
   useWebVitals — track Core Web Vitals (FCP, LCP, INP, CLS, TTFB) via native
   PerformanceObserver. Tanpa dependency tambahan (no `web-vitals` npm package).

   ⚠️ Sprint 5 / S5: sebelumnya tidak ada real-user performance monitoring.
   Kalau ada regression di production (mis. vendor chunk baru bikin LCP naik),
   tidak terdeteksi sampai user complain. Sekarang: log ke console + expose
   via ref supaya caller bisa post ke analytics endpoint bila perlu.

   Metrics tracked:
   - FCP (First Contentful Paint): waktu sampai konten pertama ter-render
   - LCP (Largest Contentful Paint): waktu sampai konten terbesar ter-render
   - INP (Interaction to Next Paint): responsivitas interaksi (replacement FID)
   - CLS (Cumulative Layout Shift): visual stability
   - TTFB (Time to First Byte): network + server response

   Usage:
   ```
   const vitalsRef = useWebVitals({
     onMetric: (metric) => {
       // Optional: post ke analytics
       if (navigator.sendBeacon) {
         navigator.sendBeacon('/api/vitals', JSON.stringify(metric));
       }
     }
   });
   // vitalsRef.current = { fcp, lcp, inp, cls, ttfb } (live snapshot)
   ```

   Catatan: PerformanceObserver INP hanya tersedia di Chrome 96+ / Edge 96+.
   Browser lain (Safari, Firefox) tidak report INP — `inp` field tetap null.
============================================================================ */

const RATINGS = {
  // "good" / "needs-improvement" / "poor" thresholds dari web.dev
  fcp: { good: 1800, poor: 3000 },     // ms
  lcp: { good: 2500, poor: 4000 },     // ms
  inp: { good: 200, poor: 500 },        // ms
  cls: { good: 0.1, poor: 0.25 },        // score (unitless)
  ttfb: { good: 800, poor: 1800 },      // ms
};

function rate(metric, value) {
  if (value == null) return "n/a";
  const thresholds = RATINGS[metric];
  if (!thresholds) return "n/a";
  if (value <= thresholds.good) return "good";
  if (value <= thresholds.poor) return "needs-improvement";
  return "poor";
}

export function useWebVitals({ onMetric, enabled = true } = {}) {
  const vitalsRef = useRef({ fcp: null, lcp: null, inp: null, cls: null, ttfb: null });
  const onMetricRef = useRef(onMetric);
  onMetricRef.current = onMetric;

  useEffect(() => {
    if (!enabled || typeof PerformanceObserver === "undefined") return;

    let fcpObserver = null;
    let lcpObserver = null;
    let clsObserver = null;
    let inpObserver = null;
    let onHide = null;

    // Helper: simpan metric, panggil onMetric callback, log ke console.
    const record = (name, value) => {
      vitalsRef.current[name] = value;
      const rating = rate(name, value);
      const unit = name === "cls" ? "" : "ms";
      // Log hanya di dev supaya tidak spam production console. Production
      // caller bisa pakai onMetric callback untuk post ke analytics.
      if (import.meta.env.DEV) {
        console.log(`[WebVitals] ${name.toUpperCase()}: ${value.toFixed(name === "cls" ? 3 : 0)}${unit} (${rating})`);
      }
      onMetricRef.current?.({ name, value, rating });
    };

    // ---- TTFB (Time to First Byte) ----
    // TTFB dari Navigation Timing API — tidak perlu PerformanceObserver.
    if (performance.timing) {
      const navEntry = performance.getEntriesByType("navigation")[0];
      if (navEntry && navEntry.responseStart > 0) {
        // responseStart = waktu browser terima byte pertama response.
        // startTime = navigasi mulai (page load).
        const ttfb = navEntry.responseStart - navEntry.startTime;
        if (ttfb >= 0) record("ttfb", ttfb);
      }
    }

    // ---- FCP (First Contentful Paint) ----
    try {
      fcpObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const fcpEntry = entries.find((e) => e.name === "first-contentful-paint");
        if (fcpEntry) {
          record("fcp", fcpEntry.startTime);
          fcpObserver.disconnect();
          fcpObserver = null;
        }
      });
      fcpObserver.observe({ type: "paint", buffered: true });
    } catch {
      // Browser tidak support `type: "paint"` — skip FCP.
    }

    // ---- LCP (Largest Contentful Paint) ----
    // LCP bisa update beberapa kali (final LCP = entry terakhir sebelum
    // user interaksi atau page hidden). Kita simpan yang terbaru.
    try {
      lcpObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const last = entries[entries.length - 1];
        if (last) record("lcp", last.startTime);
      });
      lcpObserver.observe({ type: "largest-contentful-paint", buffered: true });
      // Disconnect saat page hidden untuk "freeze" final LCP.
      onHide = () => {
        if (document.visibilityState === "hidden") {
          lcpObserver?.disconnect();
          lcpObserver = null;
          document.removeEventListener("visibilitychange", onHide);
        }
      };
      document.addEventListener("visibilitychange", onHide);
    } catch {
      // Browser tidak support LCP — skip.
    }

    // ---- CLS (Cumulative Layout Shift) ----
    // CLS akumulasi semua layout shift entries. Kita hitung total score.
    let clsValue = 0;
    try {
      clsObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (!entry.hadRecentInput) {
            clsValue += entry.value;
          }
        }
        record("cls", clsValue);
      });
      clsObserver.observe({ type: "layout-shift", buffered: true });
    } catch {
      // Browser tidak support CLS — skip.
    }

    // ---- INP (Interaction to Next Paint) ----
    // INP = worst interaction delay dalam session (atau 98th percentile bila
    // banyak interaksi). Untuk simplicity, kita track worst seen.
    try {
      inpObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          // entry.duration = total interaction delay (processing + input + presentation).
          if (entry.interactionId) {
            record("inp", entry.duration);
          }
        }
      });
      // `event` type untuk INP — cuma Chrome 96+.
      inpObserver.observe({ type: "event", buffered: true });
    } catch {
      // Browser tidak support INP — skip (Safari, Firefox lama).
    }

    return () => {
      fcpObserver?.disconnect();
      lcpObserver?.disconnect();
      clsObserver?.disconnect();
      inpObserver?.disconnect();
      if (onHide) {
        document.removeEventListener("visibilitychange", onHide);
      }
    };
  }, [enabled]);

  return vitalsRef;
}
