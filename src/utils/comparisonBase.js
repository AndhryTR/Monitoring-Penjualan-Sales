/* ============================================================================
   PEMBANDING GROWTH — fungsi murni untuk menghitung baseline & pertumbuhan
   dengan beberapa opsi pembanding (dipakai di tab Tren Periode & Perbandingan).

   Opsi baseMode:
     'prev'  : Periode sebelumnya  — baseline = titik data tersedia terakhir
               sebelum periode kini (perilaku default, setara "2 titik terakhir").
     'avg3'  : Rata-rata 3 bulan    — baseline = rata-rata 3 titik data tersedia
               terakhir sebelum periode kini.
     'avg6'  : Rata-rata 6 bulan    — baseline = rata-rata 6 titik data tersedia
               terakhir sebelum periode kini.
     'yoy'   : Bulan ini tahun lalu — baseline = titik data 12 posisi mundur
               dalam deret kronologis (butuh >= 12 titik).

   Konsisten dengan keputusan: menggunakan TITIK DATA TERSEDIA terakhir (opsi b),
   bukan bulan kalender — jadi kalau ada gap/bulan kosong, tetap memakai n titik
   data yang benar-benar ada sebelum periode kini.
============================================================================ */

// Rata-rata dari array (abaikan null/undefined). 0 kalau kosong.
function avgVals(arr) {
  const nums = (arr || []).filter((v) => v != null);
  if (!nums.length) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

/**
 * Hitung baseline + growth untuk deret nilai (value atau AO).
 * @param {Array<number|null>} series  nilai kronologis (tertua -> terbaru),
 *                                     null dianggap "missing" dan dilewati.
 * @param {string} baseMode  'prev' | 'avg3' | 'avg6' | 'yoy'
 * @returns {{ baseline: number|null, growth: number|null }}
 */
export function computeBaseGrowth(series, baseMode) {
  // Saring nilai yang benar-benar ada (skip null/missing).
  const vals = (series || []).filter((v) => v != null);
  if (vals.length < 2) return { baseline: null, growth: null };
  const current = vals[vals.length - 1];
  if (current == null) return { baseline: null, growth: null };

  let baseline = null;
  if (baseMode === 'prev') {
    baseline = vals[vals.length - 2];
  } else if (baseMode === 'avg3' || baseMode === 'avg6') {
    const n = baseMode === 'avg3' ? 3 : 6;
    // n titik sebelum periode kini — kalau data kurang, pakai semua yg ada.
    baseline = avgVals(vals.slice(Math.max(0, vals.length - 1 - n), vals.length - 1));
  } else if (baseMode === 'yoy') {
    // 12 bulan sebelumnya dalam deret tersedia; kalau krg, tak ada baseline.
    const idx = vals.length - 13;
    baseline = idx >= 0 ? vals[idx] : null;
  }

  if (baseline == null || baseline <= 0) return { baseline: baseline ?? null, growth: null };
  return { baseline, growth: (current - baseline) / baseline };
}

// Definisi opsi utk UI dropdown. `needs` = minimal titik data yg diperlukan.
export const COMPARISON_BASE_OPTIONS = [
  { key: 'prev', label: 'Periode sebelumnya', needs: 2 },
  { key: 'avg3', label: 'Rata-rata 3 bulan', needs: 2 },
  { key: 'avg6', label: 'Rata-rata 6 bulan', needs: 2 },
  { key: 'yoy', label: 'Sama bulan tahun lalu', needs: 13 },
];