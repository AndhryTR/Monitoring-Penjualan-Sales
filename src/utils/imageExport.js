// Vite-specific: load worker as URL so it's bundled & served same-origin.
// Critical for PWA offline support (CDN worker would break offline).
// Catatan: import ini hanya mengembalikan string URL (beberapa byte), BUKAN
// kode worker — aman untuk di-import secara statik tanpa memperbesar chunk.
import pdfjsWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

/* ============================================================================
   IMAGE EXPORT UTILITIES
   Dua jalur konversi → gambar:

   1) PDF → PNG/JPG  (pdfjs-dist)
      - Dipakai untuk semua laporan yang sudah jadi PDF (Summary, Scorecard,
        Perbandingan Sales). Hasil gambar = persis PDF, tidak ada duplikasi
        template.
      - Multi-halaman: return array of { dataUrl, width, height }.

   2) HTML element → PNG/JPG  (html2canvas)
      - Dipakai untuk "Excel sebagai Gambar" — Excel tidak punya canvas
        bawaan, jadi kita render HTML twin lalu capture.

   Output strategy (auto):
   - 1 halaman → 1 file gambar
   - 2 halaman → 1 file gambar panjang (stitching vertikal)
   - 3+ halaman → N file gambar (download berurutan dengan delay)

   ─── CODE-SPLITTING NOTE ────────────────────────────────────────────────────
   pdfjs-dist (~1MB) dan html2canvas (~200KB) di-import SECARA DINAMIS di dalam
   fungsi pemakainya, BUKAN di top-level. Alasannya: jika di-import statik,
   keduanya tergabung ke chunk utama (index-*.js) yang jadi >2MB dan melebihi
   limit precache Workbox default 2 MiB → PWA build gagal.

   Dengan dynamic import, Vite otomatis memisah keduanya ke chunk terpisah
   (chunks/pdfjs-dist-*.js dan chunks/html2canvas-*.js) yang di-load on-demand
   HANYA saat user klik tombol "Export ke Gambar". Pengguna yang tidak pernah
   pakai fitur gambar tidak perlu download library ini sama sekali.
============================================================================ */

// Lazy-load pdfjs-dist — cache promise supaya modul hanya di-load sekali
let _pdfjsLibPromise = null;
async function getPdfjs() {
  if (!_pdfjsLibPromise) {
    _pdfjsLibPromise = import("pdfjs-dist").then((lib) => {
      // Set worker URL sekali saat library pertama kali di-load
      lib.GlobalWorkerOptions.workerSrc = pdfjsWorkerUrl;
      return lib;
    });
  }
  return _pdfjsLibPromise;
}

// Lazy-load html2canvas — sama, cache promise
let _html2canvasPromise = null;
async function getHtml2canvas() {
  if (!_html2canvasPromise) {
    _html2canvasPromise = import("html2canvas").then((m) => m.default || m);
  }
  return _html2canvasPromise;
}

/**
 * Konversi jsPDF doc → array of image data URLs (1 per halaman).
 *
 * @param {jsPDF} doc — instance jsPDF yang sudah di-render
 * @param {Object} opts
 * @param {number} opts.scale — 1 | 2 | 3 (default 2 untuk retina/print)
 * @param {"png"|"jpeg"} opts.format — default "png"
 * @param {number} opts.quality — 0..1 untuk jpeg (default 0.92)
 * @returns {Promise<Array<{dataUrl: string, width: number, height: number}>>}
 */
export async function pdfDocToImages(doc, opts = {}) {
  const scale = opts.scale || 2;
  const format = opts.format === "jpeg" ? "jpeg" : "png";
  const quality = opts.quality || 0.92;

  // Lazy-load pdfjs-dist (chunk terpisah, baru di-load saat fungsi ini dipanggil)
  const pdfjsLib = await getPdfjs();

  // jsPDF → ArrayBuffer → pdf.js load
  const blob = doc.output("blob");
  const arrayBuffer = await blob.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  const images = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const ctx = canvas.getContext("2d");

    // PDF bisa punya transparan — isi putih dulu supaya JPG tidak hitam
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    await page.render({ canvasContext: ctx, viewport }).promise;

    images.push({
      dataUrl: canvas.toDataURL(`image/${format}`, quality),
      width: canvas.width,
      height: canvas.height,
    });
  }
  return images;
}

/**
 * Capture HTML element → array berisi 1 image (html2canvas tidak paginate).
 *
 * @param {HTMLElement} element
 * @param {Object} opts
 * @param {number} opts.scale — default 2
 * @param {"png"|"jpeg"} opts.format — default "png"
 * @param {number} opts.quality — default 0.92
 * @param {string} opts.backgroundColor — default "#FFFFFF"
 * @returns {Promise<Array<{dataUrl: string, width: number, height: number}>>}
 */
export async function htmlToImages(element, opts = {}) {
  const scale = opts.scale || 2;
  const format = opts.format === "jpeg" ? "jpeg" : "png";
  const quality = opts.quality || 0.92;
  const backgroundColor = opts.backgroundColor || "#FFFFFF";

  // Lazy-load html2canvas (chunk terpisah, baru di-load saat fungsi ini dipanggil)
  const html2canvas = await getHtml2canvas();

  const canvas = await html2canvas(element, {
    scale,
    backgroundColor,
    useCORS: true,
    logging: false,
    windowWidth: element.scrollWidth,
    windowHeight: element.scrollHeight,
  });

  return [{
    dataUrl: canvas.toDataURL(`image/${format}`, quality),
    width: canvas.width,
    height: canvas.height,
  }];
}

