// ⚠️ Umpan balik export — PASTI terlihat di semua platform.
//
// Dua jalur:
//  1. Toast OS native (Tauri): coba dulu. Di Windows butuh AUMID terdaftar di
//     Start Menu (hanya ada setelah install NSIS/MSI); exe portable gagal
//     diam-diam. Kalau jalan, dapat toast OS.
//  2. Toast in-window (ToastHost): SELALU tampil sebagai jaminan feedback.
//
// JS `@tauri-apps/plugin-notification` versi web pakai Web Notification API
// (`window.Notification`) yang di WebView2 origin tauri://localhost default
// 'denied'. Kita bypass & panggil command IPC Rust langsung.
import { showToast } from "./toastBus.js";

export async function notifyExportSuccess(title, body) {
  // Jaminan feedback — selalu tampil, tidak peduli native jalan atau tidak.
  showToast({ title: title || "Export berhasil", body });

  const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
  if (!isTauri) return;
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    const granted = await invoke("plugin:notification|is_permission_granted");
    if (granted !== true) {
      const state = await invoke("plugin:notification|request_permission");
      if (state !== "granted") return;
    }
    await invoke("plugin:notification|notify", { options: { title, body } });
  } catch (e) {
    // Native gagal — biarkan toast in-window yang tampil.
    console.warn("[notifyExport] native toast gagal, fallback in-window:", e);
  }
}