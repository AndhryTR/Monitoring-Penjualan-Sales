import React, { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import sumBy from "lodash/sumBy";
import {
  ResponsiveContainer, BarChart, Bar, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Cell,
} from "recharts";
import {
  Upload, Download, X, ChevronDown, Search, RefreshCw, Users, Package,
  Target, TrendingUp, TrendingDown, Sparkles, LayoutDashboard, UserRound,
  Boxes, Crosshair, Check, AlertTriangle, CalendarDays, Settings,
  FileSpreadsheet, ArrowUpRight, ArrowDownRight, Minus, Sun, Moon, ChevronLeft, ChevronRight, Menu, Filter,
  Store, Trophy, BellRing, Rocket, ClipboardList, CheckCircle2, XCircle, FileQuestion, Smartphone, Share, Printer, FileText, History, Copy, Plus,
} from "lucide-react";
import { fmtRp, fmtNum, fmtPct } from "./utils/formatters.js";
import { saveSettings, loadSettings, clearSettings, saveSession, loadSession, clearSession, saveHistory, loadHistory, clearHistory } from "./utils/storage.js";
import { exportSummaryPDF, exportSalesScorecardPDF, exportAllScorecardsPDF } from "./utils/pdfExport.js";
import { exportToExcel } from "./utils/excelExport.js";
import {
  parseWorkbookFile, dedupeRows, effectiveKartonQty,
} from "./utils/excelParse.js";
import {
  useAggregates, getOutletBreakdown, computeOutletAnalysis, getProductBreakdownForOutlet, dateKey,
} from "./utils/aggregation.js";
import { useDataQualityNotes } from "./utils/dataQuality.js";
import { buildHistorySnapshot, computeComparison, computeMultiPeriodComparison } from "./utils/history.js";
import { generateSampleRows } from "./utils/sampleData.js";
import { ALIASES, FIELD_LABELS } from "./constants/aliases.js";
import { PRIMARY_TABS, MORE_TABS } from "./constants/tabs.js";
import { WORK_DAYS_DEFAULT, OUTLET_DEFAULT_THRESHOLDS } from "./constants/thresholds.js";
import DEFAULT_TARGETS from "./constants/defaultTargets.json";
// Modul virtual dari vite-plugin-pwa — hanya ada saat plugin ini terpasang &
// dijalankan lewat Vite (dev atau build), bukan package npm biasa.
import { useRegisterSW } from "virtual:pwa-register/react";
import { useCountUp } from "./hooks/useCountUp.js";
import { KpiCard } from "./components/KpiCard.jsx";
import { AchBadge } from "./components/AchBadge.jsx";
import { PaceStrip } from "./components/PaceStrip.jsx";
import { MultiSelect } from "./components/ui/MultiSelect.jsx";
import { FilterBar } from "./components/ui/FilterBar.jsx";
import { DataTable } from "./components/ui/DataTable.jsx";
import { SectionTitle, DrilldownButton, createChartTooltipStyle } from "./components/ui/index.jsx";
import { DashboardSkeleton } from "./components/ui/DashboardSkeleton.jsx";
import { Leaderboard, ProjectionCard, AlertsPanel, PeriodComparisonCard } from "./components/cards/index.jsx";
import { UploadDropzone, MobileBottomNav, MobileFab, ExportMenu } from "./components/upload/index.jsx";
import { TrendPeriodePage } from "./components/trend/index.jsx";

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
   SMALL UI PRIMITIVES
============================================================================ */

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
  const totalValue = sumBy(filteredOutlets, "value");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm sm-fadein">
      <div className="sm-card sm-scale-in w-full max-w-2xl max-h-[85vh] flex flex-col" style={{ background: colors.surface }}>
        <div className="p-5 flex items-center justify-between" style={{ borderBottom: `1px solid ${colors.border}` }}>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl" style={{ background: colors.violet + "1A" }}><Store size={16} style={{ color: colors.violet }} /></div>
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

function OutletDetailModal({ isOpen, onClose, outlet, products, colors }) {
  const [query, setQuery] = useState("");
  useEffect(() => { if (isOpen) setQuery(""); }, [isOpen, outlet]);

  if (!isOpen || !outlet) return null;

  const filtered = query.trim()
    ? products.filter((p) => p.productName.toLowerCase().includes(query.trim().toLowerCase()))
    : products;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm sm-fadein">
      <div className="sm-card sm-scale-in w-full max-w-2xl max-h-[85vh] flex flex-col" style={{ background: colors.surface }}>
        <div className="p-5 flex items-center justify-between" style={{ borderBottom: `1px solid ${colors.border}` }}>
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-2 rounded-xl shrink-0" style={{ background: colors.blue + "1A" }}><Store size={16} style={{ color: colors.blue }} /></div>
            <div className="min-w-0">
              <div className="disp text-base font-semibold truncate">{outlet.outletName}</div>
              <div className="text-xs" style={{ color: colors.textMuted }}>Sales: {outlet.salesLabel}</div>
            </div>
          </div>
          <button onClick={onClose} className="sm-btn p-2 rounded-full shrink-0" style={{ background: colors.surface2 }}><X size={16} /></button>
        </div>

        <div className="p-5 pb-0 grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="sm-card p-3">
            <div className="text-xs mb-1" style={{ color: colors.textMuted }}>Total Value</div>
            <div className="mono text-sm font-bold">{fmtRp(outlet.value)}</div>
          </div>
          <div className="sm-card p-3">
            <div className="text-xs mb-1" style={{ color: colors.textMuted }}>Frekuensi</div>
            <div className="mono text-sm font-bold">{fmtNum(outlet.invoiceCount)}×</div>
          </div>
          <div className="sm-card p-3">
            <div className="text-xs mb-1" style={{ color: colors.textMuted }}>Terakhir Transaksi</div>
            <div className="mono text-sm font-bold">{outlet.lastDate || "-"}</div>
          </div>
          <div className="sm-card p-3">
            <div className="text-xs mb-1" style={{ color: colors.textMuted }}>Status</div>
            <OutletStatusBadge status={outlet.status} colors={colors} />
          </div>
        </div>

        <div className="p-5">
          {products.length > 0 && (
            <div className="relative mb-3">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: colors.textMuted }} />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Cari produk..."
                className="w-full pl-9 pr-3 py-2 rounded-xl text-sm outline-none"
                style={{ background: colors.surface2, border: `1px solid ${colors.border}`, color: colors.text }} />
            </div>
          )}
          <div className="text-xs uppercase tracking-wider mb-2" style={{ color: colors.textMuted }}>
            {filtered.length} Produk Dibeli
          </div>
        </div>
        <div className="px-5 pb-5 overflow-y-auto">
          {products.length === 0 ? (
            <div className="text-center py-10" style={{ color: colors.textMuted }}>Tidak ada data produk untuk outlet ini.</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: colors.surface2 }}>
                  <th className="px-3 py-2 text-left" style={{ fontSize: 11, color: colors.textMuted }}>PRODUK</th>
                  <th className="px-3 py-2 text-left" style={{ fontSize: 11, color: colors.textMuted }}>GRUP</th>
                  <th className="px-3 py-2 text-right" style={{ fontSize: 11, color: colors.textMuted }}>VALUE</th>
                  <th className="px-3 py-2 text-center" style={{ fontSize: 11, color: colors.textMuted }}>TRANSAKSI</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p, i) => (
                  <tr key={i} className="sm-row" style={{ borderTop: `1px solid ${colors.border}` }}>
                    <td className="px-3 py-2">{p.productName}</td>
                    <td className="px-3 py-2 text-xs" style={{ color: colors.textMuted }}>{p.group}</td>
                    <td className="px-3 py-2 mono text-right">{fmtRp(p.value)}</td>
                    <td className="px-3 py-2 mono text-center">{p.invoiceCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}


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

          {parseMeta.duplicateRowsRemoved > 0 && (
            <div className="mb-6 flex items-start gap-2.5 px-3.5 py-3 rounded-xl text-sm" style={{ background: colors.gold + "0D", border: `1px solid ${colors.gold}33`, color: colors.text }}>
              <AlertTriangle size={15} className="mt-0.5 shrink-0" style={{ color: colors.gold }} />
              <span>
                <b>{fmtNum(parseMeta.duplicateRowsRemoved)} baris duplikat</b> terdeteksi & otomatis dihapus — baris dengan Tanggal, No Faktur, Kode Produk, Qty, dan Value yang persis sama (biasanya karena file yang sama ter-upload 2×, atau rentang tanggal antar file yang digabung saling overlap).
              </span>
            </div>
          )}

          {parseMeta.sourceFiles && parseMeta.sourceFiles.length > 1 && (
            <div className="mb-6">
              <div className="text-xs uppercase tracking-wider mb-2" style={{ color: colors.textMuted }}>{parseMeta.sourceFiles.length} File Digabung</div>
              <div className="space-y-1.5">
                {parseMeta.sourceFiles.map((sf, i) => (
                  <div key={i} className="flex items-center justify-between text-sm px-3 py-2 rounded-lg" style={{ background: colors.surface2 }}>
                    <span className="truncate flex-1">{sf.name}</span>
                    <span className="mono text-xs" style={{ color: colors.textMuted }}>{fmtNum(sf.rowCount)} baris</span>
                  </div>
                ))}
              </div>
            </div>
          )}

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
// Modal riwayat & perbandingan periode — simpan snapshot periode aktif, pilih salah satu
// riwayat sebagai pembanding, atau hapus riwayat yang tidak diperlukan lagi.
// MAX_TREND_PERIODS: batas jumlah snapshot riwayat yang bisa dipilih sekaligus
// untuk tab "Tren Periode" (di luar periode aktif) — biar tabel & chart tidak
// kebanjiran kolom. HISTORY_MAX_ENTRIES (penyimpanan) sengaja lebih longgar (8).
const MAX_TREND_PERIODS = 5;

function HistoryModal({ isOpen, onClose, history, onSave, onApply, onDelete, defaultLabel, colors }) {
  const [label, setLabel] = useState("");
  const [checked, setChecked] = useState([]);
  useEffect(() => { if (isOpen) { setLabel(defaultLabel || ""); setChecked([]); } }, [isOpen, defaultLabel]);
  if (!isOpen) return null;

  const toggle = (id) => {
    setChecked((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= MAX_TREND_PERIODS) return prev; // sudah mentok batas
      return [...prev, id];
    });
  };

  const atLimit = checked.length >= MAX_TREND_PERIODS;
  const actionLabel = checked.length === 0 ? "Pilih periode dulu"
    : checked.length === 1 ? "Bandingkan dengan Periode Aktif"
    : `Lihat Tren ${checked.length} Periode`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm sm-fadein">
      <div className="sm-card sm-scale-in w-full max-w-xl max-h-[85vh] flex flex-col" style={{ background: colors.surface }}>
        <div className="p-5 flex items-center justify-between" style={{ borderBottom: `1px solid ${colors.border}` }}>
          <SectionTitle title="Riwayat & Perbandingan Periode" sub="Pilih 1 periode untuk bandingkan cepat, atau 2+ untuk lihat tren" icon={History} colors={colors} />
          <button onClick={onClose} className="sm-btn p-2 rounded-full" style={{ background: colors.surface2 }}><X size={16} /></button>
        </div>
        <div className="p-5 overflow-y-auto flex-1">
          <div className="flex gap-2 mb-5">
            <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Label periode (mis. Juli 2026 Minggu 1)"
              className="flex-1 px-3 py-2 rounded-lg text-sm" style={{ background: colors.surface2, border: `1px solid ${colors.border}`, color: colors.text }} />
            <button onClick={() => onSave(label)} className="sm-btn px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap" style={{ background: colors.gold, color: "#0A1120" }}>
              Simpan Snapshot Ini
            </button>
          </div>
          {history.length === 0 ? (
            <div className="text-center py-8 text-sm" style={{ color: colors.textMuted }}>Belum ada riwayat tersimpan. Simpan periode aktif dulu untuk mulai membandingkan.</div>
          ) : (
            <div className="space-y-2">
              {history.map((h) => {
                const isChecked = checked.includes(h.id);
                const disabled = !isChecked && atLimit;
                return (
                  <div key={h.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl" style={{ background: colors.surface2, opacity: disabled ? 0.5 : 1 }}>
                    <button
                      onClick={() => !disabled && toggle(h.id)}
                      disabled={disabled}
                      className="w-5 h-5 rounded flex items-center justify-center shrink-0"
                      style={{ background: isChecked ? colors.gold : "transparent", border: `1px solid ${isChecked ? colors.gold : colors.border}` }}
                      aria-label={`Pilih ${h.label}`}
                    >
                      {isChecked && <Check size={12} color="#0A1120" />}
                    </button>
                    <div className="flex-1 min-w-0 cursor-pointer" onClick={() => !disabled && toggle(h.id)}>
                      <div className="text-sm font-medium truncate">{h.label}</div>
                      <div className="text-xs mono" style={{ color: colors.textMuted }}>{h.dateFrom || "?"} — {h.dateTo || "?"} · {fmtRp(h.totals.realisasiValue)}</div>
                    </div>
                    <button onClick={() => onDelete(h.id)} className="sm-btn p-1.5 rounded-lg" style={{ background: colors.coral + "14", color: colors.coral }}><X size={13} /></button>
                  </div>
                );
              })}
            </div>
          )}
          {atLimit && (
            <div className="text-xs mt-3 text-center" style={{ color: colors.textMuted }}>Maksimal {MAX_TREND_PERIODS} periode sekaligus.</div>
          )}
        </div>
        <div className="p-5" style={{ borderTop: `1px solid ${colors.border}` }}>
          <button
            onClick={() => checked.length > 0 && onApply(checked)}
            disabled={checked.length === 0}
            className="sm-btn w-full px-4 py-2.5 rounded-xl text-sm font-semibold"
            style={{ background: checked.length ? colors.gold : colors.surface2, color: checked.length ? "#0A1120" : colors.textMuted }}
          >
            {actionLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ============================================================================
   PAGES
============================================================================ */
function MainReportPage({ agg, workDays, colors, onDrilldown, comparison, onClearComparison }) {
  const uniqueDaysInData = useMemo(() => new Set(agg.filteredRows.map(r => dateKey(r.date))).size, [agg.filteredRows]);
  const t = agg.totals;
  // Calculate time gone based on unique work days found in the data vs total work days in the month.
  const timeGone = workDays ? Math.min(1, uniqueDaysInData / workDays) : 0;
  return (
    <div className="sm-fadein">
      <PaceStrip timeGonePct={timeGone} achPct={t.ach} colors={colors} />
      <AlertsPanel alerts={agg.alerts} colors={colors} onDrilldown={onDrilldown} />
      <PeriodComparisonCard comparison={comparison} colors={colors} onClear={onClearComparison} />
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

function SalesReportPage({ agg, colors, onDrilldown, workDays, depotName }) {
  const rows = agg.bySales;
  const handleExportScorecard = (salesRow) => exportSalesScorecardPDF(salesRow, agg, { workDays, depotName });
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
      <Leaderboard rows={rows} colors={colors} onDrilldown={onDrilldown} onExportScorecard={handleExportScorecard} />

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

/* ============================================================================
   TAB: ANALISIS OUTLET
============================================================================ */

const OUTLET_STATUS_META = {
  active: { label: "Aktif", color: "mint" },
  at_risk: { label: "Berisiko", color: "gold" },
  dormant: { label: "Dormant", color: "coral" },
  unknown: { label: "-", color: "textMuted" },
};

function OutletStatusBadge({ status, colors }) {
  const meta = OUTLET_STATUS_META[status] || OUTLET_STATUS_META.unknown;
  const color = colors[meta.color];
  return (
    <span className="text-xs font-semibold inline-flex items-center px-2 py-0.5 rounded-full"
      style={{ color, background: color + "1A", border: `1px solid ${color}44` }}>
      {meta.label}
    </span>
  );
}

function OutletAnalysisPage({ agg, colors, thresholds, setThresholds, onSelectOutlet }) {
  const { list, summary } = useMemo(
    () => computeOutletAnalysis(agg.filteredRows, agg.meta, thresholds),
    [agg.filteredRows, agg.meta, thresholds]
  );

  const chartData = [
    { name: "Aktif", value: summary.active, fill: colors.mint },
    { name: "Berisiko", value: summary.atRisk, fill: colors.gold },
    { name: "Dormant", value: summary.dormant, fill: colors.coral },
  ];

  return (
    <div className="sm-fadein">
      <SectionTitle title="Analisis Outlet" sub="Segmentasi outlet berdasarkan aktivitas beli — mengikuti filter yang aktif" icon={Store} colors={colors} />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <KpiCard label="Total Outlet" value={summary.total} icon={Store} accent={colors.blue} colors={colors} />
        <KpiCard label="Outlet Aktif" value={summary.active} icon={CheckCircle2} accent={colors.mint} colors={colors} />
        <KpiCard label="Outlet Berisiko" value={summary.atRisk} icon={AlertTriangle} accent={colors.gold} colors={colors} />
        <KpiCard label="Outlet Dormant" value={summary.dormant} icon={XCircle} accent={colors.coral} colors={colors} />
      </div>

      <div className="sm-card p-4 mb-6 flex flex-wrap items-center gap-4">
        <div className="text-sm font-medium flex items-center gap-2" style={{ color: colors.textMuted }}>
          <Settings size={14} /> Ambang Status:
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span>Aktif ≤</span>
          <input type="number" min={0} value={thresholds.activeMaxDays}
            onChange={(e) => setThresholds((prev) => ({ ...prev, activeMaxDays: Math.max(0, Number(e.target.value) || 0) }))}
            className="w-16 px-2 py-1 rounded-md mono text-sm text-center" style={{ background: colors.surface2, border: `1px solid ${colors.border}` }} />
          <span>hari</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span>Dormant &gt;</span>
          <input type="number" min={0} value={thresholds.dormantMinDays}
            onChange={(e) => setThresholds((prev) => ({ ...prev, dormantMinDays: Math.max(prev.activeMaxDays, Number(e.target.value) || 0) }))}
            className="w-16 px-2 py-1 rounded-md mono text-sm text-center" style={{ background: colors.surface2, border: `1px solid ${colors.border}` }} />
          <span>hari</span>
        </div>
        <div className="text-xs" style={{ color: colors.textMuted }}>
          (di antara keduanya = <b>Berisiko</b>)
        </div>
      </div>

      {list.length === 0 ? (
        <div className="sm-card p-16 text-center">
          <p className="text-sm" style={{ color: colors.textMuted }}>Tidak ada data outlet untuk kombinasi filter ini.</p>
        </div>
      ) : (
        <>
          <div className="sm-card p-5 mb-6">
            <div className="text-xs uppercase tracking-wider mb-3" style={{ color: colors.textMuted }}>Distribusi Status Outlet</div>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={chartData} layout="vertical" margin={{ left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={colors.border} horizontal={false} />
                <XAxis type="number" allowDecimals={false} tick={{ fill: colors.textMuted, fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" width={70} tick={{ fill: colors.text, fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={createChartTooltipStyle(colors)} formatter={(v) => `${v} outlet`} />
                <Bar dataKey="value" radius={[0, 6, 6, 0]}>
                  {chartData.map((d, i) => <Cell key={i} fill={d.fill} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <DataTable
            colors={colors}
            initialSortKey="value"
            searchable
            searchKeys={["outletName", "salesLabel"]}
            searchPlaceholder="Cari nama outlet atau sales..."
            columns={[
              { key: "outletName", label: "Nama Outlet", render: (o) => (
                <button onClick={() => onSelectOutlet(o)} className="text-left hover:underline" style={{ color: colors.text }}>{o.outletName}</button>
              ) },
              { key: "salesLabel", label: "Sales", render: (o) => (
                <span className="inline-flex items-center gap-1.5 min-w-0 max-w-full sm:max-w-[220px]" title={o.salesLabel}>
                  <span className="truncate">{o.salesLabel}</span>
                  {o.salesNames.length > 1 && (
                    <span className="shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded-full" style={{ background: colors.gold + "1A", color: colors.gold }}>
                      {o.salesNames.length}
                    </span>
                  )}
                </span>
              ) },
              { key: "value", label: "Total Value", render: (o) => <span className="mono">{fmtRp(o.value)}</span> },
              { key: "invoiceCount", label: "Frekuensi", render: (o) => <span className="mono">{fmtNum(o.invoiceCount)}×</span> },
              { key: "groupCount", label: "Grup Produk", render: (o) => <span className="mono">{o.groupCount}</span> },
              { key: "lastDate", label: "Terakhir Transaksi", render: (o) => <span className="mono text-xs" style={{ color: colors.textMuted }}>{o.lastDate || "-"}</span> },
              { key: "daysSinceLastPurchase", label: "Jeda", render: (o) => <span className="mono">{o.daysSinceLastPurchase ?? "-"}</span> },
              { key: "status", label: "Status", render: (o) => <OutletStatusBadge status={o.status} colors={colors} /> },
            ]}
            rows={list}
          />
        </>
      )}
    </div>
  );
}

function DataQualityPage({ notes, colors, onDrilldown }) {
  const hasIssues = notes.missingFields.length || notes.unknownSales.length || notes.unconvertibleProducts.length ||
    notes.unknownGroups.length || notes.skippedBlankRows > 0 || notes.rowsWithMissingDate > 0 || notes.duplicateRowsRemoved > 0;

  return (
    <div className="sm-fadein">
      <SectionTitle title="Catatan Data" sub="Ringkasan kualitas data dari seluruh file yang diupload (tidak terpengaruh filter)" icon={ClipboardList} colors={colors} />

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
        <KpiCard label="Total Baris Terbaca" value={notes.totalDataRows} icon={FileSpreadsheet} accent={colors.blue} colors={colors} />
        <KpiCard label="Baris Dilewati (Kosong)" value={notes.skippedBlankRows} icon={XCircle} accent={colors.textMuted} colors={colors} />
        <KpiCard label="Duplikat Dihapus" value={notes.duplicateRowsRemoved} icon={Copy} accent={notes.duplicateRowsRemoved > 0 ? colors.gold : colors.textMuted} colors={colors} />
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
  const [expandedFocusCodes, setExpandedFocusCodes] = useState(() => new Set());
  const [copySourceCode, setCopySourceCode] = useState({});

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

  const toggleFocusExpand = (code) => {
    setExpandedFocusCodes(prev => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code); else next.add(code);
      return next;
    });
  };

  const handleFocusChange = (salesCode, focusIdx, field, value) => {
    setLocalTargets(prev => prev.map(t => {
      if (t.code !== salesCode) return t;
      const focus = t.focus.map((f, i) => i === focusIdx ? { ...f, [field]: field === "target" ? (Number(value) || 0) : value } : f);
      return { ...t, focus };
    }));
  };

  const handleFocusAdd = (salesCode) => {
    setLocalTargets(prev => prev.map(t => t.code === salesCode
      ? { ...t, focus: [...t.focus, { name: "", target: 0, keyword: "", unit: "KARTON", matchType: "contains" }] }
      : t));
    setExpandedFocusCodes(prev => new Set(prev).add(salesCode));
  };

  const handleFocusRemove = (salesCode, focusIdx) => {
    setLocalTargets(prev => prev.map(t => t.code === salesCode
      ? { ...t, focus: t.focus.filter((_, i) => i !== focusIdx) }
      : t));
  };

  const handleFocusCopyFrom = (salesCode) => {
    const sourceCode = copySourceCode[salesCode];
    const source = localTargets.find(t => t.code === sourceCode);
    if (!source || !source.focus.length) return;
    if (!window.confirm(`Salin ${source.focus.length} produk fokus dari ${source.name}? Daftar fokus yang sudah ada di sales ini akan diganti.`)) return;
    setLocalTargets(prev => prev.map(t => t.code === salesCode
      ? { ...t, focus: source.focus.map(f => ({ ...f })) }
      : t));
    setExpandedFocusCodes(prev => new Set(prev).add(salesCode));
  };

  const handleSave = () => {
    setTargets(localTargets);
    setWorkDays(localWorkDays);
    setDepotName(localDepotName);
    onClose();
  };

  const MATCH_TYPE_OPTIONS = [
    { value: "contains", label: "Mengandung kata kunci" },
    { value: "group", label: "Sama persis Grup Produk" },
    { value: "exact", label: "Sama persis nama produk" },
  ];

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
            {localTargets.map(t => {
              const isExpanded = expandedFocusCodes.has(t.code);
              const otherSales = localTargets.filter(o => o.code !== t.code && o.focus.length > 0);
              return (
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

                <div className="mt-3 pt-3" style={{ borderTop: `1px solid ${colors.border}` }}>
                  <button onClick={() => toggleFocusExpand(t.code)} className="sm-btn w-full flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2 text-sm font-medium">
                      <Crosshair size={14} style={{ color: colors.violet }} />
                      Produk Fokus <span style={{ color: colors.textMuted }}>({t.focus.length})</span>
                    </span>
                    <ChevronDown size={14} style={{ color: colors.textMuted, transform: isExpanded ? "rotate(180deg)" : "none", transition: "transform .2s" }} />
                  </button>

                  {isExpanded && (
                    <div className="mt-3 space-y-2">
                      {otherSales.length > 0 && (
                        <div className="flex items-center gap-2 mb-3">
                          <select value={copySourceCode[t.code] || ""} onChange={e => setCopySourceCode(prev => ({ ...prev, [t.code]: e.target.value }))}
                            className="flex-1 px-2.5 py-1.5 rounded-md text-xs" style={{ background: colors.ink, border: `1px solid ${colors.border}`, color: colors.text }}>
                            <option value="">Salin dari sales lain...</option>
                            {otherSales.map(o => <option key={o.code} value={o.code}>{o.name} ({o.focus.length} produk)</option>)}
                          </select>
                          <button onClick={() => handleFocusCopyFrom(t.code)} disabled={!copySourceCode[t.code]}
                            className="sm-btn px-3 py-1.5 rounded-md text-xs font-semibold disabled:opacity-40"
                            style={{ background: colors.surface, border: `1px solid ${colors.border}` }}>
                            Salin
                          </button>
                        </div>
                      )}

                      {t.focus.length === 0 && (
                        <p className="text-xs text-center py-3" style={{ color: colors.textMuted }}>Belum ada produk fokus untuk sales ini.</p>
                      )}

                      {t.focus.map((f, i) => {
                        const matchType = f.matchType || (f.keyword === "__GROUP__" ? "group" : f.keyword === "GAS_EXACT" ? "exact" : "contains");
                        return (
                          <div key={i} className="p-2.5 rounded-lg relative" style={{ background: colors.ink, border: `1px solid ${colors.border}` }}>
                            <button onClick={() => handleFocusRemove(t.code, i)} title="Hapus produk fokus ini"
                              className="sm-btn absolute top-2 right-2 p-1 rounded-md" style={{ color: colors.coral }}>
                              <X size={12} />
                            </button>
                            <div className="grid grid-cols-2 gap-2 mb-2 pr-6">
                              <div>
                                <label className="block text-[10px] mb-0.5" style={{ color: colors.textMuted }}>Nama Produk</label>
                                <input value={f.name} onChange={e => handleFocusChange(t.code, i, 'name', e.target.value)}
                                  placeholder="mis. FISH CAKE"
                                  className="w-full px-2 py-1.5 rounded text-xs" style={{ background: colors.surface2, border: `1px solid ${colors.border}`, color: colors.text }} />
                              </div>
                              <div>
                                <label className="block text-[10px] mb-0.5" style={{ color: colors.textMuted }}>Tipe Pencocokan</label>
                                <select value={matchType} onChange={e => handleFocusChange(t.code, i, 'matchType', e.target.value)}
                                  className="w-full px-2 py-1.5 rounded text-xs" style={{ background: colors.surface2, border: `1px solid ${colors.border}`, color: colors.text }}>
                                  {MATCH_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                                </select>
                              </div>
                            </div>

                            {matchType === "group" ? (
                              <p className="text-[10px] mb-2" style={{ color: colors.textMuted }}>
                                Akan dicocokkan ke baris dengan Grup Produk = <b>{f.name || "(isi Nama Produk di atas)"}</b>
                              </p>
                            ) : (
                              <div className="mb-2">
                                <label className="block text-[10px] mb-0.5" style={{ color: colors.textMuted }}>
                                  Kata Kunci {matchType === "exact" ? "(harus sama persis dengan nama produk)" : "(dicari di dalam nama produk)"}
                                </label>
                                <input value={f.keyword} onChange={e => handleFocusChange(t.code, i, 'keyword', e.target.value)}
                                  placeholder="mis. FISH"
                                  className="w-full px-2 py-1.5 rounded text-xs mono" style={{ background: colors.surface2, border: `1px solid ${colors.border}`, color: colors.text }} />
                                {!f.keyword && (
                                  <p className="text-[10px] mt-0.5" style={{ color: colors.coral }}>Wajib diisi — kalau kosong, akan cocok ke SEMUA produk.</p>
                                )}
                              </div>
                            )}

                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="block text-[10px] mb-0.5" style={{ color: colors.textMuted }}>Target</label>
                                <input type="number" value={f.target} onChange={e => handleFocusChange(t.code, i, 'target', e.target.value)}
                                  className="w-full px-2 py-1.5 rounded text-xs mono" style={{ background: colors.surface2, border: `1px solid ${colors.border}`, color: colors.text }} />
                              </div>
                              <div>
                                <label className="block text-[10px] mb-0.5" style={{ color: colors.textMuted }}>Satuan</label>
                                <input value={f.unit} onChange={e => handleFocusChange(t.code, i, 'unit', e.target.value)}
                                  placeholder="KARTON"
                                  className="w-full px-2 py-1.5 rounded text-xs" style={{ background: colors.surface2, border: `1px solid ${colors.border}`, color: colors.text }} />
                              </div>
                            </div>
                          </div>
                        );
                      })}

                      <button onClick={() => handleFocusAdd(t.code)}
                        className="sm-btn w-full flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-semibold"
                        style={{ background: colors.violet + "14", color: colors.violet, border: `1px dashed ${colors.violet}66` }}>
                        <Plus size={13} /> Tambah Produk Fokus
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );})}
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
  const [history, setHistory] = useState(() => loadHistory());
  const [comparisonSnapshot, setComparisonSnapshot] = useState(null);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  // ID snapshot riwayat yang dipilih untuk tab "Tren Periode" (2+ periode
  // sekaligus) — beda dari comparisonSnapshot di atas yang cuma 1-vs-1 untuk
  // card "Bandingkan Periode" di Main Report. Sengaja tidak dipersist ke
  // localStorage: dipilih ulang tiap sesi, konsisten dengan sifatnya yang
  // sementara/eksploratif.
  const [trendSnapshotIds, setTrendSnapshotIds] = useState([]);
  const [desktopMoreOpen, setDesktopMoreOpen] = useState(false);

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

  /* --------------------------- PWA: instal & update --------------------------- */

  // registerType: 'prompt' di vite.config.js — jadi kalau ada versi baru ter-deploy,
  // tidak langsung auto-reload (bisa bikin filter/upload yang lagi dikerjakan hilang),
  // tapi tampilkan notifikasi dan biarkan user pilih kapan mau refresh.
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW({});

  const [installPromptEvent, setInstallPromptEvent] = useState(null);
  const [showIosInstallHint, setShowIosInstallHint] = useState(false);

  const isIOS = useMemo(() => /iphone|ipad|ipod/i.test(window.navigator.userAgent), []);
  const isStandalone = useMemo(() =>
    window.matchMedia?.("(display-mode: standalone)").matches || window.navigator.standalone === true
  , []);

  useEffect(() => {
    // Chrome/Android/Edge menembak event ini kalau app memenuhi syarat installability
    // (manifest valid, service worker terdaftar, dsb). Kita cegah prompt otomatis
    // browser (preventDefault), simpan eventnya, lalu munculkan tombol custom sendiri.
    const handler = (e) => { e.preventDefault(); setInstallPromptEvent(e); };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstallClick = useCallback(async () => {
    if (installPromptEvent) {
      installPromptEvent.prompt();
      await installPromptEvent.userChoice;
      setInstallPromptEvent(null);
    } else if (isIOS) {
      // iOS Safari tidak punya beforeinstallprompt — harus manual lewat menu Share.
      setShowIosInstallHint(true);
    }
  }, [installPromptEvent, isIOS]);

  const canShowInstallButton = !isStandalone && (!!installPromptEvent || isIOS);

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

  const [outletThresholds, setOutletThresholds] = useState({ activeMaxDays: 14, dormantMinDays: 30 });
  const [outletDetail, setOutletDetail] = useState(null);
  const openOutletDetail = (outlet) => setOutletDetail(outlet);
  const outletDetailProducts = useMemo(
    () => outletDetail ? getProductBreakdownForOutlet(aggFinal.filteredRows, outletDetail.outletCode) : [],
    [outletDetail, aggFinal.filteredRows]
  );

  const comparison = useMemo(() => computeComparison(aggFinal, comparisonSnapshot), [aggFinal, comparisonSnapshot]);

  const trendSnapshots = useMemo(
    () => history.filter((h) => trendSnapshotIds.includes(h.id)),
    [history, trendSnapshotIds]
  );
  const trendComparisonData = useMemo(
    () => trendSnapshots.length > 0 ? computeMultiPeriodComparison(aggFinal, trendSnapshots, filters, fileName) : null,
    [aggFinal, trendSnapshots, filters, fileName]
  );

  // Dipanggil dari HistoryModal setelah user pilih 1 atau lebih snapshot.
  // 1 dipilih → isi comparisonSnapshot (perbandingan cepat di Main Report).
  // 2+ dipilih → isi trendSnapshotIds & pindah ke tab "Tren Periode".
  const applyHistorySelection = useCallback((ids) => {
    if (ids.length === 1) {
      const h = history.find((x) => x.id === ids[0]);
      setComparisonSnapshot(h || null);
      setTrendSnapshotIds([]);
    } else {
      setTrendSnapshotIds(ids);
      setComparisonSnapshot(null);
      setActiveTab("trend");
    }
    setIsHistoryOpen(false);
  }, [history]);

  const saveHistorySnapshot = (label) => {
    const snap = buildHistorySnapshot(aggFinal, filters, fileName, label);
    setHistory((prev) => {
      const next = [snap, ...prev].slice(0, 8);
      saveHistory(next);
      return next;
    });
    setIsHistoryOpen(false);
  };
  const deleteHistorySnapshot = (id) => {
    setHistory((prev) => {
      const next = prev.filter((h) => h.id !== id);
      saveHistory(next);
      return next;
    });
    setComparisonSnapshot((cur) => (cur && cur.id === id ? null : cur));
    setTrendSnapshotIds((cur) => cur.filter((x) => x !== id));
  };

  const handleFile = useCallback(async (files) => {
    const fileList = Array.isArray(files) ? files : [files];
    setLoading(true); setError("");
    try {
      const results = await Promise.all(fileList.map((f) => parseWorkbookFile(f)));
      const combinedRowsRaw = results.flatMap((r) => r.rows);
      if (!combinedRowsRaw.length) {
        setError("File terbaca tapi tidak ada baris data yang cocok. Pastikan kolom sesuai format sell-out.");
        setLoading(false);
        return;
      }
      const { rows: combinedRows, duplicateCount } = dedupeRows(combinedRowsRaw);
      const detectedSet = new Set();
      results.forEach((r) => r.parseMeta.detectedFields.forEach((f) => detectedSet.add(f)));
      // Kolom dianggap benar-benar "tidak terdeteksi" hanya kalau tidak ada di SEMUA file
      // yang digabung — kalau cuma sebagian file yang tidak punya kolom itu, tetap dianggap ada.
      const missingInAll = Object.keys(ALIASES).filter((f) => results.every((r) => r.parseMeta.missingFields.includes(f)));
      const combinedMeta = {
        totalDataRows: sumBy(results, (r) => r.parseMeta.totalDataRows),
        skippedBlankRows: sumBy(results, (r) => r.parseMeta.skippedBlankRows),
        rowsWithMissingDate: sumBy(results, (r) => r.parseMeta.rowsWithMissingDate),
        detectedFields: Array.from(detectedSet),
        missingFields: missingInAll,
        duplicateRowsRemoved: duplicateCount,
        sourceFiles: results.map((r, i) => ({ name: fileList[i].name, rowCount: r.rows.length })),
      };
      const combinedName = fileList.length > 1
        ? `${fileList.length} file digabung (${fileList.map((f) => f.name).join(", ")})`
        : fileList[0].name;
      // Data belum langsung dipakai — tampilkan preview dulu, biar kesalahan format
      // (kolom tidak terbaca, tanggal kosong, dsb) ketahuan sebelum masuk ke dashboard.
      setPendingPreview({ rows: combinedRows, parseMeta: combinedMeta, fileName: combinedName });
    } catch (e) {
      setError("Gagal membaca salah satu file. Pastikan semua format .xlsx/.xls valid.");
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
    clearHistory();
    setRawRows([]); setFileName(""); setParseMeta(null);
    setFilters({ salesCodes: [], groups: [], dateFrom: "", dateTo: "" });
    setWorkDays(WORK_DAYS_DEFAULT);
    setTargets(DEFAULT_TARGETS);
    setDepotName("DEPO LOTIM");
    setTheme('dark');
    setHistory([]);
    setComparisonSnapshot(null);
    setTrendSnapshotIds([]);
  }, []);

  // Slot terakhir di tab bar desktop adalah tombol "Lainnya" (dropdown) — jadi
  // total slot = jumlah tab primary + 1. Kalau tab aktif sedang berada di grup
  // "more", indikator geser ke slot "Lainnya" itu, bukan hilang begitu saja.
  const activeIsInMore = MORE_TABS.some((t) => t.key === activeTab);
  const activeIdx = activeIsInMore ? PRIMARY_TABS.length : PRIMARY_TABS.findIndex((t) => t.key === activeTab);
  const totalSlots = PRIMARY_TABS.length + (MORE_TABS.length > 0 ? 1 : 0);
  const tabPct = 100 / totalSlots;

  return (
    <div className="smapp min-h-screen transition-colors duration-300" style={{ background: theme === 'dark' ? `radial-gradient(1200px 600px at 10% -10%, #16233F 0%, ${colors.ink} 60%)` : colors.ink }}>
      <style>{globalStyle}</style>
      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} targets={targets} setTargets={setTargets} workDays={workDays} setWorkDays={setWorkDays} depotName={depotName} setDepotName={setDepotName} onClearAll={handleClearAll} colors={colors} />
      <OutletDrilldownModal isOpen={!!drilldown} onClose={() => setDrilldown(null)} title={drilldown?.title} subtitle={drilldown?.subtitle} outlets={drilldown?.outlets || []} colors={colors} />
      <OutletDetailModal isOpen={!!outletDetail} onClose={() => setOutletDetail(null)} outlet={outletDetail} products={outletDetailProducts} colors={colors} />
      <DataPreviewModal isOpen={!!pendingPreview} onCancel={cancelPreview} onConfirm={confirmPreview} preview={pendingPreview} colors={colors} />
      <HistoryModal isOpen={isHistoryOpen} onClose={() => setIsHistoryOpen(false)} history={history} onSave={saveHistorySnapshot} onApply={applyHistorySelection}
        onDelete={deleteHistorySnapshot}
        defaultLabel={filters.dateFrom && filters.dateTo ? `${filters.dateFrom} — ${filters.dateTo}` : ""} colors={colors} />
      <MobileFab onFile={handleFile} colors={colors} loading={loading} />
      <MobileBottomNav primaryTabs={PRIMARY_TABS} moreTabs={MORE_TABS} activeTab={activeTab} onChange={setActiveTab} colors={colors} />
      <div className="max-w-7xl mx-auto px-4 md:px-8 py-6 pb-28 md:pb-6">
        {/* header */}
        <div className="relative z-40 flex flex-wrap items-center justify-between gap-4 mb-6 sm-fadeup">
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
            {canShowInstallButton && (
              <button onClick={handleInstallClick}
                className="sm-btn flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold"
                style={{ background: colors.surface2, color: colors.text, border: `1px solid ${colors.border}` }}>
                <Smartphone size={15} /> <span className="hidden sm:inline">Instal Aplikasi</span>
              </button>
            )}
            <button onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}
              className="sm-btn flex items-center gap-2 px-2.5 py-2.5 rounded-xl text-sm font-semibold"
              style={{ background: colors.surface2, color: colors.text, border: `1px solid ${colors.border}` }}>
              {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
            </button>
            <button onClick={() => setIsHistoryOpen(true)} disabled={!rawRows.length}
              className="sm-btn flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-40"
              style={{ background: colors.surface2, color: colors.text, border: `1px solid ${colors.border}` }}>
              <History size={15} /> <span className="hidden sm:inline">Riwayat</span>
            </button>
            <button onClick={() => setIsSettingsOpen(true)}
              className="sm-btn flex items-center gap-2 px-2.5 md:px-4 py-2.5 rounded-xl text-sm font-semibold"
              style={{ background: colors.surface2, color: colors.text, border: `1px solid ${colors.border}` }}>
              <Settings size={15} /> <span className="hidden md:inline">Pengaturan</span>
            </button>
            <ExportMenu agg={aggFinal} targets={targets} workDays={workDays} depotName={depotName} disabled={!rawRows.length} colors={colors} />
          </div>
        </div>

        {/* PWA: notifikasi pertama kali app siap dipakai offline */}
        {offlineReady && !needRefresh && (
          <div className="mb-6 sm-fadeup flex items-center justify-between gap-3 px-4 py-3 rounded-xl" style={{ background: colors.mint + "14", border: `1px solid ${colors.mint}44` }}>
            <div className="flex items-center gap-2.5 text-sm">
              <CheckCircle2 size={15} style={{ color: colors.mint }} />
              <span>Aplikasi siap dipakai walau tanpa internet.</span>
            </div>
            <button onClick={() => setOfflineReady(false)}
              className="sm-btn p-1.5 rounded-lg" style={{ color: colors.textMuted }}>
              <X size={14} />
            </button>
          </div>
        )}

        {/* PWA: notifikasi update tersedia */}
        {needRefresh && (
          <div className="mb-6 sm-fadeup flex items-center justify-between gap-3 px-4 py-3 rounded-xl" style={{ background: colors.gold + "14", border: `1px solid ${colors.gold}44` }}>
            <div className="flex items-center gap-2.5 text-sm">
              <RefreshCw size={15} style={{ color: colors.gold }} />
              <span>Versi baru aplikasi tersedia.</span>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => updateServiceWorker(true)}
                className="sm-btn px-3 py-1.5 rounded-lg text-xs font-semibold" style={{ background: colors.gold, color: "#0A1120" }}>
                Perbarui Sekarang
              </button>
              <button onClick={() => setNeedRefresh(false)}
                className="sm-btn px-3 py-1.5 rounded-lg text-xs font-semibold" style={{ border: `1px solid ${colors.border}` }}>
                Nanti
              </button>
            </div>
          </div>
        )}

        {/* PWA: instruksi manual instal untuk iOS Safari (tidak ada beforeinstallprompt) */}
        {showIosInstallHint && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm sm-fadein" onClick={() => setShowIosInstallHint(false)}>
            <div className="sm-card sm-scale-in w-full max-w-sm p-5" style={{ background: colors.surface }} onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl" style={{ background: colors.gold + "1A" }}><Smartphone size={16} style={{ color: colors.gold }} /></div>
                  <div className="disp text-base font-semibold">Instal di iPhone/iPad</div>
                </div>
                <button onClick={() => setShowIosInstallHint(false)} className="sm-btn p-2 rounded-full" style={{ background: colors.surface2 }}><X size={16} /></button>
              </div>
              <ol className="text-sm space-y-2.5" style={{ color: colors.text }}>
                <li className="flex items-start gap-2.5">
                  <span className="mono font-semibold shrink-0" style={{ color: colors.gold }}>1.</span>
                  <span className="flex items-center gap-1.5 flex-wrap">Tap ikon <Share size={14} style={{ color: colors.gold }} /> <b>Share</b> di bar bawah Safari</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="mono font-semibold shrink-0" style={{ color: colors.gold }}>2.</span>
                  <span>Pilih <b>"Add to Home Screen"</b></span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="mono font-semibold shrink-0" style={{ color: colors.gold }}>3.</span>
                  <span>Tap <b>"Add"</b> di pojok kanan atas</span>
                </li>
              </ol>
            </div>
          </div>
        )}

        {/* upload */}
        <div className="mb-6 sm-fadeup" style={{ animationDelay: "40ms" }}>
          <UploadDropzone onFile={handleFile} hasData={!!rawRows.length} fileName={fileName} onReset={handleReset} onSample={handleSample} loading={loading} sampleLoading={sampleLoading} colors={colors} />
          {error && (
            <div className="mt-3 flex items-center gap-2 text-sm px-4 py-2.5 rounded-xl" style={{ background: colors.coral + "14", color: colors.coral, border: `1px solid ${colors.coral}33` }}>
              <AlertTriangle size={14} /> {error}
            </div>
          )}
        </div>

        {/* tabs — desktop only (mobile pakai bottom nav). Tab primary tampil
            langsung, sisanya dikelompokkan di dropdown "Lainnya" supaya bar
            tidak makin sesak tiap kali nambah fitur/tab baru. */}
        <div className="relative hidden md:flex gap-1 mb-6 p-1 rounded-2xl sm-fadeup" style={{ background: colors.surface, border: `1px solid ${colors.border}`, animationDelay: "80ms" }}>
          <div className="absolute top-1 bottom-1 rounded-xl transition-all duration-300 ease-out"
            style={{ left: `calc(${activeIdx * tabPct}% + 4px)`, width: `calc(${tabPct}% - 8px)`, background: colors.surface2, border: `1px solid ${colors.border}` }} />
          {PRIMARY_TABS.map((t) => {
            const Icon = t.icon;
            const isActive = t.key === activeTab;
            return (
              <button key={t.key} onClick={() => setActiveTab(t.key)}
                className="sm-tab-btn relative z-10 flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium"
                style={{ color: isActive ? colors.gold : colors.textMuted }}>
                <Icon size={15} /> <span>{t.label}</span>
              </button>
            );
          })}
          {MORE_TABS.length > 0 && (
            <div className="relative flex-1">
              <button onClick={() => setDesktopMoreOpen((v) => !v)}
                className="sm-tab-btn relative z-10 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium"
                style={{ color: activeIsInMore ? colors.gold : colors.textMuted }}>
                <Menu size={15} /> <span>Lainnya</span>
                <ChevronDown size={13} style={{ transform: desktopMoreOpen ? "rotate(180deg)" : "none", transition: "transform .2s" }} />
              </button>
              {desktopMoreOpen && (
                <>
                  <div className="fixed inset-0 z-20" onClick={() => setDesktopMoreOpen(false)} />
                  <div className="sm-fadein absolute right-0 z-30 mt-2 w-56 rounded-xl p-1.5 shadow-2xl" style={{ background: colors.surface, border: `1px solid ${colors.border}` }}>
                    {MORE_TABS.map((t) => {
                      const Icon = t.icon;
                      const isActive = t.key === activeTab;
                      return (
                        <button key={t.key} onClick={() => { setActiveTab(t.key); setDesktopMoreOpen(false); }}
                          className="sm-row w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium text-left"
                          style={{ color: isActive ? colors.gold : colors.text, background: isActive ? colors.gold + "14" : "transparent" }}>
                          <Icon size={15} /> <span>{t.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {sessionLoading ? (
          <DashboardSkeleton colors={colors} />
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
            <FilterBar salesOptions={salesOptions} groupOptions={groupOptions} filters={filters} setFilters={setFilters} colors={colors} theme={theme} />
            {activeTab === "main" && <MainReportPage agg={aggFinal} workDays={workDays} colors={colors} onDrilldown={openDrilldown} comparison={comparison} onClearComparison={() => setComparisonSnapshot(null)} />}
            {activeTab === "sales" && <SalesReportPage agg={aggFinal} colors={colors} onDrilldown={openDrilldown} workDays={workDays} depotName={depotName} />}
            {activeTab === "product" && <ProductReportPage agg={aggFinal} colors={colors} onDrilldown={openDrilldown} />}
            {activeTab === "focus" && <ProductFocusReportPage agg={aggFinal} colors={colors} onDrilldown={openDrilldown} />}
            {activeTab === "outlet" && <OutletAnalysisPage agg={aggFinal} colors={colors} thresholds={outletThresholds} setThresholds={setOutletThresholds} onSelectOutlet={openOutletDetail} />}
            {activeTab === "quality" && <DataQualityPage notes={dataQualityNotes} colors={colors} onDrilldown={openDrilldown} />}
            {activeTab === "trend" && <TrendPeriodePage comparisonData={trendComparisonData} colors={colors} onOpenPeriodPicker={() => setIsHistoryOpen(true)} selectedCount={trendSnapshotIds.length} />}
          </>
        )}

        <div className="text-center text-xs mt-10 pb-4" style={{ color: colors.textMuted }}>
          Data diproses langsung di browser Anda — tidak diunggah ke server manapun. Data & pengaturan disimpan otomatis di perangkat/browser ini agar tidak hilang saat refresh.
        </div>
      </div>
    </div>
  );
}
