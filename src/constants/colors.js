/* ============================================================================
   DESIGN TOKENS
   Tiap tema punya 2 kelompok warna:
   - surface tokens (ink/surface/surface2/border/text/...) — dipakai untuk
     background, teks, dan border di seluruh komponen.
   - accent tokens (gold/mint/coral/violet/blue) — dipakai untuk highlight,
     badge, chart, dan KPI. Saturasi sengaja <80% supaya tidak "berteriak".

   TINTED SHADOWS (lihat SKILL.md: "Colored, tinted shadows"):
   Bayangan memakai hue background (navy di dark, slate di light), BUKAN
   hitam polos (rgba(0,0,0,X)). Ini bikin permukaan terasa lebih "kaya"
   dan profesional, bukan murah. Token elev1/elev2 dipakai di .sm-card &
   .sm-btn; sheetShadow/floatShadow/dropdownShadow dipakai di elemen yang
   "melayang" (bottom-sheet, FAB, dropdown menu).
============================================================================ */
export const THEMES = {
  dark: {
    ink: "#0A1120",
    surface: "#111827",
    surface2: "#1F2937",
    border: "#374151",
    text: "#F9FAFB",
    textMuted: "#9CA3AF",
    gold: "#FBBF24",
    mint: "#34D399",
    coral: "#F87171",
    violet: "#A78BFA",
    blue: "#60A5FA",
    // Neumorphic shadow (elevasi tipis untuk .sm-card & .sm-btn) — tinted navy.
    shadow1: "#070c17",
    shadow2: "#0d1629",
    shadowInset1: "#070c17",
    shadowInset2: "#0d1629",
    // Tinted drop-shadows untuk elemen melayang. Base hue = navy background,
    // bukan hitam polos, supaya bayangan menyatu dengan tema.
    elev1: "0 2px 8px rgba(7,12,23,0.28)",
    elev2: "0 8px 24px rgba(7,12,23,0.40)",
    sheetShadow: "0 -10px 40px rgba(7,12,23,0.55)",
    // FAB: tinted navy + gold glow halus supaya tombol apung terasa "hidup".
    floatShadow: "0 8px 24px rgba(7,12,23,0.45), 0 0 0 1px rgba(251,191,36,0.06)",
    dropdownShadow: "0 10px 30px rgba(7,12,23,0.45)",
  },
  light: {
    ink: "#F9FAFB",
    surface: "#FFFFFF",
    surface2: "#F3F4F6",
    border: "#E5E7EB",
    text: "#111827",
    textMuted: "#6B7280",
    gold: "#D97706",
    mint: "#059669",
    coral: "#DC2626",
    violet: "#7C3AED",
    blue: "#2563EB",
    // Neumorphic shadow light — tinted slate, bukan abu-abu netral dingin.
    shadow1: "#d1d5db",
    shadow2: "#ffffff",
    shadowInset1: "#d1d5db",
    shadowInset2: "#ffffff",
    // Tinted drop-shadows light — base hue slate (17,24,39), bukan hitam.
    elev1: "0 2px 8px rgba(17,24,39,0.08)",
    elev2: "0 8px 24px rgba(17,24,39,0.12)",
    sheetShadow: "0 -10px 40px rgba(17,24,39,0.18)",
    floatShadow: "0 8px 24px rgba(17,24,39,0.18), 0 0 0 1px rgba(217,119,6,0.08)",
    dropdownShadow: "0 10px 30px rgba(17,24,39,0.16)",
  }
};
