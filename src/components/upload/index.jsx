import { useState, useRef, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import {
  Upload, Download, X, ChevronDown, RefreshCw, FileSpreadsheet,
  FileText, Printer, Menu, Image as ImageIcon, Loader2,
} from "lucide-react";
import { fmtPct } from "../../utils/formatters.js";
import {
  exportSummaryPDF, exportSalesScorecardPDF, exportAllScorecardsPDF, exportSalesGroupComparisonPDF,
  buildSummaryDoc, buildScorecardDoc, buildAllScorecardsDoc, buildSalesGroupComparisonDoc,
} from "../../utils/pdfExport.js";
import { exportToExcel } from "../../utils/excelExport.js";
import { pdfDocToImages, htmlToImages, downloadImagesSmart, renderAndCapture } from "../../utils/imageExport.js";
import { ExcelReportHtml } from "../export/ExcelReportHtml.jsx";

export function UploadDropzone({ onFile, hasData, fileName, onReset, onSample, loading, sampleLoading, colors }) {
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef(null);
  const handleFiles = (files) => { if (files && files.length) onFile(Array.from(files)); };
  return (
    <div>
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); }}
        onClick={() => inputRef.current && inputRef.current.click()}
        className="sm-drop cursor-pointer rounded-2xl p-6 flex items-center gap-4 transition-colors"
        style={{ border: `1.5px dashed ${dragOver ? colors.gold : colors.border}`, background: dragOver ? colors.gold + "0D" : colors.surface }}
      >
        <input ref={inputRef} type="file" accept=".xlsx,.xls,.csv" multiple className="hidden" onChange={(e) => handleFiles(e.target.files)} />
        <div className="p-3 rounded-xl" style={{ background: colors.gold + "1A" }}>
          {loading ? <RefreshCw size={20} className="sm-pulse" style={{ color: colors.gold }} /> : <Upload size={20} style={{ color: colors.gold }} />}
        </div>
        <div className="flex-1">
          <div className="text-sm font-semibold disp">{loading ? "Memproses file..." : "Upload file Excel sell-out"}</div>
          <div className="text-xs mt-0.5" style={{ color: colors.textMuted }}>
            {hasData ? `Sumber aktif: ${fileName}` : "Tarik & lepas file di sini (bisa lebih dari satu untuk digabung), atau klik untuk memilih"}
          </div>
        </div>
        {!hasData && (
          <button onClick={(e) => { e.stopPropagation(); onSample(); }} className="sm-btn text-xs px-3 py-2 rounded-lg font-medium"
            style={{ background: colors.surface2, border: `1px solid ${colors.border}`, color: colors.textMuted }}
            disabled={sampleLoading}>
            {sampleLoading
              ? <span className="flex items-center gap-1.5"><RefreshCw size={13} className="sm-pulse" /> Memuat...</span>
              : "Coba data contoh"}
          </button>
        )}
        {hasData && (
          <button onClick={(e) => { e.stopPropagation(); onReset(); }} className="sm-btn text-xs px-3 py-2 rounded-lg font-medium flex items-center gap-1.5"
            style={{ background: colors.coral + "14", border: `1px solid ${colors.coral}33`, color: colors.coral }}>
            <X size={13} /> Hapus data
          </button>
        )}
      </div>
    </div>
  );
}

/* ============================================================================
   MOBILE NAVIGATION (H6)
   - MobileBottomNav: bottom tab bar untuk mobile (md:hidden), menggantikan
     top tab bar yang disembunyikan di mobile. Ikon + label pendek vertikal.
   - MobileFab: tombol apung "Upload" di pojok kanan bawah (di atas bottom nav),
     memberi akses cepat ke upload tanpa harus scroll ke atas.
   Keduanya menghormati iOS safe-area-inset supaya tidak tertutup home indicator.
============================================================================ */

