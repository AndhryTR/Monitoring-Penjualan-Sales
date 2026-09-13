import * as XLSX from "xlsx-js-style";
import { dateStrToLocalDate, todayLocalDateStr } from "./excelParse.js";
import { fmtRp } from "./formatters.js";

/* ============================================================================
   EXPORT POLA KUNJUNGAN KE EXCEL
   Format wide: outlet jadi baris, tanggal jadi kolom, tanda "X" di sel kalau
   ada transaksi hari itu. Lebih gampang dibaca/print dibanding format
   panjang (1 baris per kunjungan).
============================================================================ */

const HEADER_FILL = "6DD9FF";
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
  const ws = {};
  const merges = [];
  let lastRow = 0;
  let lastCol = 0;

  const setCell = (r, c, value, style = {}) => {
    const ref = XLSX.utils.encode_cell({ r: r - 1, c: c - 1 });
    const isNum = typeof value === "number";
    const cellObj = { v: value === null || value === undefined ? "" : value, t: isNum ? "n" : "s" };
    cellObj.s = {
      font: { bold: !!style.bold, sz: style.size || 9, name: "Calibri", color: { rgb: style.color || "000000" } },
      alignment: { horizontal: style.align || "center", vertical: "center", wrapText: true },
      border: { top: { style: "thin", color: { rgb: "D9D9D9" } }, bottom: { style: "thin", color: { rgb: "D9D9D9" } },
        left: { style: "thin", color: { rgb: "D9D9D9" } }, right: { style: "thin", color: { rgb: "D9D9D9" } } },
    };
    if (style.fill) cellObj.s.fill = { patternType: "solid", fgColor: { rgb: style.fill } };
    ws[ref] = cellObj;
    if (r > lastRow) lastRow = r;
    if (c > lastCol) lastCol = c;
  };
  const merge = (r1, c1, r2, c2) => merges.push({ s: { r: r1 - 1, c: c1 - 1 }, e: { r: r2 - 1, c: c2 - 1 } });

  // ---- Judul & info ----
  setCell(1, 1, `Pola Kunjungan Historis — ${salesName}`, { bold: true, size: 13, align: "left" });
  merge(1, 1, 1, 3 + dates.length);
  setCell(2, 1, `${depotName || ""} · Periode ${dateFrom} s/d ${dateTo} · Direkonstruksi dari hari transaksi (bukan data check-in) · Dibuat ${todayLocalDateStr()}`,
    { size: 9, color: "6B7280", align: "left" });
  merge(2, 1, 2, 3 + dates.length);

  // ---- Header kolom ----
  const HROW = 4;
  setCell(HROW, 1, "Outlet", { bold: true, fill: HEADER_FILL });
  setCell(HROW, 2, "Total Kunjungan", { bold: true, fill: HEADER_FILL });
  setCell(HROW, 3, "Rata² Interval (hari)", { bold: true, fill: HEADER_FILL });
  dates.forEach((d, i) => {
    const dObj = dateStrToLocalDate(d);
    setCell(HROW, 4 + i, dObj, { bold: true, fill: HEADER_FILL, size: 8 });
    ws[XLSX.utils.encode_cell({ r: HROW - 1, c: 3 + i })].s.numFmt = "dd/mm";
    ws[XLSX.utils.encode_cell({ r: HROW - 1, c: 3 + i })].t = "d";
    ws[XLSX.utils.encode_cell({ r: HROW - 1, c: 3 + i })].v = dObj;
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

  ws["!ref"] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: lastRow - 1, c: lastCol - 1 } });
  ws["!merges"] = merges;
  ws["!cols"] = [{ wch: 26 }, { wch: 14 }, { wch: 16 }, ...dates.map(() => ({ wch: 7 }))];
  ws["!rows"] = [{ hpx: 20 }, { hpx: 16 }, {}, { hpx: 18 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Pola Kunjungan");
  const safeSalesName = (salesName || "sales").replace(/[^a-z0-9]+/gi, "_");
  XLSX.writeFile(wb, `Pola_Kunjungan_${safeSalesName}_${dateFrom}_${dateTo}.xlsx`);
}
