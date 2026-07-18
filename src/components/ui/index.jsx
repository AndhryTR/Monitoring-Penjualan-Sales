import { Store, ChevronDown } from "lucide-react";
import { useCollapsedSection } from "../../hooks/useCollapsedSection.js";

/* ============================================================================
   SECTIONTITLE
   Header kecil untuk section di dalam page: ikon + judul + sub-teks opsional.
============================================================================ */
export function SectionTitle({ title, sub, icon: Icon, colors }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      {Icon && <div className="p-2 rounded-xl" style={{ background: colors.gold + "1A" }}><Icon size={16} style={{ color: colors.gold }} /></div>}
      <div>
        <h2 className="disp text-lg font-semibold">{title}</h2>
        {sub && <p className="text-xs" style={{ color: colors.textMuted }}>{sub}</p>}
      </div>
    </div>
  );
}

/* ============================================================================
   COLLAPSIBLESECTION
   Sama seperti SectionTitle, tapi headernya bisa diklik untuk ciut/buka
   kontennya (chevron berputar sesuai status). Status disimpan per-section ke
   localStorage lewat useCollapsedSection (lihat hooks/useCollapsedSection.js)
   supaya diingat lintas sesi.

   `id` HARUS unik di seluruh app. `actions` opsional: elemen tambahan (mis.
   tombol toggle metode, tombol tutup) yang dirender DI LUAR area klik toggle
   supaya tidak ikut ke-trigger saat elemen itu sendiri diklik.
============================================================================ */
export function CollapsibleSection({ id, title, sub, icon: Icon, colors, actions, children, defaultOpen = true, className = "" }) {
  const [open, toggle] = useCollapsedSection(id, defaultOpen);
  return (
    <div className={className}>
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <button type="button" onClick={toggle} aria-expanded={open}
          className="sm-btn flex items-center gap-3 text-left min-w-0 flex-1">
          {Icon && <div className="p-2 rounded-xl shrink-0" style={{ background: colors.gold + "1A" }}><Icon size={16} style={{ color: colors.gold }} /></div>}
          <div className="min-w-0">
            <h2 className="disp text-lg font-semibold">{title}</h2>
            {sub && <p className="text-xs" style={{ color: colors.textMuted }}>{sub}</p>}
          </div>
          <ChevronDown size={18} className="shrink-0" style={{ color: colors.textMuted, transform: open ? "rotate(0deg)" : "rotate(-90deg)", transition: "transform 150ms ease" }} />
        </button>
        {actions}
      </div>
      {open && children}
    </div>
  );
}

/* ============================================================================
   DRILLDOWNBUTTON
   Tombol kecil untuk membuka modal drill-down outlet dari baris tabel.
============================================================================ */
export function DrilldownButton({ colors, onClick, label = "Outlet" }) {
  return (
    <button onClick={onClick} className="sm-btn inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium"
      style={{ background: colors.surface2, border: `1px solid ${colors.border}`, color: colors.textMuted }}>
      <Store size={12} /> {label}
    </button>
  );
}

/* ============================================================================
   CHART TOOLTIP STYLE
   Style object untuk tooltip Recharts yang dipakai di beberapa chart. Pusatkan
   di sini supaya konsisten dan tidak duplikasi.
============================================================================ */
export const createChartTooltipStyle = (colors) => ({
  background: colors.surface,
  border: `1px solid ${colors.border}`,
  borderRadius: 10,
  color: colors.text,
  fontSize: 12,
});
