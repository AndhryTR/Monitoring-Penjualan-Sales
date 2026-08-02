# Monitoring Penjualan

Dashboard monitoring pencapaian sales, produk, produk fokus, dan grup fokus.
Dibangun dengan React + Vite + Tailwind CSS. Data diproses langsung di browser —
tidak pernah diunggah ke server manapun.

**Versi:** 2.0.0

## Fitur utama

- **Executive Summary** — ringkasan performa sekali lihat: KPI, leaderboard sales,
  produk fokus, grup fokus, kesehatan outlet
- **Main Report** — pace ke target, KPI, proyeksi akhir bulan (linear / tren 7 hari /
  weekday-weekend), tren harian, kumulatif bulanan, ringkasan per sales
- **Sales / Product Report** — leaderboard, chart performa, detail per sales × grup
- **Produk Fokus** — target produk prioritas per sales (dalam satuan karton)
- **Grup Fokus** — highlight grup yang sedang digenjot (pakai target grup existing)
- **Analisis Outlet** — segmentasi Aktif / Berisiko / Dormant + pola kunjungan
- **Perbandingan** — matriks entitas (sales/grup/outlet) × periode pilihan
- **Tren Periode** — bandingkan performa antar bulan (auto-detect atau snapshot manual)
- **Snapshot Periode** — simpan snapshot angka agregat, bandingkan 1-vs-1 atau multi-periode
- **Transaksi** — tabel baris transaksi mentah dengan filter lanjutan
- **Catatan Data** — kualitas data upload: sales tak dikenal, duplikat, konversi karton
- **Export** — Excel (berstyle), PDF (ringkasan, scorecard per sales, perbandingan),
  dan gambar (PNG/JPEG)
- **PWA** — bisa diinstal ke HP dan dipakai offline
- **Backup & Restore** — export/import pengaturan + snapshot ke file JSON

## Menjalankan secara lokal

```bash
npm install
npm run dev
```

Buka `http://localhost:5173`.

## Deploy ke Vercel

### Opsi A — Vercel CLI (paling cepat, tanpa Git)

1. Install Vercel CLI (sekali saja):
   ```bash
   npm install -g vercel
   ```
2. Di dalam folder project ini, jalankan:
   ```bash
   vercel
   ```
3. Ikuti pertanyaan di terminal (login, nama project, dsb). Vercel otomatis mendeteksi ini project Vite.
4. Untuk deploy ke production:
   ```bash
   vercel --prod
   ```

### Opsi B — Lewat GitHub + Dashboard Vercel

1. Push folder ini ke repo GitHub baru.
2. Buka https://vercel.com/new, pilih repo tersebut.
3. Vercel otomatis mendeteksi framework **Vite** — biarkan setting default:
   - Build Command: `npm run build`
   - Output Directory: `dist`
4. Klik **Deploy**.

## PWA (Instal ke HP)

Aplikasi ini bisa diinstal seperti app native dan dipakai tanpa internet (setelah pernah dibuka sekali):

