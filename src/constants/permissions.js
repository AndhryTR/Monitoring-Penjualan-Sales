/* ============================================================================
   PERMISSIONS — Katalog izin fitur untuk Superuser Admin Dashboard.

   Struktur data:
   - PERMISSION_CATALOG     : array semua permission definitions
   - DEFAULT_PERMISSIONS_FALLBACK : map { [id]: { allow_offline, allow_user, allow_supervisor, allow_admin } }
   - PERMISSION_CATEGORIES  : array kategori yang valid
   - CATEGORY_LABELS        : map kategori ke label Bahasa Indonesia
   - VALID_ROLES            : array role yang valid
   - ROLE_LABELS            : map role ke label Bahasa Indonesia

   Tabel ini merupakan FALLBACK saat Supabase belum terkonfigurasi atau
   saat tabel `app_feature_permissions` belum punya data. Nilai sebenarnya
   di-load dari Supabase oleh `usePermissions`.
============================================================================ */

/**
 * Katalog lengkap semua permission yang dikelola aplikasi.
 * Tiap entry berisi:
 *  - id              : string unik, format "{category}:{slug}"
 *  - category        : 'page' | 'feature' | 'button'  (feat → feature)
 *  - name            : label singkat Bahasa Indonesia
 *  - description     : deskripsi panjang (opsional, untuk tooltip di admin UI)
 *  - defaultOffline  : apakah diizinkan saat tidak ada sesi login (offline/demo)
 *  - defaultUser     : apakah diizinkan untuk role "user"
 *  - defaultSupervisor: apakah diizinkan untuk role "supervisor"
 *  - defaultAdmin    : apakah diizinkan untuk role "admin"
 * @type {Array<{id:string, category:string, name:string, description:string,
 *   defaultOffline:boolean, defaultUser:boolean, defaultSupervisor:boolean, defaultAdmin:boolean}>}
 */
