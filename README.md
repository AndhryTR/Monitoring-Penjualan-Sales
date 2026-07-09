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
    ├── main.jsx
    ├── App.jsx
    ├── index.css
    └── SalesMonitoringApp.jsx   ← komponen utama dashboard
```
