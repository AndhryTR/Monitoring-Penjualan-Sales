import { useState, useEffect, useCallback } from "react";
import { CheckCircle2, X } from "lucide-react";
import { subscribeToToast } from "../../utils/toastBus.js";

/* ============================================================================
   ToastHost — tumpukan toast in-window pojok kanan bawah (gaya WinUI).
   Styling via token colors supaya theme-aware. Auto-hide 4 detik, klik tombol
   × untuk menutup lebih cepat, max 3 tumpuk (yang paling lama di-drop).
============================================================================ */
const TOAST_TTL = 4000;
const MAX_TOASTS = 3;

export function ToastHost({ colors }) {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  useEffect(() => {
    const unsub = subscribeToToast((toast) => {
      setToasts((prev) => {
        const next = [...prev, toast];
        // Hemat ruang: simpan max 3, buang yang tertua
        return next.length > MAX_TOASTS ? next.slice(next.length - MAX_TOASTS) : next;
      });
      // Auto-hide setelah TTL
      setTimeout(() => dismiss(toast.id), TOAST_TTL);
    });
    return unsub;
  }, [dismiss]);

  if (!toasts.length) return null;

  return (
    <div className="fixed bottom-5 right-5 z-[10000] flex flex-col gap-2 pointer-events-none" style={{ maxWidth: 320 }}>
      {toasts.map((t) => (
        <div
          key={t.id}
          className="pointer-events-auto sm-toast-in flex items-start gap-3 p-3.5 rounded-xl shadow-2xl"
          style={{
            background: `${colors.glassFill}`,
            border: `1px solid ${colors.glassBorder}`,
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            boxShadow: `0 12px 40px rgba(0,0,0,0.35)`,
          }}
        >
          <div className="p-1.5 rounded-lg shrink-0" style={{ background: `${colors.mint}1A` }}>
            <CheckCircle2 size={16} style={{ color: colors.mint }} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold" style={{ color: colors.text }}>{t.title}</div>
            {t.body && <div className="text-xs mt-0.5" style={{ color: colors.textMuted }}>{t.body}</div>}
          </div>
          <button
            onClick={() => dismiss(t.id)}
            className="p-1 rounded-md shrink-0"
            style={{ color: colors.textMuted }}
            title="Tutup"
            aria-label="Tutup notifikasi"
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}