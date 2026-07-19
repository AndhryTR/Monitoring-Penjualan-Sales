import React from "react";
import { useCountUp } from "../hooks/useCountUp";
import { fmtRp, fmtNum } from "../utils/formatters";

export function KpiCard({ label, value, sub, icon: Icon, accent, isMoney, isPct, delay = 0, colors }) {
  const numeric = isPct ? (value || 0) * 100 : (value || 0);
  const animated = useCountUp(numeric);
  const displayText = isMoney ? fmtRp(animated) : isPct ? animated.toFixed(1) + "%" : fmtNum(animated);
  const sizeClass = displayText.length > 13 ? "text-lg" : displayText.length > 8 ? "text-xl" : "text-2xl";

  return (
    <div className="glass-panel p-5 min-w-0 sm-fadeup relative overflow-hidden" style={{ animationDelay: `${delay}ms` }}>
      <div className="absolute top-0 left-0 right-0 h-[2px] rounded-full" style={{ background: `linear-gradient(90deg, transparent, ${accent}, transparent)`, opacity: 0.6 }} />
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs uppercase tracking-wider font-semibold" style={{ color: colors.textMuted }}>{label}</span>
        <div className="p-1.5 rounded-lg" style={{ background: accent + "1A" }}>
          <Icon size={14} style={{ color: accent }} />
        </div>
      </div>
      <div className={`disp ${sizeClass} font-bold mono`}>
        {displayText}
      </div>
      {sub && <div className="text-xs mt-1.5" style={{ color: colors.textMuted }}>{sub}</div>}
    </div>
  );
}
