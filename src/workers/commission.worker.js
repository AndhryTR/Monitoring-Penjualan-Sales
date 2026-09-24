import { computeAllSalesCommissions } from "../utils/commissionEngine.js";

self.onmessage = ({ data }) => {
  try {
    const result = computeAllSalesCommissions(
      data.salesList,
      data.rules,
      data.transactionRows
    );
    self.postMessage({
      requestId: data.requestId,
      result,
    });
  } catch (error) {
    self.postMessage({
      requestId: data.requestId,
      error: error?.message || String(error),
    });
  }
};
