import { useState, useMemo, useRef, useEffect } from "react";
import { Plus, Trash2, CalendarRange, ChevronDown } from "lucide-react";
import { getDatePresetOptions, resolveDatePreset, getDatePresetLabel } from "../../utils/datePresets.js";
import { periodLabel } from "../../utils/comparison.js";

/* ============================================================================
   PERIODPICKER
   Pilih periode yang dibandingkan di tab Perbandingan:
   1. Periode default = bulan kalender di dalam rentang filter global aktif
      (chip toggle, dihitung dari detectMonths + clamp ke rentang global).
   2. Periode TAMBAHAN (ke-2 dst.) — bisa dibuat dari:
      a. Dropdown preset rentang — SAMA seperti preset tanggal di FilterBar
         global (Semua Data, Bulan Ini, 7/14 Hari Terakhir, Minggu Ini,
         bulan dinamis). Klik 1 preset langsung menambah 1 periode.
      b. Form manual (label + date from/to) untuk rentang parsial bebas.
   Maksimal 8 periode total.
============================================================================ */
export function PeriodPicker({ defaultPeriods, periods, onChange, colors, rawRows }) {
  const [customLabel, setCustomLabel] = useState("");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [presetOpen, setPresetOpen] = useState(false);
  const presetRef = useRef(null);

  const presetOptions = getDatePresetOptions(rawRows);

  // Tutup dropdown preset saat klik di luar — sama seperti FilterBar.
  useEffect(() => {
    if (!presetOpen) return;
    const onClick = (e) => { if (presetRef.current && !presetRef.current.contains(e.target)) setPresetOpen(false); };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [presetOpen]);

  const isDefaultSelected = useMemo(
    () => new Set(periods.filter((p) => !p.isCustom).map((p) => p.id)),
    [periods]
  );

  const toggleDefault = (p) => {
    if (isDefaultSelected.has(p.id)) {
      onChange(periods.filter((x) => x.id !== p.id));
    } else {
      onChange([...periods, p]);
    }
  };

  // Tambah periode dari preset rentang (klik 1 preset = 1 periode baru).
  const addFromPreset = (key) => {
    setPresetOpen(false);
    const resolved = resolveDatePreset(key, rawRows);
    if (!resolved || !resolved.dateFrom || !resolved.dateTo) return;
    const id = `preset:${key}:${resolved.dateFrom}:${resolved.dateTo}`;
    // Cegah duplikat rentang yang sama (mis. preset "Bulan Ini" = bulan dinamis)
    if (periods.some((p) => p.dateFrom === resolved.dateFrom && p.dateTo === resolved.dateTo)) return;
    onChange([...periods, {
      id, label: getDatePresetLabel(key, rawRows), dateFrom: resolved.dateFrom, dateTo: resolved.dateTo, isCustom: true,
    }]);
  };

  const addCustom = () => {
    if (!customFrom || !customTo || customTo < customFrom) return;
    onChange([...periods, { id: `custom:${customFrom}:${customTo}`, label: customLabel.trim() || `${customFrom} s/d ${customTo}`, dateFrom: customFrom, dateTo: customTo, isCustom: true }]);
    setCustomLabel(""); setCustomFrom(""); setCustomTo("");
  };

  const removeCustom = (id) => onChange(periods.filter((p) => p.id !== id));

  const isFull = periods.length >= 8;

  return (
    // z-30 saat dropdown terbuka: .sm-card punya will-change:transform (stacking
    // context sendiri) — tanpa z-index naik, dropdown z-40 di dalamnya tetap
    // tertutup elemen di bawahnya (KPI card dll) karena mereka punya stacking
    // context sendiri juga dan DOM-nya datang lebih akhir.
    <div className="sm-card p-4" style={{ position: "relative", zIndex: presetOpen ? 30 : 1 }}>
      {/* Periode default (bulan di rentang filter global aktif) */}
      <div className="text-xs uppercase tracking-wider font-semibold mb-2" style={{ color: colors.textMuted }}>
        Periode ({periods.length}/8)
      </div>
      {defaultPeriods.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {defaultPeriods.map((p) => {
            const on = isDefaultSelected.has(p.id);
            return (
              <button key={p.id} onClick={() => (isFull && !on) ? null : toggleDefault(p)}
                disabled={isFull && !on}
                className="sm-btn px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-40 transition-colors"
                style={{
                  background: on ? colors.mint + "22" : colors.glassFill,
                  border: `1px solid ${on ? colors.mint + "66" : colors.glassBorder}`,
                  color: on ? colors.mint : colors.text,
                }}>
                {p.label}
              </button>
            );
          })}
        </div>
      )}
      {defaultPeriods.length === 0 && (
        <p className="text-xs mb-3" style={{ color: colors.textMuted }}>
          Tidak ada bulan penuh dalam rentang filter aktif — tambah periode manual di bawah.
        </p>
      )}

      {/* Periode tambahan (dari preset rentang atau manual) */}
      {periods.filter((p) => p.isCustom).map((p) => (
        <div key={p.id} className="flex items-center gap-2 mb-2">
          <CalendarRange size={13} style={{ color: colors.gold }} className="shrink-0" />
          <span className="text-xs font-medium flex-1 truncate" style={{ color: colors.text }}>{p.label}</span>
          <button onClick={() => removeCustom(p.id)} className="sm-btn p-1.5 rounded-lg" style={{ color: colors.coral }}>
            <Trash2 size={12} />
          </button>
        </div>
      ))}

      {/* Tambah periode baru */}
      {!isFull && (
        <div className="mt-3 pt-3" style={{ borderTop: `1px solid ${colors.glassBorder}` }}>
          <div className="text-xs uppercase tracking-wider font-semibold mb-2" style={{ color: colors.textMuted }}>
            Tambah Periode
          </div>

          {/* Dropdown preset rentang — SAMA seperti preset tanggal di FilterBar */}
          <div className="relative mb-2" ref={presetRef}>
            <button onClick={() => setPresetOpen((o) => !o)}
              className="sm-btn flex items-center gap-2 px-3 py-2 rounded-xl text-sm w-full"
              style={{ background: colors.glassFill, border: `1px solid ${colors.glassBorder}`, color: colors.text }}>
              <CalendarRange size={14} style={{ color: colors.gold }} className="shrink-0" />
              <span className="flex-1 text-left truncate">Pilih rentang cepat...</span>
              <ChevronDown size={13} style={{ color: colors.textMuted, transform: presetOpen ? "rotate(180deg)" : "none", transition: "transform .2s" }} className="shrink-0" />
            </button>
            {presetOpen && (
              <div className="absolute left-0 right-0 z-40 mt-2 rounded-xl overflow-hidden sm-fadein"
                style={{ background: colors.modalBg, backdropFilter: "blur(32px)", WebkitBackdropFilter: "blur(32px)", border: `1px solid ${colors.modalBorder}`, boxShadow: colors.glassShadow }}>
                {presetOptions.map((p) => (
                  <button key={p.key} onClick={() => addFromPreset(p.key)}
                    className="sm-row w-full text-left px-3.5 py-2.5 text-sm"
                    style={{ color: colors.text }}>
                    {p.label}
                  </button>
                ))}
              </div>
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

export { periodLabel };