/**
 * Stitch beberapa gambar jadi 1 canvas panjang vertikal.
 * Dipakai untuk merging multi-page PDF jadi 1 file gambar (kasus 2 halaman).
 *
 * @param {Array<{dataUrl, width, height}>} images
 * @param {Object} opts — { format, quality, gap } (gap default 0)
 * @returns {Promise<{dataUrl: string, width: number, height: number}>}
 */
export async function stitchImagesVertically(images, opts = {}) {
  const format = opts.format === "jpeg" ? "jpeg" : "png";
  const quality = opts.quality || 0.92;
  const gap = opts.gap || 0;

  // Load semua gambar sebagai HTMLImageElement
  const loaded = await Promise.all(images.map((img) => new Promise((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve({ img: i, width: img.width, height: img.height });
    i.onerror = reject;
    i.src = img.dataUrl;
  })));

  const maxWidth = Math.max(...loaded.map((l) => l.width));
  const totalHeight = loaded.reduce((sum, l) => sum + l.height, 0) + gap * (loaded.length - 1);

  const canvas = document.createElement("canvas");
  canvas.width = maxWidth;
  canvas.height = totalHeight;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  let y = 0;
  for (const { img, width, height } of loaded) {
    // Center horizontally jika lebarnya beda
    const x = Math.floor((maxWidth - width) / 2);
    ctx.drawImage(img, x, y, width, height);
    y += height + gap;
  }

  return {
    dataUrl: canvas.toDataURL(`image/${format}`, quality),
    width: canvas.width,
    height: canvas.height,
  };
}

/**
 * Trigger download 1 file gambar dari data URL.
 */
export function downloadImage(dataUrl, filename) {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

/**
 * Trigger download N file gambar berurutan dengan delay antar download
 * supaya browser tidak memblokir (kebijakan multi-download).
 *
 * @param {Array<{dataUrl}>} images
 * @param {string} baseFilename — tanpa ekstensi
 * @param {string} ext — "png" atau "jpg"
 */
export async function downloadImagesSequential(images, baseFilename, ext) {
  for (let i = 0; i < images.length; i++) {
    const filename = images.length === 1
      ? `${baseFilename}.${ext}`
      : `${baseFilename}-hal${i + 1}.${ext}`;
    downloadImage(images[i].dataUrl, filename);
    // Delay 400ms antar download — cukup untuk Chrome/Firefox/Safari tidak block
    if (i < images.length - 1) {
      await new Promise((r) => setTimeout(r, 400));
    }
  }
}

/**
 * Strategy output otomatis berdasarkan jumlah halaman:
 * - 1 halaman → 1 file langsung
 * - 2 halaman → 1 file panjang (stitching vertikal)
 * - 3+ halaman → N file terpisah (sequential download)
 *
 * @param {Array<{dataUrl, width, height}>} images
 * @param {string} baseFilename — tanpa ekstensi
 * @param {"png"|"jpeg"} format
 */
export async function downloadImagesSmart(images, baseFilename, format) {
  const ext = format === "jpeg" ? "jpg" : "png";

  if (images.length === 1) {
    downloadImage(images[0].dataUrl, `${baseFilename}.${ext}`);
    return;
  }

  if (images.length === 2) {
    const stitched = await stitchImagesVertically(images, { format });
    downloadImage(stitched.dataUrl, `${baseFilename}.${ext}`);
    return;
  }

  // 3+ halaman
  await downloadImagesSequential(images, baseFilename, ext);
}

/* ============================================================================
   HELPER: Render React component ke DOM tersembunyi lalu capture.
   Dipakai untuk "Excel sebagai Gambar" — kita render ExcelReportHtml
   ke div off-screen, capture pakai html2canvas, lalu cleanup.
============================================================================ */

import { createRoot } from "react-dom/client";

/**
 * Render React element ke container off-screen, tunggu settle, lalu capture.
 *
 * @param {React.ReactElement} element — element React yang akan dirender
 * @param {Object} captureOpts — opsi untuk htmlToImages (scale, format, quality)
 * @returns {Promise<Array<{dataUrl, width, height}>>}
 */
export async function renderAndCapture(element, captureOpts = {}) {
  // 1. Buat container off-screen. Pakai position:fixed + left:-99999px BUKAN
  //    display:none — html2canvas tidak bisa mengukur layout dari element
  //    display:none. Kita butuh layout sungguhan.
  const container = document.createElement("div");
  container.style.cssText = "position:fixed; left:-99999px; top:0; z-index:-1;";
  document.body.appendChild(container);

  try {
    // 2. Render React ke container
    const root = createRoot(container);
    await new Promise((resolve) => {
      root.render(element);
      // Beri waktu untuk layout + font load. 2 frame cukup untuk React commit.
      requestAnimationFrame(() => requestAnimationFrame(resolve));
    });

    // 3. Tunggu font & gambar selesai load (html2canvas bisa tangkap teks
    //    dengan font salah kalau belum loaded)
    if (document.fonts && document.fonts.ready) {
      await document.fonts.ready;
    }
    // Beri sedikit delay tambahan untuk safety
    await new Promise((r) => setTimeout(r, 50));

    // 4. Capture
    const images = await htmlToImages(container, captureOpts);
    return images;
  } finally {
    // 5. Cleanup — pastikan container dihapus walau capture gagal
    container.remove();
  }
}
