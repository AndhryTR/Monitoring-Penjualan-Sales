import { useEffect, useRef, useState } from "react";
import { FileSpreadsheet, Loader2 } from "lucide-react";
import { AppLogo } from "./AppLogo.jsx";

/* ============================================================================
   UPLOAD LOADING — overlay fullscreen saat parsing file Excel.
   Muncul saat proses upload/parse berjalan. Progress worker masuk dalam
   lompatan per batch; `displayProgress` menginterpolasi lompatan itu lewat
   requestAnimationFrame agar bar dan angka terasa seamless.
============================================================================ */
export function UploadLoading({ colors, fileName, progress = 0 }) {
  const targetRef = useRef(0);
  const displayRef = useRef(0);
  const animationRef = useRef(null);
  const [displayProgress, setDisplayProgress] = useState(0);

  useEffect(() => {
    targetRef.current = Math.max(targetRef.current, Math.min(1, progress));
    if (animationRef.current) return;

    const animate = () => {
      const current = displayRef.current;
      const target = targetRef.current;
      const distance = target - current;
      if (distance <= 0.001) {
        displayRef.current = target;
        setDisplayProgress(target);
        animationRef.current = null;
        return;
      }
      // Ease-out kontinu: target boleh berubah tanpa membatalkan frame aktif.
      const next = Math.min(target, current + Math.max(0.002, distance * 0.12));
      displayRef.current = next;
      setDisplayProgress(next);
      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);
  }, [progress]);

  useEffect(() => () => {
    if (animationRef.current) cancelAnimationFrame(animationRef.current);
  }, []);

  const percent = Math.round(displayProgress * 100);

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 200, display: "flex",
        flexDirection: "column", alignItems: "center", justifyContent: "center",
        gap: 16, background: "rgba(10, 17, 32, 0.72)",
        backdropFilter: "blur(10px) saturate(1.2)",
        WebkitBackdropFilter: "blur(10px) saturate(1.2)", color: colors.text,
      }}
      role="status" aria-live="polite" aria-label="Memproses file"
    >
      <div style={{ width: 68, height: 68, borderRadius: 22, display: "flex", alignItems: "center", justifyContent: "center", background: colors.glassFill || "rgba(255,255,255,0.06)", border: `1px solid ${colors.glassBorderElevated || "rgba(255,255,255,0.15)"}`, boxShadow: "0 12px 40px rgba(0,0,0,0.5)" }}>
        <AppLogo size={46} loop />
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <Loader2 size={20} className="animate-spin" style={{ color: colors.mint }} />
        <span className="text-base font-semibold">Memproses file Excel...</span>
      </div>
      {fileName && <div className="text-sm" style={{ color: colors.textMuted }}>{fileName}</div>}
      <div className="w-64 max-w-[80vw]" style={{ marginTop: 4 }}>
        <div className="h-2 rounded-full" style={{ background: colors.glassSubtle, overflow: "hidden" }}>
          <div className="h-full rounded-full" style={{ width: `${percent}%`, background: `linear-gradient(90deg, ${colors.mint}, ${colors.blue})`, transition: "width .08s linear" }} />
        </div>
        <div className="mt-1.5 text-center text-xs" style={{ color: colors.textMuted }}>{percent}%</div>
      </div>
      <div className="text-xs" style={{ color: colors.textMuted }}>
        Sedang membaca, mengurai kolom, dan menghitung stok. Ini bisa beberapa detik untuk file besar.
      </div>
    </div>
  );
}
