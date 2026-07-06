import React, { useState, useMemo, useCallback, useEffect, useRef } from "react";
import * as XLSX from "xlsx";
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
} from "lucide-react";
import { fmtRp, fmtNum, fmtPct } from "./utils/formatters.js";
import { useCountUp } from "./hooks/useCountUp.js";
import { KpiCard } from "./components/KpiCard.jsx";
import { AchBadge } from "./components/AchBadge.jsx";
import { PaceStrip } from "./components/PaceStrip.jsx";
import { DEFAULT_TARGETS } from "./constants/defaultTargets.js";

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
  productName: ["NMBR", "NAMA BARANG", "PRODUCT", "PRODUK"],
  qty: ["JUML", "QTY", "QUANTITY"],
  unit: ["UNIT", "SATUAN"],
  value: ["NTOT", "VALUE", "NILAI", "TOTAL"],
  group: ["GRUP", "GROUP", "KATEGORI", "GOLONGAN"],
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
        if (!aoa.length) return resolve([]);
        const headerRowIdx = 0;
        const fmap = buildFieldMap(aoa[headerRowIdx]);
        const rows = [];
        for (let i = headerRowIdx + 1; i < aoa.length; i++) {
          const r = aoa[i];
          if (!r || r.every((c) => c === null || c === "")) continue;
          const get = (f) => (fmap[f] !== undefined ? r[fmap[f]] : null);
          const dateRaw = get("date");
          rows.push({
            date: excelValueToDateStr(dateRaw),
            salesCode: String(get("salesCode") || "").trim(),
            salesName: String(get("salesName") || "").trim(),
            outletCode: String(get("outletCode") || "").trim(),
            outletName: String(get("outletName") || "").trim(),
            invoiceNo: String(get("invoiceNo") || "").trim(),
            productName: String(get("productName") || "").trim(),
            qty: Number(get("qty")) || 0,
            unit: String(get("unit") || "").trim().toUpperCase(),
            value: Number(get("value")) || 0,
            group: String(get("group") || "").trim(),
          });
        }
        resolve(rows);
      } catch (err) { reject(err); }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
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
  return rows;
}

/* ============================================================================
   AGGREGATION HELPERS
============================================================================ */
// row.date sudah berupa teks "YYYY-MM-DD" (lihat excelValueToDateStr), jadi tinggal dipakai apa adanya.
function dateKey(dateStr) { return dateStr || "unknown"; }
function monthKey(dateStr) { return dateStr ? dateStr.slice(0, 7) : "unknown"; }

function matchFocus(row, focusItem) {
  if (focusItem.keyword === "__GROUP__") return normalizeHeader(row.group) === normalizeHeader(focusItem.name);

  // Default to KARTON if unit is not specified in config, for backward compatibility
  const targetUnit = normalizeHeader(focusItem.unit || "KARTON");
  if (normalizeHeader(row.unit) !== targetUnit) return false;

  const nameMatches = focusItem.keyword === "GAS_EXACT"
    ? normalizeHeader(row.productName) === "GAS"
    : normalizeHeader(row.productName).includes(normalizeHeader(focusItem.keyword));

  return nameMatches;
}

