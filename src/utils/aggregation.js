import { useMemo } from "react";
import { normalizeHeader, dateStrToLocalDate, effectiveKartonQty } from "./excelParse.js";
import { ALERT_MIN_DAYS } from "../constants/thresholds.js";
import { MONTHS_ID_FULL, sumBy } from "./formatters.js";

/* ============================================================================
   AGGREGATION
   Hook useAggregates + helper pure functions untuk drill-down outlet dan
   segmentasi outlet. Semua dipindah dari SalesMonitoringApp.jsx supaya file
   utama hanya berisi UI/orchestration.

   Logika di sini TIDAK boleh import React JSX — pure functions + 1 hook saja.
============================================================================ */

// row.date sudah berupa teks "YYYY-MM-DD" (lihat excelValueToDateStr), jadi tinggal dipakai apa adanya.
export function dateKey(dateStr) { return dateStr || "unknown"; }
export function monthKey(dateStr) { return dateStr ? dateStr.slice(0, 7) : "unknown"; }

// Rule "ahead/behind pace": apakah ACH sekarang sudah >= progres waktu yang
// sudah berjalan (timeGonePct). SATU-SATUNYA tempat rule ini didefinisikan —
// dipakai bersama oleh PaceStrip (Main Report) & CompactKpiGrid (Executive
// Summary) supaya kedua tab selalu konsisten kalau rule-nya berubah nanti.
export function computePaceStatus(achPct, timeGonePct) {
  if (achPct === null || achPct === undefined) return { isAhead: null };
  return { isAhead: achPct >= timeGonePct };
}

// Deteksi bulan-bulan kalender berbeda yang ada di `rows` (dipakai untuk
// auto-perbandingan per-bulan di Tren Periode saat data upload mencakup
// >1 bulan). Return terurut kronologis (lama -> baru), tiap entri berisi
// batas tanggal awal/akhir bulan itu (bukan cuma tanggal yang ADA datanya —
// dateFrom = tanggal 1 bulan itu, supaya konsisten dengan cara periode
// "sebulan penuh" biasanya didefinisikan di app ini).
export function detectMonths(rows) {
  if (!rows || !rows.length) return [];
  const keys = new Set();
  let lastKey = null;
  for (let i = 0; i < rows.length; i++) {
    const d = rows[i].date;
    if (!d) continue;
    const key = d.length >= 7 ? d.slice(0, 7) : monthKey(d);
    if (key !== lastKey) {
      lastKey = key;
      keys.add(key);
    }
  }
  return Array.from(keys).sort().map((key) => {
    const [y, m] = key.split("-");
    const dateFrom = `${key}-01`;
    const dateTo = endOfMonthDateStr(dateFrom);
    return { key, dateFrom, dateTo, label: `${MONTHS_ID_FULL[Number(m) - 1]} ${y}` };
  });
}

/* ----------------------------------------------------------------------------
   PROYEKSI NON-LINEAR — helper pure function.
   Metode "linear" (dailyRate rata-rata semua hari × workDays) tetap jadi
   default/fallback dan TIDAK diubah di sini — field projection.projectedValue
   dkk tetap berarti hasil linear (backward-compat untuk pdfExport.js dll).
   Fungsi-fungsi di bawah ini menghitung 2 metode ALTERNATIF sebagai data
   tambahan (projection.methods.trend7 / projection.methods.weekday).
---------------------------------------------------------------------------- */

// true kalau dateStr ("YYYY-MM-DD") jatuh di Sabtu/Minggu.
function isWeekendDate(dateStr) {
  const d = dateStrToLocalDate(dateStr);
  if (!d) return false;
  const day = d.getDay(); // 0 = Minggu, 6 = Sabtu
  return day === 0 || day === 6;
}

// Tanggal terakhir kalender bulan dari sebuah dateStr "YYYY-MM-DD".
function endOfMonthDateStr(dateStr) {
  const d = dateStrToLocalDate(dateStr);
  if (!d) return null;
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0); // hari ke-0 bulan depan = hari terakhir bulan ini
  const mm = String(last.getMonth() + 1).padStart(2, "0");
  const dd = String(last.getDate()).padStart(2, "0");
  return `${last.getFullYear()}-${mm}-${dd}`;
}

