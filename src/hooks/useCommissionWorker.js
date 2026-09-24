import { useEffect, useRef, useState, useMemo } from "react";
import { computeAllSalesCommissions } from "../utils/commissionEngine.js";

/**
 * Hook untuk menjalankan kalkulasi komisi sales bertingkat dan insentif produk fokus
 * di Web Worker agar iterasi rules atas baris transaksi tidak memblokir UI thread.
 *
 * @param {Array} salesList - Daftar sales atau baris agregat sales
 * @param {object} rules - Konfigurasi aturan komisi
 * @param {Array} transactionRows - Baris transaksi
 * @returns {{ commissions: Array, summary: object, commissionLoading: boolean, commissionError: string|null }}
 */
export function useCommissionWorker(salesList, rules, transactionRows) {
  const requestIdRef = useRef(0);
  const workerRef = useRef(null);

  const fallbackCompute = () => {
    return computeAllSalesCommissions(salesList, rules, transactionRows);
  };

  const [state, setState] = useState(() => ({
    loading: false,
    error: null,
    data: fallbackCompute(),
  }));

  useEffect(() => {
    if (!salesList || !salesList.length) {
      setState({
        loading: false,
        error: null,
        data: fallbackCompute(),
      });
      return;
    }

    let worker = workerRef.current;
    if (!worker) {
      try {
        worker = new Worker(
          new URL("../workers/commission.worker.js", import.meta.url),
          { type: "module" }
        );
        workerRef.current = worker;
      } catch (err) {
        console.warn("Gagal inisialisasi Commission Worker, fallback synchronous:", err);
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
      console.error("Commission Worker gagal:", event.error || event.message);
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
      salesList,
      rules,
      transactionRows,
    });
  }, [salesList, rules, transactionRows]);

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
      commissions: state.data.commissions,
      summary: state.data.summary,
      commissionLoading: state.loading,
      commissionError: state.error,
    }),
    [state.data, state.loading, state.error]
  );
}
