import { useState, useMemo, useEffect } from "react";
import { ChevronDown, Filter, X, Store } from "lucide-react";
import { MultiSelect } from "../ui/MultiSelect.jsx";
import { getOutletOptions, getUnitOptions } from "../../utils/transactions.js";

/* ============================================================================
   TRANSACTION FILTERS
   Filter panel lokal untuk TransactionsPage — di luar FilterBar global yang
   sudah handle date range, sales, grup. Filter di sini: outlet spesifik,
   qty range, value range, satuan.

   Collapsible (default collapse) supaya tidak overwhelming. Badge jumlah
   filter aktif di tombol toggle. Mobile-friendly: jadi bottom-sheet.
============================================================================ */
export function TransactionFilters({ rows, filters, setFilters, colors }) {
  const [open, setOpen] = useState(false);

  const outletOptions = useMemo(() => getOutletOptions(rows), [rows]);
  const unitOptions = useMemo(() => getUnitOptions(rows), [rows]);

  // Hitung jumlah filter aktif untuk badge
  const activeCount =
    (filters.outletCodes.length ? 1 : 0) +
    (filters.qtyMin !== null && filters.qtyMin !== "" ? 1 : 0) +
    (filters.qtyMax !== null && filters.qtyMax !== "" ? 1 : 0) +
    (filters.valueMin !== null && filters.valueMin !== "" ? 1 : 0) +
    (filters.valueMax !== null && filters.valueMax !== "" ? 1 : 0) +
    (filters.unit ? 1 : 0);

  const handleReset = () => {
    setFilters({
      outletCodes: [],
      qtyMin: null,
      qtyMax: null,
      valueMin: null,
      valueMax: null,
      unit: "",
    });
  };

  // Outlet options untuk MultiSelect: pakai name (bukan code) karena MultiSelect
  // bekerja dengan string. Konversi code↔name di parent.
  const outletNames = outletOptions.map((o) => o.name);
  const selectedOutletNames = useMemo(() => {
    const codeToName = Object.fromEntries(outletOptions.map((o) => [o.code, o.name]));
    return filters.outletCodes.map((code) => codeToName[code]).filter(Boolean);
  }, [filters.outletCodes, outletOptions]);

  const handleOutletChange = (names) => {
    const nameToCode = Object.fromEntries(outletOptions.map((o) => [o.name, o.code]));
    setFilters((f) => ({ ...f, outletCodes: names.map((n) => nameToCode[n]) }));
  };

  const filterContent = (
    <div className="flex flex-col gap-4">
      <div>
        <label className="block text-xs mb-1.5" style={{ color: colors.textMuted }}>Outlet</label>
        <MultiSelect
          label="Outlet"
          icon={Store}
          options={outletNames}
          selected={selectedOutletNames}
          onChange={handleOutletChange}
          placeholder="Cari outlet..."
          colors={colors}
        />
      </div>

      <div>
        <label className="block text-xs mb-1.5" style={{ color: colors.textMuted }}>Rentang Qty</label>
        <div className="flex items-center gap-2">
          <input
            type="number"
            value={filters.qtyMin ?? ""}
            onChange={(e) => setFilters((f) => ({ ...f, qtyMin: e.target.value === "" ? null : e.target.value }))}
            placeholder="min"
            className="w-full px-3 py-2 rounded-lg text-sm mono"
            style={{ background: colors.surface2, border: `1px solid ${colors.border}`, color: colors.text }}
          />
          <span style={{ color: colors.textMuted }}>—</span>
          <input
            type="number"
            value={filters.qtyMax ?? ""}
            onChange={(e) => setFilters((f) => ({ ...f, qtyMax: e.target.value === "" ? null : e.target.value }))}
            placeholder="max"
            className="w-full px-3 py-2 rounded-lg text-sm mono"
            style={{ background: colors.surface2, border: `1px solid ${colors.border}`, color: colors.text }}
          />
        </div>
      </div>

      <div>
        <label className="block text-xs mb-1.5" style={{ color: colors.textMuted }}>Rentang Value (Rp)</label>
        <div className="flex items-center gap-2">
          <input
            type="number"
            value={filters.valueMin ?? ""}
            onChange={(e) => setFilters((f) => ({ ...f, valueMin: e.target.value === "" ? null : e.target.value }))}
            placeholder="min"
            className="w-full px-3 py-2 rounded-lg text-sm mono"
            style={{ background: colors.surface2, border: `1px solid ${colors.border}`, color: colors.text }}
          />
          <span style={{ color: colors.textMuted }}>—</span>
          <input
            type="number"
            value={filters.valueMax ?? ""}
            onChange={(e) => setFilters((f) => ({ ...f, valueMax: e.target.value === "" ? null : e.target.value }))}
            placeholder="max"
            className="w-full px-3 py-2 rounded-lg text-sm mono"
            style={{ background: colors.surface2, border: `1px solid ${colors.border}`, color: colors.text }}
          />
        </div>
      </div>

      <div>
        <label className="block text-xs mb-1.5" style={{ color: colors.textMuted }}>Satuan</label>
        <select
          value={filters.unit || ""}
          onChange={(e) => setFilters((f) => ({ ...f, unit: e.target.value }))}
          className="w-full px-3 py-2 rounded-lg text-sm"
          style={{ background: colors.surface2, border: `1px solid ${colors.border}`, color: colors.text }}
        >
          <option value="">Semua satuan</option>
          {unitOptions.map((u) => <option key={u} value={u}>{u}</option>)}
        </select>
      </div>

      {activeCount > 0 && (
        <button
          onClick={handleReset}
          className="sm-btn flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm"
          style={{ color: colors.coral, background: colors.coral + "14", border: `1px solid ${colors.coral}33` }}
        >
          <X size={13} /> Reset Filter ({activeCount})
        </button>
      )}
    </div>
  );

  return (
    <div className="mb-4">
      <button
        onClick={() => setOpen(!open)}
        className="sm-btn flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold w-full md:w-auto"
        style={{
          background: colors.surface,
          color: colors.text,
          border: `1px solid ${activeCount > 0 ? colors.gold + "88" : colors.border}`,
        }}
        aria-label="Toggle filter lanjutan"
      >
        <Filter size={15} style={{ color: activeCount > 0 ? colors.gold : colors.textMuted }} />
        <span>Filter Lanjutan</span>
        {activeCount > 0 && (
          <span
            className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[10px] font-bold"
            style={{ background: colors.gold, color: "#0A1120" }}
          >
            {activeCount}
          </span>
        )}
        <ChevronDown size={14} style={{ color: colors.textMuted, transform: open ? "rotate(180deg)" : "none", transition: "transform .2s" }} />
      </button>

      {/* Desktop: inline panel */}
      {open && (
        <div className="hidden md:block sm-card p-5 mt-3 sm-fadein">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 items-start">
            <div>
              <label className="block text-xs mb-1.5" style={{ color: colors.textMuted }}>Outlet</label>
              <MultiSelect
                label="Outlet"
                icon={Store}
                options={outletNames}
                selected={selectedOutletNames}
                onChange={handleOutletChange}
                placeholder="Cari outlet..."
                colors={colors}
              />
            </div>
            <div>
              <label className="block text-xs mb-1.5" style={{ color: colors.textMuted }}>Rentang Qty</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={filters.qtyMin ?? ""}
                  onChange={(e) => setFilters((f) => ({ ...f, qtyMin: e.target.value === "" ? null : e.target.value }))}
                  placeholder="min"
                  className="w-full px-3 py-2 rounded-lg text-sm mono"
                  style={{ background: colors.surface2, border: `1px solid ${colors.border}`, color: colors.text }}
                />
                <span style={{ color: colors.textMuted }}>—</span>
                <input
                  type="number"
                  value={filters.qtyMax ?? ""}
                  onChange={(e) => setFilters((f) => ({ ...f, qtyMax: e.target.value === "" ? null : e.target.value }))}
                  placeholder="max"
                  className="w-full px-3 py-2 rounded-lg text-sm mono"
                  style={{ background: colors.surface2, border: `1px solid ${colors.border}`, color: colors.text }}
                />
              </div>
            </div>
            <div>
              <label className="block text-xs mb-1.5" style={{ color: colors.textMuted }}>Rentang Value (Rp)</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={filters.valueMin ?? ""}
                  onChange={(e) => setFilters((f) => ({ ...f, valueMin: e.target.value === "" ? null : e.target.value }))}
                  placeholder="min"
                  className="w-full px-3 py-2 rounded-lg text-sm mono"
                  style={{ background: colors.surface2, border: `1px solid ${colors.border}`, color: colors.text }}
                />
                <span style={{ color: colors.textMuted }}>—</span>
                <input
                  type="number"
                  value={filters.valueMax ?? ""}
                  onChange={(e) => setFilters((f) => ({ ...f, valueMax: e.target.value === "" ? null : e.target.value }))}
                  placeholder="max"
                  className="w-full px-3 py-2 rounded-lg text-sm mono"
                  style={{ background: colors.surface2, border: `1px solid ${colors.border}`, color: colors.text }}
                />
              </div>
            </div>
            <div>
              <label className="block text-xs mb-1.5" style={{ color: colors.textMuted }}>Satuan</label>
              <select
                value={filters.unit || ""}
                onChange={(e) => setFilters((f) => ({ ...f, unit: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg text-sm"
                style={{ background: colors.surface2, border: `1px solid ${colors.border}`, color: colors.text }}
              >
                <option value="">Semua satuan</option>
                {unitOptions.map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
          </div>
          {activeCount > 0 && (
            <div className="mt-4 flex justify-end">
              <button
                onClick={handleReset}
                className="sm-btn flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm"
                style={{ color: colors.coral, background: colors.coral + "14", border: `1px solid ${colors.coral}33` }}
              >
                <X size={13} /> Reset Filter ({activeCount})
              </button>
            </div>
          )}
        </div>
      )}

      {/* Mobile: bottom-sheet */}
      {open && (
        <div
          className="md:hidden fixed inset-0 z-50 flex items-end sm-fadein"
          onClick={() => setOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Filter lanjutan transaksi"
        >
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div
            className="relative w-full rounded-t-2xl p-5 max-h-[88vh] overflow-y-auto sm-scale-in"
            style={{
              background: colors.surface,
              borderTop: `1px solid ${colors.border}`,
              borderRadius: "16px 16px 0 0",
              boxShadow: "0 -10px 40px rgba(0,0,0,0.3)",
              paddingBottom: "calc(20px + env(safe-area-inset-bottom))",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-4 w-10 h-1 rounded-full" style={{ background: colors.border }} />
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl" style={{ background: colors.gold + "1A" }}>
                  <Filter size={16} style={{ color: colors.gold }} />
                </div>
                <div className="disp text-base font-semibold">Filter Lanjutan</div>
                {activeCount > 0 && (
                  <span
                    className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[10px] font-bold"
                    style={{ background: colors.gold, color: "#0A1120" }}
                  >
                    {activeCount}
                  </span>
                )}
              </div>
              <button
                onClick={() => setOpen(false)}
                className="sm-btn p-2 rounded-full"
                style={{ background: colors.surface2 }}
                aria-label="Tutup filter"
              >
                <X size={16} />
              </button>
            </div>
            {filterContent}
            <button
              onClick={() => setOpen(false)}
              className="mt-5 w-full sm-btn py-3 rounded-xl text-sm font-semibold"
              style={{ background: colors.gold, color: "#0A1120" }}
            >
              Terapkan Filter
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
