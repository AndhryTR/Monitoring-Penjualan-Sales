import React, { useRef } from "react";
import { Upload, RefreshCw } from "lucide-react";

/* ============================================================================
   MOBILE FAB (H6)
   - Tombol apung "Upload" di pojok kanan bawah (di atas bottom nav).
   - Menghormati iOS safe-area-inset supaya tidak tertutup home indicator.
============================================================================ */

export function MobileFab({ onFile, colors, loading }) {
  const inputRef = useRef(null);
  const handleFiles = (files) => {
    if (files && files.length) onFile(Array.from(files));
    // Reset value supaya file yang sama bisa dipilih lagi setelahnya
    if (inputRef.current) inputRef.current.value = "";
  };
  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls,.csv"
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
      <div
        className="md:hidden fixed right-4 z-30 pointer-events-none sm-glow-breath"
        style={{
          bottom: "calc(96px + env(safe-area-inset-bottom))",
          width: 56,
          height: 56,
          borderRadius: "9999px",
          background: `linear-gradient(135deg, ${colors.skyblue}, ${colors.blue})`,
          filter: "blur(20px)",
        }}
        aria-hidden="true"
      />
      <button
        onClick={() => inputRef.current && inputRef.current.click()}
        className="md:hidden fixed right-4 z-40 sm-btn group flex items-center justify-center w-14 h-14 rounded-full active:scale-90 select-none"
        style={{
          bottom: "calc(96px + env(safe-area-inset-bottom))",
          background: `linear-gradient(135deg, ${colors.skyblue}, ${colors.blue})`,
          color: "#0A1120",
          boxShadow: "0 8px 24px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.35)",
          transition: "transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.2s ease",
        }}
        aria-label="Upload file Excel sell-out"
      >
        {loading ? <RefreshCw size={22} className="sm-pulse" /> : <Upload size={22} className="transition-transform duration-250 ease-out group-hover:-translate-y-0.5 group-active:scale-90" />}
      </button>
    </>
  );
}
