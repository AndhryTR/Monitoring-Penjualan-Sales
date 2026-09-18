/* ============================================================================
   GLOBAL STYLE — template literal CSS untuk aplikasi.
   ⚠️ Sprint 6 / R3: sebelumnya inline di SalesMonitoringApp.jsx (~130 baris).
   Dipisah ke file sendiri supaya SalesMonitoringApp.jsx fokus jadi orchestrator.
   File ini pure function — terima `colors` + `powerSaveMode`, return CSS string.
   Dipakai lewat useMemo di SalesMonitoringApp, lalu di-inject sebagai <style>.
============================================================================ */

export function createGlobalStyle(colors, powerSaveMode) {
  return `
@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@500;600;700&display=swap');
* { box-sizing: border-box; }
.smapp { font-family: 'Inter', sans-serif; color: ${colors.text}; background: ${colors.meshBg}; position: relative; }
/* --- Tauri desktop (Acrylic + hybrid scrim): latar app transparan supaya
       material Acrylic Windows 11 di belakang WebView terlihat (class is-tauri
       dipasang via deteksi __TAURI_INTERNALS__). Karena backdrop-filter CSS
       TIDAK bisa memblur layer native di belakang webview, header bar & panel
       melayang diberi scrim semi-opaque lebih pekat (naikkan alpha token glass)
       supaya teks tetap kontras tanpa blur. Aurora mesh diredam jadi aksen tipis.
       Browser/PWA tak berubah. --- */
html, body {
  background: transparent;
  font-family: 'Inter', sans-serif;
  color: ${colors.text};
}
.smapp.is-tauri { background: transparent; }
.smapp.is-tauri .sm-mesh { opacity: .35; }
/* Scrim hybrid: header bar (sm-card sticky) & elemen melayang butuh alpha lebih
   tinggi di atas Acrylic — blur dihilangkan (tak ada bahan web untuk diblur). */
.smapp.is-tauri .sm-card { backdrop-filter: none; -webkit-backdrop-filter: none; }
.smapp.is-tauri .sm-btn { backdrop-filter: none; -webkit-backdrop-filter: none; }
.smapp.is-tauri .sm-header-search { backdrop-filter: none; -webkit-backdrop-filter: none; }
.smapp.is-tauri .sm-slider { backdrop-filter: none; -webkit-backdrop-filter: none; }
.disp, .smapp .disp { font-family: 'Space Grotesk', sans-serif; }
.mono, .smapp .mono { font-family: 'JetBrains Mono', monospace; }
*::-webkit-scrollbar, .smapp *::-webkit-scrollbar { height: 8px; width: 8px; }
*::-webkit-scrollbar-thumb, .smapp *::-webkit-scrollbar-thumb { background: ${colors.border}; border-radius: 4px; border: 2px solid ${colors.ink}; }
*::-webkit-scrollbar-track, .smapp *::-webkit-scrollbar-track { background: transparent; }
/* Sembunyikan scrollbar pada mobile bottom nav (scroll-snap horizontal) */
.sm-scrollhide::-webkit-scrollbar { display: none; }
/* --- Aurora mesh background (Fase 4 — final spec, 5 blobs) --- */
.sm-mesh { position: fixed; inset: 0; z-index: 0; overflow: hidden; pointer-events: none; }
.sm-mesh .blob { position: absolute; border-radius: 50%; filter: blur(60px); will-change: transform; }
.sm-noise { position: absolute; inset: -10%; opacity: .04; background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E"); background-size: 180px 180px; }
.sm-mesh .blob-1 { top: -12%; left: -10%; animation: smBlobA 28s cubic-bezier(.4,0,.2,1) infinite; }
.sm-mesh .blob-2 { top: 22%; right: -14%; animation: smBlobB 34s cubic-bezier(.4,0,.2,1) infinite; }
.sm-mesh .blob-3 { bottom: -14%; left: 12%; animation: smBlobC 31s cubic-bezier(.4,0,.2,1) infinite; }
.sm-mesh .blob-4 { bottom: -10%; right: 8%; animation: smBlobD 26s cubic-bezier(.4,0,.2,1) infinite; }
.sm-mesh .blob-5 { top: 38%; left: 38%; animation: smBlobE 33s cubic-bezier(.4,0,.2,1) infinite; }
@keyframes smBlobA { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(6%,4%) scale(1.08); } }
@keyframes smBlobB { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(-5%,6%) scale(1.05); } }
@keyframes smBlobC { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(4%,-5%) scale(1.1); } }
@keyframes smBlobD { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(-4%,-4%) scale(1.06); } }
@keyframes smBlobE { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(5%,5%) scale(1.04); } }
@keyframes smFadeUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
@keyframes smFadeIn { from { opacity: 0; } to { opacity: 1; } }
@keyframes smPageIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
@keyframes smPulse { 0%,100% { opacity:1 } 50% { opacity:.55 } }
@keyframes smShimmer { 0% { background-position: -400px 0; } 100% { background-position: 400px 0; } }
@keyframes smDash { from { stroke-dashoffset: 300; } to { stroke-dashoffset: 0; } }
@media (prefers-reduced-motion: reduce) { .sm-mesh .blob { animation: none; } }
/* Saat scroll aktif ATAU tab browser sedang tidak aktif/disembunyikan:
   hentikan animasi blob & sembunyikan noise sementara. Animasi blob
   (translate+scale infinite) membebani compositor GPU setiap frame — kalau
   dibiarkan jalan terus SELAMA scroll juga berlangsung (yang butuh compositor
   juga), keduanya rebutan resource dan bikin scroll terasa patah-patah di
   device lemah. Begitu tab disembunyikan (pindah aplikasi/tab lain), animasi
   ini bahkan tidak terlihat sama sekali — jadi sayang kalau tetap jalan &
   buang daya. Blob & noise cuma dekorasi ambient, aman dibekukan sesaat;
   otomatis nyala lagi begitu scroll berhenti / tab aktif lagi. */
.sm-mesh.sm-scrolling .blob { animation-play-state: paused; }
.sm-mesh.sm-scrolling .sm-noise { display: none; }
.sm-fadeup { animation: smFadeUp .45s cubic-bezier(.16,1,.3,1) backwards; transition: background .3s ease, border-color .3s ease, box-shadow .3s ease; }
/* Toast in-window (ToastHost) — slide dari kanan + fade */
@keyframes smToastIn { from { opacity: 0; transform: translateX(24px); } to { opacity: 1; transform: translateX(0); } }
.sm-toast-in { animation: smToastIn .3s cubic-bezier(.16,1,.3,1); }
/* Bottom-sheet (mobile header drawer) — slide-up dari bawah + fade */
@keyframes smSlideUp { from { transform: translateY(100%); opacity: .6; } to { transform: translateY(0); opacity: 1; } }
.sm-slide-up { animation: smSlideUp .3s cubic-bezier(.16,1,.3,1); }
.sm-fadein { animation: smFadeIn .3s ease both; transition: background .3s ease, border-color .3s ease, box-shadow .3s ease; }
.sm-page-enter { animation: smPageIn .25s cubic-bezier(.16,1,.3,1); }
.sm-pulse { animation: smPulse 1.8s ease-in-out infinite; }
.sm-shimmer { background: linear-gradient(90deg, ${colors.surface2} 0%, ${colors.border} 50%, ${colors.surface2} 100%); background-size: 800px 100%; animation: smShimmer 1.4s linear infinite; }
.sm-card { background: radial-gradient(130% 90% at 12% -10%, ${colors.glassSheen}, transparent 55%), ${colors.glassFill}; border: 1px solid ${colors.glassBorder}; border-radius: 16px; backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); transition: transform .25s ease, box-shadow .25s ease, background .3s ease, border-color .3s ease; box-shadow: ${colors.glassShadow}, inset 0 1px 0 ${colors.glassHighlight}; }
.sm-card:hover { transform: translateY(-2px); background: radial-gradient(130% 90% at 12% -10%, ${colors.glassSheen}, transparent 55%), ${colors.glassFillStrong}; border-color: ${colors.glassBorderElevated}; box-shadow: ${colors.glassShadow}, inset 0 1px 0 ${colors.glassHighlight}; will-change: transform; }
.sm-glow-wrap { position: relative; }
.sm-glow-wrap .sm-glow { position: absolute; inset: -8px; border-radius: 20px; filter: blur(18px); opacity: .12; z-index: -1; pointer-events: none; transition: opacity .3s ease; }
.sm-glow-wrap:hover .sm-glow { opacity: .20; }
.sm-kpi-accent-line { position: absolute; top: 0; left: 0; right: 0; height: 3px; border-radius: 16px 16px 0 0; }
.sm-sidebar-glass { background: radial-gradient(120% 70% at 15% -10%, ${colors.glassSheen}, transparent 55%), ${colors.glassFill}; backdrop-filter: blur(32px); -webkit-backdrop-filter: blur(32px); border: 1px solid ${colors.glassBorder}; box-shadow: ${colors.glassShadow}, inset 0 1px 0 ${colors.glassHighlight}; }
.sm-mobile-nav-glass { background: radial-gradient(140% 200% at 20% -60%, ${colors.glassSheen}, transparent 60%), ${colors.glassFillStrong}; backdrop-filter: blur(28px); -webkit-backdrop-filter: blur(28px); border: 1px solid ${colors.glassBorderElevated}; box-shadow: ${colors.glassShadow}, inset 0 1px 0 ${colors.glassHighlight}; }
.sm-modal-glass { background: radial-gradient(120% 60% at 15% -5%, ${colors.glassSheen}, transparent 55%), ${colors.modalPanelBg} !important; border: 1px solid ${colors.modalBorder} !important; backdrop-filter: blur(40px) !important; -webkit-backdrop-filter: blur(40px) !important; }
.sm-tab-btn { position: relative; transition: color .2s ease; }
.sm-chip { transition: all .18s ease; }
.sm-chip:hover { transform: translateY(-1px); }
.sm-row { transition: background .15s ease; }
.sm-row:hover { background: ${colors.glassFillStrong}; }
.sm-btn { background: ${colors.glassFill}; border: 1px solid ${colors.glassBorder}; backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); transition: transform .2s ease, box-shadow .2s ease, background .2s ease; box-shadow: 0 4px 16px rgba(0,0,0,.18), inset 0 1px 0 ${colors.glassHighlight}; }
.sm-btn:hover { transform: translateY(-2px); background: ${colors.glassFillStrong}; box-shadow: 0 6px 20px rgba(0,0,0,.22), inset 0 1px 0 ${colors.glassHighlight}; }
.sm-btn:active { transform: translateY(0); box-shadow: inset 0 2px 8px rgba(0,0,0,.25); }
.sm-progress-fill { transition: width 1s cubic-bezier(.16,1,.3,1); }
@keyframes smModalPop { 0% { opacity: 0; transform: scale(0.96) translateY(8px); } 100% { opacity: 1; transform: scale(1) translateY(0); } }
.sm-scale-in { animation: smModalPop .24s cubic-bezier(.16,1,.3,1) both; }

/* --- Header Redesign (Sprint 18 / Header Redesign) --- */
/* Divider vertikal antar grup tombol di header utama. Gradient transparan di
   tepi atas-bawah supaya terlihat halus, bukan garis tegas penuh. */
.sm-header-divider {
  width: 1px;
  height: 22px;
  background: linear-gradient(to bottom, transparent, ${colors.glassBorder} 30%, ${colors.glassBorder} 70%, transparent);
  margin: 0 4px;
  flex-shrink: 0;
}
/* Search bar prominent di header — input-style glass dengan hover glow mint.
   ⚠️ Sprint 18d11 / Mobile fix: hapus 'display: flex' dari sini. Sebelumnya
   'display: flex' hardcoded di sini meng-override Tailwind class 'hidden'
   (display: none) → search bar prominent TETAP muncul di mobile walau pakai
   'hidden md:flex'. Sekarang display di-set via Tailwind utility class di
   elemen button (lihat SalesMonitoringApp.jsx — pakai 'hidden md:flex' supaya
   hidden di mobile, flex di desktop). align-items + gap tetap di sini supaya
   layout internal search bar tetap rapi saat dia visible. */
.sm-header-search {
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  background: radial-gradient(130% 90% at 12% -10%, ${colors.glassSheen || 'rgba(255,255,255,0.06)'}, transparent 55%), ${colors.glassFill};
  border: 1px solid ${colors.glassBorder};
  border-radius: 12px;
  color: ${colors.textMuted};
  font-size: 13px;
  cursor: pointer;
  transition: all .18s ease;
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  box-shadow: inset 0 1px 0 ${colors.glassHighlight || 'rgba(255,255,255,0.08)'};
}
.sm-header-search:hover {
  background: radial-gradient(130% 90% at 12% -10%, ${colors.glassSheen || 'rgba(255,255,255,0.06)'}, transparent 55%), ${colors.glassFillStrong};
  border-color: ${colors.mint}44;
  box-shadow: 0 0 0 3px ${colors.mint}0F, inset 0 1px 0 ${colors.glassHighlight || 'rgba(255,255,255,0.08)'};
}
.sm-slider {
  border: 1px solid ${colors.glassBorder};
  border-radius: 999px;
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  outline: none;
}
.sm-slider::-webkit-slider-runnable-track {
  height: 8px;
  border-radius: 999px;
  background: transparent;
}
.sm-slider::-moz-range-track {
  height: 8px;
  border-radius: 999px;
  background: transparent;
}
.sm-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 16px;
  height: 16px;
  margin-top: -4px;
  border-radius: 50%;
  background: ${colors.gold};
  border: 2px solid rgba(255,255,255,.5);
  cursor: pointer;
  box-shadow: 0 0 10px rgba(0,0,0,.25), inset 0 1px 0 rgba(255,255,255,.4);
  transition: transform .15s ease, box-shadow .15s ease;
}
.sm-slider::-webkit-slider-thumb:hover { transform: scale(1.15); box-shadow: 0 0 14px ${colors.gold}77, inset 0 1px 0 rgba(255,255,255,.5); }
.sm-slider::-moz-range-thumb {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: ${colors.gold};
  border: 2px solid rgba(255,255,255,.5);
  cursor: pointer;
  box-shadow: 0 0 10px rgba(0,0,0,.25), inset 0 1px 0 rgba(255,255,255,.4);
  transition: transform .15s ease, box-shadow .15s ease;
}
.sm-slider::-moz-range-thumb:hover { transform: scale(1.15); }
.sm-slider:focus-visible::-webkit-slider-thumb { box-shadow: 0 0 0 4px ${colors.mint}44, 0 0 10px rgba(0,0,0,.25); }
.sm-slider:focus-visible::-moz-range-thumb { box-shadow: 0 0 0 4px ${colors.mint}44, 0 0 10px rgba(0,0,0,.25); }
${powerSaveMode ? `
/* --- Mode Hemat Daya ---
   backdrop-filter (blur di belakang kaca) adalah operasi PALING mahal di
   seluruh desain ini — jauh lebih berat dari animasi blob atau shadow.
   Blanket rule ini menghilangkannya TOTAL dari SEMUA elemen sekaligus,
   termasuk yang di-set inline lewat JS (style={{backdropFilter:...}}) yang
   tersebar di banyak file (dropdown, tooltip, dsb) — !important di
   stylesheet MENANG atas inline style biasa (yang tidak !important), jadi
   satu rule ini cukup tanpa perlu menyentuh file komponen manapun. Warna
   solid/opaque-nya sendiri sudah ditangani terpisah lewat
   applyPowerSaveColors() di constants/colors.js (mengganti isi token
   glassFill dkk, bukan lewat CSS). Diletakkan PALING BAWAH supaya menang
   dari rule !important lain (mis. .sm-modal-glass) lewat urutan sumber. */
.sm-powersave * { backdrop-filter: none !important; -webkit-backdrop-filter: none !important; }
.sm-powersave .sm-glow { display: none; }
` : ""}
`;
}

