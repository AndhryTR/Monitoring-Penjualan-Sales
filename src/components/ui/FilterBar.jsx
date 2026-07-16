import { useState, useMemo, useEffect } from "react";
import { Users, Package, CalendarDays, RefreshCw, Filter, X, ChevronDown } from "lucide-react";
import { MultiSelect } from "./MultiSelect.jsx";

/* ============================================================================
   FILTERBAR
   Bar filter untuk Sales, Grup Barang, dan rentang tanggal. Di desktop tampil
   inline (flex-wrap), di mobile tampil sebagai bottom-sheet yang dipicu tombol
   "Filter" dengan badge jumlah filter aktif.
============================================================================ */
export function FilterBar({ salesOptions, groupOptions, filters, setFilters, colors, theme }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const active = filters.salesCodes.length + filters.groups.length + (filters.dateFrom ? 1 : 0) + (filters.dateTo ? 1 : 0);
  const nameToCode = useMemo(() => Object.fromEntries(salesOptions.map((s) => [s.name, s.code])), [salesOptions]);
  const codeToName = useMemo(() => Object.fromEntries(salesOptions.map(s => [s.code, s.name])), [salesOptions]);
  const selectedNames = useMemo(() => filters.salesCodes.map(code => codeToName[code]).filter(Boolean), [filters.salesCodes, codeToName]);

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
      <div className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm" style={{ background: colors.surface2, border: `1px solid ${colors.border}` }}>
        <CalendarDays size={14} style={{ color: colors.textMuted }} />
        <input type="date" value={filters.dateFrom || ""} onChange={(e) => setFilters((f) => ({ ...f, dateFrom: e.target.value }))}
          className="bg-transparent outline-none" style={{ color: colors.text, colorScheme } } />
        <span style={{ color: colors.textMuted }}>-</span>
        <input type="date" value={filters.dateTo || ""} onChange={(e) => setFilters((f) => ({ ...f, dateTo: e.target.value }))}
          className="bg-transparent outline-none" style={{ color: colors.text, colorScheme } } />
      </div>
      {active > 0 && (
        <button onClick={() => setFilters({ salesCodes: [], groups: [], dateFrom: "", dateTo: "" })}
          className="sm-btn flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm" style={{ color: colors.coral, background: colors.coral + "14", border: `1px solid ${colors.coral}33` }}>
          <RefreshCw size={13} /> Reset ({active})
        </button>
      )}
    </>
  );

  return (
    <>
      {/* Mobile: tombol pemicu bottom-sheet */}
      <div className="md:hidden mb-4">
        <button
          onClick={() => setMobileOpen(true)}
          className="sm-btn flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold w-full"
          style={{
            background: colors.surface,
            color: colors.text,
            border: `1px solid ${active > 0 ? colors.gold + "88" : colors.border}`,
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
      <div className="hidden md:flex flex-wrap items-center gap-3 mb-6">
        {filterContent}
      </div>

      {/* Mobile: bottom sheet */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 z-50 flex items-end sm-fadein"
          onClick={() => setMobileOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Filter data"
        >
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div
            className="relative w-full rounded-t-2xl p-5 max-h-[88vh] overflow-y-auto sm-scale-in"
            style={{
              background: colors.surface,
              borderTop: `1px solid ${colors.border}`,
              borderRadius: "16px 16px 0 0",
              boxShadow: colors.sheetShadow,
              paddingBottom: "calc(20px + env(safe-area-inset-bottom))",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drag handle — indikator visual standar bottom-sheet iOS/Android */}
            <div className="mx-auto mb-4 w-10 h-1 rounded-full" style={{ background: colors.border }} />

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
                style={{ background: colors.surface2 }}
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
        </div>
      )}
    </>
  );
}
