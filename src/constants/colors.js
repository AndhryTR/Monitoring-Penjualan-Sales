export const THEMES = {
  dark: {
    // Hint CSS color-scheme untuk native form control (popup <select>, kalender
    // <input type="date">) — ini dirender OS/browser sendiri, TIDAK bisa
    // di-style lewat background inline di elemen induknya. Tanpa ini, popup-nya
    // akan selalu putih terang meski kotak tertutupnya sudah gelap.
    colorScheme: "dark",
    ink: "#0A0E1A",
    surface: "#111827",
    surface2: "#1F2937",
    border: "#374151",
    text: "#F9FAFB",
    textMuted: "#9CA3AF",
    // Header tabel butuh kontras lebih tinggi dari textMuted biasa di atas
    // background glass gelap — dipakai khusus oleh semua elemen <th>/thead.
    tableHeader: "#E5E7EB",
    gold: "#FBBF24",
    mint: "#34D399",
    coral: "#F87171",
    violet: "#A78BFA",
    skyblue: "#13b6ff",
    blue: "#60A5FA",
    // Warna teks kontras saat elemen menggunakan aksen solid sebagai background fill (e.g. tombol / badge)
    onGold: "#0A1120",
    onMint: "#0A1120",
    onCoral: "#0A1120",
    onBlue: "#0A1120",
    onViolet: "#0A1120",
    // --- Glass morphism tokens (Fase 4 — final spec) ---
    meshBg: "#0A1120",
    glassSubtle: "rgba(255,255,255,0.03)",
    glassFill: "rgba(255,255,255,0.06)",
    glassFillStrong: "rgba(255,255,255,0.10)",
    glassBorder: "rgba(255,255,255,0.10)",
    glassBorderElevated: "rgba(255,255,255,0.14)",
    glassHighlight: "rgba(255,255,255,0.08)",
    glassShadow: "0 8px 32px rgba(0,0,0,0.37)",
    modalBg: "rgba(15,23,42,0.20)",
    // Token TERPISAH khusus panel modal/bottom-sheet (dipakai lewat .sm-modal-glass)
    // — bukan modalBg. Panel-panel ini selalu duduk DI ATAS overlay peredup
    // bg-black/60 (beda konteks dari dropdown/tooltip yang mengambang tanpa
    // overlay apa pun di baliknya). Kalau modalPanelBg ikut diturunkan opacity-nya
    // serendah modalBg, overlay gelap di baliknya akan "bocor" tembus dan modal
    // terlihat abu-abu gelap alih-alih putih/kaca terang — makanya token ini
    // sengaja dijaga tetap tinggi opacity-nya, independen dari modalBg.
    modalPanelBg: "rgba(15,23,42,0.85)",
    modalBorder: "rgba(255,255,255,0.12)",
    // ⚠️ Sprint 18d / Header Redesign: token khusus untuk dropdown/tooltip yang
    // dirender via createPortal ke document.body (keluar dari .smapp container).
    // Alpha lebih rendah dari modalPanelBg (0.55 vs 0.85) supaya efek glass blur
    // terlihat — dropdown kecil tidak punya overlay hitam di belakang seperti modal.
    // Border pakai glassBorderElevated supaya lebih tegas di background kompleks.
    dropdownBg: "rgba(15,23,42,0.55)",
    dropdownBorder: "rgba(255,255,255,0.14)",
    tooltipBg: "rgba(15,23,42,0.60)",
    chartGrid: "rgba(255,255,255,0.08)",
    glassSheen: "rgba(255,255,255,0.10)",
    blobs: [
      { rgb: "52,211,153", opacity: 0.12, size: 520 },
      { rgb: "167,139,250", opacity: 0.10, size: 560 },
      { rgb: "96,165,250", opacity: 0.10, size: 480 },
      { rgb: "251,191,36", opacity: 0.08, size: 420 },
      { rgb: "52,211,153", opacity: 0.06, size: 600 }
    ]
  },
  light: {
    colorScheme: "light",
    ink: "#F4F6FB",
    surface: "#FFFFFF",
    surface2: "#F3F4F6",
    border: "#E5E7EB",
    text: "#111827",
    textMuted: "#4B5563",
    // Header tabel di mode terang ditingkatkan kontrasnya untuk keterbacaan optimal.
    tableHeader: "#374151",
    gold: "#B45309",
    mint: "#047857",
    coral: "#DC2626",
    violet: "#7C3AED",
    skyblue: "#0EA5E9",
    blue: "#2563EB",
    // Pada mode terang, aksen gold/mint/coral adalah warna pekat (WCAG AA >= 4.5:1),
    // sehingga teks di atas background aksen solid harus PUTIH (#FFFFFF) agar kontras optimal dan tidak kusam.
    onGold: "#FFFFFF",
    onMint: "#FFFFFF",
    onCoral: "#FFFFFF",
    onBlue: "#FFFFFF",
    onViolet: "#FFFFFF",
    // --- Glass morphism tokens (Fase 4 — final spec) ---
    meshBg: "linear-gradient(135deg, #e0e7ff, #f0fdf4, #fef3c7, #ede9fe)",
    glassSubtle: "rgba(255,255,255,0.25)",
    glassFill: "rgba(255,255,255,0.45)",
    glassFillStrong: "rgba(255,255,255,0.60)",
    glassBorder: "rgba(255,255,255,0.50)",
    glassBorderElevated: "rgba(255,255,255,0.65)",
    glassHighlight: "rgba(255,255,255,0.60)",
    glassShadow: "0 8px 32px rgba(0,0,0,0.08)",
    modalBg: "rgba(255,255,255,0.20)",
    modalPanelBg: "rgba(255,255,255,0.85)",
    modalBorder: "rgba(255,255,255,0.65)",
    // ⚠️ Sprint 18d / Header Redesign: token khusus untuk dropdown/tooltip yang
    // dirender via createPortal ke document.body. Light theme: background putih
    // dengan alpha 0.65 (sedikit lebih tinggi dari dark karena background app
    // terang — perlu opacity lebih untuk readability teks gelap).
    dropdownBg: "rgba(255,255,255,0.65)",
    dropdownBorder: "rgba(0,0,0,0.10)",
    tooltipBg: "rgba(255,255,255,0.68)",
    chartGrid: "rgba(17,24,39,0.10)",
    glassSheen: "rgba(255,255,255,0.45)",
    blobs: [
      { rgb: "52,211,153", opacity: 0.22, size: 620 },
      { rgb: "167,139,250", opacity: 0.20, size: 660 },
      { rgb: "96,165,250", opacity: 0.20, size: 580 },
      { rgb: "251,191,36", opacity: 0.16, size: 520 },
      { rgb: "52,211,153", opacity: 0.12, size: 700 }
    ]
  }
};

