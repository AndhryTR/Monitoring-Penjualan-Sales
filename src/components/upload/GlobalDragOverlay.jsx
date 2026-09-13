import { createPortal } from "react-dom";
import { Upload } from "lucide-react";

/**
 * GlobalDragOverlay — Tampilan overlay layar penuh saat pengguna men-drag
 * file dari OS / File Explorer ke dalam jendela browser aplikasi.
 *
 * Menggunakan pointer-events-none supaya drop event tetap jatuh langsung
 * ke listener window tanpa memicu dragleave/dragenter sekunder.
 *
 * @param {Object} props
 * @param {boolean} props.isDragging - Status apakah file sedang di-drag di atas window
 * @param {Object} props.colors - Objek warna tema aktif
 */
export function GlobalDragOverlay({ isDragging, colors }) {
  if (!isDragging) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] pointer-events-none flex items-center justify-center p-6 bg-black/65 backdrop-blur-md sm-fadein"
      aria-hidden="true"
    >
      <div
        className="w-full max-w-md rounded-3xl p-8 sm:p-10 flex flex-col items-center justify-center text-center shadow-2xl transition-all duration-300 pointer-events-none"
        style={{
          border: `2px dashed ${colors.mint}`,
          background: `radial-gradient(circle at center, ${colors.mint}22, ${colors.dropdownBg || "rgba(15,23,42,0.92)"})`,
          boxShadow: `0 25px 60px -15px ${colors.mint}33`,
        }}
      >
        <div
          className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl flex items-center justify-center mb-4 sm-scale-in"
          style={{
            background: `linear-gradient(135deg, ${colors.gold}, ${colors.coral})`,
            boxShadow: `0 10px 25px ${colors.gold}44`,
          }}
        >
          <Upload size={32} color="#0A1120" className="animate-bounce" />
        </div>
        <div className="disp text-lg sm:text-xl font-bold mb-1.5" style={{ color: colors.text }}>
          Lepaskan File Excel di Mana Saja
        </div>
        <p className="text-xs sm:text-sm max-w-xs sm:max-w-sm leading-relaxed" style={{ color: colors.textMuted }}>
          File akan otomatis dibaca dan diproses. Mendukung format{" "}
          <span className="mono font-semibold" style={{ color: colors.gold }}>.xlsx</span>,{" "}
          <span className="mono font-semibold" style={{ color: colors.gold }}>.xls</span>, dan{" "}
          <span className="mono font-semibold" style={{ color: colors.gold }}>.csv</span>.
        </p>
      </div>
    </div>,
    document.body
  );
}
