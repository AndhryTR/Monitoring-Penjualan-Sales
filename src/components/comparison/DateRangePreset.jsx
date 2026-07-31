import { useState, useEffect, useRef } from "react";
import { CalendarDays, ChevronDown, Globe } from "lucide-react";
import { getDatePresetOptions, resolveDatePreset, getDatePresetLabel } from "../../utils/datePresets.js";

/* ============================================================================
   DATERANGEPRESET — pilih rentang tanggal untuk tab Perbandingan.
   Opsi preset cepat SAMA dengan FilterBar global (Semua Data, Bulan Ini,
   7/14 Hari Terakhir, Minggu Ini, bulan dinamis) + opsi "Ikut Filter Global"
   (default — rentang dari filter global) + Custom (date picker manual).

   mode:
     "global"           → pakai filters global (dateFrom/dateTo dari parent)
     presetKey ("all", "thisMonth", "last7", "last14", "thisWeek", "month:x")
                        → resolveDatePreset(key, rawRows)
     "custom"           → dateFrom/dateTo manual user
============================================================================ */
export function DateRangePreset({ mode, dateFrom, dateTo, onChange, rawRows, colors }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const presetOptions = getDatePresetOptions(rawRows);

  useEffect(() => {
    if (!open) return;
    const onClick = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  // Label tombol
  let label = "Ikut Filter Global";
  if (mode === "custom") {
    label = dateFrom && dateTo ? `${dateFrom} s/d ${dateTo}` : "Custom...";
  } else if (mode !== "global") {
    label = getDatePresetLabel(mode, rawRows);
  }

  const pickPreset = (key) => {
    setOpen(false);
    if (key === "global") { onChange({ mode: "global", dateFrom: "", dateTo: "" }); return; }
    if (key === "custom") { onChange({ mode: "custom", dateFrom: dateFrom || "", dateTo: dateTo || "" }); return; }
    const resolved = resolveDatePreset(key, rawRows);
    onChange({ mode: key, dateFrom: resolved?.dateFrom || "", dateTo: resolved?.dateTo || "" });
  };

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen((o) => !o)}
        className="sm-btn flex items-center gap-2 px-3 py-2 rounded-xl text-sm"
        style={{ background: colors.glassFill, border: `1px solid ${mode === "global" ? colors.glassBorder : colors.gold + "66"}`, color: colors.text }}>
        {mode === "global" ? <Globe size={14} style={{ color: colors.textMuted }} /> : <CalendarDays size={14} style={{ color: colors.gold }} />}
        <span className="truncate">{label}</span>
        <ChevronDown size={13} style={{ color: colors.textMuted, transform: open ? "rotate(180deg)" : "none", transition: "transform .2s" }} />
      </button>

      {open && (
        <div className="absolute left-0 z-40 mt-2 w-60 rounded-xl overflow-hidden sm-fadein"
          style={{ background: colors.modalBg, backdropFilter: "blur(32px)", WebkitBackdropFilter: "blur(32px)", border: `1px solid ${colors.modalBorder}`, boxShadow: colors.glassShadow }}>
          <button onClick={() => pickPreset("global")}
            className="sm-row w-full text-left px-3.5 py-2.5 text-sm flex items-center gap-2"
            style={{ color: mode === "global" ? colors.gold : colors.text, fontWeight: mode === "global" ? 600 : 400 }}>
            <Globe size={14} className="shrink-0" style={{ color: mode === "global" ? colors.gold : colors.textMuted }} />
            Ikut Filter Global
          </button>
          <div style={{ borderTop: `1px solid ${colors.glassBorder}` }} />
          {presetOptions.map((p) => (
            <button key={p.key} onClick={() => pickPreset(p.key)}
              className="sm-row w-full text-left px-3.5 py-2.5 text-sm"
              style={{ color: mode === p.key ? colors.gold : colors.text, fontWeight: mode === p.key ? 600 : 400 }}>
              {p.label}
            </button>
          ))}
          <div style={{ borderTop: `1px solid ${colors.glassBorder}` }} />
          <button onClick={() => pickPreset("custom")}
            className="sm-row w-full text-left px-3.5 py-2.5 text-sm"
            style={{ color: mode === "custom" ? colors.gold : colors.text, fontWeight: mode === "custom" ? 600 : 400 }}>
            Custom...
          </button>
        </div>
      )}

      {/* Date picker manual saat mode custom */}
      {mode === "custom" && (
        <div className="flex items-center gap-2 mt-2 px-3 py-2 rounded-xl text-sm" style={{ background: colors.glassFill, border: `1px solid ${colors.glassBorder}` }}>
          <input type="date" value={dateFrom || ""}
            onChange={(e) => onChange({ mode: "custom", dateFrom: e.target.value, dateTo })}
            className="bg-transparent outline-none mono" style={{ color: colors.text, colorScheme: colors.colorScheme }} />
          <span style={{ color: colors.textMuted }}>-</span>
          <input type="date" value={dateTo || ""}
            onChange={(e) => onChange({ mode: "custom", dateFrom, dateTo: e.target.value })}
            className="bg-transparent outline-none mono" style={{ color: colors.text, colorScheme: colors.colorScheme }} />
        </div>
      )}
    </div>
  );
}
