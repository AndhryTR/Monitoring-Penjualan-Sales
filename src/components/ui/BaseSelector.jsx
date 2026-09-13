import { useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Check } from "lucide-react";
import { COMPARISON_BASE_OPTIONS } from "../../utils/comparisonBase.js";
import { useFloatingDropdown } from "../../hooks/useFloatingDropdown.js";

/* ============================================================================
   BASESELECTOR — dropdown pilihan pembanding growth (prev / avg3 / avg6 / yoy)
   Dipakai di tab Tren Periode & Perbandingan. Dirender via createPortal ke
   document.body dengan posisi fixed (dihitung dari tombol) supaya TIDAK
   terjebak stacking-context kartu yang punya backdrop-filter (sm-card) dan
   tidak tertutup konten di bawahnya.
============================================================================ */
export function BaseSelector({ value, onChange, colors, compact = false }) {
  const [open, setOpen] = useState(false);
  const { triggerRef: ref, floatingRef: ddRef, position: pos } = useFloatingDropdown({
    isOpen: open,
    onClose: () => setOpen(false),
    width: 240,
    estimatedHeight: 200,
    gap: 4,
  });

  const current = COMPARISON_BASE_OPTIONS.find((o) => o.key === value) || COMPARISON_BASE_OPTIONS[0];

  const openMenu = () => setOpen((o) => !o);

  return (
    <div className="relative" ref={ref}>
      <button onClick={openMenu}
        className="sm-btn inline-flex items-center gap-1.5 rounded-xl text-xs font-semibold"
        style={{ background: colors.glassFill, border: `1px solid ${colors.glassBorder}`, color: colors.text, padding: compact ? "5px 10px" : "6px 12px" }}>
        {!compact && <span style={{ color: colors.textMuted }}>Pembanding:</span>} {current.label}
        <ChevronDown size={12} style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform .2s" }} />
      </button>
      {open && pos && createPortal(
        <div ref={ddRef} className="fixed z-[9999] w-60 rounded-xl overflow-hidden sm-fadein"
          style={{ top: pos.top, left: pos.left >= 0 ? pos.left : 8, background: colors.modalBg, backdropFilter: "blur(32px)", WebkitBackdropFilter: "blur(32px)", border: `1px solid ${colors.modalBorder}`, boxShadow: colors.glassShadow }}>
          {COMPARISON_BASE_OPTIONS.map((o) => (
            <button key={o.key} onClick={() => { onChange(o.key); setOpen(false); }}
              className="sm-row w-full text-left px-3.5 py-2.5 flex items-center justify-between gap-2"
              style={{ color: value === o.key ? colors.mint : colors.text }}>
              <span className="text-sm font-medium">{o.label}</span>
              {value === o.key && <Check size={13} />}
            </button>
          ))}
        </div>,
        document.body
      )}
    </div>
  );
}