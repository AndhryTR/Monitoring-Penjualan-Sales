import * as XLSX from "xlsx-js-style";
import { ALIASES } from "../constants/aliases.js";
import { normalizeHeader } from "./excelParse.js";

/* ============================================================================
   MASTER IMPORT — Sprint 18 / Multi-Depo
   Parser Excel master sales+target 3-sheet → objek targets siap replace.

   Format Excel (3-sheet):
   - Sheet "Sales"  (WAJIB): daftar sales + target value/AO + tier
   - Sheet "Grup"   (opsional): target per grup per sales
   - Sheet "Fokus"  (opsional): produk fokus per sales

   Header di-recognize via ALIASES (case-insensitive), konsisten dengan
   excelParse.js. User bebas pakai "KDSL" / "KODE SALES" / "SALES CODE" —
   semua dikenali otomatis.

   Return: { targets, stats, errors }
   - targets: Target[] siap replace depots[i].targets
   - stats: { salesCount, groupCount, focusCount, skippedRows }
   - errors: Array<{ sheet, row, message }> — baris invalid di-skip, tetap
     di-log supaya modal preview bisa tampilkan ke user

   ⚠️ Tidak pernah throw — semua error dikumpulkan di return.errors supaya
   caller bisa tampilkan preview sebelum konfirmasi simpan.
============================================================================ */

// Alias khusus untuk sheet master (tidak semua field ALIASES relevan di sini).
// Kode/nama sales & grup & fokus = field utama. Tier/AO/target = field numerik
// tambahan yang spesifik untuk master.
const MASTER_ALIASES = {
  salesCode: ALIASES.salesCode,
  salesName: ALIASES.salesName,
  tier: ["TIER", "LEVEL", "GRADE"],
  targetValue: ["TARGET", "TARGET VALUE", "NTARGET", "TARGET_VALUE", "NILAI TARGET"],
  targetAo: ["AO", "TARGET AO", "TARGET_AO"],
  groupName: ALIASES.group,
  groupTargetValue: ["TARGET", "TARGET VALUE", "VALUE", "NILAI"],
  groupTargetAo: ["AO", "TARGET AO"],
  groupFocus: ["FOCUS", "FOKUS", "IS_FOCUS"],
  focusProductName: ALIASES.productName,
  focusTarget: ["TARGET", "QTY TARGET", "JUMLAH", "QTY"],
  focusKeyword: ["KEYWORD", "KATA KUNCI", "KATA_KUNCI", "MATCH"],
  focusUnit: ALIASES.unit,
};

// Nama sheet yang dikenali (case-insensitive, partial match).
// Mis. "Master Sales" / "Sales Target" / "DATA SALES" semua cocok ke "sales".
const SHEET_PATTERNS = {
  sales: [/sales/i, /salesman/i, /target.*sales/i, /master/i],
  grup: [/grup/i, /group/i, /kategori/i, /golongan/i],
  fokus: [/fokus/i, /focus/i, /produk.*fokus/i],
};

function matchSheetKind(sheetName) {
  const name = String(sheetName || "").toLowerCase();
  for (const [kind, patterns] of Object.entries(SHEET_PATTERNS)) {
    if (patterns.some((p) => p.test(name))) return kind;
  }
  return null;
}

function buildMasterFieldMap(headerRow) {
  const normalized = headerRow.map(normalizeHeader);
  const map = {};
  Object.entries(MASTER_ALIASES).forEach(([field, variants]) => {
    for (const v of variants) {
      const idx = normalized.indexOf(v);
      if (idx !== -1) { map[field] = idx; break; }
    }
  });
  return map;
}

// Cell value → string aman (trim, handle null/number/bool)
function cellStr(v) {
  if (v === null || v === undefined) return "";
  return String(v).trim();
}

