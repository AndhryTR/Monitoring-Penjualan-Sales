import { useState, useRef, useEffect } from "react";
import {
  Upload, X, ChevronDown, ChevronUp, RefreshCw, FileSpreadsheet,
  CloudUpload, AlertTriangle,
} from "lucide-react";
import { fmtNum } from "../../utils/formatters.js";
import { ConfirmDialog } from "../ui/ConfirmDialog.jsx";

export function UploadDropzone({
  onFile,
  hasData,
  rowCount = 0,
  fileName,
  onReset,
  onSample,
  loading,
  sampleLoading,
  colors,
  isEditor = false,
  onSaveMaster,
  masterBusy = false,
  masterResult = null,
  onOpenMasterRange,
  canAccess,
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef(null);
  // Konfirmasi hapus data aktif (anti salah-tekan — onReset hanya sesudah konfirm)
  const [clearConfirm, setClearConfirm] = useState(false);

  const allowSaveMaster = (!canAccess || canAccess("btn:save_master")) && isEditor;
  const allowDeleteMaster = (!canAccess || canAccess("btn:delete_master")) && isEditor;
  const allowSample = !canAccess || canAccess("feat:sample_data");
  const allowClear = !canAccess || canAccess("btn:clear_all");

  // Jika data direset/kosong, kembalikan ke mode default
  useEffect(() => {
    if (!hasData) {
      setIsExpanded(false);
    }
  }, [hasData]);

  const handleFiles = (files) => {
    if (files && files.length) onFile(Array.from(files));
    if (inputRef.current) inputRef.current.value = "";
  };

  // =========================================================================
  // MODE 1: COMPACT STATUS BAR (~40px) — Aktif otomatis saat data sudah dimuat
  // =========================================================================
  if (hasData && !isExpanded) {
    return (
      <>
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); }}
        className={`sm-card px-3 py-2 rounded-xl flex flex-wrap items-center justify-between gap-2.5 transition-all duration-200 ${dragOver ? "sm-pulse" : ""}`}
        style={{
          border: `1px ${dragOver ? "dashed " + colors.mint : "solid " + (colors.glassBorder || "rgba(255,255,255,0.08)")}`,
          background: dragOver ? colors.mint + "14" : colors.glassSubtle || colors.glassFill,
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
        }}
      >
        <input ref={inputRef} type="file" accept=".xlsx,.xls,.csv" multiple className="hidden" onChange={(e) => handleFiles(e.target.files)} />

        {/* Sisi Kiri: Badge file & jumlah baris */}
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className="p-1.5 rounded-lg shrink-0 flex items-center justify-center"
            style={{ background: colors.mint + "1A", color: colors.mint }}
          >
            <FileSpreadsheet size={15} />
          </div>
          <div className="flex items-center gap-2 min-w-0">
            <span
              className="disp text-xs sm:text-sm font-semibold truncate max-w-[150px] sm:max-w-[260px] md:max-w-[340px]"
              style={{ color: colors.text }}
              title={fileName}
            >
              {fileName}
            </span>
            {rowCount > 0 && (
              <span
                className="mono text-[11px] px-2 py-0.5 rounded-md font-medium shrink-0"
                style={{
                  background: colors.mint + "18",
                  color: colors.mint,
                  border: `1px solid ${colors.mint}33`,
                }}
              >
                {fmtNum(rowCount)} baris
              </span>
            )}
          </div>
        </div>

        {/* Sisi Kanan: Aksi cepat */}
        <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
          {/* Tombol Ganti File */}
          <button
            type="button"
            onClick={() => inputRef.current && inputRef.current.click()}
            className="sm-btn text-xs px-2.5 py-1.5 rounded-lg font-medium flex items-center gap-1.5 transition-colors"
            style={{
              background: colors.glassFill,
              border: `1px solid ${colors.glassBorder}`,
              color: colors.text,
            }}
            title="Upload file baru untuk mengganti atau menggabungkan data"
            disabled={loading}
          >
            {loading ? (
              <RefreshCw size={13} className="sm-pulse" style={{ color: colors.gold }} />
            ) : (
              <Upload size={13} style={{ color: colors.gold }} />
            )}
            <span className="hidden sm:inline">Ganti/Tambah File</span>
          </button>

          {/* Admin / Supervisor: Simpan Master */}
          {allowSaveMaster && onSaveMaster && (
            <button
              type="button"
              onClick={onSaveMaster}
              disabled={masterBusy || !rowCount}
              className="sm-btn text-xs px-2.5 py-1.5 rounded-lg font-medium flex items-center gap-1.5 transition-colors disabled:opacity-40"
              style={{
                background: colors.mint + "1A",
                color: colors.mint,
                border: `1px solid ${colors.mint}44`,
              }}
              title="Simpan data saat ini ke Master Cloud"
            >
              <CloudUpload size={13} />
              <span className="hidden sm:inline">Simpan Master</span>
            </button>
          )}

          {/* Admin / Supervisor: Hapus Rentang */}
          {allowDeleteMaster && onOpenMasterRange && (
            <button
              type="button"
              onClick={onOpenMasterRange}
              disabled={masterBusy}
              className="sm-btn text-xs px-2 py-1.5 rounded-lg font-medium flex items-center gap-1 transition-colors disabled:opacity-40"
              style={{
                background: colors.glassFill,
                color: colors.coral,
                border: `1px solid ${colors.coral}33`,
              }}
              title="Hapus data rentang tanggal dari Master"
            >
              <AlertTriangle size={13} />
              <span className="hidden md:inline">Hapus Rentang</span>
            </button>
          )}

          {/* Feedback hasil master bila ada */}
          {masterResult && (
            <span
              className="text-[11px] font-medium px-2 py-0.5 rounded"
              style={{
                color: masterResult.startsWith("Gagal") ? colors.coral : colors.mint,
                background: masterResult.startsWith("Gagal") ? colors.coral + "14" : colors.mint + "14",
              }}
            >
              {masterResult}
            </span>
          )}

          {/* Tombol Hapus Data */}
          {allowClear && (
            <button
              type="button"
              onClick={() => setClearConfirm(true)}
              className="sm-btn text-xs p-1.5 rounded-lg font-medium transition-colors"
              style={{
                background: colors.coral + "14",
                border: `1px solid ${colors.coral}33`,
                color: colors.coral,
              }}
              title="Hapus data aktif"
              aria-label="Hapus data aktif"
            >
              <X size={13} />
            </button>
          )}

          {/* Tombol Buka Dropzone Penuh */}
          <button
            type="button"
            onClick={() => setIsExpanded(true)}
            className="sm-btn text-xs p-1.5 rounded-lg font-medium transition-colors"
            style={{
              background: colors.glassFill,
              border: `1px solid ${colors.glassBorder}`,
              color: colors.textMuted,
            }}
            title="Tampilkan area dropzone penuh"
            aria-label="Perbesar area dropzone"
          >
            <ChevronDown size={13} />
          </button>
        </div>
      </div>

      <ConfirmDialog
        isOpen={clearConfirm}
        onCancel={() => setClearConfirm(false)}
        onConfirm={() => { setClearConfirm(false); onReset?.(); }}
        title="Hapus data aktif?"
        subtitle={fileName
          ? `${fileName} (${rowCount} baris) dihapus dari tampilan. Master cloud tidak ikut terhapus.`
          : "Data aktif dihapus dari tampilan. Master cloud tidak ikut terhapus."}
        confirmLabel="Hapus"
        variant="danger"
        colors={colors}
      />
      </>
    );
  }

  // =========================================================================
  // MODE 2: FULL DROPZONE — Saat data belum ada atau diperbesar manual
  // =========================================================================
  return (
    <>
    <div>
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); }}
        onClick={() => inputRef.current && inputRef.current.click()}
        className={`sm-drop cursor-pointer rounded-2xl p-6 flex flex-col sm:flex-row items-start sm:items-center gap-4 transition-colors relative ${dragOver ? "sm-pulse" : ""}`}
        style={{
          border: `2px dashed ${dragOver ? colors.mint + "66" : colors.glassBorderElevated}`,
          background: dragOver ? colors.mint + "0F" : colors.glassSubtle,
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
        }}
      >
        <input ref={inputRef} type="file" accept=".xlsx,.xls,.csv" multiple className="hidden" onChange={(e) => handleFiles(e.target.files)} />

        <div className="flex items-center gap-4 flex-1 min-w-0 w-full sm:w-auto">
          <div className="p-3 rounded-xl shrink-0" style={{ background: colors.gold + "1A" }}>
            {loading ? <RefreshCw size={20} className="sm-pulse" style={{ color: colors.gold }} /> : <Upload size={20} style={{ color: colors.gold }} />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold disp" style={{ color: colors.text }}>
              {loading ? "Memproses file..." : "Upload file Excel sell-out"}
            </div>
            <div className="text-xs mt-0.5" style={{ color: colors.textMuted }}>
              {hasData
                ? `Sumber aktif: ${fileName} (${fmtNum(rowCount)} baris)`
                : "Tarik & lepas file di sini (bisa lebih dari satu untuk digabung), atau klik untuk memilih"}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 self-end sm:self-center" onClick={(e) => e.stopPropagation()}>
          {!hasData && allowSample && (
            <button
              type="button"
              onClick={onSample}
              className="sm-btn text-xs px-3 py-2 rounded-lg font-medium"
              style={{ background: colors.glassFill, border: `1px solid ${colors.glassBorder}`, color: colors.textMuted }}
              disabled={sampleLoading}
            >
              {sampleLoading ? (
                <span className="flex items-center gap-1.5"><RefreshCw size={13} className="sm-pulse" /> Memuat...</span>
              ) : (
                "Coba data contoh"
              )}
            </button>
          )}
          {hasData && (
            <>
              {allowSaveMaster && onSaveMaster && (
                <button
                  type="button"
                  onClick={onSaveMaster}
                  disabled={masterBusy || !rowCount}
                  className="sm-btn text-xs px-3 py-2 rounded-lg font-medium flex items-center gap-1.5 disabled:opacity-40"
                  style={{ background: colors.mint + "1A", color: colors.mint, border: `1px solid ${colors.mint}44` }}
                >
                  <CloudUpload size={13} /> Simpan Master
                </button>
              )}
              {allowClear && (
                <button
                  type="button"
                  onClick={() => setClearConfirm(true)}
                  className="sm-btn text-xs px-3 py-2 rounded-lg font-medium flex items-center gap-1.5"
                  style={{ background: colors.coral + "14", border: `1px solid ${colors.coral}33`, color: colors.coral }}
                >
                  <X size={13} /> Hapus data
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsExpanded(false)}
                className="sm-btn text-xs p-2 rounded-lg font-medium flex items-center gap-1"
                style={{ background: colors.glassFill, border: `1px solid ${colors.glassBorder}`, color: colors.textMuted }}
                title="Ciutkan area upload"
                aria-label="Ciutkan area upload"
              >
                <ChevronUp size={14} />
              </button>
            </>
          )}
        </div>
      </div>

      <ConfirmDialog
        isOpen={clearConfirm}
        onCancel={() => setClearConfirm(false)}
        onConfirm={() => { setClearConfirm(false); onReset?.(); }}
        title="Hapus data aktif?"
        subtitle={fileName
          ? `${fileName} (${rowCount} baris) dihapus dari tampilan. Master cloud tidak ikut terhapus.`
          : "Data aktif dihapus dari tampilan. Master cloud tidak ikut terhapus."}
        confirmLabel="Hapus"
        variant="danger"
        colors={colors}
      />
    </div>
    </>
  );
}
