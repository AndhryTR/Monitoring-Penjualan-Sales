import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // 'prompt' — jangan auto-reload begitu ada versi baru (bisa bikin data
      // yang lagi diisi user hilang), tampilkan notifikasi "update tersedia" dulu.
      registerType: 'prompt',
      includeAssets: ['favicon-32.png', 'apple-touch-icon.png'],
      manifest: {
        name: 'Monitoring Penjualan',
        short_name: 'MonPenjualan',
        description: 'Dashboard monitoring pencapaian sales, produk, dan produk fokus',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait-primary',
        background_color: '#0A1120',
        theme_color: '#0A1120',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'pwa-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Precache semua asset hasil build (JS/CSS/HTML) — inilah yang bikin
        // app shell tetap bisa dibuka tanpa internet setelah pernah diakses.
        globPatterns: ['**/*.{js,css,html,png,svg,ico}'],
        // Naikkan limit precache dari default 2 MiB ke 5 MiB.
        // pdfjs-dist (chunk terpisah hasil dynamic import) bisa 1-2 MB per chunk;
        // tanpa kenaikan ini, chunk akan di-skip dari precache → fitur "Export
        // ke Gambar" tidak akan jalan offline walau app shell sudah ter-cache.
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        runtimeCaching: [
          {
            // Font Google Fonts di-load dari CDN eksternal saat runtime — cache
            // supaya tetap tampil normal walau sedang offline setelah load pertama.
            urlPattern: ({ url }) => url.origin === 'https://fonts.googleapis.com' || url.origin === 'https://fonts.gstatic.com',
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      devOptions: {
        // Aktifkan service worker juga saat `npm run dev`, supaya bisa dites
        // langsung tanpa perlu build production dulu.
        enabled: true,
      },
    }),
  ],
  build: {
    // Default Vite 500 KB — kita naikkan karena dynamic import chunks pdfjs &
    // html2canvas wajar 1-2 MB. Warning ini hanya cosmetic, tidak break build.
    chunkSizeWarningLimit: 2000,
    rollupOptions: {
      output: {
        // Force dependency berat ke chunk terpisah supaya tidak menumpuk di
        // main chunk. Ini backup untuk dynamic import di imageExport.js —
        // kalau suatu hari ada import statik tidak sengaja, rollup tetap
        // memisahkannya ke chunk sendiri.
        manualChunks: {
          'html2canvas': ['html2canvas'],
        },
      },
    },
  },
})