export const PERMISSION_CATALOG = [
  /* ── Halaman & Laporan ─────────────────────────────────────────────────── */
  {
    id: "page:executive",
    category: "page",
    name: "Executive Summary",
    description: "Halaman ringkasan eksekutif dengan KPI utama dan grafik rangkuman penjualan.",
    defaultOffline: true,
    defaultUser: true,
    defaultSupervisor: true,
    defaultAdmin: true,
  },
  {
    id: "page:main",
    category: "page",
    name: "Main Report",
    description: "Halaman laporan utama berisi tabel penjualan harian per sales.",
    defaultOffline: true,
    defaultUser: true,
    defaultSupervisor: true,
    defaultAdmin: true,
  },
  {
    id: "page:sales",
    category: "page",
    name: "Sales Report",
    description: "Halaman laporan kinerja per salesperson secara detail.",
    defaultOffline: true,
    defaultUser: true,
    defaultSupervisor: true,
    defaultAdmin: true,
  },
  {
    id: "page:product",
    category: "page",
    name: "Product Report",
    description: "Halaman laporan penjualan per produk dan grup kategori.",
    defaultOffline: true,
    defaultUser: true,
    defaultSupervisor: true,
    defaultAdmin: true,
  },
  {
    id: "page:focus",
    category: "page",
    name: "Product Focus",
    description: "Halaman analisis mendalam pada produk tertentu (requires live data).",
    defaultOffline: true,
    defaultUser: true,
    defaultSupervisor: true,
    defaultAdmin: true,
  },
  {
    id: "page:outlet",
    category: "page",
    name: "Analisis Outlet",
    description: "Halaman analisis kinerja per outlet pelanggan (requires live data).",
    defaultOffline: true,
    defaultUser: true,
    defaultSupervisor: true,
    defaultAdmin: true,
  },
  {
    id: "page:trend",
    category: "page",
    name: "Tren Periode",
    description: "Halaman perbandingan tren penjualan lintas periode waktu.",
    defaultOffline: true,
    defaultUser: true,
    defaultSupervisor: true,
    defaultAdmin: true,
  },
  {
    id: "page:compare",
    category: "page",
    name: "Perbandingan",
    description: "Halaman perbandingan multi-dimensi antar salesperson, produk, atau outlet.",
    defaultOffline: true,
    defaultUser: true,
    defaultSupervisor: true,
    defaultAdmin: true,
  },
  {
    id: "page:transactions",
    category: "page",
    name: "Transaksi Mentah",
    description: "Halaman tabel transaksi mentah untuk audit dan verifikasi data (supervisor+).",
    defaultOffline: true,
    defaultUser: false,
    defaultSupervisor: true,
    defaultAdmin: true,
  },
  {
    id: "page:stock",
    category: "page",
    name: "Stok Barang",
    description: "Halaman manajemen dan visualisasi stok barang per gudang (supervisor+).",
    defaultOffline: true,
    defaultUser: false,
    defaultSupervisor: true,
    defaultAdmin: true,
  },
  {
    id: "page:quality",
    category: "page",
    name: "Catatan Kualitas Data",
    description: "Halaman log anomali kualitas data dan flagging transaksi bermasalah (supervisor+).",
    defaultOffline: false,
    defaultUser: false,
    defaultSupervisor: true,
    defaultAdmin: true,
  },

  /* ── Fitur & Modal ─────────────────────────────────────────────────────── */
  {
    id: "feat:upload_excel",
    category: "feature",
    name: "Upload File Penjualan",
    description: "Fitur upload file Excel penjualan harian untuk data lokal maupun cloud.",
    defaultOffline: true,
    defaultUser: true,
    defaultSupervisor: true,
    defaultAdmin: true,
  },
  {
    id: "feat:sample_data",
    category: "feature",
    name: "Muat Data Demo",
    description: "Fitur memuat dataset demo/sampel bawaan (hanya tampil saat offline, default mati untuk semua role).",
    defaultOffline: true,
    defaultUser: false,
    defaultSupervisor: false,
    defaultAdmin: false,
  },
  {
    id: "feat:slideshow",
    category: "feature",
    name: "Mode Pajangan",
    description: "Fitur mode tampilan otomatis berputar antar halaman (display/signage mode).",
    defaultOffline: true,
    defaultUser: true,
    defaultSupervisor: true,
    defaultAdmin: true,
  },
  {
    id: "feat:global_search",
    category: "feature",
    name: "Pencarian Cepat",
    description: "Fitur pencarian global lintas halaman dengan keyboard shortcut.",
    defaultOffline: true,
    defaultUser: true,
    defaultSupervisor: true,
    defaultAdmin: true,
  },
  {
    id: "feat:smart_alerts",
    category: "feature",
    name: "Smart Alerts Anomali",
    description: "Fitur notifikasi cerdas saat terdeteksi anomali atau pencapaian target.",
    defaultOffline: true,
    defaultUser: true,
    defaultSupervisor: true,
    defaultAdmin: true,
  },
  {
    id: "feat:daily_report",
    category: "feature",
    name: "Generator Laporan Harian",
    description: "Fitur generate ringkasan laporan harian (requires cloud data).",
    defaultOffline: false,
    defaultUser: true,
    defaultSupervisor: true,
    defaultAdmin: true,
  },
  {
    id: "feat:history_snap",
    category: "feature",
    name: "Riwayat & Snapshot Periode",
    description: "Fitur melihat dan membandingkan snapshot historis periode sebelumnya.",
    defaultOffline: false,
    defaultUser: true,
    defaultSupervisor: true,
    defaultAdmin: true,
  },
  {
    id: "feat:depot_switch",
    category: "feature",
    name: "Ganti / Tambah Depo",
    description: "Fitur beralih atau menambahkan depo baru dalam satu sesi (supervisor+).",
    defaultOffline: false,
    defaultUser: false,
    defaultSupervisor: true,
    defaultAdmin: true,
  },
  {
    id: "feat:stock_reconcile",
    category: "feature",
    name: "Impor & Rekonsiliasi Stok",
    description: "Fitur import file stok dan rekonsiliasi dengan data penjualan (admin only).",
    defaultOffline: false,
    defaultUser: false,
    defaultSupervisor: false,
    defaultAdmin: true,
  },
  {
    id: "feat:visit_schedule",
    category: "feature",
    name: "Atur Jadwal Kunjungan",
    description: "Fitur atur jadwal rencana kunjungan sales ke outlet per hari (Quick Assign & Kanban).",
    defaultOffline: false,
    defaultUser: false,
    defaultSupervisor: true,
    defaultAdmin: true,
  },

  /* ── Tombol & Aksi ─────────────────────────────────────────────────────── */
  {
    id: "btn:export_excel",
    category: "button",
    name: "Export Laporan Excel",
    description: "Tombol export data/laporan ke format .xlsx (supervisor+).",
    defaultOffline: true,
    defaultUser: false,
    defaultSupervisor: true,
    defaultAdmin: true,
  },
  {
    id: "btn:export_pdf",
    category: "button",
    name: "Export Laporan PDF",
    description: "Tombol export laporan ke format .pdf.",
    defaultOffline: true,
    defaultUser: true,
    defaultSupervisor: true,
    defaultAdmin: true,
  },
  {
    id: "btn:export_image",
    category: "button",
    name: "Export Gambar / Chart",
    description: "Tombol screenshot chart sebagai gambar PNG/JPG.",
    defaultOffline: true,
    defaultUser: true,
    defaultSupervisor: true,
    defaultAdmin: true,
  },
  {
    id: "btn:edit_targets",
    category: "button",
    name: "Ubah Target Penjualan",
    description: "Tombol edit target penjualan bulanan per salesperson (admin only).",
    defaultOffline: true,
    defaultUser: false,
    defaultSupervisor: false,
    defaultAdmin: true,
  },
  {
    id: "btn:save_master",
    category: "button",
    name: "Simpan Master ke Cloud",
    description: "Tombol upload / simpan data transaksi lokal ke master data cloud Supabase.",
    defaultOffline: false,
    defaultUser: false,
    defaultSupervisor: true,
    defaultAdmin: true,
  },
  {
    id: "btn:delete_master",
    category: "button",
    name: "Hapus Rentang Master Data",
    description: "Tombol hapus rentang tanggal data master penjualan dari cloud (admin only, destruktif).",
    defaultOffline: false,
    defaultUser: false,
    defaultSupervisor: false,
    defaultAdmin: true,
  },
  {
    id: "btn:drilldown_outlet",
    category: "button",
    name: "Buka Detail Drilldown Outlet",
    description: "Tombol buka modal detail outlet untuk analisis mendalam.",
    defaultOffline: true,
    defaultUser: true,
    defaultSupervisor: true,
    defaultAdmin: true,
  },
  {
    id: "btn:clear_all",
    category: "button",
    name: "Hapus Semua Data Lokal",
    description: "Tombol reset / hapus seluruh data lokal dari localStorage.",
    defaultOffline: true,
    defaultUser: true,
    defaultSupervisor: true,
    defaultAdmin: true,
  },
];

