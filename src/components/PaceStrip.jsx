import React from "react";
import { Sparkles } from "lucide-react";
import { COLORS } from "../constants/colors";
import { fmtPct } from "../utils/formatters";

export function PaceStrip({ timeGonePct, achPct }) {
  const capped = Math.min(100, (achPct || 0) * 100);
  const ahead = (achPct || 0) * 100 >= timeGonePct * 100;
  const color = ahead ? COLORS.mint : COLORS.coral;
  return (
    <div className="sm-card sm-fadeup p-5 mb-6">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Sparkles size={15} style={{ color: COLORS.gold }} />
          <span className="disp text-sm font-semibold">Pace ke Target</span>
        </div>
        <span className="text-xs mono" style={{ color }}>
          {ahead ? "Di atas pace waktu" : "Di bawah pace waktu"}
        </span>
      </div>
      <div className="relative h-4 rounded-full overflow-hidden" style={{ background: COLORS.surface2 }}>
        <div className="sm-progress-fill h-full rounded-full" style={{ width: `${capped}%`, background: `linear-gradient(90deg, ${color}99, ${color})` }} />
        <div className="absolute top-0 h-full w-[2px]" style={{ left: `${Math.min(100, timeGonePct * 100)}%`, background: "#fff" }} />
      </div>
      <div className="flex justify-between mt-2 text-xs mono" style={{ color: COLORS.textMuted }}>
        <span>ACH {fmtPct(achPct)}</span>
        <span>Time Gone {fmtPct(timeGonePct)}</span>
      </div>
    </div>
  );
}