// Cell value → number (0 bila invalid)
function cellNum(v) {
  if (v === null || v === undefined || v === "") return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

// Cell value → boolean (true bila "TRUE"/"1"/"YA"/"Y"/"FOCUS")
function cellBool(v) {
  if (v === null || v === undefined) return false;
  const s = String(v).trim().toLowerCase();
  return ["true", "1", "ya", "y", "focus", "fokus", "✓", "x"].includes(s);
}

// Tier valid (mint/amber/violet) — fallback ke "mint" bila tidak dikenal
function normalizeTier(v) {
  const s = String(v || "").trim().toLowerCase();
  if (["mint", "amber", "violet"].includes(s)) return s;
  if (["green", "hijau"].includes(s)) return "mint";
  if (["yellow", "kuning", "gold"].includes(s)) return "amber";
  if (["purple", "ungu"].includes(s)) return "violet";
  return "mint"; // default
}

/**
 * Parse ArrayBuffer master Excel (3-sheet) → objek targets siap replace.
 * Dipanggil dari Web Worker yang menerima buffer dari main thread,
 * atau langsung dari parseMasterExcel sebagai delegate.
 *
 * Fungsi ini SINKRON — tidak ada await di dalamnya.
 *
 * @param {ArrayBuffer} buffer - Buffer file .xlsx
 * @returns {{ targets: Target[], stats: object, errors: Array }}
 */
export function parseMasterBuffer(buffer) {
  const wb = XLSX.read(buffer, { type: "array" });

  const errors = [];
  const stats = { salesCount: 0, groupCount: 0, focusCount: 0, skippedRows: 0 };

  // Klasifikasi sheet berdasarkan nama
  const sheets = { sales: null, grup: null, fokus: null };
  wb.SheetNames.forEach((name) => {
    const kind = matchSheetKind(name);
    if (kind && !sheets[kind]) sheets[kind] = name; // pakai sheet pertama yg match
  });

  // Bila tidak ada sheet "sales" yang cocok, pakai sheet pertama sebagai fallback
  if (!sheets.sales) {
    if (wb.SheetNames.length === 0) {
      return {
        targets: [],
        stats,
        errors: [{ sheet: "(file)", row: 0, message: "File tidak memiliki sheet sama sekali" }],
      };
    }
    sheets.sales = wb.SheetNames[0];
    errors.push({
      sheet: sheets.sales, row: 0,
      message: "Tidak ada sheet dengan nama 'Sales' — pakai sheet pertama sebagai fallback",
    });
  }

  // ===== Parse Sheet Sales (WAJIB) =====
  const salesSheet = wb.Sheets[sheets.sales];
  const salesAoA = XLSX.utils.sheet_to_json(salesSheet, { header: 1, defval: null, raw: true });
  if (salesAoA.length === 0) {
    return {
      targets: [],
      stats,
      errors: [{ sheet: sheets.sales, row: 0, message: "Sheet Sales kosong" }],
    };
  }

  const salesFmap = buildMasterFieldMap(salesAoA[0]);
  if (salesFmap.salesCode === undefined || salesFmap.salesName === undefined) {
    return {
      targets: [],
      stats,
      errors: [{
        sheet: sheets.sales, row: 0,
        message: "Header wajib tidak ditemukan. Pastikan ada kolom Kode Sales (KDSL/KODE SALES) dan Nama Sales (NMSL/SALESMAN).",
      }],
    };
  }

  // Bangun map sales sementara — key = kode sales (uppercase), value = Target obj
  const salesMap = new Map();
  const salesOrder = []; // jaga urutan input
  for (let i = 1; i < salesAoA.length; i++) {
    const r = salesAoA[i];
    if (!r || r.every((c) => c === null || c === "")) { stats.skippedRows++; continue; }

    const code = cellStr(r[salesFmap.salesCode]).toUpperCase();
    const name = cellStr(r[salesFmap.salesName]);

    if (!code || !name) {
      errors.push({ sheet: sheets.sales, row: i + 1, message: "Kode atau nama sales kosong — baris di-skip" });
      stats.skippedRows++;
      continue;
    }

    if (salesMap.has(code)) {
      errors.push({
        sheet: sheets.sales, row: i + 1,
        message: `Kode sales "${code}" duplikat — baris kedua di-skip`,
      });
      stats.skippedRows++;
      continue;
    }

    salesMap.set(code, {
      code,
      name,
      tier: normalizeTier(r[salesFmap.tier]),
      total: {
        value: cellNum(r[salesFmap.targetValue]),
        ao: cellNum(r[salesFmap.targetAo]),
      },
      groups: [],
      focus: [],
    });
    salesOrder.push(code);
    stats.salesCount++;
  }

  if (stats.salesCount === 0) {
    return {
      targets: [],
      stats,
      errors: errors.length ? errors : [{ sheet: sheets.sales, row: 0, message: "Tidak ada baris sales valid ditemukan" }],
    };
  }

  // ===== Parse Sheet Grup (opsional) =====
  if (sheets.grup) {
    const grupSheet = wb.Sheets[sheets.grup];
    const grupAoA = XLSX.utils.sheet_to_json(grupSheet, { header: 1, defval: null, raw: true });
    if (grupAoA.length > 1) {
      const grupFmap = buildMasterFieldMap(grupAoA[0]);
      if (grupFmap.salesCode === undefined || grupFmap.groupName === undefined) {
        errors.push({
          sheet: sheets.grup, row: 0,
          message: "Sheet Grup tidak punya kolom Kode Sales atau Grup — sheet diabaikan",
        });
      } else {
        for (let i = 1; i < grupAoA.length; i++) {
          const r = grupAoA[i];
          if (!r || r.every((c) => c === null || c === "")) { stats.skippedRows++; continue; }

          const code = cellStr(r[grupFmap.salesCode]).toUpperCase();
          const groupName = cellStr(r[grupFmap.groupName]);

          if (!code || !groupName) { stats.skippedRows++; continue; }
          const target = salesMap.get(code);
          if (!target) {
            errors.push({
              sheet: sheets.grup, row: i + 1,
              message: `Kode sales "${code}" tidak ada di Sheet Sales — grup di-skip`,
            });
            stats.skippedRows++;
            continue;
          }

          // Cek duplikat grup dalam sales yang sama
          const existing = target.groups.find((g) => g.name === groupName);
          if (existing) {
            errors.push({
              sheet: sheets.grup, row: i + 1,
              message: `Grup "${groupName}" untuk sales "${code}" duplikat — baris di-skip`,
            });
            stats.skippedRows++;
            continue;
          }

          target.groups.push({
            name: groupName,
            value: cellNum(r[grupFmap.groupTargetValue]),
            ao: cellNum(r[grupFmap.groupTargetAo]),
            focus: cellBool(r[grupFmap.groupFocus]),
          });
          stats.groupCount++;
        }
      }
    }
  }

  // ===== Parse Sheet Fokus (opsional) =====
  if (sheets.fokus) {
    const fokusSheet = wb.Sheets[sheets.fokus];
    const fokusAoA = XLSX.utils.sheet_to_json(fokusSheet, { header: 1, defval: null, raw: true });
    if (fokusAoA.length > 1) {
      const fokusFmap = buildMasterFieldMap(fokusAoA[0]);
      if (fokusFmap.salesCode === undefined || fokusFmap.focusProductName === undefined) {
        errors.push({
          sheet: sheets.fokus, row: 0,
          message: "Sheet Fokus tidak punya kolom Kode Sales atau Nama Produk — sheet diabaikan",
        });
      } else {
        for (let i = 1; i < fokusAoA.length; i++) {
          const r = fokusAoA[i];
          if (!r || r.every((c) => c === null || c === "")) { stats.skippedRows++; continue; }

          const code = cellStr(r[fokusFmap.salesCode]).toUpperCase();
          const productName = cellStr(r[fokusFmap.focusProductName]);

          if (!code || !productName) { stats.skippedRows++; continue; }
          const target = salesMap.get(code);
          if (!target) {
            errors.push({
              sheet: sheets.fokus, row: i + 1,
              message: `Kode sales "${code}" tidak ada di Sheet Sales — fokus di-skip`,
            });
            stats.skippedRows++;
            continue;
          }

          target.focus.push({
            name: productName,
            target: cellNum(r[fokusFmap.focusTarget]),
            keyword: cellStr(r[fokusFmap.focusKeyword]) || productName,
            unit: cellStr(r[fokusFmap.focusUnit]).toUpperCase() || "KARTON",
            matchType: "contains", // default — bisa di-edit nanti di UI
          });
          stats.focusCount++;
        }
      }
    }
  }

  // ===== Final: urutkan sesuai input, return array =====
  const targets = salesOrder.map((code) => salesMap.get(code));

  return { targets, stats, errors };
}

/**
 * Parse file Excel master 3-sheet → objek targets.
 * Wrapper async untuk parseMasterBuffer — membaca ArrayBuffer dari File
 * lalu mendelegasikan ke parseMasterBuffer.
 *
 * Dipertahankan agar semua caller lama tetap berfungsi tanpa perubahan.
 *
 * @param {File} file - File .xlsx dari input type="file"
 * @returns {Promise<{ targets: Target[], stats: object, errors: Array }>}
 */
export async function parseMasterExcel(file) {
  const buf = await file.arrayBuffer();
  return parseMasterBuffer(buf);
}
