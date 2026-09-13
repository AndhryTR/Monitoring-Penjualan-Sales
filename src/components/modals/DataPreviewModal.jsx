import { useState, useEffect } from "react";
import {
  FileSpreadsheet, AlertTriangle, CheckCircle2, XCircle, GitMerge, RefreshCcw,
} from "lucide-react";
import { fmtNum } from "../../utils/formatters.js";
import { FIELD_LABELS } from "../../constants/aliases.js";
import { Modal } from "../ui/Modal.jsx";

/* ============================================================================
   DATA PREVIEW MODAL
   Modal preview data sebelum dikonfirmasi — dipakai setelah user upload file
   Excel. Menampilkan ringkasan: baris terbaca, baris dilewati, sales/grup
   terdeteksi, duplikat dihapus, file digabung, rentang tanggal, kolom
   terdeteksi/tidak. Kalau sudah ada data sebelumnya, user juga memilih mau
   GABUNGKAN, GANTI TANGGAL YANG SAMA (untuk koreksi nota), atau GANTI SEMUA.
   User bisa konfirmasi "Gunakan Data Ini" atau batal.
============================================================================ */
export function DataPreviewModal({ isOpen, onCancel, onConfirm, preview, colors, canReplaceDates = false }) {
  const hasMergeOption = !!(preview && preview.mergePreview);
  const [mode, setMode] = useState(hasMergeOption ? "merge" : "replace");
  // Reset pilihan ke default setiap kali preview baru muncul (file baru dipilih)
  useEffect(() => { setMode(hasMergeOption ? "merge" : "replace"); }, [preview, hasMergeOption]);

  if (!isOpen || !preview) return null;
  const { rows, parseMeta, fileName, mergePreview } = preview;
  const dateStrs = rows.map((r) => r.date).filter(Boolean).sort();
  const uniqueSales = new Set(rows.map((r) => r.salesCode).filter(Boolean)).size;
  const uniqueGroups = new Set(rows.map((r) => r.group).filter(Boolean)).size;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onCancel}
      title="Preview Data"
      subtitle={fileName}
      icon={FileSpreadsheet}
      colors={colors}
      maxWidth="max-w-2xl"
      maxHeight="max-h-[85vh]"
      footer={
        <div className="flex justify-end gap-3 w-full">
          <button onClick={onCancel} className="sm-btn px-4 py-2.5 rounded-xl text-sm font-semibold" style={{ background: colors.glassFill, color: colors.text, border: `1px solid ${colors.glassBorder}` }}>
            Batal
          </button>
          <button onClick={() => onConfirm(mode)} className="sm-btn px-4 py-2.5 rounded-xl text-sm font-semibold" style={{ background: colors.gold, color: "#0A1120" }}>
            {mode === "merge" ? "Gabungkan Data" : mode === "replace_dates" ? "Ganti Data per Tanggal" : "Gunakan Data Ini"}
          </button>
        </div>
      }
    >
          {(hasMergeOption || canReplaceDates) && (
            <div className="mb-6">
              {hasMergeOption && <div className="text-xs uppercase tracking-wider mb-2" style={{ color: colors.textMuted }}>
                Sudah ada {fmtNum(mergePreview.existingRowCount)} baris data sebelumnya
              </div>}
              <div className={`grid grid-cols-1 ${hasMergeOption ? "sm:grid-cols-3" : "sm:grid-cols-2"} gap-3`}>
                {hasMergeOption && <>
                <button
                  onClick={() => setMode("merge")}
                  className="sm-btn text-left p-3.5 rounded-xl"
                  style={{
                    background: mode === "merge" ? colors.mint + "1A" : colors.glassFill,
                    border: `1px solid ${mode === "merge" ? colors.mint + "66" : colors.glassBorder}`,
                  }}
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <GitMerge size={15} style={{ color: mode === "merge" ? colors.mint : colors.textMuted }} />
                    <span className="text-sm font-semibold" style={{ color: mode === "merge" ? colors.mint : colors.text }}>Gabungkan dengan data yang ada</span>
                  </div>
                  <p className="text-xs" style={{ color: colors.textMuted }}>
                    Disarankan. Baris duplikat otomatis dihilangkan — total jadi <b className="mono">{fmtNum(mergePreview.totalAfterMerge)}</b> baris
                    {mergePreview.dateFrom && ` (${mergePreview.dateFrom} — ${mergePreview.dateTo})`}.
                    {" "}<b className="mono">{fmtNum(Math.max(0, mergePreview.newRowsAdded))}</b> baris baru ditambahkan.
                  </p>
                </button>
                </>}
                {canReplaceDates && <>
                <button
                  onClick={() => setMode("replace_dates")}
                  className="sm-btn text-left p-3.5 rounded-xl"
                  style={{
                    background: mode === "replace_dates" ? colors.gold + "1A" : colors.glassFill,
                    border: `1px solid ${mode === "replace_dates" ? colors.gold + "66" : colors.glassBorder}`,
                  }}
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <RefreshCcw size={15} style={{ color: mode === "replace_dates" ? colors.gold : colors.textMuted }} />
                    <span className="text-sm font-semibold" style={{ color: mode === "replace_dates" ? colors.gold : colors.text }}>Ganti tanggal yang sama</span>
                  </div>
                  <p className="text-xs" style={{ color: colors.textMuted }}>
                    Untuk koreksi nota. Data lama hanya pada tanggal yang ada di file akan diganti; tanggal lain tetap aman. Saat disimpan ke Master, tanggal tersebut juga diganti di cloud.
                  </p>
                </button>
                </>}
                {hasMergeOption && <>
                <button
                  onClick={() => setMode("replace")}
                  className="sm-btn text-left p-3.5 rounded-xl"
                  style={{
                    background: mode === "replace" ? colors.coral + "1A" : colors.glassFill,
                    border: `1px solid ${mode === "replace" ? colors.coral + "66" : colors.glassBorder}`,
                  }}
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <RefreshCcw size={15} style={{ color: mode === "replace" ? colors.coral : colors.textMuted }} />
                    <span className="text-sm font-semibold" style={{ color: mode === "replace" ? colors.coral : colors.text }}>Ganti semua data yang lama</span>
                  </div>
                  <p className="text-xs" style={{ color: colors.textMuted }}>
                    Data sebelumnya ({fmtNum(mergePreview.existingRowCount)} baris) akan dihapus, diganti total dengan file ini saja ({fmtNum(rows.length)} baris).
                  </p>
                </button>
                </>}
              </div>
            </div>
          )}

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
                  // ⚠️ Sprint 4 / K3: stable key dari file name (bukan index).
                  <div key={sf.name || `sf-${i}`} className="flex items-center justify-between text-sm px-3 py-2 rounded-lg" style={{ background: colors.glassFill }}>
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
    </Modal>
  );
}
