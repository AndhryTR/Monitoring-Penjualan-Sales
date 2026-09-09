import { useEffect, useRef, useState } from "react";
import { computeAggregates, matchFocus } from "../utils/aggregation.js";


function reviveWorkerValue(value) {
  if (Array.isArray(value)) return value.map(reviveWorkerValue);
  if (value && typeof value === "object") {
    if (value.__workerType === "Map") {
      return new Map(value.value.map(([key, item]) => [key, reviveWorkerValue(item)]));
    }
    if (value.__workerType === "Set") return new Set(value.value.map(reviveWorkerValue));
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, reviveWorkerValue(item)]));
  }
  return value;
}

// Structured clone tidak dapat mengirim function predicate. Hidupkan kembali
// predicate setelah angka/array hasil aggregation tiba di UI thread.
function hydratePredicates(agg) {
  const result = reviveWorkerValue(agg);
  (result.bySales || []).forEach((sales) => {
    sales.predicate = (row) => row.salesCode === sales.code;
    (sales.groups || []).forEach((group) => {
      group.predicate = (row) => row.salesCode === sales.code && row.group === group.name;
    });
    (sales.focus || []).forEach((focus) => {
      focus.predicate = (row) => row.salesCode === sales.code && matchFocus(row, focus);
    });
  });
  (result.byGroup || []).forEach((group) => {
    group.predicate = (row) => row.group === group.name;
  });
  (result.focusRows || []).forEach((focus) => {
    focus.predicate = (row) => row.salesCode === focus.salesCode && matchFocus(row, focus);
  });
  (result.focusGroupRows || []).forEach((group) => {
    group.predicate = (row) => row.salesCode === group.salesCode && row.group === group.name;
  });
  (result.alerts || []).forEach((alert) => {
    if (alert.type === "sales") {
      alert.predicate = (row) => row.salesCode === alert.salesCode;
    } else if (alert.type === "focus") {
      alert.predicate = (row) => row.salesCode === alert.salesCode && matchFocus(row, alert);
    }
  });
  return result;
}

function addPredicateMetadata(agg) {
  // Worker output alerts need metadata because the original alert predicate is
  // intentionally omitted before postMessage().
  (agg.bySales || []).forEach((sales) => {
    (sales.focus || []).forEach((focus) => {
      focus.salesCode = sales.code;
      focus.keyword ??= focus.name;
    });
  });
  (agg.focusRows || []).forEach((focus) => {
    const sales = (agg.bySales || []).find((item) => item.code === focus.salesCode);
    const source = sales?.focus?.find((item) => item.name === focus.name);
    if (source) {
      focus.keyword = source.keyword;
      focus.matchType = source.matchType;
    }
  });
  (agg.alerts || []).forEach((alert) => {
    const sales = (agg.bySales || []).find((item) => item.name === alert.title || item.code === alert.salesCode);
    if (sales) {
      alert.salesCode = sales.code;
      if (alert.type === "focus") {
        const focus = sales.focus.find((item) => `${sales.name} — ${item.name}` === alert.title);
        if (focus) {
          alert.keyword = focus.keyword;
          alert.matchType = focus.matchType;
        }
      }
    }
  });
  return agg;
}

export function useAggregatesWorker(rows, targets, filters, workDays) {
  const requestIdRef = useRef(0);
  const workerRef = useRef(null);
  const [state, setState] = useState(() => ({
    loading: true,
    error: null,
    value: computeAggregates([], targets, filters, workDays),
  }));

  useEffect(() => {
    const requestId = ++requestIdRef.current;
    const worker = new Worker(new URL("../workers/aggregation.worker.js", import.meta.url), { type: "module" });
    workerRef.current = worker;
    setState((prev) => ({ ...prev, loading: true, error: null }));

    worker.onmessage = ({ data }) => {
      if (data.requestId !== requestId || requestId !== requestIdRef.current) return;
      if (data.error) {
        setState((prev) => ({ ...prev, loading: false, error: data.error }));
        return;
      }
      const hydrated = hydratePredicates(addPredicateMetadata(data.result));
      setState({ loading: false, error: null, value: hydrated });
    };
    worker.onerror = (event) => {
      if (requestId !== requestIdRef.current) return;
      console.error("Aggregation Worker gagal:", event.error || event.message);
      // Fallback menjaga app tetap bisa dipakai bila browser memblokir Worker.
      setState({ loading: false, error: event.message || "Worker gagal", value: computeAggregates(rows, targets, filters, workDays) });
    };
    worker.postMessage({ requestId, rows, targets, filters, workDays });

    return () => {
      worker.onmessage = null;
      worker.onerror = null;
      worker.terminate();
      if (workerRef.current === worker) workerRef.current = null;
    };
  }, [rows, targets, filters, workDays]);

  return { ...state.value, aggregationLoading: state.loading, aggregationError: state.error };
}
