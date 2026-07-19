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
    totals: {
      targetValue: agg.totals.targetValue, realisasiValue: agg.totals.realisasiValue,
      targetAo: agg.totals.targetAo, realisasiAo: agg.totals.realisasiAo,
    },
    bySales: agg.bySales.map((s) => ({
      code: s.code, name: s.name,
      targetValue: s.targetValue, realisasiValue: s.realisasiValue,
      targetAo: s.targetAo, realisasiAo: s.realisasiAo,
    })),
    byGroup: agg.byGroup.map((g) => ({
      name: g.name,
      targetValue: g.targetValue, realisasiValue: g.realisasiValue,
      targetAo: g.targetAo, realisasiAo: g.realisasiAo,
    })),
  };
}

/* ============================================================================
   PERBANDINGAN MULTI-PERIODE (3+ periode, Value & AO per sales)
   Beda dengan computeComparison() di atas (1 periode aktif vs 1 snapshot),
   fungsi ini menyusun deret waktu (kronologis, periode aktif selalu di kolom
   paling akhir) untuk N snapshot riwayat sekaligus, dipakai di tab "Tren Periode".
============================================================================ */

// Ambil tanggal urut dari sebuah "periode" (snapshot riwayat ATAU periode aktif
// sekarang) — dipakai untuk mengurutkan kolom secara kronologis.
function periodSortKey(p) {
  return p.dateFrom || p.savedAt || p.id || "";
}

// Field AO mungkin tidak ada di snapshot lama (sebelum fitur AO ditambahkan) —
// selalu kembalikan null (bukan 0/undefined) supaya UI bisa membedakan
// "data lama tidak tersedia" dari "nilainya memang nol".
function safeNum(v) {
  return typeof v === "number" && !Number.isNaN(v) ? v : null;
}

function computeAch(realisasi, target) {
  if (realisasi === null || target === null || !target) return null;
  return realisasi / target;
}

export function computeMultiPeriodComparison(agg, snapshots, filters, fileName) {
  const currentPeriod = {
    id: "current",
    label: "Periode Aktif",
    sub: `${filters.dateFrom || "?"} — ${filters.dateTo || "?"}${fileName ? ` · ${fileName}` : ""}`,
    isCurrent: true,
    totals: {
      targetValue: safeNum(agg.totals.targetValue), realisasiValue: safeNum(agg.totals.realisasiValue),
      targetAo: safeNum(agg.totals.targetAo), realisasiAo: safeNum(agg.totals.realisasiAo),
    },
    bySales: agg.bySales.map((s) => ({
      code: s.code, name: s.name,
      targetValue: safeNum(s.targetValue), realisasiValue: safeNum(s.realisasiValue),
      targetAo: safeNum(s.targetAo), realisasiAo: safeNum(s.realisasiAo),
    })),
  };

  const historyPeriods = [...(snapshots || [])]
    .sort((a, b) => periodSortKey(a).localeCompare(periodSortKey(b)))
    .map((s) => ({
      id: s.id,
      label: s.label,
      sub: `${s.dateFrom || "?"} — ${s.dateTo || "?"}`,
      isCurrent: false,
      totals: {
        targetValue: safeNum(s.totals?.targetValue), realisasiValue: safeNum(s.totals?.realisasiValue),
        targetAo: safeNum(s.totals?.targetAo), realisasiAo: safeNum(s.totals?.realisasiAo),
      },
      bySales: (s.bySales || []).map((r) => ({
        code: r.code, name: r.name,
        targetValue: safeNum(r.targetValue), realisasiValue: safeNum(r.realisasiValue),
        targetAo: safeNum(r.targetAo), realisasiAo: safeNum(r.realisasiAo),
      })),
    }));

  // Periode aktif selalu jadi kolom paling akhir (kronologis "sekarang"),
  // terlepas dari nilai dateFrom-nya sendiri.
  const periods = [...historyPeriods, currentPeriod];

  // Union kode sales dari SELURUH periode — sales yang cuma muncul di sebagian
  // periode tetap kelihatan (mis. baru bergabung atau sudah resign).
  const nameByCode = new Map();
  periods.forEach((p) => p.bySales.forEach((s) => { if (!nameByCode.has(s.code)) nameByCode.set(s.code, s.name); }));

  const bySales = Array.from(nameByCode.keys()).map((code) => {
    const name = nameByCode.get(code);
    const series = periods.map((p) => {
      const row = p.bySales.find((s) => s.code === code);
      if (!row) {
        return { periodId: p.id, missing: true, value: null, ao: null, targetValue: null, targetAo: null, ach: null, achAo: null };
      }
      return {
        periodId: p.id, missing: false,
        value: row.realisasiValue, ao: row.realisasiAo,
        targetValue: row.targetValue, targetAo: row.targetAo,
        ach: computeAch(row.realisasiValue, row.targetValue),
        achAo: computeAch(row.realisasiAo, row.targetAo),
      };
    });
    // Growth dihitung dari 2 titik TERAKHIR yang datanya tersedia (bukan cuma
    // 2 kolom terakhir mentah-mentah), supaya kalau kolom terakhir kebetulan
    // "missing" untuk sales tsb, growth tetap masuk akal dan bukan otomatis null.
    const available = series.filter((pt) => !pt.missing);
    const last = available[available.length - 1];
    const prev = available[available.length - 2];
    const growthValue = last && prev && prev.value ? (last.value - prev.value) / prev.value : null;
    const growthAo = last && prev && prev.ao ? (last.ao - prev.ao) / prev.ao : null;
    return { code, name, series, growthValue, growthAo, latestValue: last ? last.value : null };
  }).sort((a, b) => (b.latestValue ?? -Infinity) - (a.latestValue ?? -Infinity));

  const totalsSeries = periods.map((p) => ({
    periodId: p.id,
    value: p.totals.realisasiValue, ao: p.totals.realisasiAo,
    targetValue: p.totals.targetValue, targetAo: p.totals.targetAo,
    ach: computeAch(p.totals.realisasiValue, p.totals.targetValue),
    achAo: computeAch(p.totals.realisasiAo, p.totals.targetAo),
  }));

  return {
    periods: periods.map((p) => ({ id: p.id, label: p.label, sub: p.sub, isCurrent: p.isCurrent })),
    bySales,
    totalsSeries,
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
