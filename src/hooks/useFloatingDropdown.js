import { useState, useEffect, useRef, useCallback } from "react";
import { computeDropdownTop } from "../utils/dropdownPosition.js";

/**
 * Hook untuk mengelola posisi dan interaksi dropdown/popover yang di-render
 * via createPortal ke document.body.
 *
 * Fitur:
 * - Menghitung koordinat { top, left, width } dengan auto-flip jika ruang bawah sempit.
 * - Auto-close jika elemen trigger di-scroll ke luar viewport vertikal.
 * - Deteksi klik di luar (mendukung multi-ref untuk trigger dan portal menu).
 * - Menutup menu saat tombol Escape ditekan.
 * - Event listener resize & scroll (capture) otomatis dibersihkan saat menu tertutup/unmount.
 *
 * @param {Object} options
 * @param {boolean} options.isOpen - Status terbuka/tertutup dropdown
 * @param {Function} options.onClose - Callback saat dropdown harus ditutup
 * @param {"left"|"right"} [options.align="left"] - Penjajaran horizontal terhadap tombol trigger
 * @param {number|"match-trigger"} [options.width] - Lebar dropdown (px atau ikuti trigger)
 * @param {number} [options.minWidth=200] - Lebar minimum dropdown
 * @param {number} [options.estimatedHeight=300] - Estimasi tinggi dropdown untuk kalkulasi flip
 * @param {number} [options.gap=6] - Jarak antara tombol trigger dan dropdown (px)
 * @param {number} [options.margin=12] - Jarak aman minimum ke tepi layar (px)
 * @param {boolean} [options.autoCloseOnScrollOut=true] - Tutup otomatis jika trigger scroll keluar layar
 * @param {Array<React.RefObject>} [options.additionalRefs=[]] - Ref tambahan yang diabaikan saat klik luar
 */
export function useFloatingDropdown({
  isOpen,
  onClose,
  align = "left",
  width,
  minWidth = 200,
  estimatedHeight = 300,
  gap = 6,
  margin = 12,
  autoCloseOnScrollOut = true,
  additionalRefs = [],
}) {
  const triggerRef = useRef(null);
  const floatingRef = useRef(null);
  const [position, setPosition] = useState({ top: 0, left: 0, width: minWidth });

  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const additionalRefsRef = useRef(additionalRefs);
  additionalRefsRef.current = additionalRefs;

  const updatePosition = useCallback(() => {
    const rawEl = triggerRef.current;
    if (!rawEl) return;

    // Jika triggerRef adalah container pembungkus, prioritaskan tombol di dalamnya
    const el = rawEl.tagName === "BUTTON" ? rawEl : (rawEl.querySelector("button") || rawEl);
    const rect = el.getBoundingClientRect();

    // Auto-close jika trigger sudah berada di luar viewport
    if (autoCloseOnScrollOut && (rect.bottom < 0 || rect.top > window.innerHeight)) {
      onCloseRef.current?.();
      return;
    }

    // Hitung posisi vertikal (top) dengan proteksi flip ke atas
    const top = computeDropdownTop(rect, estimatedHeight, { gap, margin });

    // Hitung target width
    let targetWidth;
    if (width === "match-trigger") {
      targetWidth = rect.width;
    } else if (typeof width === "number") {
      targetWidth = width;
    } else {
      targetWidth = Math.max(minWidth, rect.width || minWidth);
    }

    // Hitung posisi horizontal (left)
    let left = align === "right" ? rect.right - targetWidth : rect.left;

    // Proteksi batas layar kanan dan kiri
    if (left + targetWidth > window.innerWidth - margin) {
      left = window.innerWidth - targetWidth - margin;
    }
    if (left < margin) {
      left = margin;
    }

    setPosition((prev) => {
      if (prev.top === top && prev.left === left && prev.width === targetWidth) {
        return prev;
      }
      return { top, left, width: targetWidth };
    });
  }, [align, width, minWidth, estimatedHeight, gap, margin, autoCloseOnScrollOut]);

  // Update posisi saat isOpen berubah, window resize, atau scroll
  useEffect(() => {
    if (!isOpen) return;

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);

    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [isOpen, updatePosition]);

  // Handler klik di luar dan Escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e) => {
      if (triggerRef.current && triggerRef.current.contains(e.target)) return;
      if (floatingRef.current && floatingRef.current.contains(e.target)) return;
      if (additionalRefsRef.current?.some((ref) => ref?.current && ref.current.contains(e.target))) return;

      onCloseRef.current?.();
    };

    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onCloseRef.current?.();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  return {
    triggerRef,
    floatingRef,
    position,
    updatePosition,
  };
}