/**
 * Fallback map permission_id → batas akses default.
 * Dipakai saat Supabase belum terkonfigurasi atau tabel masih kosong.
 * Di-generate otomatis dari PERMISSION_CATALOG.
 *
 * Struktur nilai:
 *  { allow_offline: boolean, allow_user: boolean,
 *    allow_supervisor: boolean, allow_admin: boolean }
 *
 * @type {Record<string, {allow_offline:boolean, allow_user:boolean, allow_supervisor:boolean, allow_admin:boolean}>}
 */
export const DEFAULT_PERMISSIONS_FALLBACK = Object.fromEntries(
  PERMISSION_CATALOG.map((p) => [
    p.id,
    {
      allow_offline: p.defaultOffline,
      allow_user: p.defaultUser,
      allow_supervisor: p.defaultSupervisor,
      allow_admin: p.defaultAdmin,
    },
  ])
);

/**
 * Kategori permission yang valid.
 * Nilai sesuai dengan field `category` di PERMISSION_CATALOG.
 * @type {string[]}
 */
export const PERMISSION_CATEGORIES = ["page", "feature", "button"];

/**
 * Label Bahasa Indonesia untuk setiap kategori permission.
 * @type {Record<string, string>}
 */
export const CATEGORY_LABELS = {
  page: "Halaman & Laporan",
  feature: "Fitur & Modal",
  button: "Tombol & Aksi",
};

/**
 * Daftar role yang valid dalam aplikasi.
 * Urutan: dari privilege paling rendah ke paling tinggi.
 * @type {string[]}
 */
export const VALID_ROLES = ["user", "supervisor", "admin", "superuser"];

/**
 * Label Bahasa Indonesia untuk setiap role.
 * @type {Record<string, string>}
 */
export const ROLE_LABELS = {
  user: "User Biasa",
  supervisor: "Supervisor",
  admin: "Admin Depo",
  superuser: "Superuser",
};
