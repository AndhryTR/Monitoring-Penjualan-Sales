# Monitoring Penjualan

Dashboard monitoring pencapaian sales, produk, dan produk fokus. Dibangun dengan React + Vite + Tailwind CSS.

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
- Setelah diinstal, app shell (tampilan & kode) tersimpan lewat service worker sehingga tetap bisa dibuka offline. Data upload & pengaturan tetap tersimpan terpisah lewat fitur [persistensi data](#) yang sudah ada.
- Kalau ada versi baru ter-deploy, muncul notifikasi kecil untuk update — tidak auto-refresh supaya tidak mengganggu pekerjaan yang sedang berjalan.

## Struktur project

```
├── index.html
├── package.json
├── vite.config.js
├── tailwind.config.js
├── postcss.config.js
├── vercel.json
└── src/
    ├── main.jsx                          # Entry point React
    ├── App.jsx                           # Wrapper → SalesMonitoringApp
    ├── index.css                         # Tailwind directives
    ├── SalesMonitoringApp.jsx            # Shell: header, tab routing, modal orchestration, PWA
    │
    ├── constants/
    │   ├── colors.js                     # Theme tokens (dark/light)
    │   ├── aliases.js                    # Column alias untuk parsing Excel
    │   ├── tabs.js                       # Definisi 6 tab dashboard
    │   ├── thresholds.js                 # Konstanta numerik (WORK_DAYS_DEFAULT, ACH_TIERS, dll)
    │   └── defaultTargets.json           # Data target per sales (JSON, mudah diedit non-dev)
    │
    ├── utils/
    │   ├── formatters.js                 # fmtRp, fmtNum, fmtPct
    │   ├── storage.js                    # localStorage (settings/history) + IndexedDB (session)
    │   ├── pdfExport.js                  # Export PDF: laporan ringkasan + scorecard per sales
    │   ├── excelParse.js                 # Parse Excel/CSV, dedupe, konversi satuan KARTON
    │   ├── excelExport.js                # Export Excel dengan style (warna, merge, numFmt)
    │   ├── aggregation.js                # useAggregates hook + outlet breakdown + analysis
    │   ├── history.js                    # Snapshot & perbandingan periode
    │   ├── sampleData.js                 # Generator data demo
    │   └── dataQuality.js                # Analisis kualitas data (unknown sales, duplikat, dll)
    │
    ├── hooks/
    │   └── useCountUp.js                 # Animasi angka KPI (count-up cubic ease-out)
    │
    └── components/
        ├── KpiCard.jsx                   # Kartu KPI dengan animasi count-up
        ├── PaceStrip.jsx                 # Bar pace: ACH vs time-gone
        ├── AchBadge.jsx                  # Badge pencapaian (warna berdasarkan tier)
        ├── ui/
        │   ├── MultiSelect.jsx           # Dropdown multi-select dengan search
        │   ├── FilterBar.jsx             # Bar filter (desktop inline + mobile bottom-sheet)
        │   ├── DataTable.jsx             # Tabel sortable + card-stack mobile
        │   ├── DashboardSkeleton.jsx     # Skeleton loading
        │   └── index.jsx                 # SectionTitle, DrilldownButton, ChartTooltipStyle
        ├── cards/
        │   └── index.jsx                 # Leaderboard, ProjectionCard, AlertsPanel, PeriodComparisonCard
        └── upload/
            └── index.jsx                 # UploadDropzone, MobileBottomNav, MobileFab, ExportMenu
```
