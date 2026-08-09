import { Sparkles, TrendingUp, TrendingDown, Minus, Gauge } from "lucide-react";
import { fmtPct, fmtRp } from "../utils/formatters.js";
import { computePaceStatus } from "../utils/aggregation.js";

/* ============================================================================
   PACE STRIP — REDESIGN (Sprint 15)
   ⚠️ Sebelumnya: bar progress horizontal tanpa context actionable. Hanya
   menampilkan "ACH 75.0%" dan "Time Gone 44.4%" tanpa delta atau hint apa
   yang harus dilakukan user.

   Improvements:
   1. Delta absolut: "ACH +30.6% di atas pace" (bukan hanya warna hijau/merah)
   2. Status icon: TrendingUp (ahead), TrendingDown (behind), Minus (on pace)
   3. Visual markers: ACH bar + Time Gone marker + target zone shading
   4. Contextual hint: "Perlu Rp X/hari untuk capai target" atau "Sudah on track"
   5. Dual metrics: ACH bar (kiri) + Time Gone bar (kanan) untuk visual comparison
   6. Font lebih besar, layout lebih jelas

   Props (extended, backward compatible):
   - timeGonePct: 0-1 (persentase waktu yang sudah berjalan)
   - achPct: 0-1+ (pencapaian vs target)
   - colors: theme colors
   - targetValue: number (opsional — untuk hitung "perlu Rp X/hari")
   - realisasiValue: number (opsional — untuk hitung sisa)
   - workDays: number (opsional — untuk hitung sisa hari)
   - uniqueDays: number (opsional — untuk hitung rate harian)
============================================================================ */
export function PaceStrip({ timeGonePct, achPct, colors, targetValue, realisasiValue, workDays, uniqueDays }) {
  const achCapped = Math.min(100, (achPct || 0) * 100);
  const timeCapped = Math.min(100, (timeGonePct || 0) * 100);
  const { isAhead } = computePaceStatus(achPct, timeGonePct);

  // Delta absolut: ACH - TimeGone (dalam percentage points)
  const deltaPct = (achPct !== null && achPct !== undefined)
    ? ((achPct - timeGonePct) * 100)
    : null;

  // Status: ahead / behind / on pace (within ±2% margin)
  const isOnPace = deltaPct !== null && Math.abs(deltaPct) <= 2;
  const status = isAhead === null ? "unknown" : isOnPace ? "onpace" : isAhead ? "ahead" : "behind";

  const statusConfig = {
    ahead: { color: colors.mint, icon: TrendingUp, label: "Di atas pace", deltaPrefix: "+" },
    behind: { color: colors.coral, icon: TrendingDown, label: "Di bawah pace", deltaPrefix: "" },
    onpace: { color: colors.gold, icon: Minus, label: "Sesuai pace", deltaPrefix: "" },
    unknown: { color: colors.textMuted, icon: Gauge, label: "Belum cukup data", deltaPrefix: "" },
  };
  const cfg = statusConfig[status];
  const StatusIcon = cfg.icon;

  // Contextual hint: berapa perlu per hari untuk capai target
  let hint = null;
  if (targetValue && realisasiValue !== undefined && workDays && uniqueDays) {
    const sisaHari = Math.max(0, workDays - uniqueDays);
    const sisaTarget = (targetValue || 0) - (realisasiValue || 0);

    if (sisaTarget <= 0) {
      hint = `Target tercapai! Realisasi ${fmtRp(realisasiValue)} dari target ${fmtRp(targetValue)}`;
    } else if (sisaHari > 0) {
      const perluPerHari = sisaTarget / sisaHari;
      const rateSekarang = uniqueDays > 0 ? realisasiValue / uniqueDays : 0;
      const rasio = rateSekarang > 0 ? (perluPerHari / rateSekarang) : null;

      if (rasio !== null && rasio <= 1) {
        hint = `Perlu ${fmtRp(perluPerHari)}/hari — dengan rate saat ini (${fmtRp(rateSekarang)}/hari), target tercapai`;
      } else if (rasio !== null) {
        hint = `Perlu ${fmtRp(perluPerHari)}/hari — ${rasio.toFixed(1)}× rate saat ini (${fmtRp(rateSekarang)}/hari)`;
      } else {
        hint = `Perlu ${fmtRp(perluPerHari)}/hari selama ${sisaHari} hari kerja tersisa`;
      }
    } else {
      hint = `Periode berakhir — realisasi ${fmtRp(realisasiValue)} dari target ${fmtRp(targetValue)}`;
    }
  }

  return (
    <div className="sm-card sm-fadeup p-5 mb-6" style={{ borderLeft: `3px solid ${cfg.color}` }}>
      {/* Header row */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl shrink-0" style={{ background: cfg.color + "1A" }}>
            <StatusIcon size={16} style={{ color: cfg.color }} />
          </div>
          <div>
            <div className="disp text-sm font-semibold" style={{ color: colors.text }}>Pace ke Target</div>
            <div className="text-xs" style={{ color: cfg.color }}>
              {cfg.label}
              {deltaPct !== null && !isOnPace && (
                <span className="mono font-bold ml-1.5">
                  ({cfg.deltaPrefix}{deltaPct.toFixed(1)}%)
                </span>
              )}
            </div>
          </div>
        </div>
        {/* Right: ACH summary */}
        <div className="text-right shrink-0">
          <div className="text-xs" style={{ color: colors.textMuted }}>Achievement</div>
          <div className="mono text-lg font-bold" style={{ color: cfg.color }}>
            {achPct !== null && achPct !== undefined ? fmtPct(achPct) : "-"}
          </div>
        </div>
      </div>

      {/* Dual progress bars: ACH (top) vs Time Gone (bottom) */}
      <div className="space-y-2">
        {/* ACH bar */}
        <div>
          <div className="flex justify-between text-xs mb-1" style={{ color: colors.textMuted }}>
            <span>Achievement</span>
            <span className="mono" style={{ color: cfg.color }}>{achPct !== null ? fmtPct(achPct) : "-"}</span>
          </div>
          <div className="relative h-3 rounded-full overflow-hidden" style={{ background: colors.glassFill }}>
            <div
              className="sm-progress-fill h-full rounded-full"
              style={{ width: `${achCapped}%`, background: `linear-gradient(90deg, ${cfg.color}88, ${cfg.color})` }}
            />
            {/* Target marker at 100% */}
            <div className="absolute top-0 h-full w-[2px]" style={{ right: 0, background: colors.text, opacity: 0.3 }} />
          </div>
        </div>

        {/* Time Gone bar */}
        <div>
          <div className="flex justify-between text-xs mb-1" style={{ color: colors.textMuted }}>
            <span>Waktu Berjalan</span>
            <span className="mono">{timeGonePct > 0 ? fmtPct(timeGonePct) : "-"}</span>
          </div>
          <div className="relative h-3 rounded-full overflow-hidden" style={{ background: colors.glassFill }}>
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{ width: `${timeCapped}%`, background: colors.textMuted + "55" }}
            />
            {/* ACH marker on time bar — visual comparison */}
            {achPct !== null && (
              <div
                className="absolute top-0 h-full w-[2px] rounded-full"
                style={{ left: `${achCapped}%`, background: cfg.color, boxShadow: `0 0 6px ${cfg.color}88` }}
                title={`ACH: ${fmtPct(achPct)}`}
              />
            )}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-3 text-xs" style={{ color: colors.textMuted }}>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: cfg.color }} />
          Achievement
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: colors.textMuted, opacity: 0.55 }} />
          Waktu berjalan
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-[2px] h-3 rounded-full" style={{ background: cfg.color }} />
          Posisi ACH di timeline waktu
        </span>
      </div>

      {/* Contextual hint */}
      {hint && (
        <div className="mt-3 pt-3 flex items-start gap-2.5" style={{ borderTop: `1px solid ${colors.glassBorder}` }}>
          <Sparkles size={13} style={{ color: colors.gold, flexShrink: 0, marginTop: 1 }} />
          <p className="text-xs" style={{ color: colors.text }}>
            {hint}
          </p>
        </div>
      )}
    </div>
  );
}
