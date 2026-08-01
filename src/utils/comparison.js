import sumBy from "lodash/sumBy";
import { effectiveKartonQty } from "./excelParse.js";
import { detectMonths, computeAggregates } from "./aggregation.js";
import { todayLocalDateStr } from "./excelParse.js";

/* ============================================================================
   PERBANDINGAN (COMPARISON MATRIX) — tab "Perbandingan"
   Matriks entitas (baris) × periode (kolom). Semua mode (Sales/Grup/Outlet)
   mengikuti pola yang sama: pilih 2+ entitas, pilih 2+ periode, lalu lihat
   metrik per sel.

   Periode default = bulan kalender di dalam rentang filter global aktif.
   User bisa menambah sub-rentang kustom (mis. "1-15 Jul" vs "16-31 Jul").

   ACH per sel hanya dihitung kalau periode = 1 bulan kalender PENUH (target
   di aplikasi ini selalu berlaku per bulan). Sub-rentang parsial -> ach = null.

   Qty KARTON dihitung dari effectiveKartonQty() yang sudah ada — agg.bySales
   tidak membawa qty, jadi dihitung ulang di sini dari baris mentah.
============================================================================ */

const MONTHS_ID_FULL = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

// Apakah sebuah rentang tanggal = 1 bulan kalender penuh ("YYYY-MM-01" sampai
// akhir bulan itu). Dipakai untuk menentukan apakah ACH berlaku untuk periode itu.
export function isFullCalendarMonth(dateFrom, dateTo) {
  if (!dateFrom || !dateTo) return false;
  if (!/^\d{4}-\d{2}-01$/.test(dateFrom)) return false;
  const [y, m] = dateFrom.split("-");
  const lastDay = new Date(Number(y), Number(m), 0).getDate();
  return dateTo === `${y}-${m}-${String(lastDay).padStart(2, "0")}`;
}

// Label periode yang dibaca manusia. Rentang full bulan -> "Juli 2026".
// Rentang kustom -> "01-07 s/d 15-07".
export function periodLabel(dateFrom, dateTo) {
  if (isFullCalendarMonth(dateFrom, dateTo)) {
    const [y, m] = dateFrom.split("-");
    return `${MONTHS_ID_FULL[Number(m) - 1]} ${y}`;
  }
  return `${dateFrom} s/d ${dateTo}`;
}

// Potong daftar bulan kalender (dari detectMonths) ke rentang filter global
// yang sedang aktif. Bulan yang hanya "menyentuh" sebagian rentang tetap
// disertakan (di-clamp ke batas filter) supaya bulan terakhir yang belum
// berjalan tetap muncul — labelnya nanti tetap menampilkan rentang asli bulan.
export function clampMonthsToFilter(detected, dateFrom, dateTo) {
  return detected
    .filter((m) => {
      if (dateFrom && m.dateTo < dateFrom) return false;
      if (dateTo && m.dateFrom > dateTo) return false;
      return true;
    })
    .map((m) => ({
      ...m,
      dateFrom: dateFrom && dateFrom > m.dateFrom ? dateFrom : m.dateFrom,
      dateTo: dateTo && dateTo < m.dateTo ? dateTo : m.dateTo,
    }));
}

// Rentang sub-periode kustom yang dimasukkan user lewat date picker.
export function parseCustomRange(label, dateFrom, dateTo) {
  return { id: `custom:${label}`, label, dateFrom, dateTo, isCustom: true };
}

/* ----------------------------------------------------------------------------
   AGREGASI PER PERIODE
   Hitung agregat penuh (computeAggregates) untuk tiap periode dengan filter
   sales yang dipilih. Ini pola yang sama dengan autoTrendComparisonData di
   SalesMonitoringApp.jsx — grup SENGAJA dikosongkan supaya tiap periode
   mencakup semua golongan barang yang benar-benar ada di periode itu.
---------------------------------------------------------------------------- */
export function computePeriodAggs(rawRows, targets, salesCodes, periods, workDays) {
  return periods.map((p) => {
    const agg = computeAggregates(rawRows, targets, {
      salesCodes: salesCodes || [],
      groups: [],
      dateFrom: p.dateFrom,
      dateTo: p.dateTo,
    }, workDays);
    return { period: p, agg };
  });
}

