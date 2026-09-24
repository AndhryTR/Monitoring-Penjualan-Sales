import {
  computeCurrentStock,
  computeSalesByProduct,
  computeStockMetrics,
  computeStockSummary,
} from "../utils/stockEngine.js";

self.onmessage = ({ data }) => {
  try {
    const { activeSnapshot, transactions, daysCount } = data;
    if (!activeSnapshot || !activeSnapshot.products) {
      self.postMessage({
        requestId: data.requestId,
        result: {
          currentStockEntries: [],
          salesByProduct: {},
          stockMetrics: [],
          stockSummary: null,
        },
      });
      return;
    }

    const currentStock = computeCurrentStock(activeSnapshot, transactions);
    const salesByProduct = computeSalesByProduct(transactions, daysCount, null);
    const stockMetrics = computeStockMetrics(currentStock, salesByProduct, daysCount);
    const stockSummary = computeStockSummary(currentStock, salesByProduct, daysCount);

    self.postMessage({
      requestId: data.requestId,
      result: {
        currentStockEntries: Array.from(currentStock.entries()),
        salesByProduct,
        stockMetrics,
        stockSummary,
      },
    });
  } catch (error) {
    self.postMessage({
      requestId: data.requestId,
      error: error?.message || String(error),
    });
  }
};
