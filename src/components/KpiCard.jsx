import React from "react";
import { useCountUp } from "../hooks/useCountUp";
import { fmtRp, fmtNum } from "../utils/formatters";
import { THEMES } from "../constants/colors";

export function KpiCard({ label, value, sub, icon: Icon, accent, isMoney, isPct, delay = 0 }) {
  const numeric = isPct ? (value || 0) * 100 : (value || 0);
  const animated = useCountUp(numeric);
  return (
    <div className="sm-card sm-fadeup p-5" style={{ animationDelay: `${delay}ms` }}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs uppercase tracking-wider font-semibold" style={{ color: colors.textMuted }}>{label}</span>
        <div className="p-1.5 rounded-lg" style={{ background: accent + "1A" }}>
          <Icon size={14} style={{ color: accent }} />
        </div>
      </div>
      <div className="disp text-2xl font-bold mono">
        {isMoney ? fmtRp(animated) : isPct ? animated.toFixed(1) + "%" : fmtNum(animated)}
      </div>
      {sub && <div className="text-xs mt-1.5" style={{ color: colors.textMuted }}>{sub}</div>}
    </div>
  );
}
