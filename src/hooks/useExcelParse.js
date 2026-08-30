import { useCallback, useState } from "react";
import { parseWorkbookBuffer } from "../utils/excelParse.js";

/* ============================================================================
   useExcelParse — parse Excel di MAIN THREAD dengan chunked batch + yield.
   Ini menghindari Web Worker (yang rapuh dengan xlsx CJS di production/Vercel/
   Tauri — dev jalan, production worker crash → fallback tanpa progress).

   Cara kerja:
   - Baca file ke ArrayBuffer (I/O cepat).
   - parseWorkbookBuffer: XLSX.parse struktur (1 blok), lalu loop baris dalam
     batch 2000, yield (setTimeout 0) antar batch → UI tetap responsif &
     progress real-time per batch.
   - `progress` (0-1) di-update tiap batch.
============================================================================ */
export function useExcelParse() {
  const [progress, setProgress] = useState(0);

  const readAsArrayBuffer = useCallback(
    (file) =>
      new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = reject;
        reader.readAsArrayBuffer(file);
      }),
    []
  );

  const parseFiles = useCallback(
    async (files) => {
      setProgress(0);
      const bufs = await Promise.all(files.map(readAsArrayBuffer));
      const results = [];
      // Progress per file: current file + pecahan dari semua file
      for (let fi = 0; fi < bufs.length; fi++) {
        const result = await parseWorkbookBuffer(bufs[fi], (frac) => {
          // frac sudah 0..1 dalam 1 file; kombinasi dengan file sebelumnya
          setProgress((fi + frac) / bufs.length);
        });
        results.push(result);
      }
      setProgress(1);
      return results;
    },
    [readAsArrayBuffer]
  );

  const dispose = useCallback(() => {}, []);

  return { parseFiles, dispose, progress };
}
