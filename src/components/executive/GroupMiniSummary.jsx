import { useMemo } from "react";
import { Package } from "lucide-react";
import { fmtRp, fmtPct } from "../../utils/formatters.js";

/* ============================================================================
   GroupMiniSummary — Top 4 grup produk dengan mini horizontal bar
   yang warnanya mengikuti tingkat ACH (mint/gold/coral).
============================================================================ */

function GroupBar({ name, value, ach, maxValue, colors }) {
  const pct = maxValue > 0 ? (value / maxValue) * 100 : 0;
  const color = ach >= 1 ? colors.mint : ach >= 0.7 ? colors.gold : colors.coral;

  return (
    <div className="flex items-center gap-2.5 py-1.5">
      <span className="text-xs font-medium truncate w-20 shrink-0" style={{ color: colors.text }}>
        {name}
      </span>
      <div className="h-2 rounded-full overflow-hidden flex-1" style={{ background: colors.glassFill }}>
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${Math.min(100, pct)}%`, background: color }}
        />
      </div>
      <span className="text-xs mono shrink-0 text-right" style={{ minWidth: 70, color: colors.text }}>
        {fmtRp(value)}
      </span>
      <span className="mono text-xs font-semibold shrink-0 text-right" style={{ minWidth: 44, color }}>
        {fmtPct(ach)}
      </span>
    </div>
  );
}

export function GroupMiniSummary({ byGroup, colors, onNavigate }) {
  const groups = useMemo(() => {
    const sorted = [...byGroup].sort((a, b) => b.realisasiValue - a.realisasiValue);
    const top = sorted.slice(0, 4);
    const rest = sorted.length - 4;
    return { top, rest };
  }, [byGroup]);

  const maxValue = useMemo(() => Math.max(...groups.top.map((g) => g.realisasiValue), 1), [groups]);

  if (!groups.top.length) {
    return (
      <div className="text-center py-6" style={{ color: colors.textMuted }}>
        <Package size={24} className="mx-auto mb-2" style={{ opacity: 0.3 }} />
        <div className="text-xs">Belum ada data grup produk</div>
      </div>
    );
  }

  return (
    <div>
      {groups.top.map((g) => (
        <GroupBar key={g.name} name={g.name} value={g.realisasiValue} ach={g.ach} maxValue={maxValue} colors={colors} />
      ))}
      {groups.rest > 0 && (
        <div className="text-[10px] text-center pt-1.5" style={{ color: colors.textMuted }}>
          ... dan {groups.rest} grup lainnya
        </div>
      )}
    </div>
  );
}
