import React from "react";
import { ArrowUpRight, ArrowDownRight, Minus } from "lucide-react";
import { THEMES } from "../constants/colors";

export function AchBadge({ ach, colors }) {
  if (ach === null || ach === undefined) return <span className="mono text-xs" style={{ color: colors.textMuted }}>-</span>;
  const pct = ach * 100;
  const color = pct >= 100 ? colors.mint : pct >= 70 ? colors.gold : colors.coral;
  const Icon = pct >= 100 ? ArrowUpRight : pct >= 70 ? Minus : ArrowDownRight;
  return (
    <span className="mono text-xs font-semibold inline-flex items-center gap-1 px-2 py-0.5 rounded-full"
      style={{ color, background: color + "1A", border: `1px solid ${color}44` }}>
      <Icon size={12} /> {pct.toFixed(1)}%
    </span>
  );
}
