import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import {
  Bot, Sparkles, X, Send, Settings, Trash2, CheckCircle2,
  AlertTriangle, RefreshCw, Eye, EyeOff, ArrowRight,
  Share2, Copy, FileText, Image as ImageIcon, Check,
} from "lucide-react";
import { loadAiSettings, saveAiSettings } from "../../utils/aiSettings.js";
import { callDirect, callProxy, callTauri, dispatch, isTauriRuntime } from "../../utils/aiDispatcher.js";
import { executeAiTool, isWriteTool } from "../../utils/aiTools.js";
import {
  copyToClipboard,
  formatMessageAsMarkdown,
  formatChatAsMarkdown,
  exportChatToPdf,
  exportElementToPng,
} from "../../utils/aiExport.js";
import { useScrollLock, useEscapeKey, useFocusTrap } from "../../hooks/useModalA11y.js";

const CHAT_LOG_KEY = "smapp:ai_chat_log:v1";
const MAX_LOG_ENTRIES = 50;

function loadChatLog() {
  try {
    const raw = window.localStorage.getItem(CHAT_LOG_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveChatLog(log) {
  try {
    const trimmed = (log || []).slice(-MAX_LOG_ENTRIES);
    window.localStorage.setItem(CHAT_LOG_KEY, JSON.stringify(trimmed));
  } catch {
    // Ignore storage quota error
  }
}

const QUICK_PROMPTS = [
  "🎯 Simulasi proyeksi target akhir bulan",
  "📦 Cek barang yang stoknya habis atau kritis",
  "📊 Analisis performa & ACH tim sales saat ini",
  "📍 Cari outlet yang tidak aktif minggu ini",
  "🔄 Reset semua filter dashboard",
];



// Timeline thinking: langkah terlihat (✓ selesai, ◌ aktif, ✕ gagal).
function ThinkingSteps({ steps = [], colors = {} }) {
  if (!steps.length) return null;
  return (
    <div className="mt-2 pt-2 space-y-1 border-t" style={{ borderColor: colors.glassBorder }}>
      {steps.map((s, i) => (
        <div key={i} className="flex items-center gap-1.5 text-[10px] font-mono" style={{
          color: s.state === "error" ? colors.coral : s.state === "active" ? colors.gold : colors.textMuted,
        }}>
          <span className="shrink-0">{s.state === "error" ? "✕" : s.state === "active" ? "◌" : "✓"}</span>
          <span className="truncate">{s.label}</span>
        </div>
      ))}
    </div>
  );
}

function fmtRpShort(n) {
  const v = Number(n) || 0;
  if (Math.abs(v) >= 1e9) return (v / 1e9).toFixed(1) + " M";
  if (Math.abs(v) >= 1e6) return (v / 1e6).toFixed(1) + " jt";
  if (Math.abs(v) >= 1e3) return (v / 1e3).toFixed(1) + " rb";
  return String(Math.round(v));
}

// Render hasil baca jadi tabel/kalimat — bukan gelembung JSON mentah.
function ResultBlock({ tool, data, colors = {}, reactData, reactTool }) {
  // Untuk sintesis ReAct, tampilkan data intermediate (tabel ringkas) di bawah narasi.
  const effectiveTool = reactTool || tool;
  const effectiveData = reactData || data;
  if (!effectiveData) return null;

  // --- cariOutlet ---
  if (effectiveTool === "cariOutlet" && Array.isArray(effectiveData.rows)) {
    return (
      <div className="mt-2 rounded-xl border overflow-hidden" style={{ borderColor: colors.glassBorder }}>
        <div className="px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider" style={{ background: colors.glassFill, color: colors.textMuted }}>
          {effectiveData.ditampilkan} dari {effectiveData.total} outlet
          {effectiveData.status ? ` · Status: ${effectiveData.status}` : ""}
          {effectiveData.q ? ` · Kata kunci: "${effectiveData.q}"` : ""}
        </div>
        {effectiveData.rows.map((o, i) => {
          const lastDateStr = o.lastDate ? o.lastDate.slice(0, 10) : "-";
          return (
            <div key={i} className="px-2.5 py-1.5 text-[11px] border-t" style={{ borderColor: colors.glassBorder }}>
              <div className="flex items-center justify-between gap-2">
                <span className="truncate font-semibold" style={{ color: colors.text }}>{i + 1}. {o.name}</span>
                <span className="shrink-0 font-mono font-bold" style={{ color: colors.mint }}>{fmtRpShort(o.value)}</span>
              </div>
              <div className="flex items-center gap-2 mt-0.5" style={{ color: colors.textMuted }}>
                <span className="text-[10px]">📋 {o.invoiceCount} inv</span>
                <span className="text-[10px]">👤 {o.salesList.slice(0, 30)}</span>
                <span className="text-[10px]">📅 {lastDateStr}</span>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  // --- cariProduk ---
  if (effectiveTool === "cariProduk" && Array.isArray(effectiveData.rows)) {
    return (
      <div className="mt-2 rounded-xl border overflow-hidden" style={{ borderColor: colors.glassBorder }}>
        <div className="px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider" style={{ background: colors.glassFill, color: colors.textMuted }}>
          {effectiveData.ditampilkan} dari {effectiveData.total} produk
          {effectiveData.q ? ` · Kata kunci: "${effectiveData.q}"` : ""}
          {effectiveData.grup ? ` · Grup: ${effectiveData.grup}` : ""}
        </div>
        {effectiveData.rows.map((p, i) => (
          <div key={i} className="flex items-center justify-between gap-2 px-2.5 py-1.5 text-[11px] border-t" style={{ borderColor: colors.glassBorder }}>
            <div className="min-w-0">
              <div className="truncate font-semibold" style={{ color: colors.text }}>{i + 1}. {p.name}</div>
              <div className="text-[10px]" style={{ color: colors.textMuted }}>Grup: {p.group} · {p.outletCount} outlet</div>
            </div>
            <div className="shrink-0 text-right">
              <div className="font-mono font-bold text-[11px]" style={{ color: colors.mint }}>{fmtRpShort(p.value)}</div>
              <div className="text-[10px] font-mono" style={{ color: colors.textMuted }}>{p.qty > 0 ? p.qty + " qty" : ""}</div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  // --- detailSales ---
  if (effectiveTool === "detailSales" && effectiveData.nama) {
    const achColor = (effectiveData.ach ?? 0) >= 100 ? colors.mint : (effectiveData.ach ?? 0) >= 70 ? colors.gold : colors.coral;
    return (
      <div className="mt-2 space-y-2">
        {/* Header KPI */}
        <div className="rounded-xl border p-2.5 space-y-1.5" style={{ borderColor: colors.glassBorder }}>
          <div className="flex items-center justify-between">
            <span className="font-bold text-[11px]" style={{ color: colors.text }}>{effectiveData.nama}</span>
            <span className="font-mono font-bold text-sm" style={{ color: achColor }}>{effectiveData.ach ?? "-"}%</span>
          </div>
          <div className="flex gap-3 text-[10px]" style={{ color: colors.textMuted }}>
            <span>Realisasi: <b style={{ color: colors.text }}>{fmtRpShort(effectiveData.total)}</b></span>
            <span>Target: <b>{fmtRpShort(effectiveData.target)}</b></span>
            <span>AO: <b>{effectiveData.ao}</b></span>
          </div>
        </div>
        {/* Top Outlet */}
        {Array.isArray(effectiveData.topOutlet) && effectiveData.topOutlet.length > 0 && (
          <div className="rounded-xl border overflow-hidden" style={{ borderColor: colors.glassBorder }}>
            <div className="px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider" style={{ background: colors.glassFill, color: colors.textMuted }}>
              Top Outlet
            </div>
            {effectiveData.topOutlet.map((o, i) => (
              <div key={i} className="flex items-center justify-between gap-2 px-2.5 py-1.5 text-[11px] border-t" style={{ borderColor: colors.glassBorder }}>
                <span className="truncate" style={{ color: colors.text }}>{o.name}</span>
                <span className="shrink-0 font-mono" style={{ color: colors.mint }}>{fmtRpShort(o.value)}</span>
              </div>
            ))}
          </div>
        )}
        {/* Tren Bulanan */}
        {Array.isArray(effectiveData.tren) && effectiveData.tren.length > 1 && (
          <div className="rounded-xl border overflow-hidden" style={{ borderColor: colors.glassBorder }}>
            <div className="px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider" style={{ background: colors.glassFill, color: colors.textMuted }}>
              Tren {effectiveData.tren.length} Bulan
            </div>
            {effectiveData.tren.map((m, i) => (
              <div key={i} className="flex items-center justify-between gap-2 px-2.5 py-1.5 text-[11px] border-t" style={{ borderColor: colors.glassBorder }}>
                <span className="font-mono" style={{ color: colors.textMuted }}>{m.bulan}</span>
                <span className="font-mono font-bold" style={{ color: colors.text }}>{fmtRpShort(m.value)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // --- analisisDrop ---
  if (effectiveTool === "analisisDrop" && effectiveData.ringkasan) {
    return (
      <div className="mt-2 space-y-2">
        <p className="text-[11px] leading-relaxed" style={{ color: colors.text }}>{effectiveData.ringkasan}</p>
        {Array.isArray(effectiveData.merah5) && effectiveData.merah5.length > 0 && (
          <div className="rounded-xl border overflow-hidden" style={{ borderColor: colors.glassBorder }}>
            <div className="px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider" style={{ background: colors.glassFill, color: colors.textMuted }}>
              Sales Merah ({effectiveData.salesMerah} orang · Gap {fmtRpShort(effectiveData.gapTotal)})
            </div>
            {effectiveData.merah5.map((s, i) => (
              <div key={i} className="flex items-center justify-between gap-2 px-2.5 py-1.5 text-[11px] border-t" style={{ borderColor: colors.glassBorder }}>
                <span className="truncate" style={{ color: colors.text }}>{s.nama}</span>
                <div className="shrink-0 text-right">
                  <span className="font-mono font-bold" style={{ color: colors.coral }}>{s.ach}%</span>
                  <span className="font-mono text-[10px] ml-1.5" style={{ color: colors.textMuted }}>{fmtRpShort(s.realisasi)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // --- queryData ---
  if (effectiveTool === "queryData" && Array.isArray(effectiveData.rows)) {
    const sortTxt = effectiveData.sortBy ? ` (urut ${effectiveData.sortBy} ${effectiveData.order}, max ${effectiveData.limit})` : "";
    return (
      <div className="mt-2 rounded-xl border overflow-hidden" style={{ borderColor: colors.glassBorder }}>
        <div className="px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider" style={{ background: colors.glassFill, color: colors.textMuted }}>
          {effectiveData.rows.length} sales{sortTxt} · ACH global {effectiveData.achGlobal ?? "-"}%
        </div>
        {effectiveData.rows.map((r, i) => (
          <div key={i} className="flex items-center justify-between gap-2 px-2.5 py-1.5 text-[11px]" style={{ borderTop: `1px solid ${colors.glassBorder}` }}>
            <span className="truncate font-semibold" style={{ color: colors.text }}>{i + 1}. {r.nama || r.kode}</span>
            <span className="shrink-0 font-mono font-bold" style={{ color: (r.ach ?? 0) >= 100 ? colors.mint : (r.ach ?? 0) >= 70 ? colors.gold : colors.coral }}>
              {r.ach ?? "-"}%
            </span>
            <span className="shrink-0 font-mono" style={{ color: colors.textMuted }}>{fmtRpShort(r.total)}</span>
          </div>
        ))}
      </div>
    );
  }
  if (effectiveTool === "analisis" && effectiveData.ringkasan) {
    return (
      <div className="mt-2 space-y-1">
        <p className="text-[11px] leading-relaxed">{effectiveData.ringkasan}</p>
        {Array.isArray(effectiveData.terbawah5) && effectiveData.terbawah5.length > 0 && (
          <div className="rounded-xl border overflow-hidden" style={{ borderColor: colors.glassBorder }}>
            {effectiveData.terbawah5.map((s, i) => (
              <div key={i} className="flex items-center justify-between gap-2 px-2.5 py-1.5 text-[11px]" style={{ borderTop: i ? `1px solid ${colors.glassBorder}` : "none" }}>
                <span className="truncate">{s.nama || s.kode}</span>
                <span className="shrink-0 font-mono font-bold" style={{ color: colors.coral }}>{s.ach ?? s.achievement ?? "-"}%</span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }
  if (effectiveTool === "bacaTarget" && Array.isArray(effectiveData)) {
    return (
      <div className="mt-2 rounded-xl border overflow-hidden" style={{ borderColor: colors.glassBorder }}>
        {effectiveData.slice(0, 10).map((t, i) => (
          <div key={i} className="flex items-center justify-between gap-2 px-2.5 py-1.5 text-[11px]" style={{ borderTop: i ? `1px solid ${colors.glassBorder}` : "none" }}>
            <span className="truncate font-semibold" style={{ color: colors.text }}>{t.nama || t.kode}</span>
            <span className="shrink-0 font-mono" style={{ color: colors.textMuted }}>{fmtRpShort(t.value)} · AO {t.ao ?? "-"}</span>
          </div>
        ))}
      </div>
    );
  }
  if (effectiveTool === "bacaBulanan" && effectiveData.tren) {
    const cap = effectiveData.nBulan > 1 ? `${effectiveData.nBulan} bulan (${effectiveData.dari} – ${effectiveData.sampai})` : effectiveData.dari;
    return (
      <div className="mt-2 rounded-xl border overflow-hidden" style={{ borderColor: colors.glassBorder }}>
        <div className="px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider" style={{ background: colors.glassFill, color: colors.textMuted }}>
          Tren bulanan · {cap}
        </div>
        {effectiveData.tren.map((m, i) => (
          <div key={i} className="flex items-center justify-between gap-2 px-2.5 py-1.5 text-[11px]" style={{ borderTop: `1px solid ${colors.glassBorder}` }}>
            <span className="truncate font-semibold" style={{ color: colors.text }}>{m.label}</span>
            <span className="shrink-0 font-mono font-bold" style={{ color: (m.ach ?? 0) >= 100 ? colors.mint : (m.ach ?? 0) >= 70 ? colors.gold : colors.coral }}>
              {m.ach ?? "-"}%
            </span>
            <span className="shrink-0 font-mono" style={{ color: colors.textMuted }}>{fmtRpShort(m.total)}</span>
          </div>
        ))}
        {effectiveData.sales && (
          <div className="px-2.5 py-1 text-[10px] italic" style={{ background: colors.glassFill, color: colors.textMuted, borderTop: `1px solid ${colors.glassBorder}` }}>
            Per sales: {effectiveData.sales.filter(s => s.ach != null).length} bulan data
          </div>
        )}
      </div>
    );
  }

  // --- cariStok & bacaStok ---
  if ((effectiveTool === "cariStok" || effectiveTool === "bacaStok") && effectiveData) {
    if (Array.isArray(effectiveData.rows)) {
      return (
        <div className="mt-2 rounded-xl border overflow-hidden" style={{ borderColor: colors.glassBorder }}>
          <div className="px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider flex items-center justify-between" style={{ background: colors.glassFill, color: colors.textMuted }}>
            <span>{effectiveData.ditampilkan} dari {effectiveData.totalDitemukan} SKU{effectiveData.q ? ` · "${effectiveData.q}"` : ""}</span>
            <span className="font-mono text-[10px] text-rose-400 font-bold">{effectiveData.habisTotal} habis · {effectiveData.kritisTotal} kritis</span>
          </div>
          {effectiveData.rows.map((p, i) => {
            const isOut = p.isStockout || p.currentQty <= 0;
            const isCrit = p.isLowStock || (p.coverageDays !== null && p.coverageDays < 7);
            const statusBadge = isOut ? "HABIS" : isCrit ? "KRITIS" : p.isOverstock ? "OVER" : "AMAN";
            const badgeColor = isOut ? colors.coral : isCrit ? colors.gold : colors.mint;
            return (
              <div key={i} className="flex items-center justify-between gap-2 px-2.5 py-1.5 text-[11px] border-t" style={{ borderColor: colors.glassBorder }}>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold flex items-center gap-1.5" style={{ color: colors.text }}>
                    <span className="text-[9px] px-1 py-0.5 rounded font-bold" style={{ background: `${badgeColor}22`, color: badgeColor }}>
                      {statusBadge}
                    </span>
                    <span className="truncate">{p.nama || p.kode}</span>
                  </div>
                  <div className="text-[10px] flex items-center gap-2 mt-0.5" style={{ color: colors.textMuted }}>
                    <span>{p.grup}</span>
                    {p.coverageDays !== null && <span>· Estimasi: <b>{p.coverageDays} hari</b></span>}
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <span className="font-mono font-bold" style={{ color: isOut ? colors.coral : colors.text }}>
                    {p.currentQty.toLocaleString("id-ID")} {p.unit}
                  </span>
                  {p.currentQtyKarton > 0 && (
                    <div className="text-[10px] font-mono" style={{ color: colors.textMuted }}>
                      {p.currentQtyKarton} ktn
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      );
    }
    if (effectiveData.ringkasan) {
      return (
        <div className="mt-2 p-2.5 rounded-xl border space-y-2 text-xs" style={{ borderColor: colors.glassBorder, background: colors.glassFill }}>
          <div className="font-semibold" style={{ color: colors.text }}>{effectiveData.ringkasan}</div>
          <div className="grid grid-cols-3 gap-2 text-center pt-1 border-t" style={{ borderColor: colors.glassBorder }}>
            <div>
              <div className="text-[10px]" style={{ color: colors.textMuted }}>Total SKU</div>
              <div className="font-bold font-mono">{effectiveData.totalSku}</div>
            </div>
            <div>
              <div className="text-[10px] text-rose-400">Habis</div>
              <div className="font-bold font-mono text-rose-400">{effectiveData.habis}</div>
            </div>
            <div>
              <div className="text-[10px] text-amber-400">Kritis (&lt;7hr)</div>
              <div className="font-bold font-mono text-amber-400">{effectiveData.kritis}</div>
            </div>
          </div>
        </div>
      );
    }
  }

  // --- bacaTransaksi ---
  if (effectiveTool === "bacaTransaksi" && effectiveData) {
    if (Array.isArray(effectiveData.rows)) {
      return (
        <div className="mt-2 rounded-xl border overflow-hidden" style={{ borderColor: colors.glassBorder }}>
          <div className="px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider flex items-center justify-between" style={{ background: colors.glassFill, color: colors.textMuted }}>
            <span>{effectiveData.ditampilkan} dari {effectiveData.totalBaris} baris ({effectiveData.uniqueInvoices} faktur)</span>
            <span className="font-mono text-[10px]" style={{ color: colors.mint }}>{fmtRpShort(effectiveData.totalNilai)}</span>
          </div>
          {effectiveData.rows.map((r, i) => (
            <div key={i} className="px-2.5 py-1.5 text-[11px] border-t" style={{ borderColor: colors.glassBorder }}>
              <div className="flex items-center justify-between gap-2">
                <span className="truncate font-semibold" style={{ color: colors.text }}>{r.productName}</span>
                <span className="shrink-0 font-mono font-bold" style={{ color: colors.mint }}>{fmtRpShort(r.value)}</span>
              </div>
              <div className="flex items-center justify-between text-[10px] mt-0.5" style={{ color: colors.textMuted }}>
                <span className="truncate">🧾 {r.invoiceNo} · 🏪 {r.outletName}</span>
                <span className="shrink-0 font-mono">{r.qty} {r.unit} · 📅 {r.date}</span>
              </div>
            </div>
          ))}
        </div>
      );
    }
  }

  // --- simulasiTarget ---
  if (effectiveTool === "simulasiTarget" && effectiveData) {
    const isSingle = effectiveData.tipe === "sales_tunggal";
    const projAch = effectiveData.proyeksiAchAkhirBulan ?? 0;
    const isSuccess = projAch >= 100;
    const badgeColor = isSuccess ? colors.mint : colors.coral;

    return (
      <div className="mt-2 space-y-2">
        <div className="rounded-xl border p-2.5 space-y-2" style={{ borderColor: colors.glassBorder, background: colors.glassFill }}>
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold" style={{ color: colors.text }}>
              🎯 {isSingle ? `Simulasi: ${effectiveData.nama}` : "Simulasi Proyeksi Tim"}
            </span>
            <span
              className="text-[10px] font-bold px-1.5 py-0.5 rounded font-mono"
              style={{ background: `${badgeColor}22`, color: badgeColor }}
            >
              Proyeksi: {projAch}%
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-[10px]">
            <div className="p-1.5 rounded-lg" style={{ background: colors.glassFillStrong || "rgba(0,0,0,0.2)" }}>
              <div style={{ color: colors.textMuted }}>Run Rate Aktual</div>
              <div className="font-bold font-mono text-xs" style={{ color: colors.text }}>
                {fmtRpShort(effectiveData.runRateHarianAktual)} /hr
              </div>
            </div>
            <div className="p-1.5 rounded-lg" style={{ background: colors.glassFillStrong || "rgba(0,0,0,0.2)" }}>
              <div style={{ color: colors.textMuted }}>Dibutuhkan (Target)</div>
              <div className="font-bold font-mono text-xs" style={{ color: effectiveData.kekuranganTarget > 0 ? colors.coral : colors.mint }}>
                {fmtRpShort(effectiveData.runRateHarianDibutuhkan)} /hr
              </div>
            </div>
          </div>

          <div className="text-[10px] flex items-center justify-between" style={{ color: colors.textMuted }}>
            <span>Sisa Hari Kerja: <b>{effectiveData.sisaHariKerja} hari</b></span>
            <span>Target: <b>{fmtRpShort(effectiveData.totalTargetSimulasi || effectiveData.targetSimulasi)}</b></span>
          </div>
        </div>

        {Array.isArray(effectiveData.salesPerluIntervensi) && effectiveData.salesPerluIntervensi.length > 0 && (
          <div className="rounded-xl border overflow-hidden" style={{ borderColor: colors.glassBorder }}>
            <div className="px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider" style={{ background: colors.glassFill, color: colors.coral }}>
              Prioritas Intervensi (Proyeksi &lt; 100%)
            </div>
            {effectiveData.salesPerluIntervensi.map((s, i) => (
              <div key={i} className="flex items-center justify-between gap-2 px-2.5 py-1.5 text-[11px] border-t" style={{ borderColor: colors.glassBorder }}>
                <span className="truncate font-semibold">{s.nama}</span>
                <div className="shrink-0 text-right">
                  <span className="font-mono font-bold text-xs" style={{ color: colors.coral }}>
                    {s.proyeksiAch}%
                  </span>
                  <div className="text-[9.5px] font-mono" style={{ color: colors.textMuted }}>
                    Gap: {fmtRpShort(s.gapTarget)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // --- analisisPareto ---
  if (effectiveTool === "analisisPareto" && effectiveData?.summary) {
    const sum = effectiveData.summary;
    return (
      <div className="mt-2 space-y-2">
        <div className="p-2.5 rounded-xl border" style={{ borderColor: colors.glassBorder, background: colors.glassFill }}>
          <div className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: colors.gold }}>
            👑 Matriks Pareto ABC ({sum.totalOutlets} Toko)
          </div>
          <div className="grid grid-cols-3 gap-1.5 text-[10px]">
            <div className="p-1.5 rounded-lg text-center" style={{ background: colors.gold + "1A", border: `1px solid ${colors.gold}33` }}>
              <div className="font-bold" style={{ color: colors.gold }}>Kelas A</div>
              <div className="font-semibold">{sum.classA.pctValue}% Omset</div>
              <div className="text-[9px]" style={{ color: colors.textMuted }}>{sum.classA.count} toko ({sum.classA.pctCount}%)</div>
            </div>
            <div className="p-1.5 rounded-lg text-center" style={{ background: colors.blue + "1A", border: `1px solid ${colors.blue}33` }}>
              <div className="font-bold" style={{ color: colors.blue }}>Kelas B</div>
              <div className="font-semibold">{sum.classB.pctValue}% Omset</div>
              <div className="text-[9px]" style={{ color: colors.textMuted }}>{sum.classB.count} toko ({sum.classB.pctCount}%)</div>
            </div>
            <div className="p-1.5 rounded-lg text-center" style={{ background: colors.glassSubtle, border: `1px solid ${colors.glassBorder}` }}>
              <div className="font-bold" style={{ color: colors.textMuted }}>Kelas C</div>
              <div className="font-semibold">{sum.classC.pctValue}% Omset</div>
              <div className="text-[9px]" style={{ color: colors.textMuted }}>{sum.classC.count} toko ({sum.classC.pctCount}%)</div>
            </div>
          </div>
        </div>

        {Array.isArray(effectiveData.outlets) && effectiveData.outlets.length > 0 && (
          <div className="rounded-xl border overflow-hidden" style={{ borderColor: colors.glassBorder }}>
            <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider" style={{ background: colors.glassFill, color: colors.textMuted }}>
              Daftar Toko ({effectiveData.ditampilkan} teratas)
            </div>
            {effectiveData.outlets.map((o, i) => (
              <div key={i} className="flex items-center justify-between gap-2 px-2.5 py-1.5 text-[11px] border-t" style={{ borderColor: colors.glassBorder }}>
                <div className="truncate flex items-center gap-1.5">
                  <span className="text-[9px] px-1 py-0.5 rounded font-bold" style={{
                    background: o.kelas === "A" ? colors.gold + "22" : o.kelas === "B" ? colors.blue + "22" : colors.glassFill,
                    color: o.kelas === "A" ? colors.gold : o.kelas === "B" ? colors.blue : colors.textMuted,
                  }}>
                    {o.kelas}
                  </span>
                  <span className="truncate font-semibold">{o.nama}</span>
                </div>
                <div className="shrink-0 text-right font-mono">
                  <span className="font-bold" style={{ color: colors.text }}>{fmtRpShort(o.omset)}</span>
                  <span className="text-[9.5px] ml-1.5" style={{ color: colors.textMuted }}>({o.kontribusi}%)</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // --- hitungKomisi ---
  if (effectiveTool === "hitungKomisi" && effectiveData?.summary) {
    const sum = effectiveData.summary;
    return (
      <div className="mt-2 space-y-2">
        <div className="p-2.5 rounded-xl border flex items-center justify-between" style={{ borderColor: colors.glassBorder, background: colors.glassFill }}>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: colors.mint }}>
              💰 Estimasi Total Insentif
            </div>
            <div className="text-sm font-bold font-mono" style={{ color: colors.mint }}>
              {fmtRpShort(sum.totalPayout)}
            </div>
          </div>
          <div className="text-right text-[10px]" style={{ color: colors.textMuted }}>
            <div>Lolos Insentif: <b>{sum.qualifiedSalesCount} / {sum.totalSalesCount}</b></div>
            <div>Rata-rata: <b>{fmtRpShort(sum.avgPayout)}</b></div>
          </div>
        </div>

        {Array.isArray(effectiveData.commissions) && effectiveData.commissions.length > 0 && (
          <div className="rounded-xl border overflow-hidden" style={{ borderColor: colors.glassBorder }}>
            <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider" style={{ background: colors.glassFill, color: colors.textMuted }}>
              Estimasi Payout Sales
            </div>
            {effectiveData.commissions.map((c, i) => (
              <div key={i} className="flex items-center justify-between gap-2 px-2.5 py-1.5 text-[11px] border-t" style={{ borderColor: colors.glassBorder }}>
                <div className="truncate">
                  <div className="truncate font-semibold">{c.salesName}</div>
                  <div className="text-[9.5px]" style={{ color: colors.textMuted }}>
                    {c.tierLabel} · ACH {c.ach}% {c.aoBonusQualified ? "· AO ✓" : ""}
                  </div>
                </div>
                <div className="shrink-0 text-right font-mono font-bold" style={{ color: c.totalIncentive > 0 ? colors.mint : colors.textMuted }}>
                  {fmtRpShort(c.totalIncentive)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return null;
}



export function AiChatDrawer({
  isOpen,
  onClose,
  colors = {},
  _canAccess,
  aiContext = {},
  deps = {},
  notifyError = () => {},
}) {
  const [messages, setMessages] = useState(() => loadChatLog());
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [busyStage, setBusyStage] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [aiSettings, setAiSettings] = useState(() => loadAiSettings());
  const [showKey, setShowKey] = useState(false);
  const [testResult, setTestResult] = useState(null); // { ok: bool, msg: str }
  const [testing, setTesting] = useState(false);

  // State konfirmasi tool tulis
  const [pendingAction, setPendingAction] = useState(null); // { tool, params, preview, run, ringkasan }

  // State fitur ekspor
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [toast, setToast] = useState(null); // { msg: string, type: "success" | "error" | "info" }
  const [copiedId, setCopiedId] = useState(null); // ID pesan yang baru disalin
  const chatBodyRef = useRef(null);
  const exportMenuRef = useRef(null);

  const drawerRef = useRef(null);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  // Batalkan request AI yang masih jalan saat kirim ulang / tutup drawer.
  const inFlightRef = useRef(null);

  useScrollLock(isOpen);
  useEscapeKey(isOpen, () => {
    if (settingsOpen) setSettingsOpen(false);
    else onClose?.();
  });
  useFocusTrap(isOpen, drawerRef);

  // Tutup drawer = batalkan request yang masih jalan.
  useEffect(() => {
    if (!isOpen) inFlightRef.current?.abort(new Error("Dibatalkan: panel ditutup."));
  }, [isOpen]);

  // Auto-scroll ke bawah saat pesan bertambah
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOpen, busy]);

  // Fokus input saat drawer dibuka
  useEffect(() => {
    if (isOpen && !settingsOpen) {
      const t = setTimeout(() => inputRef.current?.focus(), 80);
      return () => clearTimeout(t);
    }
  }, [isOpen, settingsOpen]);

  // Simpan log chat tiap pesan berubah
  useEffect(() => {
    saveChatLog(messages);
  }, [messages]);

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => {
      setToast((prev) => (prev?.msg === msg ? null : prev));
    }, 2800);
  };

  const handleCopyAllChat = async () => {
    if (!messages.length) return;
    const md = formatChatAsMarkdown(messages, { model: aiSettings.model });
    const ok = await copyToClipboard(md);
    setExportMenuOpen(false);
    if (ok) {
      showToast("Seluruh riwayat chat berhasil disalin!");
    } else {
      showToast("Gagal menyalin ke clipboard", "error");
    }
  };

  const handleCopyMessage = async (m) => {
    const md = formatMessageAsMarkdown(m);
    const ok = await copyToClipboard(md);
    if (ok) {
      setCopiedId(m.id);
      setTimeout(() => setCopiedId((id) => (id === m.id ? null : id)), 2000);
      showToast("Pesan tersalin ke clipboard!");
    } else {
      showToast("Gagal menyalin pesan", "error");
    }
  };

  const handleExportPdf = () => {
    if (!messages.length) return;
    setExportMenuOpen(false);
    setExporting(true);
    try {
      const ok = exportChatToPdf(messages, { model: aiSettings.model });
      if (ok) {
        showToast("Laporan PDF berhasil diunduh!");
      }
    } catch (err) {
      console.error(err);
      showToast("Gagal membuat PDF: " + err.message, "error");
    } finally {
      setExporting(false);
    }
  };

  const handleExportChatImage = async () => {
    if (!chatBodyRef.current || !messages.length) return;
    setExportMenuOpen(false);
    setExporting(true);
    showToast("Sedang memproses gambar chat...", "info");
    try {
      const ok = await exportElementToPng(chatBodyRef.current, `AI_Chat_Lengkap.png`, {
        backgroundColor: colors.bgPrimary || "#0F172A",
      });
      if (ok) {
        showToast("Gambar percakapan berhasil diunduh!");
      } else {
        showToast("Gagal mengekspor gambar", "error");
      }
    } catch (err) {
      showToast("Gagal: " + err.message, "error");
    } finally {
      setExporting(false);
    }
  };

  const handleExportMessageImage = async (msgId) => {
    const el = document.getElementById(`msg-card-${msgId}`);
    if (!el) return;
    setExporting(true);
    showToast("Sedang memproses gambar...", "info");
    try {
      const ok = await exportElementToPng(el, `AI_Rekomendasi_${msgId}.png`, {
        backgroundColor: colors.bgPrimary || "#0F172A",
      });
      if (ok) {
        showToast("Gambar rekomendasi berhasil diunduh!");
      } else {
        showToast("Gagal mengekspor gambar", "error");
      }
    } catch (err) {
      showToast("Gagal: " + err.message, "error");
    } finally {
      setExporting(false);
    }
  };

  // Tutup dropdown ekspor saat klik di luar
  useEffect(() => {
    function handleClickOutside(e) {
      if (exportMenuOpen && exportMenuRef.current && !exportMenuRef.current.contains(e.target)) {
        setExportMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [exportMenuOpen]);

  const handleClearHistory = () => {
    setMessages([]);
    try { window.localStorage.removeItem(CHAT_LOG_KEY); } catch { /* ignore */ }
  };

  const handleSaveSettings = (newSettings) => {
    saveAiSettings(newSettings);
    setAiSettings(newSettings);
    setSettingsOpen(false);
    setTestResult(null);
  };

  const handleTestConnectionViaTransport = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      if (!aiSettings.model) throw new Error("Model AI wajib diisi.");
      if (aiSettings.mode !== "proxy" && !aiSettings.baseURL) {
        throw new Error("Base URL wajib diisi untuk mode Direct.");
      }
      const call = isTauriRuntime()
        ? ((s, msgs, _o) => callTauri(s, msgs))
        : aiSettings.mode === "proxy" ? callProxy : callDirect;
      // Tanpa fallback "Terhubung!" — balasan kosong = gagal (sukses palsu dilarang).
      // Gunakan useTools: false agar AI tidak mencoba memilih tools saat tes ping koneksi.
      const reply = await call(aiSettings, [
        { role: "user", content: "Halo, jawab 'OK' jika terhubung." },
      ], { timeoutMs: 30000, useTools: false });

      // Ekstrak teks balasan secara aman (menangani string, objek tool call, array, atau objek respons)
      let replyText = "";
      if (typeof reply === "string") {
        replyText = reply;
      } else if (reply && typeof reply === "object") {
        if (reply.isNativeToolCall) {
          replyText = reply.params?.jawaban || reply.ringkasan || `Tool: ${reply.tool}`;
        } else if (typeof reply.content === "string") {
          replyText = reply.content;
        } else if (typeof reply.text === "string") {
          replyText = reply.text;
        } else if (typeof reply.response === "string") {
          replyText = reply.response;
        } else {
          replyText = JSON.stringify(reply);
        }
      }

      const trimmedReply = replyText.trim();
      if (!trimmedReply) throw new Error("Respons kosong dari server AI.");
      setTestResult({ ok: true, msg: `Koneksi sukses! Balasan: "${trimmedReply}"` });
    } catch (e) {
      setTestResult({ ok: false, msg: `Koneksi gagal: ${e.message}` });
    } finally {
      setTesting(false);
    }
  };

  const handleSend = async (textToSend) => {
    const text = (textToSend || input).trim();
    if (!text || busy) return;

    if ((aiSettings.mode !== "proxy" && !aiSettings.baseURL) || !aiSettings.model) {
      setSettingsOpen(true);
      notifyError("Konfigurasi AI Diperlukan", "Silakan atur Base URL dan Model AI di setelan.");
      return;
    }

    const userMsg = { id: Date.now().toString(36), role: "user", text, createdAt: Date.now() };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setBusy(true);
    setBusyStage("Memahami perintah…");
    // Batalkan request sebelumnya bila masih jalan, mulai controller baru.
    inFlightRef.current?.abort(new Error("Dibatalkan: ada perintah baru."));
    const flight = new AbortController();
    inFlightRef.current = flight;

    try {
      // Ambil 6 pesan terakhir (tidak termasuk pesan user baru yang baru ditambah)
      // untuk dikirim sebagai chat history ke LLM.
      const chatHistory = messages.slice(-6);

      // executeTool: injeksi ke dispatcher agar ReAct loop bisa menjalankan
      // tool baca langsung di browser, hasilnya dikirim ke LLM untuk sintesis.
      const executeToolForReact = (tool, params, ctx) => {
        return executeAiTool(tool, params, ctx, deps);
      };

      // Siapkan placeholder streaming ID jika model mengirim delta teks
      const streamMsgId = (Date.now() + 1).toString(36);
      let streamedDeltaText = "";


      const onDelta = (chunk) => {
        streamedDeltaText += chunk;
        setMessages((prev) => {
          const idx = prev.findIndex((m) => m.id === streamMsgId);
          if (idx >= 0) {
            const next = [...prev];
            next[idx] = { ...next[idx], text: streamedDeltaText };
            return next;
          }
          // Tambah pesan streaming baru
          return [
            ...prev,
            {
              id: streamMsgId,
              role: "assistant",
              text: streamedDeltaText,
              tool: "chat",
              isStreaming: true,
              createdAt: Date.now(),
            },
          ];
        });
      };

      const res = await dispatch(text, aiContext, aiSettings, {
        signal: flight.signal,
        chatHistory,
        executeTool: executeToolForReact,
        onDelta,
      });

      // Hapus flag isStreaming dari pesan placeholder jika ada
      setMessages((prev) => prev.filter((m) => m.id !== streamMsgId));

      // Jika ReAct loop berhasil (ada intermediate step), tampilkan info tool yang dipakai
      const hasReact = res.reactSteps && res.reactSteps.length > 0;
      const intermediateTool = res.intermediate?.parsed?.tool;
      setBusyStage(hasReact
        ? `Sintesis dari ${intermediateTool || "tool"}…`
        : `Menjalankan ${res.parsed?.tool || "tool"}…`
      );

      if (!res.parsed || !res.parsed.ok) {
        // Output tidak valid JSON atau tool asing
        const aiMsg = {
          id: (Date.now() + 1).toString(36),
          role: "assistant",
          text: res.text || res.parsed?.reason || "Format respons tidak dikenali.",
          isRaw: true,
          createdAt: Date.now(),
        };
        setMessages((prev) => [...prev, aiMsg]);
        return;
      }

      const { tool, params, ringkasan } = res.parsed;
      // Timeline thinking: tiap pesan bawa steps agar alur terlihat.
      const steps = hasReact
        ? [
          { label: `Perintah dipahami → ${intermediateTool}`, state: "done" },
          { label: `Data diambil → Sintesis AI`, state: "done" },
        ]
        : [{ label: `Perintah dipahami → ${tool}`, state: "done" }];

      if (tool === "chat") {

        // Obrolan umum atau sintesis ReAct: jawaban langsung, tanpa eksekusi data.
        const c = hasReact
          ? { ok: true, data: { jawaban: res.parsed.params?.jawaban ?? ringkasan } }
          : executeAiTool(tool, params, aiContext, deps);
        const aiMsg = {
          id: (Date.now() + 1).toString(36),
          role: "assistant",
          text: c.ok ? c.data.jawaban : ringkasan,
          tool: hasReact ? intermediateTool : tool,
          isReactSynthesis: hasReact,
          steps: [...steps, { label: "Jawaban langsung (tanpa data)", state: "done" }],
          // Teruskan data tool intermediate agar ResultBlock bisa render tabel
          reactData: hasReact ? res.intermediate?.toolResult?.data : null,
          reactTool: hasReact ? intermediateTool : null,
          createdAt: Date.now(),
        };
        setMessages((prev) => [...prev, aiMsg]);
        return;
      }

      if (isWriteTool(tool)) {
        // Tool tulis: susun preview, tahan eksekusi hingga user konfirmasi
        const writeExec = executeAiTool(tool, params, aiContext, deps);
        if (!writeExec.ok) {
          const errMsg = {
            id: (Date.now() + 1).toString(36),
            role: "assistant",
            text: `Perintah ditolak: ${writeExec.reason}`,
            tool,
            steps: [...steps, { label: `Validasi gagal: ${writeExec.reason}`, state: "error" }],
            createdAt: Date.now(),
          };
          setMessages((prev) => [...prev, errMsg]);
          return;
        }

        // Tampilkan pesan dengan tombol konfirmasi
        const pendingMsg = {
          id: (Date.now() + 1).toString(36),
          role: "assistant",
          text: ringkasan || "Permintaan memerlukan persetujuan Anda:",
          tool,
          params,
          preview: writeExec.preview,
          status: "pending",
          steps: [...steps, { label: "Menunggu persetujuan Anda", state: "active" }],
          createdAt: Date.now(),
        };
        setMessages((prev) => [...prev, pendingMsg]);
        setPendingAction({ tool, params, preview: writeExec.preview, run: writeExec.run, ringkasan, msgId: pendingMsg.id });
      } else {
        // Tool baca (tanpa ReAct): eksekusi langsung
        const readExec = executeAiTool(tool, params, aiContext, deps);
        const aiMsg = {
          id: (Date.now() + 1).toString(36),
          role: "assistant",
          text: ringkasan,
          tool,
          steps: readExec.ok
            ? [...steps, { label: `Eksekusi ${tool} berhasil`, state: "done" }]
            : [...steps, { label: `Eksekusi gagal: ${readExec.reason}`, state: "error" }],
          data: readExec.ok ? readExec.data : null,
          error: readExec.ok ? null : readExec.reason,
          createdAt: Date.now(),
        };
        setMessages((prev) => [...prev, aiMsg]);
      }
    } catch (err) {
      if (inFlightRef.current === flight) inFlightRef.current = null;
      // Batal manual (perintah baru / tutup) jangan tampilkan sebagai error.
      if (err?.name === "AbortError" && /Dibatalkan/.test(err?.reason?.message || err?.message || "")) {
        setBusy(false);
        return;
      }
      console.error("AI dispatch error:", err);
      notifyError("AI Error", err.message);
      const errMsg = {
        id: (Date.now() + 1).toString(36),
        role: "assistant",
        text: `Error: ${err.message}`,
        isError: true,
        createdAt: Date.now(),
      };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setBusy(false);
    }
  };


  const handleConfirmAction = async () => {
    if (!pendingAction?.run) return;
    const { run, msgId } = pendingAction;
    setPendingAction(null);
    setBusy(true);
    try {
      const res = await run();
      if (res.ok) {
        setMessages((prev) =>
          prev.map((m) => (m.id === msgId ? { ...m, status: "completed", resultText: "Berhasil diterapkan." } : m))
        );
      } else {
        setMessages((prev) =>
          prev.map((m) => (m.id === msgId ? { ...m, status: "failed", resultText: `Gagal: ${res.reason}` } : m))
        );
      }
    } catch (e) {
      notifyError("Gagal Eksekusi", e.message);
      setMessages((prev) =>
        prev.map((m) => (m.id === msgId ? { ...m, status: "failed", resultText: `Error: ${e.message}` } : m))
      );
    } finally {
      setBusy(false);
    }
  };

  const handleCancelAction = () => {
    if (pendingAction?.msgId) {
      const { msgId } = pendingAction;
      setMessages((prev) =>
        prev.map((m) => (m.id === msgId ? { ...m, status: "cancelled", resultText: "Dibatalkan oleh pengguna." } : m))
      );
    }
    setPendingAction(null);
  };

  if (!isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-sm sm-fadein"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Panel AI Automasi"
    >
      <div
        ref={drawerRef}
        className="w-full sm:w-[420px] h-full flex flex-col shadow-2xl sm-scale-in"
        style={{
          background: colors.dropdownBg || "#0F172A",
          borderLeft: `1px solid ${colors.glassBorder}`,
          color: colors.text || "#F8FAFC",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ===== HEADER ===== */}
        <div
          className="p-4 flex items-center justify-between gap-3 shrink-0"
          style={{
            borderBottom: `1px solid ${colors.glassBorder}`,
            background: colors.glassFill,
          }}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className="p-2 rounded-xl shrink-0 flex items-center justify-center"
              style={{ background: `${colors.mint || "#10B981"}22`, color: colors.mint || "#10B981" }}
            >
              <Sparkles size={18} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm truncate">Asisten AI Automasi</span>
                {(() => {
                  const tauri = isTauriRuntime();
                  const label = tauri ? "Tauri" : (aiSettings.mode === "direct" ? "Direct" : "Proxy");
                  const bg = tauri ? `${colors.mint}22` : (aiSettings.mode === "direct" ? `${colors.gold}22` : `${colors.blue}22`);
                  const fg = tauri ? colors.mint : (aiSettings.mode === "direct" ? colors.gold : colors.blue);
                  const tip = tauri ? "Koneksi via Rust native (bebas CORS/CSP)" : (aiSettings.mode === "direct" ? "Koneksi Langsung dari Browser" : "Koneksi via Backend Proxy");
                  return (
                    <span
                      className="text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider"
                      style={{ background: bg, color: fg }}
                      title={tip}
                    >
                      {label}
                    </span>
                  );
                })()}
              </div>
              <p className="text-[11px] truncate" style={{ color: colors.textMuted }}>
                {aiSettings.model || "Belum dikonfigurasi"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {/* Tombol Ekspor Dropdown */}
            <div className="relative" ref={exportMenuRef}>
              <button
                type="button"
                onClick={() => setExportMenuOpen((v) => !v)}
                disabled={messages.length === 0 || exporting}
                className="sm-btn p-2 rounded-xl transition-colors disabled:opacity-30 relative"
                style={{
                  background: exportMenuOpen ? `${colors.mint}22` : colors.glassFill,
                  color: exportMenuOpen ? colors.mint : colors.textMuted,
                }}
                title="Ekspor Chat & Rekomendasi"
                aria-label="Ekspor Chat & Rekomendasi"
              >
                {exporting ? <RefreshCw size={15} className="animate-spin" /> : <Share2 size={15} />}
              </button>

              {/* Dropdown Menu Ekspor */}
              {exportMenuOpen && (
                <div
                  className="absolute right-0 top-full mt-2 w-56 rounded-2xl shadow-2xl border p-1.5 z-50 sm-fadein space-y-1"
                  style={{
                    background: colors.dropdownBg || "#0F172A",
                    borderColor: colors.glassBorder,
                  }}
                >
                  <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider" style={{ color: colors.textMuted }}>
                    Ekspor Seluruh Chat
                  </div>
                  <button
                    type="button"
                    onClick={handleCopyAllChat}
                    className="w-full text-left px-2.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 hover:opacity-100 transition-all opacity-80"
                    style={{ background: colors.glassFill, color: colors.text }}
                  >
                    <Copy size={13} style={{ color: colors.blue }} />
                    <span>Salin ke Clipboard (MD)</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleExportPdf}
                    className="w-full text-left px-2.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 hover:opacity-100 transition-all opacity-80"
                    style={{ background: colors.glassFill, color: colors.text }}
                  >
                    <FileText size={13} style={{ color: colors.coral }} />
                    <span>Unduh Dokumen PDF (.pdf)</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleExportChatImage}
                    className="w-full text-left px-2.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 hover:opacity-100 transition-all opacity-80"
                    style={{ background: colors.glassFill, color: colors.text }}
                  >
                    <ImageIcon size={13} style={{ color: colors.gold }} />
                    <span>Unduh Gambar Chat (.png)</span>
                  </button>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => setSettingsOpen((v) => !v)}
              className="sm-btn p-2 rounded-xl transition-colors"
              style={{
                background: settingsOpen ? `${colors.mint}22` : colors.glassFill,
                color: settingsOpen ? colors.mint : colors.textMuted,
              }}
              title="Setelan API AI"
              aria-label="Setelan API AI"
            >
              <Settings size={15} />
            </button>
            <button
              type="button"
              onClick={handleClearHistory}
              disabled={messages.length === 0}
              className="sm-btn p-2 rounded-xl transition-colors disabled:opacity-30"
              style={{ background: colors.glassFill, color: colors.textMuted }}
              title="Hapus riwayat chat"
              aria-label="Hapus riwayat chat"
            >
              <Trash2 size={15} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="sm-btn p-2 rounded-xl transition-colors"
              style={{ background: colors.glassFill, color: colors.text }}
              title="Tutup Panel"
              aria-label="Tutup Panel"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Toast Notifikasi Ekspor */}
        {toast && (
          <div
            className="absolute top-16 left-1/2 -translate-x-1/2 z-50 px-3.5 py-1.5 rounded-xl text-xs font-semibold shadow-lg border flex items-center gap-2 sm-fadein"
            style={{
              background: toast.type === "error" ? "#7F1D1D" : toast.type === "info" ? "#1E3A8A" : "#064E3B",
              borderColor: toast.type === "error" ? "#EF4444" : toast.type === "info" ? "#3B82F6" : "#10B981",
              color: "#FFFFFF",
            }}
          >
            {toast.type === "error" ? <AlertTriangle size={13} /> : toast.type === "info" ? <RefreshCw size={13} className="animate-spin" /> : <CheckCircle2 size={13} />}
            <span>{toast.msg}</span>
          </div>
        )}

        {/* ===== SETTINGS PANEL (OVERLAY) ===== */}
        {settingsOpen && (
          <div
            className="p-4 space-y-3.5 sm-fadein overflow-y-auto shrink-0"
            style={{
              background: colors.glassFillStrong || "rgba(15,23,42,0.95)",
              borderBottom: `1px solid ${colors.glassBorder}`,
            }}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider" style={{ color: colors.gold }}>
                Konfigurasi API AI
              </span>
              <button
                type="button"
                onClick={() => setSettingsOpen(false)}
                className="text-xs font-semibold"
                style={{ color: colors.textMuted }}
              >
                Tutup
              </button>
            </div>

            {/* Mode selection */}
            <div>
              <label className="block text-xs font-semibold mb-1" style={{ color: colors.textMuted }}>
                Mode Koneksi
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setAiSettings((s) => ({ ...s, mode: "direct" }))}
                  className={`py-1.5 px-2 rounded-lg text-xs font-semibold border text-center transition-all ${
                    aiSettings.mode === "direct" ? "border-emerald-500 bg-emerald-500/10 text-emerald-400" : "opacity-60"
                  }`}
                  style={{ borderColor: aiSettings.mode === "direct" ? colors.mint : colors.glassBorder }}
                >
                  Direct (Browser)
                </button>
                <button
                  type="button"
                  onClick={() => setAiSettings((s) => ({ ...s, mode: "proxy" }))}
                  className={`py-1.5 px-2 rounded-lg text-xs font-semibold border text-center transition-all ${
                    aiSettings.mode === "proxy" ? "border-blue-500 bg-blue-500/10 text-blue-400" : "opacity-60"
                  }`}
                  style={{ borderColor: aiSettings.mode === "proxy" ? colors.blue : colors.glassBorder }}
                >
                  Proxy (Backend)
                </button>
              </div>
            </div>

            {/* Provider Preset (Cepat) */}
            {aiSettings.mode === "direct" && (
              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: colors.textMuted }}>
                  Preset Penyedia AI (1-Klik)
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  {[
                    { name: "Groq (Cepat/Gratis)", url: "https://api.groq.com/openai/v1", model: "llama-3.3-70b-versatile" },
                    { name: "OpenRouter", url: "https://openrouter.ai/api/v1", model: "google/gemini-2.5-flash" },
                    { name: "DeepSeek", url: "https://api.deepseek.com/v1", model: "deepseek-chat" },
                    { name: "OpenAI", url: "https://api.openai.com/v1", model: "gpt-4o-mini" },
                  ].map((preset) => (
                    <button
                      key={preset.name}
                      type="button"
                      onClick={() => setAiSettings((s) => ({ ...s, baseURL: preset.url, model: preset.model }))}
                      className="px-2 py-1.5 rounded-lg text-[11px] font-semibold border text-left truncate transition-all hover:opacity-100 opacity-80"
                      style={{ background: colors.glassFill, borderColor: colors.glassBorder, color: colors.text }}
                    >
                      ⚡ {preset.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Base URL */}
            <div>
              <label className="block text-xs font-semibold mb-1" style={{ color: colors.textMuted }}>
                {aiSettings.mode === "proxy" ? "URL Backend Proxy" : "Base URL (OpenAI-compatible)"}
              </label>

              <input
                type="text"
                value={aiSettings.mode === "proxy" ? aiSettings.backendURL : aiSettings.baseURL}
                onChange={(e) => setAiSettings((s) => ({
                  ...s,
                  [s.mode === "proxy" ? "backendURL" : "baseURL"]: e.target.value,
                }))}
                placeholder={aiSettings.mode === "proxy" ? "kosongkan untuk /api/ai" : "mis. https://api.openai.com/v1"}
                className="w-full px-3 py-1.5 rounded-lg text-xs outline-none mono"
                style={{ background: colors.glassFill, border: `1px solid ${colors.glassBorder}`, color: colors.text }}
              />
            </div>

            {/* Model */}
            <div>
              <label className="block text-xs font-semibold mb-1" style={{ color: colors.textMuted }}>
                Nama Model AI
              </label>
              <input
                type="text"
                value={aiSettings.model}
                onChange={(e) => setAiSettings((s) => ({ ...s, model: e.target.value }))}
                placeholder="mis. gpt-4o-mini, deepseek-chat, llama-3.3-70b"
                className="w-full px-3 py-1.5 rounded-lg text-xs outline-none mono"
                style={{ background: colors.glassFill, border: `1px solid ${colors.glassBorder}`, color: colors.text }}
              />
            </div>

            {/* API Key */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold" style={{ color: colors.textMuted }}>
                  {aiSettings.mode === "proxy" ? "Token Proxy (opsional)" : "API Key"}
                </label>
                <button
                  type="button"
                  onClick={() => setShowKey((v) => !v)}
                  className="text-[11px] flex items-center gap-1"
                  style={{ color: colors.textMuted }}
                >
                  {showKey ? <EyeOff size={11} /> : <Eye size={11} />}
                  {showKey ? "Sembunyikan" : "Tampilkan"}
                </button>
              </div>
              <input
                type={showKey ? "text" : "password"}
                value={aiSettings.key}
                onChange={(e) => setAiSettings((s) => ({ ...s, key: e.target.value }))}
                placeholder={aiSettings.mode === "proxy" ? "opsional" : "sk-..."}
                className="w-full px-3 py-1.5 rounded-lg text-xs outline-none mono"
                style={{ background: colors.glassFill, border: `1px solid ${colors.glassBorder}`, color: colors.text }}
              />
              <p className="text-[10px] mt-1 flex items-center gap-1" style={{ color: colors.textMuted }}>
                🔒 Disimpan lokal di perangkat ini, tidak dikirim ke server aplikasi.
              </p>
            </div>

            {/* Test result */}
            {testResult && (
              <div
                className={`p-2.5 rounded-lg text-xs flex items-center gap-2 ${
                  testResult.ok ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30" : "bg-rose-500/10 text-rose-400 border border-rose-500/30"
                }`}
              >
                {testResult.ok ? <CheckCircle2 size={14} className="shrink-0" /> : <AlertTriangle size={14} className="shrink-0" />}
                <span className="truncate">{testResult.msg}</span>
              </div>
            )}

            {/* Buttons */}
            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={handleTestConnectionViaTransport}
                disabled={testing}
                className="sm-btn flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 border disabled:opacity-40"
                style={{ borderColor: colors.glassBorder, color: colors.text }}
              >
                {testing ? <RefreshCw size={12} className="animate-spin" /> : <Sparkles size={12} />}
                {testing ? "Menguji..." : "Uji Koneksi"}
              </button>
              <button
                type="button"
                onClick={() => handleSaveSettings(aiSettings)}
                className="sm-btn flex-1 py-1.5 px-3 rounded-lg text-xs font-bold text-white shadow-sm"
                style={{ background: colors.mint || "#10B981" }}
              >
                Simpan Setelan
              </button>
            </div>
          </div>
        )}

        {/* ===== CHAT BODY (MESSAGES) ===== */}
        <div ref={chatBodyRef} className="flex-1 overflow-y-auto p-4 space-y-3.5">
          {messages.length === 0 ? (
            <div className="text-center py-12 space-y-3">
              <div
                className="w-12 h-12 rounded-2xl mx-auto flex items-center justify-center"
                style={{ background: `${colors.mint || "#10B981"}18`, color: colors.mint || "#10B981" }}
              >
                <Bot size={24} />
              </div>
              <div>
                <h3 className="text-sm font-bold">Asisten AI Automasi</h3>
                <p className="text-xs mt-1 max-w-xs mx-auto" style={{ color: colors.textMuted }}>
                  Beri instruksi langsung untuk menganalisis data, menyesuaikan target sales, atau mengekspor laporan.
                </p>
              </div>

              {/* Quick suggestions */}
              <div className="pt-4 space-y-1.5 max-w-xs mx-auto text-left">
                <span className="text-[11px] font-bold uppercase tracking-wider block" style={{ color: colors.textMuted }}>
                  Saran Cepat:
                </span>
                {QUICK_PROMPTS.map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => handleSend(q)}
                    className="sm-row w-full text-left p-2 rounded-xl text-xs flex items-center justify-between gap-2 border transition-all"
                    style={{ background: colors.glassFill, borderColor: colors.glassBorder }}
                  >
                    <span className="truncate">{q}</span>
                    <ArrowRight size={12} className="shrink-0 opacity-60" />
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((m) => {
              const isUser = m.role === "user";
              return (
                <div
                  key={m.id}
                  className={`flex flex-col ${isUser ? "items-end" : "items-start"} sm-fadein`}
                >
                  <div
                    id={`msg-card-${m.id}`}
                    className={`max-w-[88%] p-3 rounded-2xl text-xs leading-relaxed ${
                      isUser
                        ? "rounded-tr-sm text-white font-medium"
                        : "rounded-tl-sm shadow-sm border"
                    }`}
                    style={{
                      background: isUser ? colors.mint || "#10B981" : colors.glassFillStrong || "rgba(255,255,255,0.05)",
                      borderColor: isUser ? "transparent" : colors.glassBorder,
                      color: isUser ? "#FFFFFF" : colors.text,
                    }}
                  >
                    {/* Header nama tool jika ada */}
                    {(m.tool || m.reactTool) && (
                      <div
                        className="text-[10px] font-mono font-bold uppercase tracking-wider mb-1.5 pb-1 border-b flex items-center gap-1.5"
                        style={{ borderColor: colors.glassBorder, color: colors.gold }}
                      >
                        <Sparkles size={11} /> Tool: {m.reactTool || m.tool}
                        {m.isReactSynthesis && (
                          <span className="ml-1 text-[9px] px-1 rounded font-normal normal-case tracking-normal"
                            style={{ background: `${colors.blue}22`, color: colors.blue }}>
                            + Sintesis AI
                          </span>
                        )}
                      </div>
                    )}

                    <div className="whitespace-pre-wrap">{m.text}</div>

                    {/* Timeline thinking */}
                    <ThinkingSteps steps={m.steps} colors={colors} />

                    {/* Hasil baca: tabel/kalimat, bukan JSON mentah.
                        reactData + reactTool untuk sintesis ReAct (data dari tool intermediate). */}
                    <ResultBlock
                      tool={m.tool}
                      data={m.data}
                      colors={colors}
                      reactData={m.reactData}
                      reactTool={m.reactTool}
                    />

                    {/* Preview box untuk aksi tulis */}
                    {m.preview && (
                      <div
                        className="mt-2.5 p-2.5 rounded-xl border space-y-1.5"
                        style={{
                          background: colors.glassSubtle || "rgba(0,0,0,0.2)",
                          borderColor: colors.gold + "55",
                        }}
                      >
                        <div className="font-bold text-[11px] flex items-center gap-1.5" style={{ color: colors.gold }}>
                          <AlertTriangle size={12} />
                          {m.preview.judul}
                        </div>
                        <ul className="text-[10px] font-mono space-y-0.5 max-h-36 overflow-y-auto pr-1">
                          {m.preview.baris?.map((b, i) => (
                            <li key={i} className="truncate">• {b}</li>
                          ))}
                        </ul>

                        {/* Status konfirmasi */}
                        {m.status === "pending" && pendingAction?.msgId === m.id && (
                          <div className="pt-2 flex items-center gap-2">
                            <button
                              type="button"
                              onClick={handleCancelAction}
                              disabled={busy}
                              className="sm-btn px-2.5 py-1 rounded-lg text-[11px] font-semibold flex-1 border"
                              style={{ borderColor: colors.glassBorder, color: colors.textMuted }}
                            >
                              Batal
                            </button>
                            <button
                              type="button"
                              onClick={handleConfirmAction}
                              disabled={busy}
                              className="sm-btn px-2.5 py-1 rounded-lg text-[11px] font-bold text-white flex-1"
                              style={{ background: colors.mint || "#10B981" }}
                            >
                              Terapkan
                            </button>
                          </div>
                        )}
                        {m.status && m.status !== "pending" && (
                          <div
                            className={`text-[10px] font-semibold pt-1 ${
                              m.status === "completed" ? "text-emerald-400" : "text-rose-400"
                            }`}
                          >
                            {m.resultText || (m.status === "completed" ? "Selesai." : "Dibatalkan.")}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Micro-actions untuk pesan asisten */}
                    {!isUser && !m.isStreaming && (
                      <div
                        className="mt-2.5 pt-1.5 flex items-center justify-end gap-3 border-t"
                        style={{ borderColor: colors.glassBorder }}
                      >
                        <button
                          type="button"
                          onClick={() => handleCopyMessage(m)}
                          className="text-[10px] flex items-center gap-1 font-semibold transition-opacity opacity-75 hover:opacity-100"
                          style={{ color: copiedId === m.id ? colors.mint : colors.textMuted }}
                          title="Salin rekomendasi ini ke clipboard"
                        >
                          {copiedId === m.id ? <Check size={11} /> : <Copy size={11} />}
                          <span>{copiedId === m.id ? "Tersalin" : "Salin"}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleExportMessageImage(m.id)}
                          disabled={exporting}
                          className="text-[10px] flex items-center gap-1 font-semibold transition-opacity opacity-75 hover:opacity-100 disabled:opacity-30"
                          style={{ color: colors.textMuted }}
                          title="Simpan kartu ini sebagai gambar PNG"
                        >
                          <ImageIcon size={11} />
                          <span>Simpan Gambar</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}

          {busy && (
            <div className="flex items-center gap-2 text-xs py-2 px-3 rounded-xl w-fit sm-fadein" style={{ background: colors.glassFill }}>
              <RefreshCw size={13} className="animate-spin" style={{ color: colors.mint }} />
              <span style={{ color: colors.textMuted }}>{busyStage || "Memproses instruksi AI…"}</span>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* ===== CHAT FOOTER (INPUT) ===== */}
        <div
          className="p-3 shrink-0 space-y-2"
          style={{
            borderTop: `1px solid ${colors.glassBorder}`,
            background: colors.glassFill,
          }}
        >
          {/* Quick chip bar */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
            {QUICK_PROMPTS.slice(0, 3).map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => handleSend(q)}
                className="text-[10px] px-2.5 py-1 rounded-lg shrink-0 border whitespace-nowrap opacity-75 hover:opacity-100 transition-opacity"
                style={{ background: colors.glassFillStrong, borderColor: colors.glassBorder, color: colors.text }}
              >
                {q}
              </button>
            ))}
          </div>

          {/* Text Input */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="flex items-center gap-2"
          >
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ketik perintah (mis. ubah target AGM jadi 250jt)..."
              disabled={busy}
              className="flex-1 px-3.5 py-2 rounded-xl text-xs outline-none"
              style={{
                background: colors.dropdownBg || "#0F172A",
                border: `1px solid ${colors.glassBorder}`,
                color: colors.text,
              }}
            />
            <button
              type="submit"
              disabled={!input.trim() || busy}
              className="sm-btn w-9 h-9 rounded-xl flex items-center justify-center shrink-0 font-bold text-white disabled:opacity-30"
              style={{ background: colors.mint || "#10B981" }}
              title="Kirim (Enter)"
              aria-label="Kirim"
            >
              <Send size={14} />
            </button>
          </form>
        </div>
      </div>
    </div>,
    document.body
  );
}
