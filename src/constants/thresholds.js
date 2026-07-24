/* ============================================================================
   APP THRESHOLDS & CONSTANTS
   Konstanta numerik yang sebelumnya tersebar sebagai magic numbers di banyak
   tempat. Dipusatkan di sini supaya gampang di-tune tanpa harus buru-buru
   ubah logika UI.
============================================================================ */

/** Jumlah hari kerja efektif default dalam 1 bulan (dipakai untuk proyeksi
 *  linear & perhitungan pace). User bisa override di SettingsModal. */
export const WORK_DAYS_DEFAULT = 27;

/** Sales/focus yang realisasinya masih 0 setelah sekian hari dianggap perlu
 *  perhatian (InsightBanner, dipakai di Main Report & Executive Summary). */
export const ALERT_MIN_DAYS = 3;

/** Jumlah maksimum snapshot riwayat periode yang disimpan di localStorage.
 *  Lebih dari ini, entry paling lama di-drop (FIFO). */
export const HISTORY_MAX_ENTRIES = 8;

/** Batas jumlah snapshot riwayat yang bisa dipilih sekaligus untuk tab
 *  "Tren Periode" (di luar periode aktif) — biar tabel & chart tidak
 *  kebanjiran kolom. HISTORY_MAX_ENTRIES (penyimpanan) sengaja lebih longgar. */
export const MAX_TREND_PERIODS = 5;

/** Threshold default untuk segmentasi outlet di tab "Analisis Outlet".
 *  activeMaxDays = berapa hari sejak transaksi terakhir masih dianggap aktif.
 *  dormantMinDays = di atas ini dianggap dormant. Antara activeMaxDays dan
 *  dormantMinDays = at_risk. */
export const OUTLET_DEFAULT_THRESHOLDS = {
  activeMaxDays: 14,
  dormantMinDays: 30,
};

/** Tingkatan pencapaian (ACH) untuk penentuan warna. Dipakai konsisten di
 *  seluruh UI badge, tooltip chart, dan export PDF — supaya tidak ada lagi
 *  ambiguitas seperti sebelumnya (UI pakai 70%, PDF pakai 80%).
 *  - onPace (>=1.0): mint (hijau) — capai target
 *  - warning (>=0.7): gold (kuning) — hampir capai
 *  - danger (<0.7): coral (merah) — jauh dari target */
export const ACH_TIERS = {
  onPace: 1.0,
  warning: 0.7,
  danger: 0.0,
};

/** Helper kecil: ambil key tier berdasarkan nilai ach. */
export function achTier(ach) {
  if (ach === null || ach === undefined) return "unknown";
  if (ach >= ACH_TIERS.onPace) return "onPace";
  if (ach >= ACH_TIERS.warning) return "warning";
  return "danger";
}
