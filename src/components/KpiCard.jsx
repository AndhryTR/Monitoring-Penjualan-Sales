import React from "react";
import { useCountUp } from "../hooks/useCountUp";
import { fmtRp, fmtNum } from "../utils/formatters";
import { THEMES } from "../constants/colors";

export function KpiCard({ label, value, sub, icon: Icon, accent, isMoney, isPct, delay = 0, colors }) {
  const numeric = isPct ? (value || 0) * 100 : (value || 0);
  const animated = useCountUp(numeric);
  const displayText = isMoney ? fmtRp(animated) : isPct ? animated.toFixed(1) + "%" : fmtNum(animated);

  // Ukuran font adaptif berdasarkan PANJANG TEKS hasil format, bukan breakpoint
  // layar — soalnya masalahnya murni angka besar (mis. "Rp 123.456.789" untuk
  // value 9+ digit) yang lebih lebar dari card di grid sempit (lg:grid-cols-6),
  // bukan soal ukuran layar. Tanpa ini, angka >8 digit bisa tumpah keluar box.
  const sizeClass = displayText.length > 8 ? "text-lg" : displayText.length > 6 ? "text-xl" : "text-2xl";

  return (
    <div className="sm-card sm-fadeup p-5 min-w-0" style={{ animationDelay: `${delay}ms` }}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs uppercase tracking-wider font-semibold" style={{ color: colors.textMuted }}>{label}</span>
        <div className="p-1.5 rounded-lg" style={{ background: accent + "1A" }}>
          <Icon size={14} style={{ color: accent }} />
        </div>
      </div>
      {/* overflow-hidden + text-ellipsis + whitespace-nowrap = safety net kalau
          angkanya tetap kepanjangan meski font sudah diperkecil (mis. layar HP
          sangat sempit) — dipotong dengan "…", tidak pernah tumpah keluar box.
          title= memberi tooltip native browser (hover desktop / tap-hold mobile)
          supaya user tetap bisa lihat angka lengkap kalau terpotong. */}
      <div className={`disp ${sizeClass} font-bold mono`} title={displayText}>
        {displayText}
      </div>
      {sub && <div className="text-xs mt-1.5" style={{ color: colors.textMuted }}>{sub}</div>}
    </div>
  );
}
