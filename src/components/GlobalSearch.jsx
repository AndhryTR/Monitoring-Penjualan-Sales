import { useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  Search, X, UserRound, Store, Package, Boxes,
  CornerDownLeft,
} from "lucide-react";
import { useScrollLock, useEscapeKey, useFocusTrap } from "../hooks/useModalA11y.js";
import { fmtNum } from "../utils/formatters.js";

/* ============================================================================
   GLOBAL SEARCH — Command Palette (Cmd+K / Ctrl+K)
   ⚠️ Sprint 9 / GS2: overlay search yang index semua data (sales, outlet,
   produk, grup) dan navigate ke tab + filter yang relevan saat dipilih.

   Inspired by: VS Code Cmd+K, Raycast, Linear command palette.

   Features:
   - Keyboard navigation: ↑↓ untuk pilih, Enter untuk eksekusi, Esc untuk tutup
   - Auto-focus input saat buka
   - Restore focus ke elemen sebelumnya saat tutup
   - Results di-group by type dengan ikon + sublabel
   - Empty state dengan hint "Coba nama sales, outlet, produk, atau grup"
============================================================================ */

const TYPE_META = {
  sales: { label: "Sales", icon: UserRound, color: "blue" },
  outlet: { label: "Outlet", icon: Store, color: "mint" },
  product: { label: "Produk", icon: Package, color: "gold" },
  group: { label: "Grup", icon: Boxes, color: "violet" },
};

