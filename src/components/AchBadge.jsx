import React from "react";
import { ArrowUpRight, ArrowDownRight, Minus } from "lucide-react";
import { getAchColor, ACH_TIERS } from "../constants/thresholds.js";
import { fmtPct } from "../utils/formatters.js";

export function AchBadge({ ach, colors }) {
  if (ach === null || ach === undefined || Number.isNaN(ach)) {
    return <span className="mono text-xs" style={{ color: colors.textMuted }}>-</span>;
  }
  const color = getAchColor(ach, colors);
  const Icon = ach >= ACH_TIERS.onPace ? ArrowUpRight : ach >= ACH_TIERS.warning ? Minus : ArrowDownRight;
  return (
    <span className="mono text-xs font-semibold inline-flex items-center gap-1 px-2 py-0.5 rounded-full"
      style={{ color, background: color + "1A", border: `1px solid ${color}44` }}>
      <Icon size={12} /> {fmtPct(ach)}
    </span>
  );
}
