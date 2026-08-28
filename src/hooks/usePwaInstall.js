import { useState, useMemo, useEffect, useCallback } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";

/* ============================================================================
   usePwaInstall — hook untuk PWA install prompt + service worker update.

   ⚠️ Sprint 6 / R5: sebelumnya inline di SalesMonitoringApp.jsx (~60 baris
   state + effects + handlers). Dipisah ke hook supaya SalesMonitoringApp.jsx
   fokus jadi orchestrator.

   Hook ini mengelola:
   - Service worker update notification (needRefresh, offlineReady, updateServiceWorker)
     dari vite-plugin-pwa `useRegisterSW`.
   - Install prompt: capture `beforeinstallprompt` event (Chrome/Android/Edge)
     supaya tidak auto-popup, expose `handleInstallClick` untuk trigger manual.
   - iOS detection (termasuk iPad iOS 13+ yang report MacIntel UA) — Sprint 2 H5.
   - `isStandalone` (apakah app sudah di-install sebagai PWA).
   - `canShowInstallButton` — derived flag untuk render tombol install di UI.
============================================================================ */
export function usePwaInstall() {
  // ---- Service worker registration (vite-plugin-pwa) ----
  // registerType: 'prompt' di vite.config.js — kalau ada versi baru ter-deploy,
  // tidak langsung auto-reload (bisa bikin data yang lagi diisi hilang),
  // tapi tampilkan notifikasi dan biarkan user pilih kapan mau refresh.
  //
  // ⚠️ Fix cache UI lama di shell desktop (Tauri): di dalam WebView2 Tauri,
  // service worker PWA justru merugikan — aset app sudah embedded di exe
  // (offline pasti jalan), sedangkan SW dari build sebelumnya menyajikan
  // bundle LAMA dari precache → exe baru tampil UI lama. Solusi: hook tetap
  // dipanggil unconditional (aturan hooks), tapi opsi `immediate: false`
  // di Tauri → registrasi SW tidak pernah dijalankan. Deteksi via
  // `__TAURI_INTERNALS__` (global yang di-inject Tauri v2 di WebView2).
  const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW({ immediate: !isTauri });

  // Bersihkan SW basi yang mungkin sudah terlanjur terdaftar dari build
  // desktop sebelumnya (sebelum fix ini). Unregister + hapus precache-nya.
  useEffect(() => {
    if (!isTauri || !navigator.serviceWorker) return;
    navigator.serviceWorker.getRegistrations().then((regs) => {
      regs.forEach((r) => r.unregister());
      if (regs.length && typeof caches !== "undefined") {
        caches.keys().then((keys) =>
          keys.filter((k) => k.startsWith("workbox-precache")).forEach((k) => caches.delete(k))
        );
      }
    }).catch(() => {});
  }, [isTauri]);

  // ---- Install prompt (Chrome/Android/Edge) + iOS fallback hint ----
  const [installPromptEvent, setInstallPromptEvent] = useState(null);
  const [showIosInstallHint, setShowIosInstallHint] = useState(false);

  // ⚠️ Bug fix (Sprint 2 / H5): sebelumnya `/iphone|ipad|ipod/i.test(navigator.userAgent)`
  // — TIDAK detect iPad iOS 13+, yang default report UA Mac Safari
  // (`navigator.platform === 'MacIntel'` + touch support). Akibatnya iPad
  // users tidak pernah lihat install hint. Sekarang: cek tambahan platform
  // MacIntel + maxTouchPoints > 1 untuk iPad iOS 13+ detection.
  const isIOS = useMemo(() => {
    const ua = (typeof navigator !== "undefined" && navigator.userAgent) || "";
    const isLegacyIOS = /iphone|ipad|ipod/i.test(ua);
    const isIPadOS13Plus = (
      typeof navigator !== "undefined" &&
      navigator.platform === "MacIntel" &&
      (navigator.maxTouchPoints || 0) > 1
    );
    return isLegacyIOS || isIPadOS13Plus;
  }, []);
  const isStandalone = useMemo(() =>
    (typeof window !== "undefined" && window.matchMedia?.("(display-mode: standalone)").matches) ||
    (typeof navigator !== "undefined" && navigator.standalone === true)
  , []);

  useEffect(() => {
    // Chrome/Android/Edge menembak event ini kalau app memenuhi syarat installability
    // (manifest valid, service worker terdaftar, dsb). Kita cegah prompt otomatis
    // browser (preventDefault), simpan eventnya, lalu munculkan tombol custom sendiri.
    const handler = (e) => { e.preventDefault(); setInstallPromptEvent(e); };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstallClick = useCallback(async () => {
    if (installPromptEvent) {
      installPromptEvent.prompt();
      await installPromptEvent.userChoice;
      setInstallPromptEvent(null);
    } else if (isIOS) {
      // iOS Safari tidak punya beforeinstallprompt — harus manual lewat menu Share.
      setShowIosInstallHint(true);
    }
  }, [installPromptEvent, isIOS]);

  const canShowInstallButton = !isTauri && !isStandalone && (!!installPromptEvent || isIOS);

  return {
    // Service worker update
    needRefresh, setNeedRefresh,
    offlineReady, setOfflineReady,
    updateServiceWorker,
    // Install
    installPromptEvent,
    showIosInstallHint, setShowIosInstallHint,
    isIOS,
    isStandalone,
    handleInstallClick,
    canShowInstallButton,
  };
}
