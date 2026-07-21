import { useState, useEffect, useRef } from "react";
import { ChevronDown, Search, Check } from "lucide-react";

/* ============================================================================
   MULTISELECT
   Dropdown multi-select dengan search. Dipakai di FilterBar untuk filter
   Sales & Grup Barang.
============================================================================ */
export function MultiSelect({ label, icon: Icon, options, selected, onChange, placeholder, colors, fullWidth }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const ref = useRef(null);
  useEffect(() => {
    const onClick = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);
  const filtered = options.filter((o) => o.toLowerCase().includes(q.toLowerCase()));
  const toggle = (o) => onChange(selected.includes(o) ? selected.filter((x) => x !== o) : [...selected, o]);
  return (
    <div className={`relative z-20 ${fullWidth ? "w-full" : ""}`} ref={ref}>
      <button onClick={() => setOpen(!open)} className={`sm-btn flex items-center gap-2 px-3 py-2 rounded-xl text-sm ${fullWidth ? "w-full justify-between" : ""}`}
        style={{ background: colors.glassFill, border: `1px solid ${selected.length ? colors.gold + "88" : colors.glassBorder}` }}>
        <span className="flex items-center gap-2 min-w-0">
          <Icon size={14} style={{ color: colors.textMuted }} className="shrink-0" />
          <span className="truncate">{label}{selected.length ? ` (${selected.length})` : ""}</span>
        </span>
        <ChevronDown size={14} className="shrink-0" style={{ color: colors.textMuted, transform: open ? "rotate(180deg)" : "none", transition: "transform .2s" }} />
      </button>
      {open && (
        <div className="sm-fadein static md:absolute z-30 mt-2 w-full md:w-64 rounded-xl p-2"
          style={{ background: colors.modalBg, backdropFilter: "blur(32px)", WebkitBackdropFilter: "blur(32px)", border: `1px solid ${colors.modalBorder}`, boxShadow: colors.glassShadow }}>
          <div className="flex items-center gap-2 px-2 py-1.5 mb-1 rounded-lg" style={{ background: colors.glassSubtle }}>
            <Search size={13} style={{ color: colors.textMuted }} />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={placeholder || "Cari..."}
              className="bg-transparent outline-none text-sm w-full" style={{ color: colors.text }} />
          </div>
          <div className="max-h-56 overflow-y-auto">
            {filtered.length === 0 && <div className="text-xs px-2 py-2" style={{ color: colors.textMuted }}>Tidak ada hasil</div>}
            {filtered.map((o) => (
              <button key={o} onClick={() => toggle(o)} className="sm-row w-full text-left flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm">
                <div className="w-4 h-4 rounded flex items-center justify-center" style={{ background: selected.includes(o) ? colors.gold : "transparent", border: `1px solid ${selected.includes(o) ? colors.gold : colors.glassBorder}` }}>
                  {selected.includes(o) && <Check size={11} color="#0A1120" />}
                </div>
                <span className="truncate">{o}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
