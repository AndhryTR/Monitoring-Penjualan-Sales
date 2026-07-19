import { useState, useMemo, useEffect } from "react";
import { Users, Package, CalendarDays, RefreshCw, Filter, X, ChevronDown } from "lucide-react";
import { MultiSelect } from "./MultiSelect.jsx";

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

  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e) => { if (e.key === "Escape") setMobileOpen(false); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [mobileOpen]);

  const colorScheme = theme === "light" ? "light" : "dark";

  const filterContent = (
    <>
      <MultiSelect label="Sales" icon={Users} options={salesOptions.map(s => s.name)} selected={selectedNames}
        onChange={handleSalesChange} colors={colors} placeholder="Cari sales..." />
      <MultiSelect label="Grup Barang" icon={Package} options={groupOptions} selected={filters.groups}
        onChange={(v) => setFilters((f) => ({ ...f, groups: v }))} placeholder="Cari grup..." colors={colors} />
      <div className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm glass-input">
        <CalendarDays size={14} style={{ color: colors.textMuted }} />
        <input type="date" value={filters.dateFrom || ""} onChange={(e) => setFilters((f) => ({ ...f, dateFrom: e.target.value }))}
          className="bg-transparent outline-none" style={{ color: colors.text, colorScheme }} />
        <span style={{ color: colors.textMuted }}>-</span>
        <input type="date" value={filters.dateTo || ""} onChange={(e) => setFilters((f) => ({ ...f, dateTo: e.target.value }))}
          className="bg-transparent outline-none" style={{ color: colors.text, colorScheme }} />
      </div>
      {active > 0 && (
        <button onClick={() => setFilters({ salesCodes: [], groups: [], dateFrom: "", dateTo: "" })}
          className="glass-btn flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm" style={{ color: colors.coral, background: colors.coral + "14", border: `1px solid ${colors.coral}33` }}>
          <RefreshCw size={13} /> Reset ({active})
        </button>
      )}
    </>
  );

  return (
    <>
      <div className="md:hidden mb-4">
        <button onClick={() => setMobileOpen(true)} className="glass-btn flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold w-full"
          style={{ border: `1px solid ${active > 0 ? colors.gold + "88" : "rgba(255,255,255,0.08)"}` }} aria-label="Buka filter data">
          <Filter size={15} style={{ color: active > 0 ? colors.gold : colors.textMuted }} />
          <span>Filter</span>
          {active > 0 && (<span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[10px] font-bold" style={{ background: colors.gold, color: "#0A1120" }}>{active}</span>)}
          <ChevronDown size={14} style={{ color: colors.textMuted }} />
        </button>
      </div>
      <div className="hidden md:flex flex-wrap items-center gap-3 mb-6">{filterContent}</div>
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex items-end sm-fadein" onClick={() => setMobileOpen(false)} role="dialog" aria-modal="true" aria-label="Filter data">
          <div className="glass-backdrop absolute inset-0" />
          <div className="glass-modal relative w-full max-h-[88vh] overflow-y-auto sm-scale-in"
            style={{ borderRadius: "16px 16px 0 0", paddingBottom: "calc(20px + env(safe-area-inset-bottom))" }}
            onClick={(e) => e.stopPropagation()}>
            <div className="mx-auto mb-4 w-10 h-1 rounded-full" style={{ background: "rgba(255,255,255,0.12)" }} />
            <div className="flex items-center justify-between mb-4 px-5">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl" style={{ background: colors.gold + "1A" }}><Filter size={16} style={{ color: colors.gold }} /></div>
                <div className="disp text-base font-semibold">Filter Data</div>
                {active > 0 && (<span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[10px] font-bold" style={{ background: colors.gold, color: "#0A1120" }}>{active}</span>)}
              </div>
              <button onClick={() => setMobileOpen(false)} className="glass-btn p-2 rounded-full" aria-label="Tutup filter"><X size={16} /></button>
            </div>
            <div className="flex flex-col gap-3 px-5">{filterContent}</div>
            <div className="px-5"><button onClick={() => setMobileOpen(false)} className="mt-5 w-full py-3 rounded-xl text-sm font-semibold" style={{ background: colors.gold, color: "#0A1120" }}>Terapkan Filter</button></div>
          </div>
        </div>
      )}
    </>
  );
}
