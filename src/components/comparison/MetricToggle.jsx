import { COMPARISON_METRICS } from "../../utils/comparison.js";

/* ============================================================================
   METRICTOGGLE
   Toggle metrik yang dibandingkan di tab Perbandingan: Value / AO / Qty KARTON
   / ACH / Deviasi. Satu aktif (pola sama seperti toggle Value/AO di Tren).
============================================================================ */
export function MetricToggle({ metric, onChange, colors }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {COMPARISON_METRICS.map((m) => {
        const on = metric === m.key;
        return (
          <button key={m.key} onClick={() => onChange(m.key)}
            className="sm-btn px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
            style={{
              background: on ? colors.gold + "22" : colors.glassFill,
              border: `1px solid ${on ? colors.gold + "66" : colors.glassBorder}`,
              color: on ? colors.gold : colors.textMuted,
            }}>
            {m.label}
          </button>
        );
      })}
    </div>
  );
}