// Metode "Tren 7 Hari Terakhir": rata-rata TERBOBOT dari maksimal 7 hari
// transaksi TERAKHIR (bukan 7 hari kalender — hari tanpa transaksi sama
// sekali tidak masuk array `daily`, konsisten dengan cara linear menghitung
// "uniqueDays"). Hari lebih baru dapat bobot lebih besar (1..N).
// Minimal 3 hari data supaya tidak terlalu noisy; kalau kurang, return null
// (pemanggil fallback ke linear).
export function computeTrend7Projection(daily, workDays, totalTargetValue) {
  if (!daily || daily.length < 3) return null;
  const window = daily.slice(-7); // maks 7 hari terakhir, bisa kurang kalau data belum sebanyak itu
  const n = window.length;
  let weightedSum = 0, weightTotal = 0;
  window.forEach((d, i) => {
    const w = i + 1; // 1..n, hari paling baru (index terakhir) dapat bobot terbesar
    weightedSum += d.value * w;
    weightTotal += w;
  });
  const dailyRate = weightTotal ? weightedSum / weightTotal : 0;
  const projectedValue = workDays ? dailyRate * workDays : null;
  return {
    dailyRate,
    projectedValue,
    projectedAch: (projectedValue !== null && totalTargetValue) ? projectedValue / totalTargetValue : null,
    windowDays: n,
  };
}

// Metode "Pola Hari Kerja vs Weekend": rata-rata harian DIPISAH weekday vs
// weekend dari data yang sudah ada, lalu diproyeksikan berdasarkan TANGGAL
// KALENDER sungguhan yang tersisa (bukan angka workDays manual) — dihitung dari
// hari setelah data terakhir sampai dateTo (kalau filter diisi) atau akhir
// bulan kalender dari tanggal data terakhir (fallback).
export function computeWeekdayProjection(daily, totalTargetValue, meta, filters) {
  if (!daily || daily.length < 3 || !meta.lastDate) return null;

  const weekdayDays = daily.filter((d) => !isWeekendDate(d.date));
  const weekendDays = daily.filter((d) => isWeekendDate(d.date));
  const weekdayRate = weekdayDays.length ? sumBy(weekdayDays, "value") / weekdayDays.length : 0;
  // Fallback kalau belum ada data weekend sama sekali (mis. baru masuk minggu
  // pertama): pakai rata-rata keseluruhan sebagai estimasi weekend, supaya
  // tidak menghasilkan proyeksi 0 untuk weekend yang belum pernah terjadi.
  const overallRate = daily.length ? sumBy(daily, "value") / daily.length : 0;
  const weekendRate = weekendDays.length ? sumBy(weekendDays, "value") / weekendDays.length : overallRate;
  const weekendIsEstimated = weekendDays.length === 0;

  const periodEnd = filters.dateTo || endOfMonthDateStr(meta.lastDate);
  if (!periodEnd || periodEnd <= meta.lastDate) {
    return { weekdayRate, weekendRate, weekendIsEstimated, remainingWeekdays: 0, remainingWeekends: 0, projectedValue: null, projectedAch: null };
  }

  // Hitung sisa tanggal kalender (lastDate+1 .. periodEnd), klasifikasi weekday/weekend.
  let remainingWeekdays = 0, remainingWeekends = 0;
  let cursor = dateStrToLocalDate(meta.lastDate);
  cursor.setDate(cursor.getDate() + 1);
  const end = dateStrToLocalDate(periodEnd);
  while (cursor <= end) {
    const day = cursor.getDay();
    if (day === 0 || day === 6) remainingWeekends += 1; else remainingWeekdays += 1;
    cursor.setDate(cursor.getDate() + 1);
  }

  const totalRealisasiSoFar = sumBy(daily, "value");
  const projectedValue = totalRealisasiSoFar + weekdayRate * remainingWeekdays + weekendRate * remainingWeekends;
  return {
    weekdayRate, weekendRate, weekendIsEstimated, remainingWeekdays, remainingWeekends,
    projectedValue,
    projectedAch: totalTargetValue ? projectedValue / totalTargetValue : null,
  };
}

export function matchFocus(row, focusItem) {
  // `matchType` eksplisit (diisi lewat UI Pengaturan) diprioritaskan. Untuk data lama
  // yang masih pakai sentinel keyword ("__GROUP__"/"GAS_EXACT") tanpa matchType,
  // tetap dikenali otomatis supaya kompatibel.
  const matchType = focusItem.matchType
    || (focusItem.keyword === "__GROUP__" ? "group" : focusItem.keyword === "GAS_EXACT" ? "exact" : "contains");

  if (matchType === "group") return normalizeHeader(row.group) === normalizeHeader(focusItem.name);

  // Catatan: field `unit` pada konfigurasi produk fokus tidak lagi dipakai untuk
  // menyaring baris — sejak kuantitas otomatis dikonversi ke setara KARTON
  // (lihat attachKartonQty/effectiveKartonQty), pencocokan cukup berdasarkan
  // nama/grup produk saja, apa pun satuan asli transaksinya.
  if (matchType === "exact") {
    const target = focusItem.keyword === "GAS_EXACT" ? "GAS" : focusItem.keyword;
    return normalizeHeader(row.productName) === normalizeHeader(target);
  }
  return normalizeHeader(row.productName).includes(normalizeHeader(focusItem.keyword));
}

