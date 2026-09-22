import { useState } from "react";
import {
  Sparkles,
  CheckCircle2,
  Bug,
  Zap,
  Tag,
  Calendar,
  Layers,
  ChevronDown,
} from "lucide-react";
import { Modal } from "../ui/Modal.jsx";
import defaultChangelog from "../../data/changelog.json";

/* ============================================================================
   WHATS NEW MODAL — "Catatan Pembaruan"
   Menampilkan daftar perubahan, fitur baru, dan perbaikan tiap kali ada rilis.
   Dapat dipicu otomatis saat versi baru terdeteksi atau dibuka manual dari
   AboutModal / footer aplikasi.
============================================================================ */

function getScopeStyle(scope, colors) {
  if (!scope) return null;
  const s = scope.toLowerCase();
  if (s.includes("ai")) {
    return { bg: (colors.violet || "#A78BFA") + "20", border: (colors.violet || "#A78BFA") + "44", text: colors.violet || "#A78BFA" };
  }
  if (s.includes("laporan") || s.includes("report")) {
    return { bg: (colors.gold || "#FBBF24") + "20", border: (colors.gold || "#FBBF24") + "44", text: colors.gold || "#FBBF24" };
  }
  if (s.includes("peta") || s.includes("lokasi") || s.includes("map")) {
    return { bg: (colors.mint || "#34D399") + "20", border: (colors.mint || "#34D399") + "44", text: colors.mint || "#34D399" };
  }
  if (s.includes("pwa") || s.includes("offline")) {
    return { bg: (colors.sky || "#38BDF8") + "20", border: (colors.sky || "#38BDF8") + "44", text: colors.sky || "#38BDF8" };
  }
  return { bg: colors.glassFill || "rgba(255,255,255,0.06)", border: colors.glassBorder || "rgba(255,255,255,0.12)", text: colors.textMuted || "#94A3B8" };
}

