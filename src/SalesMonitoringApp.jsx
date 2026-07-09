import React, { useState, useMemo, useCallback, useEffect, useRef } from "react";
import * as XLSX from "xlsx-js-style";
import _ from "lodash";
import {
  ResponsiveContainer, BarChart, Bar, LineChart, Line, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, Cell,
} from "recharts";
import { 
  Upload, Download, X, ChevronDown, Search, RefreshCw, Users, Package,
  Target, TrendingUp, TrendingDown, Sparkles, LayoutDashboard, UserRound,
  Boxes, Crosshair, Check, AlertTriangle, CalendarDays, Settings,
  FileSpreadsheet, ArrowUpRight, ArrowDownRight, Minus, Sun, Moon, ChevronLeft, ChevronRight, Menu, Filter, Loader2,
  Store, Trophy, BellRing, Rocket, MapPin, ClipboardList, CheckCircle2, XCircle, FileQuestion,
} from "lucide-react";
import { fmtRp, fmtNum, fmtPct } from "./utils/formatters.js";
import { saveSettings, loadSettings, clearSettings, saveSession, loadSession, clearSession } from "./utils/storage.js";
import { useCountUp } from "./hooks/useCountUp.js";
import { KpiCard } from "./components/KpiCard.jsx";
import { AchBadge } from "./components/AchBadge.jsx";
import { PaceStrip } from "./components/PaceStrip.jsx";

/* ============================================================================
   DESIGN TOKENS
   Ink navy surface, gold = on-pace, coral = behind pace, mint = growth,
   violet = focus-product accent. Display: Space Grotesk, Body: Inter,
   Data/mono: JetBrains Mono.
============================================================================ */
import { THEMES } from "./constants/colors.js";

const createGlobalStyle = (colors) => `
@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@500;600&display=swap');
* { box-sizing: border-box; }
.smapp { font-family: 'Inter', sans-serif; color: ${colors.text}; background: ${colors.ink}; }
.smapp .disp { font-family: 'Space Grotesk', sans-serif; }
.smapp .mono { font-family: 'JetBrains Mono', monospace; }
.smapp *::-webkit-scrollbar { height: 8px; width: 8px; }
.smapp *::-webkit-scrollbar-thumb { background: ${colors.border}; border-radius: 4px; border: 2px solid ${colors.ink}; }
.smapp *::-webkit-scrollbar-track { background: transparent; }
@keyframes smFadeUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
@keyframes smFadeIn { from { opacity: 0; } to { opacity: 1; } }
@keyframes smPulse { 0%,100% { opacity:1 } 50% { opacity:.55 } }
@keyframes smShimmer { 0% { background-position: -400px 0; } 100% { background-position: 400px 0; } }
@keyframes smDash { from { stroke-dashoffset: 300; } to { stroke-dashoffset: 0; } }
.sm-fadeup { animation: smFadeUp .45s cubic-bezier(.16,1,.3,1) both; transition: background .3s ease, border-color .3s ease, box-shadow .3s ease; }
.sm-fadein { animation: smFadeIn .3s ease both; transition: background .3s ease, border-color .3s ease, box-shadow .3s ease; }
.sm-pulse { animation: smPulse 1.8s ease-in-out infinite; }
.sm-shimmer { background: linear-gradient(90deg, ${colors.surface2} 0%, ${colors.border} 50%, ${colors.surface2} 100%); background-size: 800px 100%; animation: smShimmer 1.4s linear infinite; }
.sm-card { background: ${colors.surface}; border-radius: 16px; transition: transform .25s ease, box-shadow .25s ease, background .3s ease; box-shadow: 6px 6px 12px ${colors.shadow1}, -6px -6px 12px ${colors.shadow2}; }
.sm-card:hover { transform: translateY(-2px); box-shadow: 8px 8px 16px ${colors.shadow1}, -8px -8px 16px ${colors.shadow2}; }
.sm-tab-btn { position: relative; transition: color .2s ease; }
.sm-chip { transition: all .18s ease; }
.sm-chip:hover { transform: translateY(-1px); }
.sm-row { transition: background .15s ease; }
.sm-row:hover { background: ${colors.surface2}; }
.sm-btn { transition: transform .2s ease, box-shadow .2s ease, background .2s ease; box-shadow: 4px 4px 8px ${colors.shadow1}, -4px -4px 8px ${colors.shadow2}; }
.sm-btn:hover { transform: translateY(-2px); box-shadow: 6px 6px 10px ${colors.shadow1}, -6px -6px 10px ${colors.shadow2}; }
.sm-btn:active { transform: translateY(0); box-shadow: inset 3px 3px 6px ${colors.shadowInset1}, inset -3px -3px 6px ${colors.shadowInset2}; }
.sm-progress-fill { transition: width 1s cubic-bezier(.16,1,.3,1); }
.sm-drop { transition: border-color .2s ease, background .2s ease; }
.sm-scale-in { animation: smFadeUp .5s cubic-bezier(.16,1,.3,1) both; }
`;

/* ============================================================================
   DEFAULT TARGET CONFIG  (carried over structure — editable in-app)
============================================================================ */
const DEFAULT_TARGETS = [
  { code: "AGM", name: "AGUNG MULIADI", tier: "mint", total: { value: 249910430, ao: 255 },
    groups: [{ name: "ENESIS", value: 163875988, ao: 255 }, { name: "ENESIS-NF", value: 86034443, ao: 255 }], focus: [] },
  { code: "HBB", name: "HABIBURROHMAN, SHI", tier: "mint", total: { value: 264185709, ao: 277 },
    groups: [{ name: "ENESIS", value: 182184972, ao: 277 }, { name: "ENESIS-NF", value: 82000737, ao: 277 }], focus: [] },
  { code: "NMM", name: "NUKMAN MUZAKKI", tier: "mint", total: { value: 522042079, ao: 290 },
    groups: [{ name: "ENESIS", value: 450862419, ao: 290 }, { name: "ENESIS-NF", value: 71179659, ao: 290 }], focus: [] },
  { code: "BKN", name: "BUDI KARYAWAN", tier: "amber", total: { value: 445000000, ao: 250 },
    groups: [
      { name: "B-FOODS", value: 90000000, ao: 180 }, { name: "KEXIN FOOD", value: 10000000, ao: 60 },
      { name: "MI KRITING", value: 45000000, ao: 100 }, { name: "MOCHI CONLEY", value: 185000000, ao: 120 },
      { name: "PLANGI JAYA", value: 55000000, ao: 120 }, { name: "SHB", value: 4000000, ao: 20 },
      { name: "SNACK", value: 30000000, ao: 140 }, { name: "SWEET TEN GROUP", value: 20000000, ao: 40 },
      { name: "SWEET TEN SNACK", value: 6000000, ao: 40 },
    ],
    focus: [
      { name: "FISH CAKE", target: 60, keyword: "FISH", unit: "KARTON" }, { name: "PANDA", target: 60, keyword: "PANDA", unit: "KARTON" },
      { name: "MI KRITING", target: 1000, keyword: "MI GAJAH", unit: "IKAT" }, { name: "ROTI RENYAH", target: 120, keyword: "RENYAH", unit: "KARTON" },
      { name: "MOCHI MINI", target: 40, keyword: "MOCHI MINI", unit: "KARTON" }, { name: "MOCHI SUPER", target: 60, keyword: "MOCHI SUPER", unit: "KARTON" },
      { name: "KALIO CHIPS 6X10", target: 200, keyword: "KALIO CHIP", unit: "KARTON" }, { name: "TAIKO CHIPS 10 X 10", target: 200, keyword: "TAIKO CHIPS", unit: "KARTON" },
      { name: "ULALA", target: 150, keyword: "ULALA", unit: "KARTON" },
    ] },
  { code: "TF", name: "TAUFAN ARI KUSAIRI", tier: "amber", total: { value: 270000000, ao: 250 },
    groups: [
      { name: "B-FOODS", value: 75000000, ao: 180 }, { name: "KEXIN FOOD", value: 15000000, ao: 80 },
      { name: "MI KRITING", value: 30000000, ao: 80 }, { name: "MOCHI CONLEY", value: 60000000, ao: 120 },
      { name: "PLANGI JAYA", value: 40000000, ao: 120 }, { name: "SHB", value: 4000000, ao: 40 },
      { name: "SNACK", value: 25000000, ao: 140 }, { name: "SWEET TEN GROUP", value: 15000000, ao: 40 },
      { name: "SWEET TEN SNACK", value: 6000000, ao: 40 },
    ],
    focus: [
      { name: "FISH CAKE", target: 40, keyword: "FISH", unit: "KARTON" }, { name: "PANDA", target: 40, keyword: "PANDA", unit: "KARTON" },
      { name: "MI KRITING", target: 600, keyword: "MI GAJAH", unit: "IKAT" }, { name: "ROTI RENYAH", target: 80, keyword: "RENYAH", unit: "KARTON" },
      { name: "MOCHI MINI", target: 30, keyword: "MOCHI MINI", unit: "KARTON" }, { name: "MOCHI SUPER", target: 40, keyword: "MOCHI SUPER", unit: "KARTON" },
      { name: "KALIO CHIPS 6X10", target: 150, keyword: "KALIO CHIP", unit: "KARTON" }, { name: "TAIKO CHIPS 10 X 10", target: 150, keyword: "TAIKO CHIPS", unit: "KARTON" },
      { name: "ULALA", target: 80, keyword: "ULALA", unit: "KARTON" },
    ] },
  { code: "AZ", name: "AZUL AZMIL SANI", tier: "amber", total: { value: 269000000, ao: 250 },
    groups: [
      { name: "B-FOODS", value: 85000000, ao: 180 }, { name: "KEXIN FOOD", value: 15000000, ao: 40 },
      { name: "MI KRITING", value: 25000000, ao: 80 }, { name: "MOCHI CONLEY", value: 60000000, ao: 120 },
      { name: "PLANGI JAYA", value: 40000000, ao: 120 }, { name: "SHB", value: 4000000, ao: 40 },
      { name: "SNACK", value: 20000000, ao: 140 }, { name: "SWEET TEN GROUP", value: 15000000, ao: 40 },
      { name: "SWEET TEN SNACK", value: 5000000, ao: 40 },
    ],
    focus: [
      { name: "FISH CAKE", target: 40, keyword: "FISH", unit: "KARTON" }, { name: "PANDA", target: 40, keyword: "PANDA", unit: "KARTON" },
      { name: "MI KRITING", target: 600, keyword: "MI GAJAH", unit: "IKAT" }, { name: "ROTI RENYAH", target: 120, keyword: "RENYAH", unit: "KARTON" },
      { name: "MOCHI MINI", target: 80, keyword: "MOCHI MINI", unit: "KARTON" }, { name: "MOCHI SUPER", target: 60, keyword: "MOCHI SUPER", unit: "KARTON" },
      { name: "KALIO CHIPS 6X10", target: 60, keyword: "KALIO CHIP", unit: "KARTON" }, { name: "TAIKO CHIPS 10 X 10", target: 50, keyword: "TAIKO CHIPS", unit: "KARTON" },
      { name: "ULALA", target: 50, keyword: "ULALA", unit: "KARTON" },
    ] },
  { code: "SS", name: "SUSAN HANI", tier: "amber", total: { value: 400500000, ao: 250 },
    groups: [
      { name: "BATTERY", value: 7500000, ao: 40 }, { name: "ILS", value: 0, ao: 0 }, { name: "IWM", value: 6000000, ao: 30 },
      { name: "MAAM MAAM", value: 48000000, ao: 120 }, { name: "PMM-MOCHI", value: 0, ao: 0 },
      { name: "PUSAN MANIS MULIA", value: 15000000, ao: 40 }, { name: "ROTI", value: 250000000, ao: 210 },
      { name: "RPFI", value: 70000000, ao: 180 }, { name: "GAS", value: 4000000, ao: 15 },
    ],
    focus: [
      { name: "JES LOLY", target: 30, keyword: "JESS LOLY", unit: "KARTON" }, { name: "TEABUZZ", target: 15, keyword: "TEE BUZZ", unit: "KARTON" },
      { name: "CUSTARD", target: 15, keyword: "CUSTARD", unit: "KARTON" }, { name: "KARIZATO", target: 20, keyword: "KARIZATO", unit: "KARTON" },
      { name: "DOLAR CHOCO", target: 20, keyword: "DOLLAR", unit: "KARTON" }, { name: "LOLY POP MILENI", target: 10, keyword: "LOLY POP", unit: "KARTON" },
      { name: "BRITOBAR", target: 20, keyword: "BRITOBAR", unit: "KARTON" }, { name: "CHOCO CRUN 3X20", target: 150, keyword: "COCO CRUNCH", unit: "KARTON" },
      { name: "GAS", target: 6, keyword: "PURITY", unit: "KARTON" },
    ] },
  { code: "SOF", name: "SOFYAN HADI", tier: "amber", total: { value: 264500000, ao: 250 },
    groups: [
      { name: "BATTERY", value: 7500000, ao: 40 }, { name: "ILS", value: 0, ao: 0 }, { name: "IWM", value: 6000000, ao: 30 },
      { name: "MAAM MAAM", value: 25000000, ao: 120 }, { name: "PMM-MOCHI", value: 0, ao: 0 },
      { name: "PUSAN MANIS MULIA", value: 15000000, ao: 80 }, { name: "ROTI", value: 130000000, ao: 180 },
      { name: "RPFI", value: 80000000, ao: 180 }, { name: "GAS", value: 1000000, ao: 15 },
    ],
    focus: [
      { name: "JES LOLY", target: 10, keyword: "JESS LOLY", unit: "KARTON" }, { name: "TEABUZZ", target: 15, keyword: "TEE BUZZ", unit: "KARTON" },
      { name: "CUSTARD", target: 8, keyword: "CUSTARD", unit: "KARTON" }, { name: "KARIZATO", target: 10, keyword: "KARIZATO", unit: "KARTON" },
      { name: "DOLAR CHOCO", target: 10, keyword: "DOLLAR", unit: "KARTON" }, { name: "LOLY POP MILENI", target: 15, keyword: "LOLY POP", unit: "KARTON" },
      { name: "BRITOBAR", target: 20, keyword: "BRITOBAR", unit: "KARTON" }, { name: "CHOCO CRUN 3X20", target: 150, keyword: "COCO CRUNCH", unit: "KARTON" },
      { name: "GAS", target: 6, keyword: "PURITY", unit: "KARTON" },
    ] },
  { code: "IGP", name: "I GUSTI PUTU SUARDIKA", tier: "amber", total: { value: 378500000, ao: 250 },
    groups: [
      { name: "BATTERY", value: 7500000, ao: 40 }, { name: "ILS", value: 0, ao: 0 }, { name: "IWM", value: 6000000, ao: 30 },
      { name: "MAAM MAAM", value: 39000000, ao: 120 }, { name: "PMM-MOCHI", value: 0, ao: 0 },
      { name: "PUSAN MANIS MULIA", value: 15000000, ao: 80 }, { name: "ROTI", value: 220000000, ao: 180 },
      { name: "RPFI", value: 90000000, ao: 180 }, { name: "GAS", value: 1000000, ao: 15 },
    ],
    focus: [
      { name: "JES LOLY", target: 10, keyword: "JESS LOLY", unit: "KARTON" }, { name: "TEABUZZ", target: 15, keyword: "TEE BUZZ", unit: "KARTON" },
      { name: "CUSTARD", target: 8, keyword: "CUSTARD", unit: "KARTON" }, { name: "KARIZATO", target: 10, keyword: "KARIZATO", unit: "KARTON" },
      { name: "DOLAR CHOCO", target: 10, keyword: "DOLLAR", unit: "KARTON" }, { name: "LOLY POP MILENI", target: 15, keyword: "LOLY POP", unit: "KARTON" },
      { name: "BRITOBAR", target: 20, keyword: "BRITOBAR", unit: "KARTON" }, { name: "CHOCO CRUN 3X20", target: 150, keyword: "COCO CRUNCH", unit: "KARTON" },
      { name: "GAS", target: 6, keyword: "PURITY", unit: "KARTON" },
    ] },
  { code: "HEM", name: "HEMA MALIHI", tier: "violet", total: { value: 178300000, ao: 240 },
    groups: [{ name: "PLANGI 2", value: 153300000, ao: 240 }, { name: "PLANGI JAYA", value: 25000988, ao: 130 }], focus: [] },
  { code: "ANI", name: "MARIA ANDRIANI", tier: "violet", total: { value: 178300000, ao: 240 },
    groups: [{ name: "PLANGI 2", value: 153300709, ao: 240 }, { name: "PLANGI JAYA", value: 25000000, ao: 130 }], focus: [] },
];

