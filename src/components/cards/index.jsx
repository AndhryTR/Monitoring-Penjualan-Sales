import { useState, useMemo } from "react";
import {
  Trophy, Rocket, BellRing, History, AlertTriangle, X, ArrowUpRight,
  ArrowDownRight, FileText,
} from "lucide-react";
import { fmtRp, fmtPct, fmtNum } from "../../utils/formatters.js";
import { AchBadge } from "../AchBadge.jsx";
import { SectionTitle, DrilldownButton } from "../ui/index.jsx";

export function Leaderboard({ rows, colors, onDrilldown, onExportScorecard }) {
  const ranked = useMemo(() => [...rows].sort((a, b) => (b.ach ?? -1) - (a.ach ?? -1)), [rows]);
  const medal = (i) => ["🥇", "🥈", "🥉"][i] || `${i + 1}`;
  return (
    <div className="sm-card p-5 sm-fadeup mb-8">
      <SectionTitle title="Leaderboard Sales" sub="Diurutkan berdasarkan pencapaian (ACH%)" icon={Trophy} colors={colors} />
      <div className="space-y-2">
        {ranked.map((sm, i) => (
          <div key={sm.code} className="sm-row flex items-center gap-3 px-3 py-2.5 rounded-xl" style={{ background: i < 3 ? colors.gold + "0D" : "transparent" }}>
            <div className="w-8 text-center text-base">{medal(i)}</div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">{sm.name}</div>
              <div className="text-xs mono" style={{ color: colors.textMuted }}>{fmtRp(sm.realisasiValue)} / {fmtRp(sm.targetValue)}</div>
            </div>
            {sm.projectedAch !== null && sm.projectedAch !== undefined && (
              <div className="hidden sm:block text-xs mono text-right" style={{ color: colors.textMuted }}>
                Proyeksi <span style={{ color: sm.projectedAch >= 1 ? colors.mint : colors.coral }}>{fmtPct(sm.projectedAch)}</span>
              </div>
            )}
            <AchBadge ach={sm.ach} colors={colors} />
            {onExportScorecard && (
              <button onClick={() => onExportScorecard(sm)} title="Cetak scorecard PDF"
                className="sm-btn p-2 rounded-lg" style={{ background: colors.surface2, color: colors.textMuted }}>
                <FileText size={14} />
              </button>
            )}
            {onDrilldown && (
              <DrilldownButton colors={colors} onClick={() => onDrilldown(sm.name, "Semua outlet", sm.predicate)} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// Kartu proyeksi akhir bulan — ekstrapolasi linear dari rata-rata realisasi harian saat ini.
export function ProjectionCard({ projection, totals, colors }) {
  const onTrack = projection.projectedAch !== null ? projection.projectedAch >= 1 : null;
  return (
    <div className="sm-card p-5 sm-fadeup mb-6">
      <SectionTitle title="Proyeksi Akhir Bulan" sub="Ekstrapolasi linear dari rata-rata realisasi harian saat ini" icon={Rocket} colors={colors} />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div>
          <div className="text-xs uppercase tracking-wider mb-1" style={{ color: colors.textMuted }}>Rata-rata / Hari</div>
          <div className="mono text-lg font-bold">{fmtRp(projection.dailyRate)}</div>
        </div>
        <div>
          <div className="text-xs uppercase tracking-wider mb-1" style={{ color: colors.textMuted }}>Proyeksi Akhir Bulan</div>
          <div className="mono text-lg font-bold">{fmtRp(projection.projectedValue)}</div>
        </div>
        <div>
          <div className="text-xs uppercase tracking-wider mb-1" style={{ color: colors.textMuted }}>Proyeksi ACH%</div>
          <div className="mono text-lg font-bold" style={{ color: onTrack === null ? colors.text : onTrack ? colors.mint : colors.coral }}>
            {fmtPct(projection.projectedAch)}
          </div>
        </div>
        <div>
          <div className="text-xs uppercase tracking-wider mb-1" style={{ color: colors.textMuted }}>Status</div>
          <div className="text-sm font-semibold flex items-center gap-1.5" style={{ color: onTrack === null ? colors.textMuted : onTrack ? colors.mint : colors.coral }}>
            {onTrack === null ? "Belum cukup data" : onTrack ? <><ArrowUpRight size={15} /> Sesuai/Lampaui Target</> : <><ArrowDownRight size={15} /> Berpotensi Meleset</>}
          </div>
        </div>
      </div>
    </div>
  );
}

// Panel peringatan otomatis — sales/produk fokus yang masih 0% padahal sudah lewat beberapa hari kerja.
export function AlertsPanel({ alerts, colors, onDrilldown }) {
  const [expanded, setExpanded] = useState(false);
  if (!alerts.length) return null;
  const visible = expanded ? alerts : alerts.slice(0, 2);
  return (
    <div className="sm-card p-5 sm-fadeup mb-6" style={{ borderColor: colors.coral + "44" }}>
      <div className="flex items-center justify-between mb-3">
        <SectionTitle title="Perlu Perhatian" sub={`${alerts.length} item belum ada realisasi sama sekali`} icon={BellRing} colors={colors} />
      </div>
      <div className="space-y-2">
        {visible.map((a, i) => (
          <div key={i} className="flex items-center gap-3 px-3 py-2 rounded-lg" style={{ background: colors.coral + "0D" }}>
            <AlertTriangle size={14} style={{ color: colors.coral, flexShrink: 0 }} />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">{a.title}</div>
              <div className="text-xs" style={{ color: colors.textMuted }}>{a.message}</div>
            </div>
            {onDrilldown && <DrilldownButton colors={colors} onClick={() => onDrilldown(a.title, a.message, a.predicate)} />}
          </div>
        ))}
      </div>
      {alerts.length > 2 && (
        <button onClick={() => setExpanded(!expanded)} className="sm-btn text-xs font-medium mt-3" style={{ color: colors.gold }}>
          {expanded ? "Tampilkan lebih sedikit" : `Tampilkan ${alerts.length - 2} lainnya`}
        </button>
      )}
    </div>
  );
}

// Kartu perbandingan periode — muncul di Main Report saat ada snapshot riwayat terpilih.
export function PeriodComparisonCard({ comparison, colors, onClear }) {
  if (!comparison) return null;
  const growthColor = comparison.growth === null ? colors.textMuted : comparison.growth >= 0 ? colors.mint : colors.coral;
  return (
    <div className="sm-card p-5 sm-fadeup mb-6">
      <div className="flex items-center justify-between mb-4">
        <SectionTitle title="Bandingkan Periode" sub={`vs ${comparison.label}`} icon={History} colors={colors} />
        <button onClick={onClear} className="sm-btn p-2 rounded-full" style={{ background: colors.surface2 }}><X size={14} /></button>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-5">
        <div>
          <div className="text-xs uppercase tracking-wider mb-1" style={{ color: colors.textMuted }}>Realisasi Sekarang</div>
          <div className="mono text-lg font-bold">{fmtRp(comparison.nowValue)}</div>
        </div>
        <div>
          <div className="text-xs uppercase tracking-wider mb-1" style={{ color: colors.textMuted }}>Periode Pembanding</div>
          <div className="mono text-lg font-bold">{fmtRp(comparison.thenValue)}</div>
        </div>
        <div>
          <div className="text-xs uppercase tracking-wider mb-1" style={{ color: colors.textMuted }}>Pertumbuhan</div>
          <div className="mono text-lg font-bold flex items-center gap-1" style={{ color: growthColor }}>
            {comparison.growth === null ? "-" : <>{comparison.growth >= 0 ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}{fmtPct(Math.abs(comparison.growth))}</>}
          </div>
        </div>
      </div>
      <div className="text-xs uppercase tracking-wider mb-2" style={{ color: colors.textMuted }}>Pertumbuhan per Sales</div>
      <div className="space-y-1.5 max-h-64 overflow-y-auto">
        {comparison.bySales.map((s) => (
          <div key={s.code} className="flex items-center justify-between text-sm px-3 py-2 rounded-lg" style={{ background: colors.surface2, opacity: s.isGone ? 0.6 : 1 }}>
            <span className="truncate flex-1 flex items-center gap-2">
              {s.name}
              {s.isGone && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0" style={{ background: colors.textMuted + "22", color: colors.textMuted }}>
                  Tidak ada di periode ini
                </span>
              )}
              {s.isNew && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0" style={{ background: colors.gold + "22", color: colors.gold }}>
                  Baru
                </span>
              )}
            </span>
            <span className="mono text-xs mr-3" style={{ color: colors.textMuted }}>{fmtRp(s.nowValue)}</span>
            <span className="mono font-semibold" style={{ color: s.growth === null ? colors.textMuted : s.growth >= 0 ? colors.mint : colors.coral }}>
              {s.growth === null ? "-" : `${s.growth >= 0 ? "+" : ""}${fmtPct(s.growth)}`}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
