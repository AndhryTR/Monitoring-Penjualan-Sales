import { ArrowRight, Download, RefreshCw, Gauge } from "lucide-react";

/* ============================================================================
   QUICK ACTIONS — 3 tombol shortcut di Executive Summary.
   ⚠️ Sprint 16 / EX2: navigasi cepat ke halaman detail, export, atau sync.

   Buttons:
   1. "Lihat Detail" → pindah ke Main Report
   2. "Export Laporan" → trigger export menu (kalau ada callback)
   3. "Sinkronkan" → trigger sync (kalau ada callback)

   Tombol hanya tampil kalau callback disediakan (optional props).
============================================================================ */
export function QuickActions({ colors, onViewDetail, onExport, onSync, syncDisabled }) {
  const buttons = [];

  if (onViewDetail) {
    buttons.push({
      label: "Lihat Detail",
      icon: Gauge,
      onClick: onViewDetail,
      accent: colors.mint,
    });
  }
  if (onExport) {
    buttons.push({
      label: "Export Laporan",
      icon: Download,
      onClick: onExport,
      accent: colors.gold,
    });
  }
  if (onSync) {
    buttons.push({
      label: "Sinkronkan",
      icon: RefreshCw,
      onClick: onSync,
      accent: colors.blue,
      disabled: syncDisabled,
    });
  }

  if (buttons.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2 mb-6">
      {buttons.map((btn) => {
        const Icon = btn.icon;
        return (
          <button
            key={btn.label}
            onClick={btn.onClick}
            disabled={btn.disabled}
            className="sm-btn inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-40"
            style={{
              background: btn.accent + "1A",
              color: btn.accent,
              border: `1px solid ${btn.accent}44`,
            }}
          >
            <Icon size={14} /> {btn.label} <ArrowRight size={12} />
          </button>
        );
      })}
    </div>
  );
}
