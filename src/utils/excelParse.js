import * as XLSX from "xlsx-js-style";
import { ALIASES } from "../constants/aliases.js";

/* ============================================================================
   EXCEL PARSING
   Berisi semua fungsi pure untuk membaca file Excel/CSV hasil export sistem
   sell-out, memetakan kolom fleksibel (alias), mengonversi tanggal, menduplikasi
   baris, dan menormalisasi satuan ke KARTON.

   Tidak ada dependency ke React — semua pure function. Dipakai oleh SalesMonitoringApp
   lewat handleFile() saat user upload file.
============================================================================ */

export function normalizeHeader(h) {
  return String(h || "").trim().toUpperCase();
}

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

// Ubah nilai tanggal mentah dari Excel menjadi teks "YYYY-MM-DD" — TANPA PERNAH membuat
// objek Date JavaScript untuk nilai ini. Ini sengaja dihindari karena objek Date selalu
// membawa asumsi jam/zona waktu yang bisa berbeda-beda tergantung cara library membacanya
// (sumber bug tanggal maju/mundur satu hari yang sebelumnya terjadi). Untuk sel tanggal
// Excel (angka serial), kita ambil komponen tahun/bulan/tanggal langsung dari
// XLSX.SSF.parse_date_code — angka polos, sama persis dengan yang tersimpan di file Excel.
export function excelValueToDateStr(v) {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number") {
    const d = XLSX.SSF.parse_date_code(v);
    if (!d) return null;
    return `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;
  }
  if (typeof v === "string") {
    const s = v.trim();
    // Sudah dalam format "YYYY-MM-DD..." — ambil apa adanya, tidak perlu diparsing ulang.
    const isoMatch = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
    // Format umum "DD/MM/YYYY" atau "DD-MM-YYYY" (format tanggal Indonesia).
    const slashMatch = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
    if (slashMatch) {
      const [, day, month, year] = slashMatch;
      return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
    return null;
  }
  return null;
}

// Dipakai HANYA untuk momen "sekarang" (mis. nama file export) — bukan untuk tanggal
// yang berasal dari Excel — jadi aman memakai komponen tanggal lokal browser.
export function todayLocalDateStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Buat objek Date lokal dari teks "YYYY-MM-DD" — dipakai HANYA saat export ke Excel,
// supaya kolom tanggal di file hasil export tetap berupa tanggal asli (bukan teks),
// tanpa membawa balik ambiguitas UTC/lokal karena kita yang membangunnya sendiri.
export function dateStrToLocalDate(s) {
  if (!s) return null;
  const [y, m, d] = s.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

export function parseWorkbookFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target.result, { type: "array" });
        const sheetName = wb.SheetNames[0];
        const ws = wb.Sheets[sheetName];
        const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: true });
        if (!aoa.length) {
          return resolve({
            rows: [],
            parseMeta: {
              sheetName, totalDataRows: 0, skippedBlankRows: 0, rowsWithMissingDate: 0,
              detectedFields: [], missingFields: Object.keys(ALIASES),
            },
          });
        }
        const headerRowIdx = 0;
        const fmap = buildFieldMap(aoa[headerRowIdx]);
        const missingFields = Object.keys(ALIASES).filter((f) => fmap[f] === undefined);
        const detectedFields = Object.keys(ALIASES).filter((f) => fmap[f] !== undefined);
        const rows = [];
        let skippedBlankRows = 0;
        let rowsWithMissingDate = 0;
        for (let i = headerRowIdx + 1; i < aoa.length; i++) {
          const r = aoa[i];
          if (!r || r.every((c) => c === null || c === "")) { skippedBlankRows++; continue; }
          const get = (f) => (fmap[f] !== undefined ? r[fmap[f]] : null);
          const dateRaw = get("date");
          const dateStr = excelValueToDateStr(dateRaw);
          if (!dateStr) rowsWithMissingDate++;
          rows.push({
            date: dateStr,
            salesCode: String(get("salesCode") || "").trim(),
            salesName: String(get("salesName") || "").trim(),
            outletCode: String(get("outletCode") || "").trim(),
            outletName: String(get("outletName") || "").trim(),
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
        resolve({
          rows: attachKartonQty(rows),
          parseMeta: { sheetName, totalDataRows: aoa.length - 1, skippedBlankRows, rowsWithMissingDate, detectedFields, missingFields },
        });
      } catch (err) { reject(err); }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

// Hapus baris yang persis sama (Tanggal + No Faktur + Kode Produk + Qty + Value) —
// biasanya muncul kalau user tidak sengaja upload file yang sama 2×, atau rentang
// tanggal antar file yang digabung saling overlap (ekspor ulang dari sistem sumber).
// Baris TANPA No Faktur sengaja tidak di-dedup — tanpa identitas transaksi yang jelas,
// terlalu berisiko menghapus baris yang sebenarnya beda (mis. 2 outlet beli produk
// sama, qty & value kebetulan sama, di hari yang sama).
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

// Beberapa barang dijual dalam lebih dari satu satuan (mis. KARTON, KTK, PCS, CAN).
// Setiap baris transaksi punya KONV (faktor ke satuan dasar UNITK) sendiri-sendiri —
// termasuk baris yang satuannya KARTON. Baris KARTON itu jadi "kurs resmi" produk
// tersebut ("1 KARTON = KONV satuan dasar"), dipakai untuk mengonversi baris lain
// (satuan apa pun) menjadi setara KARTON: qtyKarton = (qty * KONV baris ini) / KONV baris KARTON.
// Kalau produk itu tidak pernah muncul dengan satuan KARTON sama sekali di data, konversinya
// tidak bisa diturunkan — qtyKarton diberi null dan ditandai lewat `unconvertible: true`
// supaya tetap terlihat di UI, bukan diam-diam dianggap benar.
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

// Kuantitas efektif dalam satuan karton untuk dijumlahkan — pakai hasil konversi kalau ada,
// jatuh balik ke angka asli kalau produknya memang tidak bisa dikonversi (lihat attachKartonQty).
export function effectiveKartonQty(row) {
  return row.qtyKarton !== null && row.qtyKarton !== undefined ? row.qtyKarton : row.qty;
}
