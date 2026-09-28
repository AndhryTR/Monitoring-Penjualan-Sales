import { useState, useEffect, memo } from "react";
import { AppLogo } from "./AppLogo.jsx";

/* ============================================================================
   SPLASH SCREEN (React Native Overlay)
   - Tampil saat aplikasi pertama kali dimuat.
   - Menggunakan animasi perakitan logo (staggered bars, ribbon sweep, box pop).
   - Aman untuk WebView2 (Tauri), Android APK, dan PWA karena di-mount dan
     di-unmount bersih di dalam root React tanpa mendistorsi flow dokumen.
   - Bisa diklik/tap untuk langsung skip jika user sedang terburu-buru.
============================================================================ */

export const SplashScreen = memo(function SplashScreen({ onFinish, duration = 2600 }) {
  const [fading, setFading] = useState(false);
  const isTauri = typeof window !== "undefined" && Boolean(window.__TAURI_INTERNALS__ || window.__TAURI__);

  // Tampilkan jendela utama Tauri begitu splash screen ini siap di-render
  useEffect(() => {
    if (isTauri) {
      import("@tauri-apps/api/core")
        .then(({ invoke }) => {
          invoke("show_main_window").catch(() => {});
        })
        .catch(() => {});
    }
  }, [isTauri]);

  useEffect(() => {
    // Timer mulai fade out
    const fadeTimer = setTimeout(() => {
      setFading(true);
    }, duration);

    // Timer hapus total dari DOM setelah fade out selesai (400ms)
    const removeTimer = setTimeout(() => {
      onFinish?.();
    }, duration + 420);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(removeTimer);
    };
  }, [duration, onFinish]);

  const handleSkip = () => {
    setFading(true);
    setTimeout(() => {
      onFinish?.();
    }, 200);
  };

  return (
    <div
      onClick={handleSkip}
      className="fixed inset-0 select-none flex flex-col items-center justify-center cursor-pointer"
      style={{
        zIndex: 999999,
        background: isTauri ? "rgba(10, 17, 32, 0.85)" : "#0A1120",
        backdropFilter: isTauri ? "blur(20px)" : "none",
        WebkitBackdropFilter: isTauri ? "blur(20px)" : "none",
        opacity: fading ? 0 : 1,
        visibility: fading ? "hidden" : "visible",
        transition: "opacity 0.4s cubic-bezier(0.16, 1, 0.3, 1), visibility 0.4s ease",
        pointerEvents: fading ? "none" : "auto",
      }}
      role="status"
      aria-label="Memuat aplikasi"
    >
      {/* Box Logo dengan Glow */}
      <div
        className="flex items-center justify-center mb-5 rounded-3xl p-3.5 transition-transform duration-500"
        style={{
          background: "rgba(255, 255, 255, 0.04)",
          border: "1px solid rgba(255, 255, 255, 0.12)",
          boxShadow: "0 20px 50px -10px rgba(14, 143, 254, 0.35)",
        }}
      >
        <AppLogo size={84} animated loop={true} />
      </div>

      {/* Brand Title & Subtitle */}
      <div className="text-center">
        <h1
          className="text-lg md:text-xl font-bold tracking-tight text-white mb-1"
          style={{ fontFamily: "'Space Grotesk', -apple-system, BlinkMacSystemFont, sans-serif" }}
        >
          Monitoring Penjualan
        </h1>
        <p
          className="text-xs text-slate-400 font-medium tracking-wide flex items-center justify-center gap-1.5"
          style={{ fontFamily: "'Inter', sans-serif" }}
        >
          <span>Dashboard Sales & Produk</span>
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
        </p>
      </div>

      {/* Progress Bar Tipis */}
      <div className="w-36 h-1 bg-slate-800/80 rounded-full mt-6 overflow-hidden">
        <div
          className="h-full rounded-full"
          style={{
            background: "linear-gradient(90deg, #0e8ffe, #10b981)",
            animation: "splash-bar-progress 1.5s cubic-bezier(0.16, 1, 0.3, 1) forwards",
          }}
        />
      </div>

      {/* Skip indicator hint */}
      <span className="text-[10px] text-slate-500/70 mt-3 hover:text-slate-400 transition-colors">
        Klik di mana saja untuk melanjutkan
      </span>
    </div>
  );
});