function useAggregates(rows, targets, filters) {
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

    // Satu kali scan atas `filtered` untuk membangun semua struktur yang dipakai di bawah.
    // Sebelumnya bySales, byGroup, dan focusRows masing-masing memanggil `filtered.filter(...)`
    // dari NOL untuk tiap sales / tiap grup / tiap kombinasi sales×produk-fokus — untuk data
    // dengan banyak baris & banyak sales/produk fokus ini jadi O(n × jumlah_sales) dst.
    // Dengan mengelompokkan baris per kode sales & per grup dalam satu pass (O(n)), langkah-langkah
    // berikutnya tinggal memakai subset yang sudah kecil, bukan menyisir ulang seluruh array.
    const rowsBySales = new Map();
    const rowsByGroup = new Map();
    const dailyMap = new Map();
    const monthlyMap = new Map();
    const allOutletKeys = new Set();

    for (const r of filtered) {
      let salesBucket = rowsBySales.get(r.salesCode);
      if (!salesBucket) { salesBucket = []; rowsBySales.set(r.salesCode, salesBucket); }
      salesBucket.push(r);

      if (r.group) {
        let groupBucket = rowsByGroup.get(r.group);
        if (!groupBucket) { groupBucket = []; rowsByGroup.set(r.group, groupBucket); }
        groupBucket.push(r);
      }

      const dk = dateKey(r.date);
      let d = dailyMap.get(dk);
      if (!d) { d = { date: dk, value: 0, outlets: new Set() }; dailyMap.set(dk, d); }
      d.value += r.value;
      d.outlets.add(r.outletCode);

      const mk = monthKey(r.date);
      monthlyMap.set(mk, (monthlyMap.get(mk) || 0) + r.value);

      allOutletKeys.add(r.salesCode + "|" + r.outletCode);
    }

    // per sales — pakai subset dari rowsBySales, bukan filter ulang `filtered`
    const bySales = relevantTargets.map((t) => {
      const rs = rowsBySales.get(t.code) || [];
      const value = _.sumBy(rs, "value");
      const ao = new Set(rs.map((r) => r.outletCode)).size;
      const ach = t.total.value ? value / t.total.value : null;
      const achAo = t.total.ao ? ao / t.total.ao : null;
      return { code: t.code, name: t.name, tier: t.tier, targetValue: t.total.value, targetAo: t.total.ao,
        realisasiValue: value, realisasiAo: ao, ach, achAo,
        deviasiValue: t.total.value ? t.total.value - value : null,
        deviasiAo: t.total.ao ? t.total.ao - ao : null };
    });

    const totalTargetValue = _.sumBy(bySales, "targetValue");
    const totalTargetAo = _.sumBy(bySales, "targetAo");
    const totalRealisasiValue = _.sumBy(bySales, "realisasiValue");
    const totalRealisasiAo = allOutletKeys.size;
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
      const rs = rowsByGroup.get(gname) || [];
      const value = _.sumBy(rs, "value");
      const ao = new Set(rs.map((r) => r.outletCode)).size;
      const ach = targetValue ? value / targetValue : null;
      return { name: gname, targetValue, targetAo, realisasiValue: value, realisasiAo: ao, ach,
        deviasiValue: targetValue ? targetValue - value : null };
    }).sort((a, b) => b.realisasiValue - a.realisasiValue);

    // daily series
    const daily = Array.from(dailyMap.values())
      .map((d) => ({ date: d.date, value: d.value, ao: d.outlets.size }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // monthly (cumulative) series
    const monthly = Array.from(monthlyMap.entries())
      .map(([m, v]) => ({ month: m, value: v }))
      .sort((a, b) => a.month.localeCompare(b.month));

    // focus products — cari kecocokan hanya di dalam baris milik sales tsb (rowsBySales),
    // bukan menyisir ulang seluruh `filtered` untuk tiap kombinasi sales×produk-fokus
    const focusRows = [];
    relevantTargets.forEach((t) => {
      if (!t.focus.length) return;
      const salesRows = rowsBySales.get(t.code) || [];
      t.focus.forEach((f) => {
        const rs = salesRows.filter((r) => matchFocus(r, f));
        const realisasi = _.sumBy(rs, "qty");
        const pct = f.target ? realisasi / f.target : null;
        focusRows.push({ salesCode: t.code, salesName: t.name, name: f.name, target: f.target, realisasi, pct });
      });
    });

    return {
      filteredRows: filtered, bySales, byGroup, daily, monthly, focusRows,
      totals: { targetValue: totalTargetValue, targetAo: totalTargetAo, realisasiValue: totalRealisasiValue,
        realisasiAo: totalRealisasiAo, ach: overallAch,
        deviasiValue: totalTargetValue ? totalTargetValue - totalRealisasiValue : null },
    };
  }, [rows, targets, filters]);
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

