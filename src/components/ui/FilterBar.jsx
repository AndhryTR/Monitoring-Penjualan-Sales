import { useState, useMemo, useEffect } from "react";
import { createPortal } from "react-dom";
import { Users, Package, CalendarDays, RefreshCw, Filter, X, ChevronDown } from "lucide-react";
import { MultiSelect } from "./MultiSelect.jsx";
import { getDatePresetOptions, resolveDatePreset, getDatePresetLabel } from "../../utils/datePresets.js";
import { useFloatingDropdown } from "../../hooks/useFloatingDropdown.js";

/* ============================================================================
   FILTERBAR
   Bar filter untuk Sales, Grup Barang, dan rentang tanggal. Di desktop tampil
   inline (flex-wrap), di mobile tampil sebagai bottom-sheet yang dipicu tombol
   "Filter" dengan badge jumlah filter aktif.
============================================================================ */
export function FilterBar({ salesOptions, groupOptions, filters, setFilters, colors, theme, rawRows }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [dateMenuOpen, setDateMenuOpen] = useState(false);

  const {
    triggerRef: dateMenuTriggerRef,
    floatingRef: dateMenuRef,
    position: dateMenuPos,
  } = useFloatingDropdown({
    isOpen: dateMenuOpen,
    onClose: () => setDateMenuOpen(false),
    minWidth: 208, // w-52 = 13rem = 208px
    estimatedHeight: 300,
  });

  const hasActiveDate = Boolean((filters.datePreset && filters.datePreset !== "all") || filters.dateFrom || filters.dateTo);
  const active = filters.salesCodes.length + filters.groups.length + (hasActiveDate ? 1 : 0);
  const nameToCode = useMemo(() => Object.fromEntries(salesOptions.map((s) => [s.name, s.code])), [salesOptions]);
  const codeToName = useMemo(() => Object.fromEntries(salesOptions.map(s => [s.code, s.name])), [salesOptions]);
  const selectedNames = useMemo(() => filters.salesCodes.map(code => codeToName[code]).filter(Boolean), [filters.salesCodes, codeToName]);

  const handleRemoveSales = (code) => {
    setFilters((f) => ({ ...f, salesCodes: f.salesCodes.filter((c) => c !== code) }));
  };

  const handleRemoveGroup = (groupName) => {
    setFilters((f) => ({ ...f, groups: f.groups.filter((g) => g !== groupName) }));
  };

  const handleRemoveDate = () => {
    setFilters((f) => ({ ...f, datePreset: "all", dateFrom: "", dateTo: "" }));
  };

  const handleResetAll = () => {
    setFilters({ salesCodes: [], groups: [], dateFrom: "", dateTo: "", datePreset: "all" });
  };

  // Preset tanggal aktif — fallback aman untuk filters lama (dari sebelum fitur
  // ini ada) yang belum punya field datePreset: kalau dateFrom/dateTo terisi
  // manual, anggap "custom"; kalau kosong, anggap "all".
  const datePreset = filters.datePreset || (filters.dateFrom || filters.dateTo ? "custom" : "all");
  const presetOptions = useMemo(() => getDatePresetOptions(rawRows), [rawRows]);
  const presetLabel = getDatePresetLabel(datePreset, rawRows);

  // Preset dinamis (bukan "custom"/"all" statis dgn tanggal kosong) dihitung
  // ulang tiap kali rawRows berubah (mis. upload data baru) supaya "7 Hari
  // Terakhir" dkk selalu relatif ke tanggal terbaru yang SEKARANG ada di data.
  useEffect(() => {
    if (datePreset === "custom") return;
    const resolved = resolveDatePreset(datePreset, rawRows);
    if (!resolved) return;
    if (resolved.dateFrom !== filters.dateFrom || resolved.dateTo !== filters.dateTo) {
      setFilters((f) => ({ ...f, dateFrom: resolved.dateFrom, dateTo: resolved.dateTo, datePreset }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rawRows, datePreset]);

  const handlePickPreset = (key) => {
    setDateMenuOpen(false);
    if (key === "custom") {
      setFilters((f) => ({ ...f, datePreset: "custom" }));
      return;
    }
    const resolved = resolveDatePreset(key, rawRows);
    // ⚠️ Bug fix (Sprint 3 / P3): sebelumnya tidak null-check `resolved`. Bila
    // rawRows kosong atau preset tidak dikenali, resolveDatePreset return null
    // → `resolved.dateFrom` throw TypeError. FilterBar global → crash blocking
    // seluruh app saat user pilih preset sebelum data ter-upload.
    if (!resolved) return;
    setFilters((f) => ({ ...f, dateFrom: resolved.dateFrom, dateTo: resolved.dateTo, datePreset: key }));
  };

  const handleSalesChange = (selectedNames) => {
    const selectedCodes = selectedNames.map(name => nameToCode[name]);
    setFilters(f => ({ ...f, salesCodes: selectedCodes }));
  };

  // Tutup bottom-sheet mobile saat Escape supaya konsisten dengan pola modal lain.
  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e) => { if (e.key === "Escape") setMobileOpen(false); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [mobileOpen]);

  // Perbaikan bug lama: colorScheme hardcode "dark" bikin date picker tetap dark
  // walau tema light aktif. Sekarang dinamis mengikuti tema aktif.
  const colorScheme = theme === "light" ? "light" : "dark";

  // Konten filter yang dipakai bersama oleh tampilan desktop (inline) dan mobile (sheet).
  // Urutan & behavior identik — beda hanya wadahnya.
  const filterContent = (
    <>
      <MultiSelect
        label="Sales"
        icon={Users}
        options={salesOptions.map(s => s.name)}
        selected={selectedNames}
        onChange={handleSalesChange}
        colors={colors}
        placeholder="Cari sales..."
      />
      <MultiSelect label="Grup Barang" icon={Package} options={groupOptions} selected={filters.groups}
        onChange={(v) => setFilters((f) => ({ ...f, groups: v }))} placeholder="Cari grup..." colors={colors} />
      <div className="relative" ref={dateMenuTriggerRef}>
        <button
          onClick={() => setDateMenuOpen((o) => !o)}
          aria-haspopup="listbox"
          aria-expanded={dateMenuOpen}
          aria-label="Filter periode tanggal"
          className="sm-btn flex items-center gap-2 px-3 py-2 rounded-xl text-sm"
          style={{ background: colors.glassFill, border: `1px solid ${colors.glassBorder}`, color: colors.text }}>
          <CalendarDays size={14} style={{ color: colors.textMuted }} />
          <span>{presetLabel}</span>
          <ChevronDown size={13} style={{ color: colors.textMuted, transform: dateMenuOpen ? "rotate(180deg)" : "none", transition: "transform .2s" }} />
        </button>
        {dateMenuOpen && createPortal(
          <div
            ref={dateMenuRef}
            role="listbox"
            aria-label="Periode tanggal"
            className="sm-fadein fixed z-[60] w-52 rounded-xl"
            style={{
              top: dateMenuPos.top,
              left: dateMenuPos.left,
              color: colors.text,
              background: `radial-gradient(120% 60% at 15% -5%, ${colors.glassSheen || "rgba(255,255,255,0.10)"}, transparent 55%), ${colors.dropdownBg}`,
              backdropFilter: "blur(32px) saturate(1.4)",
              WebkitBackdropFilter: "blur(32px) saturate(1.4)",
              border: `1px solid ${colors.dropdownBorder}`,
              boxShadow: `${colors.glassShadow}, inset 0 1px 0 ${colors.glassHighlight || "rgba(255,255,255,0.08)"}`,
              maxHeight: "60vh",
              overflowY: "auto",
            }}
          >
            {presetOptions.map((p) => (
              <button key={p.key} onClick={() => handlePickPreset(p.key)}
                role="option" aria-selected={datePreset === p.key}
                className="sm-row w-full text-left px-3.5 py-2.5 text-sm"
                style={{ color: datePreset === p.key ? colors.gold : colors.text, fontWeight: datePreset === p.key ? 600 : 400 }}>
                {p.label}
              </button>
            ))}
            <div style={{ borderTop: `1px solid ${colors.glassBorder}` }} />
            <button onClick={() => handlePickPreset("custom")}
              role="option" aria-selected={datePreset === "custom"}
              className="sm-row w-full text-left px-3.5 py-2.5 text-sm"
              style={{ color: datePreset === "custom" ? colors.gold : colors.text, fontWeight: datePreset === "custom" ? 600 : 400 }}>
              Custom...
            </button>
          </div>,
          document.body
        )}
      </div>
      {datePreset === "custom" && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm" style={{ background: colors.glassFill, border: `1px solid ${colors.glassBorder}` }}>
          <input type="date" value={filters.dateFrom || ""} onChange={(e) => setFilters((f) => ({ ...f, dateFrom: e.target.value, datePreset: "custom" }))}
            className="bg-transparent outline-none" style={{ color: colors.text, colorScheme } } />
          <span style={{ color: colors.textMuted }}>-</span>
          <input type="date" value={filters.dateTo || ""} onChange={(e) => setFilters((f) => ({ ...f, dateTo: e.target.value, datePreset: "custom" }))}
            className="bg-transparent outline-none" style={{ color: colors.text, colorScheme } } />
        </div>
      )}
      {active > 0 && (
        <button onClick={handleResetAll}
          className="sm-btn flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm" style={{ color: colors.coral, background: colors.coral + "14", border: `1px solid ${colors.coral}33` }}>
          <RefreshCw size={13} /> Reset ({active})
        </button>
      )}
    </>
  );

  return (
    <>
      {/* Mobile: tombol pemicu bottom-sheet */}
      <div className={`md:hidden ${active > 0 ? "mb-2.5" : "mb-4"}`}>
        <button
          onClick={() => setMobileOpen(true)}
          className="sm-btn flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold w-full"
          style={{
            background: colors.glassFill,
            color: colors.text,
            border: `1px solid ${active > 0 ? colors.gold + "88" : colors.glassBorder}`,
          }}
          aria-label="Buka filter data"
        >
          <Filter size={15} style={{ color: active > 0 ? colors.gold : colors.textMuted }} />
          <span>Filter</span>
          {active > 0 && (
            <span
              className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[10px] font-bold"
              style={{ background: colors.gold, color: "#0A1120" }}
            >
              {active}
            </span>
          )}
          <ChevronDown size={14} style={{ color: colors.textMuted }} />
        </button>
      </div>

      {/* Desktop: inline filter bar (flex-wrap) */}
      <div className={`hidden md:flex flex-wrap items-center gap-3 ${active > 0 ? "mb-3" : "mb-6"}`}>
        {filterContent}
      </div>

      {/* Active Filter Chips (Desktop & Mobile) */}
      {active > 0 && (
        <div className="flex flex-wrap items-center gap-2 mb-5 sm-fadein" aria-label="Filter aktif">
          <span className="text-xs font-medium mr-0.5 flex items-center gap-1" style={{ color: colors.textMuted }}>
            <Filter size={11} /> Filter aktif:
          </span>

          {/* Sales Chips */}
          {filters.salesCodes.map((code) => {
            const name = codeToName[code] || code;
            return (
              <span
                key={code}
                className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg border transition-all"
                style={{
                  background: colors.glassFill,
                  borderColor: `${colors.gold}44`,
                  color: colors.text,
                }}
              >
                <span className="text-[10px] uppercase font-bold tracking-wider" style={{ color: colors.gold }}>
                  Sales
                </span>
                <span className="font-medium max-w-[150px] truncate">{name}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveSales(code)}
                  aria-label={`Hapus filter sales ${name}`}
                  className="hover:opacity-60 rounded p-0.5 transition-opacity"
                  style={{ color: colors.textMuted }}
                >
                  <X size={12} />
                </button>
              </span>
            );
          })}

          {/* Group Chips */}
          {filters.groups.map((group) => (
            <span
              key={group}
              className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg border transition-all"
              style={{
                background: colors.glassFill,
                borderColor: `${colors.cyan || colors.mint}44`,
                color: colors.text,
              }}
            >
              <span className="text-[10px] uppercase font-bold tracking-wider" style={{ color: colors.cyan || colors.mint }}>
                Grup
              </span>
              <span className="font-medium max-w-[150px] truncate">{group}</span>
              <button
                type="button"
                onClick={() => handleRemoveGroup(group)}
                aria-label={`Hapus filter grup ${group}`}
                className="hover:opacity-60 rounded p-0.5 transition-opacity"
                style={{ color: colors.textMuted }}
              >
                <X size={12} />
              </button>
            </span>
          ))}

          {/* Date Chip */}
          {hasActiveDate && (
            <span
              className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg border transition-all"
              style={{
                background: colors.glassFill,
                borderColor: `${colors.mint}44`,
                color: colors.text,
              }}
            >
              <span className="text-[10px] uppercase font-bold tracking-wider" style={{ color: colors.mint }}>
                Tanggal
              </span>
              <span className="font-medium max-w-[180px] truncate">
                {datePreset === "custom"
                  ? `${filters.dateFrom || "..."} - ${filters.dateTo || "..."}`
                  : presetLabel}
              </span>
              <button
                type="button"
                onClick={handleRemoveDate}
                aria-label="Hapus filter tanggal"
                className="hover:opacity-60 rounded p-0.5 transition-opacity"
                style={{ color: colors.textMuted }}
              >
                <X size={12} />
              </button>
            </span>
          )}

          {/* Reset All Button */}
          <button
            type="button"
            onClick={handleResetAll}
            className="text-xs px-2 py-1 rounded-lg hover:underline transition-all flex items-center gap-1 font-medium ml-1"
            style={{ color: colors.coral }}
          >
            Hapus Semua
          </button>
        </div>
      )}

      {/* Mobile: bottom sheet — ⚠️ Bug fix (Sprint 3 / P6): sebelumnya
          mobile sheet dirender inline (tanpa createPortal). Bila ada ancestor
          dengan `transform`/`will-change` (mis. .sm-fadeup/.sm-card di
          SalesMonitoringApp), `position: fixed` menjadi relatif ke ancestor
          itu, bukan viewport → sheet mispositioned / partial hidden. Fix:
          portal ke document.body supaya selalu relatif viewport, konsisten
          dengan ExportMenu (lihat komponen/upload/index.jsx). */}
      {mobileOpen && createPortal(
        <div
          className="md:hidden fixed inset-0 z-50 flex items-end sm-fadein"
          onClick={() => setMobileOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Filter data"
        >
          <div className="absolute inset-0 bg-black/60 backdrop-blur-md" />
          <div
            className="relative w-full rounded-t-2xl p-5 max-h-[88vh] overflow-y-auto sm-scale-in sm-modal-glass"
            style={{
              borderRadius: "16px 16px 0 0",
              boxShadow: "0 -10px 40px rgba(0,0,0,0.3)",
              paddingBottom: "calc(20px + env(safe-area-inset-bottom))",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drag handle — indikator visual standar bottom-sheet iOS/Android */}
            <div className="mx-auto mb-4 w-10 h-1 rounded-full" style={{ background: colors.glassBorder }} />

            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl" style={{ background: colors.gold + "1A" }}>
                  <Filter size={16} style={{ color: colors.gold }} />
                </div>
                <div className="disp text-base font-semibold">Filter Data</div>
                {active > 0 && (
                  <span
                    className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[10px] font-bold"
                    style={{ background: colors.gold, color: "#0A1120" }}
                  >
                    {active}
                  </span>
                )}
              </div>
              <button
                onClick={() => setMobileOpen(false)}
                className="sm-btn p-2 rounded-full"
                style={{ background: colors.glassFill }}
                aria-label="Tutup filter"
              >
                <X size={16} />
              </button>
            </div>

            <div className="flex flex-col gap-3">
              {filterContent}
            </div>

            <button
              onClick={() => setMobileOpen(false)}
              className="mt-5 w-full sm-btn py-3 rounded-xl text-sm font-semibold"
              style={{ background: colors.gold, color: "#0A1120" }}
            >
              Terapkan Filter
            </button>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
