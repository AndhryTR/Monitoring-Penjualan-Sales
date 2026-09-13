import { useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { useScrollLock, useEscapeKey } from "../../hooks/useModalA11y.js";

/**
 * Komponen Modal tunggal berbasis createPortal ke document.body.
 *
 * Mengonsolidasikan:
 * - Render portal ke document.body agar bebas dari stacking context / overflow parent.
 * - Efek visual glassmorphism & backdrop blur (bg-black/60 backdrop-blur-md).
 * - Animasi pop masuk (sm-scale-in) dan fade overlay (sm-fadein).
 * - Kunci scroll background (useScrollLock).
 * - Escape key listener (useEscapeKey).
 * - Penutupan saat klik backdrop overlay (closeOnBackdrop).
 * - Slot terstruktur: Header (title, subtitle, icon, extra actions, close X), Body, dan Footer.
 *
 * @param {Object} props
 * @param {boolean} props.isOpen - Menentukan apakah modal sedang ditampilkan
 * @param {Function} props.onClose - Callback saat modal ditutup
 * @param {React.ReactNode} [props.title] - Judul modal
 * @param {React.ReactNode} [props.subtitle] - Subjudul / teks keterangan kecil di bawah judul
 * @param {React.ComponentType} [props.icon] - Komponen Icon Lucide
 * @param {string} [props.iconBg] - Background wrapper icon
 * @param {string} [props.iconColor] - Warna icon
 * @param {React.ReactNode} [props.headerExtra] - Elemen tambahan di kanan header sebelum tombol close
 * @param {React.ReactNode} [props.customHeader] - Kustomisasi total header (menggantikan default header)
 * @param {string} [props.maxWidth="max-w-lg"] - Kelas Tailwind untuk lebar maksimum modal
 * @param {string} [props.maxHeight="max-h-[88vh]"] - Kelas Tailwind untuk tinggi maksimum modal
 * @param {Object} [props.colors={}] - Objek tema aktif
 * @param {React.ReactNode} props.children - Konten isi modal (body)
 * @param {React.ReactNode} [props.footer] - Konten footer modal (opsional)
 * @param {boolean} [props.showClose=true] - Menampilkan tombol silang (X)
 * @param {boolean} [props.closeOnBackdrop=true] - Menutup modal jika backdrop diklik
 * @param {string} [props.className=""] - Kelas tambahan untuk kartu modal
 * @param {string} [props.contentClassName=""] - Kelas tambahan untuk container body modal
 * @param {string} [props.ariaLabel] - Label aksesibilitas ARIA
 */
export function Modal({
  isOpen,
  onClose,
  title,
  subtitle,
  icon: Icon,
  iconBg,
  iconColor,
  headerExtra,
  customHeader,
  maxWidth = "max-w-lg",
  maxHeight = "max-h-[88vh]",
  colors = {},
  children,
  footer,
  showClose = true,
  closeOnBackdrop = true,
  className = "",
  contentClassName = "",
  ariaLabel,
}) {
  const cardRef = useRef(null);
  useScrollLock(isOpen);
  useEscapeKey(isOpen, onClose);

  if (!isOpen) return null;

  const handleBackdropClick = (e) => {
    if (closeOnBackdrop && e.target === e.currentTarget) {
      onClose?.();
    }
  };

  const defaultBorder = colors?.glassBorder || "rgba(255,255,255,0.08)";
  const defaultFill = colors?.glassFill || "rgba(255,255,255,0.06)";
  const goldColor = colors?.gold || "#F59E0B";

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-md sm-fadein"
      style={{
        color: colors?.text,
        fontFamily: "'Inter', sans-serif",
      }}
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel || (typeof title === "string" ? title : "Dialog modal")}
    >
      <div
        ref={cardRef}
        className={`sm-card sm-modal-glass sm-scale-in w-full ${maxWidth} ${maxHeight} flex flex-col relative overflow-hidden ${className}`}
        style={{ color: colors?.text }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Custom Header atau Default Header */}
        {customHeader ? (
          customHeader
        ) : (title || showClose || Icon) ? (
          <div
            className="p-5 flex items-center justify-between shrink-0"
            style={{ borderBottom: `1px solid ${defaultBorder}` }}
          >
            <div className="flex items-center gap-3 min-w-0">
              {Icon && (
                <div
                  className="p-2.5 rounded-xl shrink-0 flex items-center justify-center"
                  style={{
                    background: iconBg || `${goldColor}1A`,
                    color: iconColor || goldColor,
                  }}
                >
                  <Icon size={18} />
                </div>
              )}
              <div className="min-w-0">
                {title && <div className="disp text-base font-semibold truncate" style={{ color: colors?.text }}>{title}</div>}
                {subtitle && <div className="text-xs truncate" style={{ color: colors?.textMuted }}>{subtitle}</div>}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {headerExtra}
              {showClose && (
                <button
                  type="button"
                  onClick={onClose}
                  className="sm-btn p-2 rounded-full transition-colors"
                  style={{ background: defaultFill, color: colors?.text }}
                  aria-label="Tutup"
                >
                  <X size={16} />
                </button>
              )}
            </div>
          </div>
        ) : null}

        {/* Konten Body */}
        <div className={`p-5 overflow-y-auto flex-1 ${contentClassName}`}>
          {children}
        </div>

        {/* Footer (Opsional) */}
        {footer && (
          <div
            className="p-4 shrink-0 flex items-center justify-end gap-2"
            style={{ borderTop: `1px solid ${defaultBorder}` }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
