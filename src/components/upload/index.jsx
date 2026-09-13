import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  Upload, Download, X, ChevronDown, ChevronUp, RefreshCw, FileSpreadsheet,
  FileText, Printer, Image as ImageIcon, MessageSquare, CloudUpload, AlertTriangle,
} from "lucide-react";
import { fmtPct, fmtNum } from "../../utils/formatters.js";
import { notifyExportSuccess, notifyError } from "../../utils/notifyExport.js";
import { useFloatingDropdown } from "../../hooks/useFloatingDropdown.js";
import { ConfirmDialog } from "../ui/ConfirmDialog.jsx";
export { GlobalDragOverlay } from "./GlobalDragOverlay.jsx";
// ⚠️ Sprint 5 / S3: semua export module (pdfExport, excelExport, imageExport)
// sebelumnya static import (~2.4MB total: jspdf+xlsx-js-style+html2canvas).
// Sekarang lazy-load via dynamic import() di handler onClick. Initial bundle
// jadi ~2.4MB lebih kecil — first page load jauh lebih cepat.
//
// Catatan: imageExport.js#exportHtmlAsImage dipakai di handleImageExport yang
// juga async — tetap perlu lazy-load di handler, BUKAN static import.
// buildSalesGroupComparisonHTML & buildExcelReportHTML adalah pure functions
// (tanpa dep berat) — boleh tetap static, tapi karena satu file dengan
// exportHtmlAsImage (yang berat html2canvas), sekalian di-lazy-load.

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

/* ============================================================================
   MOBILE NAVIGATION (H6) — Enhanced Horizontal Scroll
   - MobileBottomNav: bottom tab bar untuk mobile (md:hidden) dengan
     horizontal scroll. SEMUA tab ditampilkan — tidak ada lagi pemisahan
     primary/more — user bisa swipe/geser untuk melihat tab yang tidak muat.
   - Scroll indicator dots di bawah menunjukkan posisi tab aktif.
   - Aktif secara otomatis scroll ke tengah via scrollIntoView.
   - MobileFab: tombol apung "Upload" di pojok kanan bawah (di atas bottom nav).

   Keduanya menghormati iOS safe-area-inset supaya tidak tertutup home indicator.
============================================================================ */

export function MobileBottomNav({ tabs, activeTab, onChange, colors }) {
  const containerRef = useRef(null);
  const activeRef = useRef(null);

  // Auto-scroll ke posisi tab aktif saat activeTab berubah
  useEffect(() => {
    if (activeRef.current && containerRef.current) {
      activeRef.current.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }
  }, [activeTab]);

  const activeIndex = useMemo(() => tabs.findIndex((t) => t.key === activeTab), [tabs, activeTab]);

  const navStyle = {
    overflowX: 'auto',
    scrollSnapType: 'x mandatory',
    WebkitOverflowScrolling: 'touch',
    scrollbarWidth: 'none',
    msOverflowStyle: 'none',
  };
  const itemStyle = { scrollSnapAlign: 'center', flexShrink: 0, width: 72 };

  return (
    <nav
      className="md:hidden fixed left-3 right-3 z-40 sm-mobile-nav-glass"
      style={{
        bottom: "calc(12px + env(safe-area-inset-bottom))",
        borderRadius: "24px",
        paddingBottom: 0,
      }}
    >
      <div ref={containerRef} style={navStyle} className="flex items-stretch px-1 pt-1.5 sm-scrollhide">
        {tabs.map((t) => {
          const Icon = t.icon;
          const isActive = t.key === activeTab;
          return (
            <button
              key={t.key}
              ref={isActive ? activeRef : undefined}
              onClick={() => onChange(t.key)}
              style={itemStyle}
              className="flex flex-col items-center justify-center gap-0.5 py-1.5 px-1 rounded-2xl transition-colors shrink-0"
              aria-label={t.label}
              aria-current={isActive ? "page" : undefined}
            >
              <div className="relative flex items-center justify-center" style={{ width: 20, height: 20 }}>
                {isActive && (
                  <div className="absolute inset-0 rounded-full" style={{ background: colors.mint, opacity: 0.25, filter: "blur(8px)" }} />
                )}
                <Icon size={20} style={{ strokeWidth: isActive ? 2.4 : 2, position: "relative", color: isActive ? colors.mint : colors.textMuted }} />
              </div>
              <span className="text-[10px] font-medium leading-tight truncate w-full text-center whitespace-nowrap" style={{ color: isActive ? colors.mint : colors.textMuted, maxWidth: 64 }}>
                {t.shortLabel}
              </span>
            </button>
          );
        })}
      </div>

      {/* Scroll indicator dots */}
      {tabs.length > 0 && (
        <div className="flex justify-center items-center gap-1 pb-1.5 pt-0.5">
          {tabs.map((t, i) => {
            const isActiveDot = i === activeIndex;
            return (
              <div
                key={t.key}
                className="transition-all duration-250 rounded-full"
                style={{
                  width: isActiveDot ? 16 : 5,
                  height: 3,
                  borderRadius: 2,
                  background: isActiveDot ? colors.gold : colors.glassBorder,
                }}
              />
            );
          })}
        </div>
      )}
    </nav>
  );
}

