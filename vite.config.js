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
        // Default workbox 2 MiB — bundle kita (jspdf+html2canvas+xlsx+recharts
        // digabung) bisa lebih besar dari itu. Dinaikkan ke 5 MiB supaya masih
        // ada headroom untuk pertumbuhan ke depan tanpa perlu diubah lagi tiap
        // nambah fitur/dependency baru.
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
    rollupOptions: {
      output: {
        // Pisah library besar jadi chunk masing-masing (bukan 1 bundle raksasa)
        // — ini yang bikin warning "chunk > 500kB" muncul sebelumnya. Bonus:
        // browser bisa cache chunk vendor terpisah dari kode aplikasi sendiri,
        // jadi update fitur app tidak perlu re-download seluruh library besar.
        manualChunks: {
          'vendor-react': ['react', 'react-dom'],
          'vendor-charts': ['recharts'],
          'vendor-pdf': ['jspdf', 'jspdf-autotable', 'html2canvas'],
          'vendor-excel': ['xlsx-js-style'],
          'vendor-icons': ['lucide-react'],
        },
      },
    },
  },
})
