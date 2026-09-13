import { fmtRp, fmtNum, fmtPct } from "../../utils/formatters.js";
import { GrowthBadge } from "../ui/GrowthBadge.jsx";

/* ============================================================================
   MATRIXKPITOTAL — nilai metrik periode TERAKHIR per entitas + growth badge.
   - value        : nilai metrik pada periode terakhir yang punya data (current).
   - periodLabel  : label periode asal nilai tsb (mis. "Apr 2025") supaya
                    pengguna tahu angka besar di atas itu periode mana — agar
                    tidak ambigu dan konsisten dengan growth badge di bawah.
   - growth       : % pertumbuhan current vs baseline (prev/avg3/avg6/yoy).
   Catatan: sebelumnya value = Σ semua periode, yang tidak ada hubungannya
   dengan % growth di bawah → membingungkan. Sekarang value = current.
============================================================================ */
export function MatrixKpiTotal({ label, value, periodLabel, growth, isMoney, isPct, accent, colors }) {
  const display = value === null || value === undefined
    ? "-"
    : isPct ? fmtPct(value) : isMoney ? fmtRp(value) : fmtNum(value);

  return (
    <div className="sm-card p-4 min-w-0" style={{ position: "relative", overflow: "hidden", borderTop: `2px solid ${accent}` }}>
      <div className="text-[10px] uppercase tracking-wider font-semibold mb-1 truncate" style={{ color: colors.textMuted }}>{label}</div>
      <div className="disp text-lg font-bold mono truncate" style={{ color: colors.text }}>{display}</div>
      {periodLabel && (
        <div className="text-[10px] mt-0.5 truncate" style={{ color: colors.textMuted }}>{periodLabel}</div>
      )}
      {growth !== null && (
        <div className="flex items-center gap-1 text-xs mt-1 font-semibold">
          <GrowthBadge growth={growth} colors={colors} variant="inline" />
          <span className="font-normal opacity-70" style={{ color: colors.textMuted }}>vs prev</span>
        </div>
      )}
    </div>
  );
}
