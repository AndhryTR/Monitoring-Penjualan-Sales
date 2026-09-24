import { useEffect, useRef, useState, useMemo } from "react";
import { computePeriodAggs } from "../utils/comparison.js";

function reviveWorkerValue(value) {
  if (Array.isArray(value)) return value.map(reviveWorkerValue);
  if (value && typeof value === "object") {
    if (value.__workerType === "Map") {
      return new Map(value.value.map(([key, item]) => [key, reviveWorkerValue(item)]));
    }
    if (value.__workerType === "Set") {
      return new Set(value.value.map(reviveWorkerValue));
    }
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, reviveWorkerValue(item)])
    );
  }
  return value;
}

/**
 * Hook untuk menjalankan kalkulasi multi-periode comparison di Web Worker.
 *
 * @param {Array} rawRows - Seluruh baris transaksi
 * @param {Array} targets - Konfigurasi target sales
 * @param {Array} salesCodes - Kode sales yang difilter
 * @param {Array} periods - Rentang periode yang dibandingkan
 * @param {number} workDays - Hari kerja efektif
 * @returns {{ periodAggs: Array, loading: boolean, error: string|null }}
 */
export function useComparisonWorker(rawRows, targets, salesCodes, periods, workDays) {
  const requestIdRef = useRef(0);
  const workerRef = useRef(null);
  const [state, setState] = useState(() => ({
    loading: false,
    error: null,
    periodAggs: [],
  }));

  useEffect(() => {
    if (!periods || !periods.length || !rawRows || !rawRows.length) {
      setState({ loading: false, error: null, periodAggs: [] });
      return;
    }

    let worker = workerRef.current;
    if (!worker) {
      try {
        worker = new Worker(
          new URL("../workers/comparison.worker.js", import.meta.url),
          { type: "module" }
        );
        workerRef.current = worker;
      } catch (err) {
        console.warn("Gagal inisialisasi Comparison Worker, fallback synchronous:", err);
        setState({
          loading: false,
          error: null,
          periodAggs: computePeriodAggs(rawRows, targets, salesCodes, periods, workDays),
        });
        return;
      }
    }

    const requestId = ++requestIdRef.current;
    setState((prev) => ({ ...prev, loading: true, error: null }));

    worker.onmessage = ({ data }) => {
      if (!data || data.requestId !== requestIdRef.current) return;
      if (data.error) {
        setState((prev) => ({ ...prev, loading: false, error: data.error }));
        return;
      }
      setState({
        loading: false,
        error: null,
        periodAggs: reviveWorkerValue(data.result),
      });
    };

    worker.onerror = (event) => {
      if (requestId !== requestIdRef.current) return;
      console.error("Comparison Worker gagal:", event.error || event.message);
      setState({
        loading: false,
        error: event.message || "Worker gagal",
        periodAggs: computePeriodAggs(rawRows, targets, salesCodes, periods, workDays),
      });
      if (workerRef.current === worker) {
        try { worker.terminate(); } catch { /* ignore */ }
        workerRef.current = null;
      }
    };

    worker.postMessage({
      requestId,
      rawRows,
      targets,
      salesCodes,
      periods,
      workDays,
    });
  }, [rawRows, targets, salesCodes, periods, workDays]);

  useEffect(() => {
    return () => {
      if (workerRef.current) {
        try { workerRef.current.terminate(); } catch { /* ignore */ }
        workerRef.current = null;
      }
    };
  }, []);

  return useMemo(
    () => ({
      periodAggs: state.periodAggs,
      comparisonLoading: state.loading,
      comparisonError: state.error,
    }),
    [state.periodAggs, state.loading, state.error]
  );
}