export function MobileFab({ onFile, colors, loading }) {
  const inputRef = useRef(null);
  const handleFiles = (files) => {
    if (files && files.length) onFile(Array.from(files));
    // Reset value supaya file yang sama bisa dipilih lagi setelahnya
    if (inputRef.current) inputRef.current.value = "";
  };
  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls,.csv"
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
      <div
        className="md:hidden fixed right-4 z-30 pointer-events-none"
        style={{
          bottom: "calc(96px + env(safe-area-inset-bottom))",
          width: 56,
          height: 56,
          borderRadius: "9999px",
          background: `linear-gradient(135deg, ${colors.gold}, ${colors.coral})`,
          filter: "blur(20px)",
          opacity: 0.5,
        }}
        aria-hidden="true"
      />
      <button
        onClick={() => inputRef.current && inputRef.current.click()}
        className="md:hidden fixed right-4 z-40 sm-btn flex items-center justify-center w-14 h-14 rounded-full"
        style={{
          bottom: "calc(96px + env(safe-area-inset-bottom))",
          background: `linear-gradient(135deg, ${colors.gold}, ${colors.coral})`,
          color: "#0A1120",
          boxShadow: "0 8px 24px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.35)",
        }}
        aria-label="Upload file Excel sell-out"
      >
        {loading ? <RefreshCw size={22} className="sm-pulse" /> : <Upload size={22} />}
      </button>
    </>
  );
}


function MenuItem({ icon: Icon, iconColor, label, desc, onClick, colors }) {
  return (
    <button
      onClick={onClick}
      className="sm-row w-full text-left px-4 py-2.5 flex items-start gap-3 cursor-pointer"
    >
      <Icon size={15} className="mt-0.5 shrink-0" style={{ color: iconColor }} />
      <div className="min-w-0">
        <div className="text-sm font-medium">{label}</div>
        {desc && <div className="text-xs" style={{ color: colors?.textMuted }}>{desc}</div>}
      </div>
    </button>
  );
}

function FormatPill({ label, active, disabled, onClick, colors, title }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="px-2.5 py-1 rounded-md text-[11px] font-bold transition-all duration-150 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transform active:scale-95"
      style={{
        background: hovered
          ? (active ? colors.gold : colors.glassFillStrong)
          : (active ? `${colors.gold}25` : colors.glassFill),
        border: `1px solid ${hovered ? colors.gold : (active ? `${colors.gold}66` : colors.glassBorder)}`,
        color: hovered
          ? (active ? "#0A1120" : colors.text)
          : (active ? colors.gold : colors.textMuted),
        boxShadow: hovered ? `0 2px 8px ${colors.gold}44` : "none",
      }}
      title={title}
    >
      {label}
    </button>
  );
}

function SectionLabel({ children, colors }) {
  return (
    <div
      className="px-4 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-wider"
      style={{ color: colors?.textMuted }}
    >
      {children}
    </div>
  );
}