/**
 * Style object untuk tooltip Recharts yang dipakai di chart dashboard.
 * @param {Object} colors - token warna aktif
 * @returns {Object} style object untuk prop contentStyle di Recharts <Tooltip>
 */
export const createChartTooltipStyle = (colors) => ({
  background: colors.modalBg,
  backdropFilter: "blur(28px)",
  WebkitBackdropFilter: "blur(28px)",
  border: `1px solid ${colors.modalBorder}`,
  borderRadius: 10,
  color: colors.text,
  fontSize: 12,
  boxShadow: colors.glassShadow,
});

/**
 * Warna bar per periode: palet 5 tema -> 10 ekstra -> HSL golden-angle.
 */
export function periodColorPicker(colors) {
  const BASE = ["gold", "mint", "violet", "blue", "coral"];
  const EXTRA = ["#F472B6", "#38BDF8", "#A3E635", "#FB923C", "#818CF8", "#2DD4BF", "#E879F9", "#FACC15", "#4ADE80", "#FB7185"];
  return (p, i) => {
    if (i < BASE.length) return colors[BASE[i]];
    const x = i - BASE.length;
    if (x < EXTRA.length) return EXTRA[x];
    return `hsl(${((x - EXTRA.length) * 137.508) % 360}, 70%, 55%)`;
  };
}

