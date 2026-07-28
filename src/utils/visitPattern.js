import { dateStrToLocalDate } from "./excelParse.js";

/* ============================================================================
   POLA KUNJUNGAN (VISIT PATTERN) — direkonstruksi dari data transaksi.

   PENTING — batasan yang harus dipahami sebelum dipakai:
   Ini BUKAN data kunjungan sungguhan (tidak ada check-in/absensi). "Kunjungan"
   di sini didefinisikan sebagai HARI DENGAN TRANSAKSI untuk pasangan
   sales+outlet tersebut. Kalau sales datang ke outlet tapi tidak ada order
   hari itu ("kunjungan kosong"), itu TIDAK akan terekam sebagai kunjungan di
   sini. Jangan dipakai sebagai bukti tunggal untuk menilai kedisiplinan sales
   — pakai sebagai starting point untuk investigasi, bukan vonis akhir.

   Satu "kunjungan" = 1 hari kalender unik dengan >=1 baris transaksi untuk
   kombinasi (salesCode, outletCode) — bukan per baris/invoice (kalau 1 outlet
   beli 5 produk di hari yang sama, itu dihitung 1 kunjungan, bukan 5).
============================================================================ */

function daysBetween(dateStrA, dateStrB) {
  const a = dateStrToLocalDate(dateStrA);
  const b = dateStrToLocalDate(dateStrB);
  if (!a || !b) return null;
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

/**
 * Hitung pola kunjungan 1 sales ke semua outlet yang pernah ia layani, dalam
 * rentang tanggal tertentu. Rentang ini SENGAJA independen dari filter
 * tanggal global aplikasi — pola kunjungan perlu jendela waktu yang lebih
 * panjang supaya bermakna (filter global defaultnya cuma 1 bulan).
 *
 * @param {Array} rawRows - SELURUH baris data yang diupload (bukan hasil filter)
 * @param {string} salesCode
 * @param {string} dateFrom - "YYYY-MM-DD"
 * @param {string} dateTo - "YYYY-MM-DD" — juga dipakai sebagai titik acuan "as of" untuk daysSinceLastVisit
 * @param {number} overdueMultiplier - kelipatan dari rata-rata interval yang dianggap "sudah lewat waktunya" (default 1.5x)
 */
export function computeVisitPattern(rawRows, salesCode, dateFrom, dateTo, overdueMultiplier = 1.5) {
  const rows = rawRows.filter((r) => r.salesCode === salesCode && r.date && r.date >= dateFrom && r.date <= dateTo);

  // Map outletCode -> Set of tanggal unik (hari dengan transaksi)
  const byOutlet = new Map();
  rows.forEach((r) => {
    if (!r.outletCode) return;
    if (!byOutlet.has(r.outletCode)) {
      byOutlet.set(r.outletCode, { outletCode: r.outletCode, outletName: r.outletName || r.outletCode, dateSet: new Set() });
    }
    byOutlet.get(r.outletCode).dateSet.add(r.date);
  });

  const outlets = Array.from(byOutlet.values()).map((o) => {
    const visitDates = Array.from(o.dateSet).sort();
    const totalVisits = visitDates.length;
    const firstVisit = visitDates[0];
    const lastVisit = visitDates[visitDates.length - 1];

    // Rata-rata interval antar kunjungan (butuh minimal 2 kunjungan untuk
    // punya pola sama sekali — kalau cuma 1x, belum bisa disimpulkan apa-apa).
    let avgIntervalDays = null;
    if (totalVisits >= 2) {
      const gaps = [];
      for (let i = 1; i < visitDates.length; i++) {
        const g = daysBetween(visitDates[i - 1], visitDates[i]);
        if (g !== null && g > 0) gaps.push(g);
      }
      if (gaps.length) avgIntervalDays = gaps.reduce((a, b) => a + b, 0) / gaps.length;
    }

    const daysSinceLastVisit = daysBetween(lastVisit, dateTo);
    const isOverdue = avgIntervalDays !== null && daysSinceLastVisit !== null
      && daysSinceLastVisit > avgIntervalDays * overdueMultiplier;

    return {
      outletCode: o.outletCode,
      outletName: o.outletName,
      visitDates,
      totalVisits,
      firstVisit,
      lastVisit,
      avgIntervalDays,
      daysSinceLastVisit,
      isOverdue,
      hasEnoughData: avgIntervalDays !== null,
    };
  });

  // Urutkan: yang overdue duluan (paling lama ketinggalan di atas), baru sisanya
  // berdasarkan daysSinceLastVisit menurun — supaya yang paling perlu perhatian
  // langsung kelihatan di atas tanpa perlu sort manual.
  outlets.sort((a, b) => {
    if (a.isOverdue !== b.isOverdue) return a.isOverdue ? -1 : 1;
    return (b.daysSinceLastVisit ?? -1) - (a.daysSinceLastVisit ?? -1);
  });

  return {
    outlets,
    dateFrom,
    dateTo,
    totalOutlets: outlets.length,
    overdueCount: outlets.filter((o) => o.isOverdue).length,
  };
}
