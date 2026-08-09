import {
  FileSpreadsheet, X, LayoutDashboard, TrendingUp, Store, Crosshair, Download, Users, Shield,
  Package, History,
} from "lucide-react";
import { useScrollLock, useEscapeKey } from "../../hooks/useModalA11y.js";

/* ============================================================================
   ABOUT MODAL — "Tentang Aplikasi"
   Info singkat tentang aplikasi + kredit pembuat. Dibuka lewat link di footer
   (bukan tab navigasi — kontennya referensial, jarang dibuka ulang setelah
   pertama kali, jadi tidak perlu makan slot di sidebar/bottom-nav).

   ⚠️ Sprint 4 / A1+A2: pakai useScrollLock + useEscapeKey (background scroll
   di-lock saat modal terbuka, Escape tutup modal). Focus trap opsional untuk
   modal info-only seperti ini — content tidak interactive.
============================================================================ */

const FEATURES = [
  { icon: LayoutDashboard, label: "Executive Summary", desc: "Ringkasan performa sekali lihat" },
  { icon: TrendingUp, label: "Tren Periode", desc: "Bandingkan performa antar bulan" },
  { icon: Store, label: "Analisis Outlet", desc: "Segmentasi & pola kunjungan" },
  { icon: Crosshair, label: "Produk Fokus", desc: "Pantau target produk prioritas" },
  { icon: Package, label: "Grup Fokus", desc: "Highlight grup yang sedang digenjot" },
  { icon: History, label: "Snapshot Periode", desc: "Simpan & bandingkan periode untuk tren" },
  { icon: Download, label: "Export", desc: "Excel, PDF, dan gambar" },
  { icon: Users, label: "Multi-Sales", desc: "Kelola target & performa tiap sales" },
];

export function AboutModal({ isOpen, onClose, colors }) {
  // Hooks harus dipanggil SEBELUM conditional return — aturan Hooks.
  useScrollLock(isOpen);
  useEscapeKey(isOpen, onClose);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm sm-fadein" onClick={onClose}>
      <div className="sm-card sm-modal-glass sm-scale-in w-full max-w-lg max-h-[88vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="p-5 flex items-center justify-between shrink-0" style={{ borderBottom: `1px solid ${colors.glassBorder}` }}>
          <div className="disp text-base font-semibold">Tentang Aplikasi</div>
          <button onClick={onClose} className="sm-btn p-2 rounded-full" style={{ background: colors.glassFill }}><X size={16} /></button>
        </div>

        <div className="p-5 overflow-y-auto space-y-5">
          {/* Header identitas */}
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl shrink-0" style={{ background: `linear-gradient(135deg, ${colors.gold}, ${colors.coral})` }}>
              <FileSpreadsheet size={20} color="#0A1120" />
            </div>
            <div>
              <div className="disp text-lg font-bold">Monitoring Penjualan Sales</div>
              <p className="text-xs" style={{ color: colors.textMuted }}>Dashboard performa sales real-time dari file Excel</p>
            </div>
          </div>

          {/* Deskripsi */}
          <p className="text-sm" style={{ color: colors.text }}>
            Aplikasi ini membantu memantau realisasi penjualan, pencapaian target (ACH), dan pertumbuhan
            performa sales, produk, maupun outlet — langsung dari file Excel yang diupload, tanpa perlu
            entri data manual.
          </p>

          {/* Fitur utama */}
          <div>
            <div className="text-xs uppercase tracking-wider font-semibold mb-2" style={{ color: colors.textMuted }}>Fitur Utama</div>
            <div className="grid grid-cols-2 gap-2.5">
              {FEATURES.map((f) => (
                <div key={f.label} className="sm-card p-3">
                  <f.icon size={15} style={{ color: colors.violet, marginBottom: 6 }} />
                  <div className="text-xs font-semibold">{f.label}</div>
                  <div className="text-xs mt-0.5" style={{ color: colors.textMuted }}>{f.desc}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Privasi & keamanan data */}
          <div className="sm-card p-3.5 flex items-start gap-2.5" style={{ background: colors.mint + "0D", border: `1px solid ${colors.mint}33` }}>
            <Shield size={16} style={{ color: colors.mint, flexShrink: 0, marginTop: 1 }} />
            <div>
              <div className="text-sm font-semibold" style={{ color: colors.mint }}>Privasi & Keamanan Data</div>
              <p className="text-xs mt-1" style={{ color: colors.text }}>
                Seluruh data diproses <b>langsung di browser Anda</b> — tidak pernah diunggah ke server
                manapun. Data & pengaturan disimpan otomatis di perangkat/browser ini saja, agar tidak
                hilang saat refresh.
              </p>
            </div>
          </div>

          {/* Kredit pembuat */}
          <div className="sm-card p-4 text-center" style={{ borderLeft: `3px solid ${colors.coral}` }}>
            <div className="text-xs" style={{ color: colors.textMuted }}>Dibuat oleh</div>
            <div className="disp text-2xl font-bold mt-0.5" style={{ color: colors.coral }}>Andri.S</div>
            <div className="text-xs mt-2" style={{ color: colors.textMuted }}>React · Vite · Tailwind CSS &middot; v3.0.0</div>
          </div>
        </div>
      </div>
    </div>
  );
}
