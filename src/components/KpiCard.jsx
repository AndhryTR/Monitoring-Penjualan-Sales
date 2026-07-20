import React from "react";
import { useCountUp } from "../hooks/useCountUp";
import { fmtRp, fmtNum } from "../utils/formatters";

// Sparkline mini tanpa axis/label — cuma garis tren + fill gradient tipis di
// bawahnya, warnanya ikut accent card. SVG manual (bukan Recharts) karena
// ukurannya kecil & sekali pakai, tidak perlu overhead komponen chart penuh.
function Sparkline({ data, color, height = 28 }) {
  if (!data || data.length < 2) return null;
  const w = 100;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = height - ((v - min) / range) * height;
    return `${x},${y}`;
  });
  const linePath = `M${pts.join(" L")}`;
  const areaPath = `${linePath} L${w},${height} L0,${height} Z`;
  const gradId = `spark-${color.replace("#", "")}`;
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

export function KpiCard({ label, value, sub, icon: Icon, accent, isMoney, isPct, delay = 0, colors, trend }) {
  const numeric = isPct ? (value || 0) * 100 : (value || 0);
  const animated = useCountUp(numeric);
  const displayText = isMoney ? fmtRp(animated) : isPct ? animated.toFixed(1) + "%" : fmtNum(animated);

  // Ukuran font adaptif berdasarkan PANJANG TEKS hasil format, bukan breakpoint
  // layar — soalnya masalahnya murni angka besar (mis. "Rp 123.456.789" untuk
  // value 9+ digit) yang lebih lebar dari card di grid sempit (lg:grid-cols-6),
  // bukan soal ukuran layar. Tanpa ini, angka >8 digit bisa tumpah keluar box.
  const sizeClass = displayText.length > 13 ? "text-lg" : displayText.length > 8 ? "text-xl" : "text-2xl";

  return (
    <div className="sm-glow-wrap sm-fadeup min-w-0 h-full" style={{ animationDelay: `${delay}ms` }}>
      <div className="sm-glow" style={{ background: accent }} />
      <div className="sm-card p-5 min-w-0 h-full" style={{ position: "relative", overflow: "hidden" }}>
        <div className="sm-kpi-accent-line" style={{ background: `linear-gradient(90deg, ${accent}, ${accent}00)` }} />
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs uppercase tracking-wider font-semibold" style={{ color: colors.textMuted }}>{label}</span>
          <div className="p-1.5 rounded-lg" style={{ background: accent + "1A" }}>
            <Icon size={14} style={{ color: accent }} />
          </div>
        </div>
        <div
          className={`disp ${sizeClass} font-bold mono`}
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
        {trend && trend.length > 1 && (
          <div className="mt-2 -mx-0.5">
            <Sparkline data={trend} color={accent} />
          </div>
        )}
        {sub && <div className="text-xs mt-1.5" style={{ color: colors.textMuted }}>{sub}</div>}
      </div>
    </div>
  );
}
