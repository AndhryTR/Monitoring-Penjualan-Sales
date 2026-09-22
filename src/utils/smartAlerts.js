import { fmtRp, fmtNum, fmtPct } from "./formatters.js";
import { ALERT_MIN_DAYS, WORK_DAYS_DEFAULT } from "../constants/thresholds.js";

/* ============================================================================
   SMART ALERTS & ANOMALY DETECTION ENGINE (Fitur B2)
   
   Menghitung anomali dan insight bisnis secara otomatis dari data agregat:
   1. 🚨 Kritis (Critical):
      - Sales inaktif >= 3 hari kerja data terakhir (tidak ada transaksi).
      - Sales dengan target aktif tapi 0% realisasi.
      - Produk fokus dengan target > 0 tapi 0% realisasi.
      - Beban akhir bulan ekstrem (sisa <= 5 hari, butuh run rate >= 2.5x rata-rata).
      - Kontributor defisit dominan (menyumbang >= 45% dari total shortfall tim).
   2. ⚠️ Peringatan (Warning):
      - Pace pencapaian tertinggal >= 20% di bawah ritme waktu (Time Pace - ACH >= 20%).
      - Sebaran toko tertinggal (AO Coverage Lag vs Rupiah atau ritme waktu).
      - Ketimpangan produk: 1 grup >= 80% tapi grup lain <= 30%.
      - Ketergantungan outlet tinggi (Pareto over-dependence >= 45% omset di 1 toko).
      - Toko kunci berhenti order (Outlet Churn >= 7 hari kerja tidak transaksi).
      - Tren penjualan melambat (momentum drop 4 hari terakhir >= 40%).
      - Nilai rata-rata nota rendah (AOV drop >= 40% di bawah rata-rata tim).
      - Kontributor defisit signifikan (menyumbang 35% - 45% total defisit tim).
      - Beban akhir bulan tinggi (butuh run rate 2.0x - 2.5x rata-rata).
      - Isu kualitas data (kode tidak dikenal, unconvertible, dll).
   3. 🌟 Prestasi (Positive Reinforcement):
      - Target tercapai >= 100%.
      - Top Pacer (melaju kencang >= 125% di atas target pace).
      - Focus Product Champion (seluruh target produk fokus tercapai 100%+).
      - All-Rounder (seluruh kategori produk mencapai >= 90% target).
      - AO Champion (target sebaran toko aktif tercapai 100%+).
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

  // 2. Mapping data per-sales: transaksi terakhir, konsentrasi & churn outlet, momentum, serta faktur
  const lastDateBySales = new Map();
  const outletsBySales = new Map();
  const salesRecentVal = new Map();
  const salesEarlierVal = new Map();
  const invoicesBySales = new Map();
  const teamInvoices = new Set();

  const hasMomentumCheck = uniqueDates.length >= 7;
  const recentWindowDays = 4;
  const earlierWindowDays = uniqueDates.length - recentWindowDays;
  const recentDatesSet = hasMomentumCheck ? new Set(uniqueDates.slice(-recentWindowDays)) : null;
  const earlierDatesSet = hasMomentumCheck ? new Set(uniqueDates.slice(0, -recentWindowDays)) : null;

  filteredRows.forEach((r) => {
    if (!r.salesCode) return;

    // A. Transaksi terakhir sales
    if (r.date) {
      const curDate = lastDateBySales.get(r.salesCode);
      if (!curDate || r.date > curDate) {
        lastDateBySales.set(r.salesCode, r.date);
      }
    }

    // B. Pemetaan omset dan tanggal terakhir per-outlet (konsentrasi & churn)
    if (r.outletCode) {
      let sMap = outletsBySales.get(r.salesCode);
      if (!sMap) {
        sMap = new Map();
        outletsBySales.set(r.salesCode, sMap);
      }
      let curOutlet = sMap.get(r.outletCode);
      if (!curOutlet) {
        curOutlet = { code: r.outletCode, name: r.outletName || r.outletCode, value: 0, lastDate: null };
        sMap.set(r.outletCode, curOutlet);
      }
      curOutlet.value += (r.value || 0);
      if (r.date && (!curOutlet.lastDate || r.date > curOutlet.lastDate)) {
        curOutlet.lastDate = r.date;
      }
    }

    // C. Pelacakan momentum harian (4 hari terakhir vs hari-hari sebelumnya)
    if (hasMomentumCheck && r.date) {
      if (recentDatesSet.has(r.date)) {
        salesRecentVal.set(r.salesCode, (salesRecentVal.get(r.salesCode) || 0) + (r.value || 0));
      } else if (earlierDatesSet.has(r.date)) {
        salesEarlierVal.set(r.salesCode, (salesEarlierVal.get(r.salesCode) || 0) + (r.value || 0));
      }
    }

    // D. Pelacakan nomor faktur untuk AOV (Average Order Value / Basket Size)
    if (r.invoiceNo) {
      teamInvoices.add(r.invoiceNo);
      let sInvoices = invoicesBySales.get(r.salesCode);
      if (!sInvoices) {
        sInvoices = new Set();
        invoicesBySales.set(r.salesCode, sInvoices);
      }
      sInvoices.add(r.invoiceNo);
    }
  });

  // 3. Kalkulasi total agregat tim untuk deteksi kontributor defisit
  let totalTeamTarget = 0;
  let totalTeamRealisasi = 0;
  bySales.forEach((s) => {
    totalTeamTarget += (s.targetValue || 0);
    totalTeamRealisasi += (s.realisasiValue || 0);
  });
  const totalTeamShortfall = totalTeamTarget > totalTeamRealisasi ? totalTeamTarget - totalTeamRealisasi : 0;

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
  // ATURAN 3: 🚨/⚠️ BEBAN AKHIR BULAN EKSTREM (End-of-Month Run Rate Crunch)
  // --------------------------------------------------------------------------
  const daysRemaining = effectiveWorkDays - totalDaysSoFar;
  if (totalDaysSoFar >= 5 && daysRemaining > 0 && daysRemaining <= 5) {
    bySales.forEach((sm) => {
      if (!sm.targetValue || sm.targetValue <= 0) return;
      if (inactiveSalesCodes.has(sm.code)) return; // Sudah ter-cover di alert kritis inaktif
      if (sm.realisasiValue >= sm.targetValue) return; // Target sudah aman/tercapai

      const ach = sm.realisasiValue / sm.targetValue;
      if (ach >= 0.85) return; // Sudah mendekati target (>= 85%), bukan krisis crunch

      const currentDailyRate = totalDaysSoFar > 0 ? sm.realisasiValue / totalDaysSoFar : 0;
      const remainingTarget = sm.targetValue - sm.realisasiValue;
      const requiredDailyRate = remainingTarget / daysRemaining;

      // Rasio lonjakan yang dibutuhkan dibanding ritme saat ini
      const crunchRatio = currentDailyRate > 0
        ? requiredDailyRate / currentDailyRate
        : (requiredDailyRate > 0 ? 99 : 0);

      if (crunchRatio >= 2.0) {
        const isCritical = crunchRatio >= 2.5;
        alerts.push({
          id: `crunch-eom-${sm.code}`,
          level: isCritical ? ALERT_LEVELS.CRITICAL : ALERT_LEVELS.WARNING,
          category: "projection_risk",
          priority: isCritical ? 85 : 68,
          title: `${sm.name}: Risiko Beban Target Akhir Bulan`,
          message: `Sisa ${daysRemaining} hari kerja. Butuh ${fmtRp(requiredDailyRate)}/hari (${crunchRatio.toFixed(1)}x rata-rata saat ini ${fmtRp(currentDailyRate)}/hari) untuk capai target.`,
          tag: `${crunchRatio.toFixed(1)}x Run Rate`,
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
  // ATURAN 4: ⚠️ PACE TERTINGGAL (Lagging Behind >= 20% Gap)
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
  // ATURAN 5: ⚠️ SEBARAN TOKO TERTINGGAL (AO Coverage Lag)
  // --------------------------------------------------------------------------
  if (totalDaysSoFar >= ALERT_MIN_DAYS) {
    bySales.forEach((sm) => {
      if (!sm.targetAo || sm.targetAo <= 0) return;
      if (!sm.targetValue || sm.targetValue <= 0) return;
      if (inactiveSalesCodes.has(sm.code)) return; // Sudah ter-cover di alert kritis inaktif

      const achVal = sm.realisasiValue / sm.targetValue;
      const achAo = (sm.realisasiAo || 0) / sm.targetAo;
      const aoGap = achVal - achAo;
      const timeAoGap = timePace - achAo;

      // Terpicu jika:
      // A. Ketimpangan omset vs AO nyata (omset jalan tapi toko aktif tertinggal >= 25%)
      // B. Waktu sudah berjalan (timePace >= 0.30) dan pencapaian AO tertinggal >= 20% dari ritme waktu
      const isImbalanced = aoGap >= 0.25;
      const isTimeLagging = timePace >= 0.30 && timeAoGap >= 0.20;

      if (isImbalanced || isTimeLagging) {
        const gapPct = Math.round((isImbalanced ? aoGap : timeAoGap) * 100);
        alerts.push({
          id: `warning-ao-lag-${sm.code}`,
          level: ALERT_LEVELS.WARNING,
          category: "distribution_health",
          priority: 58 + Math.min(25, gapPct),
          title: `${sm.name}: Sebaran Outlet Tertinggal`,
          message: `Realisasi toko aktif ${sm.realisasiAo || 0}/${sm.targetAo} (${fmtPct(achAo)}) tertinggal dibanding omset (${fmtPct(achVal)}). Evaluasi pemerataan rute kunjungan.`,
          tag: `AO ${fmtPct(achAo)} vs Rp ${fmtPct(achVal)}`,
          salesCode: sm.code,
          salesName: sm.name,
          predicate: sm.predicate || ((r) => r.salesCode === sm.code),
          targetTab: "sales",
          actionLabel: "Lihat Outlet",
        });
      }
    });
  }

  // --------------------------------------------------------------------------
  // ATURAN 6: ⚠️ KETIMPANGAN KATEGORI PRODUK (Product Mix Imbalance)
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
  // ATURAN 7: ⚠️ KETERGANTUNGAN OUTLET TINGGI (Pareto Concentration Risk)
  // --------------------------------------------------------------------------
  if (totalDaysSoFar >= 5) {
    bySales.forEach((sm) => {
      if (!sm.targetValue || sm.targetValue <= 0) return;
      if (inactiveSalesCodes.has(sm.code)) return;
      if (!sm.realisasiValue || sm.realisasiValue <= 0) return;

      const sMap = outletsBySales.get(sm.code);
      if (!sMap || sMap.size < 3) return; // Minimal 3 outlet agar tidak memicu sales khusus 1-2 key account

      let topOutlet = null;
      for (const out of sMap.values()) {
        if (!topOutlet || out.value > topOutlet.value) {
          topOutlet = out;
        }
      }

      if (topOutlet && topOutlet.value > 0) {
        const share = topOutlet.value / sm.realisasiValue;
        if (share >= 0.45) {
          const sharePct = Math.round(share * 100);
          alerts.push({
            id: `warning-concentration-${sm.code}-${topOutlet.code}`,
            level: ALERT_LEVELS.WARNING,
            category: "concentration_risk",
            priority: 45 + Math.min(25, sharePct - 45),
            title: `${sm.name}: Ketergantungan Outlet Tinggi`,
            message: `Toko "${topOutlet.name}" menyumbang ${fmtPct(share)} (${fmtRp(topOutlet.value)}) dari total omset. Portofolio berisiko tinggi jika toko ini mengalami kendala.`,
            tag: `${topOutlet.name} (${fmtPct(share)})`,
            salesCode: sm.code,
            salesName: sm.name,
            predicate: (r) => r.salesCode === sm.code && r.outletCode === topOutlet.code,
            targetTab: "outlet",
            actionLabel: "Lihat Outlet",
          });
        }
      }
    });
  }

  // --------------------------------------------------------------------------
  // ATURAN 8: ⚠️ TOKO KUNCI BERHENTI ORDER (Outlet Churn / At-Risk)
  // --------------------------------------------------------------------------
  if (uniqueDates.length >= 10) {
    bySales.forEach((sm) => {
      if (!sm.targetValue || sm.targetValue <= 0) return;
      if (inactiveSalesCodes.has(sm.code)) return;
      if (!sm.realisasiValue || sm.realisasiValue <= 0) return;

      const sMap = outletsBySales.get(sm.code);
      if (!sMap || sMap.size < 3) return;

      for (const outlet of sMap.values()) {
        if (!outlet.lastDate || outlet.value <= 0) continue;
        const share = outlet.value / sm.realisasiValue;
        // Hanya pantau Key Outlets (kontribusi >= 10% omset sales ATAU omset >= Rp 5.000.000)
        if (share >= 0.10 || outlet.value >= 5_000_000) {
          const lastIdx = uniqueDates.indexOf(outlet.lastDate);
          if (lastIdx !== -1) {
            const gapDays = (uniqueDates.length - 1) - lastIdx;
            if (gapDays >= 7) {
              alerts.push({
                id: `warning-churn-${sm.code}-${outlet.code}`,
                level: ALERT_LEVELS.WARNING,
                category: "outlet_churn",
                priority: 54 + Math.min(15, gapDays),
                title: `${sm.name}: Toko "${outlet.name}" Berhenti Order`,
                message: `Outlet kunci (omset ${fmtRp(outlet.value)}, ${fmtPct(share)}) terakhir order ${gapDays} hari kerja lalu (${formatShortDate(outlet.lastDate)}). Segera jadwalkan kunjungan ulang.`,
                tag: `Vakum ${gapDays} hari`,
                salesCode: sm.code,
                salesName: sm.name,
                predicate: (r) => r.salesCode === sm.code && r.outletCode === outlet.code,
                targetTab: "outlet",
                actionLabel: "Lihat Outlet",
              });
            }
          }
        }
      }
    });
  }

  // --------------------------------------------------------------------------
  // ATURAN 9: ⚠️ PERLAMBATAN MOMENTUM (Run-Rate Stalling / Fatigue)
  // --------------------------------------------------------------------------
  if (hasMomentumCheck) {
    bySales.forEach((sm) => {
      if (!sm.targetValue || sm.targetValue <= 0) return;
      if (inactiveSalesCodes.has(sm.code)) return;
      const ach = sm.realisasiValue / sm.targetValue;
      if (ach >= 1.0) return; // Sudah target 100%, bukan masalah penurunan ritme

      const recentVal = salesRecentVal.get(sm.code) || 0;
      const earlierVal = salesEarlierVal.get(sm.code) || 0;

      if (earlierVal <= 0) return;

      const recentDaily = recentVal / recentWindowDays;
      const earlierDaily = earlierVal / earlierWindowDays;

      if (earlierDaily > 0 && recentDaily < earlierDaily) {
        const dropRatio = (earlierDaily - recentDaily) / earlierDaily;
        if (dropRatio >= 0.40) {
          const dropPct = Math.round(dropRatio * 100);
          alerts.push({
            id: `warning-momentum-drop-${sm.code}`,
            level: ALERT_LEVELS.WARNING,
            category: "momentum",
            priority: 52 + Math.min(20, Math.round(dropRatio * 10)),
            title: `${sm.name}: Tren Penjualan Melambat`,
            message: `Rata-rata 4 hari terakhir (${fmtRp(recentDaily)}/hari) turun ${dropPct}% dibanding rata-rata sebelumnya (${fmtRp(earlierDaily)}/hari). Segera evaluasi produktivitas lapangan.`,
            tag: `Drop -${dropPct}%`,
            salesCode: sm.code,
            salesName: sm.name,
            predicate: sm.predicate || ((r) => r.salesCode === sm.code),
            targetTab: "sales",
            actionLabel: "Lihat Sales",
          });
        }
      }
    });
  }

  // --------------------------------------------------------------------------
  // ATURAN 10: 🚨/⚠️ KONTRIBUTOR DEFISIT TERBESAR (Top Shortfall Contributor)
  // --------------------------------------------------------------------------
  if (timePace >= 0.25 && totalTeamShortfall > 0 && totalTeamTarget > 0) {
    const teamAch = totalTeamRealisasi / totalTeamTarget;
    // Hanya evaluasi jika tim secara agregat tertinggal dari pace waktu (ada defisit nyata)
    if (teamAch < timePace) {
      bySales.forEach((sm) => {
        if (!sm.targetValue || sm.targetValue <= 0) return;
        if (sm.realisasiValue >= sm.targetValue) return; // Sales tidak defisit

        const sShortfall = sm.targetValue - sm.realisasiValue;
        const shortfallShare = sShortfall / totalTeamShortfall;

        if (shortfallShare >= 0.35) {
          const isCritical = shortfallShare >= 0.45;
          const sharePct = Math.round(shortfallShare * 100);
          alerts.push({
            id: `shortfall-top-${sm.code}`,
            level: isCritical ? ALERT_LEVELS.CRITICAL : ALERT_LEVELS.WARNING,
            category: "shortfall",
            priority: isCritical ? 82 : 62,
            title: `${sm.name}: Kontributor Defisit Terbesar`,
            message: `Kekurangan omset (${fmtRp(sShortfall)}) menyumbang ${fmtPct(shortfallShare)} dari total defisit target tim (${fmtRp(totalTeamShortfall)}). Prioritaskan pendampingan lapangan.`,
            tag: `Beban ${sharePct}% Defisit`,
            salesCode: sm.code,
            salesName: sm.name,
            predicate: sm.predicate || ((r) => r.salesCode === sm.code),
            targetTab: "sales",
            actionLabel: "Lihat Sales",
          });
        }
      });
    }
  }

  // --------------------------------------------------------------------------
  // ATURAN 11: ⚠️ NILAI RATA-RATA NOTA RENDAH (Basket Size / AOV Drop)
  // --------------------------------------------------------------------------
  if (totalDaysSoFar >= 5 && teamInvoices.size >= 20 && totalTeamRealisasi > 0) {
    const teamAov = totalTeamRealisasi / teamInvoices.size;
    bySales.forEach((sm) => {
      if (!sm.targetValue || sm.targetValue <= 0) return;
      if (inactiveSalesCodes.has(sm.code)) return;
      if (!sm.realisasiValue || sm.realisasiValue <= 0) return;

      const sInvoices = invoicesBySales.get(sm.code);
      const invoiceCount = sInvoices ? sInvoices.size : 0;

      // Minimal 10 transaksi faktur agar sampel representatif
      if (invoiceCount >= 10) {
        const smAov = sm.realisasiValue / invoiceCount;
        if (smAov < teamAov * 0.60) {
          const dropPct = Math.round(((teamAov - smAov) / teamAov) * 100);
          alerts.push({
            id: `warning-aov-drop-${sm.code}`,
            level: ALERT_LEVELS.WARNING,
            category: "basket_size",
            priority: 48,
            title: `${sm.name}: Nilai Rata-rata Nota Rendah`,
            message: `Rata-rata per faktur (${fmtRp(smAov)}) berada ${dropPct}% di bawah rata-rata tim (${fmtRp(teamAov)}). Indikasi dominasi order eceran kecil.`,
            tag: `AOV ${fmtRp(smAov)}`,
            salesCode: sm.code,
            salesName: sm.name,
            predicate: sm.predicate || ((r) => r.salesCode === sm.code),
            targetTab: "sales",
            actionLabel: "Lihat Sales",
          });
        }
      }
    });
  }

  // --------------------------------------------------------------------------
  // ATURAN 12: 📋 ISU INTEGRITAS KUALITAS DATA
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
  // ATURAN 13: 🌟 PRESTASI & POSITIVE REINFORCEMENT
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

    // C: Focus Product Champion (Seluruh target produk fokus tercapai 100%+)
    if (ach < 1.0 && (sm.focus || []).length > 0) {
      const activeFocus = sm.focus.filter((f) => f.target > 0);
      if (activeFocus.length > 0 && activeFocus.every((f) => (f.realisasi || 0) >= f.target)) {
        alerts.push({
          id: `positive-focus-champion-${sm.code}`,
          level: ALERT_LEVELS.POSITIVE,
          category: "achievement",
          priority: 36,
          title: `${sm.name}: Seluruh Produk Fokus Tembus 100%! 🎯`,
          message: `Berhasil menuntaskan target untuk ${activeFocus.length} produk fokus yang dibebankan. Penetrasi produk prioritas sangat sukses!`,
          tag: `Fokus 100% (${activeFocus.length} SKU)`,
          salesCode: sm.code,
          salesName: sm.name,
          predicate: sm.predicate || ((r) => r.salesCode === sm.code),
          targetTab: "focus",
          actionLabel: "Buka Fokus",
        });
      }
    }

    // D: All-Rounder (Seluruh grup produk aktif mencapai >= 90% target)
    const activeGroups = (sm.groups || []).filter((g) => g.targetValue > 0);
    if (ach < 1.0 && activeGroups.length >= 2 && activeGroups.every((g) => (g.ach ?? 0) >= 0.90)) {
      alerts.push({
        id: `positive-allrounder-${sm.code}`,
        level: ALERT_LEVELS.POSITIVE,
        category: "achievement",
        priority: 35,
        title: `${sm.name}: Penjualan Merata di Semua Kategori! 🏆`,
        message: `Seluruh ${activeGroups.length} kategori produk aktif berhasil mencapai >= 90% target. Distribusi portofolio sangat sehat!`,
        tag: `Merata ${activeGroups.length} Kategori`,
        salesCode: sm.code,
        salesName: sm.name,
        predicate: sm.predicate || ((r) => r.salesCode === sm.code),
        targetTab: "product",
        actionLabel: "Lihat Kategori",
      });
    }

    // E: AO Champion (Target sebaran toko aktif tercapai 100%+)
    if (ach < 1.0 && sm.targetAo > 0 && (sm.realisasiAo || 0) >= sm.targetAo) {
      alerts.push({
        id: `positive-ao-champion-${sm.code}`,
        level: ALERT_LEVELS.POSITIVE,
        category: "achievement",
        priority: 34,
        title: `${sm.name}: Target Sebaran Toko Tercapai! 🎯`,
        message: `Berhasil menjangkau ${sm.realisasiAo}/${sm.targetAo} toko aktif (${fmtPct(sm.realisasiAo / sm.targetAo)}). Pertahankan penetrasi outlet ini!`,
        tag: `AO ${sm.realisasiAo}/${sm.targetAo}`,
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
