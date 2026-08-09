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
