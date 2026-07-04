export function fmtRp(n) {
  if (n === null || n === undefined || isNaN(n)) return "-";
  return "Rp " + new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(Math.round(n));
}

export function fmtNum(n) {
  return new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(Math.round(n || 0));
}

export function fmtPct(n) {
  return n === null || n === undefined ? "-" : (n * 100).toFixed(1) + "%";
}