// Realisasi + AO per sales KHUSUS tanggal terakhir dalam data yang difilter
// (agg.meta.lastDate) — dipakai untuk membandingkan pencapaian TOTAL periode
// vs pencapaian HARI TERAKHIR per sales. AO dihitung sebagai outlet unik
// LINTAS GRUP untuk sales itu pada tanggal tsb, konsisten dengan cara
// `realisasiAo` dihitung di computeAggregates dan dengan Section 3 di
// pdfExport.js (exportSummaryPDF). Tidak ada ACH% di sini — app ini tidak
// punya konsep target harian, jadi cuma angka mentah (Realisasi & AO).
export function getLastDaySalesMap(filteredRows, lastDate) {
  const map = {};
  if (!lastDate) return map;
  filteredRows.forEach((r) => {
    if (r.date !== lastDate) return;
    if (!map[r.salesCode]) map[r.salesCode] = { value: 0, outlets: new Set() };
    map[r.salesCode].value += r.value;
    if (r.outletCode) map[r.salesCode].outlets.add(r.outletCode);
  });
  const result = {};
  Object.entries(map).forEach(([code, v]) => { result[code] = { valueLastDay: v.value, aoLastDay: v.outlets.size }; });
  return result;
}

// Rincian per outlet untuk fitur drill-down — menerima kumpulan baris (biasanya
// agg.filteredRows) dan sebuah predicate (fungsi filter tambahan: per sales, per
// grup, atau per produk fokus), lalu kelompokkan berdasarkan outlet.
export function getOutletBreakdown(rows, predicate) {
  const matched = predicate ? rows.filter(predicate) : rows;
  const map = {};
  matched.forEach((r) => {
    const key = r.outletCode || r.outletName || "UNKNOWN";
    if (!map[key]) {
      map[key] = { outletCode: r.outletCode, outletName: r.outletName || r.outletCode || "(tanpa nama)",
        value: 0, qty: 0, invoices: new Set(), lastDate: null };
    }
    map[key].value += r.value;
    map[key].qty += effectiveKartonQty(r);
    if (r.invoiceNo) map[key].invoices.add(r.invoiceNo);
    if (!map[key].lastDate || r.date > map[key].lastDate) map[key].lastDate = r.date;
  });
  return Object.values(map)
    .map((o) => ({ ...o, invoiceCount: o.invoices.size }))
    .sort((a, b) => b.value - a.value);
}

/* ============================================================================
   ANALISIS OUTLET — segmentasi Aktif/Berisiko/Dormant berdasarkan Recency
   (hari sejak transaksi terakhir, relatif terhadap tanggal terakhir DI DALAM
   data yang sedang dimuat — bukan lintas periode/riwayat).
============================================================================ */

export function computeOutletAnalysis(rows, meta, thresholds) {
  const map = {};
  rows.forEach((r) => {
    const key = r.outletCode || r.outletName || "UNKNOWN";
    if (!map[key]) {
      map[key] = {
        outletCode: r.outletCode, outletName: r.outletName || r.outletCode || "(tanpa nama)",
        // ⚠️ Sprint 17i: simpan alamat outlet dari baris pertama yang ditemui
        // untuk key ini. Bila baris berikutnya punya alamat berbeda (jarang
        // tapi bisa terjadi kalau data master kotor), pakai alamat non-kosong
        // pertama — bukan overwrite dengan "".
        outletAddress: r.outletAddress || "",
        value: 0, qty: 0, invoices: new Set(), groups: new Set(), salesNames: new Set(), lastDate: null,
      };
    }
    const o = map[key];
    o.value += r.value;
    o.qty += effectiveKartonQty(r);
    if (r.invoiceNo) o.invoices.add(r.invoiceNo);
    if (r.group) o.groups.add(r.group);
    if (r.salesName) o.salesNames.add(r.salesName);
    // Isi alamat bila belum ada (baris berikutnya mungkin punya alamat yang
    // baris pertama tidak punya — di file yang kolom alamat-nya sebagian kosong).
    if (!o.outletAddress && r.outletAddress) o.outletAddress = r.outletAddress;
    if (r.lat !== undefined && o.lat === undefined) o.lat = r.lat;
    if (r.lng !== undefined && o.lng === undefined) o.lng = r.lng;
    if (!o.lastDate || r.date > o.lastDate) o.lastDate = r.date;
  });

  const refD = meta.lastDate ? dateStrToLocalDate(meta.lastDate) : null;

  const list = Object.values(map).map((o) => {
    const lastD = o.lastDate ? dateStrToLocalDate(o.lastDate) : null;
    const daysSinceLastPurchase = (refD && lastD) ? Math.round((refD - lastD) / 86400000) : null;
    let status = "unknown";
    if (daysSinceLastPurchase !== null) {
      if (daysSinceLastPurchase <= thresholds.activeMaxDays) status = "active";
      else if (daysSinceLastPurchase <= thresholds.dormantMinDays) status = "at_risk";
      else status = "dormant";
    }
    const sortedNames = Array.from(o.salesNames).sort();
    return {
      outletCode: o.outletCode,
      outletName: o.outletName,
      // ⚠️ Sprint 17i: teruskan alamat ke hasil list untuk dipakai di export.
      outletAddress: o.outletAddress || "",
      lat: o.lat,
      lng: o.lng,
      value: o.value,
      qty: o.qty,
      invoiceCount: o.invoices.size,
      groupCount: o.groups.size,
      salesNames: sortedNames,
      salesLabel: sortedNames.join(", ") || "-",
      lastDate: o.lastDate,
      daysSinceLastPurchase,
      status,
    };
  }).sort((a, b) => b.value - a.value);

  return {
    list,
    summary: {
      total: list.length,
      active: list.filter((o) => o.status === "active").length,
      atRisk: list.filter((o) => o.status === "at_risk").length,
      dormant: list.filter((o) => o.status === "dormant").length,
    },
  };
}

