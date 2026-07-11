import { useState, useEffect } from "react";
import { History, X, Check } from "lucide-react";
import { fmtRp } from "../../utils/formatters.js";
import { MAX_TREND_PERIODS } from "../../constants/thresholds.js";
import { SectionTitle } from "../ui/index.jsx";

/* ============================================================================
   HISTORY MODAL
   Modal riwayat & perbandingan periode — simpan snapshot periode aktif,
   pilih 1 atau lebih snapshot riwayat sebagai pembanding, atau hapus riwayat
   yang tidak diperlukan lagi.

   - Pilih 1 snapshot → bandingkan cepat (PeriodComparisonCard di Main Report)
   - Pilih 2+ snapshot → lihat tren multi-periode (tab "Tren Periode")
   - Maksimal MAX_TREND_PERIODS (5) snapshot sekaligus
============================================================================ */
export function HistoryModal({ isOpen, onClose, history, onSave, onApply, onDelete, defaultLabel, colors }) {
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
