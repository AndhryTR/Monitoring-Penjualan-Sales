import React from "react";
import { CheckCircle2, X, RefreshCw, Smartphone, Share } from "lucide-react";

export function PwaBanners({
  offlineReady,
  setOfflineReady,
  needRefresh,
  setNeedRefresh,
  updateServiceWorker,
  showIosInstallHint,
  setShowIosInstallHint,
  colors,
}) {
  return (
    <>
      {/* PWA: notifikasi offline ready */}
      {offlineReady && !needRefresh && (
        <div
          className="mb-6 sm-fadeup flex items-center justify-between gap-3 px-4 py-3 rounded-xl"
          style={{ background: colors.mint + "14", border: `1px solid ${colors.mint}44` }}
        >
          <div className="flex items-center gap-2.5 text-sm">
            <CheckCircle2 size={15} style={{ color: colors.mint }} />
            <span>Aplikasi siap dipakai walau tanpa internet.</span>
          </div>
          <button
            onClick={() => setOfflineReady(false)}
            className="sm-btn p-1.5 rounded-lg"
            style={{ color: colors.textMuted }}
            aria-label="Tutup notifikasi offline"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* PWA: notifikasi update tersedia */}
      {needRefresh && (
        <div
          className="mb-6 sm-fadeup flex items-center justify-between gap-3 px-4 py-3 rounded-xl"
          style={{ background: colors.gold + "14", border: `1px solid ${colors.gold}44` }}
        >
          <div className="flex items-center gap-2.5 text-sm">
            <RefreshCw size={15} style={{ color: colors.gold }} />
            <span>Versi baru aplikasi tersedia.</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => updateServiceWorker(true)}
              className="sm-btn px-3 py-1.5 rounded-lg text-xs font-semibold"
              style={{ background: colors.gold, color: colors.onGold || "#0A1120" }}
            >
              Perbarui Sekarang
            </button>
            <button
              onClick={() => setNeedRefresh(false)}
              className="sm-btn px-3 py-1.5 rounded-lg text-xs font-semibold"
              style={{ border: `1px solid ${colors.glassBorder}` }}
            >
              Nanti
            </button>
          </div>
        </div>
      )}

      {/* PWA: instruksi manual instal untuk iOS Safari */}
      {showIosInstallHint && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md sm-fadein"
          onClick={() => setShowIosInstallHint(false)}
        >
          <div
            className="sm-card sm-modal-glass sm-scale-in w-full max-w-sm p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl" style={{ background: colors.gold + "1A" }}>
                  <Smartphone size={16} style={{ color: colors.gold }} />
                </div>
                <div className="disp text-base font-semibold">Instal di iPhone/iPad</div>
              </div>
              <button
                onClick={() => setShowIosInstallHint(false)}
                className="sm-btn p-2 rounded-full"
                style={{ background: colors.glassFill }}
                aria-label="Tutup panduan instal"
              >
                <X size={16} />
              </button>
            </div>
            <ol className="text-sm space-y-2.5" style={{ color: colors.text }}>
              <li className="flex items-start gap-2.5">
                <span className="mono font-semibold shrink-0" style={{ color: colors.gold }}>
                  1.
                </span>
                <span className="flex items-center gap-1.5 flex-wrap">
                  Tap ikon <Share size={14} style={{ color: colors.gold }} /> <b>Share</b> di bar bawah Safari
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="mono font-semibold shrink-0" style={{ color: colors.gold }}>
                  2.
                </span>
                <span>
                  Pilih <b>"Add to Home Screen"</b>
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="mono font-semibold shrink-0" style={{ color: colors.gold }}>
                  3.
                </span>
                <span>
                  Tap <b>"Add"</b> di pojok kanan atas
                </span>
              </li>
            </ol>
          </div>
        </div>
      )}
    </>
  );
}
