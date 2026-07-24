import { useMemo } from "react";
import { Crosshair, CheckCircle2, AlertTriangle, XCircle } from "lucide-react";
import { fmtNum, fmtPct } from "../../utils/formatters.js";

/* ============================================================================
   FocusProductMini — Ringkasan status produk fokus:
   berapa yang on track, critical, at risk — daftar terbaik & terburuk.
============================================================================ */

function FocusStackedBar({ onTrack, atRisk, critical, total, colors }) {
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

function FocusItem({ name, salesName, pct, isBest, colors }) {
  const color = pct >= 1 ? colors.mint : pct >= 0.5 ? colors.gold : colors.coral;
  return (
    <div className="flex items-center gap-2 py-1">
      {isBest ? (
        <CheckCircle2 size={12} className="shrink-0" style={{ color: colors.mint }} />
      ) : (
        <XCircle size={12} className="shrink-0" style={{ color: colors.coral }} />
      )}
      <span className="text-xs truncate flex-1">{name}</span>
      <span className="text-xs font-semibold shrink-0" style={{ color }}>{fmtPct(pct)}</span>
    </div>
  );
}

export function FocusProductMini({ focusRows, colors }) {
  const summary = useMemo(() => {
    const total = focusRows.length;
    const onTrack = focusRows.filter(f => f.pct !== null && f.pct >= 1).length;
    const critical = focusRows.filter(f => f.pct === 0 || (f.pct === null && f.target > 0)).length;
    const atRisk = total - onTrack - critical;

    const sorted = [...focusRows].filter(f => f.pct !== null).sort((a, b) => (b.pct ?? 0) - (a.pct ?? 0));
    // Cuma 2 yang dirender (bukan 3) — sesuai lebar kolom "Terbaik" di layar.
    const bestItems = sorted.slice(0, 2);
    // worstItems diambil dari SISA data setelah bestItems dibuang — supaya kalau
    // total produk fokus sedikit, tidak ada produk yang tampil dobel di kedua kolom.
    const bestKeys = new Set(bestItems.map((f) => `${f.salesCode}|${f.name}`));
    const remaining = sorted.filter((f) => !bestKeys.has(`${f.salesCode}|${f.name}`));
    const worstItems = remaining.filter(f => (f.pct ?? 1) < 0.5).slice(-2).reverse();

    return { total, onTrack, atRisk, critical, bestItems, worstItems };
  }, [focusRows]);

  if (summary.total === 0) {
    return (
      <div className="text-center py-6" style={{ color: colors.textMuted }}>
        <Crosshair size={24} className="mx-auto mb-2" style={{ opacity: 0.3 }} />
        <div className="text-xs">Belum ada produk fokus</div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Stacked bar summary */}
      <div>
        <div className="flex justify-between text-xs mb-1" style={{ color: colors.textMuted }}>
          <span>{summary.total} produk</span>
          <span>{summary.onTrack} capai target</span>
        </div>
        <FocusStackedBar onTrack={summary.onTrack} atRisk={summary.atRisk} critical={summary.critical} total={summary.total} colors={colors} />
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

      {/* Best & worst items */}
      <div className="grid grid-cols-2 gap-3 pt-1">
        {summary.bestItems.length > 0 && (
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: colors.mint }}>Terbaik</div>
            {summary.bestItems.map((f) => (
              <FocusItem key={`${f.salesCode}-${f.name}`} name={f.name} salesName={f.salesName} pct={f.pct} isBest colors={colors} />
            ))}
          </div>
        )}
        {summary.worstItems.length > 0 && (
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: colors.coral }}>Perlu Perhatian</div>
            {summary.worstItems.map((f) => (
              <FocusItem key={`${f.salesCode}-${f.name}`} name={f.name} salesName={f.salesName} pct={f.pct} isBest={false} colors={colors} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
