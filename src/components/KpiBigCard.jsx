import { useCountUp } from "../hooks/useCountUp";
import { fmtRp, fmtNum, fmtDeviasi } from "../utils/formatters.js";
import { KpiCardSkeleton } from "./ui/index.jsx";

/* ============================================================================
   KPI BIG CARD — card KPI besar dengan sparkline/progress bar + delta + hint.
   ⚠️ Sprint 11 / MR1: mengganti KpiCard lama (cramped, 6-kolom) dengan card
   yang lebih besar (3-kolom) berisi nilai + visual trend + delta + contextual hint.

   Variants:
   - "sparkline": mini SVG line chart (untuk value/time series)
   - "progress": progress bar dengan gradient warna ACH (untuk persentase)
   - "bar": progress bar solid (untuk ratio seperti AO/target)
   - "none": tanpa visual (plain value)

   Props:
   - label, value, isMoney, isPct, icon, accent
   - variant: "sparkline" | "progress" | "bar" | "none"
   - sparkData: number[] (untuk variant sparkline)
   - progressValue: number 0-1 (untuk variant progress/bar)
   - footerLabel: string (kiri, contextual hint)
   - footerDelta: string (kanan, +/- perubahan)
   - footerDeltaType: "pos" | "neg" | "neutral"
============================================================================ */

function MiniSparkline({ data, color, height = 36 }) {
  if (!data || data.length < 2) return null;
  const w = 100;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = height - ((v - min) / range) * (height - 4) - 2;
    return `${x},${y}`;
  });
  const linePath = `M${pts.join(" L")}`;
  const areaPath = `${linePath} L${w},${height} L0,${height} Z`;
  const gradId = `spark-big-${color.replace("#", "")}-${Math.random().toString(36).slice(2, 6)}`;
  return (
    <svg viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none" style={{ width: "100%", height, display: "block" }} aria-hidden="true">
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#${gradId})`} stroke="none" />
      <path d={linePath} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ProgressBar({ value, gradient }) {
  const pct = Math.max(0, Math.min(100, (value || 0) * 100));
  return (
    <div style={{ height: 6, background: "currentColor", borderRadius: 3, overflow: "hidden", opacity: 0.15, marginTop: 8, position: "relative" }}>
      <div
        style={{
          height: "100%",
          width: `${pct}%`,
          borderRadius: 3,
          background: gradient || "currentColor",
          transition: "width 0.8s cubic-bezier(.16,1,.3,1)",
        }}
      />
    </div>
  );
}

export function KpiBigCard({
  label, value, icon: Icon, accent, colors,
  isMoney, isPct, isPlain, isDeviasi,
  variant = "none",
  sparkData, progressValue, progressGradient,
  footerLabel, footerDelta, footerDeltaType = "neutral",
  delay = 0,
  loading = false,
}) {
  const numeric = isPct ? (value || 0) * 100 : (value || 0);
  const animated = useCountUp(numeric);

  if (loading) {
    return (
      <div className="sm-fadeup min-w-0 h-full" style={{ animationDelay: `${delay}ms` }}>
        <KpiCardSkeleton colors={colors} />
      </div>
    );
  }

  const displayText = isDeviasi ? fmtDeviasi(animated) : isMoney ? fmtRp(animated) : isPct ? animated.toFixed(1) + "%" : isPlain ? value : fmtNum(animated);

  const deltaColor = footerDeltaType === "pos" ? colors.mint : footerDeltaType === "neg" ? colors.coral : colors.textMuted;

  return (
    <div className="sm-glow-wrap sm-fadeup min-w-0 h-full" style={{ animationDelay: `${delay}ms` }}>
      <div className="sm-glow" style={{ background: accent }} />
      <div className="sm-card p-5 min-w-0 h-full" style={{ position: "relative", overflow: "hidden" }}>
        <div className="sm-kpi-accent-line" style={{ background: `linear-gradient(90deg, ${accent}, ${accent}00)` }} />

        {/* Header: label + icon */}
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs uppercase tracking-wider font-semibold" style={{ color: colors.textMuted }}>{label}</span>
          {Icon && (
            <div className="p-1.5 rounded-lg" style={{ background: accent + "1A" }}>
              <Icon size={14} style={{ color: accent }} />
            </div>
          )}
        </div>

        {/* Value */}
        <div
          className="disp text-2xl font-bold mono"
          style={{
            backgroundImage: `linear-gradient(90deg, ${accent}, ${colors.text})`,
            WebkitBackgroundClip: "text",
            backgroundClip: "text",
            color: "transparent",
            WebkitTextFillColor: "transparent",
          }}
        >
          {displayText}
        </div>

        {/* Visual: sparkline or progress bar */}
        {variant === "sparkline" && sparkData && sparkData.length > 1 && (
          <div className="mt-2 -mx-0.5">
            <MiniSparkline data={sparkData} color={accent} />
          </div>
        )}
        {variant === "progress" && (
          <ProgressBar value={progressValue} gradient={progressGradient} />
        )}
        {variant === "bar" && (
          <div style={{ height: 6, background: colors.glassSubtle, borderRadius: 3, overflow: "hidden", marginTop: 8 }}>
            <div style={{ height: "100%", width: `${Math.max(0, Math.min(100, (progressValue || 0) * 100))}%`, borderRadius: 3, background: accent, transition: "width 0.8s cubic-bezier(.16,1,.3,1)" }} />
          </div>
        )}

        {/* Footer: hint + delta */}
        {(footerLabel || footerDelta) && (
          <div className="flex items-center justify-between mt-3 pt-3" style={{ borderTop: `1px solid ${colors.glassBorder}` }}>
            {footerLabel && (
              <span className="text-xs" style={{ color: colors.textMuted }}>{footerLabel}</span>
            )}
            {footerDelta && (
              <span className="text-xs font-semibold" style={{ color: deltaColor }}>{footerDelta}</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
