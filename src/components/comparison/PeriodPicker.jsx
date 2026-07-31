import { useState, useMemo } from "react";
import { Plus, Trash2, CalendarRange, Globe } from "lucide-react";
import { getDatePresetOptions, resolveDatePreset, getDatePresetLabel } from "../../utils/datePresets.js";
import { periodLabel } from "../../utils/comparison.js";

/* ============================================================================
   PERIODPICKER
   Pilih periode yang dibandingkan di tab Perbandingan. Tiga lapisan:
   1. Preset cepat rentang tanggal (sama seperti FilterBar global): Ikut
      Filter Global / Semua Data / Bulan Ini / 7-14 Hari / Minggu Ini /
      bulan dinamis / Custom — memengaruhi bulan-bulan default di bawahnya.
   2. Periode default = bulan kalender di dalam rentang aktif (chip).
   3. Sub-rentang kustom (tambah manual, maks 8 periode total).
============================================================================ */
export function PeriodPicker({ defaultPeriods, periods, onChange, dateMode, localDateFrom, localDateTo, onDateRangeChange, rawRows, colors }) {
  const [customLabel, setCustomLabel] = useState("");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  const presetOptions = getDatePresetOptions(rawRows);

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

  // ---- Preset cepat rentang tanggal ----
  const pickPreset = (key) => {
    if (key === "global") { onDateRangeChange({ mode: "global", dateFrom: "", dateTo: "" }); return; }
    if (key === "custom") { onDateRangeChange({ mode: "custom", dateFrom: "", dateTo: "" }); return; }
    const resolved = resolveDatePreset(key, rawRows);
    onDateRangeChange({ mode: key, dateFrom: resolved?.dateFrom || "", dateTo: resolved?.dateTo || "" });
  };

  const PresetChip = ({ label, active, onClick, icon: Icon }) => (
    <button onClick={onClick}
      className="sm-btn px-2.5 py-1 rounded-lg text-[11px] font-semibold inline-flex items-center gap-1 transition-colors"
      style={{
        background: active ? colors.gold + "22" : colors.glassFill,
        border: `1px solid ${active ? colors.gold + "66" : colors.glassBorder}`,
        color: active ? colors.gold : colors.textMuted,
      }}>
      {Icon && <Icon size={11} />} {label}
    </button>
  );

  return (
    <div className="sm-card p-4">
      {/* Preset cepat rentang tanggal — sama seperti FilterBar global */}
      <div className="text-xs uppercase tracking-wider font-semibold mb-2" style={{ color: colors.textMuted }}>
        Rentang Tanggal
      </div>
      <div className="flex flex-wrap gap-1.5 mb-3">
        <PresetChip label="Ikut Filter Global" icon={Globe} active={dateMode === "global"} onClick={() => pickPreset("global")} />
        {presetOptions.map((p) => (
          <PresetChip key={p.key} label={p.label} active={dateMode === p.key} onClick={() => pickPreset(p.key)} />
        ))}
        <PresetChip label="Custom..." active={dateMode === "custom"} onClick={() => pickPreset("custom")} />
      </div>

      {/* Rentang custom: date picker manual */}
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
