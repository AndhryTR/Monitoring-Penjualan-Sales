import { computeOutletAnalysis } from "../utils/aggregation.js";
import { computeParetoClassification } from "../utils/paretoEngine.js";

self.onmessage = ({ data }) => {
  try {
    const analysis = computeOutletAnalysis(data.rows, data.meta, data.thresholds);
    const pareto = computeParetoClassification(analysis.list);
    self.postMessage({
      requestId: data.requestId,
      result: {
        list: analysis.list,
        summary: analysis.summary,
        outletsWithPareto: pareto.outletsWithPareto,
        paretoSummary: pareto.paretoSummary,
      },
    });
  } catch (error) {
    self.postMessage({
      requestId: data.requestId,
      error: error?.message || String(error),
    });
  }
};
