import { useCallback, useRef, useState } from "react";
import { parseWorkbookBuffer } from "../utils/excelParse.js";

const workerUrl = new URL("../workers/excelParse.worker.js", import.meta.url);

/* ============================================================================
   useExcelParseWorker — parse Excel di Web Worker agar UI tidak freeze saat
   upload file besar. Baca file (ArrayBuffer) di main thread (cepat, I/O), kirim
   buffer ke worker via postMessage, worker parse + dedupe, balas hasil.

   `progress` (0-100) di-update real-time dari worker untuk progress bar.
   Fallback: kalau Worker blokir/gagal, pakai parseWorkbookBuffer langsung di
   main thread (tetap berfungsi — bufs sudah dibaca, tinggal parse).
============================================================================ */
export function useExcelParseWorker() {
  const workerRef = useRef(null);
  const reqIdRef = useRef(0);
  const pendingRef = useRef(new Map());
  const [progress, setProgress] = useState(0);

  const getWorker = useCallback(() => {
    if (!workerRef.current) {
      workerRef.current = new Worker(workerUrl, { type: "module" });
      workerRef.current.onmessage = ({ data }) => {
        if (data.progress !== undefined) {
          setProgress(data.progress);
          return;
        }
        const resolve = pendingRef.current.get(data.requestId);
        if (!resolve) return;
        pendingRef.current.delete(data.requestId);
        resolve(data.error ? { ok: false, error: data.error } : { ok: true, results: data.results });
      };
      workerRef.current.onerror = (e) => {
        pendingRef.current.forEach((reject) => reject({ ok: false, error: e.message || "worker crash" }));
        pendingRef.current.clear();
      };
    }
    return workerRef.current;
  }, []);

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
      const worker = getWorker();
      const requestId = ++reqIdRef.current;
      try {
        const res = await new Promise((resolve) => {
          pendingRef.current.set(requestId, resolve);
          worker.postMessage({ requestId, files: bufs.map((buffer, i) => ({ name: files[i].name, buffer })) });
        });
        setProgress(100);
        if (res.ok) return res.results;
        return bufs.map(parseWorkbookBuffer); // Worker error → fallback main thread
      } catch {
        setProgress(100);
        return bufs.map(parseWorkbookBuffer); // Worker crash → fallback main thread
      }
    },
    [getWorker, readAsArrayBuffer]
  );

  const dispose = useCallback(() => {
    workerRef.current?.terminate();
    workerRef.current = null;
    pendingRef.current.clear();
  }, []);

  return { parseFiles, dispose, progress };
}
