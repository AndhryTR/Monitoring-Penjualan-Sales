/* ============================================================================
   CUSTOMER PARETO MATRIX ENGINE (ABC Analysis) — Sprint 20 / Phase 4
   Klasifikasi segmentasi outlet berdasarkan kontribusi omset riil:
   - Kelas A (Key Accounts): 80% omset pertama (~20% outlet toko emas)
   - Kelas B (Silver Stores): 15% omset berikutnya (kumulatif 80% - 95%)
   - Kelas C (Bronze Stores): 5% omset terakhir (kumulatif 95% - 100%)
============================================================================ */

/**
 * Hitung klasifikasi Pareto ABC untuk daftar outlet.
 *
 * @param {Array} outlets - Daftar objek outlet dengan properti `value`
 * @returns {{ outletsWithPareto: Array, paretoSummary: Object }}
 */
export function computeParetoClassification(outlets = []) {
  if (!Array.isArray(outlets) || outlets.length === 0) {
    return {
      outletsWithPareto: [],
      paretoSummary: {
        totalOutlets: 0,
        totalValue: 0,
        classA: { count: 0, pctCount: 0, value: 0, pctValue: 0 },
        classB: { count: 0, pctCount: 0, value: 0, pctValue: 0 },
        classC: { count: 0, pctCount: 0, value: 0, pctValue: 0 },
      },
    };
  }

  // 1. Urutkan outlet dari omset terbesar ke terkecil
  const sorted = [...outlets].sort((a, b) => (b.value || 0) - (a.value || 0));
  const totalValue = sorted.reduce((sum, o) => sum + (o.value || 0), 0);
  const totalOutlets = sorted.length;

  if (totalValue <= 0) {
    // Jika tidak ada nilai penjualan sama sekali, tandai semua C
    const fallback = sorted.map((o) => ({
      ...o,
      paretoClass: "C",
      cumulativeValue: 0,
      cumulativePercent: 0,
      contributionPercent: 0,
    }));
    return {
      outletsWithPareto: fallback,
      paretoSummary: {
        totalOutlets,
        totalValue: 0,
        classA: { count: 0, pctCount: 0, value: 0, pctValue: 0 },
        classB: { count: 0, pctCount: 0, value: 0, pctValue: 0 },
        classC: { count: totalOutlets, pctCount: 100, value: 0, pctValue: 0 },
      },
    };
  }

  // 2. Hitung kumulatif kontribusi dan tetapkan kelas
  let runningSum = 0;
  let prevRunningPercent = 0;

  let countA = 0;
  let valueA = 0;
  let countB = 0;
  let valueB = 0;
  let countC = 0;
  let valueC = 0;

  const outletsWithPareto = sorted.map((o) => {
    const val = o.value || 0;
    runningSum += val;
    const runningPercent = Number(((runningSum / totalValue) * 100).toFixed(2));
    const contributionPercent = Number(((val / totalValue) * 100).toFixed(2));

    let paretoClass = "C";
    // Jika sebelumnya persentase kumulatif belum mencapai 80%, outlet ini masuk Kelas A
    if (prevRunningPercent < 80 || (prevRunningPercent === 0 && runningPercent >= 80)) {
      paretoClass = "A";
      countA++;
      valueA += val;
    } else if (prevRunningPercent < 95 || (prevRunningPercent < 80 && runningPercent >= 95)) {
      paretoClass = "B";
      countB++;
      valueB += val;
    } else {
      paretoClass = "C";
      countC++;
      valueC += val;
    }

    prevRunningPercent = runningPercent;

    return {
      ...o,
      paretoClass,
      cumulativeValue: runningSum,
      cumulativePercent: runningPercent,
      contributionPercent,
    };
  });

  const paretoSummary = {
    totalOutlets,
    totalValue,
    classA: {
      count: countA,
      pctCount: totalOutlets > 0 ? Number(((countA / totalOutlets) * 100).toFixed(1)) : 0,
      value: valueA,
      pctValue: totalValue > 0 ? Number(((valueA / totalValue) * 100).toFixed(1)) : 0,
    },
    classB: {
      count: countB,
      pctCount: totalOutlets > 0 ? Number(((countB / totalOutlets) * 100).toFixed(1)) : 0,
      value: valueB,
      pctValue: totalValue > 0 ? Number(((valueB / totalValue) * 100).toFixed(1)) : 0,
    },
    classC: {
      count: countC,
      pctCount: totalOutlets > 0 ? Number(((countC / totalOutlets) * 100).toFixed(1)) : 0,
      value: valueC,
      pctValue: totalValue > 0 ? Number(((valueC / totalValue) * 100).toFixed(1)) : 0,
    },
  };

  return { outletsWithPareto, paretoSummary };
}
