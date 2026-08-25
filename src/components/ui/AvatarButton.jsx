import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  Settings as SettingsIcon, Smartphone, Download, LogOut, LogIn, UserCircle,
} from "lucide-react";
import { useEscapeKey } from "../../hooks/useModalA11y.js";

/* ============================================================================
   AVATAR BUTTON — Sprint 18 / Header Redesign
   Avatar bulat (32px) dengan sync status dot + popover glass menu.

   ⚠️ Sprint 18d / Bugfix: popover SELALU bisa dibuka, baik saat user sudah
   login maupun belum. Tujuan: user tetap bisa akses Pengaturan, Instal Aplikasi
   (PWA), dan Backup & Data walau belum login akun cloud.

   Saat belum login:
   - Nama user diganti "Local User" (data diproses lokal di perangkat ini)
   - Status sync: "Mode lokal — data tidak diunggah ke cloud"
   - Tombol "Keluar" diganti "Masuk Akun Cloud" (warna mint, bukan coral)

   Saat sudah login:
   - Nama user: email akun
   - Status sync: synced / syncing / error
   - Tombol "Keluar" (warna coral)

   Props:
   - sessionUser: { email } | null
   - syncState: "idle" | "syncing" | "done" | "error"
   - onOpenSettings, onOpenLogin, onLogout, onInstallPwa, canInstallPwa, onOpenBackup
   - colors

   ⚠️ Sync dot:
   - hijau (mint) = "done" atau sudah login + idle (synced)
   - kuning (gold) = "syncing"
   - merah (coral) = "error"
   - abu-abu (textMuted) = belum login (mode lokal)
============================================================================ */
export function AvatarButton({
  sessionUser, syncState = "idle",
  onOpenSettings, onOpenLogin, onLogout, onInstallPwa, canInstallPwa, onOpenBackup,
  colors,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);
  // ⚠️ Sprint 18d / Header Redesign bugfix: popover dirender via createPortal
  // ke document.body supaya KELUAR dari parent `.sm-card` header yang punya
  // backdrop-filter sendiri. Itu bikin stacking context baru → backdrop-filter
  // child tidak blur konten di belakang parent → efek glass tidak terlihat.
  const popoverRef = useRef(null);
  const [popoverPos, setPopoverPos] = useState({ top: 0, left: 0 });

  // Hitung posisi popover saat open — relatif ke viewport (fixed positioning)
  useEffect(() => {
    if (!isOpen) return;
    const updatePos = () => {
      const btn = containerRef.current?.querySelector("button");
      if (!btn) return;
      const rect = btn.getBoundingClientRect();
      const popoverWidth = 260;
      // Posisi: di bawah tombol, sejajar kanan tombol
      let left = rect.right - popoverWidth;
      if (left < 16) left = 16;
      setPopoverPos({
        top: rect.bottom + 8, // 8px gap di bawah tombol
        left,
      });
    };
    updatePos();
    window.addEventListener("resize", updatePos);
    window.addEventListener("scroll", updatePos, true);
    return () => {
      window.removeEventListener("resize", updatePos);
      window.removeEventListener("scroll", updatePos, true);
    };
  }, [isOpen]);

  // Tutup popover saat klik di luar (cek containerRef untuk trigger button
  // DAN popoverRef untuk popover yang sudah di-portal ke body)
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e) => {
      if (containerRef.current && containerRef.current.contains(e.target)) return;
      if (popoverRef.current && popoverRef.current.contains(e.target)) return;
      setIsOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isOpen]);

  useEscapeKey(isOpen, () => setIsOpen(false));

  const isAuthed = !!sessionUser;

  // Initial untuk avatar text — 2 huruf pertama email, atau "L" (Local) bila belum login
  const initials = isAuthed
    ? (sessionUser.email || "U").slice(0, 2).toUpperCase()
    : "L";

  // Sync dot color
  const dotColor = !isAuthed
    ? colors.textMuted
    : syncState === "syncing" ? colors.gold
    : syncState === "error" ? colors.coral
    : syncState === "done" ? colors.mint
    : colors.mint; // idle = hijau (synced) untuk user yang sudah login

  const dotGlow = !isAuthed
    ? "transparent"
    : syncState === "syncing" ? colors.gold
    : syncState === "error" ? colors.coral
    : colors.mint;

  // User display name + status untuk popover
  const displayName = isAuthed
    ? (sessionUser.email || "Akun Cloud")
    : "Local User";

  const statusLabel = !isAuthed
    ? "Mode lokal — data di perangkat ini"
    : syncState === "syncing" ? "Sedang sinkron..."
    : syncState === "error" ? "Sinkronisasi gagal"
    : syncState === "done" ? "Tersinkron ke cloud"
    : "Tersinkron ke cloud";

  // Avatar selalu bisa di-klik (toggle popover)
  const handleClick = () => {
    setIsOpen((v) => !v);
  };

  const handleMenuClick = (handler) => {
    setIsOpen(false);
    handler?.();
  };

  return (
    <div className="relative" ref={containerRef}>
      {/* Avatar button — selalu toggle popover, baik login maupun tidak */}
      <button
        onClick={handleClick}
        className="sm-avatar shrink-0"
        style={{
          width: 32,
          height: 32,
          borderRadius: "50%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 11,
          fontWeight: 700,
          cursor: "pointer",
          border: `2px solid ${colors.glassBorderElevated || colors.glassBorder}`,
          background: isAuthed
            ? `linear-gradient(135deg, ${colors.mint}, ${colors.blue})`
            : `linear-gradient(135deg, ${colors.glassFillStrong}, ${colors.glassFill})`,
          color: isAuthed ? colors.ink : colors.textMuted,
          boxShadow: isAuthed
            ? `0 4px 12px ${colors.mint}33, inset 0 1px 0 rgba(255,255,255,0.30)`
            : `0 4px 12px rgba(0,0,0,0.18), inset 0 1px 0 ${colors.glassHighlight || "rgba(255,255,255,0.08)"}`,
          transition: "all 0.18s ease",
          position: "relative",
        }}
        title={isAuthed ? (sessionUser.email || "Akun Cloud") : "Local User — klik untuk menu"}
        aria-label={isAuthed ? "Menu user" : "Menu user (mode lokal)"}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = "scale(1.05)";
          if (isAuthed) {
            e.currentTarget.style.boxShadow = `0 6px 16px ${colors.mint}40, inset 0 1px 0 rgba(255,255,255,0.40)`;
          } else {
            e.currentTarget.style.boxShadow = `0 6px 16px rgba(0,0,0,0.24), inset 0 1px 0 ${colors.glassHighlight || "rgba(255,255,255,0.12)"}`;
          }
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = "scale(1)";
          if (isAuthed) {
            e.currentTarget.style.boxShadow = `0 4px 12px ${colors.mint}33, inset 0 1px 0 rgba(255,255,255,0.30)`;
          } else {
            e.currentTarget.style.boxShadow = `0 4px 12px rgba(0,0,0,0.18), inset 0 1px 0 ${colors.glassHighlight || "rgba(255,255,255,0.08)"}`;
          }
        }}
      >
        {isAuthed ? initials : <UserCircle size={16} />}
        {/* Sync status dot */}
        <span
          style={{
            position: "absolute",
            bottom: -1,
            right: -1,
            width: 10,
            height: 10,
            borderRadius: "50%",
            background: dotColor,
            border: `2px solid ${colors.ink}`,
            boxShadow: dotGlow !== "transparent" ? `0 0 8px ${dotGlow}99` : "none",
          }}
        />
      </button>

      {/* Popover menu — selalu tersedia (login atau tidak).
          ⚠️ Sprint 18d / Header Redesign bugfix: dirender via createPortal ke
          document.body supaya KELUAR dari parent `.sm-card` header yang punya
          backdrop-filter sendiri. Alpha background 0.55 (bukan modalPanelBg
          0.85) supaya efek glass blur terlihat. */}
      {isOpen && createPortal(
        <div
          ref={popoverRef}
          className="sm-fadein"
          style={{
            position: "fixed",
            top: popoverPos.top,
            left: popoverPos.left,
            width: 260,
            // ⚠️ Pakai colors.dropdownBg (theme-aware) bukan hardcoded rgba.
            // Set color: colors.text supaya semua child text inherit warna
            // tema aktif — saat portal ke body, kita di luar .smapp container
            // yang biasanya set text color, jadi harus eksplisit.
            color: colors.text,
            background: `radial-gradient(120% 60% at 15% -5%, ${colors.glassSheen || "rgba(255,255,255,0.10)"}, transparent 55%), ${colors.dropdownBg}`,
            border: `1px solid ${colors.dropdownBorder}`,
            borderRadius: 12,
            padding: 8,
            boxShadow: "0 12px 32px rgba(0,0,0,0.40), inset 0 1px 0 rgba(255,255,255,0.08)",
            backdropFilter: "blur(32px) saturate(1.4)",
            WebkitBackdropFilter: "blur(32px) saturate(1.4)",
            zIndex: 50,
          }}
        >
          {/* User info — clickable untuk buka LoginModal/User modal */}
          <div
            onClick={() => handleMenuClick(onOpenLogin)}
            style={{
              padding: "10px 12px",
              borderBottom: `1px solid ${colors.glassBorder}`,
              marginBottom: 4,
              cursor: "pointer",
              borderRadius: 8,
              transition: "background 0.12s ease",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = colors.glassFillStrong; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
            title="Klik untuk kelola akun & sinkronisasi"
          >
            <div style={{ fontSize: 13, fontWeight: 700, color: colors.text, display: "flex", alignItems: "center", gap: 6 }}>
              {displayName}
              {!isAuthed && (
                <span
                  style={{
                    fontSize: 9,
                    fontWeight: 700,
                    padding: "1px 6px",
                    borderRadius: 4,
                    background: colors.glassSubtle,
                    color: colors.textMuted,
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                  }}
                >
                  Local
                </span>
              )}
            </div>
            <div style={{ fontSize: 11, color: colors.textMuted, marginTop: 4, display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: dotColor, boxShadow: dotGlow !== "transparent" ? `0 0 6px ${dotGlow}99` : "none" }} />
              {statusLabel}
            </div>
          </div>

          {/* Menu items */}
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <PopoverItem
              icon={SettingsIcon}
              label="Pengaturan"
              colors={colors}
              onClick={() => handleMenuClick(onOpenSettings)}
            />
            {canInstallPwa && (
              <PopoverItem
                icon={Smartphone}
                label="Instal Aplikasi (PWA)"
                colors={colors}
                onClick={() => handleMenuClick(onInstallPwa)}
              />
            )}
            <PopoverItem
              icon={Download}
              label="Backup & Data"
              colors={colors}
              onClick={() => handleMenuClick(onOpenBackup)}
            />

            <div style={{ borderTop: `1px solid ${colors.glassBorder}`, margin: "4px 0" }} />

            {/* ⚠️ Sprint 19h9: "Kelola Akun" selalu tampil (baik login maupun
                tidak) — buka LoginModal yang berisi tombol sync, status sync,
                dan tombol logout. Sebelumnya kalau sudah login hanya tampil
                "Keluar" tanpa akses ke tombol sync. */}
            <PopoverItem
              icon={isAuthed ? UserCircle : LogIn}
              label={isAuthed ? "Kelola Akun & Sync" : "Masuk Akun Cloud"}
              colors={colors}
              primary={!isAuthed}
              onClick={() => handleMenuClick(onOpenLogin)}
            />
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

/* ---- Popover item helper ---- */
function PopoverItem({ icon: Icon, label, colors, onClick, danger = false, primary = false }) {
  // danger = coral (untuk logout)
  // primary = mint (untuk login CTA)
  const color = danger ? colors.coral : primary ? colors.mint : colors.text;
  const iconColor = danger ? colors.coral : primary ? colors.mint : colors.textMuted;
  const hoverBg = danger ? `${colors.coral}1A` : primary ? `${colors.mint}1A` : colors.glassFillStrong;

  return (
    <button
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "8px 10px",
        borderRadius: 8,
        cursor: "pointer",
        fontSize: 13,
        fontWeight: primary || danger ? 600 : 400,
        color,
        background: "transparent",
        border: "none",
        width: "100%",
        textAlign: "left",
        transition: "background 0.12s ease",
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = hoverBg; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
    >
      <Icon size={14} style={{ color: iconColor }} />
      {label}
    </button>
  );
}
