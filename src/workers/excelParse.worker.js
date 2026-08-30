import * as XLSX from "xlsx-js-style";
import { ALIASES } from "../constants/aliases.js";

// ⚠️ Sprint 5 / Worker: parse Excel di thread terpisah supaya UI tidak freeze
// saat file besar di-upload. Worker menerima { requestId, files: [{name, buffer}] },
// memproses tiap file (parse + karton qty + dedupe), lalu postMessage hasil ke
// main thread. Semua logika di sini identik dengan excelParse.js di main thread.

export function normalizeHeader(h) { return String(h || "").trim().toUpperCase(); }

export function buildFieldMap(headerRow) {
  const normalized = headerRow.map(normalizeHeader);
  const map = {};
  Object.entries(ALIASES).forEach(([field, variants]) => {
    for (const v of variants) {
      const idx = normalized.indexOf(v);
      if (idx !== -1) { map[field] = idx; break; }
    }
  });
  return map;
}

export function excelValueToDateStr(v) {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number") {
    const d = XLSX.SSF.parse_date_code(v);
    if (!d) return null;
    return `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;
  }
  if (typeof v === "string") {
    const s = v.trim();
    const isoMatch = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
    const slashMatch = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
    if (slashMatch) {
      const [, day, month, year] = slashMatch;
      return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
    return null;
  }
  return null;
}

export function dedupeRows(rows) {
  const seen = new Set();
  const result = [];
  let duplicateCount = 0;
  for (const r of rows) {
    if (!r.invoiceNo) { result.push(r); continue; }
    const key = `${r.date}|${r.invoiceNo}|${r.productCode}|${r.qty}|${r.value}`;
    if (seen.has(key)) { duplicateCount++; continue; }
    seen.add(key);
    result.push(r);
  }
  return { rows: result, duplicateCount };
}

export function attachKartonQty(rows) {
  const kartonFactor = {};
  rows.forEach((r) => {
    if (r.unit === "KARTON" && r.konv > 0 && r.productCode && !(r.productCode in kartonFactor)) {
      kartonFactor[r.productCode] = r.konv;
    }
  });
  return rows.map((r) => {
    if (r.unit === "KARTON") return { ...r, qtyKarton: r.qty, unconvertible: false };
    const factor = kartonFactor[r.productCode];
    if (factor && r.konv > 0) {
      return { ...r, qtyKarton: (r.qty * r.konv) / factor, unconvertible: false };
    }
    return { ...r, qtyKarton: null, unconvertible: true };
  });
}

function parseBuffer(arrayBuffer, onPhase) {
  // Fase A: baca struktur file (XLSX.read + sheet_to_json) — INI bagian terberat,
  // library tidak expose callback per baris. Kita laporkan fase ini sebagai
  // rentang rendah (maju saat aoa siap), supaya user tidak melihat diam di 0%.
  onPhase?.("read");            // mulai baca — progress di awal rentang
  const wb = XLSX.read(arrayBuffer, { type: "array" });
  const sheetName = wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: true });
  onPhase?.("parsed");          // aoa siap — progres naik ke akhir rentang baca
  if (!aoa.length) {
    return {
      rows: [],
      parseMeta: { sheetName, totalDataRows: 0, skippedBlankRows: 0, rowsWithMissingDate: 0, duplicateRowsRemoved: 0, detectedFields: [], missingFields: Object.keys(ALIASES) },
    };
  }
  const fmap = buildFieldMap(aoa[0]);
  const missingFields = Object.keys(ALIASES).filter((f) => fmap[f] === undefined);
  const detectedFields = Object.keys(ALIASES).filter((f) => fmap[f] !== undefined);
  const rows = [];
  let skippedBlankRows = 0;
  let rowsWithMissingDate = 0;
  const total = aoa.length - 1;
  for (let i = 1; i < aoa.length; i++) {
    const r = aoa[i];
    if (!r || r.every((c) => c === null || c === "")) { skippedBlankRows++; }
    else {
      const get = (f) => (fmap[f] !== undefined ? r[fmap[f]] : null);
      const dateStr = excelValueToDateStr(get("date"));
      if (!dateStr) rowsWithMissingDate++;
      rows.push({
        date: dateStr,
        salesCode: String(get("salesCode") || "").trim(),
        salesName: String(get("salesName") || "").trim(),
        outletCode: String(get("outletCode") || "").trim(),
        outletName: String(get("outletName") || "").trim(),
        outletAddress: String(get("outletAddress") || "").trim(),
        invoiceNo: String(get("invoiceNo") || "").trim(),
        productCode: String(get("productCode") || "").trim(),
        productName: String(get("productName") || "").trim(),
        qty: Number(get("qty")) || 0,
        unit: String(get("unit") || "").trim().toUpperCase(),
        konv: Number(get("konv")) || 0,
        baseUnit: String(get("baseUnit") || "").trim().toUpperCase(),
        value: Number(get("value")) || 0,
        group: String(get("group") || "").trim(),
      });
    }
    // Fase B: loop per baris — ini yang bisa diukur granular (dari total baris).
    onPhase?.("row", { rowIdx: i, rowTotal: total });
  }
  return {
    rows: attachKartonQty(rows),
    parseMeta: { sheetName, totalDataRows: total, skippedBlankRows, rowsWithMissingDate, duplicateRowsRemoved: 0, detectedFields, missingFields },
  };
}

self.onmessage = ({ data }) => {
  try {
    const results = [];
    const filesTotal = data.files.length;
    let filesDone = 0;
    for (const file of data.files) {
      let lastReportedPct = -1;
      const parsed = parseBuffer(file.buffer, (phase, info) => {
        // Rentang per file: file selesai = filesDone/filesTotal * 100.
        // Dalam 1 file, split 30% (baca struktur) + 70% (loop baris).
        const basePct = (filesDone / filesTotal) * 100;
        const span = 100 / filesTotal;
        let pct;
        if (phase === "read") {
          pct = Math.floor(basePct + span * 0.05); // awal fase baca
        } else if (phase === "parsed") {
          pct = Math.floor(basePct + span * 0.30); // struktur selesai
        } else {
          const frac = info.rowTotal ? info.rowIdx / info.rowTotal : 0;
          pct = Math.floor(basePct + span * (0.30 + 0.70 * frac)); // loop baris 30→100
        }
        pct = Math.max(0, Math.min(100, pct));
        if (pct !== lastReportedPct) {
          lastReportedPct = pct;
          self.postMessage({ requestId: data.requestId, progress: pct });
        }
      });
      const deduped = dedupeRows(parsed.rows);
      parsed.parseMeta.duplicateRowsRemoved = deduped.duplicateCount;
      results.push({ rows: deduped.rows, parseMeta: parsed.parseMeta, name: file.name });
      filesDone++;
      self.postMessage({ requestId: data.requestId, progress: Math.floor((filesDone / filesTotal) * 100) });
    }
    self.postMessage({ requestId: data.requestId, results });
  } catch (error) {
    self.postMessage({ requestId: data.requestId, error: error?.message || String(error) });
  }
};
