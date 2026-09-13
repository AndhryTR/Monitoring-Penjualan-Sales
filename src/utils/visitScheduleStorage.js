import * as XLSX from "xlsx-js-style";
import { dateStrToLocalDate } from "./excelParse.js";
import { fmtRp } from "./formatters.js";

/* ============================================================================
   VISIT SCHEDULE STORAGE & BEAT PLAN ENGINE
   1. Penyimpanan jadwal kunjungan per depo di localStorage
   2. Ekstraksi kode outlet: Inisial - Kode Alamat - Nomor Urut (contoh: A-AKL-0001)
   3. Analisis pengelompokan wilayah (Area Code Clustering)
   4. Analisis hari pembelian favorit berdasarkan riwayat transaksi
   5. Ekspor & Impor Excel Master Jadwal Kunjungan
   6. Generator Call Sheet WhatsApp Harian per Sales
   ============================================================================ */

const STORAGE_PREFIX = "sm_outlet_schedule_";

export const DAYS_OF_WEEK = ["senin", "selasa", "rabu", "kamis", "jumat", "sabtu"];

export const DAY_LABELS = {
  senin: "Senin",
  selasa: "Selasa",
  rabu: "Rabu",
  kamis: "Kamis",
  jumat: "Jumat",
  sabtu: "Sabtu",
};

export const DAY_COLORS = {
  senin: { badge: "#3B82F6", text: "#FFFFFF", lightBg: "#EFF6FF", lightText: "#1D4ED8", border: "#BFDBFE" },
  selasa: { badge: "#10B981", text: "#FFFFFF", lightBg: "#ECFDF5", lightText: "#047857", border: "#A7F3D0" },
  rabu: { badge: "#F59E0B", text: "#FFFFFF", lightBg: "#FFFBEB", lightText: "#B45309", border: "#FDE68A" },
  kamis: { badge: "#8B5CF6", text: "#FFFFFF", lightBg: "#F5F3FF", lightText: "#6D28D9", border: "#DDD6FE" },
  jumat: { badge: "#EC4899", text: "#FFFFFF", lightBg: "#FDF2F8", lightText: "#BE185D", border: "#FBCFE8" },
  sabtu: { badge: "#06B6D4", text: "#FFFFFF", lightBg: "#ECFEFF", lightText: "#0E7490", border: "#A5F3FC" },
};

const DAY_INDEX_MAP = {
  1: "senin",
  2: "selasa",
  3: "rabu",
  4: "kamis",
  5: "jumat",
  6: "sabtu",
};

export function getDepotKey(depotName) {
  if (!depotName) return "default";
  return String(depotName).trim().toLowerCase().replace(/[^a-z0-9_-]/g, "_") || "default";
}

/**
 * Membaca jadwal kunjungan outlet tersimpan untuk depo tertentu.
 * Return: { [outletCode]: { day: "senin"|"selasa"|..., areaCode?: string, frequency?: string, updatedAt?: string } }
 */
export function getStoredSchedule(depotName) {
  const key = STORAGE_PREFIX + getDepotKey(depotName);
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return typeof parsed === "object" && parsed !== null ? parsed : {};
  } catch (err) {
    console.warn("Gagal membaca jadwal kunjungan dari storage:", err);
    return {};
  }
}

/**
 * Menyimpan jadwal kunjungan outlet untuk depo tertentu.
 */
export function saveStoredSchedule(depotName, scheduleMap) {
  const key = STORAGE_PREFIX + getDepotKey(depotName);
  try {
    localStorage.setItem(key, JSON.stringify(scheduleMap || {}));
    window.dispatchEvent(new CustomEvent("sm_schedule_updated", { detail: { depotName } }));
    return true;
  } catch (err) {
    console.error("Gagal menyimpan jadwal kunjungan:", err);
    return false;
  }
}

/**
 * Ekstraksi segmen kode outlet:
 * Format standar: [Inisial]-[Kode Alamat]-[Nomor Urut Pendaftaran]
 * Contoh: "A-AKL-0001" -> { initial: "A", areaCode: "AKL", regNumber: "0001" }
 */
export function parseOutletCode(code) {
  if (!code) {
    return { initial: "", areaCode: "LAINNYA", regNumber: "", raw: "" };
  }
  const clean = String(code).trim();
  const parts = clean.split(/[-_/ ]+/).filter(Boolean);

  if (parts.length >= 3) {
    return {
      initial: parts[0].toUpperCase(),
      areaCode: parts[1].toUpperCase(),
      regNumber: parts.slice(2).join("-"),
      raw: clean,
    };
  }

  if (parts.length === 2) {
    if (/^[A-Za-z]+$/.test(parts[0]) && /^\d+$/.test(parts[1])) {
      return {
        initial: "",
        areaCode: parts[0].toUpperCase(),
        regNumber: parts[1],
        raw: clean,
      };
    }
    return {
      initial: parts[0].toUpperCase(),
      areaCode: parts[1].toUpperCase(),
      regNumber: "",
      raw: clean,
    };
  }

  return {
    initial: "",
    areaCode: parts[0] ? parts[0].toUpperCase() : "LAINNYA",
    regNumber: "",
    raw: clean,
  };
}

