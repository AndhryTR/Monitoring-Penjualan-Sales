import { computePeriodAggs } from "../utils/comparison.js";

// Helper agar Map/Set dan objek hasil agregasi dapat melewati structured clone.
function serializable(value) {
  if (typeof value === "function") return undefined;
  if (Array.isArray(value)) return value.map(serializable);
  if (value instanceof Map) {
    return {
      __workerType: "Map",
      value: Array.from(value.entries()).map(([key, item]) => [key, serializable(item)]),
    };
  }
  if (value instanceof Set) {
    return {
      __workerType: "Set",
      value: Array.from(value.values()).map(serializable),
    };
  }
  if (value && typeof value === "object") {
    const result = {};
    Object.entries(value).forEach(([key, item]) => {
      const clean = serializable(item);
      if (clean !== undefined) result[key] = clean;
    });
    return result;
  }
  return value;
}

self.onmessage = ({ data }) => {
  try {
    const result = computePeriodAggs(
      data.rawRows,
      data.targets,
      data.salesCodes,
      data.periods,
      data.workDays
    );
    self.postMessage({ requestId: data.requestId, result: serializable(result) });
  } catch (error) {
    self.postMessage({
      requestId: data.requestId,
      error: error?.message || String(error),
    });
  }
};
