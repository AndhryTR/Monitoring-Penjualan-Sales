import { useState, useMemo, useRef, useEffect } from "react";
import { Plus, Trash2, CalendarRange, Globe, CalendarDays, ChevronDown } from "lucide-react";
import { getDatePresetOptions, resolveDatePreset, getDatePresetLabel } from "../../utils/datePresets.js";
import { periodLabel } from "../../utils/comparison.js";

/* ============================================================================
   PERIODPICKER
   Pilih periode yang dibandingkan di tab Perbandingan. Tiga lapisan:
   1. Rentang tanggal: tombol dropdown preset — SAMA PERSIS seperti preset
      tanggal di FilterBar global (Semua Data, Bulan Ini, 7/14 Hari Terakhir,
      Minggu Ini, bulan dinamis, Custom). Default "Ikut Filter Global".
   2. Periode default = bulan kalender di dalam rentang aktif (chip).
   3. Sub-rentang kustom (tambah manual, maks 8 periode total).
============================================================================ */
export function PeriodPicker({ defaultPeriods, periods, onChange, dateMode, localDateFrom, localDateTo, onDateRangeChange, rawRows, colors }) {
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

  // Label tombol dropdown
  let presetLabel = "Ikut Filter Global";
  if (dateMode === "custom") presetLabel = "Custom...";
  else if (dateMode !== "global") presetLabel = getDatePresetLabel(dateMode, rawRows);

  const pickPreset = (key) => {
    setPresetOpen(false);
    if (key === "global") { onDateRangeChange({ mode: "global", dateFrom: "", dateTo: "" }); return; }
    if (key === "custom") { onDateRangeChange({ mode: "custom", dateFrom: "", dateTo: "" }); return; }
    const resolved = resolveDatePreset(key, rawRows);
    onDateRangeChange({ mode: key, dateFrom: resolved?.dateFrom || "", dateTo: resolved?.dateTo || "" });
  };

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

  const addCustom = () => {
    if (!customFrom || !customTo || customTo < customFrom) return;
    onChange([...periods, { id: `custom:${customFrom}:${customTo}`, label: customLabel.trim() || `${customFrom} s/d ${customTo}`, dateFrom: customFrom, dateTo: customTo, isCustom: true }]);
    setCustomLabel(""); setCustomFrom(""); setCustomTo("");
  };

  const removeCustom = (id) => onChange(periods.filter((p) => p.id !== id));

  const isFull = periods.length >= 8;

  return (
    <div className="sm-card p-4">
      {/* Rentang tanggal: dropdown preset — sama seperti FilterBar global */}
      <div className="text-xs uppercase tracking-wider font-semibold mb-2" style={{ color: colors.textMuted }}>
        Rentang Tanggal
      </div>
      <div className="relative mb-3" ref={presetRef}>
        <button onClick={() => setPresetOpen((o) => !o)}
          className="sm-btn flex items-center gap-2 px-3 py-2 rounded-xl text-sm w-full"
          style={{ background: colors.glassFill, border: `1px solid ${dateMode === "global" ? colors.glassBorder : colors.gold + "66"}`, color: colors.text }}>
          {dateMode === "global" ? <Globe size={14} style={{ color: colors.textMuted }} className="shrink-0" /> : <CalendarDays size={14} style={{ color: colors.gold }} className="shrink-0" />}
          <span className="flex-1 text-left truncate">{presetLabel}</span>
          <ChevronDown size={13} style={{ color: colors.textMuted, transform: presetOpen ? "rotate(180deg)" : "none", transition: "transform .2s" }} className="shrink-0" />
        </button>
        {presetOpen && (
          <div className="absolute left-0 right-0 z-40 mt-2 rounded-xl overflow-hidden sm-fadein"
            style={{ background: colors.modalBg, backdropFilter: "blur(32px)", WebkitBackdropFilter: "blur(32px)", border: `1px solid ${colors.modalBorder}`, boxShadow: colors.glassShadow }}>
            <button onClick={() => pickPreset("global")}
              className="sm-row w-full text-left px-3.5 py-2.5 text-sm flex items-center gap-2"
              style={{ color: dateMode === "global" ? colors.gold : colors.text, fontWeight: dateMode === "global" ? 600 : 400 }}>
              <Globe size={14} className="shrink-0" style={{ color: dateMode === "global" ? colors.gold : colors.textMuted }} />
              Ikut Filter Global
            </button>
            <div style={{ borderTop: `1px solid ${colors.glassBorder}` }} />
            {presetOptions.map((p) => (
              <button key={p.key} onClick={() => pickPreset(p.key)}
                className="sm-row w-full text-left px-3.5 py-2.5 text-sm"
                style={{ color: dateMode === p.key ? colors.gold : colors.text, fontWeight: dateMode === p.key ? 600 : 400 }}>
                {p.label}
              </button>
            ))}
            <div style={{ borderTop: `1px solid ${colors.glassBorder}` }} />
            <button onClick={() => pickPreset("custom")}
              className="sm-row w-full text-left px-3.5 py-2.5 text-sm"
              style={{ color: dateMode === "custom" ? colors.gold : colors.text, fontWeight: dateMode === "custom" ? 600 : 400 }}>
              Custom...
            </button>
          </div>
        )}
      </div>

      {/* Rentang custom: date picker manual inline — sama seperti FilterBar */}
      {dateMode === "custom" && (
        <div className="flex items-center gap-2 mb-3 px-3 py-2 rounded-xl text-sm" style={{ background: colors.glassFill, border: `1px solid ${colors.glassBorder}` }}>
          <input type="date" value={localDateFrom || ""} onChange={(e) => onDateRangeChange({ mode: "custom", dateFrom: e.target.value, dateTo: localDateTo })}
            className="bg-transparent outline-none mono" style={{ color: colors.text, colorScheme: colors.colorScheme }} />
          <span style={{ color: colors.textMuted }}>-</span>
          <input type="date" value={localDateTo || ""} onChange={(e) => onDateRangeChange({ mode: "custom", dateFrom: localDateFrom, dateTo: e.target.value })}
            className="bg-transparent outline-none mono" style={{ color: colors.text, colorScheme: colors.colorScheme }} />
        </div>
      )}

      <div className="border-t mb-3" style={{ borderColor: colors.glassBorder }} />

      {/* Periode default (bulan di rentang aktif) */}
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
          Tidak ada bulan penuh dalam rentang aktif — gunakan Custom untuk menambah periode manual.
        </p>
      )}

      {/* Sub-rentang kustom */}
      {periods.filter((p) => p.isCustom).map((p) => (
        <div key={p.id} className="flex items-center gap-2 mb-2">
          <CalendarRange size={13} style={{ color: colors.gold }} className="shrink-0" />
          <span className="text-xs font-medium flex-1 truncate" style={{ color: colors.text }}>{p.label}</span>
          <button onClick={() => removeCustom(p.id)} className="sm-btn p-1.5 rounded-lg" style={{ color: colors.coral }}>
            <Trash2 size={12} />
          </button>
        </div>
      ))}

      {/* Form tambah kustom */}
      {!isFull && (
        <div className="flex flex-wrap items-center gap-2 mt-1">
          <input value={customLabel} onChange={(e) => setCustomLabel(e.target.value)} placeholder="Label (opsional)"
            className="px-2.5 py-1.5 rounded-lg text-xs w-32" style={{ background: colors.glassFill, border: `1px solid ${colors.glassBorder}`, color: colors.text }} />
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
      )}
    </div>
  );
}

export { periodLabel };
