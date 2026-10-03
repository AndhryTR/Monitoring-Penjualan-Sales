import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { computeAllSalesCommissions } from "../utils/commissionEngine.js";

const DEFAULT_SUMMARY = {
  totalPayout: 0,
  totalValueCommission: 0,
  totalAoBonus: 0,
  totalFocusBonus: 0,
  qualifiedSalesCount: 0,
  totalSalesCount: 0,
  avgPayout: 0,
};

/**
 * Hook untuk menjalankan kalkulasi komisi sales bertingkat dan insentif produk fokus
 * di Web Worker agar iterasi rules atas baris transaksi tidak memblokir UI thread.
 *
 * @param {Array} salesList - Daftar sales atau baris agregat sales (agg.bySales)
 * @param {object} rules - Konfigurasi aturan komisi
 * @param {Array} transactionRows - Baris transaksi (agg.filteredRows)
 * @returns {{ commissions: Array, summary: object, commissionLoading: boolean, commissionError: string|null }}
 */
export function useCommissionWorker(salesList, rules, transactionRows) {
  const requestIdRef = useRef(0);
  const workerRef = useRef(null);

  // Sanitasi salesList agar TIDAK membawa fungsi (seperti predicate) yang tidak dapat
  // di-clone oleh algoritma structuredClone pada postMessage Web Worker.
  const cleanSalesList = useMemo(() => {
    if (!Array.isArray(salesList)) return [];
    return salesList.map((s) => ({
      code: s.code || s.salesCode || "",
      salesCode: s.code || s.salesCode || "",
      name: s.name || s.salesName || "",
      salesName: s.name || s.salesName || "",
      realisasiValue: Number(s.realisasiValue ?? s.value ?? 0),
      targetValue: Number(s.targetValue ?? 0),
      ach: s.ach !== null && s.ach !== undefined ? Number(s.ach) : null,
      realisasiAo: Number(s.realisasiAo ?? s.ao ?? 0),
      targetAo: Number(s.targetAo ?? 0),
      achAo: s.achAo !== null && s.achAo !== undefined ? Number(s.achAo) : null,
      focus: Array.isArray(s.focus)
        ? s.focus.map((f) => ({
            name: f.name || "",
            target: Number(f.target) || 0,
            keyword: f.keyword || "",
            matchType: f.matchType || "",
          }))
        : [],
      focusGroups: Array.isArray(s.focusGroups)
        ? s.focusGroups.map((fg) => ({
            name: fg.name || "",
            targetAo: Number(fg.targetAo) || 0,
            targetValue: Number(fg.targetValue) || 0,
          }))
        : [],
    }));
  }, [salesList]);

  // Sanitasi baris transaksi agar hanya properti yang dibutuhkan yang ditransfer
  const cleanTransactionRows = useMemo(() => {
    if (!Array.isArray(transactionRows)) return [];
    return transactionRows.map((r) => ({
      salesCode: r.salesCode || "",
      group: r.group || "",
      outletCode: r.outletCode || "",
      productName: r.productName || "",
      productCode: r.productCode || "",
      qty: Number(r.qty) || 0,
      qtyKarton: r.qtyKarton,
      unit: r.unit || "",
      konv: Number(r.konv) || 0,
    }));
  }, [transactionRows]);

  const fallbackCompute = useCallback(() => {
    try {
      return computeAllSalesCommissions(cleanSalesList, rules, cleanTransactionRows);
    } catch (err) {
      console.warn("Gagal fallbackCompute komisi synchronous:", err);
      return { commissions: [], summary: DEFAULT_SUMMARY };
    }
  }, [cleanSalesList, rules, cleanTransactionRows]);

  const [state, setState] = useState(() => ({
    loading: false,
    error: null,
    data: fallbackCompute(),
  }));

  useEffect(() => {
    if (!cleanSalesList || !cleanSalesList.length) {
      setState({
        loading: false,
        error: null,
        data: { commissions: [], summary: DEFAULT_SUMMARY },
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
        console.warn("Commission Worker error:", data.error);
        setState({
          loading: false,
          error: data.error,
          data: fallbackCompute(),
        });
        return;
      }
      setState({
        loading: false,
        error: null,
        data: data.result || { commissions: [], summary: DEFAULT_SUMMARY },
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

    try {
      worker.postMessage({
        requestId,
        salesList: cleanSalesList,
        rules,
        transactionRows: cleanTransactionRows,
      });
    } catch (err) {
      console.warn("Gagal postMessage ke Commission Worker, fallback synchronous:", err);
      setState({
        loading: false,
        error: err.message,
        data: fallbackCompute(),
      });
    }
  }, [cleanSalesList, rules, cleanTransactionRows, fallbackCompute]);

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
      commissions: state.data?.commissions || [],
      summary: state.data?.summary || DEFAULT_SUMMARY,
      commissionLoading: state.loading,
      commissionError: state.error,
    }),
    [state.data, state.loading, state.error]
  );
}
