import { useState, useEffect, useMemo, useId } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Search, Check } from "lucide-react";
import { useFloatingDropdown } from "../../hooks/useFloatingDropdown.js";

/* ============================================================================
   CUSTOMSELECT
   Komponen dropdown single-select custom bergaya glassmorphism sesuai template
   aplikasi (FilterBar & MultiSelect). Menggunakan createPortal ke document.body
   agar posisinya aman dari clipping parent (overflow-hidden / modal / kartu).
   ============================================================================ */

export function CustomSelect({
  value,
  onChange,
  options = [],
  placeholder = "Pilih...",
  icon: Icon,
  colors = {},
  size = "sm", // "xs" | "sm" | "md"
  searchable,
  searchPlaceholder = "Cari...",
  fullWidth = false,
  disabled = false,
  align = "left",
  menuWidth,
  className = "",
  buttonStyle = {},
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const menuId = useId();

  const isLight = colors?.colorScheme === "light";

  // Normalisasi opsi ke struktur standar: { value, label, badge, icon, disabled, color }
  const normalizedOptions = useMemo(() => {
    return options.map((opt) => {
      if (typeof opt === "object" && opt !== null) {
        return {
          value: opt.value !== undefined ? opt.value : opt.code !== undefined ? opt.code : opt.label,
          label: opt.label !== undefined ? opt.label : opt.name !== undefined ? opt.name : String(opt.value),
          badge: opt.badge !== undefined ? opt.badge : opt.count !== undefined ? `${opt.count} Toko` : undefined,
          icon: opt.icon,
          disabled: opt.disabled || false,
          color: opt.color,
        };
      }
      return {
        value: opt,
        label: String(opt),
        badge: undefined,
        icon: undefined,
        disabled: false,
        color: undefined,
      };
    });
  }, [options]);

  // Cari opsi terpilih saat ini
  const selectedOption = useMemo(() => {
    return normalizedOptions.find((o) => o.value === value);
  }, [normalizedOptions, value]);

  // Otomatis aktifkan search jika opsi >= 7 kecuali diset eksplisit
  const isSearchable = searchable !== undefined ? searchable : normalizedOptions.length >= 7;

  // Filter opsi sesuai input pencarian
  const filteredOptions = useMemo(() => {
    if (!q.trim()) return normalizedOptions;
    const query = q.toLowerCase();
    return normalizedOptions.filter((o) => {
      const matchLabel = o.label.toLowerCase().includes(query);
      const matchBadge = o.badge ? String(o.badge).toLowerCase().includes(query) : false;
      return matchLabel || matchBadge;
    });
  }, [normalizedOptions, q]);

  const estimatedHeight = Math.min(320, filteredOptions.length * 36 + (isSearchable ? 44 : 16));

  const { triggerRef, floatingRef: dropdownRef, position: dropdownPos } = useFloatingDropdown({
    isOpen: open,
    onClose: () => setOpen(false),
    align,
    width: menuWidth,
    minWidth: 200,
    estimatedHeight,
    gap: 6,
    margin: 12,
  });

  // Reset filter query + active index saat dropdown dibuka/ditutup
  useEffect(() => {
    if (!open) setQ("");
    else setActiveIndex(0);
  }, [open]);

  // Clamp active index saat filter berubah
  useEffect(() => {
    setActiveIndex((i) => Math.min(i, Math.max(0, filteredOptions.length - 1)));
  }, [filteredOptions.length]);

  // Styling ukuran tombol
  const sizeClasses = {
    xs: "px-2 py-1 text-[11px] rounded-lg gap-1.5",
    sm: "px-2.5 py-1.5 text-xs rounded-xl gap-2",
    md: "px-3 py-2 text-sm rounded-xl gap-2",
  }[size] || "px-2.5 py-1.5 text-xs rounded-xl gap-2";

  const chevronSizes = { xs: 11, sm: 13, md: 14 }[size] || 13;
  const iconSizes = { xs: 12, sm: 13, md: 14 }[size] || 13;

  const handleSelect = (opt) => {
    if (opt.disabled) return;
    onChange(opt.value);
    setOpen(false);
  };

  // U-6 Batch B: navigasi keyboard (WAI-ARIA listbox pattern).
  // Panah gerakkan active, Enter pilih, Home/End lompat, Tab tutup.
  // Escape sudah ditutup via useFloatingDropdown.
  const handleTriggerKeyDown = (e) => {
    if (!open && (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Enter" || e.key === " ")) {
      e.preventDefault();
      setOpen(true);
      return;
    }
    if (!open) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, filteredOptions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Home") {
      e.preventDefault();
      setActiveIndex(0);
    } else if (e.key === "End") {
      e.preventDefault();
      setActiveIndex(filteredOptions.length - 1);
    } else if (e.key === "Enter") {
      const opt = filteredOptions[activeIndex];
      if (opt) {
        e.preventDefault();
        handleSelect(opt);
      }
    } else if (e.key === "Tab") {
      setOpen(false);
    }
  };

  return (
    <div className={`relative inline-block ${fullWidth ? "w-full" : ""}`}>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen((prev) => !prev)}
        onKeyDown={handleTriggerKeyDown}
        className={`sm-btn flex items-center justify-between font-semibold transition-all cursor-pointer select-none ${sizeClasses} ${
          fullWidth ? "w-full" : ""
        } ${disabled ? "opacity-40 cursor-not-allowed" : ""} ${className}`}
        style={{
          background: colors.glassFill || "rgba(255,255,255,0.05)",
          border: `1px solid ${open ? (colors.mint || "#10B981") + "88" : (colors.glassBorder || "rgba(255,255,255,0.12)")}`,
          color: colors.text || "#F8FAFC",
          ...buttonStyle,
        }}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={menuId}
        aria-activedescendant={open && filteredOptions[activeIndex] ? `${menuId}-${activeIndex}` : undefined}
      >
        <span className="flex items-center gap-1.5 min-w-0 truncate">
          {Icon && (
            <Icon
              size={iconSizes}
              style={{ color: colors.textMuted || "#94A3B8" }}
              className="shrink-0"
            />
          )}
          <span className="truncate">
            {selectedOption ? selectedOption.label : placeholder}
          </span>
          {selectedOption?.badge && (
            <span
              className="text-[10px] font-normal px-1.5 py-0.2 rounded-md shrink-0"
              style={{
                background: isLight ? "#E2E8F0" : "rgba(255,255,255,0.1)",
                color: colors.textMuted || "#94A3B8",
              }}
            >
              {selectedOption.badge}
            </span>
          )}
        </span>

        <ChevronDown
          size={chevronSizes}
          className="shrink-0 ml-1.5"
          style={{
            color: colors.textMuted || "#94A3B8",
            transform: open ? "rotate(180deg)" : "none",
            transition: "transform .2s ease",
          }}
        />
      </button>

      {open &&
        createPortal(
          <div
            ref={dropdownRef}
            role="listbox"
            id={menuId}
            aria-label={placeholder}
            className="sm-fadein fixed z-[99999] rounded-xl p-1.5 shadow-2xl flex flex-col"
            style={{
              top: dropdownPos.top,
              left: dropdownPos.left,
              width: dropdownPos.width,
              color: colors.text || "#F8FAFC",
              background: `radial-gradient(120% 60% at 15% -5%, ${colors.glassSheen || "rgba(255,255,255,0.10)"}, transparent 55%), ${
                colors.dropdownBg || (isLight ? "#FFFFFF" : "#0F172A")
              }`,
              backdropFilter: "blur(32px) saturate(1.4)",
              WebkitBackdropFilter: "blur(32px) saturate(1.4)",
              border: `1px solid ${colors.dropdownBorder || colors.glassBorder || "rgba(255,255,255,0.12)"}`,
              boxShadow: `${colors.glassShadow || "0 10px 25px -5px rgba(0,0,0,0.4)"}, inset 0 1px 0 ${
                colors.glassHighlight || "rgba(255,255,255,0.08)"
              }`,
            }}
          >
            {/* Input Pencarian jika opsi banyak */}
            {isSearchable && (
              <div
                className="flex items-center gap-2 px-2.5 py-1.5 mb-1.5 rounded-lg shrink-0"
                style={{ background: colors.glassSubtle || "rgba(255,255,255,0.05)" }}
              >
                <Search size={12} style={{ color: colors.textMuted || "#94A3B8" }} />
                <input
                  type="text"
                  aria-label={searchPlaceholder || "Cari opsi..."}
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  onKeyDown={(e) => {
                    // Panah/Enter di kotak search teruskan ke navigasi opsi
                    if (["ArrowDown", "ArrowUp", "Home", "End", "Enter"].includes(e.key)) {
                      e.preventDefault();
                      handleTriggerKeyDown(e);
                    }
                  }}
                  placeholder={searchPlaceholder}
                  className="bg-transparent outline-none text-xs w-full"
                  style={{ color: colors.text || "#F8FAFC" }}
                />
              </div>
            )}

            {/* List Item Opsi */}
            <div className="max-h-56 overflow-y-auto space-y-0.5 pr-0.5">
              {filteredOptions.length === 0 ? (
                <div className="text-xs px-3 py-2.5 text-center" style={{ color: colors.textMuted || "#94A3B8" }}>
                  Tidak ada hasil
                </div>
              ) : (
                filteredOptions.map((opt, idx) => {
                  const isSelected = opt.value === value;
                  const isActive = idx === activeIndex;
                  return (
                    <button
                      key={String(opt.value)}
                      type="button"
                      role="option"
                      id={`${menuId}-${idx}`}
                      aria-selected={isSelected}
                      disabled={opt.disabled}
                      onClick={() => handleSelect(opt)}
                      onMouseEnter={() => setActiveIndex(idx)}
                      className={`sm-row w-full text-left flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg text-xs transition-colors cursor-pointer ${
                        opt.disabled ? "opacity-40 cursor-not-allowed" : ""
                      }`}
                      style={{
                        background: isSelected
                          ? (colors.mint || "#10B981") + "20"
                          : isActive
                            ? (colors.glassFillStrong || "rgba(255,255,255,0.08)")
                            : "transparent",
                        color: isSelected
                          ? (colors.mint || "#10B981")
                          : opt.color || (colors.text || "#F8FAFC"),
                        fontWeight: isSelected ? 700 : 500,
                      }}
                    >
                      <div className="flex items-center gap-2 min-w-0 truncate">
                        {opt.icon && (
                          <opt.icon
                            size={12}
                            style={{ color: isSelected ? colors.mint : colors.textMuted }}
                            className="shrink-0"
                          />
                        )}
                        <span className="truncate">{opt.label}</span>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {opt.badge && (
                          <span
                            className="text-[10px] px-1.5 py-0.5 rounded font-normal"
                            style={{
                              background: isLight ? "#E2E8F0" : "rgba(255,255,255,0.08)",
                              color: colors.textMuted || "#94A3B8",
                            }}
                          >
                            {opt.badge}
                          </span>
                        )}
                        {isSelected && (
                          <Check size={12} style={{ color: colors.mint || "#10B981" }} />
                        )}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
