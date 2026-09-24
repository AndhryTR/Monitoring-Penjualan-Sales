import { useEffect, useRef, useState, useMemo } from "react";
import { computeSmartAlerts } from "../utils/smartAlerts.js";
import { matchFocus } from "../utils/aggregation.js";

/**
 * Siapkan payload agregasi yang ringan dan serializable untuk dikirim ke Worker.
 *
 * Mengapa tidak memakai deep traversal rekursif?
 * `agg.filteredRows` dapat berisi puluhan ribu baris transaksi. Melakukan deep cloning
 * atas puluhan ribu baris di main thread akan memblokir CPU. Baris transaksi mentah
 * sendiri sudah serializable (primitif). Yang mengandung function predicate hanyalah
 * `bySales` dan `focusRows` (puluhan objek), sehingga kita cukup membersihkan
 * predicate dari objek-objek tersebut secara presisi.
 */
function prepareWorkerAgg(agg) {
  if (!agg) return null;
  return {
    filteredRows: agg.filteredRows || [],
    meta: agg.meta || {},
    bySales: (agg.bySales || []).map((s) => {
      const { predicate: _p, ...sRest } = s;
      return {
        ...sRest,
        groups: (s.groups || []).map((g) => {
          const { predicate: _gp, ...gRest } = g;
          return gRest;
        }),
        focus: (s.focus || []).map((f) => {
          const { predicate: _fp, ...fRest } = f;
          return fRest;
        }),
      };
    }),
    focusRows: (agg.focusRows || []).map((f) => {
      const { predicate: _fp, ...fRest } = f;
      return fRest;
    }),
  };
}

/**
 * Hydrate predicate function ke setiap alert setelah hasil tiba dari Worker.
 * Structured clone tidak bisa membawa function — predicate di-strip di worker
 * dan direkonstruksi di sini menggunakan metadata alert:
 * - Outlet alert (churn & konsentrasi): filter salesCode + outletCode
 * - Product mix alert: filter salesCode + groupName
 * - Focus stagnant alert: filter salesCode + matchFocus(row, focusItem)
 * - Sales general alert: filter salesCode
 */
function hydrateAlertPredicates(alerts) {
  if (!Array.isArray(alerts)) return [];

  return alerts.map((alert) => {
    if (!alert.salesCode) {
      // Alert kategori data_quality atau global — tidak perlu predicate baris
      return { ...alert, predicate: null };
    }

    const { salesCode } = alert;

    if (alert.outletCode) {
      const { outletCode } = alert;
      return {
        ...alert,
        predicate: (r) => r.salesCode === salesCode && r.outletCode === outletCode,
      };
    }

    if (alert.groupName) {
      const { groupName } = alert;
      return {
        ...alert,
        predicate: (r) => r.salesCode === salesCode && r.group === groupName,
      };
    }

    if (alert.focusName || alert.category === "stagnant") {
      const focusItem = {
        name: alert.focusName || alert.title,
        keyword: alert.focusKeyword || alert.focusName,
        matchType: alert.focusMatchType || "contains",
      };
      return {
        ...alert,
        predicate: (r) => r.salesCode === salesCode && matchFocus(r, focusItem),
      };
    }

    return {
      ...alert,
      predicate: (r) => r.salesCode === salesCode,
    };
  });
}

/**
 * Hook untuk menjalankan computeSmartAlerts() di Web Worker agar tidak
 * memblokir UI thread saat menghitung 13 aturan deteksi anomali.
 *
 * @param {object} agg - Objek agregasi dari useAggregatesWorker
 * @param {Array}  targets - Array target penjualan
 * @param {number} workDays - Jumlah hari kerja
 * @param {Array}  dataQualityNotes - Catatan kualitas data
 * @returns {{ alerts: Array, smartAlertsLoading: boolean, smartAlertsError: string|null }}
 */
export function useSmartAlertsWorker(agg, targets, workDays, dataQualityNotes) {
  const requestIdRef = useRef(0);
  const workerRef = useRef(null);
  const [state, setState] = useState(() => ({
    loading: false,
    error: null,
    alerts: [],
  }));

  useEffect(() => {
    // Jangan jalankan kalau agg belum ada data transaksi
    if (!agg || !agg.filteredRows || !agg.filteredRows.length) {
      setState({ loading: false, error: null, alerts: [] });
      return;
    }

    let worker = workerRef.current;
    if (!worker) {
      try {
        worker = new Worker(
          new URL("../workers/smartAlerts.worker.js", import.meta.url),
          { type: "module" }
        );
        workerRef.current = worker;
      } catch (err) {
        console.warn(
          "Gagal inisialisasi SmartAlerts Worker, fallback ke synchronous:",
          err
        );
        setState({
          loading: false,
          error: null,
          alerts: computeSmartAlerts({
            agg,
            _targets: targets,
            workDays,
            dataQualityNotes,
          }),
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
        alerts: hydrateAlertPredicates(data.alerts),
      });
    };

    worker.onerror = (event) => {
      if (requestId !== requestIdRef.current) return;
      console.error("SmartAlerts Worker gagal:", event.error || event.message);
      setState({
        loading: false,
        error: event.message || "Worker gagal",
        alerts: computeSmartAlerts({
          agg,
          _targets: targets,
          workDays,
          dataQualityNotes,
        }),
      });
      if (workerRef.current === worker) {
        try {
          worker.terminate();
        } catch {
          /* ignore */
        }
        workerRef.current = null;
      }
    };

    worker.postMessage({
      requestId,
      agg: prepareWorkerAgg(agg),
      targets,
      workDays,
      dataQualityNotes,
    });
  }, [agg, targets, workDays, dataQualityNotes]);

  // Terminate worker saat hook unmount
  useEffect(() => {
    return () => {
      if (workerRef.current) {
        try {
          workerRef.current.terminate();
        } catch {
          /* ignore */
        }
        workerRef.current = null;
      }
    };
  }, []);

  return useMemo(
    () => ({
      alerts: state.alerts,
      smartAlertsLoading: state.loading,
      smartAlertsError: state.error,
    }),
    [state.alerts, state.loading, state.error]
  );
}
