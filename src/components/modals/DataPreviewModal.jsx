import {
  FileSpreadsheet, X, AlertTriangle, CheckCircle2, XCircle,
} from "lucide-react";
import { fmtNum } from "../../utils/formatters.js";
import { FIELD_LABELS } from "../../constants/aliases.js";

/* ============================================================================
   DATA PREVIEW MODAL
   Modal preview data sebelum dikonfirmasi — dipakai setelah user upload file
   Excel. Menampilkan ringkasan: baris terbaca, baris dilewati, sales/grup
   terdeteksi, duplikat dihapus, file digabung, rentang tanggal, kolom
   terdeteksi/tidak. User bisa konfirmasi "Gunakan Data Ini" atau batal.
============================================================================ */
export function DataPreviewModal({ isOpen, onCancel, onConfirm, preview, colors }) {
  if (!isOpen || !preview) return null;
  const { rows, parseMeta, fileName } = preview;
  const dateStrs = rows.map((r) => r.date).filter(Boolean).sort();
  const uniqueSales = new Set(rows.map((r) => r.salesCode).filter(Boolean)).size;
  const uniqueGroups = new Set(rows.map((r) => r.group).filter(Boolean)).size;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm sm-fadein">
      <div className="sm-card sm-modal-glass sm-scale-in w-full max-w-2xl max-h-[85vh] flex flex-col">
        <div className="p-5 flex items-center justify-between" style={{ borderBottom: `1px solid ${colors.border}` }}>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl" style={{ background: colors.gold + "1A" }}><FileSpreadsheet size={16} style={{ color: colors.gold }} /></div>
            <div>
              <div className="disp text-base font-semibold">Preview Data</div>
              <div className="text-xs" style={{ color: colors.textMuted }}>{fileName}</div>
            </div>
          </div>
          <button onClick={onCancel} className="sm-btn p-2 rounded-full" style={{ background: colors.surface2 }}><X size={16} /></button>
        </div>
        <div className="p-5 overflow-y-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <div className="sm-card p-3">
              <div className="text-xs mb-1" style={{ color: colors.textMuted }}>Baris Terbaca</div>
              <div className="mono text-lg font-bold">{fmtNum(rows.length)}</div>
            </div>
            <div className="sm-card p-3">
              <div className="text-xs mb-1" style={{ color: colors.textMuted }}>Baris Dilewati</div>
              <div className="mono text-lg font-bold" style={{ color: parseMeta.skippedBlankRows > 0 ? colors.gold : colors.text }}>{fmtNum(parseMeta.skippedBlankRows)}</div>
            </div>
            <div className="sm-card p-3">
              <div className="text-xs mb-1" style={{ color: colors.textMuted }}>Sales Terdeteksi</div>
              <div className="mono text-lg font-bold">{uniqueSales}</div>
            </div>
            <div className="sm-card p-3">
              <div className="text-xs mb-1" style={{ color: colors.textMuted }}>Grup Produk</div>
              <div className="mono text-lg font-bold">{uniqueGroups}</div>
            </div>
          </div>

          {parseMeta.duplicateRowsRemoved > 0 && (
            <div className="mb-6 flex items-start gap-2.5 px-3.5 py-3 rounded-xl text-sm" style={{ background: colors.gold + "0D", border: `1px solid ${colors.gold}33`, color: colors.text }}>
              <AlertTriangle size={15} className="mt-0.5 shrink-0" style={{ color: colors.gold }} />
              <span>
                <b>{fmtNum(parseMeta.duplicateRowsRemoved)} baris duplikat</b> terdeteksi & otomatis dihapus — baris dengan Tanggal, No Faktur, Kode Produk, Qty, dan Value yang persis sama (biasanya karena file yang sama ter-upload 2×, atau rentang tanggal antar file yang digabung saling overlap).
              </span>
            </div>
          )}

          {parseMeta.sourceFiles && parseMeta.sourceFiles.length > 1 && (
            <div className="mb-6">
              <div className="text-xs uppercase tracking-wider mb-2" style={{ color: colors.textMuted }}>{parseMeta.sourceFiles.length} File Digabung</div>
              <div className="space-y-1.5">
                {parseMeta.sourceFiles.map((sf, i) => (
                  <div key={i} className="flex items-center justify-between text-sm px-3 py-2 rounded-lg" style={{ background: colors.surface2 }}>
                    <span className="truncate flex-1">{sf.name}</span>
                    <span className="mono text-xs" style={{ color: colors.textMuted }}>{fmtNum(sf.rowCount)} baris</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="mb-6">
            <div className="text-xs uppercase tracking-wider mb-2" style={{ color: colors.textMuted }}>Rentang Tanggal Terdeteksi</div>
            <div className="text-sm font-medium">{dateStrs.length ? `${dateStrs[0]} — ${dateStrs[dateStrs.length - 1]}` : "Tidak ada tanggal valid terbaca"}</div>
          </div>

          <div className="mb-2">
            <div className="text-xs uppercase tracking-wider mb-2" style={{ color: colors.textMuted }}>Kolom Terdeteksi</div>
            <div className="flex flex-wrap gap-2">
              {parseMeta.detectedFields.map((f) => (
                <span key={f} className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs" style={{ background: colors.mint + "1A", color: colors.mint }}>
                  <CheckCircle2 size={12} /> {FIELD_LABELS[f] || f}
                </span>
              ))}
            </div>
          </div>

          {parseMeta.missingFields.length > 0 && (
            <div className="mt-4">
              <div className="text-xs uppercase tracking-wider mb-2" style={{ color: colors.textMuted }}>Kolom Tidak Terdeteksi</div>
              <div className="flex flex-wrap gap-2 mb-2">
                {parseMeta.missingFields.map((f) => (
                  <span key={f} className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs" style={{ background: colors.coral + "1A", color: colors.coral }}>
                    <XCircle size={12} /> {FIELD_LABELS[f] || f}
                  </span>
                ))}
              </div>
              <p className="text-xs" style={{ color: colors.textMuted }}>Data tetap bisa dipakai, tapi kolom di atas akan kosong/nol pada baris yang terpengaruh.</p>
            </div>
          )}

          {parseMeta.rowsWithMissingDate > 0 && (
            <div className="mt-4 flex items-center gap-2 px-3 py-2 rounded-lg text-xs" style={{ background: colors.gold + "14", color: colors.gold }}>
              <AlertTriangle size={13} /> {fmtNum(parseMeta.rowsWithMissingDate)} baris punya tanggal yang tidak terbaca.
            </div>
          )}
        </div>
        <div className="p-5 flex justify-end gap-3" style={{ borderTop: `1px solid ${colors.border}` }}>
          <button onClick={onCancel} className="sm-btn px-4 py-2.5 rounded-xl text-sm font-semibold" style={{ background: colors.surface2, color: colors.text, border: `1px solid ${colors.border}` }}>
            Batal
          </button>
          <button onClick={onConfirm} className="sm-btn px-4 py-2.5 rounded-xl text-sm font-semibold" style={{ background: colors.gold, color: "#0A1120" }}>
            Gunakan Data Ini
          </button>
        </div>
      </div>
    </div>
  );
}
