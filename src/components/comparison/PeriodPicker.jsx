import { useMemo, useState } from "react";
import { Plus, Trash2, CalendarRange } from "lucide-react";
import { periodLabel } from "../../utils/comparison.js";

/* ============================================================================
   PERIODPICKER
   Pilih periode yang dibandingkan: default = bulan kalender di dalam rentang
   filter global (otomatis), plus sub-rentang kustom yang ditambah user lewat
   date picker. Maksimal 8 periode.
============================================================================ */
export function PeriodPicker({ defaultPeriods, periods, onChange, colors }) {
  const [customLabel, setCustomLabel] = useState("");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

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
    if (!customFrom || !customTo) return;
    if (customTo < customFrom) return;
    onChange([...periods, { id: `custom:${customFrom}:${customTo}`, label: customLabel.trim() || `${customFrom} s/d ${customTo}`, dateFrom: customFrom, dateTo: customTo, isCustom: true }]);
    setCustomLabel(""); setCustomFrom(""); setCustomTo("");
  };

  const removeCustom = (id) => onChange(periods.filter((p) => p.id !== id));

  const isFull = periods.length >= 8;

  return (
    <div className="sm-card p-4">
      <div className="text-xs uppercase tracking-wider font-semibold mb-2" style={{ color: colors.textMuted }}>
        Periode ({periods.length}/8)
      </div>

      {/* Periode default (bulan di rentang filter) */}
      {defaultPeriods.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {defaultPeriods.map((p) => {
            const on = isDefaultSelected.has(p.id);
            return (
              <button key={p.id} onClick={() => !isFull || on ? toggleDefault(p) : null}
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
          {periods.some((p) => p.isCustom) && (
            <span className="text-[10px]" style={{ color: colors.textMuted }}>Label dipakai di chart & tabel</span>
          )}
        </div>
      )}
    </div>
  );
}

export { periodLabel };
