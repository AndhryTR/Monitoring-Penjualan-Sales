import { useCallback, useEffect, useRef, useState } from "react";
import { parseWorkbookBuffer } from "../utils/excelParse.js";

// URL worker dibuat langsung di constructor (bukan disimpan di const terpisah)
// supaya Vite mengenali dan membundle dependency worker saat production.

// Parser Excel dengan Web Worker production-safe. Vite membundle worker ini
// sebagai asset terpisah dan menyelesaikan import xlsx-js-style melalui browser
// mapping paket. Main thread hanya membaca File -> ArrayBuffer dan menerima hasil.
export function useExcelParseWorker() {
  const workerRef = useRef(null);
  const requestIdRef = useRef(0);
  const pendingRef = useRef(new Map());
  const [progress, setProgress] = useState(0);

  const ensureWorker = useCallback(() => {
    if (workerRef.current) return workerRef.current;
    const worker = new Worker(new URL("../workers/excelParse.worker.js", import.meta.url), { type: "module" });
    worker.onmessage = ({ data }) => {
      if (data.type === "progress") {
        setProgress(Math.max(0, Math.min(1, data.progress / 100)));
        return;
      }
      const pending = pendingRef.current.get(data.requestId);
      if (!pending) return;
      pendingRef.current.delete(data.requestId);
      if (data.type === "error") pending.reject(new Error(data.error));
      else pending.resolve(data.results);
    };
    worker.onerror = (event) => {
      const error = new Error(event.message || "Excel parser worker gagal");
      pendingRef.current.forEach(({ reject }) => reject(error));
      pendingRef.current.clear();
      worker.terminate();
      if (workerRef.current === worker) workerRef.current = null;
    };
    workerRef.current = worker;
    return worker;
  }, []);

  const readAsArrayBuffer = useCallback((file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => resolve(event.target.result);
    reader.onerror = () => reject(reader.error || new Error("File gagal dibaca"));
    reader.readAsArrayBuffer(file);
  }), []);

  const parseFiles = useCallback(async (files) => {
    setProgress(0);
    const buffers = await Promise.all(files.map(readAsArrayBuffer));
    const requestId = ++requestIdRef.current;

    try {
      const results = await new Promise((resolve, reject) => {
        pendingRef.current.set(requestId, { resolve, reject });
        try {
          // Jangan transfer ownership buffer. Jika worker gagal setelah postMessage,
          // fallback main-thread masih membutuhkan buffer yang sama.
          ensureWorker().postMessage({
            requestId,
            files: files.map((file, index) => ({ name: file.name, buffer: buffers[index] })),
          });
        } catch (error) {
          pendingRef.current.delete(requestId);
          reject(error);
        }
      });
      setProgress(1);
      return results;
    } catch (workerError) {
      console.warn("Excel parser worker gagal, fallback main thread:", workerError);
      const results = [];
      for (const buffer of buffers) {
        results.push(await parseWorkbookBuffer(buffer, (fraction) => setProgress(fraction)));
      }
      setProgress(1);
      return results;
    }
  }, [ensureWorker, readAsArrayBuffer]);

  useEffect(() => () => {
    workerRef.current?.terminate();
    workerRef.current = null;
    pendingRef.current.clear();
  }, []);

  return { parseFiles, progress };
}
