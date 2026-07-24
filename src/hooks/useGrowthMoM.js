import { useMemo } from "react";
import { detectMonths, computeAggregates } from "../utils/aggregation.js";

/* ============================================================================
   useGrowthMoM
   Growth MoM dengan cascade prioritas:
   1. Snapshot perbandingan yang dipilih user lewat Riwayat (comparison.growth)
   2. Auto-detect dari multi-bulan data di rawRows (kalau ada >=2 bulan kalender
      berbeda dalam data yang di-upload)
   3. null (belum bisa dihitung — data cuma 1 bulan & tidak ada snapshot)

   SATU-SATUNYA tempat cascade ini didefinisikan — dipakai oleh Executive
   Summary (dan siap dipakai Main Report juga kalau nanti dibutuhkan) supaya
   angka growth tidak pernah berbeda antar tab untuk data yang sama.
============================================================================ */
export function useGrowthMoM(comparison, rawRows, targets, workDays, salesCodes) {
  return useMemo(() => {
    // Prioritas 1: snapshot riwayat
    if (comparison?.growth !== null && comparison?.growth !== undefined) {
      return comparison.growth;
    }
    // Prioritas 2: auto-detect dari multi-bulan data
    try {
      const months = detectMonths(rawRows);
      if (months.length >= 2) {
        const latest = months[months.length - 1];
        const prev = months[months.length - 2];
        const latestAgg = computeAggregates(rawRows, targets, {
          salesCodes: salesCodes ?? [],
          groups: [],
          dateFrom: latest.dateFrom,
          dateTo: latest.dateTo,
        }, workDays);
        const prevAgg = computeAggregates(rawRows, targets, {
          salesCodes: salesCodes ?? [],
          groups: [],
          dateFrom: prev.dateFrom,
          dateTo: prev.dateTo,
        }, workDays);
        const prevValue = prevAgg.totals.realisasiValue;
        if (prevValue > 0) {
          return (latestAgg.totals.realisasiValue - prevValue) / prevValue;
        }
      }
    } catch (_) {
      // Silently fail — fallback ke null
    }
    return null;
  }, [comparison, rawRows, targets, workDays, salesCodes]);
}