// Item menu "Gambar" dengan aksi 1-klik langsung download PNG (standar kualitas tinggi)
// serta tombol opsi JPG di sebelah kanan dengan hover visual aktif.
function ImageMenuItem({
  itemKey,
  label,
  desc,
  buildFn,
  filenameBase,
  imageBusy,
  onImageExport,
  colors,
}) {
  const isBusy = imageBusy === itemKey;

  return (
    <div
      onClick={() => !isBusy && onImageExport(itemKey, buildFn, filenameBase, "png")}
      className="sm-row w-full px-4 py-2.5 flex items-center justify-between gap-3 cursor-pointer transition-colors"
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          if (!isBusy) onImageExport(itemKey, buildFn, filenameBase, "png");
        }
      }}
    >
      <div className="flex items-start gap-3 min-w-0 flex-1">
        {isBusy ? (
          <RefreshCw size={15} className="mt-0.5 shrink-0 sm-pulse" style={{ color: colors.gold }} />
        ) : (
          <ImageIcon size={15} className="mt-0.5 shrink-0" style={{ color: colors.blue || colors.gold }} />
        )}
        <div className="min-w-0">
          <div className="text-sm font-medium flex items-center gap-2">
            <span className="truncate">{label}</span>
            {isBusy && <span className="text-[11px] font-semibold shrink-0" style={{ color: colors.gold }}>Memproses...</span>}
          </div>
          <div className="text-xs truncate" style={{ color: colors.textMuted }}>{desc}</div>
        </div>
      </div>

      {/* Format pills: 1-klik download PNG atau JPG dengan hover visual interaktif */}
      <div className="flex items-center gap-1.5 shrink-0">
        <FormatPill
          label="PNG"
          active={true}
          disabled={isBusy}
          colors={colors}
          title="Download gambar format PNG (Resolusi tinggi)"
          onClick={() => onImageExport(itemKey, buildFn, filenameBase, "png")}
        />
        <FormatPill
          label="JPG"
          active={false}
          disabled={isBusy}
          colors={colors}
          title="Download gambar format JPG / JPEG"
          onClick={() => onImageExport(itemKey, buildFn, filenameBase, "jpeg")}
        />
      </div>
    </div>
  );
}

