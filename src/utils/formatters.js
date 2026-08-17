export function fmtRp(n) {
  if (n === null || n === undefined || Number.isNaN(n)) return "-";
  return "Rp " + new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(Math.round(n));
}

export function fmtNum(n) {
  // Sebelumnya: `Math.round(n || 0)` — null/undefined/NaN semua jadi "0",
  // menyembunyikan semantik "tidak ada data" (mis. ACH null → tampil "0%"
  // menyesatkan, seolah metric benar-benar 0). Sekarang return "-" konsisten
  // dengan fmtRp, kecuali untuk angka 0 yang valid → tetap tampil "0".
  if (n === null || n === undefined || Number.isNaN(n)) return "-";
  return new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(Math.round(n));
}

export function fmtPct(n) {
  // Tambah guard Number.isNaN — sebelumnya NaN lolos dan tampil "NaN%".
  if (n === null || n === undefined || Number.isNaN(n)) return "-";
  return (n * 100).toFixed(1) + "%";
}

/**
 * Format qty base (satuan terkecil, mis. PCS) ke mixed units yang mudah dibaca.
 * Contoh: 721 PCS dengan konversi [30 PCS/KARTON, 10 PCS/PAK] → "24 KRT 0 PAK 1 PCS"
 *
 * Algoritma: bagi bertingkat (greedy) dari satuan terbesar ke terkecil.
 * 1. Sort conversions descending by factor (KARTON > PAK > PCS)
 * 2. Untuk tiap level: qty_at_level = floor(remaining / factor)
 * 3. remaining = remaining % factor
 * 4. Skip level jika qty_at_level == 0 (kecuali level terkecil, tetap tampilkan)
 *
 * @param {number} qtyBase - qty dalam satuan dasar (PCS)
 * @param {Array<{qty: number, unit: string}>} conversions - konversi satuan
 *   Contoh: [{ qty: 30, unit: "KARTON" }, { qty: 10, unit: "PAK" }, { qty: 1, unit: "PCS" }]
 * @returns {string} formatted string, mis. "24 KRT 0 PAK 1 PCS"
 */
export function fmtMixedUnits(qtyBase, conversions = []) {
  if (qtyBase === null || qtyBase === undefined || Number.isNaN(qtyBase)) return "-";
  if (qtyBase < 0) return fmtNum(qtyBase); // stok negatif, tampilkan angka saja
  if (!conversions || !conversions.length) return fmtNum(qtyBase);

  // Sort descending by factor (largest first: KARTON > PAK > PCS)
  const sorted = [...conversions]
    .filter((c) => c.qty && c.qty > 0)
    .sort((a, b) => b.qty - a.qty);

  if (!sorted.length) return fmtNum(qtyBase);

  let remaining = Math.floor(qtyBase);
  const parts = [];

  sorted.forEach((conv, i) => {
    const isLast = i === sorted.length - 1;
    const qtyAtLevel = isLast ? remaining : Math.floor(remaining / conv.qty);
    remaining = isLast ? 0 : remaining % conv.qty;

    // Tampilkan level ini jika qty > 0, ATAU ini level terkecil (PCS) — selalu tampilkan
    if (qtyAtLevel > 0 || isLast) {
      // Singkat unit: KARTON → KRT, PAK → PAK, PCS → PCS
      const unitShort = conv.unit?.toUpperCase() === "KARTON" ? "KRT" : (conv.unit || "").slice(0, 3).toUpperCase();
      parts.push(`${qtyAtLevel} ${unitShort}`);
    }
  });

  return parts.length > 0 ? parts.join(" ") : fmtNum(qtyBase);
}
