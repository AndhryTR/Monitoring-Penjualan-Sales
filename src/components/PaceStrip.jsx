import React from "react";
import { Sparkles } from "lucide-react";
import { fmtPct } from "../utils/formatters";
import { computePaceStatus } from "../utils/aggregation.js";

export function PaceStrip({ timeGonePct, achPct, colors }) {
  const capped = Math.min(100, (achPct || 0) * 100);
  const { isAhead } = computePaceStatus(achPct, timeGonePct);
  const color = isAhead === null ? colors.textMuted : isAhead ? colors.mint : colors.coral;
  const label = isAhead === null ? "Belum cukup data" : isAhead ? "Di atas pace waktu" : "Di bawah pace waktu";
  return (
    <div className="sm-card sm-fadeup p-5 mb-6">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Sparkles size={15} style={{ color: colors.gold }} />
          <span className="disp text-sm font-semibold">Pace ke Target</span>
        </div>
        <span className="text-xs mono" style={{ color }}>
          {label}
        </span>
      </div>
      <div className="relative h-4 rounded-full overflow-hidden" style={{ background: colors.glassFill }}>
        <div className="sm-progress-fill h-full rounded-full" style={{ width: `${capped}%`, background: `linear-gradient(90deg, ${color}99, ${color})` }} />
        <div className="absolute top-0 h-full w-[2px]" style={{ left: `${Math.min(100, timeGonePct * 100)}%`, background: colors.text, boxShadow: "0 0 4px rgba(0,0,0,0.35)" }} />
      </div>
      <div className="flex justify-between mt-2 text-xs mono" style={{ color: colors.textMuted }}>
        <span>ACH {fmtPct(achPct)}</span>
        <span>Time Gone {fmtPct(timeGonePct)}</span>
      </div>
    </div>
  );
}
