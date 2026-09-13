import { ArrowRight } from "lucide-react";

/* ============================================================================
   EMPTY STATE — reusable component untuk per-tab empty states.
   ⚠️ Sprint 10 / OB2: sebelumnya setiap tab punya inline empty state yang
   generik ("Belum ada data"). Sekarang: component reusable dengan icon +
   title + description + optional action button + contextual hint.

   Props:
   - icon: Lucide icon component
   - title: string (heading)
   - description: string (body text)
   - actionLabel: string (optional button text)
   - onAction: function (optional button handler)
   - hint: string (optional hint di bawah)
   - colors: theme colors object
============================================================================ */
export function EmptyState({ icon: Icon, title, description, actionLabel, onAction, hint, colors }) {
  return (
    <div className="sm-card p-12 text-center sm-fadeup">
      <div
        className="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center"
        style={{ background: colors.glassFill }}
      >
        {Icon && <Icon size={24} style={{ color: colors.textMuted }} />}
      </div>
      <div className="disp text-base font-semibold mb-1" style={{ color: colors.text }}>
        {title}
      </div>
      {description && (
        <p className="text-sm max-w-md mx-auto" style={{ color: colors.textMuted }}>
          {description}
        </p>
      )}
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="sm-btn mt-4 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold"
          style={{ background: colors.gold, color: "#0A1120" }}
        >
          {actionLabel} <ArrowRight size={14} />
        </button>
      )}
      {hint && (
        <p className="text-xs mt-3" style={{ color: colors.textMuted }}>
          {hint}
        </p>
      )}
    </div>
  );
}
