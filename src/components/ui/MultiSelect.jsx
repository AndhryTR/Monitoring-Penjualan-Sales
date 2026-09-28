import { useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Search, Check } from "lucide-react";
import { useFloatingDropdown } from "../../hooks/useFloatingDropdown.js";

/* ============================================================================
   MULTISELECT
   Dropdown multi-select dengan search. Dipakai di FilterBar untuk filter
   Sales & Grup Barang.

   ⚠️ Sprint 18d15 / Bugfix: dropdown dirender via createPortal ke document.body
   supaya KELUAR dari parent container (FilterBar → sm-card header sticky z-40).
   Sebelumnya dropdown pakai z-30 yang lebih rendah dari sticky header z-40 →
   dropdown tertutup header saat scroll. Juga pakai colors.dropdownBg (theme-aware)
   bukan colors.modalBg (alpha 0.20, terlalu transparan).
============================================================================ */
export function MultiSelect({ label, icon: Icon, options, selected, onChange, placeholder, colors, fullWidth }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");

  const { triggerRef: ref, floatingRef: dropdownRef, position: dropdownPos } = useFloatingDropdown({
    isOpen: open,
    onClose: () => setOpen(false),
    minWidth: 256,
    estimatedHeight: 300,
  });

  const filtered = options.filter((o) => o.toLowerCase().includes(q.toLowerCase()));
  const toggle = (o) => onChange(selected.includes(o) ? selected.filter((x) => x !== o) : [...selected, o]);

  return (
    <div className={`relative z-20 ${fullWidth ? "w-full" : ""}`} ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={label}
        className={`sm-btn flex items-center gap-2 px-3 py-2 rounded-xl text-sm ${fullWidth ? "w-full justify-between" : ""}`}
        style={{ background: colors.glassFill, border: `1px solid ${selected.length ? colors.gold + "88" : colors.glassBorder}` }}>
        <span className="flex items-center gap-2 min-w-0">
          <Icon size={14} style={{ color: colors.textMuted }} className="shrink-0" />
          <span className="truncate">{label}{selected.length ? ` (${selected.length})` : ""}</span>
        </span>
        <ChevronDown size={14} className="shrink-0" style={{ color: colors.textMuted, transform: open ? "rotate(180deg)" : "none", transition: "transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)" }} />
      </button>
      {open && createPortal(
        <div
          ref={dropdownRef}
          role="listbox"
          aria-label={label}
          aria-multiselectable="true"
          className="sm-dropdown-pop fixed z-[60] rounded-xl p-2"
          style={{
            top: dropdownPos.top,
            left: dropdownPos.left,
            width: dropdownPos.width,
            color: colors.text,
            background: `radial-gradient(120% 60% at 15% -5%, ${colors.glassSheen || "rgba(255,255,255,0.10)"}, transparent 55%), ${colors.dropdownBg}`,
            backdropFilter: "blur(32px) saturate(1.4)",
            WebkitBackdropFilter: "blur(32px) saturate(1.4)",
            border: `1px solid ${colors.dropdownBorder}`,
            boxShadow: `${colors.glassShadow}, inset 0 1px 0 ${colors.glassHighlight || "rgba(255,255,255,0.08)"}`,
          }}
        >
          <div className="flex items-center gap-2 px-2 py-1.5 mb-1 rounded-lg" style={{ background: colors.glassSubtle }}>
            <Search size={13} style={{ color: colors.textMuted }} />
            <input
              type="text"
              aria-label={placeholder || "Cari opsi..."}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={placeholder || "Cari..."}
              className="bg-transparent outline-none text-sm w-full"
              style={{ color: colors.text }}
            />
          </div>
          <div className="max-h-56 overflow-y-auto">
            {filtered.length === 0 && <div className="text-xs px-2 py-2" style={{ color: colors.textMuted }}>Tidak ada hasil</div>}
            {filtered.map((o, idx) => (
              <button
                key={o}
                onClick={() => toggle(o)}
                role="option"
                aria-selected={selected.includes(o)}
                className="sm-row sm-fadein w-full text-left flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm cursor-pointer"
                style={{ animationDelay: `${Math.min(idx * 16, 160)}ms` }}
              >
                <div
                  className="w-4 h-4 rounded flex items-center justify-center transition-all duration-200"
                  style={{
                    background: selected.includes(o) ? colors.gold : "transparent",
                    border: `1px solid ${selected.includes(o) ? colors.gold : colors.glassBorder}`,
                    transform: selected.includes(o) ? "scale(1.05)" : "scale(1)",
                  }}
                >
                  {selected.includes(o) && <Check size={11} color="#0A1120" className="sm-check-pop" />}
                </div>
                <span className="truncate">{o}</span>
              </button>
            ))}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
