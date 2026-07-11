import { useMemo } from "react";

/* ============================================================================
   DATA QUALITY NOTES
   Kumpulan semua catatan kualitas data dari SELURUH data yang diupload (tidak
   terpengaruh filter yang sedang aktif di dashboard) — dipakai oleh halaman
   "Catatan Data". Dipisah dari SalesMonitoringApp.jsx sebagai hook pure-logic.
============================================================================ */
export function useDataQualityNotes(rawRows, targets, parseMeta) {
  return useMemo(() => {
    const targetCodes = new Set(targets.map((t) => t.code));
    const groupsBySalesCode = {};
    targets.forEach((t) => { groupsBySalesCode[t.code] = new Set(t.groups.map((g) => g.name)); });

    const unknownSalesMap = {};
    const unconvertibleMap = {};
    const unknownGroupMap = {};
    let missingDateCount = 0;

    rawRows.forEach((r) => {
      if (!r.date) missingDateCount++;

      if (r.salesCode && !targetCodes.has(r.salesCode)) {
        const key = r.salesCode;
        if (!unknownSalesMap[key]) unknownSalesMap[key] = { salesCode: key, salesName: r.salesName || "(tanpa nama)", rowCount: 0, value: 0 };
        unknownSalesMap[key].rowCount++;
        unknownSalesMap[key].value += r.value;
      }

      if (r.unconvertible) {
        const key = r.productCode || r.productName;
        if (!unconvertibleMap[key]) unconvertibleMap[key] = { productName: r.productName || key, unit: r.unit || "?", rowCount: 0, qty: 0 };
        unconvertibleMap[key].rowCount++;
        unconvertibleMap[key].qty += r.qty;
      }

      if (r.salesCode && targetCodes.has(r.salesCode) && r.group) {
        const known = groupsBySalesCode[r.salesCode];
        if (known && !known.has(r.group)) {
          const key = r.salesCode + "|" + r.group;
          if (!unknownGroupMap[key]) unknownGroupMap[key] = { salesCode: r.salesCode, salesName: r.salesName, group: r.group, rowCount: 0, value: 0 };
          unknownGroupMap[key].rowCount++;
          unknownGroupMap[key].value += r.value;
        }
      }
    });

    return {
      totalDataRows: parseMeta?.totalDataRows || 0,
      skippedBlankRows: parseMeta?.skippedBlankRows || 0,
      rowsWithMissingDate: parseMeta?.rowsWithMissingDate || 0,
      duplicateRowsRemoved: parseMeta?.duplicateRowsRemoved || 0,
      detectedFields: parseMeta?.detectedFields || [],
      missingFields: parseMeta?.missingFields || [],
      missingDateCount,
      unknownSales: Object.values(unknownSalesMap).sort((a, b) => b.value - a.value),
      unconvertibleProducts: Object.values(unconvertibleMap).sort((a, b) => b.rowCount - a.rowCount),
      unknownGroups: Object.values(unknownGroupMap).sort((a, b) => b.value - a.value),
    };
  }, [rawRows, targets, parseMeta]);
}
