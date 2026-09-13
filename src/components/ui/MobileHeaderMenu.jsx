import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { Search, Monitor, History as HistoryIcon, Settings as SettingsIcon, Sun, Moon, UserCircle, LogIn, Smartphone, Download, Menu, X, Sparkles } from "lucide-react";
import { useEscapeKey, useFocusTrap, useScrollLock } from "../../hooks/useModalA11y.js";

/* ============================================================================
   MOBILE HEADER MENU — hamburger drawer (mobile only)
   Menggantikan barisan tombol aksi (Search, Slideshow, Export, History,
   Avatar) di header saat breakpoint mobile dengan SATU tombol hamburger.

   Drawer = bottom-sheet (slide-up) glass, berisi:
   - Header user (avatar + nama + status sync) → buka kelola akun
   - Pencarian Global
   - Mode Pajangan (slidershow)
   - Export (pakai ExportMenu existing — dropdown/bottom-sheet sendiri)
   - Snapshot Periode
   - Pengaturan
   - Toggle tema
   - Akun & Sync (login/logout)
   - Instal PWA + Backup & Data

   Desktop TIDAK terpengaruh — komponen ini hanya di-render saat `md:hidden`.
============================================================================ */

export function MobileHeaderMenu({
  colors, theme,
  sessionUser, syncState = "idle",
  onOpenSettings, onOpenLogin, onLogout, onOpenBackup,
  onOpenSearch, searchDisabled,
  onStartSlideshow, slideshowDisabled,
  onOpenHistory, historyDisabled,
  onToggleTheme,
  onInstallPwa, canInstallPwa,
  onOpenAiChat, showAiChat = true,
}) {
  const [open, setOpen] = useState(false);
  const sheetRef = useRef(null);

  useEscapeKey(open, () => setOpen(false));
  // U-6: kunci Tab di dalam sheet + kunci scroll via hook bersama (counter-safe).
  useFocusTrap(open, sheetRef);
  useScrollLock(open);

  // Tutup saat klik di luar (backdrop). Trigger button juga dicek
  // supaya toggle tidak konflik.
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (sheetRef.current && sheetRef.current.contains(e.target)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const close = useCallback(() => setOpen(false), []);
  const run = useCallback((fn) => { close(); fn?.(); }, [close]);

  const isAuthed = !!sessionUser;
  const initials = isAuthed ? (sessionUser.email || "U").slice(0, 2).toUpperCase() : "L";
  const dotColor = !isAuthed ? colors.textMuted
    : syncState === "syncing" ? colors.gold
    : syncState === "error" ? colors.coral
    : colors.mint;
  const statusLabel = !isAuthed ? "Mode lokal — data di perangkat ini"
    : syncState === "syncing" ? "Sedang sinkron..."
    : syncState === "error" ? "Sinkronisasi gagal"
    : "Tersinkron ke cloud";

  return (
    <>
      {/* Trigger: hamburger — hanya mobile */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="sm-btn w-9 h-9 rounded-xl flex md:hidden items-center justify-center shrink-0"
        style={{ background: colors.glassFill, color: colors.text, border: `1px solid ${colors.glassBorder}` }}
        aria-label="Menu"
        aria-expanded={open}
        aria-haspopup="dialog"
        title="Menu"
      >
        {open ? <X size={15} /> : <Menu size={15} />}
      </button>

      {open && createPortal(
        <>
          {/* Backdrop */}
          <div
            style={{ position: "fixed", inset: 0, zIndex: 70, background: "rgba(0,0,0,0.45)" }}
            onClick={close}
          />
          {/* Bottom sheet */}
          <div
            ref={sheetRef}
            role="dialog"
            aria-modal="true"
            aria-label="Menu"
            className="sm-slide-up"
            style={{
              position: "fixed",
              left: 0, right: 0, bottom: 0,
              zIndex: 71,
              maxHeight: "85vh",
              overflowY: "auto",
              borderTopLeftRadius: 18,
              borderTopRightRadius: 18,
              padding: "10px 0 24px",
              color: colors.text,
              background: `radial-gradient(120% 60% at 15% -5%, ${colors.glassSheen || "rgba(255,255,255,0.10)"}, transparent 55%), ${colors.modalPanelBg}`,
              backgroundBlendMode: "overlay",
              backdropFilter: "blur(24px) saturate(1.4)",
              WebkitBackdropFilter: "blur(24px) saturate(1.4)",
              border: `1px solid ${colors.dropdownBorder}`,
              boxShadow: "0 -12px 40px rgba(0,0,0,0.40), inset 0 1px 0 rgba(255,255,255,0.08)",
            }}
          >
            {/* Grab handle */}
            <div style={{ display: "flex", justifyContent: "center", paddingBottom: 8 }}>
              <div style={{ width: 40, height: 4, borderRadius: 99, background: colors.glassBorder }} />
            </div>

            {/* User header */}
            <button
              onClick={() => run(onOpenLogin)}
              style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", padding: "10px 18px 14px", borderBottom: `1px solid ${colors.glassBorder}`, cursor: "pointer", background: "transparent", borderTop: "none", borderLeft: "none", borderRight: "none" }}
            >
              <div style={{ width: 40, height: 40, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, border: `2px solid ${colors.glassBorder}`, background: isAuthed ? `linear-gradient(135deg, ${colors.mint}, ${colors.blue})` : `linear-gradient(135deg, ${colors.glassFillStrong}, ${colors.glassFill})`, color: isAuthed ? colors.ink : colors.textMuted, position: "relative" }}>
                {isAuthed ? initials : <UserCircle size={18} />}
                <span style={{ position: "absolute", bottom: -1, right: -1, width: 11, height: 11, borderRadius: "50%", background: dotColor, border: `2px solid ${colors.modalPanelBg}` }} />
              </div>
              <div style={{ textAlign: "left" }}>
                <div style={{ fontSize: 14, fontWeight: 700 }}>{isAuthed ? (sessionUser.email || "Akun Cloud") : "Local User"}</div>
                <div style={{ fontSize: 11, color: colors.textMuted, marginTop: 2 }}>{statusLabel}</div>
              </div>
            </button>

            {/* Menu items */}
            <div style={{ padding: 8, display: "flex", flexDirection: "column", gap: 2 }}>
              {showAiChat && (
                <Item icon={Sparkles} label="Asisten AI Automasi" colors={colors} primary={true} onClick={() => run(onOpenAiChat)} />
              )}
              <Item icon={Search} label="Pencarian Global" colors={colors} disabled={searchDisabled} onClick={() => run(onOpenSearch)} />
              <Item icon={Monitor} label="Mode Pajangan" colors={colors} disabled={slideshowDisabled} onClick={() => run(onStartSlideshow)} />
              <Item icon={HistoryIcon} label="Snapshot Periode" colors={colors} disabled={historyDisabled} onClick={() => run(onOpenHistory)} />
              <Item icon={theme === "dark" ? Sun : Moon} label={`Tema ${theme === "dark" ? "Terang" : "Gelap"}`} colors={colors} onClick={onToggleTheme} />

              <div style={{ borderTop: `1px solid ${colors.glassBorder}`, margin: "6px 0", paddingTop: 6 }} />
              <Item icon={SettingsIcon} label="Pengaturan" colors={colors} onClick={() => run(onOpenSettings)} />
              {canInstallPwa && <Item icon={Smartphone} label="Instal Aplikasi (PWA)" colors={colors} onClick={() => run(onInstallPwa)} />}
              <Item icon={Download} label="Backup & Data" colors={colors} onClick={() => run(onOpenBackup)} />
              <Item icon={isAuthed ? UserCircle : LogIn} label={isAuthed ? "Kelola Akun & Sync" : "Masuk Akun Cloud"} colors={colors} primary={!isAuthed} onClick={() => run(onOpenLogin)} />
            </div>
          </div>
        </>,
        document.body
      )}
    </>
  );
}

/* ---- Menu item helper (konsisten dengan PopoverItem AvatarButton) ---- */
function Item({ icon: Icon, label, colors, onClick, disabled = false, primary = false }) {
  const color = primary ? colors.mint : colors.text;
  const iconColor = primary ? colors.mint : colors.textMuted;
  const hoverBg = primary ? `${colors.mint}1A` : colors.glassFillStrong;
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        display: "flex", alignItems: "center", gap: 12, padding: "11px 16px",
        borderRadius: 10, cursor: disabled ? "not-allowed" : "pointer",
        fontSize: 13, fontWeight: primary ? 600 : 400, color,
        background: "transparent", border: "none", width: "100%", textAlign: "left",
        opacity: disabled ? 0.4 : 1, transition: "background 0.12s ease",
      }}
      onMouseEnter={(e) => { if (!disabled) e.currentTarget.style.background = hoverBg; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
    >
      <Icon size={15} style={{ color: iconColor, flexShrink: 0 }} />
      {label}
    </button>
  );
}
