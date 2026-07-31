import { ArrowUpRight, ArrowDownRight } from "lucide-react";
import { fmtRp, fmtNum, fmtPct } from "../../utils/formatters.js";

/* ============================================================================
   MATRIXKPITOTAL — total metrik aktif per entitas (semua periode terpilih).
   Kartu per entitas: nama, nilai total, growth badge antar 2 periode terakhir.
============================================================================ */
export function MatrixKpiTotal({ label, value, growth, isMoney, isPct, accent, colors }) {
  const growthColor = growth === null ? colors.textMuted : growth >= 0 ? colors.mint : colors.coral;
  const GrowthIcon = growth === null ? null : growth >= 0 ? ArrowUpRight : ArrowDownRight;
  const display = isPct ? (value === null || value === undefined ? "-" : fmtPct(value)) : isMoney ? fmtRp(value) : fmtNum(value);

  return (
    <div className="sm-card p-4 min-w-0" style={{ position: "relative", overflow: "hidden", borderTop: `2px solid ${accent}` }}>
      <div className="text-[10px] uppercase tracking-wider font-semibold mb-1 truncate" style={{ color: colors.textMuted }}>{label}</div>
      <div className="disp text-lg font-bold mono truncate" style={{ color: colors.text }}>{display}</div>
      {growth !== null && (
        <div className="flex items-center gap-1 text-xs mt-1 font-semibold" style={{ color: growthColor }}>
          {GrowthIcon && <GrowthIcon size={13} />} {fmtPct(Math.abs(growth))} <span className="font-normal opacity-70" style={{ color: colors.textMuted }}>vs prev</span>
        </div>
      )}
    </div>
  );
}