/* ----------------------------------------------------------------------------
   MODE SALES — matriks sales × periode
   Baris = sales terpilih (union dari SEMUA periode, supaya sales yang hanya
   muncul di sebagian periode tetap kelihatan). Kolom = periode. Metrik per sel
   = value / ao / qty / ach / deviasi.
---------------------------------------------------------------------------- */
export function buildSalesMatrix(periodAggs, selectedSalesCodes, workDays) {
  const codes = new Set(selectedSalesCodes || []);
  // Union kode sales dari semua periode (terhormat kode yang dipilih user).
  periodAggs.forEach(({ agg }) => agg.bySales.forEach((s) => codes.add(s.code)));
  const nameByCode = new Map();
  periodAggs.forEach(({ agg }) => agg.bySales.forEach((s) => { if (!nameByCode.has(s.code)) nameByCode.set(s.code, s.name); }));
  const targetByCode = new Map();
  periodAggs.forEach(({ agg }) => agg.bySales.forEach((s) => { if (!targetByCode.has(s.code)) targetByCode.set(s.code, s.targetValue); }));

  const rows = Array.from(codes).map((code) => {
    const cells = periodAggs.map(({ agg, period }) => {
      const sm = agg.bySales.find((s) => s.code === code);
      if (!sm) return { period, exists: false, value: null, ao: null, qty: null, ach: null, deviasi: null, targetValue: null };
      return {
        period,
        exists: true,
        value: sm.realisasiValue,
        ao: sm.realisasiAo,
        ach: sm.ach,
        deviasi: sm.deviasiValue,
        targetValue: sm.targetValue,
      };
    });

    // Qty KARTON dihitung terpisah dari baris mentah per periode (agg tidak
    // membawa qty) — scan satu kali untuk kode sales ini di tiap periode.
    const qtyByPeriod = periodAggs.map(({ agg, period }) => ({
      period,
      qty: sumBy(agg.filteredRows.filter((r) => r.salesCode === code), effectiveKartonQty),
    }));

    return { code, name: nameByCode.get(code) || code, targetValue: targetByCode.get(code) ?? null, cells, qtyByPeriod };
  });

  return { rows };
}

/* ----------------------------------------------------------------------------
   MODE GRUP — matriks grup × periode
   Sama seperti sales, tapi baris = nama grup produk. ACH pakai target grup
   (dari targets per sales) — dihitung ulang via computeAggregates tiap periode.
---------------------------------------------------------------------------- */
export function buildGroupMatrix(periodAggs, selectedGroupNames) {
  const names = new Set(selectedGroupNames || []);
  periodAggs.forEach(({ agg }) => agg.byGroup.forEach((g) => names.add(g.name)));

  const rows = Array.from(names).map((name) => {
    const cells = periodAggs.map(({ agg, period }) => {
      const g = agg.byGroup.find((x) => x.name === name);
      if (!g) return { period, exists: false, value: null, ao: null, qty: null, ach: null, deviasi: null, targetValue: null };
      return { period, exists: true, value: g.realisasiValue, ao: g.realisasiAo, ach: g.ach, deviasi: g.deviasiValue, targetValue: g.targetValue };
    });
    const qtyByPeriod = periodAggs.map(({ agg, period }) => ({
      period,
      qty: sumBy(agg.filteredRows.filter((r) => r.group === name), effectiveKartonQty),
    }));
    return { code: name, name, targetValue: null, cells, qtyByPeriod };
  });

  return { rows };
}

