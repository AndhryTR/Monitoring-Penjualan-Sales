import { todayLocalDateStr } from "./excelParse.js";

/* ============================================================================
   RIWAYAT & PERBANDINGAN PERIODE
   Snapshot ringan (bukan data transaksi mentah) untuk satu periode aktif —
   dipakai sebagai pembanding di fitur "Bandingkan Periode". Disimpan lewat
   saveHistory()/loadHistory() di utils/storage.js (localStorage).
============================================================================ */
export function buildHistorySnapshot(agg, filters, fileName, label) {
  return {
    id: `${Date.now()}`,
    label: label && label.trim() ? label.trim() : `${filters.dateFrom || "?"} — ${filters.dateTo || "?"}`,
    savedAt: todayLocalDateStr(),
    dateFrom: filters.dateFrom || null,
    dateTo: filters.dateTo || null,
    fileName,
    totals: { targetValue: agg.totals.targetValue, realisasiValue: agg.totals.realisasiValue },
    bySales: agg.bySales.map((s) => ({ code: s.code, name: s.name, targetValue: s.targetValue, realisasiValue: s.realisasiValue })),
    byGroup: agg.byGroup.map((g) => ({ name: g.name, targetValue: g.targetValue, realisasiValue: g.realisasiValue })),
  };
}

// Bandingkan totals & bySales periode aktif terhadap sebuah snapshot riwayat.
export function computeComparison(agg, snapshot) {
  if (!snapshot) return null;
  const nowValue = agg.totals.realisasiValue;
  const thenValue = snapshot.totals.realisasiValue;
  const growth = thenValue > 0 ? (nowValue - thenValue) / thenValue : null;

  // Union kode sales dari periode sekarang DAN snapshot lama — supaya sales yang
  // ada di riwayat tapi sudah tidak muncul di periode aktif (resign/pindah area)
  // tetap kelihatan di perbandingan, bukan senyap begitu saja.
  const nowByCode = new Map(agg.bySales.map((s) => [s.code, s]));
  const prevByCode = new Map(snapshot.bySales.map((s) => [s.code, s]));
  const allCodes = new Set([...nowByCode.keys(), ...prevByCode.keys()]);

  const bySales = Array.from(allCodes).map((code) => {
    const now = nowByCode.get(code);
    const prev = prevByCode.get(code);
    const nowSalesValue = now ? now.realisasiValue : 0;
    const prevValue = prev ? prev.realisasiValue : 0;
    const g = prevValue > 0 ? (nowSalesValue - prevValue) / prevValue : null;
    return {
      code,
      name: now ? now.name : prev.name,
      nowValue: nowSalesValue,
      prevValue,
      growth: g,
      isGone: !now, // ada di snapshot lama, tapi tidak ada di periode aktif sekarang
      isNew: !prev, // ada di periode aktif sekarang, tapi belum ada waktu snapshot disimpan
    };
  }).sort((a, b) => (b.growth ?? -Infinity) - (a.growth ?? -Infinity));

  return { nowValue, thenValue, growth, bySales, label: snapshot.label };
}
