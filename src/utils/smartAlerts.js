import { fmtRp, fmtNum, fmtPct } from "./formatters.js";
import { ALERT_MIN_DAYS, WORK_DAYS_DEFAULT } from "../constants/thresholds.js";

/* ============================================================================
   SMART ALERTS & ANOMALY DETECTION ENGINE (Fitur B2)
   
   Menghitung anomali dan insight bisnis secara otomatis dari data agregat:
   1. 🚨 Kritis (Critical):
      - Sales inaktif >= 3 hari kerja data terakhir (tidak ada transaksi).
      - Sales dengan target aktif tapi 0% realisasi.
      - Produk fokus dengan target > 0 tapi 0% realisasi.
   2. ⚠️ Peringatan (Warning):
      - Pace pencapaian tertinggal >= 20% di bawah ritme waktu (Time Pace - ACH >= 20%).
      - Ketimpangan produk: 1 grup >= 80% tapi grup lain <= 30%.
      - Isu kualitas data (kode tidak dikenal, unconvertible, dll).
   3. 🌟 Prestasi (Positive Reinforcement):
      - Target tercapai >= 100%.
      - Top Pacer (melaju kencang >= 125% di atas target pace).
============================================================================ */

export const ALERT_LEVELS = {
  CRITICAL: "critical",
  WARNING: "warning",
  POSITIVE: "positive",
};

/**
 * Format tanggal YYYY-MM-DD ke format lokal pendek (mis. "14 Mei")
 */
function formatShortDate(dateStr) {
  if (!dateStr) return "-";
  try {
    const [y, m, d] = String(dateStr).slice(0, 10).split("-").map(Number);
    if (!y || !m || !d) return String(dateStr);
    const date = new Date(y, m - 1, d);
    return date.toLocaleDateString("id-ID", { day: "numeric", month: "short" });
  } catch {
    return String(dateStr);
  }
}

/**
 * Komputasi Smart Alerts dari data agregasi penjualan & target
 * 
 * @param {Object} params
 * @param {Object} params.agg - Objek agregat (aggFinal dari useAggregatesWorker)
 * @param {Array} [params.targets] - Daftar target sales
 * @param {number} [params.workDays] - Jumlah hari kerja efektif sebulan
 * @param {Object} [params.dataQualityNotes] - Catatan kualitas data dari useDataQualityNotes
 * @returns {Array<Object>} Array alert terurut berdasarkan tingkat keparahan
 */