// Mode Hemat Daya: dipanggil dari SalesMonitoringApp saat toggle aktif. Balik
// SEMUA token translucent ("kaca") jadi solid opaque, pakai token surface/
// surface2 yang sudah ada sejak sebelum redesign glass morphism (tidak pernah
// dihapus, cuma sudah tidak dipakai di mana pun). Karena SETIAP komponen di
// seluruh app membaca warna lewat token ini (colors.glassFill dsb, bukan hex
// literal), mengganti nilainya di SATU tempat ini otomatis membuat seluruh
// dropdown/tooltip/card/modal/sidebar ikut jadi solid — tanpa perlu menyentuh
// satu pun file komponen. Border & shadow SENGAJA tidak diubah (border tipis
// translucent & box-shadow itu murah untuk di-render, bukan sumber lag —
// yang mahal adalah backdrop-filter & gradient sheen, itu yang dihilangkan).
export function applyPowerSaveColors(colors) {
  return {
    ...colors,
    glassSubtle: colors.surface,
    glassFill: colors.surface2,
    glassFillStrong: colors.surface2,
    modalBg: colors.surface2,
    modalPanelBg: colors.surface,
    dropdownBg: colors.surface,
    tooltipBg: colors.surface,
    glassSheen: "transparent",
  };
}

// Mode Desktop Tauri (Acrylic): backdrop-filter CSS tidak bisa memblur layer
// native Acrylic di belakang WebView — jadi elemen melayang diberi scrim
// semi-opaque lebih pekat (alpha naik ~3x dari token web) supaya teks tetap
// kontras tanpa blur. Dipanggil di SalesMonitoringApp hanya bila isTauri.
// ⚠️ Hue scrim SENGAJA sama dengan meshBg (#0A1120 = rgb(10,17,32)) supaya
// card/dropdown menyatu dengan latar app — sebelumnya pakai slate rgb(15,23,42)
// yang hue-nya lebih abu → tampak tidak serasi vs navy app.
export function applyTauriScrimColors(colors) {
  const isDark = colors.colorScheme === "dark";
  return {
    ...colors,
    // Header bar / card: TETAP TRANSPARAN (efek Acrylic terlihat) — hanya
    // dropdown/tooltip & modal yang diberi scrim pekat demi keterbacaan teks.
    glassFill: isDark ? "rgba(10,17,32,0.50)" : "rgba(255,255,255,0.55)",
    glassFillStrong: isDark ? "rgba(10,17,32,0.60)" : "rgba(255,255,255,0.68)",
    glassSheen: isDark ? "rgba(148,180,255,0.06)" : "rgba(255,255,255,0.30)",
    // Dropdown/tooltip melayang tanpa overlay: butuh scrim pekat agar teks kecil terbaca.
    dropdownBg: isDark ? "rgba(10,17,32,0.90)" : "rgba(255,255,255,0.97)",
    modalPanelBg: isDark ? "rgba(10,17,32,0.94)" : "rgba(255,255,255,0.98)",
    tooltipBg: isDark ? "rgba(10,17,32,0.70)" : "rgba(255,255,255,0.76)",
    // Light theme + Acrylic: wallpaper tembus → label abu turun kontras.
    // textMuted digelapkan supaya teks sekunder tetap terbaca di atas kaca transparan.
    ...(isDark ? {} : { textMuted: "#374151", tableHeader: "#374151" }),
  };
}
