import { useState, useEffect, useCallback, useRef } from "react";
import { CheckCircle2, AlertTriangle, Info, X } from "lucide-react";
import { subscribeToToast } from "../../utils/toastBus.js";

/* ============================================================================
   ToastHost — tumpukan toast in-window pojok kanan bawah (gaya WinUI).
   Styling via token colors supaya theme-aware. Auto-hide 4 detik (error 6
   detik agar sempat dibaca), klik tombol × untuk menutup lebih cepat,
   max 3 tumpuk (yang paling lama di-drop). Varian kind: success | error | info.
============================================================================ */
const TOAST_TTL = 4000;
const TOAST_TTL_ERROR = 6000;
const MAX_TOASTS = 3;

const KIND_STYLE = {
  success: { Icon: CheckCircle2, key: "mint" },
  error: { Icon: AlertTriangle, key: "coral" },
  info: { Icon: Info, key: "blue" },
};

export function ToastHost({ colors }) {
  const [toasts, setToasts] = useState([]);
  const timersRef = useRef(new Map());

  const dismiss = useCallback((id) => {
    const timers = timersRef.current;
    if (timers.has(id)) {
      clearTimeout(timers.get(id));
      timers.delete(id);
    }
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  useEffect(() => {
    const unsub = subscribeToToast((toast) => {
      setToasts((prev) => {
        const next = [...prev, toast];
        // Hemat ruang: simpan max 3, buang yang tertua (+ timernya)
        if (next.length > MAX_TOASTS) {
          const dropped = next.slice(0, next.length - MAX_TOASTS);
          dropped.forEach((d) => {
            if (timersRef.current.has(d.id)) {
              clearTimeout(timersRef.current.get(d.id));
              timersRef.current.delete(d.id);
            }
          });
          return next.slice(next.length - MAX_TOASTS);
        }
        return next;
      });
      // Auto-hide setelah TTL (error lebih lama)
      const ttl = toast.kind === "error" ? TOAST_TTL_ERROR : TOAST_TTL;
      timersRef.current.set(toast.id, setTimeout(() => dismiss(toast.id), ttl));
    });
    const timers = timersRef.current;
    return () => {
      unsub();
      timers.forEach((t) => clearTimeout(t));
      timers.clear();
    };
  }, [dismiss]);

  if (!toasts.length) return null;

  return (
    <div className="fixed bottom-5 right-5 z-[10000] flex flex-col gap-2 pointer-events-none" style={{ maxWidth: 320 }}>
      {toasts.map((t) => {
        const { Icon, key } = KIND_STYLE[t.kind] || KIND_STYLE.success;
        const accent = colors[key] || (t.kind === "error" ? "#F87171" : colors.mint);
        return (
          <div
            key={t.id}
            className="pointer-events-auto sm-toast-in flex items-start gap-3 p-3.5 rounded-xl shadow-2xl"
            style={{
              background: `${colors.glassFill}`,
              border: `1px solid ${t.kind === "error" ? accent + "55" : colors.glassBorder}`,
              backdropFilter: "blur(20px)",
              WebkitBackdropFilter: "blur(20px)",
              boxShadow: `0 12px 40px rgba(0,0,0,0.35)`,
            }}
            role={t.kind === "error" ? "alert" : "status"}
          >
            <div className="p-1.5 rounded-lg shrink-0" style={{ background: `${accent}1A` }}>
              <Icon size={16} style={{ color: accent }} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold" style={{ color: colors.text }}>{t.title}</div>
              {t.body && <div className="text-xs mt-0.5 break-words" style={{ color: colors.textMuted }}>{t.body}</div>}
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
        );
      })}
    </div>
  );
}