- **Android/Chrome/Edge**: tombol **"Instal Aplikasi"** muncul otomatis di header kalau memenuhi syarat instalasi.
- **iOS Safari**: tidak ada tombol instal otomatis (batasan Apple) — tap tombol yang sama untuk melihat instruksi manual (Share → Add to Home Screen).
- Setelah diinstal, app shell (tampilan & kode) tersimpan lewat service worker sehingga tetap bisa dibuka offline. Data upload & pengaturan tetap tersimpan terpisah lewat [persistensi data](#) yang sudah ada.
- Kalau ada versi baru ter-deploy, muncul notifikasi kecil untuk update — tidak auto-refresh supaya tidak mengganggu pekerjaan yang sedang berjalan.

## Pengaturan (Settings Modal)

Modal Pengaturan punya 3 tab:

- **Umum** — hari kerja efektif, nama depo/cabang, mode hemat daya
- **Target Sales** — daftar sales (dengan pencarian), target value & AO per sales,
  tombol **Σ auto-sum** (jumlahkan target value dari semua grup), target per grup
  produk (dengan toggle **Fokus** untuk grup fokus), dan editor produk fokus
  (tambah/hapus/salin dari sales lain)
- **Backup & Data** — backup/restore pengaturan + snapshot, dan hapus semua data

## Struktur project

```
├── index.html
├── package.json
├── vite.config.js
├── tailwind.config.js
├── postcss.config.js
├── vercel.json
├── docs/specs/                       # Dokumen desain fitur
└── src/
    ├── main.jsx                      # Entry point React
    ├── App.jsx                       # Wrapper → SalesMonitoringApp
    ├── index.css                     # Tailwind directives
    ├── SalesMonitoringApp.jsx        # Shell: header, tab routing, modal orchestration, PWA
    │
    ├── constants/
    │   ├── colors.js                 # Theme tokens (dark/light) + power-save mode
    │   ├── aliases.js                # Column alias untuk parsing Excel
    │   ├── tabs.js                   # Definisi tab + sidebar sections
    │   ├── thresholds.js             # Konstanta numerik (WORK_DAYS_DEFAULT, ACH_TIERS, dll)
    │   └── defaultTargets.json       # Data target per sales (JSON, mudah diedit non-dev)
    │
    ├── utils/
    │   ├── formatters.js             # fmtRp, fmtNum, fmtPct
    │   ├── storage.js                # localStorage (settings/snapshot) + IndexedDB (session)
    │   ├── pdfExport.js              # Export PDF: laporan ringkasan + scorecard per sales
    │   ├── excelParse.js             # Parse Excel/CSV, dedupe, konversi satuan KARTON
    │   ├── excelExport.js            # Export Excel dengan style (warna, merge, numFmt)
    │   ├── reportExcelExport.js      # Export Excel per halaman (sales/produk/fokus/outlet)
    │   ├── trendExport.js            # Export Excel/PDF tab Tren Periode
    │   ├── imageExport.js            # Export laporan sebagai gambar (html2canvas)
    │   ├── visitPattern.js           # Analisis pola kunjungan dari hari transaksi
    │   ├── visitPatternExport.js     # Export pola kunjungan ke Excel
    │   ├── backupExport.js           # Backup/restore pengaturan + snapshot (JSON)
    │   ├── comparison.js             # Matriks perbandingan (sales/grup/outlet × periode)
    │   ├── aggregation.js            # useAggregates + focus groups + outlet analysis
    │   ├── history.js                # Snapshot & perbandingan periode
    │   ├── datePresets.js            # Preset rentang tanggal (relatif ke data, bukan clock)
    │   ├── transactions.js           # Filter & ringkasan baris transaksi
    │   ├── sampleData.js             # Generator data demo
    │   └── dataQuality.js            # Analisis kualitas data (unknown sales, duplikat, dll)
    │
    ├── hooks/
    │   ├── useCountUp.js             # Animasi angka KPI (count-up cubic ease-out)
    │   └── useGrowthMoM.js           # Growth MoM (snapshot → auto-detect bulan)
    │
    ├── pages/
    │   ├── MainReportPage.jsx        # Pace, KPI, proyeksi, tren, ringkasan sales
    │   ├── ExecutiveSummaryPage.jsx  # Ringkasan eksekutif (KPI, leaderboard, fokus, outlet)
    │   ├── SalesReportPage.jsx       # Leaderboard + performa per sales
    │   ├── ProductReportPage.jsx     # Pencapaian per grup produk
    │   ├── ProductFocusReportPage.jsx# Produk Fokus / Grup Fokus (toggle view)
    │   ├── OutletAnalysisPage.jsx    # Segmentasi outlet + pola kunjungan
    │   ├── ComparisonPage.jsx        # Matriks perbandingan
    │   ├── TransactionsPage.jsx      # Tabel transaksi mentah
    │   └── DataQualityPage.jsx       # Catatan kualitas data
    │
    └── components/
        ├── KpiCard.jsx               # Kartu KPI dengan animasi count-up
        ├── PaceStrip.jsx             # Bar pace: ACH vs time-gone
        ├── AchBadge.jsx              # Badge pencapaian (warna berdasarkan tier)
        ├── ui/
        │   ├── MultiSelect.jsx       # Dropdown multi-select dengan search
        │   ├── FilterBar.jsx         # Bar filter (desktop inline + mobile bottom-sheet)
        │   ├── DataTable.jsx         # Tabel sortable + card-stack mobile
        │   ├── CustomSlider.jsx      # Slider (hari kerja)
        │   ├── DashboardSkeleton.jsx # Skeleton loading
        │   └── index.jsx             # SectionTitle, DrilldownButton, ChartTooltipStyle
        ├── layout/
        │   └── Sidebar.jsx           # Sidebar navigasi desktop (collapsible)
        ├── cards/
        │   └── index.jsx             # Leaderboard, ProjectionCard, PeriodComparisonCard
        ├── comparison/
        │   ├── MatrixTable.jsx       # Tabel matriks entitas × periode
        │   ├── MatrixKpiTotal.jsx    # KPI total per entitas
        │   ├── GroupedBarChart.jsx   # Bar chart per periode
        │   ├── MetricToggle.jsx      # Pilih metrik (value/AO/qty/ACH/deviasi)
        │   └── PeriodPicker.jsx      # Pilih periode (preset/manual)
        ├── executive/
        │   ├── CompactKpiGrid.jsx    # 8 KPI ringkas
        │   ├── MiniLeaderboard.jsx   # Top 3 + bottom 2 sales
        │   ├── FocusProductMini.jsx  # Ringkasan produk fokus
        │   ├── FocusGroupMini.jsx    # Ringkasan grup fokus
        │   ├── GroupMiniSummary.jsx  # Top grup produk
        │   ├── OutletHealthMini.jsx  # Distribusi status outlet
        │   ├── InsightBanner.jsx     # Alerts + isu kualitas data
        │   └── SectionCard.jsx       # Panel wrapper
        ├── modals/
        │   ├── SettingsModal.jsx     # Pengaturan (3 tab: Umum, Target Sales, Backup)
        │   ├── HistoryModal.jsx      # Snapshot Periode (simpan/pilih/bandingkan)
        │   ├── DataPreviewModal.jsx  # Preview upload: gabung vs ganti
        │   ├── OutletDrilldownModal.jsx  # Drilldown outlet
        │   ├── OutletDetailModal.jsx # Detail 1 outlet + produk
        │   ├── VisitPatternModal.jsx # Heatmap pola kunjungan
        │   └── AboutModal.jsx        # Tentang aplikasi
        ├── transactions/
        │   ├── TransactionFilters.jsx# Filter lanjutan transaksi
        │   └── TransactionTable.jsx  # Tabel transaksi
        ├── trend/
        │   └── index.jsx             # Tab Tren Periode (chart + tabel + export)
        └── upload/
            └── index.jsx             # UploadDropzone, MobileBottomNav, MobileFab, ExportMenu
```
