import { ChevronRight } from "lucide-react";

/* ============================================================================
   SectionCard — wrapper panel reusable untuk Executive Summary
   Menyediakan judul, ikon, accent line di atas, dan tombol aksi opsional
   di pojok kanan bawah untuk navigasi ke halaman detail terkait.
============================================================================ */
export function SectionCard({ title, icon: Icon, accent, colors, actionLabel, onAction, children }) {
  return (
    <div className="sm-card p-5 sm-fadeup min-w-0 h-full flex flex-col">
      {/* Accent line tipis di atas */}
      <div className="sm-kpi-accent-line" style={{ background: `linear-gradient(90deg, ${accent}, ${accent}00)` }} />

      {/* Header */}
      <div className="flex items-center gap-2.5 mb-4">
        <div className="p-2 rounded-lg shrink-0" style={{ background: `${accent}1A` }}>
          <Icon size={16} style={{ color: accent }} />
        </div>
        <div className="disp text-sm font-bold" style={{ color: colors.text }}>{title}</div>
      </div>

      {/* Konten — flex-1 supaya tombol aksi tetap di bawah */}
      <div className="flex-1">{children}</div>

      {/* Tombol aksi (opsional) */}
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="sm-row mt-4 flex items-center gap-1.5 text-xs font-semibold self-start px-3 py-1.5 rounded-lg transition-colors"
          style={{ color: accent, background: `${accent}0D`, border: `1px solid ${accent}33` }}
        >
          {actionLabel} <ChevronRight size={13} />
        </button>
      )}
    </div>
  );
}
