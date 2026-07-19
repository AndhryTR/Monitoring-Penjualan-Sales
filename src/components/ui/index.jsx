import { Store } from "lucide-react";

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
   DRILLDOWNBUTTON
   Tombol kecil untuk membuka modal drill-down outlet dari baris tabel.
============================================================================ */
export function DrilldownButton({ colors, onClick, label = "Outlet" }) {
  return (
    <button onClick={onClick} className="sm-btn inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium"
      style={{ background: colors.glassFill, border: `1px solid ${colors.glassBorder}`, color: colors.textMuted }}>
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
  background: colors.glassFillStrong,
  backdropFilter: "blur(20px)",
  WebkitBackdropFilter: "blur(20px)",
  border: `1px solid ${colors.glassBorderElevated}`,
  borderRadius: 10,
  color: colors.text,
  fontSize: 12,
  boxShadow: colors.glassShadow,
});