/**
 * Menghitung pola hari transaksi historis per outlet dari rawRows.
 * Menghasilkan map: { [outletCode]: { topDay: "senin", pct: 80, totalOrders: 5, counts: { senin: 4, ... } } }
 */
export function detectPreferredOrderDays(rawRows = []) {
  const result = {};
  if (!rawRows || !rawRows.length) return result;

  const storeDateMap = new Map();

  rawRows.forEach((r) => {
    if (!r.outletCode || !r.date) return;
    if (!storeDateMap.has(r.outletCode)) {
      storeDateMap.set(r.outletCode, new Set());
    }
    storeDateMap.get(r.outletCode).add(r.date);
  });

  storeDateMap.forEach((datesSet, outletCode) => {
    const counts = { senin: 0, selasa: 0, rabu: 0, kamis: 0, jumat: 0, sabtu: 0 };
    let validDays = 0;

    datesSet.forEach((dateStr) => {
      const d = dateStrToLocalDate(dateStr);
      if (d) {
        const dayIdx = d.getDay();
        const dayKey = DAY_INDEX_MAP[dayIdx];
        if (dayKey && counts[dayKey] !== undefined) {
          counts[dayKey]++;
          validDays++;
        }
      }
    });

    let topDay = null;
    let maxCount = 0;
    DAYS_OF_WEEK.forEach((dayKey) => {
      if (counts[dayKey] > maxCount) {
        maxCount = counts[dayKey];
        topDay = dayKey;
      }
    });

    const pct = validDays > 0 ? Math.round((maxCount / validDays) * 100) : 0;

    result[outletCode] = {
      topDay,
      topCount: maxCount,
      totalOrders: validDays,
      pct,
      counts,
    };
  });

  return result;
}

/**
 * Mengelompokkan daftar outlet berdasarkan Kode Alamat (segmen tengah kode outlet).
 * Menghitung total toko, estimasi omzet, dan hari transaksi dominan.
 */
export function groupOutletsByAreaCode(outlets = [], preferredDays = {}) {
  const groups = new Map();

  outlets.forEach((o) => {
    const parsed = parseOutletCode(o.outletCode);
    const area = parsed.areaCode || "LAINNYA";

    if (!groups.has(area)) {
      groups.set(area, {
        areaCode: area,
        outlets: [],
        totalOutlets: 0,
        totalValue: 0,
        dayCounts: { senin: 0, selasa: 0, rabu: 0, kamis: 0, jumat: 0, sabtu: 0 },
      });
    }

    const g = groups.get(area);
    g.outlets.push(o);
    g.totalOutlets++;
    g.totalValue += Number(o.value || 0);

    const pref = preferredDays[o.outletCode];
    if (pref && pref.topDay && g.dayCounts[pref.topDay] !== undefined) {
      g.dayCounts[pref.topDay]++;
    }
  });

  const list = Array.from(groups.values()).map((g) => {
    let dominantDay = null;
    let maxCount = 0;
    DAYS_OF_WEEK.forEach((d) => {
      if (g.dayCounts[d] > maxCount) {
        maxCount = g.dayCounts[d];
        dominantDay = d;
      }
    });

    const dominantPct = g.totalOutlets > 0 ? Math.round((maxCount / g.totalOutlets) * 100) : 0;

    return {
      areaCode: g.areaCode,
      outlets: g.outlets,
      totalOutlets: g.totalOutlets,
      totalValue: g.totalValue,
      dominantDay,
      dominantPct,
      sampleName: g.outlets[0]?.outletName || "-",
    };
  });

  list.sort((a, b) => b.totalOutlets - a.totalOutlets || b.totalValue - a.totalValue);
  return list;
}

/* ============================================================================
   EXCEL EXPORT & IMPORT JADWAL
   ============================================================================ */

const HEADER_FILL = { patternType: "solid", fgColor: { rgb: "0F172A" } };
const HEADER_FONT = { bold: true, color: { rgb: "FFFFFF" }, sz: 11 };
const BODY_FONT = { color: { rgb: "111827" }, sz: 10 };

function makeHeader(val) {
  return {
    v: val,
    t: "s",
    s: {
      fill: HEADER_FILL,
      font: HEADER_FONT,
      alignment: { horizontal: "center", vertical: "center" },
      border: {
        top: { style: "thin", color: { rgb: "0F172A" } },
        bottom: { style: "thin", color: { rgb: "0F172A" } },
        left: { style: "thin", color: { rgb: "0F172A" } },
        right: { style: "thin", color: { rgb: "0F172A" } },
      },
    },
  };
}

