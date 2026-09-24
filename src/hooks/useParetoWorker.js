import { useEffect, useRef, useState, useMemo } from "react";
import { computeOutletAnalysis } from "../utils/aggregation.js";
import { computeParetoClassification } from "../utils/paretoEngine.js";

/**
 * Hook untuk menjalankan kalkulasi Outlet Analysis dan Pareto Classification
 * di Web Worker agar proses sorting dan segmentasi outlet besar tidak
 * memblokir UI thread.
 *
 * @param {Array} rows - agg.filteredRows
 * @param {object} meta - agg.meta
 * @param {object} thresholds - thresholds objek
 * @returns {{ list: Array, summary: object, outletsWithPareto: Array, paretoSummary: object, loading: boolean, error: string|null }}
 */
export function useParetoWorker(rows, meta, thresholds) {
  const requestIdRef = useRef(0);
  const workerRef = useRef(null);

  const fallbackCompute = () => {
    if (!rows || !rows.length) {
      return {
        list: [],
        summary: { total: 0, active: 0, atRisk: 0, dormant: 0 },
        outletsWithPareto: [],
        paretoSummary: null,
      };
    }
    const analysis = computeOutletAnalysis(rows, meta, thresholds);
    const pareto = computeParetoClassification(analysis.list);
    return {
      list: analysis.list,
      summary: analysis.summary,
      outletsWithPareto: pareto.outletsWithPareto,
      paretoSummary: pareto.paretoSummary,
    };
  };

  const [state, setState] = useState(() => ({
    loading: false,
    error: null,
    data: fallbackCompute(),
  }));

  useEffect(() => {
    if (!rows || !rows.length) {
      setState({
        loading: false,
        error: null,
        data: {
          list: [],
          summary: { total: 0, active: 0, atRisk: 0, dormant: 0 },
          outletsWithPareto: [],
          paretoSummary: null,
        },
      });
      return;
    }

    let worker = workerRef.current;
    if (!worker) {
      try {
        worker = new Worker(
          new URL("../workers/pareto.worker.js", import.meta.url),
          { type: "module" }
        );
        workerRef.current = worker;
      } catch (err) {
        console.warn("Gagal inisialisasi Pareto Worker, fallback synchronous:", err);
        setState({
          loading: false,
          error: null,
          data: fallbackCompute(),
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
        data: data.result,
      });
    };

    worker.onerror = (event) => {
      if (requestId !== requestIdRef.current) return;
      console.error("Pareto Worker gagal:", event.error || event.message);
      setState({
        loading: false,
        error: event.message || "Worker gagal",
        data: fallbackCompute(),
      });
      if (workerRef.current === worker) {
        try { worker.terminate(); } catch { /* ignore */ }
        workerRef.current = null;
      }
    };

    worker.postMessage({
      requestId,
      rows,
      meta,
      thresholds,
    });
  }, [rows, meta, thresholds]);

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
      list: state.data.list,
      summary: state.data.summary,
      outletsWithPareto: state.data.outletsWithPareto,
      paretoSummary: state.data.paretoSummary,
      paretoLoading: state.loading,
      paretoError: state.error,
    }),
    [state.data, state.loading, state.error]
  );
}
