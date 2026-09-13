import React from "react";
import { OUTLET_STATUS_META } from "../../constants/thresholds.js";

/**
 * Komponen badge untuk status outlet (Aktif, Berisiko, Dormant).
 * Diekstrak dari OutletAnalysisPage agar tidak memicu static import dari page ke modal.
 *
 * @param {object} props
 * @param {"active"|"at_risk"|"dormant"|"unknown"|string} props.status
 * @param {object} props.colors
 * @param {string} [props.className=""]
 */
export function OutletStatusBadge({ status, colors, className = "" }) {
  const meta = OUTLET_STATUS_META[status] || OUTLET_STATUS_META.unknown;
  const color = colors[meta.color] || colors.textMuted;
  return (
    <span
      className={`text-xs font-semibold inline-flex items-center px-2 py-0.5 rounded-full ${className}`}
      style={{
        color,
        background: color + "1A",
        border: `1px solid ${color}44`,
      }}
    >
      {meta.label}
    </span>
  );
}

export default OutletStatusBadge;
