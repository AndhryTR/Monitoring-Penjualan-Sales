/* ============================================================================
   APP THRESHOLDS & CONSTANTS
   Konstanta numerik yang sebelumnya tersebar sebagai magic numbers di banyak
   tempat. Dipusatkan di sini supaya gampang di-tune tanpa harus buru-buru
   ubah logika UI.

   ⚠️ Sprint 5 / S1: tambah konsolidasi magic numbers dari syncEngine, storage,
   PeriodPicker, trend/index, VisitPatternModal, TransactionTable. Sebelumnya
   tiap file define konstanta lokal sendiri — bump value butuh edit多处.
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

/** Batas maksimum periode yang bisa dipilih di PeriodPicker (tab Perbandingan).
 *  Lebih dari ini, tabel matrix terlalu lebar & chart terlalu padat. */
export const MAX_PERIODS = 8;

/** Jumlah default garis sales yang ditampilkan di chart Tren Periode saat
 *  user belum memilih manual — supaya chart tidak langsung penuh sesak kalau
 *  jumlah sales banyak. */
export const MAX_DEFAULT_TREND_LINES = 5;

/** Jumlah maksimum hari yang ditampilkan di kalender VisitPatternModal.
 *  Default 45 hari (~1.5 bulan) — lebih dari itu, kalender terlalu lebar & scroll. */
export const VISIT_PATTERN_MAX_DAYS = 45;

/** Ukuran chunk untuk insert batch ke Supabase (syncEngine.pushMasterRows).
 *  Supabase/PostgREST default limit 1000 rows/request; 500 memberi headroom
 *  untuk payload JSON per row (transaksi penjualan punya ~14 kolom). */
export const SYNC_CHUNK_SIZE = 500;

/** Ukuran halaman default untuk DataTable (TransactionTable dll). Lebih besar
 *  = lebih sedikit klik "Load More", tapi render DOM lebih banyak (500 row ×
 *  9 cells = 4500 nodes — perhatikan performa di low-end devices). */
export const TABLE_PAGE_SIZE = 500;

/** Estimasi tinggi (mm) yang dibutuhkan untuk section title + header tabel +
 *  minimal 1 baris data di PDF export — dipakai helper ensureSpace untuk
 *  cek apakah perlu page break. */
export const PDF_SECTION_MIN_HEIGHT_MM = 40;

/** Tinggi baris (px) per baris di bar chart vertical (SalesReportPage,
 *  ProductReportPage) — dipakai untuk hitung tinggi chart dinamis. */
export const BAR_CHART_ROW_HEIGHT_PX = 46;

/** Tinggi minimum (px) bar chart — supaya chart tidak terlalu pendek saat
 *  cuma 1-2 baris data. */
export const BAR_CHART_MIN_HEIGHT_PX = 220;

/** Threshold default untuk segmentasi outlet di tab "Analisis Outlet".
 *  activeMaxDays = berapa hari sejak transaksi terakhir masih dianggap aktif.
 *  dormantMinDays = di atas ini dianggap dormant. Antara activeMaxDays dan
 *  dormantMinDays = at_risk. */
export const OUTLET_DEFAULT_THRESHOLDS = {
  activeMaxDays: 14,
  dormantMinDays: 30,
};

export const OUTLET_STATUS_META = {
  active: { label: "Aktif", color: "mint" },
  at_risk: { label: "Berisiko", color: "gold" },
  dormant: { label: "Dormant", color: "coral" },
  unknown: { label: "-", color: "textMuted" },
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
  if (ach === null || ach === undefined || Number.isNaN(ach)) return "unknown";
  if (ach >= ACH_TIERS.onPace) return "onPace";
  if (ach >= ACH_TIERS.warning) return "warning";
  return "danger";
}

/**
 * Ambil warna tema berdasarkan nilai pencapaian (ACH).
 * @param {number|null} ach - rasio 0.0 - 1.0+
 * @param {object} colors - objek token warna aktif
 * @returns {string} kode warna hex/rgb
 */
export function getAchColor(ach, colors) {
  if (ach === null || ach === undefined || Number.isNaN(ach)) return colors.textMuted;
  if (ach >= ACH_TIERS.onPace) return colors.mint;
  if (ach >= ACH_TIERS.warning) return colors.gold;
  return colors.coral;
}

/**
 * Status teks singkat untuk pencapaian ACH.
 * @param {number|null} ach
 * @returns {string}
 */
export function getAchStatus(ach) {
  const tier = achTier(ach);
  if (tier === "onPace") return "Tercapai";
  if (tier === "warning") return "Mendekati";
  if (tier === "danger") return "Di Bawah Target";
  return "-";
}
