import * as XLSX from "xlsx-js-style";
import { dateStrToLocalDate, todayLocalDateStr } from "./excelParse.js";
import { fmtRp } from "./formatters.js";
import { makeSheetBuilder, writeTitleBlock, sanitizeFilename, XL_COLORS } from "./xlsxStyle.js";

/* ============================================================================
   EXPORT POLA KUNJUNGAN KE EXCEL
   Format wide: outlet jadi baris, tanggal jadi kolom, tanda "X" di sel kalau
   ada transaksi hari itu. Lebih gampang dibaca/print dibanding format
   panjang (1 baris per kunjungan).
============================================================================ */

const HEADER_FILL = XL_COLORS.headerCyan;
const OVERDUE_FILL = "F8696B";
const OK_FILL = "63BE7B";
const VISIT_FILL = "D9F2E6";

function allDatesInRange(dateFrom, dateTo) {
  const dates = [];
  const cur = dateStrToLocalDate(dateFrom);
  const end = dateStrToLocalDate(dateTo);
  if (!cur || !end) return dates;
  while (cur <= end) {
    const y = cur.getFullYear(), m = String(cur.getMonth() + 1).padStart(2, "0"), d = String(cur.getDate()).padStart(2, "0");
    dates.push(`${y}-${m}-${d}`);
    cur.setDate(cur.getDate() + 1);
  }
  return dates;
}

export function exportVisitPatternExcel(pattern, salesName, depotName) {
  const { outlets, dateFrom, dateTo } = pattern;
  const dates = allDatesInRange(dateFrom, dateTo);
  const b = makeSheetBuilder();
  const { setCell, finalize } = b;

  // ---- Judul & info ----
  writeTitleBlock(
    b,
    `Pola Kunjungan Historis — ${salesName}`,
    `${depotName || ""} · Periode ${dateFrom} s/d ${dateTo} · Direkonstruksi dari hari transaksi (bukan data check-in) · Dibuat ${todayLocalDateStr()}`,
    3 + dates.length
  );

  // ---- Header kolom ----
  const HROW = 4;
  setCell(HROW, 1, "Outlet", { bold: true, fill: HEADER_FILL });
  setCell(HROW, 2, "Total Kunjungan", { bold: true, fill: HEADER_FILL });
  setCell(HROW, 3, "Rata² Interval (hari)", { bold: true, fill: HEADER_FILL });
  dates.forEach((d, i) => {
    const dObj = dateStrToLocalDate(d);
    setCell(HROW, 4 + i, dObj, { bold: true, fill: HEADER_FILL, size: 8, numFmt: "dd/mm" });
  });

  // ---- Baris per outlet ----
  outlets.forEach((o, i) => {
    const r = HROW + 1 + i;
    const rowFill = o.isOverdue ? OVERDUE_FILL : (o.hasEnoughData ? OK_FILL : undefined);
    setCell(r, 1, o.outletName, { align: "left", fill: rowFill });
    setCell(r, 2, o.totalVisits, { numFmt: "#,##0" });
    setCell(r, 3, o.avgIntervalDays !== null ? Math.round(o.avgIntervalDays * 10) / 10 : "-");
    const dateSet = new Set(o.visitDates);
    dates.forEach((d, di) => {
      const has = dateSet.has(d);
      const val = has ? (o.valueByDate ? o.valueByDate.get(d) : undefined) : undefined;
      const display = has ? (val === undefined || val === null ? "" : fmtRp(val)) : "";
      setCell(r, 4 + di, display, { fill: has ? VISIT_FILL : undefined, bold: has, align: "center" });
    });
  });

  const ws = finalize([26, 14, 16, ...dates.map(() => 7)]);
  ws["!rows"] = [{ hpx: 20 }, { hpx: 16 }, {}, { hpx: 18 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Pola Kunjungan");
  const safeSalesName = sanitizeFilename(salesName || "sales");
  XLSX.writeFile(wb, `Pola_Kunjungan_${safeSalesName}_${dateFrom}_${dateTo}.xlsx`);
}