// primaryTabs selalu tampil sebagai ikon di bottom nav. moreTabs (kalau ada)
// dikelompokkan jadi satu slot terakhir "Lainnya" yang membuka bottom-sheet —
// supaya nambah tab baru di masa depan tidak bikin bottom nav makin sesak/kecil.
export function MobileBottomNav({ primaryTabs, moreTabs, activeTab, onChange, colors }) {
  const [moreOpen, setMoreOpen] = useState(false);
  const activeIsInMore = moreTabs.some((t) => t.key === activeTab);

  const handleSelect = (key) => { onChange(key); setMoreOpen(false); };

  return (
    <>
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-40"
        style={{
          background: colors.surface,
          borderTop: `1px solid ${colors.border}`,
          boxShadow: "0 -4px 20px rgba(0,0,0,0.18)",
          paddingBottom: "env(safe-area-inset-bottom)",
        }}
      >
        <div className="flex items-stretch justify-around">
          {primaryTabs.map((t) => {
            const Icon = t.icon;
            const isActive = t.key === activeTab;
            return (
              <button
                key={t.key}
                onClick={() => handleSelect(t.key)}
                className="flex flex-col items-center justify-center gap-0.5 py-2 px-1 flex-1 min-w-0"
                style={{ color: isActive ? colors.gold : colors.textMuted }}
                aria-label={t.label}
                aria-current={isActive ? "page" : undefined}
              >
                <Icon size={20} style={{ strokeWidth: isActive ? 2.4 : 2 }} />
                <span className="text-[10px] font-medium leading-tight truncate w-full text-center" style={{ maxWidth: 56 }}>
                  {t.shortLabel}
                </span>
              </button>
            );
          })}
          {moreTabs.length > 0 && (
            <button
              onClick={() => setMoreOpen(true)}
              className="flex flex-col items-center justify-center gap-0.5 py-2 px-1 flex-1 min-w-0"
              style={{ color: activeIsInMore ? colors.gold : colors.textMuted }}
              aria-label="Lainnya"
              aria-current={activeIsInMore ? "page" : undefined}
            >
              <Menu size={20} style={{ strokeWidth: activeIsInMore ? 2.4 : 2 }} />
              <span className="text-[10px] font-medium leading-tight truncate w-full text-center" style={{ maxWidth: 56 }}>
                Lainnya
              </span>
            </button>
          )}
        </div>
      </nav>

      {moreOpen && (
        <div
          className="md:hidden fixed inset-0 z-50 flex items-end sm-fadein"
          onClick={() => setMoreOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Menu lainnya"
        >
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div
            className="relative w-full rounded-t-2xl p-4 sm-scale-in"
            style={{
              background: colors.surface,
              borderTop: `1px solid ${colors.border}`,
              borderRadius: "16px 16px 0 0",
              boxShadow: "0 -10px 40px rgba(0,0,0,0.3)",
              paddingBottom: "calc(16px + env(safe-area-inset-bottom))",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-3 w-10 h-1 rounded-full" style={{ background: colors.border }} />
            <div className="grid grid-cols-3 gap-3">
              {moreTabs.map((t) => {
                const Icon = t.icon;
                const isActive = t.key === activeTab;
                return (
                  <button
                    key={t.key}
                    onClick={() => handleSelect(t.key)}
                    className="flex flex-col items-center justify-center gap-1.5 py-3 rounded-xl"
                    style={{ background: isActive ? colors.gold + "1A" : colors.surface2, color: isActive ? colors.gold : colors.text }}
                  >
                    <Icon size={20} />
                    <span className="text-xs font-medium">{t.shortLabel}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
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
      <button
        onClick={() => inputRef.current && inputRef.current.click()}
        className="md:hidden fixed right-4 z-40 sm-btn flex items-center justify-center w-14 h-14 rounded-full"
        style={{
          bottom: "calc(76px + env(safe-area-inset-bottom))",
          background: `linear-gradient(135deg, ${colors.gold}, ${colors.coral})`,
          color: "#0A1120",
          boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
        }}
        aria-label="Upload file Excel sell-out"
      >
        {loading ? <RefreshCw size={22} className="sm-pulse" /> : <Upload size={22} />}
      </button>
    </>
  );
}


export function ExportMenu({ agg, targets, workDays, depotName, disabled, colors }) {
  const [open, setOpen] = useState(false);
  const [scorecardListOpen, setScorecardListOpen] = useState(false);
  const [imageFmt, setImageFmt] = useState(() => {
    // Persist preferensi format gambar ke localStorage supaya tidak hilang
    // saat refresh. Default PNG (lossless, ada transparan).
    try { return localStorage.getItem("smapp:imagefmt") || "png"; }
    catch { return "png"; }
  });
  const [busy, setBusy] = useState(false);          // loading state saat konversi gambar
  const [busyLabel, setBusyLabel] = useState("");   // label yg sedang diproses
  const ref = useRef(null);
  // Ref terpisah untuk bottom-sheet mobile -- sheet di-render via Portal ke
  // document.body (lihat createPortal di bawah) supaya position:fixed bekerja
  // relative ke viewport, bukan relative ke header yang ber-transform akibat
  // animation sm-fadeup (transform pada ancestor membuatnya menjadi containing
  // block untuk fixed descendant -- bug klasik CSS).
  const sheetRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    // Jangan tutup kalau klik terjadi di dalam tombol/container ExportMenu
    // (ref) atau di dalam bottom-sheet mobile (sheetRef) yang sudah di-portal
    // ke body. Tanpa pengecekan sheetRef, klik pada item sheet akan langsung
    // menutup sheet sebelum onClick item sempat di-fire.
    const onClickOutside = (e) => {
      if (ref.current && ref.current.contains(e.target)) return;
      if (sheetRef.current && sheetRef.current.contains(e.target)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  // Ditutup lagi tiap kali menu utama ditutup/dibuka ulang, supaya tidak
  // "nyangkut" kebuka pas dropdown dipakai lagi lain waktu.
  useEffect(() => { if (!open) setScorecardListOpen(false); }, [open]);

  const opts = { workDays, depotName };
  const salesSorted = useMemo(() => [...agg.bySales].sort((a, b) => a.name.localeCompare(b.name)), [agg.bySales]);

  const setImageFmtPersist = (fmt) => {
    setImageFmt(fmt);
    try { localStorage.setItem("smapp:imagefmt", fmt); } catch { /* ignore */ }
  };

  /* ────────────────────────────────────────────────────────────────────────
     HANDLER: Export PDF reports sebagai gambar
     Strategi: panggil build*Doc() yang return jsPDF instance (tanpa save),
     lalu konversi PDF → gambar via pdfjs-dist. Template 100% identik dengan
     PDF karena fungsi build*Doc adalah isi refactored dari export*PDF.

     Sebelumnya kita pakai monkey-patch jsPDF.prototype.save untuk tangkap
     instance, tapi ternyata tidak reliable di jsPDF modern (save method
     tidak ter-override via prototype). Refaktor pdfExport.js supaya expose
     fungsi build*Doc adalah solusi yang clean & reliable.
  ──────────────────────────────────────────────────────────────────────── */
  const handlePdfToImage = async (label, buildDocFn, baseFilename) => {
    if (busy) return;
    setBusy(true);
    setBusyLabel(label);
    setOpen(false);
    try {
      // 1. Build jsPDF instance (sama persis dengan yang di-save ke PDF)
      const doc = buildDocFn();
      // 2. Konversi ke gambar
      const images = await pdfDocToImages(doc, { scale: 2, format: imageFmt });
      // 3. Download dengan strategi auto (1=1file, 2=stitch, 3+=N file)
      await downloadImagesSmart(images, baseFilename, imageFmt);
    } catch (e) {
      console.error("Gagal export gambar:", e);
      alert(`Gagal membuat gambar: ${e.message || e}`);
    } finally {
      setBusy(false);
      setBusyLabel("");
    }
  };

  /* ────────────────────────────────────────────────────────────────────────
     HANDLER: Export Excel sebagai gambar
     Strategi: render ExcelReportHtml ke div off-screen, capture via
     html2canvas, lalu cleanup. Template direplikasi persis di komponen
     ExcelReportHtml.
  ──────────────────────────────────────────────────────────────────────── */
  const handleExcelToImage = async () => {
    if (busy) return;
    setBusy(true);
    setBusyLabel("Excel sebagai Gambar");
    setOpen(false);
    try {
      const images = await renderAndCapture(
        <ExcelReportHtml agg={agg} targets={targets} opts={opts} />,
        { scale: 2, format: imageFmt }
      );
      const baseFilename = `Laporan-Sales-Gambar-${new Date().toISOString().slice(0, 10)}`;
      await downloadImagesSmart(images, baseFilename, imageFmt);
    } catch (e) {
      console.error("Gagal export Excel ke gambar:", e);
      alert(`Gagal membuat gambar: ${e.message || e}`);
    } finally {
      setBusy(false);
      setBusyLabel("");
    }
  };

  const MenuItem = ({ icon: Icon, iconColor, label, desc, onClick, disabled: itemDisabled }) => (
    <button onClick={onClick} disabled={itemDisabled}
      className="sm-row w-full text-left px-4 py-2.5 flex items-start gap-3 disabled:opacity-40">
      <Icon size={15} className="mt-0.5 shrink-0" style={{ color: iconColor }} />
      <div className="min-w-0">
        <div className="text-sm font-medium">{label}</div>
        {desc && <div className="text-xs" style={{ color: colors.textMuted }}>{desc}</div>}
      </div>
    </button>
  );

  const SectionLabel = ({ children, right }) => (
    <div className="px-4 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-wider flex items-center justify-between" style={{ color: colors.textMuted }}>
      <span>{children}</span>
      {right}
    </div>
  );

  // Format toggle untuk section Gambar — PNG / JPG
  const FormatToggle = (
    <div className="flex p-0.5 rounded-md" style={{ background: colors.surface2 }}>
      {["png", "jpeg"].map((fmt) => {
        const isActive = imageFmt === fmt;
        return (
          <button key={fmt} onClick={(e) => { e.stopPropagation(); setImageFmtPersist(fmt); }}
            className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider transition-colors"
            style={{
              background: isActive ? colors.gold : "transparent",
              color: isActive ? "#0A1120" : colors.textMuted,
            }}>
            {fmt === "jpeg" ? "JPG" : "PNG"}
          </button>
        );
      })}
    </div>
  );

  // Konten menu dibuat sekali lalu dipakai di dua wadah: dropdown absolut
  // (desktop) dan modal terpusat (mobile). Duplikasi JSX dihindari supaya
  // kalau ada item menu baru cukup ditambah di satu tempat.
  const menuContent = (
    <>
      <SectionLabel>Excel</SectionLabel>
      <MenuItem icon={FileSpreadsheet} iconColor={colors.mint} label="Export ke Excel"
        desc="Format lengkap dengan target, deviasi & produk fokus"
        onClick={() => { exportToExcel(agg, targets, opts); setOpen(false); }} />

      <div style={{ borderTop: `1px solid ${colors.border}` }} />
      <SectionLabel>PDF</SectionLabel>
      <MenuItem icon={FileText} iconColor={colors.coral} label="Laporan Ringkasan"
        desc="KPI, leaderboard sales & rekap grup produk"
        onClick={() => { exportSummaryPDF(agg, targets, opts); setOpen(false); }} />
      <MenuItem icon={FileText} iconColor={colors.coral} label="Scorecard Semua Sales"
        desc={`1 halaman per sales (${agg.bySales.length} sales)`}
        onClick={() => { exportAllScorecardsPDF(agg, opts); setOpen(false); }} />
      <MenuItem icon={FileText} iconColor={colors.coral} label="Laporan Perbandingan Sales"
        desc="Rekap per grup, per sales & hari terakhir — 1 dokumen gabungan"
        onClick={() => { exportSalesGroupComparisonPDF(agg, opts); setOpen(false); }} />

      <div style={{ borderTop: `1px solid ${colors.border}` }} />
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
        <div className="max-h-52 overflow-y-auto" style={{ borderTop: `1px solid ${colors.border}`, background: colors.surface2 }}>
          {salesSorted.map((sm) => (
            <button key={sm.code} onClick={() => { exportSalesScorecardPDF(sm, agg, opts); setOpen(false); }}
              className="sm-row w-full text-left pl-11 pr-4 py-2 flex items-center justify-between gap-2">
              <span className="text-sm truncate">{sm.name}</span>
              <span className="text-xs mono shrink-0" style={{ color: colors.textMuted }}>{fmtPct(sm.ach)}</span>
            </button>
          ))}
        </div>
      )}

      {/* ───── SECTION GAMBAR (BARU) ─────
          Toggle format PNG/JPG di pojok kanan section label. Default PNG.
          Semua item di section ini memicu konversi async — tombol disable
          saat busy, dan trigger button utama menampilkan spinner. */}
      <div style={{ borderTop: `1px solid ${colors.border}` }} />
      <SectionLabel right={FormatToggle}>Gambar</SectionLabel>
      <MenuItem icon={ImageIcon} iconColor={colors.blue} label="Laporan Ringkasan"
        desc={`PNG/JPG · KPI, leaderboard & rekap grup (${imageFmt === "jpeg" ? "JPG" : "PNG"} 2x)`}
        disabled={busy}
        onClick={() => handlePdfToImage(
          "Laporan Ringkasan",
          () => buildSummaryDoc(agg, targets, opts),
          `Laporan-Ringkasan-${(depotName || "Depo").replace(/\s+/g, "-")}`
        )} />
      <MenuItem icon={ImageIcon} iconColor={colors.blue} label="Scorecard Semua Sales"
        desc={`PNG/JPG · 1 gambar per sales (auto-stitch kalau 2 hal) (${imageFmt === "jpeg" ? "JPG" : "PNG"} 2x)`}
        disabled={busy}
        onClick={() => handlePdfToImage(
          "Scorecard Semua Sales",
          () => buildAllScorecardsDoc(agg, opts),
          `Scorecard-Semua-Sales-${(depotName || "Depo").replace(/\s+/g, "-")}`
        )} />
      <MenuItem icon={ImageIcon} iconColor={colors.blue} label="Laporan Perbandingan Sales"
        desc={`PNG/JPG · Rekap per grup, per sales & hari terakhir (${imageFmt === "jpeg" ? "JPG" : "PNG"} 2x)`}
        disabled={busy}
        onClick={() => handlePdfToImage(
          "Laporan Perbandingan Sales",
          () => buildSalesGroupComparisonDoc(agg, opts),
          `Laporan-Perbandingan-Sales-${(depotName || "Depo").replace(/\s+/g, "-")}`
        )} />
      <MenuItem icon={ImageIcon} iconColor={colors.violet} label="Excel sebagai Gambar"
        desc="Template Excel identik (warna, merge, ACH gradient) — format gambar"
        disabled={busy}
        onClick={handleExcelToImage} />
    </>
  );

  return (
    <div className="relative z-20" ref={ref}>
      <button onClick={() => setOpen((o) => !o)} disabled={disabled || busy}
        className="sm-btn flex items-center gap-2 px-2.5 md:px-4 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-40"
        style={{ background: colors.gold, color: "#0A1120" }}>
        {busy
          ? <><Loader2 size={15} className="animate-spin" /> <span className="hidden md:inline">{busyLabel}…</span></>
          : <><Download size={15} /> <span className="hidden md:inline">Export</span> <ChevronDown size={13} className="hidden md:inline" style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform .2s" }} /></>}
      </button>
      {open && !busy && (
        <>
          
          <div className="hidden md:block absolute right-0 z-30 mt-2 w-80 max-w-[calc(100vw-2rem)] rounded-xl overflow-hidden sm-fadein"
            style={{ background: colors.surface, border: `1px solid ${colors.border}`, boxShadow: "0 10px 30px rgba(0,0,0,0.25)" }}>
            {menuContent}
          </div>

          
          {createPortal(
            <div ref={sheetRef} className="md:hidden fixed inset-0 z-50 flex items-end sm-fadein"
              role="dialog" aria-modal="true" aria-label="Menu Export">
              <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setOpen(false)} />
              <div className="relative w-full max-h-[88vh] overflow-y-auto sm-scale-in"
                style={{
                  background: colors.surface,
                  borderTop: `1px solid ${colors.border}`,
                  borderRadius: "16px 16px 0 0",
                  boxShadow: "0 -10px 40px rgba(0,0,0,0.3)",
                  paddingBottom: "calc(20px + env(safe-area-inset-bottom))",
                }}>
                
                <div className="mx-auto my-4 w-10 h-1 rounded-full" style={{ background: colors.border }} />
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