/* ----------------------------------------------------------------------------
   MODE OUTLET — matriks outlet × periode
   Tidak ada target per outlet -> ach/deviasi = null. Identitas outlet =
   outletCode || outletName. Qty & AO dihitung dari baris per periode.
---------------------------------------------------------------------------- */
export function buildOutletMatrix(periodAggs, selectedOutletKeys) {
  const keys = new Set(selectedOutletKeys || []);
  const nameByKey = new Map();
  periodAggs.forEach(({ agg }) => {
    agg.filteredRows.forEach((r) => {
      const k = r.outletCode || r.outletName || "UNKNOWN";
      if (!nameByKey.has(k)) nameByKey.set(k, r.outletName || r.outletCode || "(tanpa nama)");
    });
  });
  keys.forEach((k) => { if (!nameByKey.has(k)) nameByKey.set(k, k); });

  const rows = Array.from(keys).map((key) => {
    const cells = periodAggs.map(({ agg, period }) => {
      const rs = agg.filteredRows.filter((r) => (r.outletCode || r.outletName || "UNKNOWN") === key);
      if (!rs.length) return { period, exists: false, value: null, ao: null, qty: null, ach: null, deviasi: null, targetValue: null };
      return {
        period,
        exists: true,
        value: sumBy(rs, "value"),
        // "AO" tidak bermakna di level outlet (tiap baris tabel sudah
        // difilter ke 1 outlet spesifik, jadi "jumlah outlet unik" akan
        // selalu ~1 — tidak informatif). Diganti maknanya jadi "Frekuensi
        // Transaksi" (jumlah invoice unik) — field key tetap "ao" supaya
        // struktur matrix & cellMetric() tetap seragam lintas dimensi;
        // cuma LABEL di UI yang disesuaikan per mode (lihat COMPARISON_METRICS
        // & MetricToggle/ComparisonPage).
        ao: new Set(rs.map((r) => r.invoiceNo).filter(Boolean)).size,
        qty: sumBy(rs, effectiveKartonQty),
        ach: null,
        deviasi: null,
        targetValue: null,
      };
    });
    return { code: key, name: nameByKey.get(key) || key, targetValue: null, cells, qtyByPeriod: null };
  });

  return { rows };
}

/* ----------------------------------------------------------------------------
   METRIK & SORTIR
   Metrik yang bisa dipilih. qty diambil dari qtyByPeriod (sales/grup) atau
   langsung dari sel (outlet).
---------------------------------------------------------------------------- */
export const COMPARISON_METRICS = [
  { key: "value", label: "Value", money: true },
  { key: "ao", label: "AO", money: false },
  { key: "qty", label: "Qty KARTON", money: false },
  { key: "ach", label: "ACH", money: false, pct: true },
  { key: "deviasi", label: "Deviasi", money: true },
];

export function cellMetric(cell, qty, metricKey) {
  switch (metricKey) {
    case "qty": return qty ?? cell.qty;
    case "ach": return cell.ach;
    case "deviasi": return cell.deviasi;
    case "ao": return cell.ao;
    default: return cell.value;
  }
}

// Total metrik per baris (semua periode yang ADA datanya) — dipakai untuk
// KPI row & sortir.
export function rowTotal(rows, metricKey) {
  return rows.map((r) => ({
    ...r,
    _total: r.cells.reduce((acc, c, i) => {
      if (!c.exists) return acc;
      const v = cellMetric(c, r.qtyByPeriod ? r.qtyByPeriod[i].qty : null, metricKey);
      if (v === null || v === undefined || Number.isNaN(v)) return acc;
      return acc + v;
    }, 0),
  }));
}

// Growth antar 2 titik data TERAKHIR yang tersedia untuk metrik aktif.
// Negatif/positif -> badge naik/turun; null -> "-".
export function computeGrowth(row, metricKey) {
  const vals = row.cells
    .map((c, i) => (c.exists ? { v: cellMetric(c, row.qtyByPeriod ? row.qtyByPeriod[i].qty : null, metricKey), exists: true } : null))
    .filter(Boolean);
  const last = vals[vals.length - 1];
  const prev = vals[vals.length - 2];
  if (!last || !prev || !prev.v || last.v === null || last.v === undefined) return null;
  return (last.v - prev.v) / prev.v;
}

// Daftar outlet unik (kode + nama) dari semua periode — untuk EntityPicker mode outlet.
export function collectOutletOptions(periodAggs) {
  const map = new Map();
  periodAggs.forEach(({ agg }) => {
    agg.filteredRows.forEach((r) => {
      const k = r.outletCode || r.outletName || "UNKNOWN";
      if (!map.has(k)) map.set(k, r.outletName || r.outletCode || "(tanpa nama)");
    });
  });
  return Array.from(map.entries()).map(([key, label]) => ({ key, label }));
}

// Rentang "periode aktif" saat ini untuk info header halaman.
export function buildComparisonHeader(periods, dateFrom, dateTo) {
  return {
    count: periods.length,
    label: dateFrom && dateTo ? `${dateFrom} — ${dateTo}` : "Semua data",
    generatedAt: todayLocalDateStr(),
  };
}

export { detectMonths };