/** Breakdown produk yang dibeli oleh 1 outlet spesifik — dipakai di modal detail outlet. */
export function getProductBreakdownForOutlet(rows, outletCode) {
  const map = {};
  rows.filter((r) => r.outletCode === outletCode).forEach((r) => {
    const key = r.productCode || r.productName || "UNKNOWN";
    if (!map[key]) map[key] = { productName: r.productName || key, group: r.group || "-", value: 0, qty: 0, invoices: new Set() };
    map[key].value += r.value;
    map[key].qty += effectiveKartonQty(r);
    if (r.invoiceNo) map[key].invoices.add(r.invoiceNo);
  });
  return Object.values(map)
    .map((p) => ({ ...p, invoiceCount: p.invoices.size }))
    .sort((a, b) => b.value - a.value);
}

// ⚠️ Sprint 19e / Focus Group Drilldown: breakdown per-SKU untuk grup fokus.
// Filter transaksi by predicate (salesCode + group), lalu roll-up per productCode.
// Mirip getProductBreakdownForOutlet tapi lebih kaya: include outlet count, sales label,
// last date — supaya modal drilldown tampilkan info lengkap per SKU.
export function getProductBreakdownForGroup(rows, predicate) {
  const map = {};
  const matched = typeof predicate === "function" ? (rows || []).filter(predicate) : (rows || []);
  matched.forEach((r) => {
    const key = r.productCode || r.productName || "UNKNOWN";
    if (!map[key]) {
      map[key] = {
        productCode: r.productCode || key,
        productName: r.productName || key,
        group: r.group || "-",
        value: 0,
        qty: 0,
        invoices: new Set(),
        outlets: new Set(),
        salesNames: new Set(),
        unit: r.unit || "",
        lastDate: null,
      };
    }
    const p = map[key];
    p.value += r.value;
    p.qty += effectiveKartonQty(r);
    if (r.invoiceNo) p.invoices.add(r.invoiceNo);
    if (r.outletCode) p.outlets.add(r.outletCode);
    if (r.salesName) p.salesNames.add(r.salesName);
    if (!p.lastDate || r.date > p.lastDate) p.lastDate = r.date;
  });
  return Object.values(map)
    .map((p) => ({
      ...p,
      invoiceCount: p.invoices.size,
      outletCount: p.outlets.size,
      salesLabel: Array.from(p.salesNames).sort().join(", ") || "-",
    }))
    .sort((a, b) => b.value - a.value);
}

// - Kalau semua baris yang cocok berhasil dikonversi -> "KARTON" (satuan hasil konversi).
// - Kalau semua baris TIDAK bisa dikonversi (tidak ada referensi KARTON di data untuk
//   produk itu) -> pakai satuan asli transaksinya apa adanya (mis. "IKAT").
// - Kalau campuran (sebagian bisa dikonversi, sebagian tidak, atau satuan aslinya
//   berbeda-beda) -> tandai "Campuran" supaya tidak menyesatkan.
export function resolveFocusUnit(rows) {
  if (!rows.length) return "KARTON";
  const unconv = rows.filter((r) => r.unconvertible);
  if (unconv.length === 0) return "KARTON";
  if (unconv.length === rows.length) {
    const units = new Set(unconv.map((r) => r.unit || "?"));
    return units.size === 1 ? [...units][0] : "Campuran";
  }
  return "Campuran";
}