function DataTable({ columns, rows, initialSortKey, colors }) {
  const [sortKey, setSortKey] = useState(initialSortKey || columns[0].key);
  const [sortDir, setSortDir] = useState("desc");
  const sorted = useMemo(() => {
    const arr = [...rows];
    arr.sort((a, b) => {
      const va = a[sortKey], vb = b[sortKey];
      if (typeof va === "string") return sortDir === "asc" ? va.localeCompare(vb) : vb.localeCompare(va);
      return sortDir === "asc" ? (va || 0) - (vb || 0) : (vb || 0) - (va || 0);
    });
    return arr;
  }, [rows, sortKey, sortDir]);
  const toggleSort = (k) => { if (k === sortKey) setSortDir(sortDir === "asc" ? "desc" : "asc"); else { setSortKey(k); setSortDir("desc"); } };
  return (
    <div className="sm-card overflow-hidden">
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
              <tr><td colSpan={columns.length} className="px-4 py-10 text-center" style={{ color: colors.textMuted }}>Belum ada data untuk filter ini</td></tr>
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

/* ============================================================================
   PAGES
============================================================================ */
function MainReportPage({ agg, workDays, colors }) {
  const uniqueDaysInData = useMemo(() => new Set(agg.filteredRows.map(r => dateKey(r.date))).size, [agg.filteredRows]);
  const t = agg.totals;
  // Calculate time gone based on unique work days found in the data vs total work days in the month.
  const timeGone = workDays ? Math.min(1, uniqueDaysInData / workDays) : 0;
  return (
    <div className="sm-fadein">
      <PaceStrip timeGonePct={timeGone} achPct={t.ach} colors={colors} />
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
        <KpiCard label="Target Value" value={t.targetValue} isMoney icon={Target} accent={colors.blue} delay={0} colors={colors} />
        <KpiCard label="Realisasi Value" value={t.realisasiValue} isMoney icon={TrendingUp} accent={colors.mint} delay={40} colors={colors} />
        <KpiCard label="Achievement" value={t.ach} isPct icon={Sparkles} accent={colors.gold} delay={80} colors={colors} />
        <KpiCard label="Deviasi Value" value={t.deviasiValue} isMoney icon={TrendingDown} accent={colors.coral} delay={120} colors={colors} />
        <KpiCard label="Active Outlet" value={t.realisasiAo} icon={Users} accent={colors.violet} delay={160} colors={colors} />
        <KpiCard label="Target AO" value={t.targetAo} icon={Boxes} accent={colors.textMuted} delay={200} colors={colors} />
      </div>

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
        ]}
        rows={agg.bySales}
      />
    </div>
  );
}

function SalesReportPage({ agg, colors }) {
  const rows = agg.bySales;
  const topGroups = useMemo(() => {
    const bySalesGroup = {};
    agg.filteredRows.forEach((r) => {
      const key = r.salesCode + "|" + r.group;
      bySalesGroup[key] = (bySalesGroup[key] || 0) + r.value;
    });
    return bySalesGroup;
  }, [agg.filteredRows]);

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
          columns={[
            { key: "salesName", label: "Sales" },
            { key: "groupName", label: "Grup Produk" },
            { key: "value", label: "Realisasi", render: (r) => <span className="mono">{fmtRp(r.value)}</span> },
          ]}
          rows={Object.entries(topGroups).map(([k, v]) => {
            const [code, group] = k.split("|");
            const sm = rows.find((r) => r.code === code);
            return { salesName: sm ? sm.name : code, groupName: group || "-", value: v };
          })}
        />
      </div>
    </div>
  );
}

function ProductReportPage({ agg, colors }) {
  
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
          columns={[
            { key: "name", label: "Grup Produk" },
            { key: "targetValue", label: "Target", render: (r) => <span className="mono">{fmtRp(r.targetValue)}</span> },
            { key: "realisasiValue", label: "Realisasi", render: (r) => <span className="mono">{fmtRp(r.realisasiValue)}</span> },
            { key: "ach", label: "ACH", render: (r) => <AchBadge ach={r.ach} colors={colors} /> },
            { key: "realisasiAo", label: "Outlet", render: (r) => <span className="mono">{r.realisasiAo}</span> },
          ]}
          rows={agg.byGroup}
        />
      </div>
    </div>
  );
}

