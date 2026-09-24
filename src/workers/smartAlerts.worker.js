import { computeSmartAlerts } from "../utils/smartAlerts.js";

/**
 * Helper untuk strip function predicate sebelum postMessage.
 * Structured clone tidak bisa mengirim function.
 */
function stripPredicates(alerts) {
  return alerts.map((alert) => {
    const { predicate: _p, ...rest } = alert;
    return rest;
  });
}

self.onmessage = ({ data }) => {
  try {
    const alerts = computeSmartAlerts({
      agg: data.agg,
      _targets: data.targets,
      workDays: data.workDays,
      dataQualityNotes: data.dataQualityNotes,
    });
    self.postMessage({
      requestId: data.requestId,
      alerts: stripPredicates(alerts),
    });
  } catch (error) {
    self.postMessage({
      requestId: data.requestId,
      error: error?.message || String(error),
    });
  }
};
