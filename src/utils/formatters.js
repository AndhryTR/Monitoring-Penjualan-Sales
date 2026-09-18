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
 * Menghitung total properti atau nilai dari array objek secara native (pengganti lodash/sumBy).
 * Menggunakan loop for murni untuk performa maksimal pada dataset ribuan baris.
 * @param {Array} arr - Array objek
 * @param {string|Function} iteratee - Nama field atau accessor function
 * @returns {number}
 */
export function sumBy(arr, iteratee) {
  if (!arr || !arr.length) return 0;
  const isFn = typeof iteratee === "function";
  let sum = 0;
  for (let i = 0; i < arr.length; i++) {
    const item = arr[i];
    const val = isFn ? Number(iteratee(item)) : Number(item?.[iteratee]);
    if (!Number.isNaN(val)) sum += val;
  }
  return sum;
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

/* ============================================================================
   FORMAT TANGGAL & BULAN INDONESIA
============================================================================ */
export const MONTHS_ID = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
export const MONTHS_ID_FULL = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

/**
 * Format string tanggal YYYY-MM-DD ke format Indonesia (mis. "12 Jul 2026").
 * @param {string} dateStr - string format "YYYY-MM-DD"
 * @param {object} [opts]
 * @param {boolean} [opts.short=true] - gunakan singkatan bulan jika true
 * @returns {string}
 */
export function formatDateID(dateStr, { short = true } = {}) {
  if (!dateStr) return "-";
  const [y, m, d] = String(dateStr).split("-").map(Number);
  if (!y || !m || !d) return String(dateStr);
  const monthName = (short ? MONTHS_ID : MONTHS_ID_FULL)[m - 1] || String(m);
  return `${d} ${monthName} ${y}`;
}

export function formatDateIDShort(dateStr) {
  return formatDateID(dateStr, { short: true });
}

/* ============================================================================
   FORMAT ANGKA & RUPIAH RINGKAS (UNTUK AXIS / BADGE / SEARCH)
============================================================================ */

/**
 * Format angka besar ke bentuk ringkas (mis. 1.2jt, 850rb, 2.5M).
 * @param {number} n
 * @param {object} [opts]
 * @param {number} [opts.decimals=1]
 * @param {string} [opts.space=""]
 * @returns {string}
 */
export function fmtCompactNum(n, { decimals = 1, space = "" } = {}) {
  if (n === null || n === undefined || Number.isNaN(n)) return "-";
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 1e9) {
    const val = (abs / 1e9).toFixed(decimals).replace(/\.0$/, "");
    return `${sign}${val}${space}M`;
  }
  if (abs >= 1e6) {
    const val = (abs / 1e6).toFixed(decimals).replace(/\.0$/, "");
    return `${sign}${val}${space}jt`;
  }
  if (abs >= 1e3) {
    const val = (abs / 1e3).toFixed(0);
    return `${sign}${val}${space}rb`;
  }
  return String(Math.round(n));
}

/**
 * Format Rupiah ringkas (mis. "Rp 1.2 jt", "Rp 850 rb").
 * @param {number} n
 * @param {object} [opts]
 * @returns {string}
 */
export function fmtCompactRp(n, { decimals = 1 } = {}) {
  if (n === null || n === undefined || Number.isNaN(n)) return "-";
  if (n === 0) return "Rp 0";
  return "Rp " + fmtCompactNum(n, { decimals, space: " " });
}

/* ============================================================================
   SANITASI STRING HTML
============================================================================ */

/**
 * Escape karakter HTML khusus untuk mencegah injeksi di template export.
 * @param {string} str
 * @returns {string}
 */
export function esc(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Format tanggal & waktu pembuatan laporan (e.g. "17 Sep 2026, 08:30").
 * @param {Date} [date=new Date()]
 * @returns {string}
 */
export function formatGeneratedAt(date = new Date()) {
  const d = String(date.getDate()).padStart(2, "0");
  const mo = MONTHS_ID[date.getMonth()];
  const y = date.getFullYear();
  const h = String(date.getHours()).padStart(2, "0");
  const mi = String(date.getMinutes()).padStart(2, "0");
  return `${d} ${mo} ${y}, ${h}:${mi}`;
}