export function ExportMenu({
  agg,
  targets,
  workDays,
  depotName,
  disabled,
  colors,
  activeTab = "main",
  outletThresholds,
  tabExports = {},
  onOpenDailyReport,
  canAccess,
}) {
  const [open, setOpen] = useState(false);
  const [scorecardListOpen, setScorecardListOpen] = useState(false);
  const [imageBusy, setImageBusy] = useState(null);
  const sheetRef = useRef(null);

  const allowDaily = !canAccess || canAccess("feat:daily_report");
  const allowExcel = !canAccess || canAccess("btn:export_excel");
  const allowPdf = !canAccess || canAccess("btn:export_pdf");
  const allowImage = !canAccess || canAccess("btn:export_image");
  const hasAnyExport = allowDaily || allowExcel || allowPdf || allowImage;

  const handleClose = useCallback(() => setOpen(false), []);
  const additionalDropdownRefs = useMemo(() => [sheetRef], []);

  const {
    triggerRef: ref,
    floatingRef: desktopDropdownRef,
    position: desktopDropdownPos,
  } = useFloatingDropdown({
    isOpen: open,
    onClose: handleClose,
    align: "right",
    width: 320,
    gap: 8,
    margin: 16,
    estimatedHeight: 520,
    additionalRefs: additionalDropdownRefs,
    // Mobile sheet (bottom-sheet portal) jangan auto-close saat scroll:
    // scroll halaman / viewport shift (address bar) menggeser rect trigger
    // sesaat -> hook kira trigger keluar layar -> sheet keluar sendiri.
    // Desktop dropdown tetap ikut posisi via listener yang sama.
    autoCloseOnScrollOut: false,
  });

  // Ditutup lagi tiap kali menu utama ditutup/dibuka ulang, supaya tidak
  // "nyangkut" kebuka pas dropdown dipakai lagi lain waktu.
  useEffect(() => { if (!open) { setScorecardListOpen(false); } }, [open]);

  const opts = { workDays, depotName };
  const salesSorted = useMemo(() => [...(agg?.bySales || [])].sort((a, b) => a.name.localeCompare(b.name)), [agg?.bySales]);
  const currentTabExports = (tabExports && tabExports.current) ? tabExports.current : (tabExports || {});

  const handleImageExport = async (key, buildFnRef, filenameBase, format) => {
    setImageBusy(key);
    try {
      // ⚠️ Sprint 5 / S3: lazy-load imageExport.js (~1.2MB gabung html2canvas).
      // buildFnRef adalah function yang mengembalikan module + builder, dipanggil di sini.
      const { exportHtmlAsImage } = await import("../../utils/imageExport.js");
      const { html } = await buildFnRef();
      await exportHtmlAsImage(html, filenameBase, format);
      await notifyExportSuccess("Export berhasil", `${filenameBase}.${format === "jpeg" ? "jpg" : "png"}`);
    } catch (e) {
      // ⚠️ Bug fix (H12): exportHtmlAsImage bisa throw SecurityError bila canvas
      // tainted oleh gambar cross-origin. Tanpa catch, error propagate sebagai
      // unhandled rejection dan menu diam-diam tutup tanpa feedback ke user.
      console.warn("Export gambar gagal:", e);
      notifyError("Export gambar gagal", e?.message || String(e));
    } finally {
      setImageBusy(null);
      setOpen(false);
    }
  };

  const renderScorecardIndividual = () => (
    <>
      <button onClick={() => setScorecardListOpen((v) => !v)}
        className="sm-row w-full text-left px-4 py-2.5 flex items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <Printer size={15} className="mt-0.5 shrink-0" style={{ color: colors.gold }} />
          <div className="min-w-0">
            <div className="text-sm font-medium">Cetak Scorecard Individual</div>
            <div className="text-xs" style={{ color: colors.textMuted }}>Pilih 1 sales untuk dicetak sendiri</div>
          </div>
        </div>
        <ChevronDown size={13} style={{ color: colors.textMuted, transform: scorecardListOpen ? "rotate(180deg)" : "none", transition: "transform .2s", flexShrink: 0 }} />
      </button>
      {scorecardListOpen && (
        <div className="max-h-52 overflow-y-auto" style={{ borderTop: `1px solid ${colors.glassBorder}`, background: colors.glassFill }}>
          {salesSorted.map((sm) => (
            <button key={sm.code} onClick={async () => {
              // ⚠️ Sprint 5 / S3: lazy-load pdfExport.js (~600KB).
              const { exportSalesScorecardPDF } = await import("../../utils/pdfExport.js");
              exportSalesScorecardPDF(sm, agg, opts);
              await notifyExportSuccess("Export berhasil", `Scorecard ${sm.name}`);
              setOpen(false);
            }}
              className="sm-row w-full text-left pl-11 pr-4 py-2 flex items-center justify-between gap-2">
              <span className="text-sm truncate">{sm.name}</span>
              <span className="text-xs mono shrink-0" style={{ color: colors.textMuted }}>{fmtPct(sm.ach)}</span>
            </button>
          ))}
        </div>
      )}
    </>
  );

  const renderDefaultMenu = () => {
    if (!hasAnyExport) {
      return (
        <div className="px-4 py-3 text-center text-xs" style={{ color: colors.textMuted }}>
          Akses export dibatasi oleh administrator.
        </div>
      );
    }
    return (
      <>
        {allowDaily && (
          <>
            <SectionLabel colors={colors}>Pesan Singkat & Harian</SectionLabel>
            <MenuItem icon={MessageSquare} iconColor={colors.mint} label="Laporan Ringkas Harian"
              desc="Format teks WhatsApp & kartu gambar ringkas (PNG)"
              colors={colors}
              onClick={() => {
                setOpen(false);
                onOpenDailyReport?.();
              }} />
          </>
        )}

        {allowExcel && (
          <>
            {allowDaily && <div style={{ borderTop: `1px solid ${colors.glassBorder}` }} />}
            <SectionLabel colors={colors}>Excel</SectionLabel>
            <MenuItem icon={FileSpreadsheet} iconColor={colors.mint} label="Export ke Excel"
              desc="Format lengkap dengan target, deviasi & produk fokus"
              colors={colors}
              onClick={async () => {
                // ⚠️ Sprint 5 / S3: lazy-load excelExport.js (~620KB).
                const { exportToExcel } = await import("../../utils/excelExport.js");
                exportToExcel(agg, targets, opts);
                await notifyExportSuccess("Export berhasil", "Excel laporan utama");
                setOpen(false);
              }} />
          </>
        )}

        {allowPdf && (
          <>
            {(allowDaily || allowExcel) && <div style={{ borderTop: `1px solid ${colors.glassBorder}` }} />}
            <SectionLabel colors={colors}>PDF</SectionLabel>
            <MenuItem icon={FileText} iconColor={colors.coral} label="Laporan Ringkasan"
              desc="KPI, leaderboard sales & rekap grup produk"
              colors={colors}
              onClick={async () => {
                const { exportSummaryPDF } = await import("../../utils/pdfExport.js");
                exportSummaryPDF(agg, targets, opts);
                await notifyExportSuccess("Export berhasil", "Laporan Ringkasan (PDF)");
                setOpen(false);
              }} />
            <MenuItem icon={FileText} iconColor={colors.coral} label="Scorecard Semua Sales"
              desc={`1 halaman per sales (${agg.bySales.length} sales)`}
              colors={colors}
              onClick={async () => {
                const { exportAllScorecardsPDF } = await import("../../utils/pdfExport.js");
                exportAllScorecardsPDF(agg, opts);
                await notifyExportSuccess("Export berhasil", `Scorecard Semua Sales (${agg.bySales.length} sales)`);
                setOpen(false);
              }} />
            <MenuItem icon={FileText} iconColor={colors.coral} label="Laporan Perbandingan Sales"
              desc="Rekap per grup, per sales & hari terakhir — 1 dokumen gabungan"
              colors={colors}
              onClick={async () => {
                const { exportSalesGroupComparisonPDF } = await import("../../utils/pdfExport.js");
                exportSalesGroupComparisonPDF(agg, opts);
                await notifyExportSuccess("Export berhasil", "Laporan Perbandingan Sales (PDF)");
                setOpen(false);
              }} />
          </>
        )}

        {allowImage && (
          <>
            {(allowDaily || allowExcel || allowPdf) && <div style={{ borderTop: `1px solid ${colors.glassBorder}` }} />}
            <SectionLabel colors={colors}>Gambar</SectionLabel>
            <ImageMenuItem
              itemKey="excel"
              label="Laporan Tabel Utama (Gambar)"
              desc="Tampilan visual tabel laporan utama (PNG / JPG)"
              imageBusy={imageBusy}
              onImageExport={handleImageExport}
              colors={colors}
              buildFn={async () => {
                // ⚠️ Sprint 5 / S3: lazy-load imageExport.js (~1.2MB).
                const { buildExcelReportHTML } = await import("../../utils/imageExport.js");
                return { html: buildExcelReportHTML(agg, targets, opts) };
              }}
              filenameBase={`Laporan_Sales_Gambar_${agg?.meta?.lastDate || "export"}`}
            />
            <ImageMenuItem
              itemKey="comparison"
              label="Laporan Perbandingan Sales (Gambar)"
              desc="Tampilan visual rekap perbandingan (PNG / JPG)"
              imageBusy={imageBusy}
              onImageExport={handleImageExport}
              colors={colors}
              buildFn={async () => {
                const { buildSalesGroupComparisonHTML } = await import("../../utils/imageExport.js");
                return { html: buildSalesGroupComparisonHTML(agg, opts) };
              }}
              filenameBase={`Laporan_Perbandingan_Sales_Gambar_${agg?.meta?.lastDate || "export"}`}
            />
          </>
        )}

        {allowPdf && (
          <>
            <div style={{ borderTop: `1px solid ${colors.glassBorder}` }} />
            {renderScorecardIndividual()}
          </>
        )}
      </>
    );
  };

  const TAB_LABELS = {
    executive: "Executive Summary",
    main: "Main Report",
    sales: "Laporan Sales",
    product: "Laporan Produk",
    focus: "Produk & Grup Fokus",
    outlet: "Analisis Outlet",
    compare: "Perbandingan",
    trend: "Tren Periode",
    transactions: "Transaksi",
    stock: "Stok Barang",
    quality: "Kualitas Data",
  };

  const renderContent = () => {
    if (activeTab === "sales") {
      return (
        <>
          <SectionLabel colors={colors}>Excel</SectionLabel>
          <MenuItem icon={FileSpreadsheet} iconColor={colors.mint} label="Laporan Sales (Excel)"
            desc="2 Sheet: Per Grup Produk & Total vs Hari Terakhir"
            colors={colors}
            onClick={async () => {
              const { exportSalesReportExcel } = await import("../../utils/reportExcelExport.js");
              const { getLastDaySalesMap } = await import("../../utils/aggregation.js");
              const groupRows = agg.bySales.flatMap((sm) => sm.groups.map((g) => ({
                salesName: sm.name, groupName: g.name,
                value: g.realisasiValue, ao: g.realisasiAo,
                targetValue: g.targetValue || 0, targetAo: g.targetAo || 0,
                ach: g.ach, deviasiValue: g.deviasiValue ?? 0,
                deviasiShow: (g.realisasiValue || 0) - (g.targetValue || 0),
                predicate: g.predicate,
              })));
              const lastDaySalesMap = getLastDaySalesMap(agg.filteredRows, agg.meta.lastDate);
              const totalVsLastDayRows = agg.bySales.map((sm) => {
                const ld = lastDaySalesMap[sm.code] || { valueLastDay: 0, aoLastDay: 0 };
                return {
                  code: sm.code, salesName: sm.name,
                  totalValue: sm.realisasiValue, totalAo: sm.realisasiAo, totalAch: sm.ach, totalAchAo: sm.achAo,
                  lastDayValue: ld.valueLastDay, lastDayAo: ld.aoLastDay,
                  predicate: sm.predicate,
                };
              });
              exportSalesReportExcel(agg, groupRows, totalVsLastDayRows, opts);
              await notifyExportSuccess("Export berhasil", "Laporan Sales (Excel)");
              setOpen(false);
            }} />

          <div style={{ borderTop: `1px solid ${colors.glassBorder}` }} />
          <SectionLabel colors={colors}>PDF</SectionLabel>
          <MenuItem icon={FileText} iconColor={colors.coral} label="Scorecard Semua Sales"
            desc={`1 halaman per sales (${agg.bySales.length} sales)`}
            colors={colors}
            onClick={async () => {
              const { exportAllScorecardsPDF } = await import("../../utils/pdfExport.js");
              exportAllScorecardsPDF(agg, opts);
              await notifyExportSuccess("Export berhasil", `Scorecard Semua Sales (${agg.bySales.length} sales)`);
              setOpen(false);
            }} />

          <div style={{ borderTop: `1px solid ${colors.glassBorder}` }} />
          {renderScorecardIndividual()}

          <div style={{ borderTop: `1px solid ${colors.glassBorder}` }} />
          <SectionLabel colors={colors}>Pesan Singkat</SectionLabel>
          <MenuItem icon={MessageSquare} iconColor={colors.mint} label="Laporan Ringkas Harian"
            desc="Format teks WhatsApp & kartu gambar ringkas (PNG)"
            colors={colors}
            onClick={() => {
              setOpen(false);
              onOpenDailyReport?.();
            }} />
        </>
      );
    }

    if (activeTab === "product") {
      return (
        <>
          <SectionLabel colors={colors}>Excel</SectionLabel>
          <MenuItem icon={FileSpreadsheet} iconColor={colors.mint} label="Laporan Detail Produk"
            desc="Ranking performa, value, target & ACH per grup produk"
            colors={colors}
            onClick={async () => {
              const { exportProductReportExcel } = await import("../../utils/reportExcelExport.js");
              exportProductReportExcel(agg.byGroup, opts);
              await notifyExportSuccess("Export berhasil", "Laporan Produk (Excel)");
              setOpen(false);
            }} />
        </>
      );
    }

    if (activeTab === "focus") {
      return (
        <>
          <SectionLabel colors={colors}>Excel</SectionLabel>
          <MenuItem icon={FileSpreadsheet} iconColor={colors.mint} label="Laporan Produk Fokus"
            desc="Detail kuantitas & pencapaian target produk fokus"
            colors={colors}
            onClick={async () => {
              const { exportProductFocusExcel } = await import("../../utils/reportExcelExport.js");
              exportProductFocusExcel(agg.focusRows, opts);
              await notifyExportSuccess("Export berhasil", "Produk Fokus (Excel)");
              setOpen(false);
            }} />
          <MenuItem icon={FileSpreadsheet} iconColor={colors.mint} label="Laporan Grup Fokus"
            desc="Target vs realisasi value & AO grup fokus per sales"
            colors={colors}
            onClick={async () => {
              const { exportFocusGroupExcel } = await import("../../utils/focusGroupExport.js");
              exportFocusGroupExcel(agg.focusGroupRows, agg.filteredRows, opts);
              await notifyExportSuccess("Export berhasil", "Grup Fokus (Excel)");
              setOpen(false);
            }} />

          <div style={{ borderTop: `1px solid ${colors.glassBorder}` }} />
          <SectionLabel colors={colors}>PDF</SectionLabel>
          <MenuItem icon={FileText} iconColor={colors.coral} label="Laporan Grup Fokus (PDF)"
            desc="Dokumen tabel target vs realisasi grup fokus"
            colors={colors}
            onClick={async () => {
              const { exportFocusGroupPDF } = await import("../../utils/focusGroupExport.js");
              exportFocusGroupPDF(agg.focusGroupRows, agg.filteredRows, opts);
              await notifyExportSuccess("Export berhasil", "Grup Fokus (PDF)");
              setOpen(false);
            }} />
        </>
      );
    }

    if (activeTab === "outlet") {
      return (
        <>
          <SectionLabel colors={colors}>Excel</SectionLabel>
          <MenuItem icon={FileSpreadsheet} iconColor={colors.mint} label="Laporan Analisis Outlet"
            desc="Klasifikasi status outlet (aktif, berisiko, dormant)"
            colors={colors}
            onClick={async () => {
              const { computeOutletAnalysis } = await import("../../utils/aggregation.js");
              const { exportOutletAnalysisExcel } = await import("../../utils/reportExcelExport.js");
              const { list, summary } = computeOutletAnalysis(agg.filteredRows, agg.meta, outletThresholds);
              exportOutletAnalysisExcel(list, summary, opts);
              await notifyExportSuccess("Export berhasil", "Analisis Outlet (Excel)");
              setOpen(false);
            }} />
        </>
      );
    }

    if (activeTab === "compare") {
      return (
        <>
          <SectionLabel colors={colors}>Excel</SectionLabel>
          <MenuItem icon={FileSpreadsheet} iconColor={colors.mint} label="Laporan Perbandingan Periode"
            desc="Matriks perbandingan entitas lintas periode"
            colors={colors}
            onClick={() => {
              if (currentTabExports.compare?.onExportExcel) {
                currentTabExports.compare.onExportExcel();
              }
              setOpen(false);
            }} />
        </>
      );
    }

    if (activeTab === "trend") {
      return (
        <>
          <SectionLabel colors={colors}>Excel</SectionLabel>
          <MenuItem icon={FileSpreadsheet} iconColor={colors.mint} label="Laporan Tren Periode (Excel)"
            desc="Data tren multi-periode value & AO per sales dengan grafik"
            colors={colors}
            onClick={() => {
              if (currentTabExports.trend?.onExportExcel) {
                currentTabExports.trend.onExportExcel();
              }
              setOpen(false);
            }} />

          <div style={{ borderTop: `1px solid ${colors.glassBorder}` }} />
          <SectionLabel colors={colors}>PDF</SectionLabel>
          <MenuItem icon={FileText} iconColor={colors.coral} label="Laporan Tren Periode (PDF)"
            desc="Grafik tren & tabel pertumbuhan per sales"
            colors={colors}
            onClick={() => {
              if (currentTabExports.trend?.onExportPdf) {
                currentTabExports.trend.onExportPdf();
              }
              setOpen(false);
            }} />
        </>
      );
    }

    if (activeTab === "transactions") {
      return (
        <>
          <SectionLabel colors={colors}>Excel</SectionLabel>
          <MenuItem icon={FileSpreadsheet} iconColor={colors.mint} label="Laporan Data Transaksi"
            desc="12 kolom lengkap: tanggal, sales, outlet, produk, grup, qty, satuan, value, invoice"
            colors={colors}
            onClick={async () => {
              if (currentTabExports.transactions?.onExportExcel) {
                currentTabExports.transactions.onExportExcel();
              } else {
                const { exportTransactionsExcel } = await import("../../utils/reportExcelExport.js");
                exportTransactionsExcel(agg.filteredRows, opts);
                await notifyExportSuccess("Export berhasil", "Data Transaksi (Excel)");
              }
              setOpen(false);
            }} />
        </>
      );
    }

    // Default: executive, main, stock, quality
    return renderDefaultMenu();
  };

  // Konten menu dibuat hanya saat menu terbuka
  const menuContent = open ? (
    <>
      <div className="px-4 py-2 flex items-center justify-between" style={{ borderBottom: `1px solid ${colors?.glassBorder}` }}>
        <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: colors?.gold }}>
          Export · {TAB_LABELS[activeTab] || "Laporan"}
        </span>
      </div>
      {renderContent()}
    </>
  ) : null;

  return (
    <div className="relative z-20" ref={ref}>
      <button onClick={() => setOpen((o) => !o)} disabled={disabled}
        // ⚠️ Sprint 18d8 / Responsive: padding p-2 di mobile (sama dengan icon button
        // lain di header), px-4 py-2.5 di desktop (label visible).
        className="sm-btn flex items-center gap-1.5 h-9 px-2.5 md:px-3.5 rounded-xl text-xs font-semibold disabled:opacity-40 shrink-0"
        style={{ background: colors.gold, color: "#0A1120" }}>
        <Download size={14} /> <span className="hidden md:inline">Export</span> <ChevronDown size={13} className="hidden md:inline" style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform .2s" }} />
      </button>
      {open && (
        <>
          {/* ⚠️ Sprint 18d / Header Redesign bugfix: desktop dropdown dirender
              via createPortal ke document.body supaya KELUAR dari parent
              `.sm-card` header yang punya backdrop-filter sendiri (itu bikin
              stacking context baru → backdrop-filter child tidak blur konten
              di belakang parent, hanya blur di dalam parent saja → efek glass
              tidak terlihat). Dengan portal, dropdown floating di body level,
              backdrop-filter bekerja penuh terhadap konten header & dashboard
              di belakangnya.

              Alpha background pakai colors.dropdownBg (theme-aware) bukan
              hardcoded rgba — supaya adaptif dark/light theme. Set color:
              colors.text supaya semua child text inherit warna tema aktif
              (saat portal ke body, kita di luar .smapp container). */}
          {createPortal(
            <div
              ref={desktopDropdownRef}
              className="hidden md:block fixed z-50 w-80 max-w-[calc(100vw-2rem)] max-h-[calc(100vh-5rem)] overflow-y-auto rounded-xl sm-fadein"
              style={{
                top: desktopDropdownPos.top,
                left: desktopDropdownPos.left,
                color: colors.text,
                background: `radial-gradient(120% 60% at 15% -5%, ${colors.glassSheen || "rgba(255,255,255,0.10)"}, transparent 55%), ${colors.dropdownBg}`,
                backdropFilter: "blur(32px) saturate(1.4)",
                WebkitBackdropFilter: "blur(32px) saturate(1.4)",
                border: `1px solid ${colors.dropdownBorder}`,
                boxShadow: `${colors.glassShadow}, inset 0 1px 0 ${colors.glassHighlight || "rgba(255,255,255,0.08)"}`,
              }}
            >
              {menuContent}
            </div>,
            document.body
          )}

          
          {createPortal(
            <div ref={sheetRef} className="md:hidden fixed inset-0 z-50 flex items-end sm-fadein"
              role="dialog" aria-modal="true" aria-label="Menu Export">
              <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setOpen(false)} />
              <div className="relative w-full max-h-[88vh] overflow-y-auto sm-scale-in sm-modal-glass"
                style={{
                  borderRadius: "16px 16px 0 0",
                  boxShadow: "0 -10px 40px rgba(0,0,0,0.3)",
                  paddingBottom: "calc(20px + env(safe-area-inset-bottom))",
                  color: colors.text,
                }}>
                
                <div className="mx-auto my-4 w-10 h-1 rounded-full" style={{ background: colors.glassBorderElevated }} />
                {menuContent}
              </div>
            </div>,
            document.body
          )}
        </>
      )}
    </div>
  );
}