export function computeSmartAlerts({
  agg,
  _targets = [],
  workDays = WORK_DAYS_DEFAULT,
  dataQualityNotes = null,
}) {
  if (!agg || !agg.filteredRows || !agg.filteredRows.length) {
    return [];
  }

  const alerts = [];
  const bySales = agg.bySales || [];
  const filteredRows = agg.filteredRows || [];
  const focusRows = agg.focusRows || [];
  const meta = agg.meta || {};
  const effectiveWorkDays = Number(workDays) > 0 ? Number(workDays) : WORK_DAYS_DEFAULT;

  // 1. Ekstrak seluruh tanggal transaksi unik yang terurut dari data
  const dateSet = new Set();
  filteredRows.forEach((r) => {
    if (r.date) dateSet.add(r.date);
  });
  const uniqueDates = Array.from(dateSet).sort();
  const totalDaysSoFar = uniqueDates.length || meta.uniqueDays || 0;
  const timePace = effectiveWorkDays > 0 ? totalDaysSoFar / effectiveWorkDays : 0;
  const lastDatasetDate = uniqueDates[uniqueDates.length - 1] || meta.lastDate;

  // Mapping transaksi terakhir per sales code
  const lastDateBySales = new Map();
  filteredRows.forEach((r) => {
    if (!r.salesCode || !r.date) return;
    const cur = lastDateBySales.get(r.salesCode);
    if (!cur || r.date > cur) {
      lastDateBySales.set(r.salesCode, r.date);
    }
  });

  const inactiveSalesCodes = new Set();

  // --------------------------------------------------------------------------
  // ATURAN 1: 🚨 SALES INAKTIF (Inactivity Gap >= 3 Hari Kerja Data)
  // --------------------------------------------------------------------------
  if (totalDaysSoFar >= ALERT_MIN_DAYS) {
    bySales.forEach((sm) => {
      if (!sm.targetValue || sm.targetValue <= 0) return;

      const salesLastDate = lastDateBySales.get(sm.code);

      // Kasus A: Sama sekali belum ada transaksi padahal sudah >= 3 hari data
      if (!salesLastDate || sm.realisasiValue === 0) {
        inactiveSalesCodes.add(sm.code);
        alerts.push({
          id: `critical-inactive-zero-${sm.code}`,
          level: ALERT_LEVELS.CRITICAL,
          category: "inactivity",
          priority: 100,
          title: `${sm.name}: Belum Ada Penjualan`,
          message: `Tidak mencatat transaksi sama sekali selama ${totalDaysSoFar} hari kerja aktif. Target ${fmtRp(sm.targetValue)} berisiko tinggi.`,
          tag: `${totalDaysSoFar} hari kosong`,
          salesCode: sm.code,
          salesName: sm.name,
          predicate: sm.predicate || ((r) => r.salesCode === sm.code),
          targetTab: "sales",
          actionLabel: "Lihat Sales",
        });
        return;
      }

      // Kasus B: Pernah ada transaksi, tapi berhenti >= 3 hari kerja data terakhir
      const lastIndex = uniqueDates.indexOf(salesLastDate);
      if (lastIndex !== -1) {
        const daysGap = (uniqueDates.length - 1) - lastIndex;
        if (daysGap >= ALERT_MIN_DAYS) {
          inactiveSalesCodes.add(sm.code);
          alerts.push({
            id: `critical-inactive-gap-${sm.code}`,
            level: ALERT_LEVELS.CRITICAL,
            category: "inactivity",
            priority: 90 + daysGap,
            title: `${sm.name}: Inaktif ${daysGap} Hari Kerja`,
            message: `Terakhir transaksi pada ${formatShortDate(salesLastDate)} (posisi data s/d ${formatShortDate(lastDatasetDate)}). Segera evaluasi rute kunjungan outlet.`,
            tag: `Jeda ${daysGap} hari`,
            salesCode: sm.code,
            salesName: sm.name,
            predicate: sm.predicate || ((r) => r.salesCode === sm.code),
            targetTab: "sales",
            actionLabel: "Lihat Outlet",
          });
        }
      }
    });
  }

  // --------------------------------------------------------------------------
  // ATURAN 2: 🚨 PRODUK FOKUS STAGNAN (0% Realisasi di Hari ke-3+)
  // --------------------------------------------------------------------------
  if (totalDaysSoFar >= ALERT_MIN_DAYS) {
    focusRows.forEach((f) => {
      if (f.target > 0 && (!f.realisasi || f.realisasi === 0)) {
        alerts.push({
          id: `critical-focus-zero-${f.salesCode}-${f.name}`,
          level: ALERT_LEVELS.CRITICAL,
          category: "stagnant",
          priority: 80,
          title: `${f.salesName}: Fokus "${f.name}" 0%`,
          message: `Target ${fmtNum(f.target)} ${f.unit || "karton"} belum mencatat penjualan sama sekali hingga hari ke-${totalDaysSoFar}.`,
          tag: `Fokus 0%`,
          salesCode: f.salesCode,
          salesName: f.salesName,
          predicate: f.predicate,
          targetTab: "focus",
          actionLabel: "Buka Fokus",
        });
      }
    });
  }

  // --------------------------------------------------------------------------
  // ATURAN 3: ⚠️ PACE TERTINGGAL (Lagging Behind >= 20% Gap)
  // --------------------------------------------------------------------------
  if (timePace >= 0.20) {
    bySales.forEach((sm) => {
      if (!sm.targetValue || sm.targetValue <= 0) return;
      if (inactiveSalesCodes.has(sm.code)) return; // Sudah ter-cover di alert kritis inaktif

      const ach = sm.realisasiValue / sm.targetValue;
      const paceGap = timePace - ach;

      if (paceGap >= 0.20) {
        const gapPct = Math.round(paceGap * 100);
        const projectedText = sm.projectedAch !== null && sm.projectedAch !== undefined
          ? `Proyeksi akhir bulan: ${fmtPct(sm.projectedAch)}.`
          : "";

        alerts.push({
          id: `warning-lagging-${sm.code}`,
          level: ALERT_LEVELS.WARNING,
          category: "lagging",
          priority: 60 + Math.min(30, gapPct),
          title: `${sm.name}: Ritme Tertinggal ${gapPct}%`,
          message: `Realisasi ${fmtPct(ach)} vs ritme waktu ideal ${fmtPct(timePace)}. ${projectedText}`,
          tag: `Gap -${gapPct}%`,
          salesCode: sm.code,
          salesName: sm.name,
          predicate: sm.predicate || ((r) => r.salesCode === sm.code),
          targetTab: "sales",
          actionLabel: "Lihat Sales",
        });
      }
    });
  }

  // --------------------------------------------------------------------------
  // ATURAN 4: ⚠️ KETIMPANGAN KATEGORI PRODUK (Product Mix Imbalance)
  // --------------------------------------------------------------------------
  if (totalDaysSoFar >= 5) {
    bySales.forEach((sm) => {
      const activeGroups = (sm.groups || []).filter((g) => g.targetValue > 0 && g.ach !== null && g.ach !== undefined);
      if (activeGroups.length >= 2) {
        let best = activeGroups[0];
        let worst = activeGroups[0];

        activeGroups.forEach((g) => {
          if ((g.ach ?? 0) > (best.ach ?? 0)) best = g;
          if ((g.ach ?? 0) < (worst.ach ?? 0)) worst = g;
        });

        if ((best.ach ?? 0) >= 0.80 && (worst.ach ?? 0) <= 0.30) {
          alerts.push({
            id: `warning-mix-${sm.code}-${worst.name}`,
            level: ALERT_LEVELS.WARNING,
            category: "product_mix",
            priority: 50,
            title: `${sm.name}: Ketimpangan Kategori`,
            message: `Kategori "${best.name}" kuat di ${fmtPct(best.ach)}, namun "${worst.name}" tertinggal di ${fmtPct(worst.ach)}.`,
            tag: `${worst.name} ${fmtPct(worst.ach)}`,
            salesCode: sm.code,
            salesName: sm.name,
            predicate: (r) => r.salesCode === sm.code && r.group === worst.name,
            targetTab: "product",
            actionLabel: "Lihat Kategori",
          });
        }
      }
    });
  }

  // --------------------------------------------------------------------------
  // ATURAN 5: 📋 ISU INTEGRITAS KUALITAS DATA
  // --------------------------------------------------------------------------
  if (dataQualityNotes) {
    const unknownSalesCount = dataQualityNotes.unknownSales?.length || 0;
    const unconvertibleCount = dataQualityNotes.unconvertibleProducts?.length || 0;
    const unknownGroupsCount = dataQualityNotes.unknownGroups?.length || 0;
    const totalTechIssues = unknownSalesCount + unconvertibleCount + unknownGroupsCount;

    if (totalTechIssues > 0) {
      alerts.push({
        id: "warning-data-quality",
        level: ALERT_LEVELS.WARNING,
        category: "data_quality",
        priority: 55,
        title: `${totalTechIssues} Catatan Kualitas Data`,
        message: `${unknownSalesCount} kode sales tak terdaftar, ${unknownGroupsCount} grup tak dikenal, ${unconvertibleCount} konversi karton bermasalah.`,
        tag: `Cek Data (${totalTechIssues})`,
        targetTab: "quality",
        actionLabel: "Buka Cek Data",
      });
    }
  }

  // --------------------------------------------------------------------------
  // ATURAN 6: 🌟 PRESTASI & POSITIVE REINFORCEMENT
  // --------------------------------------------------------------------------
  bySales.forEach((sm) => {
    if (!sm.targetValue || sm.targetValue <= 0) return;
    const ach = sm.realisasiValue / sm.targetValue;

    // A: Sudah tembus target 100%+
    if (ach >= 1.0) {
      alerts.push({
        id: `positive-achieved-${sm.code}`,
        level: ALERT_LEVELS.POSITIVE,
        category: "achievement",
        priority: 40 + Math.min(20, Math.round((ach - 1.0) * 100)),
        title: `${sm.name}: Target 100% Tercapai! 🎉`,
        message: `Mencapai ${fmtPct(ach)} (${fmtRp(sm.realisasiValue)}) dari target ${fmtRp(sm.targetValue)}. Prestasi luar biasa!`,
        tag: `Capai ${fmtPct(ach)}`,
        salesCode: sm.code,
        salesName: sm.name,
        predicate: sm.predicate || ((r) => r.salesCode === sm.code),
        targetTab: "sales",
        actionLabel: "Lihat Sales",
      });
    } else if (timePace >= 0.20 && (ach / timePace) >= 1.25) {
      // B: Top Pacer (melaju kencang >= 125% di atas target pace)
      const speedPct = Math.round((ach / timePace) * 100);
      alerts.push({
        id: `positive-toppacer-${sm.code}`,
        level: ALERT_LEVELS.POSITIVE,
        category: "achievement",
        priority: 30,
        title: `${sm.name}: Melaju Cepat (Top Pacer) 🚀`,
        message: `Pencapaian ${fmtPct(ach)} berada di ${speedPct}% ritme target. Pertahankan performa ini!`,
        tag: `Pace ${speedPct}%`,
        salesCode: sm.code,
        salesName: sm.name,
        predicate: sm.predicate || ((r) => r.salesCode === sm.code),
        targetTab: "sales",
        actionLabel: "Lihat Sales",
      });
    }
  });

  // Urutkan alert:
  // 1. Level: critical > warning > positive
  // 2. Priority internal descending
  const levelWeights = {
    [ALERT_LEVELS.CRITICAL]: 3,
    [ALERT_LEVELS.WARNING]: 2,
    [ALERT_LEVELS.POSITIVE]: 1,
  };

  alerts.sort((a, b) => {
    const diffLevel = (levelWeights[b.level] || 0) - (levelWeights[a.level] || 0);
    if (diffLevel !== 0) return diffLevel;
    return (b.priority || 0) - (a.priority || 0);
  });

  return alerts;
}
