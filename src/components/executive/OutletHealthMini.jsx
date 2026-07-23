import { Store } from "lucide-react";

/* ============================================================================
   OutletHealthMini — Distribusi status outlet dalam stacked horizontal bar.
   Menerima outletSummary dari computeOutletAnalysis().summary
   { total, active, atRisk, dormant }
============================================================================ */

function OutletStackedBar({ active, atRisk, dormant, total, colors }) {
  if (total === 0) return null;
  const w = (val) => (val / total) * 100;
  return (
    <div className="h-3 rounded-full overflow-hidden flex" style={{ background: colors.glassFill }}>
      {active > 0 && (
        <div className="h-full transition-all duration-700" style={{ width: `${w(active)}%`, background: colors.mint, borderRadius: "999px 0 0 999px" }} />
      )}
      {atRisk > 0 && (
        <div className="h-full transition-all duration-700" style={{ width: `${w(atRisk)}%`, background: colors.gold }} />
      )}
      {dormant > 0 && (
        <div className="h-full transition-all duration-700" style={{ width: `${w(dormant)}%`, background: colors.coral, borderRadius: atRisk === 0 && active === 0 ? "999px" : "0 999px 999px 0" }} />
      )}
    </div>
  );
}

export function OutletHealthMini({ outletSummary, colors }) {
  const { total, active, atRisk, dormant } = outletSummary;
  const activePct = total > 0 ? (active / total) * 100 : 0;

  if (total === 0) {
    return (
      <div className="text-center py-6" style={{ color: colors.textMuted }}>
        <Store size={24} className="mx-auto mb-2" style={{ opacity: 0.3 }} />
        <div className="text-xs">Belum ada data outlet</div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Stacked bar */}
      <OutletStackedBar active={active} atRisk={atRisk} dormant={dormant} total={total} colors={colors} />

      {/* Angka */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="p-2 rounded-lg" style={{ background: `${colors.mint}0D` }}>
          <div className="text-sm font-bold" style={{ color: colors.mint }}>{active}</div>
          <div className="text-[9px] uppercase tracking-wider" style={{ color: colors.textMuted }}>Aktif</div>
        </div>
        <div className="p-2 rounded-lg" style={{ background: `${colors.gold}0D` }}>
          <div className="text-sm font-bold" style={{ color: colors.gold }}>{atRisk}</div>
          <div className="text-[9px] uppercase tracking-wider" style={{ color: colors.textMuted }}>Berisiko</div>
        </div>
        <div className="p-2 rounded-lg" style={{ background: `${colors.coral}0D` }}>
          <div className="text-sm font-bold" style={{ color: colors.coral }}>{dormant}</div>
          <div className="text-[9px] uppercase tracking-wider" style={{ color: colors.textMuted }}>Dormant</div>
        </div>
      </div>

      {/* Kesehatan ringkasan */}
      <div className="flex items-center gap-2 justify-center">
        <div className="text-xs" style={{ color: colors.textMuted }}>
          Tingkat kesehatan outlet: <b style={{ color: activePct >= 80 ? colors.mint : activePct >= 60 ? colors.gold : colors.coral }}>
            {activePct.toFixed(0)}% aktif
          </b>
        </div>
      </div>
    </div>
  );
}
