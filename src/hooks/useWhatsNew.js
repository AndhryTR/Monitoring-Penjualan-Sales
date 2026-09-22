import { useState, useEffect, useCallback } from "react";
import changelogData from "../data/changelog.json";

const STORAGE_KEY = "sm_last_seen_version";

/**
 * Hook untuk mengelola modal catatan pembaruan ("What's New").
 * - Otomatis mendeteksi jika versi aplikasi saat ini lebih baru dari versi yang tersimpan di localStorage.
 * - Membuka modal secara otomatis saat pertama kali dibuka setelah update.
 * - Menyediakan trigger manual untuk dibuka dari menu Tentang Aplikasi atau Footer.
 */
export function useWhatsNew() {
  const [isOpen, setIsOpen] = useState(false);
  const [hasUnread, setHasUnread] = useState(false);

  const currentRelease = changelogData && changelogData.length > 0 ? changelogData[0] : null;
  const currentVersion = currentRelease ? currentRelease.version : "4.1.0";

  // Cek apakah ada versi baru saat komponen pertama kali di-mount
  useEffect(() => {
    try {
      const lastSeen = localStorage.getItem(STORAGE_KEY);
      if (lastSeen !== currentVersion) {
        setHasUnread(true);
        // Buka otomatis jika versi berbeda
        setIsOpen(true);
      } else {
        setHasUnread(false);
      }
    } catch {
      // Fallback aman jika localStorage tidak dapat diakses
      setHasUnread(false);
    }
  }, [currentVersion]);

  // Tandai versi saat ini sebagai sudah dibaca
  const dismiss = useCallback(() => {
    try {
      localStorage.setItem(STORAGE_KEY, currentVersion);
      setHasUnread(false);
    } catch {
      // Abaikan error storage di mode private browsing ketat
    }
    setIsOpen(false);
  }, [currentVersion]);

  // Buka modal secara manual (misal dari About atau Footer)
  const open = useCallback(() => {
    setIsOpen(true);
  }, []);

  const close = useCallback(() => {
    dismiss();
  }, [dismiss]);

  return {
    isOpen,
    hasUnread,
    open,
    close,
    dismiss,
    currentVersion,
    changelogData,
    currentRelease,
  };
}