function ProductFocusReportPage({ agg, colors }) {
  const [focusFilter, setFocusFilter] = useState([]);
  const focusNames = useMemo(() => Array.from(new Set(agg.focusRows.map((f) => f.name))), [agg.focusRows]);
  const rows = focusFilter.length ? agg.focusRows.filter((f) => focusFilter.includes(f.name)) : agg.focusRows;
  return (
    <div className="sm-fadein">
      <div className="mb-6">
        <MultiSelect label="Produk Fokus" icon={Crosshair} options={focusNames} selected={focusFilter} onChange={setFocusFilter} placeholder="Cari produk fokus..." colors={colors} />
      </div>
      <SectionTitle title="Pencapaian Produk Fokus per Sales" sub="Target & realisasi dalam satuan karton" icon={Crosshair} colors={colors} />
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
                  <div className="text-sm font-semibold disp">{f.name}</div>
                  <div className="text-xs" style={{ color: colors.textMuted }}>{f.salesName}</div>
                </div>
                <span className="mono text-sm font-semibold" style={{ color }}>{fmtPct(f.pct)}</span>
              </div>
              <div className="h-2.5 rounded-full overflow-hidden" style={{ background: colors.surface2 }}>
                <div className="sm-progress-fill h-full rounded-full" style={{ width: `${Math.min(100, pct)}%`, background: color }} />
              </div>
              <div className="flex justify-between mt-1.5 text-xs mono" style={{ color: colors.textMuted }}>
                <span>{fmtNum(f.realisasi)} karton</span>
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
        columns={[
          { key: "salesName", label: "Sales" },
          { key: "name", label: "Produk Fokus" },
          { key: "target", label: "Target", render: (r) => <span className="mono">{fmtNum(r.target)}</span> },
          { key: "realisasi", label: "Realisasi", render: (r) => <span className="mono">{fmtNum(r.realisasi)}</span> },
          { key: "pct", label: "%", render: (r) => <AchBadge ach={r.pct} colors={colors} /> },
        ]}
        rows={rows}
      />
    </div>
  );
}

