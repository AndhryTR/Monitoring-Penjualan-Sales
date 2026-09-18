import { ShieldCheck } from "lucide-react";

/**
 * Komponen fallback standar ketika user tidak memiliki izin akses (permission)
 * untuk membuka halaman atau fitur tertentu.
 *
 * @param {object} props
 * @param {object} props.colors - token tema aktif
 * @param {string} [props.title="Akses Dibatasi"]
 * @param {string} [props.message="Halaman ini memerlukan izin akses dari administrator."]
 */
export function AccessRestricted({
  colors,
  title = "Akses Dibatasi",
  message = "Halaman ini memerlukan izin akses dari administrator.",
}) {
  return (
    <div className="sm-card p-8 text-center sm-fadeup">
      <div className="flex flex-col items-center gap-3">
        <ShieldCheck size={32} style={{ color: colors.textMuted }} />
        <p className="text-sm font-medium" style={{ color: colors.text }}>
          {title}
        </p>
        <p className="text-xs" style={{ color: colors.textMuted }}>
          {message}
        </p>
      </div>
    </div>
  );
}
