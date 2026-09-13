import { useEffect, useRef } from "react";
import { AlertTriangle } from "lucide-react";
import { Modal } from "./Modal.jsx";

/* ============================================================================
   CONFIRMDIALOG
   Dialog konfirmasi seragam di atas Modal: title + subtitle konsekuensi +
   footer [Batal][Konfirmasi]. Varian danger (merah) untuk destruktif,
   default (mint) untuk non-destruktif. Backdrop lock untuk destruktif.
   Fokus awal di Batal (anti salah-klik). Fondasi pengganti window.confirm.
============================================================================ */
export function ConfirmDialog({
  isOpen,
  onCancel,
  onConfirm,
  title = "Yakin?",
  subtitle,
  confirmLabel = "Hapus",
  cancelLabel = "Batal",
  variant = "danger", // "danger" | "default"
  busy = false,
  colors = {},
}) {
  const cancelRef = useRef(null);

  // Fokus awal di Batal setiap dialog dibuka
  useEffect(() => {
    if (isOpen) {
      const t = setTimeout(() => cancelRef.current?.focus(), 60);
      return () => clearTimeout(t);
    }
  }, [isOpen]);

  const danger = variant === "danger";
  const accent = danger ? colors.coral || "#F87171" : colors.mint || "#10B981";

  return (
    <Modal
      isOpen={isOpen}
      onClose={busy ? undefined : onCancel}
      title={title}
      subtitle={subtitle}
      icon={AlertTriangle}
      iconBg={accent + "1A"}
      iconColor={accent}
      colors={colors}
      maxWidth="max-w-sm"
      closeOnBackdrop={!danger}
      ariaLabel={typeof title === "string" ? title : "Dialog konfirmasi"}
      footer={
        <>
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="sm-btn px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-40"
            style={{
              background: colors.glassFill,
              border: `1px solid ${colors.glassBorder}`,
              color: colors.text,
            }}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className="sm-btn px-4 py-2 rounded-xl text-sm font-bold disabled:opacity-40"
            style={{ background: accent, color: "#fff" }}
          >
            {busy ? "Memproses…" : confirmLabel}
          </button>
        </>
      }
    >
      {subtitle && (
        <p className="text-sm" style={{ color: colors.textMuted }}>
          {subtitle}
        </p>
      )}
    </Modal>
  );
}
