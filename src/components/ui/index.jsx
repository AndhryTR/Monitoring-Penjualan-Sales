import { Store } from "lucide-react";
import { fmtRp } from "../../utils/formatters.js";
import { getAchColor } from "../../constants/thresholds.js";

/* ============================================================================
   SECTIONTITLE
   Header kecil untuk section di dalam page: ikon + judul + sub-teks opsional.
============================================================================ */
export function SectionTitle({ title, sub, icon: Icon, colors, accent }) {
  const tint = accent || colors.gold;
  return (
    <div className="flex items-center gap-3 mb-4">
      {Icon && <div className="p-2 rounded-xl" style={{ background: tint + "1A" }}><Icon size={16} style={{ color: tint }} /></div>}
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="w-1 rounded-full shrink-0" style={{ background: tint, alignSelf: "stretch", minHeight: 20 }} />
        <div className="min-w-0">
          <h2 className="disp text-lg font-semibold">{title}</h2>
          {sub && <p className="text-xs" style={{ color: colors.textMuted }}>{sub}</p>}
        </div>
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
   ACH BAR CHART TOOLTIP
   Custom tooltip untuk bar chart vertikal yang menampilkan realisasi per
   entitas (sales / group) dengan warna teks mengikuti tier ACH.

   ⚠️ Bug fix (Sprint 3 / P4): sebelumnya `CustomTooltip` didefinisikan DI DALAM
   body komponen SalesReportPage & ProductReportPage. Setiap render produce
   new function ref → Recharts anggap new component type → `<Tooltip content={<CustomTooltip />}>`
   unmount+remount subtree di setiap render. Fix: hoist ke module scope (sini),
   komponen pass `colors` lewat props. Dua duplikat di Sales & Product report
   dihilangkan — sekarang shared component tunggal.
============================================================================ */
export function AchBarChartTooltip({ active, payload, label, colors }) {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    const barColor = getAchColor(data.ach, colors);
    return (
      <div
        className="p-3 rounded-xl pointer-events-none"
        style={{
          background: `radial-gradient(130% 90% at 12% -10%, ${colors.glassSheen || "rgba(255,255,255,0.12)"}, transparent 55%), ${colors.tooltipBg || (colors.colorScheme === "light" ? "rgba(255,255,255,0.68)" : "rgba(15,23,42,0.60)")}`,
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          border: `1px solid ${colors.modalBorder || colors.glassBorder}`,
          borderRadius: 12,
          boxShadow: `${colors.glassShadow || "0 8px 32px rgba(0,0,0,0.25)"}, inset 0 1px 0 ${colors.glassHighlight || "rgba(255,255,255,0.15)"}`,
          fontSize: 12,
        }}
      >
        <div className="font-semibold mb-1" style={{ color: colors.text }}>{label}</div>
        <div className="mono font-semibold" style={{ color: barColor }}>
          Realisasi: {fmtRp(data.realisasiValue)}
        </div>
      </div>
    );
  }
  return null;
}

export { CustomSlider } from "./CustomSlider.jsx";
export { CustomSelect } from "./CustomSelect.jsx";
export { ConfirmDialog } from "./ConfirmDialog.jsx";
export { GrowthBadge } from "./GrowthBadge.jsx";
export { OutletStatusBadge } from "./OutletStatusBadge.jsx";
export { TableScrollWrapper } from "./TableScrollWrapper.jsx";
export { Skeleton, KpiCardSkeleton } from "./Skeleton.jsx";
export { Modal } from "./Modal.jsx";
export { AccessRestricted } from "./AccessRestricted.jsx";
