import { useEffect, useRef } from "react";

/* ============================================================================
   useScrollLock — kunci scroll background saat modal/sheet terbuka.
   Dipakai oleh semua modal (LoginModal, SettingsModal, AboutModal,
   HistoryModal, DataPreviewModal, OutletDetailModal, OutletDrilldownModal,
   VisitPatternModal) + FilterBar mobile sheet.

   Sebelum Sprint 4: tidak ada modal yang lock scroll. Background bisa scroll
   di belakang modal → distracting UX, dan di mobile bisa cause layout jumps
   saat address bar hides/shows.

   Pattern: set document.body.style.overflow = "hidden" saat active,
   restore ke nilai sebelumnya saat unmount/close. Safe untuk nested
   modals (counter ref tracks berapa modal yang lock).
============================================================================ */

// Counter global supaya multiple modal yang lock tidak saling override.
// Hanya modal pertama yang simpan prev value; modal terakhir yang release
// restore ke prev value.
let lockCounter = 0;
let prevOverflow = "";

export function useScrollLock(active) {
  useEffect(() => {
    if (!active) return;

    // First lock: simpan prev value sebelum diubah.
    if (lockCounter === 0) {
      prevOverflow = document.body.style.overflow;
    }
    document.body.style.overflow = "hidden";
    lockCounter++;

    return () => {
      lockCounter--;
      // Last unlock: restore prev value. Bila ada modal lain masih lock
      // (counter > 0), tetap biarkan "hidden".
      if (lockCounter === 0) {
        document.body.style.overflow = prevOverflow;
      }
    };
  }, [active]);
}

/* ============================================================================
   useFocusTrap — kunci fokus keyboard di dalam container modal.
   Saat user tekan Tab/Shift-Tab, fokus berpindah antar elemen focusable DI
   DALAM modal saja — tidak escape ke background. Set initial focus ke
   elemen pertama yang focusable (atau ke container sendiri).

   Pattern:
   - Simpan elemen yang punya fokus sebelum modal dibuka; restore saat close.
   - Pada Tab di elemen terakhir → pindah ke elemen pertama.
   - Pada Shift+Tab di elemen pertama → pindah ke elemen terakhir.

   Dipakai oleh semua modal — implements WAI-ARIA modal dialog pattern.
============================================================================ */

const FOCUSABLE_SELECTORS = [
  "a[href]",
  "button:not([disabled])",
  "textarea:not([disabled])",
  'input:not([disabled]):not([type="hidden"])',
  "select:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
];

export function useFocusTrap(active, containerRef) {
  const prevActiveElementRef = useRef(null);

  useEffect(() => {
    if (!active || !containerRef?.current) return;

    const container = containerRef.current;
    const prevActive = document.activeElement;
    prevActiveElementRef.current = prevActive;

    // Helper: ambil semua elemen focusable di dalam container.
    const getFocusable = () => {
      const nodes = container.querySelectorAll(FOCUSABLE_SELECTORS.join(", "));
      return Array.from(nodes).filter(
        (el) => el.offsetParent !== null || el === document.activeElement
      );
    };

    // Set initial focus ke elemen pertama yang focusable, atau ke container
    // sendiri (tabindex=-1 supaya container bisa terima fokus programatik).
    const focusables = getFocusable();
    if (focusables.length > 0) {
      // Skip elemen dengan data-autofocus-skip (mis. tombol close — biasanya
      // kita mau fokus ke input pertama, bukan tombol close).
      const firstInput = focusables.find((el) => el.tagName === "INPUT" || el.tagName === "TEXTAREA");
      (firstInput || focusables[0]).focus();
    } else {
      container.setAttribute("tabindex", "-1");
      container.focus();
    }

    const handleKeydown = (e) => {
      if (e.key !== "Tab") return;
      const currentFocusables = getFocusable();
      if (currentFocusables.length === 0) {
        e.preventDefault();
        container.focus();
        return;
      }
      const first = currentFocusables[0];
      const last = currentFocusables[currentFocusables.length - 1];

      if (e.shiftKey) {
        // Shift+Tab di first → pindah ke last
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        // Tab di last → pindah ke first
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    container.addEventListener("keydown", handleKeydown);

    return () => {
      container.removeEventListener("keydown", handleKeydown);
      // Restore fokus ke elemen yang sebelumnya aktif (sebelum modal dibuka).
      // Bermanfaat untuk keyboard users yang membuka modal dari tombol — saat
      // modal tutup, fokus balik ke tombol itu, bukan hilang ke <body>.
      if (prevActiveElementRef.current && typeof prevActiveElementRef.current.focus === "function") {
        try {
          prevActiveElementRef.current.focus();
        } catch {
          // Element mungkin sudah di-unmount (mis. parent re-render). Abaikan.
        }
      }
    };
  }, [active, containerRef]);
}

/* ============================================================================
   useEscapeKey — pasang handler Escape untuk tutup modal/sheet/dropdown.
   Saat user tekan Escape, panggil callback (biasanya onClose).
============================================================================ */

export function useEscapeKey(active, onEscape) {
  useEffect(() => {
    if (!active) return;
    const onKey = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onEscape();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [active, onEscape]);
}
