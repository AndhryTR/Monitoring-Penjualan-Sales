import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Check } from "lucide-react";
import { COMPARISON_BASE_OPTIONS } from "../../utils/comparisonBase.js";

/* ============================================================================
   BASESELECTOR — dropdown pilihan pembanding growth (prev / avg3 / avg6 / yoy)
   Dipakai di tab Tren Periode & Perbandingan. Dirender via createPortal ke
   document.body dengan posisi fixed (dihitung dari tombol) supaya TIDAK
   terjebak stacking-context kartu yang punya backdrop-filter (sm-card) dan
   tidak tertutup konten di bawahnya.
============================================================================ */
export function BaseSelector({ value, onChange, colors, compact = false }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState(null); // { top, left } utk portal fixed
  const ref = useRef(null);
  const ddRef = useRef(null); // ref dropdown (dirender di portal/body)

  useEffect(() => {
    if (!open) return;
    const onClickOutside = (e) => {
      if (ref.current && ref.current.contains(e.target)) return;
      if (ddRef.current && ddRef.current.contains(e.target)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  // ⚠️ Sprint 4 / M1: update posisi dropdown saat scroll/resize — sebelumnya
  // posisi hanya dihitung saat openMenu (1x). User scroll page → dropdown
  // fixed di posisi viewport lama, lepas dari tombol. PeriodPicker punya
  // pattern yang sama (line 53-83) dan sudah fix; BaseSelector belum.
  // Sekarang: pasang scroll (capture) + resize listener, recompute pos sama
  // seperti openMenu. Dropdown auto-close kalau tombol di-scroll keluar viewport
  // (supaya tidak tinggal di layar tanpa anchor).
  useEffect(() => {
    if (!open || !ref.current) return;
    const update = () => {
      const el = ref.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      // Kalau tombol sudah di-scroll keluar viewport vertikal, tutup dropdown
      // (jaga-jaga — lebih baik daripada dropdown melayang tanpa anchor).
      if (r.bottom < 0 || r.top > window.innerHeight) {
        setOpen(false);
        return;
      }
      setPos({ top: r.bottom + 4, left: r.left });
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open]);

  const current = COMPARISON_BASE_OPTIONS.find((o) => o.key === value) || COMPARISON_BASE_OPTIONS[0];

  const openMenu = () => {
    setOpen((o) => !o);
    // Posisi awal dihitung saat klik; effect [open] di atas akan terus update
    // saat scroll/resize.
    if (ref.current) {
      const r = ref.current.getBoundingClientRect();
      setPos({ top: r.bottom + 4, left: r.left });
    }
  };

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