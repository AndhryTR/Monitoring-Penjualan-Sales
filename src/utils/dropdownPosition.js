/* ============================================================================
   DROPDOWN POSITIONING
   Helper bersama untuk dropdown/menu yang di-render lewat portal (perlu
   hitung posisi manual, tidak bisa mengandalkan CSS position:absolute biasa
   karena keluar dari parent stacking context). Sebelumnya logika ini
   terduplikasi 3x (FilterBar x2, MultiSelect x1) — dirapikan jadi satu di
   sini supaya kalau nilai gap/margin/estimasi tinggi perlu disesuaikan,
   cukup diubah di satu tempat.
============================================================================ */

/**
 * Hitung posisi vertikal (top) untuk dropdown yang mengambang di bawah tombol
 * trigger-nya — otomatis "flip" ke atas tombol kalau ruang di bawah tidak
 * cukup (mis. tombol dekat bagian bawah layar / di dalam bottom-sheet mobile)
 * TAPI ruang di atas lebih luas dari ruang di bawah.
 *
 * @param {DOMRect} triggerRect - hasil getBoundingClientRect() dari tombol trigger
 * @param {number} contentHeight - estimasi tinggi konten dropdown (px)
 * @param {object} [opts]
 * @param {number} [opts.gap=8] - jarak antara tombol & dropdown
 * @param {number} [opts.margin=16] - jarak aman minimum ke tepi viewport
 * @returns {number} nilai `top` (px, relatif ke viewport) siap dipakai di style posisi fixed/absolute
 */
export function computeDropdownTop(triggerRect, contentHeight, opts = {}) {
  const { gap = 8, margin = 16 } = opts;
  const spaceBelow = window.innerHeight - triggerRect.bottom - margin;
  const spaceAbove = triggerRect.top - margin;
  if (spaceBelow < contentHeight && spaceAbove > spaceBelow) {
    return triggerRect.top - contentHeight - gap;
  }
  return triggerRect.bottom + gap;
}