// Fungsi murni (bukan hook) — bisa dipanggil berkali-kali dalam loop biasa,
// misalnya untuk menghitung agregat PER BULAN saat auto-deteksi multi-bulan
// di Tren Periode (lihat SalesMonitoringApp.jsx). `useAggregates` di bawah
// cuma pembungkus tipis untuk pemakaian normal di komponen (via useMemo).
export function computeAggregates(rows, targets, filters, workDays) {
    const inRange = (dateStr) => {
      if (!filters.dateFrom && !filters.dateTo) return true;
      if (!dateStr) return false;
      // dateStr, filters.dateFrom, filters.dateTo semuanya teks "YYYY-MM-DD" —
      // perbandingan teks di format ini otomatis benar secara kronologis.
      if (filters.dateFrom && dateStr < filters.dateFrom) return false;
      if (filters.dateTo && dateStr > filters.dateTo) return false;
      return true;
    };

    const hasSalesFilter = filters.salesCodes && filters.salesCodes.length > 0;
    const salesFilterSet = hasSalesFilter ? new Set(filters.salesCodes) : null;
    const hasGroupFilter = filters.groups && filters.groups.length > 0;
    const groupFilterSet = hasGroupFilter ? new Set(filters.groups) : null;

    const relevantTargets = hasSalesFilter
      ? targets.filter((t) => salesFilterSet.has(t.code))
      : targets;

    // ---- SINGLE-PASS UNIFIED BUILD ----
    // Seluruh filter, pengelompokan Map, dan pre-agregasi kuantiti karton
    // disatukan ke dalam SATU lintasan O(N) tanpa alokasi array berulang.
    const filtered = [];
    const EMPTY_ARRAY = [];
    const rowsBySales = new Map();
    const rowsByGroup = new Map();
    const rowsBySalesGroup = new Map();
    const outletMap = new Map();
    const dailyMap = {};
    const monthlyMap = {};
    const aoUniqueOutlets = new Set();
    const uniqueDateStrsSet = new Set();
    const qtyKartonBySales = new Map();
    const qtyKartonByGroup = new Map();

    const pushTo = (map, key, row) => {
      let arr = map.get(key);
      if (!arr) { arr = []; map.set(key, arr); }
      arr.push(row);
    };

    const rowsCount = rows ? rows.length : 0;
    for (let i = 0; i < rowsCount; i++) {
      const r = rows[i];
      if (!inRange(r.date)) continue;
      if (hasSalesFilter && !salesFilterSet.has(r.salesCode)) continue;
      if (hasGroupFilter && !groupFilterSet.has(r.group)) continue;

      filtered.push(r);

      // bySales
      if (r.salesCode) pushTo(rowsBySales, r.salesCode, r);
      // byGroup
      if (r.group) pushTo(rowsByGroup, r.group, r);
      // composite sales|group
      if (r.salesCode && r.group) pushTo(rowsBySalesGroup, r.salesCode + "|" + r.group, r);

      // byOutlet
      const ok = r.outletCode || r.outletName || "UNKNOWN";
      let o = outletMap.get(ok);
      if (!o) {
        o = {
          key: ok,
          name: r.outletName || r.outletCode || "(tanpa nama)",
          value: 0,
          qtyKarton: 0,
          invoiceSet: new Set(),
        };
        outletMap.set(ok, o);
      }
      o.value += (r.value || 0);
      const q = effectiveKartonQty(r);
      o.qtyKarton += q;
      if (r.invoiceNo) o.invoiceSet.add(r.invoiceNo);

      // daily
      const dk = dateKey(r.date);
      if (!dailyMap[dk]) dailyMap[dk] = { date: dk, value: 0, outlets: new Set() };
      dailyMap[dk].value += (r.value || 0);
      if (r.outletCode) dailyMap[dk].outlets.add(r.outletCode);

      // monthly
      const mk = monthKey(r.date);
      monthlyMap[mk] = (monthlyMap[mk] || 0) + (r.value || 0);

      // aoUniqueOutlets (untuk totalRealisasiAo)
      if (r.salesCode && r.outletCode) aoUniqueOutlets.add(r.salesCode + "|" + r.outletCode);

      // uniqueDateStrs (untuk meta)
      if (r.date) uniqueDateStrsSet.add(r.date);

      // Pre-aggregated qty KARTON per sales & group
      if (r.salesCode) qtyKartonBySales.set(r.salesCode, (qtyKartonBySales.get(r.salesCode) || 0) + q);
      if (r.group) qtyKartonByGroup.set(r.group, (qtyKartonByGroup.get(r.group) || 0) + q);
    }

    // per sales
    //
    // ⚠️ Performance fix (Sprint 3 / P1): sebelumnya pakai nested
    // `filtered.filter(r => r.salesCode === t.code)` untuk SETIAP target
    // sales, lalu di dalamnya `rs.filter(r => r.group === g.name)` untuk
    // SETIAP grup, lalu `rs.filter(r => matchFocus(r, f))` untuk SETIAP fokus.
    // Kompleksitas: O(N_sales × N_groups × N_rows + N_sales × N_focus × N_rows)
    // — untuk 15k rows × 30 sales × 10 groups × 5 focus = ~6.75M + ~2.25M iterasi.
    //
    // Sekarang: bangun Map index sekali jalan (single pass over `filtered`),
    // lalu lookup O(1) per sales / grup / (sales,grup). Fokus item tetap perlu
    // scan per-sales rows (matchFocus tidak bisa di-index), tapi hanya scan
    // rows untuk sales itu (bukan seluruh `filtered`) — total cost turun
    // signifikan.
    const bySales = relevantTargets.map((t) => {
      const rs = rowsBySales.get(t.code) || EMPTY_ARRAY;
      const value = sumBy(rs, "value");
      const ao = new Set(rs.map((r) => r.outletCode)).size;

      // ⚠️ Sprint 5 / Target ikut filter grup: targetValue & targetAO per sales
      // mengikuti filters.groups, bukan selalu target global (t.total.*).
      // - Tanpa filter grup → pakai target global (t.total.value / t.total.ao).
      // - Dengan filter grup → targetValue = SUM grup yang difilter (value aditif,
      //   sudah diverifikasi sum grup ≈ total). targetAo = MAX grup yang difilter,
      //   karena target AO antar grup TUMPAH (satu outlet bisa beli banyak grup)
      //   sehingga tidak bisa dijumlah — pakai max supaya tidak melebihi total.ao.
      const hasGroupFilter = filters.groups.length > 0;
      let targetValue, targetAo;
      if (!hasGroupFilter) {
        targetValue = t.total.value;
        targetAo = t.total.ao;
      } else {
        const filteredGroups = t.groups.filter((g) => filters.groups.includes(g.name));
        targetValue = sumBy(filteredGroups, "value");
        // Max group yang difilter; fallback ke total.ao kalau tidak ada grup match.
        targetAo = filteredGroups.length
          ? filteredGroups.reduce((m, g) => Math.max(m, g.ao || 0), 0)
          : 0;
      }

      const ach = targetValue ? value / targetValue : null;
      const achAo = targetAo ? ao / targetAo : null;

      // Breakdown per grup produk milik sales ini — pakai rowsBySalesGroup
      // (Map<salesCode|groupName, Array<row>>) yang sudah dibangun di
      // single-pass loop di atas.
      const groups = t.groups.map((g) => {
        const grs = rowsBySalesGroup.get(t.code + "|" + g.name) || EMPTY_ARRAY;
        const gValue = sumBy(grs, "value");
        const gAo = new Set(grs.map((r) => r.outletCode)).size;
        return {
          name: g.name, targetValue: g.value, targetAo: g.ao, focus: !!g.focus,
          realisasiValue: gValue, realisasiAo: gAo,
          ach: g.value ? gValue / g.value : null, achAo: g.ao ? gAo / g.ao : null,
          deviasiValue: g.value ? g.value - gValue : 0, deviasiAo: g.ao ? g.ao - gAo : 0,
          predicate: (row) => row.salesCode === t.code && row.group === g.name,
        };
      });

      // Breakdown per produk fokus — matchFocus tidak bisa di-index (custom
      // predicate), jadi tetap scan rs. Tapi rs sudah kecil (hanya rows
      // untuk sales ini), bukan seluruh `filtered`.
      const focus = t.focus.map((f) => {
        const frs = rs.filter((r) => matchFocus(r, f));
        const realisasi = sumBy(frs, effectiveKartonQty);
        const hasUnconvertible = frs.some((r) => r.unconvertible);
        const unit = resolveFocusUnit(frs);
        return { name: f.name, target: f.target, keyword: f.keyword, matchType: f.matchType, realisasi, pct: f.target ? realisasi / f.target : null, hasUnconvertible, unit,
          predicate: (row) => row.salesCode === t.code && matchFocus(row, f) };
      });

      return { code: t.code, name: t.name, tier: t.tier, targetValue, targetAo,
        realisasiValue: value, realisasiAo: ao, ach, achAo,
        deviasiValue: targetValue ? targetValue - value : null,
        deviasiAo: targetAo ? targetAo - ao : null,
        groups, focus, focusGroups: groups.filter((g) => g.focus), predicate: (row) => row.salesCode === t.code };
    });

    const totalTargetValue = sumBy(bySales, "targetValue");
    const totalTargetAo = sumBy(bySales, "targetAo");
    const totalRealisasiValue = sumBy(bySales, "realisasiValue");
    // ⚠️ Performance fix (Sprint 3 / P1): pakai aoUniqueOutlets yang sudah
    // di-build di single-pass loop, bukan scan filtered lagi + build N string.
    const totalRealisasiAo = aoUniqueOutlets.size;
    const overallAch = totalTargetValue ? totalRealisasiValue / totalTargetValue : null;

    // by group (respecting the group filter list of allowed groups, else all groups present in targets ∪ data)
    const groupNamesSet = new Set();
    relevantTargets.forEach((t) => t.groups.forEach((g) => groupNamesSet.add(g.name)));
    for (const g of rowsByGroup.keys()) {
      groupNamesSet.add(g);
    }
    let groupNames = Array.from(groupNamesSet);
    if (filters.groups.length) groupNames = groupNames.filter((g) => filters.groups.includes(g));

    const byGroup = groupNames.map((gname) => {
      const targetValue = sumBy(relevantTargets, (t) => sumBy(t.groups.filter((g) => g.name === gname), "value"));
      const targetAo = sumBy(relevantTargets, (t) => sumBy(t.groups.filter((g) => g.name === gname), "ao"));
      // ⚠️ Performance fix (Sprint 3 / P1): pakai rowsByGroup lookup O(1),
      // bukan `filtered.filter(r => r.group === gname)` O(N) per group.
      const rs = rowsByGroup.get(gname) || EMPTY_ARRAY;
      const value = sumBy(rs, "value");
      const ao = new Set(rs.map((r) => r.outletCode)).size;
      const ach = targetValue ? value / targetValue : null;
      return { name: gname, targetValue, targetAo, realisasiValue: value, realisasiAo: ao, ach,
        deviasiValue: targetValue ? targetValue - value : null,
        predicate: (row) => row.group === gname };
    }).sort((a, b) => b.realisasiValue - a.realisasiValue);

    // by outlet — pakai outletMap yang sudah di-build di single-pass loop.
    // Field dibuat seragam dengan byGroup/bySales supaya struktur matrix
    // perbandingan tetap konsisten.
    const byOutlet = Array.from(outletMap.values()).map((o) => ({
      key: o.key,
      name: o.name,
      realisasiValue: o.value,
      // "AO" di level outlet = frekuensi transaksi (jumlah invoice unik),
      // BUKAN jumlah outlet unik. Lihat komentar di comparison.js
      // buildOutletMatrix untuk alasan label "Frekuensi Transaksi".
      realisasiAo: o.invoiceSet.size,
      qtyKarton: o.qtyKarton,
    }));

    // daily series — pakai dailyMap yang sudah di-build di single-pass loop.
    const daily = Object.values(dailyMap)
      .map((d) => ({ date: d.date, value: d.value, ao: d.outlets.size }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // monthly (cumulative) series — pakai monthlyMap yang sudah di-build.
    const monthly = Object.entries(monthlyMap).map(([m, v]) => ({ month: m, value: v })).sort((a, b) => a.month.localeCompare(b.month));

    // focus products — pakai rowsBySales lookup. matchFocus tetap per-scan
    // per-sales rows, tapi bukan seluruh `filtered`.
    const focusRows = [];
    relevantTargets.forEach((t) => {
      const rs = rowsBySales.get(t.code) || EMPTY_ARRAY;
      t.focus.forEach((f) => {
        const frs = rs.filter((r) => matchFocus(r, f));
        const realisasi = sumBy(frs, effectiveKartonQty);
        const pct = f.target ? realisasi / f.target : null;
        const hasUnconvertible = frs.some((r) => r.unconvertible);
        const unit = resolveFocusUnit(frs);
        focusRows.push({ _id: t.code + "|" + f.name, salesCode: t.code, salesName: t.name, name: f.name, target: f.target, realisasi, pct, hasUnconvertible, unit,
          predicate: (row) => row.salesCode === t.code && matchFocus(row, f) });
      });
    });

    // focus groups — grup yang ditandai `focus: true` di Pengaturan (highlight
    // grup existing, tanpa target baru). Data reuse dari perhitungan grup yang
    // sudah ada; cuma di-flatten jadi baris global (paralel `focusRows`).
    // ⚠️ Performance fix (Sprint 3 / P1): pakai rowsBySalesGroup lookup O(1),
    // bukan `filtered.filter(r => r.salesCode === t.code && r.group === g.name)` O(N) per (sales, group).
    const focusGroupRows = [];
    relevantTargets.forEach((t) => {
      t.groups.forEach((g) => {
        if (!g.focus) return;
        const rs = rowsBySalesGroup.get(t.code + "|" + g.name) || EMPTY_ARRAY;
        const gValue = sumBy(rs, "value");
        const gAo = new Set(rs.map((r) => r.outletCode)).size;
        focusGroupRows.push({
          _id: t.code + "|" + g.name,
          salesCode: t.code, salesName: t.name, name: g.name,
          targetValue: g.value, realisasiValue: gValue,
          targetAo: g.ao, realisasiAo: gAo,
          ach: g.value ? gValue / g.value : null,
          achAo: g.ao ? gAo / g.ao : null,
          predicate: (row) => row.salesCode === t.code && row.group === g.name,
        });
      });
    });
    // Urut: sales teratas (ACH desc) dulu, lalu grup dengan realisasi terbesar.
    focusGroupRows.sort((a, b) => (b.ach ?? -1) - (a.ach ?? -1) || b.realisasiValue - a.realisasiValue);

    // Info tanggal untuk header laporan (BULAN, SD HARI INI, tanggal "per")
    // — pakai uniqueDateStrsSet yang sudah di-build di single-pass loop.
    const uniqueDateStrs = Array.from(uniqueDateStrsSet).sort();
    const meta = {
      firstDate: uniqueDateStrs[0] || null,
      lastDate: uniqueDateStrs[uniqueDateStrs.length - 1] || null,
      uniqueDays: uniqueDateStrs.length,
    };

    // ---- Proyeksi akhir bulan: ekstrapolasi linear dari rata-rata realisasi/hari ----
    const dailyRate = meta.uniqueDays > 0 ? totalRealisasiValue / meta.uniqueDays : 0;
    const projectedValue = workDays ? dailyRate * workDays : null;
    const projection = {
      dailyRate,
      projectedValue,
      projectedAch: (projectedValue !== null && totalTargetValue) ? projectedValue / totalTargetValue : null,
      daysRemaining: workDays ? Math.max(0, workDays - meta.uniqueDays) : null,
      // Metode alternatif (non-linear) — null kalau data belum cukup untuk
      // metode tsb; komponen UI fallback ke linear di atas kalau null.
      methods: {
        trend7: computeTrend7Projection(daily, workDays, totalTargetValue),
        weekday: computeWeekdayProjection(daily, totalTargetValue, meta, filters),
      },
    };
    bySales.forEach((sm) => {
      const smDailyRate = meta.uniqueDays > 0 ? sm.realisasiValue / meta.uniqueDays : 0;
      sm.projectedValue = workDays ? smDailyRate * workDays : null;
      sm.projectedAch = (sm.projectedValue !== null && sm.targetValue) ? sm.projectedValue / sm.targetValue : null;
    });

    // ---- Peringatan otomatis: sales/produk fokus yang masih 0% padahal sudah lewat beberapa hari kerja ----
    const alerts = [];
    if (meta.uniqueDays >= ALERT_MIN_DAYS) {
      bySales.forEach((sm) => {
        if (sm.targetValue > 0 && sm.realisasiValue === 0) {
          alerts.push({ type: "sales", title: sm.name, message: "Belum ada realisasi sama sekali", predicate: sm.predicate });
        }
        sm.focus.forEach((f) => {
          if (f.target > 0 && f.realisasi === 0) {
            alerts.push({ type: "focus", title: `${sm.name} — ${f.name}`, message: "Produk fokus belum terjual sama sekali", predicate: f.predicate });
          }
        });
      });
    }

    return {
      filteredRows: filtered, bySales, byGroup, byOutlet, daily, monthly, focusRows, focusGroupRows, meta, projection, alerts,
      // Pre-aggregated qty KARTON per entity — dihitung di single-pass loop, dipakai oleh
      // buildSalesMatrix & buildGroupMatrix di comparison.js untuk hindari re-scan filteredRows.
      qtyKartonBySales, qtyKartonByGroup,
      totals: { targetValue: totalTargetValue, targetAo: totalTargetAo, realisasiValue: totalRealisasiValue,
        realisasiAo: totalRealisasiAo, ach: overallAch,
        deviasiValue: totalTargetValue ? totalTargetValue - totalRealisasiValue : null },
    };
}

export function useAggregates(rows, targets, filters, workDays) {
  return useMemo(() => computeAggregates(rows, targets, filters, workDays), [rows, targets, filters, workDays]);
}
