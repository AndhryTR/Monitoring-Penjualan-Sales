import { useState, useMemo, useEffect } from "react";
import { CalendarDays, X, Download, AlertTriangle, Info } from "lucide-react";
import { fmtNum } from "../../utils/formatters.js";
import { computeVisitPattern } from "../../utils/visitPattern.js";
import { exportVisitPatternExcel } from "../../utils/visitPatternExport.js";
import { getLatestDataDate, addDays } from "../../utils/datePresets.js";

/* ============================================================================
   VISIT PATTERN MODAL — "Pola Kunjungan Historis"
   Direkonstruksi dari HARI TRANSAKSI per sales+outlet (bukan data check-in
   sungguhan — lihat disclaimer di utils/visitPattern.js). Rentang tanggal di
   sini SENGAJA independen dari filter tanggal global aplikasi, karena pola
   kunjungan perlu jendela waktu lebih panjang supaya bermakna.
============================================================================ */
export function VisitPatternModal({ isOpen, onClose, rawRows, targets, colors, depotName }) {
  const latestDate = useMemo(() => getLatestDataDate(rawRows), [rawRows]);
  const [salesCode, setSalesCode] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // Default rentang: 60 hari terakhir DI DALAM DATA (bukan Date.now() browser),
  // dan default sales = kosong (user harus pilih dulu — hindari heatmap raksasa
  // "semua sales sekaligus" yang berat & sulit dibaca).
  useEffect(() => {
    if (isOpen && latestDate) {
      setDateTo(latestDate);
      setDateFrom(addDays(latestDate, -59) || latestDate);
      setSalesCode("");
    }
  }, [isOpen, latestDate]);

  const pattern = useMemo(() => {
    if (!salesCode || !dateFrom || !dateTo) return null;
    return computeVisitPattern(rawRows, salesCode, dateFrom, dateTo);
  }, [rawRows, salesCode, dateFrom, dateTo]);

  if (!isOpen) return null;
  const salesName = targets.find((t) => t.code === salesCode)?.name || "";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm sm-fadein">
      <div className="sm-card sm-modal-glass sm-scale-in w-full max-w-4xl max-h-[88vh] flex flex-col">
        <div className="p-5 flex items-center justify-between" style={{ borderBottom: `1px solid ${colors.glassBorder}` }}>
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-2 rounded-xl shrink-0" style={{ background: colors.violet + "1A" }}><CalendarDays size={16} style={{ color: colors.violet }} /></div>
            <div className="min-w-0">
              <div className="disp text-base font-semibold truncate">Pola Kunjungan Historis</div>
              <div className="text-xs" style={{ color: colors.textMuted }}>Direkonstruksi dari hari transaksi</div>
            </div>
          </div>
          <button onClick={onClose} className="sm-btn p-2 rounded-full shrink-0" style={{ background: colors.glassFill }}><X size={16} /></button>
        </div>

        {/* Disclaimer — selalu tampil, bukan cuma sekali */}
        <div className="mx-5 mt-4 sm-card p-3 flex items-start gap-2.5" style={{ background: colors.gold + "0D", border: `1px solid ${colors.gold}33` }}>
          <Info size={14} style={{ color: colors.gold, flexShrink: 0, marginTop: 2 }} />
          <p className="text-xs" style={{ color: colors.text }}>
            "Kunjungan" di sini = hari dengan transaksi. Kunjungan tanpa order (tidak menghasilkan penjualan) <b>tidak</b> akan
            terekam di sini — gunakan sebagai titik awal investigasi, bukan bukti tunggal evaluasi kedisiplinan sales.
          </p>
        </div>

        {/* Kontrol: pilih sales + rentang tanggal (independen dari filter global) */}
        <div className="p-5 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs mb-1.5" style={{ color: colors.textMuted }}>Sales</label>
            <select value={salesCode} onChange={(e) => setSalesCode(e.target.value)}
              className="w-full px-3 py-2 rounded-lg text-sm" style={{ background: colors.glassFill, border: `1px solid ${colors.glassBorder}`, color: colors.text, colorScheme: colors.colorScheme }}>
              <option value="">Pilih sales...</option>
              {targets.map((t) => <option key={t.code} value={t.code}>{t.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs mb-1.5" style={{ color: colors.textMuted }}>Dari Tanggal</label>
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
              className="w-full px-3 py-2 rounded-lg text-sm mono" style={{ background: colors.glassFill, border: `1px solid ${colors.glassBorder}`, color: colors.text, colorScheme: colors.colorScheme }} />
          </div>
          <div>
            <label className="block text-xs mb-1.5" style={{ color: colors.textMuted }}>Sampai Tanggal</label>
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
              className="w-full px-3 py-2 rounded-lg text-sm mono" style={{ background: colors.glassFill, border: `1px solid ${colors.glassBorder}`, color: colors.text, colorScheme: colors.colorScheme }} />
          </div>
        </div>

        <div className="px-5 pb-5 overflow-y-auto flex-1">
          {!salesCode ? (
            <div className="sm-card p-12 text-center">
              <p className="text-sm" style={{ color: colors.textMuted }}>Pilih sales terlebih dahulu untuk melihat pola kunjungannya.</p>
            </div>
          ) : !pattern || pattern.totalOutlets === 0 ? (
            <div className="sm-card p-12 text-center">
              <p className="text-sm" style={{ color: colors.textMuted }}>Tidak ada transaksi untuk sales ini di rentang tanggal yang dipilih.</p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                <div className="flex items-center gap-3 text-xs" style={{ color: colors.textMuted }}>
                  <span>{fmtNum(pattern.totalOutlets)} outlet</span>
                  {pattern.overdueCount > 0 && (
                    <span className="inline-flex items-center gap-1 font-semibold" style={{ color: colors.coral }}>
                      <AlertTriangle size={12} /> {fmtNum(pattern.overdueCount)} melewati pola kunjungan biasanya
                    </span>
                  )}
                </div>
                <button onClick={() => exportVisitPatternExcel(pattern, salesName, depotName)}
                  className="sm-btn inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
                  style={{ background: colors.glassFill, border: `1px solid ${colors.glassBorder}`, color: colors.text }}>
                  <Download size={13} /> Export Excel
                </button>
              </div>

              {/* Desktop: heatmap kalender hari x outlet */}
              <div className="hidden md:block overflow-x-auto">
                <VisitHeatmap pattern={pattern} colors={colors} />
              </div>

              {/* Mobile: daftar per outlet (grid kalender terlalu padat untuk layar kecil) */}
              <div className="md:hidden flex flex-col gap-2">
                {pattern.outlets.map((o) => (
                  <VisitOutletRow key={o.outletCode} outlet={o} colors={colors} />
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function VisitOutletRow({ outlet: o, colors }) {
  const accent = o.isOverdue ? colors.coral : o.hasEnoughData ? colors.mint : colors.textMuted;
  return (
    <div className="sm-card p-3.5" style={{ borderLeft: `3px solid ${accent}` }}>
      <div className="flex items-center justify-between gap-2 mb-1">
        <span className="text-sm font-semibold truncate">{o.outletName}</span>
        {o.isOverdue && <AlertTriangle size={13} style={{ color: colors.coral, flexShrink: 0 }} />}
      </div>
      <div className="flex items-center gap-3 text-xs mono" style={{ color: colors.textMuted }}>
        <span>{o.totalVisits}× kunjungan</span>
        <span>Terakhir: {o.lastVisit}</span>
        <span>{o.daysSinceLastVisit}h lalu</span>
      </div>
      {o.hasEnoughData && (
        <div className="text-xs mt-1" style={{ color: accent }}>
          Rata² tiap {Math.round(o.avgIntervalDays)} hari — {o.isOverdue ? "sudah lewat dari biasanya" : "masih dalam pola normal"}
        </div>
      )}
    </div>
  );
}

function VisitHeatmap({ pattern, colors }) {
  const dates = useMemo(() => {
    const out = [];
    const cur = new Date(pattern.dateFrom + "T00:00:00");
    const end = new Date(pattern.dateTo + "T00:00:00");
    while (cur <= end) {
      const y = cur.getFullYear(), m = String(cur.getMonth() + 1).padStart(2, "0"), d = String(cur.getDate()).padStart(2, "0");
      out.push(`${y}-${m}-${d}`);
      cur.setDate(cur.getDate() + 1);
    }
    return out;
  }, [pattern.dateFrom, pattern.dateTo]);

  return (
    <table className="text-xs border-separate" style={{ borderSpacing: 2 }}>
      <thead>
        <tr>
          <th className="text-left px-2 py-1 sticky left-0 z-10" style={{ background: colors.modalPanelBg, color: colors.tableHeader, minWidth: 160 }}>Outlet</th>
          {dates.map((d) => (
            <th key={d} className="px-0.5 py-1 font-normal" style={{ color: colors.textMuted, fontSize: 9, writingMode: "vertical-rl", minWidth: 16 }}>
              {d.slice(8, 10)}/{d.slice(5, 7)}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {pattern.outlets.map((o) => {
          const dateSet = new Set(o.visitDates);
          const accent = o.isOverdue ? colors.coral : colors.mint;
          return (
            <tr key={o.outletCode}>
              <td className="px-2 py-1 sticky left-0 z-10 truncate" style={{ background: colors.modalPanelBg, maxWidth: 180 }}>
                <span className="truncate block">{o.outletName}</span>
              </td>
              {dates.map((d) => (
                <td key={d} className="text-center rounded" style={{
                  width: 16, height: 20,
                  background: dateSet.has(d) ? accent + "CC" : colors.glassSubtle,
                }} title={d} />
              ))}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
