import { useMemo } from "react";
import sumBy from "lodash/sumBy";
import { normalizeHeader, dateStrToLocalDate, effectiveKartonQty } from "./excelParse.js";
import { ALERT_MIN_DAYS } from "../constants/thresholds.js";

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
        value: 0, qty: 0, invoices: new Set(), groups: new Set(), salesNames: new Set(), lastDate: null,
      };
    }
    const o = map[key];
    o.value += r.value;
    o.qty += effectiveKartonQty(r);
    if (r.invoiceNo) o.invoices.add(r.invoiceNo);
    if (r.group) o.groups.add(r.group);
    if (r.salesName) o.salesNames.add(r.salesName);
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

export function useAggregates(rows, targets, filters, workDays) {
  return useMemo(() => {
    const inRange = (dateStr) => {
      if (!filters.dateFrom && !filters.dateTo) return true;
      if (!dateStr) return false;
      // dateStr, filters.dateFrom, filters.dateTo semuanya teks "YYYY-MM-DD" —
      // perbandingan teks di format ini otomatis benar secara kronologis.
      if (filters.dateFrom && dateStr < filters.dateFrom) return false;
      if (filters.dateTo && dateStr > filters.dateTo) return false;
      return true;
    };
    const filtered = rows.filter((r) => {
      if (!inRange(r.date)) return false;
      if (filters.salesCodes.length && !filters.salesCodes.includes(r.salesCode)) return false;
      if (filters.groups.length && !filters.groups.includes(r.group)) return false;
      return true;
    });

    const relevantTargets = filters.salesCodes.length
      ? targets.filter((t) => filters.salesCodes.includes(t.code))
      : targets;

    // per sales
    const bySales = relevantTargets.map((t) => {
      const rs = filtered.filter((r) => r.salesCode === t.code);
      const value = sumBy(rs, "value");
      const ao = new Set(rs.map((r) => r.outletCode)).size;
      const ach = t.total.value ? value / t.total.value : null;
      const achAo = t.total.ao ? ao / t.total.ao : null;

      // Breakdown per grup produk milik sales ini — dipakai untuk export baris-per-baris.
      const groups = t.groups.map((g) => {
        const grs = rs.filter((r) => r.group === g.name);
        const gValue = sumBy(grs, "value");
        const gAo = new Set(grs.map((r) => r.outletCode)).size;
        return {
          name: g.name, targetValue: g.value, targetAo: g.ao,
          realisasiValue: gValue, realisasiAo: gAo,
          ach: g.value ? gValue / g.value : null, achAo: g.ao ? gAo / g.ao : null,
          deviasiValue: g.value ? g.value - gValue : 0, deviasiAo: g.ao ? g.ao - gAo : 0,
          predicate: (row) => row.salesCode === t.code && row.group === g.name,
        };
      });

      // Breakdown per produk fokus milik sales ini — sejajar dengan `groups` di atas.
      const focus = t.focus.map((f) => {
        const frs = rs.filter((r) => matchFocus(r, f));
        const realisasi = sumBy(frs, effectiveKartonQty);
        const hasUnconvertible = frs.some((r) => r.unconvertible);
        const unit = resolveFocusUnit(frs);
        return { name: f.name, target: f.target, realisasi, pct: f.target ? realisasi / f.target : null, hasUnconvertible, unit,
          predicate: (row) => row.salesCode === t.code && matchFocus(row, f) };
      });

      return { code: t.code, name: t.name, tier: t.tier, targetValue: t.total.value, targetAo: t.total.ao,
        realisasiValue: value, realisasiAo: ao, ach, achAo,
        deviasiValue: t.total.value ? t.total.value - value : null,
        deviasiAo: t.total.ao ? t.total.ao - ao : null,
        groups, focus, predicate: (row) => row.salesCode === t.code };
    });

    const totalTargetValue = sumBy(bySales, "targetValue");
    const totalTargetAo = sumBy(bySales, "targetAo");
    const totalRealisasiValue = sumBy(bySales, "realisasiValue");
    const totalRealisasiAo = new Set(filtered.map((r) => r.salesCode + "|" + r.outletCode)).size;
    const overallAch = totalTargetValue ? totalRealisasiValue / totalTargetValue : null;

    // by group (respecting the group filter list of allowed groups, else all groups present in targets ∪ data)
    const groupNamesSet = new Set();
    relevantTargets.forEach((t) => t.groups.forEach((g) => groupNamesSet.add(g.name)));
    filtered.forEach((r) => r.group && groupNamesSet.add(r.group));
    let groupNames = Array.from(groupNamesSet);
    if (filters.groups.length) groupNames = groupNames.filter((g) => filters.groups.includes(g));

    const byGroup = groupNames.map((gname) => {
      const targetValue = sumBy(relevantTargets, (t) => sumBy(t.groups.filter((g) => g.name === gname), "value"));
      const targetAo = sumBy(relevantTargets, (t) => sumBy(t.groups.filter((g) => g.name === gname), "ao"));
      const rs = filtered.filter((r) => r.group === gname);
      const value = sumBy(rs, "value");
      const ao = new Set(rs.map((r) => r.outletCode)).size;
      const ach = targetValue ? value / targetValue : null;
      return { name: gname, targetValue, targetAo, realisasiValue: value, realisasiAo: ao, ach,
        deviasiValue: targetValue ? targetValue - value : null,
        predicate: (row) => row.group === gname };
    }).sort((a, b) => b.realisasiValue - a.realisasiValue);

    // daily series
    const dailyMap = {};
    filtered.forEach((r) => {
      const k = dateKey(r.date);
      if (!dailyMap[k]) dailyMap[k] = { date: k, value: 0, outlets: new Set() };
      dailyMap[k].value += r.value;
      dailyMap[k].outlets.add(r.outletCode);
    });
    const daily = Object.values(dailyMap)
      .map((d) => ({ date: d.date, value: d.value, ao: d.outlets.size }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // monthly (cumulative) series
    const monthlyMap = {};
    filtered.forEach((r) => {
      const k = monthKey(r.date);
      monthlyMap[k] = (monthlyMap[k] || 0) + r.value;
    });
    const monthly = Object.entries(monthlyMap).map(([m, v]) => ({ month: m, value: v })).sort((a, b) => a.month.localeCompare(b.month));

    // focus products
    const focusRows = [];
    relevantTargets.forEach((t) => {
      t.focus.forEach((f) => {
        const rs = filtered.filter((r) => r.salesCode === t.code && matchFocus(r, f));
        const realisasi = sumBy(rs, effectiveKartonQty);
        const pct = f.target ? realisasi / f.target : null;
        const hasUnconvertible = rs.some((r) => r.unconvertible);
        const unit = resolveFocusUnit(rs);
        focusRows.push({ salesCode: t.code, salesName: t.name, name: f.name, target: f.target, realisasi, pct, hasUnconvertible, unit,
          predicate: (row) => row.salesCode === t.code && matchFocus(row, f) });
      });
    });

    // Info tanggal untuk header laporan (BULAN, SD HARI INI, tanggal "per")
    const uniqueDateStrs = Array.from(new Set(filtered.map((r) => r.date).filter(Boolean))).sort();
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
      filteredRows: filtered, bySales, byGroup, daily, monthly, focusRows, meta, projection, alerts,
      totals: { targetValue: totalTargetValue, targetAo: totalTargetAo, realisasiValue: totalRealisasiValue,
        realisasiAo: totalRealisasiAo, ach: overallAch,
        deviasiValue: totalTargetValue ? totalTargetValue - totalRealisasiValue : null },
    };
  }, [rows, targets, filters, workDays]);
}
