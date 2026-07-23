import { useMemo } from "react";
import { Trophy, AlertTriangle, TrendingUp, TrendingDown } from "lucide-react";
import { fmtRp, fmtPct } from "../../utils/formatters.js";

/* ============================================================================
   MiniLeaderboard — Top 3 sales (merit) + bottom 2 sales (perhatian)
   dengan mini progress bar, ACH badge, dan indikator naik/turun.
============================================================================ */

function MiniBar({ pct, color, colors }) {
  const capped = Math.min(100, (pct || 0) * 100);
  return (
    <div className="h-1.5 rounded-full overflow-hidden flex-1 mx-2" style={{ background: colors.glassFill }}>
      <div
        className="h-full rounded-full transition-all duration-700"
        style={{ width: `${capped}%`, background: color, transition: "width 1s cubic-bezier(.16,1,.3,1)" }}
      />
    </div>
  );
}

function SalesRow({ rank, name, value, ach, projectedAch, isWarning, colors, onNavigate }) {
  const color = ach >= 1 ? colors.mint : ach >= 0.7 ? colors.gold : colors.coral;
  return (
    <div
      className="sm-row flex items-center gap-2.5 px-3 py-2 rounded-xl"
      style={{ background: isWarning ? `${colors.coral}0D` : rank <= 3 ? `${colors.gold}08` : "transparent" }}
    >
      {/* Rank / medal */}
      <div className="w-6 text-center shrink-0 text-sm">
        {rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : <AlertTriangle size={14} style={{ color: colors.coral }} />}
      </div>

      {/* Nama + value */}
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate flex items-center gap-1.5">
          {name}
          {projectedAch !== null && projectedAch !== undefined && (
            <span className="text-[10px] mono opacity-60" style={{ color: colors.textMuted }}>
              (proy.{fmtPct(projectedAch)})
            </span>
          )}
        </div>
        <div className="text-xs mono truncate" style={{ color: colors.textMuted }}>
          {fmtRp(value)}
        </div>
      </div>

      {/* Mini progress bar */}
      <MiniBar pct={ach} color={color} colors={colors} />

      {/* ACH badge mini */}
      <span className="mono text-xs font-semibold shrink-0" style={{ color }}>
        {fmtPct(ach)}
      </span>
    </div>
  );
}

export function MiniLeaderboard({ agg, colors, onNavigate }) {
  const allSorted = useMemo(() => [...agg.bySales].sort((a, b) => (b.ach ?? -1) - (a.ach ?? -1)), [agg.bySales]);
  const top3 = useMemo(() => allSorted.slice(0, 3), [allSorted]);
  const bottom2 = useMemo(() => [...allSorted].reverse().slice(0, 2), [allSorted]);

  if (!top3.length) {
    return (
      <div className="text-center py-6" style={{ color: colors.textMuted }}>
        <Trophy size={24} className="mx-auto mb-2" style={{ opacity: 0.3 }} />
        <div className="text-xs">Belum ada data sales</div>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      {/* Top 3 */}
      {top3.map((sm, i) => (
        <SalesRow
          key={sm.code}
          rank={i + 1}
          name={sm.name}
          value={sm.realisasiValue}
          ach={sm.ach}
          projectedAch={sm.projectedAch}
          colors={colors}
        />
      ))}

      {/* Bottom 2 — hanya tampil jika ada sales yang ACH < 70% */}
      {bottom2.some((sm) => (sm.ach ?? 1) < 0.7) && (
        <>
          <div className="flex items-center gap-1.5 pt-2 pb-1">
            <div className="flex-1 h-px" style={{ background: colors.glassBorder }} />
            <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: colors.coral }}>
              Perlu Perhatian
            </span>
            <div className="flex-1 h-px" style={{ background: colors.glassBorder }} />
          </div>
          {bottom2.map((sm) => (
            <SalesRow
              key={sm.code}
              rank={99}
              name={sm.name}
              value={sm.realisasiValue}
              ach={sm.ach}
              projectedAch={sm.projectedAch}
              isWarning
              colors={colors}
            />
          ))}
        </>
      )}
    </div>
  );
}
