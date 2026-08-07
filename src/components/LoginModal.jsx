import { useState } from "react";
import { X, LogIn, UserPlus, KeyRound, Mail, User, User as UserIcon, Loader2, AlertTriangle, CheckCircle2, Cloud, LogOut, CloudUpload, CloudOff } from "lucide-react";
import { signInWithIdentifier, signUpAccount, resetPassword } from "../utils/cloud.js";

/* ============================================================================
   LOGIN MODAL
   Modal yang BISA DILEWATI: app jalan penuh tanpa login (data lokal tetap
   utuh). Ikon akun di header membuka modal ini. Dua tab: "Masuk" dan "Daftar".

   MASUK: satu field auto-detect — mengandung "@" -> email, tanpa "@" -> username.
   DAFTAR: username + email + password + konfirmasi (field terpisah).
============================================================================ */

export function LoginModal({ isOpen, onClose, colors, onLoginSuccess, sessionUser, userRole, onLogout, syncState = "idle", lastSyncAt = 0, onManualSync, syncMsg = "" }) {
  const [tab, setTab] = useState("login");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [regUsername, setRegUsername] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regConfirm, setRegConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [forgotMode, setForgotMode] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");

  if (!isOpen) return null;

  const resetForm = () => {
    setError(""); setInfo(""); setForgotMode(false); setForgotEmail("");
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const switchTab = (t) => {
    if (busy) return;
    setTab(t); resetForm();
  };

  const handleLogin = async () => {
    setBusy(true); setError(""); setInfo("");
    const res = await signInWithIdentifier(identifier, password);
    setBusy(false);
    if (res.code === "OK") {
      setInfo("Login berhasil. Sinkronisasi data...");
      // Beri waktu state auth propagate; parent merespons via onAuthChange.
      onLoginSuccess?.();
      setTimeout(() => onClose(), 600);
    } else {
      setError(res.message || "Gagal masuk.");
    }
  };

  const handleRegister = async () => {
    if (regPassword !== regConfirm) { setError("Konfirmasi password tidak cocok."); return; }
    setBusy(true); setError(""); setInfo("");
    const res = await signUpAccount({ username: regUsername, email: regEmail, password: regPassword });
    setBusy(false);
    if (res.code === "OK_SESSION") {
      setInfo("Akun dibuat & Anda sudah masuk. Sinkronisasi dimulai...");
      onLoginSuccess?.();
      setTimeout(() => onClose(), 800);
    } else if (res.code === "NEEDS_CONFIRM") {
      setInfo(`Akun dibuat. Cek email ${res.email} lalu klik link konfirmasi sebelum login.`);
      setTab("login"); resetForm();
    } else {
      setError(res.message || "Gagal mendaftar.");
    }
  };

  const handleForgot = async () => {
    setBusy(true); setError(""); setInfo("");
    const res = await resetPassword(forgotEmail);
    setBusy(false);
    if (res.code === "OK") {
      setInfo("Link reset password dikirim ke email Anda (jika email terdaftar).");
      setForgotMode(false);
    } else {
      setError(res.message || "Gagal mengirim link reset.");
    }
  };

  const inputCls = "w-full px-3.5 py-2.5 rounded-xl text-sm outline-none transition-colors";
  const inputStyle = {
    background: colors.glassFill,
    color: colors.text,
    border: `1px solid ${colors.glassBorder}`,
  };
  const focusCls = "focus:border-[color:var(--sm-mint)]";
  const labelCls = "block text-xs font-semibold mb-1.5";
  const labelStyle = { color: colors.textMuted };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm sm-fadein p-4" onClick={handleClose}>
      <div className="sm-card sm-modal-glass sm-scale-in w-full max-w-md p-6" onClick={(e) => e.stopPropagation()} style={{ maxHeight: "90vh", overflowY: "auto" }}>
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl" style={{ background: colors.mint + "1A" }}>
              <Cloud size={17} style={{ color: colors.mint }} />
            </div>
            <div className="disp text-base font-semibold">Akun & Sinkronisasi</div>
          </div>
          <button onClick={handleClose} className="sm-btn p-2 rounded-full" style={{ background: colors.glassFill }}><X size={16} /></button>
        </div>

        {/* Tab switcher */}
        {sessionUser ? (
          <div className="space-y-4">
            {/* Info akun */}
            <div className="flex items-center gap-3 p-3.5 rounded-xl" style={{ background: colors.glassSubtle, border: `1px solid ${colors.glassBorder}` }}>
              <div className="p-2.5 rounded-xl shrink-0" style={{ background: colors.mint + "1A" }}>
                <UserIcon size={18} style={{ color: colors.mint }} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold truncate" style={{ color: colors.text }}>{sessionUser.email || "Pengguna"}</div>
                <div className="text-[11px] mt-0.5 flex items-center gap-1.5" style={{ color: colors.textMuted }}>
                  {syncState === "syncing" ? (
                    <><CloudUpload size={12} style={{ color: colors.gold }} /> Sinkronisasi berjalan…</>
                  ) : syncState === "done" ? (
                    <><CheckCircle2 size={12} style={{ color: colors.mint }} /> Tersinkron{lastSyncAt ? ` · ${new Date(lastSyncAt).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}` : ""}</>
                  ) : (
                    <><CloudOff size={12} style={{ color: colors.coral }} /> Sinkronisasi offline</>
                  )}
                </div>
                {userRole && (
                  <div className="text-[10px] mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-semibold uppercase tracking-wide"
                    style={{ background: (userRole === "admin" || userRole === "supervisor" ? colors.mint : colors.gold) + "1A", color: (userRole === "admin" || userRole === "supervisor" ? colors.mint : colors.gold) }}>
                    {userRole === "admin" ? "Admin" : userRole === "supervisor" ? "Supervisor" : "User"}
                  </div>
                )}
              </div>
            </div>
            {/* Pesan error/hasil sinkronisasi — supaya kegagalan sync terlihat */}
            {syncMsg && (
              <div className="text-xs px-3 py-2 rounded-lg"
                style={{ color: colors.coral, background: colors.coral + "14", border: `1px solid ${colors.coral}33` }}>
                {syncMsg}
              </div>
            )}
            <button onClick={onManualSync} disabled={syncState === "syncing"}
              className="sm-btn w-full px-3 py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-1.5"
              style={{ background: colors.glassFill, color: colors.text, border: `1px solid ${colors.glassBorder}` }}>
              {syncState === "syncing" ? <Loader2 size={15} className="animate-spin" /> : <CloudUpload size={15} style={{ color: colors.mint }} />} Sinkronkan Sekarang
            </button>
            <button onClick={onLogout}
              className="sm-btn w-full px-3 py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-1.5"
              style={{ background: colors.coral + "14", color: colors.coral, border: `1px solid ${colors.coral}33` }}>
              <LogOut size={15} /> Keluar
            </button>
            <p className="text-[11px] text-center" style={{ color: colors.textMuted }}>
              Data lokal tetap utuh setelah keluar.
            </p>
          </div>
        ) : (
        <div className="flex p-1 rounded-xl mb-5" style={{ background: colors.glassSubtle, border: `1px solid ${colors.glassBorder}` }}>
          {[["login", "Masuk", LogIn], ["register", "Daftar", UserPlus]].map(([key, label, Icon]) => (
            <button key={key} onClick={() => switchTab(key)}
              className="flex-1 sm-tab-btn px-3 py-1.5 rounded-lg text-xs font-semibold inline-flex items-center justify-center gap-1.5"
              style={{ background: tab === key ? colors.glassFillStrong : "transparent", color: tab === key ? colors.mint : colors.textMuted }}>
              <Icon size={13} /> {label}
            </button>
          ))}
        </div>
        )}
        {!sessionUser && (
        <>
        {error && (
          <div className="mb-4 flex items-center gap-2 text-sm px-3.5 py-2.5 rounded-xl" style={{ background: colors.coral + "14", color: colors.coral, border: `1px solid ${colors.coral}33` }}>
            <AlertTriangle size={14} className="shrink-0" /> {error}
          </div>
        )}
        {info && (
          <div className="mb-4 flex items-center gap-2 text-sm px-3.5 py-2.5 rounded-xl" style={{ background: colors.mint + "14", color: colors.mint, border: `1px solid ${colors.mint}44` }}>
            <CheckCircle2 size={14} className="shrink-0" /> {info}
          </div>
        )}

        {tab === "login" ? (
          forgotMode ? (
            <div className="space-y-4">
              <p className="text-sm" style={{ color: colors.textMuted }}>
                Masukkan email terdaftar. Link reset akan dikirim (jika email ada).
              </p>
              <div>
                <label className={labelCls} style={labelStyle}>Email</label>
                <div className="relative">
                  <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: colors.textMuted }} />
                  <input type="email" value={forgotEmail} onChange={(e) => setForgotEmail(e.target.value)} placeholder="nama@email.com"
                    className={`${inputCls} pl-9 ${focusCls}`} style={inputStyle} />
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setForgotMode(false)} className="sm-btn flex-1 px-3 py-2.5 rounded-xl text-sm font-semibold" style={{ border: `1px solid ${colors.glassBorder}`, color: colors.textMuted }}>
                  Kembali
                </button>
                <button onClick={handleForgot} disabled={busy} className="sm-btn flex-1 px-3 py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-1.5" style={{ background: colors.mint, color: "#0A1120" }}>
                  {busy ? <Loader2 size={15} className="animate-spin" /> : <KeyRound size={15} />} Kirim Link
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className={labelCls} style={labelStyle}>Username atau Email</label>
                <div className="relative">
                  <User size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: colors.textMuted }} />
                  <input value={identifier} onChange={(e) => setIdentifier(e.target.value)} placeholder="budi atau budi@email.com"
                    className={`${inputCls} pl-9 ${focusCls}`} style={inputStyle} autoFocus />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold" style={labelStyle}>Password</label>
                  <button onClick={() => setForgotMode(true)} className="text-[11px] font-medium hover:underline" style={{ color: colors.mint }}>
                    Lupa password?
                  </button>
                </div>
                <div className="relative">
                  <KeyRound size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: colors.textMuted }} />
                  <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleLogin()} placeholder="••••••••"
                    className={`${inputCls} pl-9 ${focusCls}`} style={inputStyle} />
                </div>
              </div>
              <button onClick={handleLogin} disabled={busy} className="sm-btn w-full px-3 py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-1.5" style={{ background: colors.mint, color: "#0A1120" }}>
                {busy ? <Loader2 size={15} className="animate-spin" /> : <LogIn size={15} />} Masuk
              </button>
              <p className="text-[11px] text-center" style={{ color: colors.textMuted }}>
                Data lokal tetap aman walau tidak login.
              </p>
            </div>
          )
        ) : (
          <div className="space-y-4">
            <div>
              <label className={labelCls} style={labelStyle}>Username</label>
              <div className="relative">
                <User size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: colors.textMuted }} />
                <input value={regUsername} onChange={(e) => setRegUsername(e.target.value)} placeholder="Min. 3 karakter, unik"
                  className={`${inputCls} pl-9 ${focusCls}`} style={inputStyle} />
              </div>
            </div>
            <div>
              <label className={labelCls} style={labelStyle}>Email</label>
              <div className="relative">
                <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: colors.textMuted }} />
                <input type="email" value={regEmail} onChange={(e) => setRegEmail(e.target.value)} placeholder="nama@email.com"
                  className={`${inputCls} pl-9 ${focusCls}`} style={inputStyle} />
              </div>
            </div>
            <div>
              <label className={labelCls} style={labelStyle}>Password</label>
              <div className="relative">
                <KeyRound size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: colors.textMuted }} />
                <input type="password" value={regPassword} onChange={(e) => setRegPassword(e.target.value)} placeholder="Min. 6 karakter"
                  className={`${inputCls} pl-9 ${focusCls}`} style={inputStyle} />
              </div>
            </div>
            <div>
              <label className={labelCls} style={labelStyle}>Konfirmasi Password</label>
              <div className="relative">
                <KeyRound size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: colors.textMuted }} />
                <input type="password" value={regConfirm} onChange={(e) => setRegConfirm(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleRegister()} placeholder="Ulangi password"
                  className={`${inputCls} pl-9 ${focusCls}`} style={inputStyle} />
              </div>
            </div>
            <button onClick={handleRegister} disabled={busy} className="sm-btn w-full px-3 py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-1.5" style={{ background: colors.mint, color: "#0A1120" }}>
              {busy ? <Loader2 size={15} className="animate-spin" /> : <UserPlus size={15} />} Daftar
            </button>
          </div>
        )}
        </>
        )}
      </div>
    </div>
  );
}