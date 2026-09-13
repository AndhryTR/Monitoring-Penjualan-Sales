import React from "react";
import { ArrowUpRight, ArrowDownRight, Minus } from "lucide-react";
import { fmtPct } from "../../utils/formatters.js";

/**
 * Komponen terpusat untuk menampilkan badge atau teks pertumbuhan (growth).
 * Menggantikan duplikasi GrowthTag, inline panah, dan kalkulasi warna mint/coral di berbagai file.
 *
 * @param {object} props
 * @param {number|null} props.growth - nilai rasio pertumbuhan (mis. 0.15 untuk +15%, -0.08 untuk -8%)
 * @param {object} props.colors - token warna tema aktif
 * @param {"badge"|"inline"|"plain"} [props.variant="badge"] - gaya tampilan
 * @param {"sm"|"md"|"lg"} [props.size="sm"] - ukuran teks & ikon
 * @param {boolean} [props.showIcon=true] - apakah menampilkan ikon panah
 * @param {string} [props.className=""]
 */
export function GrowthBadge({
  growth,
  colors,
  variant = "badge",
  size = "sm",
  showIcon = true,
  className = "",
}) {
  if (growth === null || growth === undefined || Number.isNaN(growth)) {
    return <span className={`mono ${size === "lg" ? "text-base" : size === "md" ? "text-sm" : "text-xs"} ${className}`} style={{ color: colors.textMuted }}>-</span>;
  }

  const isPositive = growth > 0;
  const isZero = growth === 0;
  const color = isPositive ? colors.mint : isZero ? colors.textMuted : colors.coral;
  const Icon = isPositive ? ArrowUpRight : isZero ? Minus : ArrowDownRight;
  const iconSize = size === "lg" ? 16 : size === "md" ? 14 : 12;
  const textClass = size === "lg" ? "text-base" : size === "md" ? "text-sm" : "text-xs";

  if (variant === "inline") {
    return (
      <span
        className={`mono ${textClass} font-semibold inline-flex items-center gap-0.5 ${className}`}
        style={{ color }}
      >
        {showIcon && <Icon size={iconSize} className="shrink-0" />}
        <span>{isPositive ? "+" : ""}{fmtPct(growth)}</span>
      </span>
    );
  }

  if (variant === "plain") {
    return (
      <span
        className={`mono ${textClass} font-semibold ${className}`}
        style={{ color }}
      >
        {isPositive ? "+" : ""}{fmtPct(growth)}
      </span>
    );
  }

  // default: "badge" (pill with subtle background)
  return (
    <span
      className={`mono ${textClass} font-semibold inline-flex items-center gap-1 px-2 py-0.5 rounded-full ${className}`}
      style={{
        color,
        background: color + "1A",
        border: `1px solid ${color}44`,
      }}
    >
      {showIcon && <Icon size={iconSize} className="shrink-0" />}
      <span>{isPositive ? "+" : ""}{fmtPct(growth)}</span>
    </span>
  );
}

export default GrowthBadge;
