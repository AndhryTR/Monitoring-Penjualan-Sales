import { useState } from "react";
import { createPortal } from "react-dom";
import { Plus, Trash2, CalendarRange, ChevronDown } from "lucide-react";
import { getDatePresetOptions, resolveDatePreset, getDatePresetLabel } from "../../utils/datePresets.js";
import { MAX_PERIODS } from "../../constants/thresholds.js";
import { useFloatingDropdown } from "../../hooks/useFloatingDropdown.js";

/* ============================================================================
   PERIODPICKER
   Pilih periode yang dibandingkan di tab Perbandingan. Semua periode 100%
   pilihan user (TIDAK otomatis mengikuti rentang filter global):
   1. Dropdown preset rentang — SAMA seperti preset tanggal di FilterBar
      global (Semua Data, Bulan Ini, 7/14 Hari Terakhir, Minggu Ini,
      bulan dinamis). Klik 1 preset langsung menambah 1 periode.
   2. Form manual (label + date from/to) untuk rentang parsial bebas.
   Maksimal 8 periode total.

   Dropdown preset dirender lewat PORTAL ke <body> (bukan absolute di dalam
   card): .sm-card punya backdrop-filter sendiri, dan elemen ber-backdrop-filter
   jadi "backdrop root" — backdrop-filter anak di dalamnya TIDAK bisa memblur
   elemen di luar card, jadi modalBg transparan bocor tembus (terlihat tidak
   blur). Portal keluar memecah backdrop root → blur(32px) bekerja sama seperti
   dropdown di FilterBar.
============================================================================ */
export function PeriodPicker({ periods, onChange, colors, rawRows }) {
  const [customLabel, setCustomLabel] = useState("");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [presetOpen, setPresetOpen] = useState(false);

  const {
    triggerRef: presetRef,
    floatingRef: dropdownRef,
    position: presetPos,
  } = useFloatingDropdown({
    isOpen: presetOpen,
    onClose: () => setPresetOpen(false),
    width: "match-trigger",
    estimatedHeight: 300,
    gap: 8,
  });

  const presetOptions = getDatePresetOptions(rawRows);

  // Tambah periode dari preset rentang (klik 1 preset = 1 periode baru).
  const addFromPreset = (key) => {
    setPresetOpen(false);
    const resolved = resolveDatePreset(key, rawRows);
    if (!resolved || !resolved.dateFrom || !resolved.dateTo) return;
    const id = `preset:${key}:${resolved.dateFrom}:${resolved.dateTo}`;
    // Cegah duplikat rentang yang sama (mis. preset "Bulan Ini" = bulan dinamis)
    if (periods.some((p) => p.dateFrom === resolved.dateFrom && p.dateTo === resolved.dateTo)) return;
    onChange([...periods, {
      id, label: getDatePresetLabel(key, rawRows), dateFrom: resolved.dateFrom, dateTo: resolved.dateTo,
    }]);
  };

  const addCustom = () => {
    if (!customFrom || !customTo || customTo < customFrom) return;
    // Cegah duplikat rentang yang sama — sama seperti guard di addFromPreset.
    if (periods.some((p) => p.dateFrom === customFrom && p.dateTo === customTo)) return;
    onChange([...periods, { id: `custom:${customFrom}:${customTo}`, label: customLabel.trim() || `${customFrom} s/d ${customTo}`, dateFrom: customFrom, dateTo: customTo }]);
    setCustomLabel(""); setCustomFrom(""); setCustomTo("");
  };

  const removePeriod = (id) => onChange(periods.filter((p) => p.id !== id));

  // ⚠️ Sprint 5 / S1: batas MAX_PERIODS dari constants (sebelumnya magic 8).
  const isFull = periods.length >= MAX_PERIODS;

  return (
    // z-30 saat dropdown terbuka: .sm-card punya will-change:transform (stacking
    // context sendiri) — tanpa z-index naik, dropdown z-40 di dalamnya tetap
    // tertutup elemen di bawahnya (KPI card dll) karena mereka punya stacking
    // context sendiri juga dan DOM-nya datang lebih akhir.
    <div className="sm-card p-4" style={{ position: "relative", zIndex: presetOpen ? 30 : 1 }}>
      <div className="text-xs uppercase tracking-wider font-semibold mb-2" style={{ color: colors.textMuted }}>
        Periode ({periods.length}/8)
      </div>

      {/* Periode terpilih — semua berasal dari preset cepat atau form manual */}
      {periods.length === 0 ? (
        <p className="text-xs mb-3" style={{ color: colors.textMuted }}>
          Belum ada periode — tambah minimal 2 periode untuk membandingkan.
        </p>
      ) : (
        periods.map((p) => (
          <div key={p.id} className="flex items-center gap-2 mb-2">
            <CalendarRange size={13} style={{ color: colors.gold }} className="shrink-0" />
            <span className="text-xs font-medium flex-1 truncate" style={{ color: colors.text }}>{p.label}</span>
            <button onClick={() => removePeriod(p.id)} className="sm-btn p-1.5 rounded-lg" style={{ color: colors.coral }}>
              <Trash2 size={12} />
            </button>
          </div>
        ))
      )}

      {/* Tambah periode baru */}
      {!isFull && (
        <div className="mt-3 pt-3" style={{ borderTop: `1px solid ${colors.glassBorder}` }}>
          <div className="text-xs uppercase tracking-wider font-semibold mb-2" style={{ color: colors.textMuted }}>
            Tambah Periode
          </div>

          {/* Dropdown preset rentang — SAMA seperti preset tanggal di FilterBar.
              Portal ke body: .sm-card punya backdrop-filter sendiri (backdrop
              root) yang membuat modalBg transparan bocor tembus kalau dropdown
              dirender absolute di dalam card. */}
          <div className="relative mb-2" ref={presetRef}>
            <button onClick={() => setPresetOpen((o) => !o)}
              className="sm-btn flex items-center gap-2 px-3 py-2 rounded-xl text-sm w-full"
              style={{ background: colors.glassFill, border: `1px solid ${colors.glassBorder}`, color: colors.text }}>
              <CalendarRange size={14} style={{ color: colors.gold }} className="shrink-0" />
              <span className="flex-1 text-left truncate">Pilih rentang cepat...</span>
              <ChevronDown size={13} style={{ color: colors.textMuted, transform: presetOpen ? "rotate(180deg)" : "none", transition: "transform .2s" }} className="shrink-0" />
            </button>
            {presetOpen && presetPos && createPortal(
              <div ref={dropdownRef} className="sm-fadein rounded-xl overflow-y-auto"
                style={{
                  position: "fixed", top: presetPos.top, left: presetPos.left, width: presetPos.width,
                  maxHeight: 320,
                  zIndex: 9999,
                  background: colors.modalBg, backdropFilter: "blur(32px)", WebkitBackdropFilter: "blur(32px)",
                  border: `1px solid ${colors.modalBorder}`, boxShadow: colors.glassShadow,
                }}>
                {presetOptions.map((p) => (
                  <button key={p.key} onClick={() => addFromPreset(p.key)}
                    className="sm-row w-full text-left px-3.5 py-2.5 text-sm"
                    style={{ color: colors.text }}>
                    {p.label}
                  </button>
                ))}
              </div>,
              document.body
            )}
          </div>

          {/* Form manual untuk rentang parsial bebas */}
          <div className="flex flex-wrap items-center gap-2">
            <input value={customLabel} onChange={(e) => setCustomLabel(e.target.value)} placeholder="Label (opsional)"
              className="px-2.5 py-1.5 rounded-lg text-xs w-28" style={{ background: colors.glassFill, border: `1px solid ${colors.glassBorder}`, color: colors.text }} />
            <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)}
              className="px-2.5 py-1.5 rounded-lg text-xs mono" style={{ background: colors.glassFill, border: `1px solid ${colors.glassBorder}`, color: colors.text, colorScheme: colors.colorScheme }} />
            <span className="text-xs" style={{ color: colors.textMuted }}>s/d</span>
            <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)}
              className="px-2.5 py-1.5 rounded-lg text-xs mono" style={{ background: colors.glassFill, border: `1px solid ${colors.glassBorder}`, color: colors.text, colorScheme: colors.colorScheme }} />
            <button onClick={addCustom} disabled={!customFrom || !customTo || customTo < customFrom}
              className="sm-btn inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-40"
              style={{ background: colors.gold + "22", border: `1px solid ${colors.gold}55`, color: colors.gold }}>
              <Plus size={12} /> Tambah
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
