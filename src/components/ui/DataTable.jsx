import { useState, useMemo, useEffect } from "react";
import { Search, X, ChevronDown } from "lucide-react";
import { fmtNum } from "../../utils/formatters.js";

export function DataTable({ columns, rows, initialSortKey, colors, searchable, searchKeys, searchPlaceholder, pageSize, mobileTitleKey, mobileSubtitleKey, mobileCornerKey }) {
  const [sortKey, setSortKey] = useState(initialSortKey || columns[0].key);
  const [sortDir, setSortDir] = useState("desc");
  const [query, setQuery] = useState("");
  const [visibleCount, setVisibleCount] = useState(pageSize || Infinity);

  useEffect(() => { setVisibleCount(pageSize || Infinity); }, [rows, query, pageSize]);

  const effectiveSearchKeys = useMemo(() => {
    if (searchKeys && searchKeys.length) return searchKeys;
    if (!rows.length) return [];
    return columns.map((c) => c.key).filter((k) => typeof rows[0][k] === "string");
  }, [searchKeys, columns, rows]);

  const filtered = useMemo(() => {
    if (!searchable || !query.trim()) return rows;
    const q = query.trim().toLowerCase();
    return rows.filter((row) => effectiveSearchKeys.some((k) => String(row[k] ?? "").toLowerCase().includes(q)));
  }, [rows, searchable, query, effectiveSearchKeys]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      const va = a[sortKey], vb = b[sortKey];
      if (typeof va === "string") return sortDir === "asc" ? va.localeCompare(vb) : vb.localeCompare(va);
      return sortDir === "asc" ? (va || 0) - (vb || 0) : (vb || 0) - (va || 0);
    });
    return arr;
  }, [filtered, sortKey, sortDir]);
  const toggleSort = (k) => { if (k === sortKey) setSortDir(sortDir === "asc" ? "desc" : "asc"); else { setSortKey(k); setSortDir("desc"); } };

  const visibleRows = pageSize ? sorted.slice(0, visibleCount) : sorted;
  const hasMore = Boolean(pageSize) && sorted.length > visibleCount;

  const titleCol = mobileTitleKey ? columns.find((c) => c.key === mobileTitleKey) : (columns.find((c) => c.label) || columns[0]);
  const subtitleCol = mobileSubtitleKey ? columns.find((c) => c.key === mobileSubtitleKey) : null;
  const cornerCol = mobileCornerKey ? columns.find((c) => c.key === mobileCornerKey) : null;
  const dataCols = columns.filter((c) => c !== titleCol && c !== subtitleCol && c !== cornerCol && c.label);
  const actionCols = columns.filter((c) => !c.label);

  const mobileCellValue = (col, row, isExplicit) => {
    if (!col) return null;
    if (!isExplicit && col.render) return col.render(row);
    const v = row[col.key];
    return v === undefined || v === null || v === "" ? "-" : v;
  };

  return (
    <div className="glass-panel overflow-hidden">
      {searchable && (
        <div className="px-4 pt-4 pb-1">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: colors.textMuted }} />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={searchPlaceholder || "Cari..."}
              className="glass-input w-full pl-9 pr-8 py-2 text-sm" />
            {query && (
              <button onClick={() => setQuery("")} className="absolute right-2.5 top-1/2 -translate-y-1/2" style={{ color: colors.textMuted }}>
                <X size={14} />
              </button>
            )}
          </div>
          {query && (<div className="text-xs mt-1.5" style={{ color: colors.textMuted }}>{sorted.length} hasil untuk "{query}"</div>)}
        </div>
      )}
      <div className="hidden sm:block overflow-auto max-h-[65vh]">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10">
            <tr style={{ background: "rgba(255,255,255,0.06)", backdropFilter: "blur(16px)" }}>
              {columns.map((c) => (
                <th key={c.key} onClick={() => c.label && toggleSort(c.key)} className="px-4 py-3 text-left cursor-pointer select-none whitespace-nowrap"
                  style={{ color: colors.textMuted, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em", background: "rgba(255,255,255,0.06)", boxShadow: "0 1px 0 rgba(255,255,255,0.06)" }}>
                  {c.label} {sortKey === c.key && (sortDir === "asc" ? "↑" : "↓")}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row, i) => (
              <tr key={i} className="sm-row" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                {columns.map((c) => (<td key={c.key} className="px-4 py-3 whitespace-nowrap">{c.render ? c.render(row) : row[c.key]}</td>))}
            ))}
            {sorted.length === 0 && (
              <tr><td colSpan={columns.length} className="px-4 py-10 text-center" style={{ color: colors.textMuted }}>
                {query ? "Tidak ada hasil yang cocok dengan pencarian" : "Belum ada data untuk filter ini"}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="sm:hidden max-h-[65vh] overflow-y-auto">
        {sorted.length === 0 ? (
          <div className="px-4 py-10 text-center text-sm" style={{ color: colors.textMuted }}>
            {query ? "Tidak ada hasil yang cocok dengan pencarian" : "Belum ada data untuk filter ini"}
          </div>
        ) : (
          <div>
            {visibleRows.map((row, i) => (
              <div key={i} className="px-4 py-3.5" style={{ borderTop: i === 0 ? "none" : "1px solid rgba(255,255,255,0.06)" }}>
                <div className="flex items-start justify-between gap-2 mb-0.5">
                  <div className="text-sm font-semibold truncate" style={{ color: colors.text }}>{mobileCellValue(titleCol, row, Boolean(mobileTitleKey))}</div>
                  {cornerCol && (<div className="shrink-0 text-xs mono" style={{ color: colors.textMuted }}>{mobileCellValue(cornerCol, row, true)}</div>)}
                </div>
                {subtitleCol && (<div className="text-xs mb-2 truncate" style={{ color: colors.textMuted }}>{mobileCellValue(subtitleCol, row, true)}</div>)}
                {!subtitleCol && <div className="mb-1" />}
                {dataCols.length > 0 && (
                  <div className="grid grid-cols-2 gap-x-3 gap-y-2">
                    {dataCols.map((c) => (
                      <div key={c.key} className="min-w-0">
                        <div className="uppercase tracking-wider mb-0.5" style={{ color: colors.textMuted, fontSize: 9.5, letterSpacing: "0.04em" }}>{c.label}</div>
                        <div className="text-sm mono truncate" style={{ color: colors.text }}>{c.render ? c.render(row) : row[c.key]}</div>
                      </div>
                    ))}
                  </div>
                )}
                {actionCols.length > 0 && (
                  <div className="mt-3 flex items-center gap-2">{actionCols.map((c) => (<span key={c.key}>{c.render ? c.render(row) : null}</span>))}</div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
      {hasMore && (
        <div className="text-center py-4 px-4" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          <button onClick={() => setVisibleCount((c) => c + pageSize)}
            className="glass-btn inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold" style={{ color: colors.text }}>
            <ChevronDown size={14} /> Muat lebih banyak ({fmtNum(sorted.length - visibleCount)} baris tersisa)
          </button>
          <div className="text-xs mt-2" style={{ color: colors.textMuted }}>Menampilkan {fmtNum(visibleCount)} dari {fmtNum(sorted.length)} baris</div>
        </div>
      )}
    </div>
  );
}