const WORK_DAYS_DEFAULT = 27;

/* ============================================================================
   COLUMN ALIASES for flexible excel parsing
============================================================================ */
const ALIASES = {
  date: ["TGFK", "TANGGAL", "TANGGAL FAKTUR", "DATE"],
  salesCode: ["KDSL", "KODE SALES", "SALES CODE", "KODE SALESMAN"],
  salesName: ["NMSL", "SALESMAN", "NAMA SALES", "NAMA SALESMAN"],
  outletCode: ["KDRL", "KODE OUTLET", "KODE TOKO"],
  outletName: ["NMRL", "NAMA OUTLET", "NAMA TOKO"],
  invoiceNo: ["NOFK", "NO FAKTUR", "INVOICE"],
  productCode: ["KDBR", "KODE BARANG", "KODE PRODUK"],
  productName: ["NMBR", "NAMA BARANG", "PRODUCT", "PRODUK"],
  qty: ["JUML", "QTY", "QUANTITY"],
  unit: ["UNIT", "SATUAN"],
  konv: ["KONV"],
  baseUnit: ["UNITK"],
  value: ["NTOT", "VALUE", "NILAI", "TOTAL"],
  group: ["GRUP", "GROUP", "KATEGORI", "GOLONGAN"],
};

const FIELD_LABELS = {
  date: "Tanggal", salesCode: "Kode Sales", salesName: "Nama Sales", outletCode: "Kode Outlet",
  outletName: "Nama Outlet", invoiceNo: "No Faktur", productCode: "Kode Produk", productName: "Nama Produk",
  qty: "Kuantitas", unit: "Satuan", konv: "Faktor Konversi (KONV)", baseUnit: "Satuan Dasar (UNITK)",
  value: "Nilai (Rp)", group: "Grup Produk",
};

function normalizeHeader(h) { return String(h || "").trim().toUpperCase(); }

function buildFieldMap(headerRow) {
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
function excelValueToDateStr(v) {
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
function todayLocalDateStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Buat objek Date lokal dari teks "YYYY-MM-DD" — dipakai HANYA saat export ke Excel,
// supaya kolom tanggal di file hasil export tetap berupa tanggal asli (bukan teks),
// tanpa membawa balik ambiguitas UTC/lokal karena kita yang membangunnya sendiri.
function dateStrToLocalDate(s) {
  if (!s) return null;
  const [y, m, d] = s.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

function parseWorkbookFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target.result, { type: "array" });
        const sheetName = wb.SheetNames[0];
        const ws = wb.Sheets[sheetName];
        const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: true });
        if (!aoa.length) {
          return resolve({ rows: [], parseMeta: { sheetName, totalDataRows: 0, skippedBlankRows: 0, rowsWithMissingDate: 0,
            detectedFields: [], missingFields: Object.keys(ALIASES) } });
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

// Beberapa barang dijual dalam lebih dari satu satuan (mis. KARTON, KTK, PCS, CAN).
// Setiap baris transaksi punya KONV (faktor ke satuan dasar UNITK) sendiri-sendiri —
// termasuk baris yang satuannya KARTON. Baris KARTON itu jadi "kurs resmi" produk
// tersebut ("1 KARTON = KONV satuan dasar"), dipakai untuk mengonversi baris lain
// (satuan apa pun) menjadi setara KARTON: qtyKarton = (qty * KONV baris ini) / KONV baris KARTON.
// Kalau produk itu tidak pernah muncul dengan satuan KARTON sama sekali di data, konversinya
// tidak bisa diturunkan — qtyKarton diberi null dan ditandai lewat `unconvertible: true`
// supaya tetap terlihat di UI, bukan diam-diam dianggap benar.
function attachKartonQty(rows) {
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
function effectiveKartonQty(row) {
  return row.qtyKarton !== null && row.qtyKarton !== undefined ? row.qtyKarton : row.qty;
}

// Kumpulan semua catatan kualitas data dari SELURUH data yang diupload (tidak terpengaruh
// filter yang sedang aktif di dashboard) — dipakai oleh halaman "Catatan Data".
function useDataQualityNotes(rawRows, targets, parseMeta) {
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
      detectedFields: parseMeta?.detectedFields || [],
      missingFields: parseMeta?.missingFields || [],
      missingDateCount,
      unknownSales: Object.values(unknownSalesMap).sort((a, b) => b.value - a.value),
      unconvertibleProducts: Object.values(unconvertibleMap).sort((a, b) => b.rowCount - a.rowCount),
      unknownGroups: Object.values(unknownGroupMap).sort((a, b) => b.value - a.value),
    };
  }, [rawRows, targets, parseMeta]);
}

/* ---- compact sample data generator (for "Load Sample Data") ---- */
function generateSampleRows() {
  const groupsOf = {};
  DEFAULT_TARGETS.forEach((s) => { groupsOf[s.code] = s.groups.length ? s.groups : [{ name: "UMUM" }]; });
  const rows = [];
  let seed = 42;
  const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
  const dates = ["2026-07-01", "2026-07-02", "2026-07-03"];
  DEFAULT_TARGETS.forEach((s) => {
    s.groups.forEach((g, gi) => {
      const nOutlets = 2 + Math.floor(rnd() * 3);
      for (let o = 0; o < nOutlets; o++) {
                const d = dates[Math.floor(rnd() * dates.length)];
        const pctOfTarget = 0.005 + rnd() * 0.06;
        const value = Math.round((g.value || 500000) * pctOfTarget / nOutlets);
        rows.push({
          date: d, salesCode: s.code, salesName: s.name,
          outletCode: `${s.code}-OUT${o + 1}`, outletName: `Toko ${s.code} ${o + 1}`,
          invoiceNo: `INV${s.code}${gi}${o}`, productName: `${g.name} SAMPLE ITEM`,
          qty: Math.max(1, Math.round(rnd() * 20)), unit: "KARTON", value, group: g.name,
        });
      }
    });
  });
  return attachKartonQty(rows);
}

/* ============================================================================
   AGGREGATION HELPERS
============================================================================ */
// row.date sudah berupa teks "YYYY-MM-DD" (lihat excelValueToDateStr), jadi tinggal dipakai apa adanya.
function dateKey(dateStr) { return dateStr || "unknown"; }
function monthKey(dateStr) { return dateStr ? dateStr.slice(0, 7) : "unknown"; }

function matchFocus(row, focusItem) {
  if (focusItem.keyword === "__GROUP__") return normalizeHeader(row.group) === normalizeHeader(focusItem.name);

  // Catatan: field `unit` pada konfigurasi produk fokus tidak lagi dipakai untuk
  // menyaring baris — sejak kuantitas otomatis dikonversi ke setara KARTON
  // (lihat attachKartonQty/effectiveKartonQty), pencocokan cukup berdasarkan
  // nama/grup produk saja, apa pun satuan asli transaksinya.
  if (focusItem.keyword === "GAS_EXACT") return normalizeHeader(row.productName) === "GAS";
  return normalizeHeader(row.productName).includes(normalizeHeader(focusItem.keyword));
}

// Rincian per outlet untuk fitur drill-down — menerima kumpulan baris (biasanya
// agg.filteredRows) dan sebuah predicate (fungsi filter tambahan: per sales, per
// grup, atau per produk fokus), lalu kelompokkan berdasarkan outlet.
function getOutletBreakdown(rows, predicate) {
  const matched = predicate ? rows.filter(predicate) : rows;
  const map = {};
  matched.forEach((r) => {
    const key = r.outletCode || r.outletName || "UNKNOWN";
    if (!map[key]) {
      map[key] = { outletCode: r.outletCode, outletName: r.outletName || r.outletCode || "(tanpa nama)",
        value: 0, qty: 0, invoices: new Set(), lastDate: null };
    }
    map[key].value += r.value;
    map[key].qty += effectiveKartonQty(r);
    if (r.invoiceNo) map[key].invoices.add(r.invoiceNo);
    if (!map[key].lastDate || r.date > map[key].lastDate) map[key].lastDate = r.date;
  });
  return Object.values(map)
    .map((o) => ({ ...o, invoiceCount: o.invoices.size }))
    .sort((a, b) => b.value - a.value);
}
// - Kalau semua baris yang cocok berhasil dikonversi -> "KARTON" (satuan hasil konversi).
// - Kalau semua baris TIDAK bisa dikonversi (tidak ada referensi KARTON di data untuk
//   produk itu) -> pakai satuan asli transaksinya apa adanya (mis. "IKAT").
// - Kalau campuran (sebagian bisa dikonversi, sebagian tidak, atau satuan aslinya
//   berbeda-beda) -> tandai "Campuran" supaya tidak menyesatkan.
function resolveFocusUnit(rows) {
  if (!rows.length) return "KARTON";
  const unconv = rows.filter((r) => r.unconvertible);
  if (unconv.length === 0) return "KARTON";
  if (unconv.length === rows.length) {
    const units = new Set(unconv.map((r) => r.unit || "?"));
    return units.size === 1 ? [...units][0] : "Campuran";
  }
  return "Campuran";
}