function makeCell(val) {
  return {
    v: String(val ?? ""),
    t: "s",
    s: {
      font: BODY_FONT,
      alignment: { vertical: "center" },
      border: {
        top: { style: "thin", color: { rgb: "E2E8F0" } },
        bottom: { style: "thin", color: { rgb: "E2E8F0" } },
        left: { style: "thin", color: { rgb: "E2E8F0" } },
        right: { style: "thin", color: { rgb: "E2E8F0" } },
      },
    },
  };
}

/**
 * Menghasilkan file Excel Master Jadwal Kunjungan.
 */
export function exportScheduleExcel(schedule = {}, outlets = [], depotName = "", coords = {}) {
  const safeDepot = (depotName || "DEPO").replace(/[^a-zA-Z0-9_-]/g, "_");
  const wb = XLSX.utils.book_new();

  const headers = [
    "KODE OUTLET",
    "NAMA OUTLET",
    "KODE ALAMAT",
    "SALES",
    "HARI KUNJUNGAN",
    "STATUS",
    "ALAMAT",
    "LATITUDE",
    "LONGITUDE",
  ];

  const rows = [];
  rows.push(headers.map(makeHeader));

  outlets.forEach((o) => {
    const code = o.outletCode || "";
    const parsed = parseOutletCode(code);
    const sched = schedule[code];
    const dayLabel = sched?.day ? (DAY_LABELS[sched.day] || sched.day) : "Belum Terjadwal";
    const coord = coords[code] || {};
    const lat = coord.lat ?? o.lat ?? "";
    const lng = coord.lng ?? o.lng ?? "";

    rows.push([
      makeCell(code),
      makeCell(o.outletName || ""),
      makeCell(parsed.areaCode),
      makeCell(o.salesLabel || (o.salesNames ? Array.from(o.salesNames).join(", ") : "")),
      makeCell(dayLabel),
      makeCell(o.status || "-"),
      makeCell(o.outletAddress || coord.address || ""),
      makeCell(lat),
      makeCell(lng),
    ]);
  });

  const ws = XLSX.utils.aoa_to_sheet([]);
  rows.forEach((row, rIdx) => {
    row.forEach((cell, cIdx) => {
      const cellRef = XLSX.utils.encode_cell({ r: rIdx, c: cIdx });
      ws[cellRef] = cell;
    });
  });

  ws["!ref"] = XLSX.utils.encode_range({
    s: { r: 0, c: 0 },
    e: { r: rows.length - 1, c: headers.length - 1 },
  });

  ws["!cols"] = [
    { wch: 16 },
    { wch: 32 },
    { wch: 14 },
    { wch: 22 },
    { wch: 18 },
    { wch: 12 },
    { wch: 38 },
    { wch: 14 },
    { wch: 14 },
  ];

  XLSX.utils.book_append_sheet(wb, ws, "Jadwal Kunjungan");

  const filename = `Master_Jadwal_Kunjungan_${safeDepot}.xlsx`;
  XLSX.writeFile(wb, filename);
  return filename;
}

/**
 * Membaca dan mem-parse file Excel Master Jadwal yang diunggah pengguna.
 */