export function WhatsNewModal({
  isOpen,
  onClose,
  colors = {},
  changelog = defaultChangelog,
}) {
  const [selectedIdx, setSelectedIdx] = useState(0);

  const releases = Array.isArray(changelog) && changelog.length > 0 ? changelog : [];
  const currentRelease = releases[selectedIdx] || releases[0] || null;

  if (!currentRelease) return null;

  const { version, date, features = [], fixes = [], improvements = [] } = currentRelease;
  const totalChanges = features.length + fixes.length + improvements.length;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Catatan Pembaruan"
      subtitle="Ketahui fitur baru, peningkatan, dan perbaikan pada aplikasi"
      icon={Sparkles}
      iconBg={`linear-gradient(135deg, ${colors.gold || "#F59E0B"}33, ${colors.coral || "#F43F5E"}33)`}
      iconColor={colors.gold || "#F59E0B"}
      colors={colors}
      maxWidth="max-w-xl"
      maxHeight="max-h-[88vh]"
      contentClassName="space-y-5"
      footer={
        <div className="flex items-center justify-between gap-3 w-full">
          <div className="flex items-center gap-1.5 text-xs" style={{ color: colors.textMuted }}>
            <Tag size={13} />
            <span>Versi {version}</span>
            {date && (
              <>
                <span>&middot;</span>
                <Calendar size={13} />
                <span>{date}</span>
              </>
            )}
          </div>
          <button
            onClick={onClose}
            className="sm-btn px-5 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2"
            style={{
              background: `linear-gradient(135deg, ${colors.gold || "#F59E0B"}, ${colors.coral || "#F43F5E"})`,
              color: "#0A1120",
            }}
          >
            <span>Saya Mengerti</span>
            <CheckCircle2 size={16} />
          </button>
        </div>
      }
    >
      {/* Banner Versi Aktif & Selector Riwayat */}
      <div
        className="p-4 rounded-xl flex items-center justify-between gap-3"
        style={{
          background: `linear-gradient(135deg, ${colors.gold || "#F59E0B"}15, ${colors.violet || "#8B5CF6"}15)`,
          border: `1px solid ${colors.gold || "#F59E0B"}33`,
        }}
      >
        <div className="flex items-center gap-3">
          <div
            className="px-2.5 py-1 rounded-lg text-xs font-bold uppercase tracking-wider"
            style={{
              background: colors.gold || "#F59E0B",
              color: "#0A1120",
            }}
          >
            v{version}
          </div>
          <div>
            <div className="text-sm font-bold" style={{ color: colors.text }}>
              {selectedIdx === 0 ? "Versi Terbaru Sedang Aktif" : `Arsip Rilis v${version}`}
            </div>
            <div className="text-xs flex items-center gap-2 mt-0.5" style={{ color: colors.textMuted }}>
              {date && <span>Dirilis: {date}</span>}
              <span>&middot;</span>
              <span>{totalChanges} pembaruan</span>
            </div>
          </div>
        </div>

        {/* Dropdown versi jika terdapat riwayat versi lebih dari 1 */}
        {releases.length > 1 && (
          <div className="relative shrink-0">
            <select
              aria-label="Pilih Versi Catatan Pembaruan"
              value={selectedIdx}
              onChange={(e) => setSelectedIdx(Number(e.target.value))}
              className="sm-btn text-xs font-medium px-2.5 py-1.5 rounded-lg appearance-none pr-7 cursor-pointer"
              style={{
                background: colors.glassFill || "rgba(255,255,255,0.08)",
                border: `1px solid ${colors.glassBorder || "rgba(255,255,255,0.15)"}`,
                color: colors.text,
              }}
            >
              {releases.map((rel, idx) => (
                <option key={rel.version} value={idx} style={{ background: "#111827", color: "#F9FAFB" }}>
                  v{rel.version} {idx === 0 ? "(Terbaru)" : ""}
                </option>
              ))}
            </select>
            <ChevronDown
              size={14}
              className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none"
              style={{ color: colors.textMuted }}
            />
          </div>
        )}
      </div>

      {/* Konten Pembaruan Terkategori */}
      <div className="space-y-4 pr-0.5">
        {/* 1. Fitur Baru */}
        {features.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider" style={{ color: colors.gold || "#F59E0B" }}>
              <div className="p-1 rounded-md" style={{ background: (colors.gold || "#F59E0B") + "20" }}>
                <Sparkles size={13} />
              </div>
              <span>Fitur Baru ({features.length})</span>
            </div>
            <div className="space-y-2">
              {features.map((item, idx) => {
                const scopeStyle = getScopeStyle(item.scope, colors);
                return (
                  <div
                    key={`feat-${idx}-${item.hash || idx}`}
                    className="p-3 rounded-xl sm-card flex items-start gap-2.5 transition-colors"
                    style={{ background: colors.glassFill }}
                  >
                    <span className="text-base select-none shrink-0 mt-0.5">🚀</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs leading-relaxed" style={{ color: colors.text }}>
                        {item.scope && scopeStyle && (
                          <span
                            className="inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold mr-1.5 align-middle border"
                            style={{
                              background: scopeStyle.bg,
                              borderColor: scopeStyle.border,
                              color: scopeStyle.text,
                            }}
                          >
                            {item.scope}
                          </span>
                        )}
                        <span>{item.title}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 2. Perbaikan Masalah */}
        {fixes.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider" style={{ color: colors.coral || "#F43F5E" }}>
              <div className="p-1 rounded-md" style={{ background: (colors.coral || "#F43F5E") + "20" }}>
                <Bug size={13} />
              </div>
              <span>Perbaikan Masalah ({fixes.length})</span>
            </div>
            <div className="space-y-2">
              {fixes.map((item, idx) => {
                const scopeStyle = getScopeStyle(item.scope, colors);
                return (
                  <div
                    key={`fix-${idx}-${item.hash || idx}`}
                    className="p-3 rounded-xl sm-card flex items-start gap-2.5 transition-colors"
                    style={{ background: colors.glassFill }}
                  >
                    <span className="text-base select-none shrink-0 mt-0.5">🐛</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs leading-relaxed" style={{ color: colors.text }}>
                        {item.scope && scopeStyle && (
                          <span
                            className="inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold mr-1.5 align-middle border"
                            style={{
                              background: scopeStyle.bg,
                              borderColor: scopeStyle.border,
                              color: scopeStyle.text,
                            }}
                          >
                            {item.scope}
                          </span>
                        )}
                        <span>{item.title}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 3. Peningkatan & Kinerja */}
        {improvements.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider" style={{ color: colors.mint || "#34D399" }}>
              <div className="p-1 rounded-md" style={{ background: (colors.mint || "#34D399") + "20" }}>
                <Zap size={13} />
              </div>
              <span>Peningkatan & Kinerja ({improvements.length})</span>
            </div>
            <div className="space-y-2">
              {improvements.map((item, idx) => {
                const scopeStyle = getScopeStyle(item.scope, colors);
                return (
                  <div
                    key={`imp-${idx}-${item.hash || idx}`}
                    className="p-3 rounded-xl sm-card flex items-start gap-2.5 transition-colors"
                    style={{ background: colors.glassFill }}
                  >
                    <span className="text-base select-none shrink-0 mt-0.5">⚡</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs leading-relaxed" style={{ color: colors.text }}>
                        {item.scope && scopeStyle && (
                          <span
                            className="inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold mr-1.5 align-middle border"
                            style={{
                              background: scopeStyle.bg,
                              borderColor: scopeStyle.border,
                              color: scopeStyle.text,
                            }}
                          >
                            {item.scope}
                          </span>
                        )}
                        <span>{item.title}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Kasus kosong */}
        {totalChanges === 0 && (
          <div className="sm-card p-6 text-center space-y-2">
            <Layers size={28} className="mx-auto" style={{ color: colors.textMuted }} />
            <div className="text-sm font-semibold" style={{ color: colors.text }}>Tidak ada catatan rilis khusus</div>
            <div className="text-xs" style={{ color: colors.textMuted }}>
              Pembaruan ini mencakup pemeliharaan rutin dan peningkatan stabilitas umum.
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
