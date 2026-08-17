import { useMemo } from "react";
import { Crosshair, CheckCircle2, AlertTriangle, XCircle, ChevronRight } from "lucide-react";
import { fmtRp, fmtPct } from "../../utils/formatters.js";
import { ACH_TIERS } from "../../constants/thresholds.js";

/* ============================================================================
   FocusGroupMini — Ringkasan grup fokus untuk Executive Summary.
   Grup fokus = grup yang ditandai `focus: true` di Pengaturan (highlight grup
   existing, tanpa target baru). Per sales×grup: nama, mini progress bar ACH,
   target/realisasi, ACH badge. Plus stacked bar ringkasan + grid angka —
   analog FocusProductMini, tapi ACH berbasis VALUE (bukan karton).
============================================================================ */

function FocusGroupStackedBar({ onTrack, atRisk, critical, total, colors }) {
  const width = (val) => (total > 0 ? (val / total) * 100 : 0);
  return (
    <div className="h-2 rounded-full overflow-hidden flex" style={{ background: colors.glassFill }}>
      {onTrack > 0 && (
        <div className="h-full transition-all duration-700" style={{ width: `${width(onTrack)}%`, background: colors.mint, borderRadius: "999px 0 0 999px" }} />
      )}
      {atRisk > 0 && (
        <div className="h-full transition-all duration-700" style={{ width: `${width(atRisk)}%`, background: colors.gold }} />
      )}
      {critical > 0 && (
        <div className="h-full transition-all duration-700" style={{ width: `${width(critical)}%`, background: colors.coral, borderRadius: atRisk === 0 && onTrack === 0 ? "999px" : "0 999px 999px 0" }} />
      )}
    </div>
  );
}

function FocusGroupRow({ name, salesName, value, ach, colors, onClick }) {
  const color = ach >= ACH_TIERS.onPace ? colors.mint : ach >= ACH_TIERS.warning ? colors.gold : colors.coral;
  const capped = Math.min(100, (ach || 0) * 100);
  return (
    <div
      onClick={onClick}
      className={`sm-row flex items-center gap-2.5 px-3 py-2 rounded-xl transition-colors ${onClick ? "cursor-pointer hover:bg-white/5" : ""}`}
      title={onClick ? "Klik untuk detail per SKU" : undefined}
    >
      <Crosshair size={13} className="shrink-0" style={{ color: colors.violet }} />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate flex items-center gap-1.5">
          {name}
          <span className="text-[10px] font-normal opacity-60 truncate" style={{ color: colors.textMuted }}>
            {salesName}
          </span>
        </div>
        <div className="text-xs mono truncate" style={{ color: colors.textMuted }}>
          {fmtRp(value)}
        </div>
      </div>
      <div className="h-1.5 rounded-full overflow-hidden flex-1 mx-2 max-w-[120px]" style={{ background: colors.glassFill }}>
        <div className="h-full rounded-full" style={{ width: `${capped}%`, background: color }} />
      </div>
      <span className="mono text-xs font-semibold shrink-0" style={{ color }}>
        {fmtPct(ach)}
      </span>
      {onClick && (
        <ChevronRight size={12} className="shrink-0" style={{ color: colors.textMuted }} />
      )}
    </div>
  );
}

export function FocusGroupMini({ focusGroupRows, colors, onGroupDrilldown }) {
  const summary = useMemo(() => {
    const total = focusGroupRows.length;
    const onTrack = focusGroupRows.filter((g) => g.ach !== null && g.ach >= ACH_TIERS.onPace).length;
    const critical = focusGroupRows.filter((g) => g.ach === 0 || (g.ach === null && g.targetValue > 0)).length;
    const atRisk = total - onTrack - critical;
    return { total, onTrack, atRisk, critical };
  }, [focusGroupRows]);

  if (summary.total === 0) {
    return (
      <div className="text-center py-6" style={{ color: colors.textMuted }}>
        <Crosshair size={24} className="mx-auto mb-2" style={{ opacity: 0.3 }} />
        <div className="text-xs">Belum ada grup fokus — tandai di Pengaturan → Target Grup Produk</div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Stacked bar summary */}
      <div>
        <div className="flex justify-between text-xs mb-1" style={{ color: colors.textMuted }}>
          <span>{summary.total} grup fokus</span>
          <span>{summary.onTrack} capai target</span>
        </div>
        <FocusGroupStackedBar onTrack={summary.onTrack} atRisk={summary.atRisk} critical={summary.critical} total={summary.total} colors={colors} />
      </div>

      {/* Ringkasan angka */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="p-2 rounded-lg" style={{ background: `${colors.mint}0D` }}>
          <div className="text-xs font-bold" style={{ color: colors.mint }}>{summary.onTrack}</div>
          <div className="text-[9px] uppercase tracking-wider" style={{ color: colors.textMuted }}>On Track</div>
        </div>
        <div className="p-2 rounded-lg" style={{ background: `${colors.gold}0D` }}>
          <div className="text-xs font-bold" style={{ color: colors.gold }}>{summary.atRisk}</div>
          <div className="text-[9px] uppercase tracking-wider" style={{ color: colors.textMuted }}>At Risk</div>
        </div>
        <div className="p-2 rounded-lg" style={{ background: `${colors.coral}0D` }}>
          <div className="text-xs font-bold" style={{ color: colors.coral }}>{summary.critical}</div>
          <div className="text-[9px] uppercase tracking-wider" style={{ color: colors.textMuted }}>Kritis</div>
        </div>
      </div>

      {/* Daftar per sales×grup — urut sudah dari aggregation (ACH desc, lalu realisasi) */}
      <div className="max-h-64 overflow-y-auto pr-1">
        {focusGroupRows.slice(0, 12).map((g, i) => (
          <FocusGroupRow
            key={`${g.salesCode}|${g.name}`}
            name={g.name}
            salesName={g.salesName}
            value={g.realisasiValue}
            ach={g.ach}
            colors={colors}
            onClick={onGroupDrilldown ? () => onGroupDrilldown(g.name, g.salesName, g.predicate) : undefined}
          />
        ))}
        {focusGroupRows.length > 12 && (
          <div className="text-[10px] text-center pt-1.5" style={{ color: colors.textMuted }}>
            ... dan {focusGroupRows.length - 12} lainnya
          </div>
        )}
      </div>
    </div>
  );
}
