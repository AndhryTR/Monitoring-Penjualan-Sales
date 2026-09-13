import { useState, useEffect, useRef } from "react";

/**
 * Hook untuk mendeteksi aksi drag-and-drop file di seluruh jendela browser (window).
 *
 * Menggunakan counter kedalaman drag (`dragCounterRef`) untuk mencegah efek flickering
 * saat kursor melintasi elemen-elemen anak (child DOM nodes) di dalam layar.
 *
 * @param {Object} options
 * @param {Function} options.onDropFiles - Callback saat file di-drop (menerima File[])
 * @param {boolean} [options.enabled=true] - Menentukan apakah listener aktif
 * @returns {{ isDragging: boolean }}
 */
export function useWindowDragDrop({ onDropFiles, enabled = true }) {
  const [isDragging, setIsDragging] = useState(false);
  const dragCounterRef = useRef(0);

  useEffect(() => {
    if (!enabled) return;

    const handleDragEnter = (e) => {
      // Pastikan yang di-drag adalah item berkas dari OS, bukan teks terpilih / elemen internal
      const types = e.dataTransfer ? Array.from(e.dataTransfer.types || []) : [];
      if (!types.includes("Files")) return;

      e.preventDefault();
      dragCounterRef.current += 1;
      if (dragCounterRef.current === 1) {
        setIsDragging(true);
      }
    };

    const handleDragOver = (e) => {
      const types = e.dataTransfer ? Array.from(e.dataTransfer.types || []) : [];
      if (!types.includes("Files")) return;

      // preventDefault penting agar browser tidak membuka berkas di tab baru saat drop
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
    };

    const handleDragLeave = (e) => {
      const types = e.dataTransfer ? Array.from(e.dataTransfer.types || []) : [];
      if (!types.includes("Files")) return;

      e.preventDefault();
      dragCounterRef.current -= 1;
      if (dragCounterRef.current <= 0) {
        dragCounterRef.current = 0;
        setIsDragging(false);
      }
    };

    const handleDrop = (e) => {
      const types = e.dataTransfer ? Array.from(e.dataTransfer.types || []) : [];
      if (!types.includes("Files")) return;

      e.preventDefault();
      dragCounterRef.current = 0;
      setIsDragging(false);

      if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        const files = Array.from(e.dataTransfer.files);
        onDropFiles?.(files);
      }
    };

    window.addEventListener("dragenter", handleDragEnter);
    window.addEventListener("dragover", handleDragOver);
    window.addEventListener("dragleave", handleDragLeave);
    window.addEventListener("drop", handleDrop);

    return () => {
      window.removeEventListener("dragenter", handleDragEnter);
      window.removeEventListener("dragover", handleDragOver);
      window.removeEventListener("dragleave", handleDragLeave);
      window.removeEventListener("drop", handleDrop);
    };
  }, [enabled, onDropFiles]);

  return { isDragging };
}
