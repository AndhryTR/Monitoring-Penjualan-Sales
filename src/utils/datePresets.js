import { dateStrToLocalDate } from "./excelParse.js";
import { detectMonths, monthKey } from "./aggregation.js";

/* ============================================================================
   DATE PRESETS
   Preset filter tanggal untuk FilterBar. SEMUA preset dihitung relatif ke
   tanggal TERBARU YANG ADA DI DATA (rawRows) — bukan Date.now() browser.
   Ini penting karena app ini bekerja dari file yang di-upload, yang bisa saja
   berisi data bulan lalu; "7 Hari Terakhir" harus berarti 7 hari terakhir
   DI DALAM DATA, bukan 7 hari terakhir versi kalender asli.
============================================================================ */

function toDateStr(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addDays(dateStr, delta) {
  const d = dateStrToLocalDate(dateStr);
  if (!d) return null;
  d.setDate(d.getDate() + delta);
  return toDateStr(d);
}

/** Tanggal terbaru yang ada di rawRows (null kalau belum ada data). */
export function getLatestDataDate(rawRows) {
  if (!rawRows || !rawRows.length) return null;
  let latest = null;
  for (const r of rawRows) {
    if (r.date && (!latest || r.date > latest)) latest = r.date;
  }
  return latest;
}

// Preset statis (selalu ada, tidak tergantung isi data).
export const STATIC_DATE_PRESETS = [
  { key: "all", label: "Semua Data" },
  { key: "thisMonth", label: "Bulan Ini" },
  { key: "last7", label: "7 Hari Terakhir" },
  { key: "last14", label: "14 Hari Terakhir" },
  { key: "thisWeek", label: "Minggu Ini" },
];

/**
 * Daftar lengkap opsi preset untuk ditampilkan di dropdown, termasuk entri
 * bulan dinamis (mis. "Juli 2026") kalau rawRows mencakup >1 bulan kalender.
 * "Custom..." SENGAJA tidak dimasukkan di sini — dirender terpisah di UI
 * supaya selalu jadi opsi paling akhir.
 */
export function getDatePresetOptions(rawRows) {
  const months = detectMonths(rawRows || []);
  const monthOptions = months.length > 1
    ? months.map((m) => ({ key: `month:${m.key}`, label: m.label })).reverse() // terbaru dulu
    : [];
  return [...STATIC_DATE_PRESETS, ...monthOptions];
}

/**
 * Resolve 1 preset key -> { dateFrom, dateTo }.
 * Return null untuk "custom" (berarti: jangan timpa, pakai dateFrom/dateTo
 * manual yang sedang tersimpan di filters).
 */
export function resolveDatePreset(datePreset, rawRows) {
  if (!datePreset || datePreset === "custom") return null;

  if (datePreset === "all") return { dateFrom: "", dateTo: "" };

  if (datePreset.startsWith("month:")) {
    const key = datePreset.slice("month:".length);
    const months = detectMonths(rawRows || []);
    const found = months.find((m) => m.key === key);
    return found ? { dateFrom: found.dateFrom, dateTo: found.dateTo } : { dateFrom: "", dateTo: "" };
  }

  const latest = getLatestDataDate(rawRows);
  if (!latest) return { dateFrom: "", dateTo: "" };

  if (datePreset === "thisMonth") {
    return { dateFrom: `${monthKey(latest)}-01`, dateTo: latest };
  }
  if (datePreset === "last7") {
    return { dateFrom: addDays(latest, -6), dateTo: latest };
  }
  if (datePreset === "last14") {
    return { dateFrom: addDays(latest, -13), dateTo: latest };
  }
  if (datePreset === "thisWeek") {
    const d = dateStrToLocalDate(latest);
    // getDay(): 0=Minggu..6=Sabtu. Senin dianggap awal minggu.
    const diffToMonday = (d.getDay() + 6) % 7;
    return { dateFrom: addDays(latest, -diffToMonday), dateTo: latest };
  }

  return { dateFrom: "", dateTo: "" };
}

/** Label untuk ditampilkan di tombol dropdown, termasuk fallback yang aman untuk key tak dikenal/lama. */
export function getDatePresetLabel(datePreset, rawRows) {
  if (!datePreset || datePreset === "all") return "Semua Data";
  if (datePreset === "custom") return "Custom";
  if (datePreset.startsWith("month:")) {
    const months = detectMonths(rawRows || []);
    const found = months.find((m) => `month:${m.key}` === datePreset);
    return found ? found.label : "Custom";
  }
  const found = STATIC_DATE_PRESETS.find((p) => p.key === datePreset);
  return found ? found.label : "Custom";
}