function SettingsModal({ isOpen, onClose, targets, setTargets, workDays, setWorkDays, colors }) {
  const [localTargets, setLocalTargets] = useState(targets);
  const [localWorkDays, setLocalWorkDays] = useState(workDays);

  useEffect(() => {
    if (isOpen) {
      setLocalTargets(targets);
      setLocalWorkDays(workDays);
    }
  }, [isOpen, targets, workDays]);

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
          <div className="mb-6">
            <label className="block text-sm font-medium mb-2">Hari Kerja Efektif</label>
            <input type="number" value={localWorkDays} onChange={e => setLocalWorkDays(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-lg mono" style={{ background: colors.surface2, border: `1px solid ${colors.border}` }} />
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

function exportToExcel(agg, targets) {
  const wb = XLSX.utils.book_new();
  const wsSales = XLSX.utils.json_to_sheet(agg.bySales.map((r) => ({
    Sales: r.name, "Target Value": r.targetValue, "Realisasi Value": r.realisasiValue,
    "ACH %": r.ach !== null ? +(r.ach * 100).toFixed(2) : "-", "Deviasi Value": r.deviasiValue,
    "Target AO": r.targetAo, "Realisasi AO": r.realisasiAo,
  })));
  XLSX.utils.book_append_sheet(wb, wsSales, "Ringkasan Sales");

  const wsGroup = XLSX.utils.json_to_sheet(agg.byGroup.map((r) => ({
    "Grup Produk": r.name, "Target Value": r.targetValue, "Realisasi Value": r.realisasiValue,
    "ACH %": r.ach !== null ? +(r.ach * 100).toFixed(2) : "-", "Realisasi AO": r.realisasiAo,
  })));
  XLSX.utils.book_append_sheet(wb, wsGroup, "Per Grup Produk");

  const wsFocus = XLSX.utils.json_to_sheet(agg.focusRows.map((r) => ({
    Sales: r.salesName, "Produk Fokus": r.name, Target: r.target, Realisasi: r.realisasi,
    "% Pencapaian": r.pct !== null ? +(r.pct * 100).toFixed(2) : "-",
  })));
  XLSX.utils.book_append_sheet(wb, wsFocus, "Produk Fokus");

  const wsDaily = XLSX.utils.json_to_sheet(agg.daily.map((r) => ({ Tanggal: dateStrToLocalDate(r.date) || r.date, Realisasi: r.value, "Active Outlet": r.ao })));
  XLSX.utils.book_append_sheet(wb, wsDaily, "Tren Harian");

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
];

export default function SalesMonitoringApp() {
  const [rawRows, setRawRows] = useState([]);
  const [fileName, setFileName] = useState("");
  const [loading, setLoading] = useState(false);
  const [sampleLoading, setSampleLoading] = useState(false);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("main");
  const [theme, setTheme] = useState('dark');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const [filters, setFilters] = useState({ salesCodes: [], groups: [], dateFrom: "", dateTo: "" });
  const [workDays, setWorkDays] = useState(WORK_DAYS_DEFAULT);
  const [targets, setTargets] = useState(DEFAULT_TARGETS);

  const colors = useMemo(() => THEMES[theme], [theme]);
  const globalStyle = useMemo(() => createGlobalStyle(colors), [colors]);

  const groupOptions = useMemo(() => {
    const s = new Set();
    targets.forEach((t) => t.groups.forEach((g) => s.add(g.name)));
    rawRows.forEach((r) => r.group && s.add(r.group));
    return Array.from(s).sort();
  }, [targets, rawRows]);

  const salesOptions = useMemo(() => targets.map((t) => ({ name: t.name, code: t.code })), [targets]);
  const aggFinal = useAggregates(rawRows, targets, filters);

  const handleFile = useCallback(async (file) => {
    setLoading(true); setError("");
    try {
      const rows = await parseWorkbookFile(file);
      if (!rows.length) { setError("File terbaca tapi tidak ada baris data yang cocok. Pastikan kolom sesuai format sell-out."); }
      setRawRows(rows);
      if (rows.length > 0) {
        const dateStrs = rows.map(r => r.date).filter(Boolean).sort();
        if (dateStrs.length) {
          setFilters(f => ({
            ...f,
            dateFrom: dateStrs[0],
            dateTo: dateStrs[dateStrs.length - 1],
          }));
        }
      }
      setFileName(file.name);
    } catch (e) {
      setError("Gagal membaca file. Pastikan formatnya .xlsx/.xls yang valid.");
    } finally { setLoading(false); }
  }, []);

  const handleSample = useCallback(() => {
    setSampleLoading(true);
    // Simulasi loading agar terasa responsif
    setTimeout(() => {
      const sampleRows = generateSampleRows();
      setRawRows(sampleRows);
      setFileName("Data Contoh (demo)");
      setFilters({ salesCodes: [], groups: [], dateFrom: "2026-07-01", dateTo: "2026-07-03" });
      setSampleLoading(false);
    }, 300);
  }, []);

  const handleReset = useCallback(() => { setRawRows([]); setFileName(""); }, []);

  const activeIdx = TABS.findIndex((t) => t.key === activeTab);

  return (
    <div className="smapp min-h-screen transition-colors duration-300" style={{ background: theme === 'dark' ? `radial-gradient(1200px 600px at 10% -10%, #16233F 0%, ${colors.ink} 60%)` : colors.ink }}>
      <style>{globalStyle}</style>
      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} targets={targets} setTargets={setTargets} workDays={workDays} setWorkDays={setWorkDays} colors={colors} />
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
            <button onClick={() => exportToExcel(aggFinal, targets)} disabled={!rawRows.length}
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
            style={{ left: `calc(${activeIdx * 25}% + 4px)`, width: "calc(25% - 8px)", background: colors.surface2, border: `1px solid ${colors.border}` }} />
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

        {!rawRows.length ? (
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
            {activeTab === "main" && <MainReportPage agg={aggFinal} workDays={workDays} colors={colors} />}
            {activeTab === "sales" && <SalesReportPage agg={aggFinal} colors={colors} />}
            {activeTab === "product" && <ProductReportPage agg={aggFinal} colors={colors} />}
            {activeTab === "focus" && <ProductFocusReportPage agg={aggFinal} colors={colors} />}
          </>
        )}

        <div className="text-center text-xs mt-10 pb-4" style={{ color: colors.textMuted }}>
          Data diproses langsung di browser Anda — tidak diunggah ke server manapun.
        </div>
      </div>
    </div>
  );
}
