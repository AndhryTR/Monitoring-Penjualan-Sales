import { FileSpreadsheet, Loader2 } from "lucide-react";

/* ============================================================================
   UPLOAD LOADING — overlay fullscreen saat parsing file Excel.
   Muncul saat proses upload/parse berjalan (state `loading`). Memberi feedback
   visual yang jelas bahwa app sedang memproses file — tidak terlihat freeze.
============================================================================ */
export function UploadLoading({ colors, fileName, progress = 0 }) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 200,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 16,
        background: "rgba(10, 17, 32, 0.72)",
        backdropFilter: "blur(10px) saturate(1.2)",
        WebkitBackdropFilter: "blur(10px) saturate(1.2)",
        color: colors.text,
      }}
      role="status"
      aria-live="polite"
      aria-label="Memproses file"
    >
      <div
        style={{
          width: 64,
          height: 64,
          borderRadius: 20,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: `linear-gradient(135deg, ${colors.gold}, ${colors.coral})`,
          boxShadow: "0 10px 40px rgba(0,0,0,0.4)",
        }}
      >
        <FileSpreadsheet size={28} color="#0A1120" />
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <Loader2 size={20} className="animate-spin" style={{ color: colors.mint }} />
        <span className="text-base font-semibold">Memproses file Excel...</span>
      </div>

      {fileName && (
        <div className="text-sm" style={{ color: colors.textMuted }}>{fileName}</div>
      )}

      {/* Progress bar — progress masuk sebagai fraksi 0..1, tampilkan persen 0..100 */}
      <div className="w-64 max-w-[80vw]" style={{ marginTop: 4 }}>
        <div className="h-2 rounded-full" style={{ background: colors.glassSubtle, overflow: "hidden" }}>
          <div
            className="h-full rounded-full transition-all duration-150"
            style={{ width: `${Math.max(0, Math.min(100, progress * 100))}%`, background: `linear-gradient(90deg, ${colors.mint}, ${colors.blue})` }}
          />
        </div>
        <div className="mt-1.5 text-center text-xs" style={{ color: colors.textMuted }}>{Math.round(progress * 100)}%</div>
      </div>

      <div className="text-xs" style={{ color: colors.textMuted }}>
        Sedang membaca, mengurai kolom, dan menghitung stok. Ini bisa beberapa detik untuk file besar.
      </div>
    </div>
  );
}
