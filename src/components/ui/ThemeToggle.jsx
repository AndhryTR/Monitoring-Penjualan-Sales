import { memo } from "react";
import { Sun, Moon } from "lucide-react";

/* ============================================================================
   THEMETOGGLE
   Tombol switch tema Light/Dark dengan fluid motion physics:
   - Dual-layer orbital rotation & spring scaling antara Sun dan Moon
   - Fluid cubic-bezier easing untuk transisi kenyal alami
   - Tactile feedback: micro-bounce saat ditekan & rotasi halus
   - Ambient glow halo adaptif (amber keemasan untuk Sun, cool azure untuk Moon)
   - Dukungan prefers-reduced-motion & aria-label aksesibilitas
============================================================================ */

export const ThemeToggle = memo(function ThemeToggle({
  theme = "dark",
  onToggle,
  colors,
  className = "",
  size = 36,
  title,
}) {
  const isDark = theme === "dark";
  const nextThemeLabel = isDark ? "Beralih ke mode terang" : "Beralih ke mode gelap";
  const buttonTitle = title || nextThemeLabel;

  return (
    <button
      type="button"
      onClick={onToggle}
      className={`sm-btn sm-theme-toggle group relative shrink-0 flex items-center justify-center rounded-xl select-none ${className}`}
      style={{
        width: size,
        height: size,
        background: colors.glassFill,
        border: `1px solid ${colors.glassBorder}`,
        color: colors.text,
      }}
      aria-label={nextThemeLabel}
      title={buttonTitle}
    >
      {/* Ambient hover glow halo */}
      <span
        className="sm-theme-glow absolute inset-0 pointer-events-none rounded-xl"
        style={{
          background: isDark
            ? `radial-gradient(circle at center, ${colors.gold || "#FBBF24"}33 0%, transparent 72%)`
            : `radial-gradient(circle at center, ${colors.blue || "#3B82F6"}2B 0%, transparent 72%)`,
        }}
      />

      {/* Centered animated icon container */}
      <div className="relative w-4 h-4 flex items-center justify-center pointer-events-none">
        {/* Sun Icon (aktif saat Dark Mode -> mengajak ke Light Mode) */}
        <Sun
          size={16}
          className="sm-theme-icon absolute"
          style={{
            color: colors.gold || "#FBBF24",
            transform: isDark
              ? "rotate(0deg) scale(1)"
              : "rotate(90deg) scale(0)",
            opacity: isDark ? 1 : 0,
            transition: "transform 450ms cubic-bezier(0.34, 1.56, 0.64, 1), opacity 320ms ease, color 300ms ease",
          }}
        />

        {/* Moon Icon (aktif saat Light Mode -> mengajak ke Dark Mode) */}
        <Moon
          size={16}
          className="sm-theme-icon absolute"
          style={{
            color: colors.blue || "#3B82F6",
            transform: isDark
              ? "rotate(-90deg) scale(0)"
              : "rotate(0deg) scale(1)",
            opacity: isDark ? 0 : 1,
            transition: "transform 450ms cubic-bezier(0.34, 1.56, 0.64, 1), opacity 320ms ease, color 300ms ease",
          }}
        />
      </div>
    </button>
  );
});

/* ============================================================================
   THEMEANISYMBOL
   Versi ikon animasi mandiri untuk item menu drawer / list.
============================================================================ */
export const ThemeAnimatedIcon = memo(function ThemeAnimatedIcon({
  theme = "dark",
  colors = {},
  size = 15,
  className = "",
  style = {},
}) {
  const isDark = theme === "dark";
  return (
    <div
      className={`relative flex items-center justify-center shrink-0 pointer-events-none ${className}`}
      style={{ width: size, height: size, ...style }}
    >
      <Sun
        size={size}
        className="sm-theme-icon absolute"
        style={{
          color: colors.gold || "#FBBF24",
          transform: isDark ? "rotate(0deg) scale(1)" : "rotate(90deg) scale(0)",
          opacity: isDark ? 1 : 0,
          transition: "transform 450ms cubic-bezier(0.34, 1.56, 0.64, 1), opacity 320ms ease",
        }}
      />
      <Moon
        size={size}
        className="sm-theme-icon absolute"
        style={{
          color: colors.blue || "#3B82F6",
          transform: isDark ? "rotate(-90deg) scale(0)" : "rotate(0deg) scale(1)",
          opacity: isDark ? 0 : 1,
          transition: "transform 450ms cubic-bezier(0.34, 1.56, 0.64, 1), opacity 320ms ease",
        }}
      />
    </div>
  );
});
