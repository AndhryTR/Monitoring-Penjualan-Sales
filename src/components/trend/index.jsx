import { useState, useMemo } from "react";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from "recharts";
import { TrendingUp, ArrowUpRight, ArrowDownRight, History, Users, Wallet, Sparkles } from "lucide-react";
import { fmtRp, fmtNum, fmtPct } from "../../utils/formatters.js";
import { SectionTitle, createChartTooltipStyle } from "../ui/index.jsx";
import { MultiSelect } from "../ui/MultiSelect.jsx";

const LINE_COLOR_KEYS = ["gold", "mint", "violet", "blue", "coral"];
const MAX_DEFAULT_LINES = 5;

// Formatter ringkas khusus label sumbu Y chart (mis. "1,2 Jt" / "850 Rb") — fmtRp
// dari utils/formatters.js sengaja tidak diubah karena dipakai di banyak tempat
// lain yang butuh format penuh "Rp 12.345.678".
function compactAxisValue(n) {
  if (n === null || n === undefined || Number.isNaN(n)) return "-";
  const abs = Math.abs(n);
  if (abs >= 1_000_000_000) return (n / 1_000_000_000).toFixed(1).replace(/\.0$/, "") + " M";
  if (abs >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + " Jt";
  if (abs >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, "") + " Rb";
  return String(Math.round(n));
}

function GrowthTag({ growth, colors }) {
  if (growth === null || growth === undefined) return <span className="mono text-xs" style={{ color: colors.textMuted }}>-</span>;
  const positive = growth >= 0;
  return (
    <span className="mono text-xs font-semibold inline-flex items-center gap-0.5" style={{ color: positive ? colors.mint : colors.coral }}>
      {positive ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
      {fmtPct(Math.abs(growth))}
    </span>
  );
}

/* ============================================================================
   TREN PERIODE
   Tab baru: bandingkan Value & AO per sales lintas 3+ periode sekaligus
   (periode aktif + snapshot riwayat terpilih). Beda dengan PeriodComparisonCard
   (Main Report) yang cuma 1 vs 1 — ini untuk melihat tren beberapa bulan.
============================================================================ */
export function TrendPeriodePage({ comparisonData, isAutoTrend, colors, onOpenPeriodPicker, selectedCount }) {
  const [metric, setMetric] = useState("value"); // "value" | "ao"

  const allSalesNames = useMemo(
    () => (comparisonData ? comparisonData.bySales.map((s) => s.name) : []),
    [comparisonData]
  );
  const [selectedNames, setSelectedNames] = useState([]);

  // Default pilihan garis chart: top N sales berdasarkan nilai terbaru — supaya
  // chart tidak langsung penuh sesak kalau jumlah sales banyak. User tetap bisa
  // ubah lewat MultiSelect.
  const effectiveSelectedNames = useMemo(() => {
    if (selectedNames.length > 0 || !comparisonData) return selectedNames;
    return comparisonData.bySales.slice(0, MAX_DEFAULT_LINES).map((s) => s.name);
  }, [selectedNames, comparisonData]);

  const chartData = useMemo(() => {
    if (!comparisonData) return [];
    return comparisonData.periods.map((p, i) => {
      const point = { label: p.label };
      comparisonData.bySales.forEach((s) => {
        if (!effectiveSelectedNames.includes(s.name)) return;
        const pt = s.series[i];
        point[s.name] = pt && !pt.missing ? (metric === "value" ? pt.value : pt.ao) : null;
      });
      return point;
    });
  }, [comparisonData, effectiveSelectedNames, metric]);

  if (!comparisonData || comparisonData.periods.length < 2) {
    return (
      <div className="sm-page-enter">
        <div className="sm-card p-12 text-center">
          <div className="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center" style={{ background: colors.glassFill }}>
            <TrendingUp size={24} style={{ color: colors.textMuted }} />
          </div>
          <div className="disp text-base font-semibold mb-1">Belum ada periode untuk dibandingkan</div>
          <p className="text-sm mb-5" style={{ color: colors.textMuted }}>
            Pilih minimal 2 periode riwayat (di luar periode aktif) untuk melihat tren Value & AO per sales.
          </p>
          <button onClick={onOpenPeriodPicker}
            className="sm-btn inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold"
            style={{ background: colors.gold, color: "#0A1120" }}>
            <History size={15} /> Pilih Periode Riwayat
          </button>
        </div>
      </div>
    );
  }

  const { periods, bySales, totalsSeries } = comparisonData;

  return (
    <div className="sm-page-enter">
      {isAutoTrend && (
        <div className="sm-card p-3 mb-4 flex items-center gap-2.5" style={{ background: colors.gold + "0D", border: `1px solid ${colors.gold}33` }}>
          <Sparkles size={15} style={{ color: colors.gold, flexShrink: 0 }} />
          <p className="text-xs" style={{ color: colors.text }}>
            Menampilkan <b>{periods.length} bulan terdeteksi otomatis</b> dari data yang di-upload — tidak perlu simpan snapshot manual. Mau pilih periode sendiri? Klik "Pilih Manual" di kanan.
          </p>
        </div>
      )}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <SectionTitle title="Tren Periode" sub={`Membandingkan ${periods.length} periode · Value & AO per sales`} icon={TrendingUp} colors={colors} accent={colors.mint} />
        <div className="flex items-center gap-2">
          <div className="flex p-1 rounded-xl" style={{ background: colors.glassSubtle, border: `1px solid ${colors.glassBorder}` }}>
            <button onClick={() => setMetric("value")}
              className="sm-tab-btn px-3 py-1.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5"
              style={{ background: metric === "value" ? colors.glassFillStrong : "transparent", color: metric === "value" ? colors.mint : colors.textMuted }}>
              <Wallet size={13} /> Value
            </button>
            <button onClick={() => setMetric("ao")}
              className="sm-tab-btn px-3 py-1.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5"
              style={{ background: metric === "ao" ? colors.glassFillStrong : "transparent", color: metric === "ao" ? colors.mint : colors.textMuted }}>
              <Users size={13} /> AO
            </button>
          </div>
          <button onClick={onOpenPeriodPicker} className="sm-btn inline-flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold"
            style={{ background: colors.glassFill, border: `1px solid ${colors.glassBorder}`, color: colors.text }}>
            <History size={13} /> {isAutoTrend ? "Pilih Manual" : `Ubah Periode (${selectedCount})`}
          </button>
        </div>
      </div>

      {/* Ringkasan total per periode */}
      <div className="sm-card p-5 sm-fadeup mb-6">
        <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${periods.length}, minmax(120px, 1fr))` }}>
          {periods.map((p, i) => {
            const t = totalsSeries[i];
            const val = metric === "value" ? t.value : t.ao;
            const ach = metric === "value" ? t.ach : t.achAo;
            return (
              <div key={p.id} className="min-w-0">
                <div className="text-[11px] uppercase tracking-wider mb-1 truncate flex items-center gap-1" style={{ color: p.isCurrent ? colors.gold : colors.textMuted }}>
                  {p.label} {p.isCurrent && <span className="text-[9px] px-1 py-0.5 rounded-full font-bold" style={{ background: colors.gold + "22" }}>AKTIF</span>}
                </div>
                <div className="mono text-sm font-bold truncate">{val === null ? "-" : metric === "value" ? fmtRp(val) : fmtNum(val)}</div>
                <div className="text-xs mono" style={{ color: ach === null ? colors.textMuted : ach >= 1 ? colors.mint : colors.coral }}>
                  {ach === null ? "-" : fmtPct(ach)}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Chart tren per sales */}
      <div className="sm-card p-5 sm-fadeup mb-6">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <SectionTitle title={`Tren ${metric === "value" ? "Value" : "AO"} per Sales`} sub="Pilih sales yang ingin ditampilkan" icon={TrendingUp} colors={colors} />
          <MultiSelect label="Sales" icon={Users} options={allSalesNames} selected={effectiveSelectedNames} onChange={setSelectedNames} placeholder="Cari sales..." colors={colors} />
        </div>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke={colors.chartGrid} vertical={false} />
            <XAxis dataKey="label" tick={{ fill: colors.textMuted, fontSize: 11 }} axisLine={{ stroke: colors.border }} tickLine={false} />
            <YAxis tick={{ fill: colors.textMuted, fontSize: 11 }} axisLine={false} tickLine={false}
              tickFormatter={(v) => metric === "value" ? compactAxisValue(v) : fmtNum(v)} width={56} />
            <Tooltip contentStyle={createChartTooltipStyle(colors)} formatter={(v) => metric === "value" ? fmtRp(v) : fmtNum(v)} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            {effectiveSelectedNames.map((name, i) => (
              <Line key={name} type="monotone" dataKey={name} stroke={colors[LINE_COLOR_KEYS[i % LINE_COLOR_KEYS.length]]}
                strokeWidth={2} dot={{ r: 3 }} connectNulls />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Tabel detail per sales */}
      <div className="sm-card p-5 sm-fadeup mb-8">
        <SectionTitle title={`Detail ${metric === "value" ? "Value" : "AO"} per Sales`} sub="Kolom terakhir = periode aktif · pertumbuhan dihitung antar 2 titik data terakhir yang tersedia" icon={Users} colors={colors} />
        <div className="overflow-x-auto -mx-1">
          <table className="w-full text-sm border-separate" style={{ borderSpacing: 0 }}>
            <thead>
              <tr>
                <th className="text-left px-3 py-2 sticky left-0 z-10" style={{ background: colors.surface, color: colors.textMuted, fontWeight: 500, fontSize: 11, textTransform: "uppercase" }}>Sales</th>
                {periods.map((p) => (
                  <th key={p.id} className="text-right px-3 py-2 whitespace-nowrap" style={{ color: p.isCurrent ? colors.gold : colors.textMuted, fontWeight: 500, fontSize: 11, textTransform: "uppercase" }}>
                    {p.label}
                  </th>
                ))}
                <th className="text-right px-3 py-2 whitespace-nowrap" style={{ color: colors.textMuted, fontWeight: 500, fontSize: 11, textTransform: "uppercase" }}>Growth</th>
              </tr>
            </thead>
            <tbody>
              {bySales.map((s) => (
                <tr key={s.code} className="sm-row">
                  <td className="px-3 py-2 sticky left-0 z-10 truncate max-w-[160px]" style={{ background: colors.surface }}>{s.name}</td>
                  {s.series.map((pt) => (
                    <td key={pt.periodId} className="text-right px-3 py-2 whitespace-nowrap">
                      {pt.missing ? (
                        <span className="text-xs" style={{ color: colors.textMuted }}>-</span>
                      ) : (
                        <div>
                          <div className="mono">{metric === "value" ? fmtRp(pt.value) : fmtNum(pt.ao)}</div>
                          <div className="text-[10px] mono" style={{ color: (() => { const a = metric === "value" ? pt.ach : pt.achAo; return a === null ? colors.textMuted : a >= 1 ? colors.mint : colors.coral; })() }}>
                            {fmtPct(metric === "value" ? pt.ach : pt.achAo)}
                          </div>
                        </div>
                      )}
                    </td>
                  ))}
                  <td className="text-right px-3 py-2 whitespace-nowrap">
                    <GrowthTag growth={metric === "value" ? s.growthValue : s.growthAo} colors={colors} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
