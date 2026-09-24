import { useCallback, useEffect, useRef, useState } from 'react';
import { parseMasterExcel } from '../utils/masterImport.js';

/**
 * Hook untuk parsing file Excel master (sales + target 3-sheet) menggunakan
 * Web Worker agar tidak memblokir UI thread saat parsing XLSX besar.
 *
 * Pola identik dengan useExcelParseWorker:
 * - ArrayBuffer dibaca di main thread (FileReader)
 * - Buffer dikirim ke worker via postMessage
 * - Worker parse XLSX dan kirim hasil kembali
 * - Fallback synchronous bila Worker tidak tersedia
 *
 * @returns {{ parseMaster: (file: File) => Promise<{targets, stats, errors}>, loading: boolean, error: string|null }}
 */
export function useMasterImportWorker() {
  const workerRef = useRef(null);
  const requestIdRef = useRef(0);
  const pendingRef = useRef(new Map());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  /**
   * Inisialisasi worker satu kali dan simpan ke ref.
   * Dipanggil lazy — baru dibuat saat pertama kali parseMaster() dipanggil.
   */
  const ensureWorker = useCallback(() => {
    if (workerRef.current) return workerRef.current;

    // URL literal di sini diperlukan agar Vite dapat mendeteksi dan membundle
    // file worker sebagai chunk terpisah saat build production.
    const worker = new Worker(
      new URL('../workers/masterImport.worker.js', import.meta.url),
      { type: 'module' }
    );

    worker.onmessage = ({ data }) => {
      const pending = pendingRef.current.get(data.requestId);
      if (!pending) return;
      pendingRef.current.delete(data.requestId);
      if (data.type === 'error') pending.reject(new Error(data.error));
      else pending.resolve(data.result);
    };

    worker.onerror = (event) => {
      const err = new Error(event.message || 'Master import worker gagal');
      // Reject semua promise yang sedang menunggu
      pendingRef.current.forEach(({ reject }) => reject(err));
      pendingRef.current.clear();
      worker.terminate();
      // Hapus referensi agar ensureWorker() bisa membuat instance baru bila
      // dipanggil kembali setelah error
      if (workerRef.current === worker) workerRef.current = null;
    };

    workerRef.current = worker;
    return worker;
  }, []);

  /**
   * Parse file Excel master menggunakan Web Worker.
   *
   * Bila worker gagal diinisialisasi atau mengirimkan error, fungsi ini
   * otomatis fallback ke parseMasterExcel() di main thread.
   *
   * @param {File} file - File .xlsx dari input type="file"
   * @returns {Promise<{ targets: Target[], stats: object, errors: Array }>}
   */
  const parseMaster = useCallback(
    async (file) => {
      setLoading(true);
      setError(null);

      try {
        // Langkah 1: Baca ArrayBuffer di main thread via native Web API
        const buffer = await file.arrayBuffer();

        // Langkah 2: Kirim buffer ke worker dan tunggu hasilnya
        const requestId = ++requestIdRef.current;
        const result = await new Promise((resolve, reject) => {
          pendingRef.current.set(requestId, { resolve, reject });
          try {
            ensureWorker().postMessage({ requestId, buffer });
          } catch (postError) {
            pendingRef.current.delete(requestId);
            reject(postError);
          }
        });

        setLoading(false);
        return result;
      } catch (workerError) {
        console.warn('Master import worker gagal, fallback main thread:', workerError);
        try {
          const result = await parseMasterExcel(file);
          setLoading(false);
          return result;
        } catch (fallbackError) {
          const msg = fallbackError?.message || String(fallbackError);
          setError(msg);
          setLoading(false);
          throw fallbackError;
        }
      }
    },
    [ensureWorker]
  );

  // Cleanup: terminate worker saat komponen unmount agar tidak ada memory leak
  useEffect(
    () => () => {
      workerRef.current?.terminate();
      workerRef.current = null;
      pendingRef.current.clear();
    },
    []
  );

  return { parseMaster, loading, error };
}