export async function parseScheduleExcel(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const wb = XLSX.read(data, { type: "array" });
        const sheetName = wb.SheetNames[0];
        if (!sheetName) throw new Error("File Excel tidak memiliki sheet yang valid.");
        const ws = wb.Sheets[sheetName];
        const rawRows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });

        if (!rawRows || rawRows.length < 2) {
          throw new Error("File Excel kosong atau tidak memiliki baris data.");
        }

        let headerRowIdx = -1;
        let codeCol = -1;
        let dayCol = -1;

        const codeAliases = ["KODE OUTLET", "KDRL", "KODE TOKO", "KODE", "OUTLET_CODE", "CODE"];
        const dayAliases = ["HARI KUNJUNGAN", "HARI", "JADWAL", "DAY", "VISIT_DAY", "HARI_KUNJUNGAN"];

        for (let r = 0; r < Math.min(rawRows.length, 5); r++) {
          const row = rawRows[r].map((cell) => String(cell || "").trim().toUpperCase());
          const cIdx = row.findIndex((h) => codeAliases.includes(h));
          const dIdx = row.findIndex((h) => dayAliases.includes(h));

          if (cIdx !== -1 && dIdx !== -1) {
            headerRowIdx = r;
            codeCol = cIdx;
            dayCol = dIdx;
            break;
          }
        }

        if (headerRowIdx === -1 || codeCol === -1 || dayCol === -1) {
          throw new Error("Kolom 'KODE OUTLET' dan 'HARI KUNJUNGAN' tidak ditemukan di file Excel.");
        }

        const validDaysMap = {
          senin: "senin", monday: "senin", sen: "senin",
          selasa: "selasa", tuesday: "selasa", sel: "selasa",
          rabu: "rabu", wednesday: "rabu", rab: "rabu",
          kamis: "kamis", thursday: "kamis", kam: "kamis",
          jumat: "jumat", friday: "jumat", jum: "jumat",
          sabtu: "sabtu", saturday: "sabtu", sab: "sabtu",
        };

        const scheduleMap = {};
        let successCount = 0;
        let skippedCount = 0;

        for (let r = headerRowIdx + 1; r < rawRows.length; r++) {
          const row = rawRows[r];
          const code = String(row[codeCol] ?? "").trim();
          if (!code) continue;

          const rawDay = String(row[dayCol] ?? "").trim().toLowerCase();
          const normalizedDay = validDaysMap[rawDay];

          if (normalizedDay) {
            const parsed = parseOutletCode(code);
            scheduleMap[code] = {
              day: normalizedDay,
              areaCode: parsed.areaCode,
              updatedAt: new Date().toISOString(),
            };
            successCount++;
          } else {
            skippedCount++;
          }
        }

        resolve({
          totalRows: rawRows.length - (headerRowIdx + 1),
          successCount,
          skippedCount,
          scheduleMap,
        });
      } catch (err) {
        reject(err);
      }
    };

    reader.onerror = () => reject(new Error("Gagal membaca file Excel."));
    reader.readAsArrayBuffer(file);
  });
}

/* ============================================================================
   GENERATOR CALL SHEET WHATSAPP
   ============================================================================ */

/**
 * Menyusun format pesan WhatsApp "Call Sheet Jadwal Harian" untuk sales.
 */
export function buildDailyCallSheetWhatsApp({
  day = "senin",
  salesName = "",
  depotName = "",
  outlets = [],
  schedule = {},
}) {
  const dayLabel = (DAY_LABELS[day] || day).toUpperCase();
  const safeSales = salesName || "SALES";
  const safeDepot = depotName || "DEPO";

  const scheduledOutlets = outlets.filter((o) => schedule[o.outletCode]?.day === day);

  scheduledOutlets.sort((a, b) => {
    const areaA = parseOutletCode(a.outletCode).areaCode;
    const areaB = parseOutletCode(b.outletCode).areaCode;
    if (areaA !== areaB) return areaA.localeCompare(areaB);
    return (a.outletName || "").localeCompare(b.outletName || "");
  });

  const totalStores = scheduledOutlets.length;
  const totalValue = scheduledOutlets.reduce((sum, o) => sum + (o.value || 0), 0);
  const areas = Array.from(new Set(scheduledOutlets.map((o) => parseOutletCode(o.outletCode).areaCode))).filter(Boolean);

  const lines = [];
  lines.push(`📋 *JADWAL KUNJUNGAN SALES (${dayLabel})*`);
  lines.push(`🏢 *Depo*: ${safeDepot}`);
  lines.push(`👤 *Sales*: ${safeSales}`);
  lines.push(`📍 *Wilayah/Rayon*: ${areas.join(", ") || "-"}`);
  lines.push(`🏪 *Target Toko*: ${totalStores} Outlet`);
  if (totalValue > 0) {
    lines.push(`💰 *Estimasi Omzet*: ${fmtRp(totalValue)}`);
  }
  lines.push("━━━━━━━━━━━━━━━━━━━━━");

  if (totalStores === 0) {
    lines.push("_Belum ada outlet yang dijadwalkan untuk hari ini._");
  } else {
    lines.push("📍 *DAFTAR TOKO HARI INI:*");
    lines.push("");

    let currentArea = null;
    let counter = 1;

    scheduledOutlets.forEach((o) => {
      const parsed = parseOutletCode(o.outletCode);
      if (parsed.areaCode !== currentArea) {
        currentArea = parsed.areaCode;
        lines.push(`🔹 *WILAYAH: ${currentArea}*`);
      }

      let storeLine = `${counter}. *${o.outletName}* [${o.outletCode}]`;
      if (o.outletAddress && o.outletAddress.trim()) {
        storeLine += `\n   🏠 ${o.outletAddress.trim()}`;
      }
      lines.push(storeLine);
      counter++;
    });
  }

  lines.push("");
  lines.push("━━━━━━━━━━━━━━━━━━━━━");
  lines.push("💡 _Generated otomatis via Monitoring Penjualan Sales_");
  lines.push("#BeatPlan #JadwalKunjungan #SemangatJualan");

  return lines.join("\n");
}
