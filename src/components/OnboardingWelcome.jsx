import { useRef } from "react";
import {
  FileSpreadsheet, Upload, Sparkles, Download, ArrowRight,
  Gauge, Users, Crosshair, Store, History, Zap,
} from "lucide-react";
import { AppLogo } from "./ui/AppLogo.jsx";

/* ============================================================================
   ONBOARDING WELCOME — tampil saat belum ada data diupload.
   ⚠️ Sprint 10 / OB1: sebelumnya hanya generic card "Belum ada data" dengan
   1 kalimat. Sekarang: onboarding guided dengan 3 opsi jelas + feature preview.

   Layout:
   - Hero: judul + deskripsi singkat app
   - 3 action cards: Upload Excel (primary), Data Contoh (secondary), Import Backup (tertiary)
   - Feature preview: grid ikon fitur utama yang user akan dapat setelah upload
============================================================================ */

export function OnboardingWelcome({ colors, onUpload, onSample, onImportBackup, loading, sampleLoading }) {
  const fileInputRef = useRef(null);

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) onUpload?.(file);
  };

  return (
    <div className="sm-page-enter max-w-3xl mx-auto">
      {/* Hero */}
      <div className="text-center mb-8 mt-4">
        <div className="mb-5 flex justify-center">
          <div
            className="p-3.5 rounded-3xl flex items-center justify-center shadow-lg"
            style={{
              background: colors.glassFill,
              border: `1px solid ${colors.glassBorderElevated}`,
              boxShadow: `0 12px 32px -8px ${colors.blue || "#3B82F6"}33`,
            }}
          >
            <AppLogo size={72} animated loop />
          </div>
        </div>
        <h1 className="disp text-2xl font-bold mb-2" style={{ color: colors.text }}>
          Monitoring Penjualan Sales
        </h1>
        <p className="text-sm max-w-md mx-auto" style={{ color: colors.textMuted }}>
          Dashboard performa sales real-time dari file Excel sell-out. Pantau pencapaian target,
          analisis outlet, dan bandingkan periode — tanpa entri data manual.
        </p>
      </div>

      {/* Action cards */}
      <div className="grid md:grid-cols-3 gap-4 mb-8">
        {/* Primary: Upload Excel */}
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={loading}
          className="sm-card p-5 text-left flex flex-col items-start gap-3 disabled:opacity-50"
          style={{ borderLeft: `3px solid ${colors.mint}`, cursor: loading ? "wait" : "pointer" }}
        >
          <div className="p-2.5 rounded-xl" style={{ background: colors.mint + "1A" }}>
            {loading ? <Zap size={20} style={{ color: colors.mint }} className="animate-pulse" /> : <Upload size={20} style={{ color: colors.mint }} />}
          </div>
          <div>
            <div className="text-sm font-semibold disp" style={{ color: colors.text }}>Upload Excel</div>
            <p className="text-xs mt-1" style={{ color: colors.textMuted }}>
              Upload file sell-out (.xlsx / .xls) dari sistem Anda. Data diproses langsung di browser — tidak dikirim ke server.
            </p>
          </div>
          <div className="flex items-center gap-1 text-xs font-semibold mt-auto" style={{ color: colors.mint }}>
            Pilih file <ArrowRight size={12} />
          </div>
        </button>
        <input ref={fileInputRef} type="file" accept=".xlsx,.xls" onChange={handleFileSelect} className="hidden" />

        {/* Secondary: Sample Data */}
        <button
          onClick={onSample}
          disabled={sampleLoading}
          className="sm-card p-5 text-left flex flex-col items-start gap-3 disabled:opacity-50"
          style={{ borderLeft: `3px solid ${colors.gold}`, cursor: sampleLoading ? "wait" : "pointer" }}
        >
          <div className="p-2.5 rounded-xl" style={{ background: colors.gold + "1A" }}>
            {sampleLoading ? <Zap size={20} style={{ color: colors.gold }} className="animate-pulse" /> : <Sparkles size={20} style={{ color: colors.gold }} />}
          </div>
          <div>
            <div className="text-sm font-semibold disp" style={{ color: colors.text }}>Coba Data Contoh</div>
            <p className="text-xs mt-1" style={{ color: colors.textMuted }}>
              Lihat dashboard bekerja dengan data dummy. Cocok untuk eksplorasi fitur sebelum upload data asli.
            </p>
          </div>
          <div className="flex items-center gap-1 text-xs font-semibold mt-auto" style={{ color: colors.gold }}>
            Mulai eksplorasi <ArrowRight size={12} />
          </div>
        </button>

        {/* Tertiary: Import Backup */}
        <button
          onClick={onImportBackup}
          className="sm-card p-5 text-left flex flex-col items-start gap-3"
          style={{ borderLeft: `3px solid ${colors.violet}`, cursor: "pointer" }}
        >
          <div className="p-2.5 rounded-xl" style={{ background: colors.violet + "1A" }}>
            <Download size={20} style={{ color: colors.violet }} />
          </div>
          <div>
            <div className="text-sm font-semibold disp" style={{ color: colors.text }}>Import Backup</div>
            <p className="text-xs mt-1" style={{ color: colors.textMuted }}>
              Punya file backup dari device lain? Import pengaturan + target + riwayat snapshot ke perangkat ini.
            </p>
          </div>
          <div className="flex items-center gap-1 text-xs font-semibold mt-auto" style={{ color: colors.violet }}>
            Import file <ArrowRight size={12} />
          </div>
        </button>
      </div>

      {/* Feature preview */}
      <div className="sm-card p-5">
        <div className="text-xs uppercase tracking-wider font-semibold mb-3" style={{ color: colors.textMuted }}>
          Fitur yang Anda dapat
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {[
            { icon: Gauge, label: "Executive Summary", desc: "Ringkasan 8 KPI sekali lihat" },
            { icon: Users, label: "Performa Sales", desc: "Leaderboard + breakdown per grup" },
            { icon: Crosshair, label: "Produk Fokus", desc: "Pantau target produk prioritas" },
            { icon: Store, label: "Analisis Outlet", desc: "Segmentasi aktif/berisiko/dormant" },
            { icon: History, label: "Tren Periode", desc: "Bandingkan performa antar bulan" },
            { icon: FileSpreadsheet, label: "Export", desc: "Excel, PDF, dan gambar" },
          ].map((f) => {
            const Icon = f.icon;
            return (
              <div key={f.label} className="flex items-start gap-2.5">
                <div className="p-1.5 rounded-lg shrink-0" style={{ background: colors.glassSubtle }}>
                  <Icon size={14} style={{ color: colors.textMuted }} />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-semibold" style={{ color: colors.text }}>{f.label}</div>
                  <div className="text-[11px] mt-0.5" style={{ color: colors.textMuted }}>{f.desc}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Privacy note */}
      <div className="mt-4 flex items-center justify-center gap-2 text-xs" style={{ color: colors.textMuted }}>
        <Zap size={12} />
        <span>Seluruh data diproses langsung di browser Anda — tidak pernah diunggah ke server manapun.</span>
      </div>
    </div>
  );
}
