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

function shortenUnit(unit) {
  const u = String(unit || "").trim().toUpperCase();
  if (u === "KARTON") return "KRT";
  if (u === "PIECES") return "PCS";
  return u.length > 4 ? u.slice(0, 3) : u;
}

/**
 * Format qty base (satuan terkecil, mis. PCS) ke mixed units yang mudah dibaca.
 * Contoh: 721 PCS dengan konversi [30 PCS/KARTON, 10 PCS/PAK] → "24 KRT 1 PCS"
 *
 * Algoritma: bagi bertingkat (greedy) dari satuan terbesar ke terkecil.
 * 1. Sort conversions descending by factor (KARTON > PAK > PCS)
 * 2. Tambahkan level dasar (factor 1) bila belum ada di conversions
 * 3. Untuk tiap level selain level dasar: qty_at_level = floor(remaining / factor), remaining = remaining % factor
 * 4. Untuk level dasar terakhir: sisa remaining di-assign langsung
 * 5. Tampilkan unit jika qty > 0, atau tampilkan "0 <unit>" jika qtyBase = 0
 *
 * @param {number} qtyBase - qty dalam satuan dasar (PCS)
 * @param {Array<{qty: number, unit: string}>} conversions - konversi satuan
 * @param {string} [baseUnit="PCS"] - nama satuan dasar
 * @returns {string} formatted string, mis. "24 KRT 1 PCS"
 */
export function fmtMixedUnits(qtyBase, conversions = [], baseUnit = "PCS") {
  if (qtyBase === null || qtyBase === undefined || Number.isNaN(qtyBase)) return "-";
  if (qtyBase < 0) return fmtNum(qtyBase); // stok negatif, tampilkan angka saja
  if (!conversions || !conversions.length) {
    return `${fmtNum(qtyBase)} ${shortenUnit(baseUnit)}`.trim();
  }

  // Sort descending by factor (largest first: KARTON > PAK > PCS)
  const valid = conversions
    .filter((c) => c && Number(c.qty) > 0)
    .map((c) => ({ qty: Number(c.qty), unit: c.unit }))
    .sort((a, b) => b.qty - a.qty);

  if (!valid.length) {
    return `${fmtNum(qtyBase)} ${shortenUnit(baseUnit)}`.trim();
  }

  // Pastikan ada satuan dasar (factor 1) di akhir hierarki
  const hasBaseUnit = valid.some((c) => Math.round(c.qty) === 1);
  const levels = hasBaseUnit
    ? valid
    : [...valid, { qty: 1, unit: baseUnit || "PCS" }];

  let remaining = Math.floor(qtyBase);
  const parts = [];

  for (let i = 0; i < levels.length; i++) {
    const conv = levels[i];
    const isBaseLevel = i === levels.length - 1;
    const factor = Math.max(1, Math.round(conv.qty));
    const qtyAtLevel = isBaseLevel ? remaining : Math.floor(remaining / factor);
    remaining = isBaseLevel ? 0 : remaining % factor;

    if (qtyAtLevel > 0) {
      parts.push(`${fmtNum(qtyAtLevel)} ${shortenUnit(conv.unit)}`);
    }
  }

  if (parts.length === 0) {
    const defaultUnit = levels[levels.length - 1]?.unit || baseUnit || "PCS";
    return `0 ${shortenUnit(defaultUnit)}`;
  }

  return parts.join(" ");
}