export function GlobalSearch({
  isOpen, onClose, onNavigate,
  query, setQuery, results, selectedIndex, setSelectedIndex, moveUp, moveDown,
  indexStats, colors,
}) {
  const inputRef = useRef(null);
  const containerRef = useRef(null);
  const resultsRef = useRef(null);

  useScrollLock(isOpen);
  useEscapeKey(isOpen, onClose);
  useFocusTrap(isOpen, containerRef);

  // Focus input saat buka
  useEffect(() => {
    if (isOpen) {
      // Delay sedikit supaya DOM sudah render
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery("");
    }
  }, [isOpen, setQuery]);

  // Keyboard handler untuk navigation (di container, bukan document)
  const handleKeyDown = (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      moveDown();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      moveUp();
    } else if (e.key === "Enter") {
      e.preventDefault();
      const selected = results[selectedIndex];
      if (selected) {
        onNavigate(selected);
        onClose();
      }
    }
  };

  // Auto-scroll ke selected item
  useEffect(() => {
    if (!resultsRef.current) return;
    const selected = resultsRef.current.querySelector(`[data-idx="${selectedIndex}"]`);
    if (selected) {
      selected.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, [selectedIndex]);

  if (!isOpen) return null;

  // Group results by type
  const grouped = {};
  results.forEach((r) => {
    if (!grouped[r.type]) grouped[r.type] = [];
    grouped[r.type].push(r);
  });
  const groupOrder = ["sales", "outlet", "product", "group"];

  // Flat index untuk keyboard navigation
  let flatIdx = -1;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-start justify-center bg-black/60 backdrop-blur-md sm-fadein p-4 pt-[10vh]"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Pencarian global"
    >
      <div
        ref={containerRef}
        className="sm-card sm-modal-glass sm-scale-in w-full max-w-2xl flex flex-col max-h-[80vh]"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
        style={{ borderRadius: 16 }}
      >
        {/* Search input */}
        <div className="p-4 flex items-center gap-3 shrink-0" style={{ borderBottom: `1px solid ${colors.glassBorder}` }}>
          <Search size={18} style={{ color: colors.textMuted }} className="shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari sales, outlet, produk, atau grup produk..."
            className="flex-1 bg-transparent outline-none text-base"
            style={{ color: colors.text }}
            aria-label="Pencarian global"
            autoComplete="off"
            spellCheck="false"
          />
          <button
            onClick={onClose}
            className="sm-btn p-1.5 rounded-lg shrink-0"
            style={{ background: colors.glassFill, color: colors.textMuted }}
            aria-label="Tutup pencarian"
          >
            <X size={16} />
          </button>
        </div>

        {/* Results */}
        <div ref={resultsRef} className="overflow-y-auto flex-1 p-2">
          {query.trim().length === 0 ? (
            // Empty query — show hint + stats
            <div className="p-6 text-center">
              <Search size={28} className="mx-auto mb-3" style={{ color: colors.textMuted, opacity: 0.3 }} />
              <p className="text-sm" style={{ color: colors.textMuted }}>
                Ketik untuk mencari di {indexStats.sales + indexStats.outlets + indexStats.products + indexStats.groups} item
              </p>
              <div className="flex items-center justify-center gap-3 mt-3 flex-wrap">
                {Object.entries(indexStats).filter(([, v]) => v > 0).map(([key, val]) => {
                  const meta = TYPE_META[key === "sales" ? "sales" : key === "outlets" ? "outlet" : key === "products" ? "product" : "group"];
                  if (!meta) return null;
                  const Icon = meta.icon;
                  return (
                    <div key={key} className="flex items-center gap-1.5 text-xs" style={{ color: colors.textMuted }}>
                      <Icon size={12} style={{ color: colors[meta.color] }} />
                      {fmtNum(val)} {meta.label}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : results.length === 0 ? (
            // No results
            <div className="p-6 text-center">
              <Search size={28} className="mx-auto mb-3" style={{ color: colors.textMuted, opacity: 0.3 }} />
              <p className="text-sm font-medium mb-1" style={{ color: colors.text }}>Tidak ada hasil untuk "{query}"</p>
              <p className="text-xs" style={{ color: colors.textMuted }}>
                Coba kata kunci lain, atau periksa ejaan. Pencarian bersifat case-insensitive.
              </p>
            </div>
          ) : (
            // Results grouped by type
            groupOrder.map((type) => {
              const items = grouped[type];
              if (!items || items.length === 0) return null;
              const meta = TYPE_META[type];
              const Icon = meta.icon;
              const accent = colors[meta.color];

              return (
                <div key={type} className="mb-2">
                  {/* Group header */}
                  <div className="px-3 py-1.5 flex items-center gap-2 text-xs uppercase tracking-wider font-semibold" style={{ color: colors.textMuted }}>
                    <Icon size={11} style={{ color: accent }} />
                    {meta.label}
                    <span className="text-[10px] font-normal" style={{ color: colors.textMuted }}>({items.length})</span>
                  </div>

                  {/* Items */}
                  {items.map((item) => {
                    flatIdx++;
                    const idx = flatIdx;
                    const isSelected = idx === selectedIndex;
                    const ItemIcon = TYPE_META[item.type].icon;
                    const itemAccent = colors[TYPE_META[item.type].color];

                    return (
                      <button
                        key={`${item.type}-${item.key}`}
                        data-idx={idx}
                        onClick={() => { onNavigate(item); onClose(); }}
                        onMouseEnter={() => setSelectedIndex(idx)}
                        className="w-full text-left px-3 py-2.5 flex items-center gap-3 rounded-lg transition-colors"
                        style={{
                          background: isSelected ? colors.glassFillStrong : "transparent",
                        }}
                      >
                        <div className="p-1.5 rounded-lg shrink-0" style={{ background: itemAccent + "1A" }}>
                          <ItemIcon size={14} style={{ color: itemAccent }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate" style={{ color: isSelected ? colors.mint : colors.text }}>
                            {item.label}
                          </div>
                          {item.sublabel && (
                            <div className="text-xs truncate" style={{ color: colors.textMuted }}>
                              {item.sublabel}
                            </div>
                          )}
                        </div>
                        {isSelected && (
                          <div className="flex items-center gap-1 shrink-0 text-[10px]" style={{ color: colors.textMuted }}>
                            <CornerDownLeft size={11} />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              );
            })
          )}
        </div>

        {/* Footer hint */}
        <div className="px-4 py-2.5 flex items-center justify-between shrink-0 text-[11px]" style={{ borderTop: `1px solid ${colors.glassBorder}`, color: colors.textMuted }}>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded text-[10px]" style={{ background: colors.glassFill }}>↑</kbd>
              <kbd className="px-1.5 py-0.5 rounded text-[10px]" style={{ background: colors.glassFill }}>↓</kbd>
              navigasi
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded text-[10px]" style={{ background: colors.glassFill }}>Enter</kbd>
              pilih
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded text-[10px]" style={{ background: colors.glassFill }}>Esc</kbd>
              tutup
            </span>
          </div>
          <span>{results.length} hasil</span>
        </div>
      </div>
    </div>,
    document.body
  );
}
