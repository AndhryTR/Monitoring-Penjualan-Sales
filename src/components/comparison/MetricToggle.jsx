import { COMPARISON_METRICS } from "../../utils/comparison.js";

/* ============================================================================
   METRICTOGGLE
   Toggle metrik yang dibandingkan di tab Perbandingan: Value / AO / Qty KARTON
   / ACH / Deviasi. Satu aktif (pola sama seperti toggle Value/AO di Tren).
   Label metrik "AO" diganti jadi "Frekuensi Transaksi" khusus mode Outlet —
   "AO" (jumlah outlet aktif) tidak bermakna per-outlet (satu baris tabel
   sudah 1 outlet spesifik), jadi field yang sama di-reinterpretasi sebagai
   frekuensi transaksi (lihat comparison.js/buildOutletMatrix).
============================================================================ */
export function MetricToggle({ metric, onChange, colors, mode }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {COMPARISON_METRICS.map((m) => {
        const on = metric === m.key;
        const label = mode === "outlet" && m.key === "ao" ? "Frekuensi Transaksi" : m.label;
        return (
          <button key={m.key} onClick={() => onChange(m.key)}
            className="sm-btn px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
            style={{
              background: on ? colors.gold + "22" : colors.glassFill,
              border: `1px solid ${on ? colors.gold + "66" : colors.glassBorder}`,
              color: on ? colors.gold : colors.textMuted,
            }}>
            {label}
          </button>
        );
      })}
    </div>
  );
}