function useAggregates(rows, targets, filters, workDays) {
  return useMemo(() => {
    const inRange = (dateStr) => {
      if (!filters.dateFrom && !filters.dateTo) return true;
      if (!dateStr) return false;
      // dateStr, filters.dateFrom, filters.dateTo semuanya teks "YYYY-MM-DD" —
      // perbandingan teks di format ini otomatis benar secara kronologis.
      if (filters.dateFrom && dateStr < filters.dateFrom) return false;
      if (filters.dateTo && dateStr > filters.dateTo) return false;
      return true;
    };
    const filtered = rows.filter((r) => {
      if (!inRange(r.date)) return false;
      if (filters.salesCodes.length && !filters.salesCodes.includes(r.salesCode)) return false;
      if (filters.groups.length && !filters.groups.includes(r.group)) return false;
      return true;
    });

    const relevantTargets = filters.salesCodes.length
      ? targets.filter((t) => filters.salesCodes.includes(t.code))
      : targets;

    // per sales
    const bySales = relevantTargets.map((t) => {
      const rs = filtered.filter((r) => r.salesCode === t.code);
      const value = _.sumBy(rs, "value");
      const ao = new Set(rs.map((r) => r.outletCode)).size;
      const ach = t.total.value ? value / t.total.value : null;
      const achAo = t.total.ao ? ao / t.total.ao : null;

      // Breakdown per grup produk milik sales ini — dipakai untuk export baris-per-baris.
      const groups = t.groups.map((g) => {
        const grs = rs.filter((r) => r.group === g.name);
        const gValue = _.sumBy(grs, "value");
        const gAo = new Set(grs.map((r) => r.outletCode)).size;
        return {
          name: g.name, targetValue: g.value, targetAo: g.ao,
          realisasiValue: gValue, realisasiAo: gAo,
          ach: g.value ? gValue / g.value : null, achAo: g.ao ? gAo / g.ao : null,
          deviasiValue: g.value ? g.value - gValue : 0, deviasiAo: g.ao ? g.ao - gAo : 0,
          predicate: (row) => row.salesCode === t.code && row.group === g.name,
        };
      });

      // Breakdown per produk fokus milik sales ini — sejajar dengan `groups` di atas.
      const focus = t.focus.map((f) => {
        const frs = rs.filter((r) => matchFocus(r, f));
        const realisasi = _.sumBy(frs, effectiveKartonQty);
        const hasUnconvertible = frs.some((r) => r.unconvertible);
        const unit = resolveFocusUnit(frs);
        return { name: f.name, target: f.target, realisasi, pct: f.target ? realisasi / f.target : null, hasUnconvertible, unit,
          predicate: (row) => row.salesCode === t.code && matchFocus(row, f) };
      });

      return { code: t.code, name: t.name, tier: t.tier, targetValue: t.total.value, targetAo: t.total.ao,
        realisasiValue: value, realisasiAo: ao, ach, achAo,
        deviasiValue: t.total.value ? t.total.value - value : null,
        deviasiAo: t.total.ao ? t.total.ao - ao : null,
        groups, focus, predicate: (row) => row.salesCode === t.code };
    });

    const totalTargetValue = _.sumBy(bySales, "targetValue");
    const totalTargetAo = _.sumBy(bySales, "targetAo");
    const totalRealisasiValue = _.sumBy(bySales, "realisasiValue");
    const totalRealisasiAo = new Set(filtered.map((r) => r.salesCode + "|" + r.outletCode)).size;
    const overallAch = totalTargetValue ? totalRealisasiValue / totalTargetValue : null;

    // by group (respecting the group filter list of allowed groups, else all groups present in targets ∪ data)
    const groupNamesSet = new Set();
    relevantTargets.forEach((t) => t.groups.forEach((g) => groupNamesSet.add(g.name)));
    filtered.forEach((r) => r.group && groupNamesSet.add(r.group));
    let groupNames = Array.from(groupNamesSet);
    if (filters.groups.length) groupNames = groupNames.filter((g) => filters.groups.includes(g));

    const byGroup = groupNames.map((gname) => {
      const targetValue = _.sumBy(relevantTargets, (t) => _.sumBy(t.groups.filter((g) => g.name === gname), "value"));
      const targetAo = _.sumBy(relevantTargets, (t) => _.sumBy(t.groups.filter((g) => g.name === gname), "ao"));
      const rs = filtered.filter((r) => r.group === gname);
      const value = _.sumBy(rs, "value");
      const ao = new Set(rs.map((r) => r.outletCode)).size;
      const ach = targetValue ? value / targetValue : null;
      return { name: gname, targetValue, targetAo, realisasiValue: value, realisasiAo: ao, ach,
        deviasiValue: targetValue ? targetValue - value : null,
        predicate: (row) => row.group === gname };
    }).sort((a, b) => b.realisasiValue - a.realisasiValue);

    // daily series
    const dailyMap = {};
    filtered.forEach((r) => {
      const k = dateKey(r.date);
      if (!dailyMap[k]) dailyMap[k] = { date: k, value: 0, outlets: new Set() };
      dailyMap[k].value += r.value;
      dailyMap[k].outlets.add(r.outletCode);
    });
    const daily = Object.values(dailyMap)
      .map((d) => ({ date: d.date, value: d.value, ao: d.outlets.size }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // monthly (cumulative) series
    const monthlyMap = {};
    filtered.forEach((r) => {
      const k = monthKey(r.date);
      monthlyMap[k] = (monthlyMap[k] || 0) + r.value;
    });
    const monthly = Object.entries(monthlyMap).map(([m, v]) => ({ month: m, value: v })).sort((a, b) => a.month.localeCompare(b.month));

    // focus products
    const focusRows = [];
    relevantTargets.forEach((t) => {
      t.focus.forEach((f) => {
        const rs = filtered.filter((r) => r.salesCode === t.code && matchFocus(r, f));
        const realisasi = _.sumBy(rs, effectiveKartonQty);
        const pct = f.target ? realisasi / f.target : null;
        const hasUnconvertible = rs.some((r) => r.unconvertible);
        const unit = resolveFocusUnit(rs);
        focusRows.push({ salesCode: t.code, salesName: t.name, name: f.name, target: f.target, realisasi, pct, hasUnconvertible, unit,
          predicate: (row) => row.salesCode === t.code && matchFocus(row, f) });
      });
    });

    // Info tanggal untuk header laporan (BULAN, SD HARI INI, tanggal "per")
    const uniqueDateStrs = Array.from(new Set(filtered.map((r) => r.date).filter(Boolean))).sort();
    const meta = {
      firstDate: uniqueDateStrs[0] || null,
      lastDate: uniqueDateStrs[uniqueDateStrs.length - 1] || null,
      uniqueDays: uniqueDateStrs.length,
    };

    // ---- Proyeksi akhir bulan: ekstrapolasi linear dari rata-rata realisasi/hari ----
    const dailyRate = meta.uniqueDays > 0 ? totalRealisasiValue / meta.uniqueDays : 0;
    const projectedValue = workDays ? dailyRate * workDays : null;
    const projection = {
      dailyRate,
      projectedValue,
      projectedAch: (projectedValue !== null && totalTargetValue) ? projectedValue / totalTargetValue : null,
      daysRemaining: workDays ? Math.max(0, workDays - meta.uniqueDays) : null,
    };
    bySales.forEach((sm) => {
      const smDailyRate = meta.uniqueDays > 0 ? sm.realisasiValue / meta.uniqueDays : 0;
      sm.projectedValue = workDays ? smDailyRate * workDays : null;
      sm.projectedAch = (sm.projectedValue !== null && sm.targetValue) ? sm.projectedValue / sm.targetValue : null;
    });

    // ---- Peringatan otomatis: sales/produk fokus yang masih 0% padahal sudah lewat beberapa hari kerja ----
    const ALERT_MIN_DAYS = 3;
    const alerts = [];
    if (meta.uniqueDays >= ALERT_MIN_DAYS) {
      bySales.forEach((sm) => {
        if (sm.targetValue > 0 && sm.realisasiValue === 0) {
          alerts.push({ type: "sales", title: sm.name, message: "Belum ada realisasi sama sekali", predicate: sm.predicate });
        }
        sm.focus.forEach((f) => {
          if (f.target > 0 && f.realisasi === 0) {
            alerts.push({ type: "focus", title: `${sm.name} — ${f.name}`, message: "Produk fokus belum terjual sama sekali", predicate: f.predicate });
          }
        });
      });
    }

    return {
      filteredRows: filtered, bySales, byGroup, daily, monthly, focusRows, meta, projection, alerts,
      totals: { targetValue: totalTargetValue, targetAo: totalTargetAo, realisasiValue: totalRealisasiValue,
        realisasiAo: totalRealisasiAo, ach: overallAch,
        deviasiValue: totalTargetValue ? totalTargetValue - totalRealisasiValue : null },
    };
  }, [rows, targets, filters, workDays]);
}

/* ============================================================================
   SMALL UI PRIMITIVES
============================================================================ */
function MultiSelect({ label, icon: Icon, options, selected, onChange, placeholder, colors }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const ref = useRef(null);
  useEffect(() => {
    const onClick = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);
  const filtered = options.filter((o) => o.toLowerCase().includes(q.toLowerCase()));
  const toggle = (o) => onChange(selected.includes(o) ? selected.filter((x) => x !== o) : [...selected, o]);
  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(!open)} className="sm-btn flex items-center gap-2 px-3 py-2 rounded-xl text-sm"
        style={{ background: colors.surface2, border: `1px solid ${selected.length ? colors.gold + "88" : colors.border}` }}>
        <Icon size={14} style={{ color: colors.textMuted }} />
        <span>{label}{selected.length ? ` (${selected.length})` : ""}</span>
        <ChevronDown size={14} style={{ color: colors.textMuted, transform: open ? "rotate(180deg)" : "none", transition: "transform .2s" }} />
      </button>
      {open && (
        <div className="sm-fadein absolute z-20 mt-2 w-64 rounded-xl p-2 shadow-2xl" style={{ background: colors.surface, border: `1px solid ${colors.border}` }}>
          <div className="flex items-center gap-2 px-2 py-1.5 mb-1 rounded-lg" style={{ background: colors.surface2 }}>
            <Search size={13} style={{ color: colors.textMuted }} />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={placeholder || "Cari..."}
              className="bg-transparent outline-none text-sm w-full" style={{ color: colors.text }} />
          </div>
          <div className="max-h-56 overflow-y-auto">
            {filtered.length === 0 && <div className="text-xs px-2 py-2" style={{ color: colors.textMuted }}>Tidak ada hasil</div>}
            {filtered.map((o) => (
              <button key={o} onClick={() => toggle(o)} className="sm-row w-full text-left flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm">
                <div className="w-4 h-4 rounded flex items-center justify-center" style={{ background: selected.includes(o) ? colors.gold : "transparent", border: `1px solid ${selected.includes(o) ? colors.gold : colors.border}` }}>
                  {selected.includes(o) && <Check size={11} color="#0A1120" />}
                </div>
                <span className="truncate">{o}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function FilterBar({ salesOptions, groupOptions, filters, setFilters, colors }) {
  const active = filters.salesCodes.length + filters.groups.length + (filters.dateFrom ? 1 : 0) + (filters.dateTo ? 1 : 0);
  const nameToCode = useMemo(() => Object.fromEntries(salesOptions.map((s) => [s.name, s.code])), [salesOptions]);
  const codeToName = useMemo(() => Object.fromEntries(salesOptions.map(s => [s.code, s.name])), [salesOptions]);
  const selectedNames = useMemo(() => filters.salesCodes.map(code => codeToName[code]).filter(Boolean), [filters.salesCodes, codeToName]);

  const handleSalesChange = (selectedNames) => {
    const selectedCodes = selectedNames.map(name => nameToCode[name]);
    setFilters(f => ({ ...f, salesCodes: selectedCodes }));
  };

  return (
    <div className="flex flex-wrap items-center gap-3 mb-6">
      <MultiSelect
        label="Sales"
        icon={Users}
        options={salesOptions.map(s => s.name)}
        selected={selectedNames}
        onChange={handleSalesChange}
        colors={colors}
        placeholder="Cari sales..."
      />
      <MultiSelect label="Grup Barang" icon={Package} options={groupOptions} selected={filters.groups}
        onChange={(v) => setFilters((f) => ({ ...f, groups: v }))} placeholder="Cari grup..." colors={colors} />
      <div className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm" style={{ background: colors.surface2, border: `1px solid ${colors.border}` }}>
        <CalendarDays size={14} style={{ color: colors.textMuted }} />
        <input type="date" value={filters.dateFrom || ""} onChange={(e) => setFilters((f) => ({ ...f, dateFrom: e.target.value }))}
          className="bg-transparent outline-none" style={{ color: colors.text, colorScheme: "dark" }} />
        <span style={{ color: colors.textMuted }}>-</span>
        <input type="date" value={filters.dateTo || ""} onChange={(e) => setFilters((f) => ({ ...f, dateTo: e.target.value }))}
          className="bg-transparent outline-none" style={{ color: colors.text, colorScheme: "dark" }} />
      </div>
      {active > 0 && (
        <button onClick={() => setFilters({ salesCodes: [], groups: [], dateFrom: "", dateTo: "" })}
          className="sm-btn flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm" style={{ color: colors.coral, background: colors.coral + "14", border: `1px solid ${colors.coral}33` }}>
          <RefreshCw size={13} /> Reset ({active})
        </button>
      )}
    </div>
  );
}

function DataTable({ columns, rows, initialSortKey, colors, searchable, searchKeys, searchPlaceholder }) {
  const [sortKey, setSortKey] = useState(initialSortKey || columns[0].key);
  const [sortDir, setSortDir] = useState("desc");
  const [query, setQuery] = useState("");

  // Kolom yang dijadikan target pencarian: pakai searchKeys eksplisit kalau ada,
  // kalau tidak, fallback ke semua kolom yang nilainya berupa string di baris pertama.
  const effectiveSearchKeys = useMemo(() => {
    if (searchKeys && searchKeys.length) return searchKeys;
    if (!rows.length) return [];
    return columns.map((c) => c.key).filter((k) => typeof rows[0][k] === "string");
  }, [searchKeys, columns, rows]);

  const filtered = useMemo(() => {
    if (!searchable || !query.trim()) return rows;
    const q = query.trim().toLowerCase();
    return rows.filter((row) => effectiveSearchKeys.some((k) => String(row[k] ?? "").toLowerCase().includes(q)));
  }, [rows, searchable, query, effectiveSearchKeys]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      const va = a[sortKey], vb = b[sortKey];
      if (typeof va === "string") return sortDir === "asc" ? va.localeCompare(vb) : vb.localeCompare(va);
      return sortDir === "asc" ? (va || 0) - (vb || 0) : (vb || 0) - (va || 0);
    });
    return arr;
  }, [filtered, sortKey, sortDir]);
  const toggleSort = (k) => { if (k === sortKey) setSortDir(sortDir === "asc" ? "desc" : "asc"); else { setSortKey(k); setSortDir("desc"); } };
  return (
    <div className="sm-card overflow-hidden">
      {searchable && (
        <div className="px-4 pt-4 pb-1">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: colors.textMuted }} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={searchPlaceholder || "Cari..."}
              className="w-full pl-9 pr-8 py-2 rounded-xl text-sm outline-none"
              style={{ background: colors.surface2, border: `1px solid ${colors.border}`, color: colors.text }}
            />
            {query && (
              <button onClick={() => setQuery("")} className="absolute right-2.5 top-1/2 -translate-y-1/2" style={{ color: colors.textMuted }}>
                <X size={14} />
              </button>
            )}
          </div>
          {query && (
            <div className="text-xs mt-1.5" style={{ color: colors.textMuted }}>
              {sorted.length} hasil untuk "{query}"
            </div>
          )}
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: colors.surface2 }}>
              {columns.map((c) => (
                <th key={c.key} onClick={() => toggleSort(c.key)} className="px-4 py-3 text-left cursor-pointer select-none whitespace-nowrap"
                  style={{ color: colors.textMuted, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  {c.label} {sortKey === c.key && (sortDir === "asc" ? "↑" : "↓")}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((row, i) => (
              <tr key={i} className="sm-row" style={{ borderTop: `1px solid ${colors.border}` }}>
                {columns.map((c) => (
                  <td key={c.key} className="px-4 py-3 whitespace-nowrap">
                    {c.render ? c.render(row) : row[c.key]}
                  </td>
                ))}
              </tr>
            ))}
            {sorted.length === 0 && (
              <tr><td colSpan={columns.length} className="px-4 py-10 text-center" style={{ color: colors.textMuted }}>
                {query ? "Tidak ada hasil yang cocok dengan pencarian" : "Belum ada data untuk filter ini"}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SectionTitle({ title, sub, icon: Icon, colors }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      {Icon && <div className="p-2 rounded-xl" style={{ background: colors.gold + "1A" }}><Icon size={16} style={{ color: colors.gold }} /></div>}
      <div>
        <h2 className="disp text-lg font-semibold">{title}</h2>
        {sub && <p className="text-xs" style={{ color: colors.textMuted }}>{sub}</p>}
      </div>
    </div>
  );
}

const createChartTooltipStyle = (colors) => ({ background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: 10, color: colors.text, fontSize: 12 });

// Tombol kecil untuk membuka rincian outlet (drill-down) dari sebuah baris tabel.
function DrilldownButton({ colors, onClick, label = "Outlet" }) {
  return (
    <button onClick={onClick} className="sm-btn inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium"
      style={{ background: colors.surface2, border: `1px solid ${colors.border}`, color: colors.textMuted }}>
      <Store size={12} /> {label}
    </button>
  );
}

// Modal rincian outlet — dipakai dari semua halaman (Main, Sales, Product, Product Focus)
// lewat callback onDrilldown yang sama.
function OutletDrilldownModal({ isOpen, onClose, title, subtitle, outlets, colors }) {
  const [query, setQuery] = useState("");
  // Reset pencarian setiap kali modal dibuka untuk konteks (sales/grup/fokus) yang baru,
  // supaya query lama dari drilldown sebelumnya tidak nyangkut.
  useEffect(() => { if (isOpen) setQuery(""); }, [isOpen, title]);

  if (!isOpen) return null;

  const filteredOutlets = query.trim()
    ? outlets.filter((o) => String(o.outletName || "").toLowerCase().includes(query.trim().toLowerCase()))
    : outlets;
  const totalValue = _.sumBy(filteredOutlets, "value");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm sm-fadein">
      <div className="sm-card sm-scale-in w-full max-w-2xl max-h-[85vh] flex flex-col" style={{ background: colors.surface }}>
        <div className="p-5 flex items-center justify-between" style={{ borderBottom: `1px solid ${colors.border}` }}>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl" style={{ background: colors.violet + "1A" }}><MapPin size={16} style={{ color: colors.violet }} /></div>
            <div>
              <div className="disp text-base font-semibold">{title}</div>
              {subtitle && <div className="text-xs" style={{ color: colors.textMuted }}>{subtitle}</div>}
            </div>
          </div>
          <button onClick={onClose} className="sm-btn p-2 rounded-full" style={{ background: colors.surface2 }}><X size={16} /></button>
        </div>
        {outlets.length > 0 && (
          <div className="px-5 pt-4">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: colors.textMuted }} />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Cari nama outlet..."
                className="w-full pl-9 pr-8 py-2 rounded-xl text-sm outline-none"
                style={{ background: colors.surface2, border: `1px solid ${colors.border}`, color: colors.text }}
              />
              {query && (
                <button onClick={() => setQuery("")} className="absolute right-2.5 top-1/2 -translate-y-1/2" style={{ color: colors.textMuted }}>
                  <X size={14} />
                </button>
              )}
            </div>
          </div>
        )}
        <div className="p-5 overflow-y-auto">
          {outlets.length === 0 ? (
            <div className="text-center py-10" style={{ color: colors.textMuted }}>Tidak ada transaksi outlet untuk kombinasi filter ini.</div>
          ) : filteredOutlets.length === 0 ? (
            <div className="text-center py-10" style={{ color: colors.textMuted }}>Tidak ada outlet yang cocok dengan pencarian "{query}".</div>
          ) : (
            <>
              <div className="text-xs mb-3" style={{ color: colors.textMuted }}>
                {filteredOutlets.length} outlet · total <span className="mono font-semibold" style={{ color: colors.text }}>{fmtRp(totalValue)}</span>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ background: colors.surface2 }}>
                    <th className="px-3 py-2 text-left" style={{ fontSize: 11, color: colors.textMuted }}>OUTLET</th>
                    <th className="px-3 py-2 text-right" style={{ fontSize: 11, color: colors.textMuted }}>VALUE</th>
                    <th className="px-3 py-2 text-center" style={{ fontSize: 11, color: colors.textMuted }}>QTY</th>
                    <th className="px-3 py-2 text-center" style={{ fontSize: 11, color: colors.textMuted }}>TRANSAKSI</th>
                    <th className="px-3 py-2 text-center" style={{ fontSize: 11, color: colors.textMuted }}>TERAKHIR</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredOutlets.map((o, i) => (
                    <tr key={i} className="sm-row" style={{ borderTop: `1px solid ${colors.border}` }}>
                      <td className="px-3 py-2">{o.outletName}</td>
                      <td className="px-3 py-2 mono text-right">{fmtRp(o.value)}</td>
                      <td className="px-3 py-2 mono text-center">{fmtNum(o.qty)}</td>
                      <td className="px-3 py-2 mono text-center">{o.invoiceCount}</td>
                      <td className="px-3 py-2 mono text-center" style={{ color: colors.textMuted }}>{o.lastDate || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// Modal preview sebelum data dipakai ke seluruh dashboard — menampilkan ringkasan
// hasil baca file (jumlah baris, rentang tanggal, kolom yang terdeteksi/tidak)
// supaya kesalahan format ketahuan lebih awal, bukan setelah lihat angka aneh di dashboard.
function DataPreviewModal({ isOpen, onCancel, onConfirm, preview, colors }) {
  if (!isOpen || !preview) return null;
  const { rows, parseMeta, fileName } = preview;
  const dateStrs = rows.map((r) => r.date).filter(Boolean).sort();
  const uniqueSales = new Set(rows.map((r) => r.salesCode).filter(Boolean)).size;
  const uniqueGroups = new Set(rows.map((r) => r.group).filter(Boolean)).size;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm sm-fadein">
      <div className="sm-card sm-scale-in w-full max-w-2xl max-h-[85vh] flex flex-col" style={{ background: colors.surface }}>
        <div className="p-5 flex items-center justify-between" style={{ borderBottom: `1px solid ${colors.border}` }}>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl" style={{ background: colors.gold + "1A" }}><FileSpreadsheet size={16} style={{ color: colors.gold }} /></div>
            <div>
              <div className="disp text-base font-semibold">Preview Data</div>
              <div className="text-xs" style={{ color: colors.textMuted }}>{fileName}</div>
            </div>
          </div>
          <button onClick={onCancel} className="sm-btn p-2 rounded-full" style={{ background: colors.surface2 }}><X size={16} /></button>
        </div>
        <div className="p-5 overflow-y-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <div className="sm-card p-3">
              <div className="text-xs mb-1" style={{ color: colors.textMuted }}>Baris Terbaca</div>
              <div className="mono text-lg font-bold">{fmtNum(rows.length)}</div>
            </div>
            <div className="sm-card p-3">
              <div className="text-xs mb-1" style={{ color: colors.textMuted }}>Baris Dilewati</div>
              <div className="mono text-lg font-bold" style={{ color: parseMeta.skippedBlankRows > 0 ? colors.gold : colors.text }}>{fmtNum(parseMeta.skippedBlankRows)}</div>
            </div>
            <div className="sm-card p-3">
              <div className="text-xs mb-1" style={{ color: colors.textMuted }}>Sales Terdeteksi</div>
              <div className="mono text-lg font-bold">{uniqueSales}</div>
            </div>
            <div className="sm-card p-3">
              <div className="text-xs mb-1" style={{ color: colors.textMuted }}>Grup Produk</div>
              <div className="mono text-lg font-bold">{uniqueGroups}</div>
            </div>
          </div>

          <div className="mb-6">
            <div className="text-xs uppercase tracking-wider mb-2" style={{ color: colors.textMuted }}>Rentang Tanggal Terdeteksi</div>
            <div className="text-sm font-medium">{dateStrs.length ? `${dateStrs[0]} — ${dateStrs[dateStrs.length - 1]}` : "Tidak ada tanggal valid terbaca"}</div>
          </div>

          <div className="mb-2">
            <div className="text-xs uppercase tracking-wider mb-2" style={{ color: colors.textMuted }}>Kolom Terdeteksi</div>
            <div className="flex flex-wrap gap-2">
              {parseMeta.detectedFields.map((f) => (
                <span key={f} className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs" style={{ background: colors.mint + "1A", color: colors.mint }}>
                  <CheckCircle2 size={12} /> {FIELD_LABELS[f] || f}
                </span>
              ))}
            </div>
          </div>

          {parseMeta.missingFields.length > 0 && (
            <div className="mt-4">
              <div className="text-xs uppercase tracking-wider mb-2" style={{ color: colors.textMuted }}>Kolom Tidak Terdeteksi</div>
              <div className="flex flex-wrap gap-2 mb-2">
                {parseMeta.missingFields.map((f) => (
                  <span key={f} className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs" style={{ background: colors.coral + "1A", color: colors.coral }}>
                    <XCircle size={12} /> {FIELD_LABELS[f] || f}
                  </span>
                ))}
              </div>
              <p className="text-xs" style={{ color: colors.textMuted }}>Data tetap bisa dipakai, tapi kolom di atas akan kosong/nol pada baris yang terpengaruh.</p>
            </div>
          )}

          {parseMeta.rowsWithMissingDate > 0 && (
            <div className="mt-4 flex items-center gap-2 px-3 py-2 rounded-lg text-xs" style={{ background: colors.gold + "14", color: colors.gold }}>
              <AlertTriangle size={13} /> {fmtNum(parseMeta.rowsWithMissingDate)} baris punya tanggal yang tidak terbaca.
            </div>
          )}
        </div>
        <div className="p-5 flex justify-end gap-3" style={{ borderTop: `1px solid ${colors.border}` }}>
          <button onClick={onCancel} className="sm-btn px-4 py-2.5 rounded-xl text-sm font-semibold" style={{ background: colors.surface2, color: colors.text, border: `1px solid ${colors.border}` }}>
            Batal
          </button>
          <button onClick={onConfirm} className="sm-btn px-4 py-2.5 rounded-xl text-sm font-semibold" style={{ background: colors.gold, color: "#0A1120" }}>
            Gunakan Data Ini
          </button>
        </div>
      </div>
    </div>
  );
}

// Papan peringkat sales berdasarkan ACH%, dengan proyeksi akhir bulan.
function Leaderboard({ rows, colors, onDrilldown }) {
  const ranked = useMemo(() => [...rows].sort((a, b) => (b.ach ?? -1) - (a.ach ?? -1)), [rows]);
  const medal = (i) => ["🥇", "🥈", "🥉"][i] || `${i + 1}`;
  return (
    <div className="sm-card p-5 sm-fadeup mb-8">
      <SectionTitle title="Leaderboard Sales" sub="Diurutkan berdasarkan pencapaian (ACH%)" icon={Trophy} colors={colors} />
      <div className="space-y-2">
        {ranked.map((sm, i) => (
          <div key={sm.code} className="sm-row flex items-center gap-3 px-3 py-2.5 rounded-xl" style={{ background: i < 3 ? colors.gold + "0D" : "transparent" }}>
            <div className="w-8 text-center text-base">{medal(i)}</div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">{sm.name}</div>
              <div className="text-xs mono" style={{ color: colors.textMuted }}>{fmtRp(sm.realisasiValue)} / {fmtRp(sm.targetValue)}</div>
            </div>
            {sm.projectedAch !== null && sm.projectedAch !== undefined && (
              <div className="hidden sm:block text-xs mono text-right" style={{ color: colors.textMuted }}>
                Proyeksi <span style={{ color: sm.projectedAch >= 1 ? colors.mint : colors.coral }}>{fmtPct(sm.projectedAch)}</span>
              </div>
            )}
            <AchBadge ach={sm.ach} colors={colors} />
            {onDrilldown && (
              <DrilldownButton colors={colors} onClick={() => onDrilldown(sm.name, "Semua outlet", sm.predicate)} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// Kartu proyeksi akhir bulan — ekstrapolasi linear dari rata-rata realisasi harian saat ini.
function ProjectionCard({ projection, totals, colors }) {
  const onTrack = projection.projectedAch !== null ? projection.projectedAch >= 1 : null;
  return (
    <div className="sm-card p-5 sm-fadeup mb-6">
      <SectionTitle title="Proyeksi Akhir Bulan" sub="Ekstrapolasi linear dari rata-rata realisasi harian saat ini" icon={Rocket} colors={colors} />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div>
          <div className="text-xs uppercase tracking-wider mb-1" style={{ color: colors.textMuted }}>Rata-rata / Hari</div>
          <div className="mono text-lg font-bold">{fmtRp(projection.dailyRate)}</div>
        </div>
        <div>
          <div className="text-xs uppercase tracking-wider mb-1" style={{ color: colors.textMuted }}>Proyeksi Akhir Bulan</div>
          <div className="mono text-lg font-bold">{fmtRp(projection.projectedValue)}</div>
        </div>
        <div>
          <div className="text-xs uppercase tracking-wider mb-1" style={{ color: colors.textMuted }}>Proyeksi ACH%</div>
          <div className="mono text-lg font-bold" style={{ color: onTrack === null ? colors.text : onTrack ? colors.mint : colors.coral }}>
            {fmtPct(projection.projectedAch)}
          </div>
        </div>
        <div>
          <div className="text-xs uppercase tracking-wider mb-1" style={{ color: colors.textMuted }}>Status</div>
          <div className="text-sm font-semibold flex items-center gap-1.5" style={{ color: onTrack === null ? colors.textMuted : onTrack ? colors.mint : colors.coral }}>
            {onTrack === null ? "Belum cukup data" : onTrack ? <><ArrowUpRight size={15} /> Sesuai/Lampaui Target</> : <><ArrowDownRight size={15} /> Berpotensi Meleset</>}
          </div>
        </div>
      </div>
    </div>
  );
}

// Panel peringatan otomatis — sales/produk fokus yang masih 0% padahal sudah lewat beberapa hari kerja.
function AlertsPanel({ alerts, colors, onDrilldown }) {
  const [expanded, setExpanded] = useState(false);
  if (!alerts.length) return null;
  const visible = expanded ? alerts : alerts.slice(0, 5);
  return (
    <div className="sm-card p-5 sm-fadeup mb-6" style={{ borderColor: colors.coral + "44" }}>
      <div className="flex items-center justify-between mb-3">
        <SectionTitle title="Perlu Perhatian" sub={`${alerts.length} item belum ada realisasi sama sekali`} icon={BellRing} colors={colors} />
      </div>
      <div className="space-y-2">
        {visible.map((a, i) => (
          <div key={i} className="flex items-center gap-3 px-3 py-2 rounded-lg" style={{ background: colors.coral + "0D" }}>
            <AlertTriangle size={14} style={{ color: colors.coral, flexShrink: 0 }} />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">{a.title}</div>
              <div className="text-xs" style={{ color: colors.textMuted }}>{a.message}</div>
            </div>
            {onDrilldown && <DrilldownButton colors={colors} onClick={() => onDrilldown(a.title, a.message, a.predicate)} />}
          </div>
        ))}
      </div>
      {alerts.length > 5 && (
        <button onClick={() => setExpanded(!expanded)} className="sm-btn text-xs font-medium mt-3" style={{ color: colors.gold }}>
          {expanded ? "Tampilkan lebih sedikit" : `Tampilkan ${alerts.length - 5} lainnya`}
        </button>
      )}
    </div>
  );
}

/* ============================================================================
   PAGES
============================================================================ */
function MainReportPage({ agg, workDays, colors, onDrilldown }) {
  const uniqueDaysInData = useMemo(() => new Set(agg.filteredRows.map(r => dateKey(r.date))).size, [agg.filteredRows]);
  const t = agg.totals;
  // Calculate time gone based on unique work days found in the data vs total work days in the month.
  const timeGone = workDays ? Math.min(1, uniqueDaysInData / workDays) : 0;
  return (
    <div className="sm-fadein">
      <PaceStrip timeGonePct={timeGone} achPct={t.ach} colors={colors} />
      <AlertsPanel alerts={agg.alerts} colors={colors} onDrilldown={onDrilldown} />
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
        <KpiCard label="Target Value" value={t.targetValue} isMoney icon={Target} accent={colors.blue} delay={0} colors={colors} />
        <KpiCard label="Realisasi Value" value={t.realisasiValue} isMoney icon={TrendingUp} accent={colors.mint} delay={40} colors={colors} />
        <KpiCard label="Achievement" value={t.ach} isPct icon={Sparkles} accent={colors.gold} delay={80} colors={colors} />
        <KpiCard label="Deviasi Value" value={t.deviasiValue} isMoney icon={TrendingDown} accent={colors.coral} delay={120} colors={colors} />
        <KpiCard label="Active Outlet" value={t.realisasiAo} icon={Users} accent={colors.violet} delay={160} colors={colors} />
        <KpiCard label="Target AO" value={t.targetAo} icon={Boxes} accent={colors.textMuted} delay={200} colors={colors} />
      </div>

      <ProjectionCard projection={agg.projection} totals={t} colors={colors} />

      <div className="grid lg:grid-cols-2 gap-6 mb-8">
        <div className="sm-card p-5 sm-fadeup">
          <SectionTitle title="Tren Harian" sub="Realisasi value per tanggal" icon={CalendarDays} colors={colors} />
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={agg.daily}>
              <defs>
                <linearGradient id="gGold" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={colors.gold} stopOpacity={0.5} />
                  <stop offset="100%" stopColor={colors.gold} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={colors.border} vertical={false} />
              <XAxis dataKey="date" tick={{ fill: colors.textMuted, fontSize: 11 }} axisLine={{ stroke: colors.border }} tickLine={false} />
              <YAxis tick={{ fill: colors.textMuted, fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => fmtNum(v / 1e6) + "jt"} />
              <Tooltip contentStyle={createChartTooltipStyle(colors)} formatter={(v) => fmtRp(v)} />
              <Area type="monotone" dataKey="value" stroke={colors.gold} fill="url(#gGold)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="sm-card p-5 sm-fadeup" style={{ animationDelay: "60ms" }}>
          <SectionTitle title="Kumulatif Bulanan" sub="Total realisasi per bulan" icon={LayoutDashboard} colors={colors} />
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={agg.monthly}>
              <CartesianGrid strokeDasharray="3 3" stroke={colors.border} vertical={false} />
              <XAxis dataKey="month" tick={{ fill: colors.textMuted, fontSize: 11 }} axisLine={{ stroke: colors.border }} tickLine={false} />
              <YAxis tick={{ fill: colors.textMuted, fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => fmtNum(v / 1e6) + "jt"} />
              <Tooltip contentStyle={createChartTooltipStyle(colors)} formatter={(v) => fmtRp(v)} />
              <Bar dataKey="value" fill={colors.mint} radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <SectionTitle title="Ringkasan Semua Sales" icon={Users} colors={colors} />
      <DataTable
        colors={colors}
        initialSortKey="realisasiValue"
        columns={[
          { key: "name", label: "Sales" },
          { key: "targetValue", label: "Target", render: (r) => <span className="mono">{fmtRp(r.targetValue)}</span> },
          { key: "realisasiValue", label: "Realisasi", render: (r) => <span className="mono">{fmtRp(r.realisasiValue)}</span> },
          { key: "ach", label: "ACH", render: (r) => <AchBadge ach={r.ach} colors={colors} /> },
          { key: "deviasiValue", label: "Deviasi", render: (r) => <span className="mono" style={{ color: colors.textMuted }}>{fmtRp(r.deviasiValue)}</span> },
          { key: "realisasiAo", label: "AO", render: (r) => <span className="mono">{r.realisasiAo}/{r.targetAo}</span> },
          { key: "_drilldown", label: "", render: (r) => onDrilldown && <DrilldownButton colors={colors} onClick={() => onDrilldown(r.name, "Semua outlet", r.predicate)} /> },
        ]}
        rows={agg.bySales}
      />
    </div>
  );
}

function SalesReportPage({ agg, colors, onDrilldown }) {
  const rows = agg.bySales;
  const groupRows = useMemo(() => rows.flatMap((sm) => sm.groups.map((g) => ({
    salesName: sm.name, groupName: g.name, value: g.realisasiValue, predicate: g.predicate,
  }))), [rows]);

  // Custom Tooltip untuk menyesuaikan warna teks dengan warna bar
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      const barColor = data.ach >= 1 ? colors.mint : data.ach >= 0.7 ? colors.gold : colors.coral;
      return (
        <div className="p-3 shadow-lg" style={{ background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: 10, fontSize: 12 }}>
          <div className="font-semibold mb-1" style={{ color: colors.text }}>{label}</div>
          <div className="mono font-semibold" style={{ color: barColor }}>
            Realisasi: {fmtRp(data.realisasiValue)}
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="sm-fadein">
      <Leaderboard rows={rows} colors={colors} onDrilldown={onDrilldown} />

      <SectionTitle title="Performa per Sales" sub="Pilih Sales pada filter di atas untuk melihat detail" icon={UserRound} colors={colors} />
      <ResponsiveContainer width="100%" height={Math.max(220, rows.length * 46)}>
        <BarChart data={rows} layout="vertical" margin={{ left: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={colors.border} horizontal={false} />
          <XAxis type="number" tick={{ fill: colors.textMuted, fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => fmtNum(v / 1e6) + "jt"} />
          <YAxis type="category" dataKey="name" width={160} tick={{ fill: colors.text, fontSize: 12 }} axisLine={false} tickLine={false} />
          
          {/* Implementasi Custom Tooltip di sini */}
          <Tooltip content={<CustomTooltip />} cursor={{ fill: colors.surface2 }} />
          
          <Bar dataKey="realisasiValue" radius={[0, 6, 6, 0]}>
            {rows.map((r, i) => <Cell key={i} fill={r.ach >= 1 ? colors.mint : r.ach >= 0.7 ? colors.gold : colors.coral} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      <div className="mt-8">
        <SectionTitle title="Detail per Sales × Grup Produk" icon={Boxes} colors={colors} />
        <DataTable
          colors={colors}
          initialSortKey="value"
          searchable
          searchKeys={["salesName", "groupName"]}
          searchPlaceholder="Cari nama sales atau grup produk..."
          columns={[
            { key: "salesName", label: "Sales" },
            { key: "groupName", label: "Grup Produk" },
            { key: "value", label: "Realisasi", render: (r) => <span className="mono">{fmtRp(r.value)}</span> },
            { key: "_drilldown", label: "", render: (r) => onDrilldown && <DrilldownButton colors={colors} onClick={() => onDrilldown(`${r.salesName} — ${r.groupName}`, "Outlet", r.predicate)} /> },
          ]}
          rows={groupRows}
        />
      </div>
    </div>
  );
}

function ProductReportPage({ agg, colors, onDrilldown }) {
  
  // Custom Tooltip yang sama untuk Product Report
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      const barColor = data.ach >= 1 ? colors.mint : data.ach >= 0.7 ? colors.gold : colors.coral;
      return (
        <div className="p-3 shadow-lg" style={{ background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: 10, fontSize: 12 }}>
          <div className="font-semibold mb-1" style={{ color: colors.text }}>{label}</div>
          <div className="mono font-semibold" style={{ color: barColor }}>
            Realisasi: {fmtRp(data.realisasiValue)}
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="sm-fadein">
      <SectionTitle title="Pencapaian per Grup Produk" sub="Ranking berdasarkan realisasi" icon={Boxes} colors={colors} />
      <ResponsiveContainer width="100%" height={Math.max(240, agg.byGroup.length * 42)}>
        <BarChart data={agg.byGroup} layout="vertical" margin={{ left: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={colors.border} horizontal={false} />
          <XAxis type="number" tick={{ fill: colors.textMuted, fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => fmtNum(v / 1e6) + "jt"} />
          <YAxis type="category" dataKey="name" width={170} tick={{ fill: colors.text, fontSize: 12 }} axisLine={false} tickLine={false} />
          
          {/* Implementasi Custom Tooltip di sini */}
          <Tooltip content={<CustomTooltip />} cursor={{ fill: colors.surface2 }} />
          
          <Bar dataKey="realisasiValue" radius={[0, 6, 6, 0]}>
            {agg.byGroup.map((r, i) => <Cell key={i} fill={r.ach >= 1 ? colors.mint : r.ach >= 0.7 ? colors.gold : colors.coral} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      <div className="mt-8">
        <SectionTitle title="Detail Grup Produk" icon={Package} colors={colors} />
        <DataTable
          colors={colors}
          initialSortKey="realisasiValue"
          searchable
          searchKeys={["name"]}
          searchPlaceholder="Cari grup produk..."
          columns={[
            { key: "name", label: "Grup Produk" },
            { key: "targetValue", label: "Target", render: (r) => <span className="mono">{fmtRp(r.targetValue)}</span> },
            { key: "realisasiValue", label: "Realisasi", render: (r) => <span className="mono">{fmtRp(r.realisasiValue)}</span> },
            { key: "ach", label: "ACH", render: (r) => <AchBadge ach={r.ach} colors={colors} /> },
            { key: "realisasiAo", label: "Outlet", render: (r) => <span className="mono">{r.realisasiAo}</span> },
            { key: "_drilldown", label: "", render: (r) => onDrilldown && <DrilldownButton colors={colors} onClick={() => onDrilldown(r.name, "Outlet", r.predicate)} /> },
          ]}
          rows={agg.byGroup}
        />
      </div>
    </div>
  );
}

function ProductFocusReportPage({ agg, colors, onDrilldown }) {
  const [focusFilter, setFocusFilter] = useState([]);
  const focusNames = useMemo(() => Array.from(new Set(agg.focusRows.map((f) => f.name))), [agg.focusRows]);
  const rows = focusFilter.length ? agg.focusRows.filter((f) => focusFilter.includes(f.name)) : agg.focusRows;
  return (
    <div className="sm-fadein">
      <div className="mb-6">
        <MultiSelect label="Produk Fokus" icon={Crosshair} options={focusNames} selected={focusFilter} onChange={setFocusFilter} placeholder="Cari produk fokus..." colors={colors} />
      </div>
      <SectionTitle title="Pencapaian Produk Fokus per Sales" sub="Target & realisasi dalam satuan karton (kecuali ditandai lain, memakai satuan asli produk)" icon={Crosshair} colors={colors} />
      {rows.length === 0 && (
        <div className="sm-card p-8 text-center" style={{ color: colors.textMuted }}>
          <AlertTriangle size={24} className="mx-auto mb-2" style={{ color: colors.gold }} />
          Tidak ada data produk fokus untuk sales/filter terpilih.
        </div>
      )}
      <div className="grid md:grid-cols-2 gap-4 mb-8">
        {rows.map((f, i) => {
          const pct = Math.min(150, (f.pct || 0) * 100);
          const color = pct >= 100 ? colors.mint : pct >= 50 ? colors.gold : colors.coral;
          return (
            <div key={i} className="sm-card p-4 sm-fadeup" style={{ animationDelay: `${i * 25}ms` }}>
              <div className="flex justify-between items-baseline mb-2">
                <div>
                  <div className="text-sm font-semibold disp flex items-center gap-1.5">
                    {f.name}
                    {f.hasUnconvertible && (
                      <AlertTriangle size={12} style={{ color: colors.gold }} title={`Tidak ada referensi KARTON untuk produk ini di data — realisasi ditampilkan dalam satuan asli (${f.unit})`} />
                    )}
                  </div>
                  <div className="text-xs" style={{ color: colors.textMuted }}>{f.salesName}</div>
                </div>
                <span className="mono text-sm font-semibold" style={{ color }}>{fmtPct(f.pct)}</span>
              </div>
              <div className="h-2.5 rounded-full overflow-hidden" style={{ background: colors.surface2 }}>
                <div className="sm-progress-fill h-full rounded-full" style={{ width: `${Math.min(100, pct)}%`, background: color }} />
              </div>
              <div className="flex justify-between mt-1.5 text-xs mono" style={{ color: colors.textMuted }}>
                <span>{fmtNum(f.realisasi)} {f.unit.toLowerCase()}</span>
                <span>Target {fmtNum(f.target)}</span>
              </div>
            </div>
          );
        })}
      </div>

      <SectionTitle title="Detail Tabel" icon={Crosshair} colors={colors} />
      <DataTable
        colors={colors}
        initialSortKey="pct"
        searchable
        searchKeys={["salesName", "name"]}
        searchPlaceholder="Cari nama sales atau produk fokus..."
        columns={[
          { key: "salesName", label: "Sales" },
          { key: "name", label: "Produk Fokus", render: (r) => (
            <span className="flex items-center gap-1.5">
              {r.name}
              {r.hasUnconvertible && <AlertTriangle size={12} style={{ color: colors.gold }} title={`Satuan asli: ${r.unit}`} />}
            </span>
          ) },
          { key: "target", label: "Target", render: (r) => <span className="mono">{fmtNum(r.target)}</span> },
          { key: "realisasi", label: "Realisasi", render: (r) => <span className="mono">{fmtNum(r.realisasi)} <span style={{ color: colors.textMuted, fontSize: 10 }}>{r.unit}</span></span> },
          { key: "pct", label: "%", render: (r) => <AchBadge ach={r.pct} colors={colors} /> },
          { key: "_drilldown", label: "", render: (r) => onDrilldown && <DrilldownButton colors={colors} onClick={() => onDrilldown(`${r.salesName} — ${r.name}`, "Outlet", r.predicate)} /> },
        ]}
        rows={rows}
      />
    </div>
  );
}

function DataQualityPage({ notes, colors, onDrilldown }) {
  const hasIssues = notes.missingFields.length || notes.unknownSales.length || notes.unconvertibleProducts.length ||
    notes.unknownGroups.length || notes.skippedBlankRows > 0 || notes.rowsWithMissingDate > 0;

  return (
    <div className="sm-fadein">
      <SectionTitle title="Catatan Data" sub="Ringkasan kualitas data dari seluruh file yang diupload (tidak terpengaruh filter)" icon={ClipboardList} colors={colors} />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <KpiCard label="Total Baris Terbaca" value={notes.totalDataRows} icon={FileSpreadsheet} accent={colors.blue} colors={colors} />
        <KpiCard label="Baris Dilewati (Kosong)" value={notes.skippedBlankRows} icon={XCircle} accent={colors.textMuted} colors={colors} />
        <KpiCard label="Tanggal Tidak Terbaca" value={notes.rowsWithMissingDate} icon={CalendarDays} accent={notes.rowsWithMissingDate > 0 ? colors.coral : colors.textMuted} colors={colors} />
        <KpiCard label="Kolom Tidak Terdeteksi" value={notes.missingFields.length} icon={FileQuestion} accent={notes.missingFields.length > 0 ? colors.coral : colors.textMuted} colors={colors} />
      </div>

      {!hasIssues && (
        <div className="sm-card p-8 text-center mb-6">
          <CheckCircle2 size={28} className="mx-auto mb-2" style={{ color: colors.mint }} />
          <div className="font-semibold mb-1">Tidak ada masalah kualitas data terdeteksi</div>
          <p className="text-sm" style={{ color: colors.textMuted }}>Semua kolom terbaca dan cocok dengan konfigurasi Target saat ini.</p>
        </div>
      )}

      {notes.missingFields.length > 0 && (
        <div className="sm-card p-5 mb-6">
          <SectionTitle title="Kolom Tidak Terdeteksi" sub="Nama kolom di file tidak cocok dengan alias yang dikenali aplikasi" icon={FileQuestion} colors={colors} />
          <div className="flex flex-wrap gap-2">
            {notes.missingFields.map((f) => (
              <span key={f} className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs" style={{ background: colors.coral + "1A", color: colors.coral }}>
                <XCircle size={12} /> {FIELD_LABELS[f] || f}
              </span>
            ))}
          </div>
        </div>
      )}

      {notes.unknownSales.length > 0 && (
        <div className="mb-8">
          <SectionTitle title="Kode Sales Tidak Dikenali" sub="Ada di data, tapi tidak cocok dengan konfigurasi Target — transaksinya tidak ikut dihitung di dashboard manapun" icon={Users} colors={colors} />
          <DataTable
            colors={colors}
            initialSortKey="value"
            columns={[
              { key: "salesCode", label: "Kode Sales" },
              { key: "salesName", label: "Nama (di data)" },
              { key: "rowCount", label: "Jumlah Baris", render: (r) => <span className="mono">{fmtNum(r.rowCount)}</span> },
              { key: "value", label: "Total Value", render: (r) => <span className="mono">{fmtRp(r.value)}</span> },
              { key: "_drilldown", label: "", render: (r) => onDrilldown && <DrilldownButton colors={colors} onClick={() => onDrilldown(r.salesCode, "Outlet", (row) => row.salesCode === r.salesCode)} /> },
            ]}
            rows={notes.unknownSales}
          />
        </div>
      )}

      {notes.unknownGroups.length > 0 && (
        <div className="mb-8">
          <SectionTitle title="Grup Produk Tidak Dikenali" sub="Ada di data untuk sales tsb, tapi tidak ada di daftar grup produk sales itu pada konfigurasi Target" icon={Package} colors={colors} />
          <DataTable
            colors={colors}
            initialSortKey="value"
            columns={[
              { key: "salesName", label: "Sales" },
              { key: "group", label: "Grup Produk" },
              { key: "rowCount", label: "Jumlah Baris", render: (r) => <span className="mono">{fmtNum(r.rowCount)}</span> },
              { key: "value", label: "Total Value", render: (r) => <span className="mono">{fmtRp(r.value)}</span> },
              { key: "_drilldown", label: "", render: (r) => onDrilldown && <DrilldownButton colors={colors} onClick={() => onDrilldown(`${r.salesName} — ${r.group}`, "Outlet", (row) => row.salesCode === r.salesCode && row.group === r.group)} /> },
            ]}
            rows={notes.unknownGroups}
          />
        </div>
      )}

      {notes.unconvertibleProducts.length > 0 && (
        <div className="mb-8">
          <SectionTitle title="Produk Tidak Bisa Dikonversi ke KARTON" sub="Tidak ada baris bersatuan KARTON untuk produk ini di data, jadi angkanya memakai satuan asli" icon={AlertTriangle} colors={colors} />
          <DataTable
            colors={colors}
            initialSortKey="rowCount"
            columns={[
              { key: "productName", label: "Nama Produk" },
              { key: "unit", label: "Satuan Asli" },
              { key: "rowCount", label: "Jumlah Baris", render: (r) => <span className="mono">{fmtNum(r.rowCount)}</span> },
              { key: "qty", label: "Total Qty", render: (r) => <span className="mono">{fmtNum(r.qty)}</span> },
            ]}
            rows={notes.unconvertibleProducts}
          />
        </div>
      )}
    </div>
  );
}

function SettingsModal({ isOpen, onClose, targets, setTargets, workDays, setWorkDays, depotName, setDepotName, onClearAll, colors }) {
  const [localTargets, setLocalTargets] = useState(targets);
  const [localWorkDays, setLocalWorkDays] = useState(workDays);
  const [localDepotName, setLocalDepotName] = useState(depotName);

  useEffect(() => {
    if (isOpen) {
      setLocalTargets(targets);
      setLocalWorkDays(workDays);
      setLocalDepotName(depotName);
    }
  }, [isOpen, targets, workDays, depotName]);

  if (!isOpen) return null;

  const handleTargetChange = (salesCode, field, value) => {
    setLocalTargets(prev => prev.map(t => {
      if (t.code === salesCode) {
        const newTotal = { ...t.total, [field]: Number(value) || 0 };
        return { ...t, total: newTotal };
      }
      return t;
    }));
  };

  const handleSave = () => {
    setTargets(localTargets);
    setWorkDays(localWorkDays);
    setDepotName(localDepotName);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm sm-fadein">
      <div className="sm-card sm-scale-in w-full max-w-2xl max-h-[85vh] flex flex-col" style={{ background: colors.surface }}>
        <div className="p-5 flex items-center justify-between" style={{ borderBottom: `1px solid ${colors.border}` }}>
          <SectionTitle title="Pengaturan" icon={Settings} colors={colors} />
          <button onClick={onClose} className="sm-btn p-2 rounded-full" style={{ background: colors.surface2 }}><X size={16} /></button>
        </div>
        <div className="p-5 overflow-y-auto">
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium mb-2">Hari Kerja Efektif</label>
              <input type="number" value={localWorkDays} onChange={e => setLocalWorkDays(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-lg mono" style={{ background: colors.surface2, border: `1px solid ${colors.border}` }} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Nama Depo / Cabang</label>
              <input type="text" value={localDepotName} onChange={e => setLocalDepotName(e.target.value)}
                placeholder="DEPO LOTIM"
                className="w-full px-3 py-2 rounded-lg" style={{ background: colors.surface2, border: `1px solid ${colors.border}` }} />
              <p className="text-xs mt-1" style={{ color: colors.textMuted }}>Muncul sebagai judul di hasil export Excel</p>
            </div>
          </div>
          <h3 className="text-base font-semibold disp mb-3">Target Sales</h3>
          <div className="space-y-3">
            {localTargets.map(t => (
              <div key={t.code} className="p-3 rounded-lg" style={{ background: colors.surface2 }}>
                <p className="font-semibold text-sm mb-2">{t.name}</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs mb-1" style={{ color: colors.textMuted }}>Target Value (Rp)</label>
                    <input type="number" value={t.total.value} onChange={e => handleTargetChange(t.code, 'value', e.target.value)}
                      className="w-full px-3 py-1.5 rounded-md mono text-sm" style={{ background: colors.ink, border: `1px solid ${colors.border}` }} />
                  </div>
                  <div>
                    <label className="block text-xs mb-1" style={{ color: colors.textMuted }}>Target Active Outlet (AO)</label>
                    <input type="number" value={t.total.ao} onChange={e => handleTargetChange(t.code, 'ao', e.target.value)}
                      className="w-full px-3 py-1.5 rounded-md mono text-sm" style={{ background: colors.ink, border: `1px solid ${colors.border}` }} />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-8 p-4 rounded-lg" style={{ background: colors.coral + "0D", border: `1px solid ${colors.coral}33` }}>
            <h3 className="text-sm font-semibold mb-1" style={{ color: colors.coral }}>Zona Berbahaya</h3>
            <p className="text-xs mb-3" style={{ color: colors.textMuted }}>
              Menghapus semua target, hari kerja, nama depo, tema, dan data upload yang tersimpan otomatis di perangkat ini. Tidak bisa dibatalkan.
            </p>
            <button
              onClick={() => {
                if (window.confirm("Yakin ingin menghapus semua data & pengaturan tersimpan di perangkat ini? Tindakan ini tidak bisa dibatalkan.")) {
                  onClearAll?.();
                  onClose();
                }
              }}
              className="sm-btn px-3 py-2 rounded-lg text-xs font-semibold"
              style={{ background: colors.coral + "1A", color: colors.coral, border: `1px solid ${colors.coral}4D` }}
            >
              Hapus Semua Data Tersimpan
            </button>
          </div>
        </div>
        <div className="p-4 mt-auto flex justify-end gap-3" style={{ background: colors.surface2, borderTop: `1px solid ${colors.border}` }}>
          <button onClick={onClose} className="sm-btn px-4 py-2 rounded-lg text-sm font-semibold" style={{ border: `1px solid ${colors.border}` }}>Batal</button>
          <button onClick={handleSave} className="sm-btn px-4 py-2 rounded-lg text-sm font-semibold" style={{ background: colors.gold, color: "#0A1120" }}>Simpan Perubahan</button>
        </div>
      </div>
    </div>
  );
}

/* ============================================================================
   UPLOAD / EXPORT
============================================================================ */
function UploadDropzone({ onFile, hasData, fileName, onReset, onSample, loading, sampleLoading, colors }) {
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef(null);
  const handleFiles = (files) => { if (files && files[0]) onFile(files[0]); };
  return (
    <div>
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); }}
        onClick={() => inputRef.current && inputRef.current.click()}
        className="sm-drop cursor-pointer rounded-2xl p-6 flex items-center gap-4 transition-colors"
        style={{ border: `1.5px dashed ${dragOver ? colors.gold : colors.border}`, background: dragOver ? colors.gold + "0D" : colors.surface }}
      >
        <input ref={inputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(e) => handleFiles(e.target.files)} />
        <div className="p-3 rounded-xl" style={{ background: colors.gold + "1A" }}>
          {loading ? <RefreshCw size={20} className="sm-pulse" style={{ color: colors.gold }} /> : <Upload size={20} style={{ color: colors.gold }} />}
        </div>
        <div className="flex-1">
          <div className="text-sm font-semibold disp">{loading ? "Memproses file..." : "Upload file Excel sell-out"}</div>
          <div className="text-xs mt-0.5" style={{ color: colors.textMuted }}>
            {hasData ? `Sumber aktif: ${fileName}` : "Tarik & lepas file di sini, atau klik untuk memilih (.xlsx)"}
          </div>
        </div>
        {!hasData && (
          <button onClick={(e) => { e.stopPropagation(); onSample(); }} className="sm-btn text-xs px-3 py-2 rounded-lg font-medium"
            style={{ background: colors.surface2, border: `1px solid ${colors.border}`, color: colors.textMuted }}
            disabled={sampleLoading}>
            {sampleLoading
              ? <span className="flex items-center gap-1.5"><RefreshCw size={13} className="sm-pulse" /> Memuat...</span>
              : "Coba data contoh"}
          </button>
        )}
        {hasData && (
          <button onClick={(e) => { e.stopPropagation(); onReset(); }} className="sm-btn text-xs px-3 py-2 rounded-lg font-medium flex items-center gap-1.5"
            style={{ background: colors.coral + "14", border: `1px solid ${colors.coral}33`, color: colors.coral }}>
            <X size={13} /> Hapus data
          </button>
        )}
      </div>
    </div>
  );
}

const XL_NUMFMT_MONEY = '_(* #,##0_);_(* \\(#,##0\\);_(* "-"??_);_(@_)';
const XL_NUMFMT_INT = "#,##0";
const XL_NUMFMT_PCT = "0.00%";
const XL_NUMFMT_PCT1 = "0.0%";
const XL_COLORS = { headerCyan: "6DD9FF", headerPurple: "7030A0", mint: "4BFF9C", yellowTier: "FFFF00", gold: "FFC000", navy: "002060" };
const XL_TIER_FILL = { mint: XL_COLORS.mint, amber: XL_COLORS.yellowTier, violet: XL_COLORS.gold };

function exportToExcel(agg, targets, opts) {
  const { workDays, depotName } = opts || {};
  const ws = {};
  const merges = [];
  let lastRow = 0;

  const setCell = (r, c, value, style = {}) => {
    const ref = XLSX.utils.encode_cell({ r: r - 1, c: c - 1 });
    const isNum = typeof value === "number";
    const cellObj = { v: value === null || value === undefined ? "" : value, t: isNum ? "n" : (value instanceof Date ? "d" : "s") };
    if (value instanceof Date) cellObj.t = "d";
    const s = {
      font: { bold: !!style.bold, sz: style.size || 10, name: "Calibri", color: { rgb: style.color || "000000" } },
      alignment: { horizontal: style.align || (isNum ? "right" : "left"), vertical: "center", wrapText: true },
    };
    if (style.border !== false) {
      s.border = { top: { style: "thin", color: { rgb: "D9D9D9" } }, bottom: { style: "thin", color: { rgb: "D9D9D9" } },
        left: { style: "thin", color: { rgb: "D9D9D9" } }, right: { style: "thin", color: { rgb: "D9D9D9" } } };
    }
    if (style.fill) s.fill = { patternType: "solid", fgColor: { rgb: style.fill } };
    if (style.numFmt) s.numFmt = style.numFmt;
    cellObj.s = s;
    ws[ref] = cellObj;
    if (r > lastRow) lastRow = r;
  };
  const merge = (r1, c1, r2, c2) => merges.push({ s: { r: r1 - 1, c: c1 - 1 }, e: { r: r2 - 1, c: c2 - 1 } });
  const blank = (r, cols) => cols.forEach((c) => setCell(r, c, ""));

  // ---- blok info header ----
  const firstDateObj = dateStrToLocalDate(agg.meta.firstDate) || new Date();
  const lastDateObj = dateStrToLocalDate(agg.meta.lastDate) || new Date();
  const sdHariIni = agg.meta.uniqueDays;
  const sisaHk = Math.max(0, (workDays || 0) - sdHariIni);
  const timeGone = workDays ? sdHariIni / workDays : 0;

  setCell(1, 2, "BULAN", { bold: true });
  setCell(1, 3, firstDateObj, { numFmt: "mmm-yy" });
  setCell(1, 13, lastDateObj, { bold: true, numFmt: "d-mmm-yy", align: "right" });
  setCell(2, 2, "HARI KERJA", { bold: true });
  setCell(2, 3, workDays || 0, { bold: true, numFmt: XL_NUMFMT_INT });
  setCell(3, 2, "SD HARI INI", { bold: true });
  setCell(3, 3, sdHariIni, { bold: true, numFmt: XL_NUMFMT_INT });
  setCell(4, 2, "SISA HK", { bold: true });
  setCell(4, 3, sisaHk, { bold: true, numFmt: XL_NUMFMT_INT });
  setCell(5, 2, "TIME GONE", { bold: true });
  setCell(5, 3, timeGone, { bold: true, numFmt: XL_NUMFMT_PCT, fill: XL_COLORS.gold });
  setCell(5, 7, depotName || "DEPO LOTIM", { bold: true, size: 13, align: "center" });
  merge(5, 7, 5, 10);

  // ---- header kolom (baris 6-7) ----
  const HROW1 = 6, HROW2 = 7;
  setCell(HROW1, 1, "NO", { bold: true, fill: XL_COLORS.headerCyan, align: "center" });
  setCell(HROW1, 2, "SALESMAN", { bold: true, fill: XL_COLORS.headerCyan, align: "center" });
  merge(HROW1, 1, HROW2, 1); merge(HROW1, 2, HROW2, 2);
  [["TARGET", 3], ["REALISASI", 5], ["ACH", 7], ["DEVIASI", 9]].forEach(([label, col]) => {
    setCell(HROW1, col, label, { bold: true, fill: XL_COLORS.headerCyan, align: "center" });
    merge(HROW1, col, HROW1, col + 1);
    setCell(HROW2, col, "VALUE", { bold: true, fill: XL_COLORS.headerCyan, align: "center" });
    setCell(HROW2, col + 1, "AO", { bold: true, fill: XL_COLORS.headerCyan, align: "center" });
  });
  setCell(HROW1, 11, "PRODUK FOKUS", { bold: true, fill: XL_COLORS.headerPurple, color: "FFFFFF", align: "center" });
  merge(HROW1, 11, HROW1, 14);
  ["NAMA", "TARGET", "REALISASI", "%"].forEach((label, i) => {
    setCell(HROW2, 11 + i, label, { bold: true, fill: XL_COLORS.headerPurple, color: "FFFFFF", align: "center" });
  });

  // ---- baris data per sales ----
  let r = HROW2 + 1;
  const totalTargetV = [], totalTargetAo = [], totalRealV = [], totalRealAo = [];

  agg.bySales.forEach((sm, idx) => {
    const startRow = r;
    const fill = XL_TIER_FILL[sm.tier] || XL_COLORS.yellowTier;

    setCell(r, 2, sm.name, { bold: true, fill, align: "left" });
    setCell(r, 3, sm.targetValue, { fill, numFmt: XL_NUMFMT_MONEY });
    setCell(r, 4, sm.targetAo, { fill, numFmt: XL_NUMFMT_INT, align: "center" });
    setCell(r, 5, sm.realisasiValue, { fill, numFmt: XL_NUMFMT_MONEY });
    setCell(r, 6, sm.realisasiAo, { fill, numFmt: XL_NUMFMT_INT, align: "center" });
    setCell(r, 7, sm.targetValue ? sm.ach : "-", { bold: true, numFmt: sm.targetValue ? XL_NUMFMT_PCT : undefined, align: "center" });
    setCell(r, 8, sm.targetAo ? sm.achAo : "-", { bold: true, numFmt: sm.targetAo ? XL_NUMFMT_PCT : undefined, align: "center" });
    setCell(r, 9, sm.targetValue ? sm.deviasiValue : 0, { fill: XL_COLORS.yellowTier, numFmt: XL_NUMFMT_MONEY });
    setCell(r, 10, sm.targetAo ? sm.deviasiAo : 0, { fill: XL_COLORS.yellowTier, numFmt: XL_NUMFMT_INT, align: "center" });
    if (sm.focus.length) {
      setCell(r, 11, sm.name, { bold: true, fill: XL_COLORS.headerPurple, color: "FFFFFF", align: "center" });
    } else {
      setCell(r, 11, "*PRODUK FOKUS DALAM SATUAN KARTON", { fill, align: "left", size: 9 });
    }
    merge(r, 11, r, 14);

    totalTargetV.push(sm.targetValue); totalTargetAo.push(sm.targetAo);
    totalRealV.push(sm.realisasiValue); totalRealAo.push(sm.realisasiAo);

    r++;
    const maxSub = Math.max(sm.groups.length, sm.focus.length);
    for (let i = 0; i < maxSub; i++) {
      if (i < sm.groups.length) {
        const g = sm.groups[i];
        setCell(r, 2, g.name, { align: "left" });
        setCell(r, 3, g.targetValue, { numFmt: XL_NUMFMT_MONEY });
        setCell(r, 4, g.targetAo, { fill, numFmt: XL_NUMFMT_INT, align: "center" });
        setCell(r, 5, g.realisasiValue, { numFmt: XL_NUMFMT_MONEY });
        setCell(r, 6, g.realisasiAo, { numFmt: XL_NUMFMT_INT, align: "center" });
        setCell(r, 7, g.targetValue ? g.ach : "-", { bold: true, numFmt: g.targetValue ? XL_NUMFMT_PCT : undefined, align: "center" });
        setCell(r, 8, g.targetAo ? g.achAo : "-", { bold: true, numFmt: g.targetAo ? XL_NUMFMT_PCT : undefined, align: "center" });
        setCell(r, 9, g.deviasiValue, { fill: XL_COLORS.yellowTier, numFmt: XL_NUMFMT_MONEY });
        setCell(r, 10, g.deviasiAo, { fill: XL_COLORS.yellowTier, numFmt: XL_NUMFMT_INT, align: "center" });
      } else {
        blank(r, [2, 3, 4, 5, 6, 7, 8, 9, 10]);
      }
      if (i < sm.focus.length) {
        const f = sm.focus[i];
        setCell(r, 11, f.hasUnconvertible ? `${f.name} *` : f.name, { align: "left" });
        setCell(r, 12, f.target, { numFmt: XL_NUMFMT_INT, align: "center" });
        setCell(r, 13, f.realisasi, { numFmt: XL_NUMFMT_INT, align: "center" });
        setCell(r, 14, f.target ? f.pct : 0, { bold: true, fill: XL_COLORS.gold, numFmt: XL_NUMFMT_PCT1, align: "center" });
      } else {
        blank(r, [11, 12, 13, 14]);
      }
      r++;
    }
    merge(startRow, 1, r - 1, 1);
    setCell(startRow, 1, idx + 1, { bold: true, align: "center" });
  });

  // ---- baris TOTAL ----
  const sum = (arr) => arr.reduce((a, b) => a + (b || 0), 0);
  const tTargetV = sum(totalTargetV), tTargetAo = sum(totalTargetAo);
  const tRealV = sum(totalRealV), tRealAo = sum(totalRealAo);
  setCell(r, 1, "", { fill: XL_COLORS.navy });
  setCell(r, 2, "TOTAL", { bold: true, fill: XL_COLORS.navy, color: "FFFFFF", align: "left" });
  setCell(r, 3, tTargetV, { bold: true, fill: XL_COLORS.navy, color: "FFFFFF", numFmt: XL_NUMFMT_MONEY });
  setCell(r, 4, tTargetAo, { bold: true, fill: XL_COLORS.navy, color: "FFFFFF", numFmt: XL_NUMFMT_INT, align: "center" });
  setCell(r, 5, tRealV, { bold: true, fill: XL_COLORS.navy, color: "FFFFFF", numFmt: XL_NUMFMT_MONEY });
  setCell(r, 6, tRealAo, { bold: true, fill: XL_COLORS.navy, color: "FFFFFF", numFmt: XL_NUMFMT_INT, align: "center" });
  setCell(r, 7, tTargetV ? tRealV / tTargetV : "-", { bold: true, numFmt: tTargetV ? XL_NUMFMT_PCT : undefined, align: "center" });
  setCell(r, 8, tTargetAo ? tRealAo / tTargetAo : "-", { bold: true, numFmt: tTargetAo ? XL_NUMFMT_PCT : undefined, align: "center" });
  setCell(r, 9, tTargetV - tRealV, { bold: true, fill: XL_COLORS.navy, color: "FFFFFF", numFmt: XL_NUMFMT_MONEY });
  setCell(r, 10, tTargetAo - tRealAo, { bold: true, fill: XL_COLORS.navy, color: "FFFFFF", numFmt: XL_NUMFMT_INT, align: "center" });
  blank(r, [11, 12, 13, 14]);

  const anyUnconvertible = agg.bySales.some((sm) => sm.focus.some((f) => f.hasUnconvertible));
  if (anyUnconvertible) {
    const noteRow = r + 2;
    setCell(noteRow, 2, "* Sebagian transaksi produk ini tidak bisa dikonversi ke satuan karton (tidak ada baris satuan KARTON untuk produk tsb di data mentah) — angka realisasi memakai satuan asli.", { align: "left", size: 9, border: false });
    merge(noteRow, 2, noteRow, 14);
  }

  ws["!ref"] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: lastRow - 1, c: 13 } });
  ws["!merges"] = merges;
  ws["!cols"] = [4, 22, 15, 8, 15, 8, 10, 8, 15, 8, 22, 10, 11, 9].map((w) => ({ wch: w }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Laporan");
  XLSX.writeFile(wb, `Laporan_Sales_${todayLocalDateStr()}.xlsx`);
}

/* ============================================================================
   APP SHELL
============================================================================ */
const TABS = [
  { key: "main", label: "Main Report", icon: LayoutDashboard },
  { key: "sales", label: "Sales Report", icon: UserRound },
  { key: "product", label: "Product Report", icon: Boxes },
  { key: "focus", label: "Product Focus", icon: Crosshair },
  { key: "quality", label: "Catatan Data", icon: ClipboardList },
];

export default function SalesMonitoringApp() {
  // Dibaca sekali di render pertama (lazy initializer useState menjamin ini
  // hanya jalan sekali, bukan setiap render) — jadi field-field di bawahnya
  // bisa langsung memakai nilai tersimpan kalau ada, atau fallback ke default.
  const [persistedSettings] = useState(() => loadSettings());

  const [rawRows, setRawRows] = useState([]);
  const [fileName, setFileName] = useState("");
  const [loading, setLoading] = useState(false);
  const [sampleLoading, setSampleLoading] = useState(false);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("main");
  const [theme, setTheme] = useState(persistedSettings?.theme || 'dark');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [drilldown, setDrilldown] = useState(null);
  const [pendingPreview, setPendingPreview] = useState(null);
  const [parseMeta, setParseMeta] = useState(null);

  const [filters, setFilters] = useState(persistedSettings?.filters || { salesCodes: [], groups: [], dateFrom: "", dateTo: "" });
  const [workDays, setWorkDays] = useState(persistedSettings?.workDays ?? WORK_DAYS_DEFAULT);
  const [targets, setTargets] = useState(persistedSettings?.targets ?? DEFAULT_TARGETS);
  const [depotName, setDepotName] = useState(persistedSettings?.depotName ?? "DEPO LOTIM");

  // Muat data sesi terakhir (hasil upload/demo sebelumnya) dari IndexedDB saat
  // pertama kali app dibuka. Async, jadi ditampilkan status loading singkat
  // dulu supaya tidak "flash" ke tampilan "Belum ada data" sebelum sempat dicek.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const session = await loadSession();
      if (!cancelled && session) {
        setRawRows(session.rawRows || []);
        setFileName(session.fileName || "");
        setParseMeta(session.parseMeta || null);
      }
      if (!cancelled) setSessionLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  // Simpan otomatis setiap kali pengaturan berubah (tema, filter, target,
  // hari kerja, nama depo) — jadi tidak perlu tombol "simpan" terpisah untuk ini,
  // beda dengan raw data yang lebih berat dan disimpan terpisah di bawah.
  useEffect(() => {
    saveSettings({ theme, filters, workDays, targets, depotName });
  }, [theme, filters, workDays, targets, depotName]);

  // Simpan otomatis data transaksi ke IndexedDB tiap kali berubah (setelah upload
  // dikonfirmasi atau data contoh dimuat). Di-skip saat kosong karena reset
  // ditangani secara eksplisit lewat clearSession() di handleReset.
  useEffect(() => {
    if (rawRows.length) saveSession({ rawRows, fileName, parseMeta });
  }, [rawRows, fileName, parseMeta]);

  const colors = useMemo(() => THEMES[theme], [theme]);
  const globalStyle = useMemo(() => createGlobalStyle(colors), [colors]);

  const groupOptions = useMemo(() => {
    const s = new Set();
    targets.forEach((t) => t.groups.forEach((g) => s.add(g.name)));
    rawRows.forEach((r) => r.group && s.add(r.group));
    return Array.from(s).sort();
  }, [targets, rawRows]);

  const salesOptions = useMemo(() => targets.map((t) => ({ name: t.name, code: t.code })), [targets]);
  const aggFinal = useAggregates(rawRows, targets, filters, workDays);
  const dataQualityNotes = useDataQualityNotes(rawRows, targets, parseMeta);
  const openDrilldown = (title, subtitle, predicate) => {
    setDrilldown({ title, subtitle, outlets: getOutletBreakdown(aggFinal.filteredRows, predicate) });
  };

  const handleFile = useCallback(async (file) => {
    setLoading(true); setError("");
    try {
      const { rows, parseMeta: meta } = await parseWorkbookFile(file);
      if (!rows.length) {
        setError("File terbaca tapi tidak ada baris data yang cocok. Pastikan kolom sesuai format sell-out.");
        setLoading(false);
        return;
      }
      // Data belum langsung dipakai — tampilkan preview dulu, biar kesalahan format
      // (kolom tidak terbaca, tanggal kosong, dsb) ketahuan sebelum masuk ke dashboard.
      setPendingPreview({ rows, parseMeta: meta, fileName: file.name });
    } catch (e) {
      setError("Gagal membaca file. Pastikan formatnya .xlsx/.xls yang valid.");
    } finally { setLoading(false); }
  }, []);

  const confirmPreview = useCallback(() => {
    if (!pendingPreview) return;
    const { rows, parseMeta: meta, fileName: name } = pendingPreview;
    setRawRows(rows);
    setParseMeta(meta);
    setFileName(name);
    const dateStrs = rows.map(r => r.date).filter(Boolean).sort();
    if (dateStrs.length) {
      setFilters(f => ({ ...f, dateFrom: dateStrs[0], dateTo: dateStrs[dateStrs.length - 1] }));
    }
    setPendingPreview(null);
  }, [pendingPreview]);

  const cancelPreview = useCallback(() => setPendingPreview(null), []);

  const handleSample = useCallback(() => {
    setSampleLoading(true);
    // Simulasi loading agar terasa responsif
    setTimeout(() => {
      const sampleRows = generateSampleRows();
      setRawRows(sampleRows);
      setFileName("Data Contoh (demo)");
      setParseMeta({ totalDataRows: sampleRows.length, skippedBlankRows: 0, rowsWithMissingDate: 0,
        detectedFields: Object.keys(ALIASES), missingFields: [] });
      setFilters({ salesCodes: [], groups: [], dateFrom: "2026-07-01", dateTo: "2026-07-03" });
      setSampleLoading(false);
    }, 300);
  }, []);

  const handleReset = useCallback(() => {
    setRawRows([]); setFileName(""); setParseMeta(null);
    clearSession();
  }, []);

  // Hapus TOTAL semua yang tersimpan di perangkat ini: settings (localStorage)
  // + data sesi (IndexedDB) + reset semua state ke default pabrik.
  const handleClearAll = useCallback(() => {
    clearSettings();
    clearSession();
    setRawRows([]); setFileName(""); setParseMeta(null);
    setFilters({ salesCodes: [], groups: [], dateFrom: "", dateTo: "" });
    setWorkDays(WORK_DAYS_DEFAULT);
    setTargets(DEFAULT_TARGETS);
    setDepotName("DEPO LOTIM");
    setTheme('dark');
  }, []);

  const activeIdx = TABS.findIndex((t) => t.key === activeTab);

  return (
    <div className="smapp min-h-screen transition-colors duration-300" style={{ background: theme === 'dark' ? `radial-gradient(1200px 600px at 10% -10%, #16233F 0%, ${colors.ink} 60%)` : colors.ink }}>
      <style>{globalStyle}</style>
      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} targets={targets} setTargets={setTargets} workDays={workDays} setWorkDays={setWorkDays} depotName={depotName} setDepotName={setDepotName} onClearAll={handleClearAll} colors={colors} />
      <OutletDrilldownModal isOpen={!!drilldown} onClose={() => setDrilldown(null)} title={drilldown?.title} subtitle={drilldown?.subtitle} outlets={drilldown?.outlets || []} colors={colors} />
      <DataPreviewModal isOpen={!!pendingPreview} onCancel={cancelPreview} onConfirm={confirmPreview} preview={pendingPreview} colors={colors} />
      <div className="max-w-7xl mx-auto px-4 md:px-8 py-6">
        {/* header */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6 sm-fadeup">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl" style={{ background: `linear-gradient(135deg, ${colors.gold}, ${colors.coral})` }}>
              <FileSpreadsheet size={20} color="#0A1120" />
            </div>
            <div>
              <h1 className="disp text-xl font-bold">Monitoring Penjualan<b className="text-xs" style={{ color: colors.textMuted }}> by</b><b className="disp text-xl font-bold" style={{ color: colors.coral }}> Andri.S</b></h1>
              <p className="text-xs" style={{ color: colors.textMuted }}>Dashboard pencapaian sales, produk & produk fokus</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}
              className="sm-btn flex items-center gap-2 px-2.5 py-2.5 rounded-xl text-sm font-semibold"
              style={{ background: colors.surface2, color: colors.text, border: `1px solid ${colors.border}` }}>
              {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
            </button>
            <button onClick={() => setIsSettingsOpen(true)}
              className="sm-btn flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold"
              style={{ background: colors.surface2, color: colors.text, border: `1px solid ${colors.border}` }}>
              <Settings size={15} /> Pengaturan
            </button>
            <button onClick={() => exportToExcel(aggFinal, targets, { workDays, depotName })} disabled={!rawRows.length}
              className="sm-btn flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-40"
              style={{ background: colors.gold, color: "#0A1120" }}>
              <Download size={15} /> Export Excel
            </button>
          </div>
        </div>

        {/* upload */}
        <div className="mb-6 sm-fadeup" style={{ animationDelay: "40ms" }}>
          <UploadDropzone onFile={handleFile} hasData={!!rawRows.length} fileName={fileName} onReset={handleReset} onSample={handleSample} loading={loading} sampleLoading={sampleLoading} colors={colors} />
          {error && (
            <div className="mt-3 flex items-center gap-2 text-sm px-4 py-2.5 rounded-xl" style={{ background: colors.coral + "14", color: colors.coral, border: `1px solid ${colors.coral}33` }}>
              <AlertTriangle size={14} /> {error}
            </div>
          )}
        </div>

        {/* tabs */}
        <div className="relative flex gap-1 mb-6 p-1 rounded-2xl sm-fadeup" style={{ background: colors.surface, border: `1px solid ${colors.border}`, animationDelay: "80ms" }}>
          <div className="absolute top-1 bottom-1 rounded-xl transition-all duration-300 ease-out"
            style={{ left: `calc(${activeIdx * 20}% + 4px)`, width: "calc(20% - 8px)", background: colors.surface2, border: `1px solid ${colors.border}` }} />
          {TABS.map((t) => {
            const Icon = t.icon;
            const isActive = t.key === activeTab;
            return (
              <button key={t.key} onClick={() => setActiveTab(t.key)}
                className="sm-tab-btn relative z-10 flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium"
                style={{ color: isActive ? colors.gold : colors.textMuted }}>
                <Icon size={15} /> <span className="hidden sm:inline">{t.label}</span>
              </button>
            );
          })}
        </div>

        {sessionLoading ? (
          <div className="sm-card p-16 text-center sm-fadeup">
            <Loader2 size={24} className="mx-auto mb-4 animate-spin" style={{ color: colors.textMuted }} />
            <p className="text-sm" style={{ color: colors.textMuted }}>Memuat data sesi terakhir...</p>
          </div>
        ) : !rawRows.length ? (
          <div className="sm-card p-16 text-center sm-fadeup">
            <div className="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center" style={{ background: colors.surface2 }}>
              <FileSpreadsheet size={24} style={{ color: colors.textMuted }} />
            </div>
            <div className="disp text-base font-semibold mb-1">Belum ada data</div>
            <p className="text-sm" style={{ color: colors.textMuted }}>Upload file Excel sell-out di atas, atau coba dengan data contoh untuk melihat dashboard bekerja.</p>
          </div>
        ) : (
          <>
            <FilterBar salesOptions={salesOptions} groupOptions={groupOptions} filters={filters} setFilters={setFilters} colors={colors} />
            {activeTab === "main" && <MainReportPage agg={aggFinal} workDays={workDays} colors={colors} onDrilldown={openDrilldown} />}
            {activeTab === "sales" && <SalesReportPage agg={aggFinal} colors={colors} onDrilldown={openDrilldown} />}
            {activeTab === "product" && <ProductReportPage agg={aggFinal} colors={colors} onDrilldown={openDrilldown} />}
            {activeTab === "focus" && <ProductFocusReportPage agg={aggFinal} colors={colors} onDrilldown={openDrilldown} />}
            {activeTab === "quality" && <DataQualityPage notes={dataQualityNotes} colors={colors} onDrilldown={openDrilldown} />}
          </>
        )}

        <div className="text-center text-xs mt-10 pb-4" style={{ color: colors.textMuted }}>
          Data diproses langsung di browser Anda — tidak diunggah ke server manapun. Data & pengaturan disimpan otomatis di perangkat/browser ini agar tidak hilang saat refresh.
        </div>
      </div>
    </div>
  );
}
