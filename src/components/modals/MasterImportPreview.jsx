import { useState, useEffect, useRef } from "react";
import {
  X, FileSpreadsheet, AlertCircle, CheckCircle2, Loader2, Upload, FileDown,
} from "lucide-react";
import { useScrollLock, useEscapeKey } from "../../hooks/useModalA11y.js";
import { useMasterImportWorker } from "../../hooks/useMasterImportWorker.js";
import { fmtRp } from "../../utils/formatters.js";

/* ============================================================================
   MASTER IMPORT PREVIEW MODAL — Sprint 18 / Multi-Depo
   Modal untuk preview hasil parsing Excel master sebelum commit simpan.
   User pilih file → parse via masterImport.js → modal tampilkan stats +
   errors + sample preview → user konfirmasi Simpan atau Batal.

   Props:
   - isOpen: boolean
   - onClose: () => void
   - onConfirm: (targets: Target[]) => void  → parent akan replace localTargets
   - existingCodes: string[]  → kode sales yang sudah ada (untuk warning duplikat)
   - colors
============================================================================ */
export function MasterImportPreview({ isOpen, onClose, onConfirm, existingCodes = [], colors }) {
  const [file, setFile] = useState(null);
  const [parsing, setParsing] = useState(false);
  const [result, setResult] = useState(null); // { targets, stats, errors }
  const [parseError, setParseError] = useState("");
  const fileInputRef = useRef(null);
  const { parseMaster } = useMasterImportWorker();

  useScrollLock(isOpen);
  useEscapeKey(isOpen, onClose);

  // Reset state saat modal ditutup
  useEffect(() => {
    if (!isOpen) {
      setFile(null);
      setParsing(false);
      setResult(null);
      setParseError("");
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleFileSelect = async (e) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    setFile(selected);
    setResult(null);
    setParseError("");
    setParsing(true);
    try {
      const res = await parseMaster(selected);
      setResult(res);
    } catch (err) {
      console.error("Master import parse error:", err);
      setParseError(`Gagal membaca file: ${err.message || String(err)}. Pastikan file adalah format .xlsx valid.`);
    } finally {
      setParsing(false);
    }
  };

  const handleDownloadTemplate = async () => {
    const { downloadMasterTemplate } = await import("../../utils/masterTemplate.js");
    downloadMasterTemplate({ depotName: "template" });
  };

  // Deteksi kode sales yang sudah ada di depo (akan di-replace bila import dikonfirmasi)
  const existingOverlap = result?.targets
    ? result.targets.filter((t) => existingCodes.includes(t.code)).map((t) => t.code)
    : [];
  const newCodes = result?.targets
    ? result.targets.filter((t) => !existingCodes.includes(t.code)).map((t) => t.code)
    : [];

  const canConfirm = result && result.targets.length > 0;

  const handleConfirm = () => {
    if (!canConfirm) return;
    onConfirm(result.targets);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.6)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl max-h-[90vh] rounded-2xl overflow-hidden flex flex-col"
        style={{ background: colors.modalPanelBg || colors.glassFillStrong, border: `1px solid ${colors.glassBorder}` }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 flex items-center justify-between shrink-0" style={{ borderBottom: `1px solid ${colors.glassBorder}` }}>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg" style={{ background: colors.mint + "1A" }}>
              <FileSpreadsheet size={18} style={{ color: colors.mint }} />
            </div>
            <div>
              <div className="text-lg font-bold disp" style={{ color: colors.text }}>Import Excel Master</div>
              <p className="text-xs" style={{ color: colors.textMuted }}>
                Sheet Sales (wajib) + Grup (opsional) + Fokus (opsional)
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg" style={{ background: colors.glassSubtle, color: colors.textMuted }}>
            <X size={16} />
          </button>
        </div>

        {/* Body — scrollable */}
        <div className="flex-1 overflow-y-auto p-5">
          {/* File picker + download template */}
          <div className="flex gap-2 mb-4">
            <label
              className="flex-1 sm-btn inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold cursor-pointer"
              style={{ background: colors.mint + "1A", color: colors.mint, border: `1px solid ${colors.mint}55` }}
            >
              {parsing ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
              {file ? "Ganti File" : "Pilih File Excel"}
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileSelect}
                className="hidden"
              />
            </label>
            <button
              onClick={handleDownloadTemplate}
              className="sm-btn inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold"
              style={{ background: colors.glassFill, color: colors.text, border: `1px solid ${colors.glassBorder}` }}
            >
              <FileDown size={14} /> Download Template
            </button>
          </div>

          {file && (
            <div className="text-xs mb-4 p-2.5 rounded-lg" style={{ background: colors.glassSubtle, color: colors.textMuted }}>
              File: <span className="font-semibold mono" style={{ color: colors.text }}>{file.name}</span> ({(file.size / 1024).toFixed(1)} KB)
            </div>
          )}

          {/* Parse error */}
          {parseError && (
            <div className="mb-4 p-3 rounded-lg flex items-start gap-2" style={{ background: colors.coral + "1A", color: colors.coral }}>
              <AlertCircle size={14} className="shrink-0 mt-0.5" />
              <div className="text-sm">{parseError}</div>
            </div>
          )}

          {/* Parsing loader */}
          {parsing && (
            <div className="py-8 flex flex-col items-center justify-center gap-2">
              <Loader2 size={24} className="animate-spin" style={{ color: colors.mint }} />
              <p className="text-sm" style={{ color: colors.textMuted }}>Membaca file Excel...</p>
            </div>
          )}

          {/* Result preview */}
          {result && !parsing && (
            <div className="space-y-4">
              {/* Stats */}
              <div className="grid grid-cols-3 gap-2">
                <StatCard label="Sales" value={result.stats.salesCount} color={colors.mint} colors={colors} />
                <StatCard label="Grup" value={result.stats.groupCount} color={colors.gold} colors={colors} />
                <StatCard label="Fokus" value={result.stats.focusCount} color={colors.violet} colors={colors} />
              </div>

              {/* Overlap warning */}
              {existingOverlap.length > 0 && (
                <div className="p-3 rounded-lg flex items-start gap-2" style={{ background: colors.gold + "1A", color: colors.gold }}>
                  <AlertCircle size={14} className="shrink-0 mt-0.5" />
                  <div className="text-xs">
                    <div className="font-semibold mb-1">Peringatan: {existingOverlap.length} sales akan ditimpa</div>
                    <div className="mono">Kode: {existingOverlap.slice(0, 8).join(", ")}{existingOverlap.length > 8 ? ` +${existingOverlap.length - 8}` : ""}</div>
                    <div className="mt-1" style={{ color: colors.textMuted }}>
                      Import akan <b>mengganti seluruh daftar sales</b> di depo aktif. {newCodes.length > 0 && `${newCodes.length} sales baru akan ditambahkan. `}
                      Sales existing yang tidak ada di file akan <b>terhapus</b>.
                    </div>
                  </div>
                </div>
              )}

              {/* Skipped rows / errors */}
              {result.errors.length > 0 && (
                <div className="p-3 rounded-lg" style={{ background: colors.coral + "0D", border: `1px solid ${colors.coral}33` }}>
                  <div className="flex items-center gap-2 mb-2">
                    <AlertCircle size={14} style={{ color: colors.coral }} />
                    <div className="text-sm font-semibold" style={{ color: colors.coral }}>
                      {result.errors.length} baris di-skip / warning
                    </div>
                  </div>
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {result.errors.slice(0, 10).map((err, i) => (
                      <div key={i} className="text-xs mono" style={{ color: colors.textMuted }}>
                        Sheet "{err.sheet}" baris {err.row}: {err.message}
                      </div>
                    ))}
                    {result.errors.length > 10 && (
                      <div className="text-xs italic" style={{ color: colors.textMuted }}>
                        + {result.errors.length - 10} warning lainnya...
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Sample preview (first 5 sales) */}
              {result.targets.length > 0 && (
                <div>
                  <div className="text-xs font-semibold mb-2" style={{ color: colors.textMuted }}>
                    PREVIEW (5 sales pertama)
                  </div>
                  <div className="rounded-lg overflow-hidden" style={{ border: `1px solid ${colors.glassBorder}` }}>
                    <table className="w-full text-xs">
                      <thead>
                        <tr style={{ background: colors.glassSubtle }}>
                          <th className="text-left p-2 mono" style={{ color: colors.textMuted }}>KODE</th>
                          <th className="text-left p-2" style={{ color: colors.textMuted }}>NAMA</th>
                          <th className="text-left p-2" style={{ color: colors.textMuted }}>TIER</th>
                          <th className="text-right p-2 mono" style={{ color: colors.textMuted }}>TARGET</th>
                          <th className="text-right p-2 mono" style={{ color: colors.textMuted }}>AO</th>
                          <th className="text-center p-2" style={{ color: colors.textMuted }}>GRUP</th>
                          <th className="text-center p-2" style={{ color: colors.textMuted }}>FOKUS</th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.targets.slice(0, 5).map((t, i) => (
                          <tr key={t.code} style={{ background: i % 2 === 0 ? "transparent" : colors.glassSubtle }}>
                            <td className="p-2 mono" style={{ color: colors.text }}>{t.code}</td>
                            <td className="p-2 truncate" style={{ color: colors.text }}>{t.name}</td>
                            <td className="p-2" style={{ color: colors.textMuted }}>{t.tier}</td>
                            <td className="p-2 text-right mono" style={{ color: colors.text }}>{fmtRp(t.total.value)}</td>
                            <td className="p-2 text-right mono" style={{ color: colors.text }}>{t.total.ao}</td>
                            <td className="p-2 text-center" style={{ color: colors.textMuted }}>{t.groups.length}</td>
                            <td className="p-2 text-center" style={{ color: colors.textMuted }}>{t.focus.length}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {result.targets.length > 5 && (
                    <p className="text-xs mt-1" style={{ color: colors.textMuted }}>
                      + {result.targets.length - 5} sales lainnya...
                    </p>
                  )}
                </div>
              )}

              {/* Success message */}
              {result.targets.length === 0 && (
                <div className="p-4 rounded-lg flex items-center gap-2" style={{ background: colors.coral + "1A", color: colors.coral }}>
                  <AlertCircle size={16} />
                  <div className="text-sm">Tidak ada sales valid yang ditemukan di file. Periksa format Excel atau download template sebagai panduan.</div>
                </div>
              )}
            </div>
          )}

          {/* Empty state — belum pilih file */}
          {!file && !parsing && !result && !parseError && (
            <div className="py-8 text-center">
              <FileSpreadsheet size={32} className="mx-auto mb-3" style={{ color: colors.textMuted, opacity: 0.4 }} />
              <p className="text-sm" style={{ color: colors.textMuted }}>
                Pilih file Excel untuk mulai import, atau download template terlebih dahulu.
              </p>
              <p className="text-xs mt-2" style={{ color: colors.textMuted }}>
                Sheet Sales wajib. Sheet Grup dan Fokus opsional.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-5 flex gap-2 shrink-0" style={{ borderTop: `1px solid ${colors.glassBorder}` }}>
          <button
            onClick={onClose}
            className="flex-1 sm-btn px-4 py-2 rounded-lg text-sm font-semibold"
            style={{ background: colors.glassFill, color: colors.text, border: `1px solid ${colors.glassBorder}` }}
          >
            Batal
          </button>
          <button
            onClick={handleConfirm}
            disabled={!canConfirm}
            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background: colors.mint, color: "#0A1120" }}
          >
            <CheckCircle2 size={14} />
            Simpan {result ? `(${result.targets.length} sales)` : ""}
          </button>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, color, colors }) {
  return (
    <div
      className="p-3 rounded-lg text-center"
      style={{ background: color + "0D", border: `1px solid ${color}33` }}
    >
      <div className="text-2xl font-bold mono" style={{ color }}>{value}</div>
      <div className="text-xs mt-0.5" style={{ color: colors.textMuted }}>{label}</div>
    </div>
  );
}
