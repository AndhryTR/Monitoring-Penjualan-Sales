import { useState, useRef, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import {
  Upload, Download, X, ChevronDown, RefreshCw, FileSpreadsheet,
  FileText, Printer, Menu, Image as ImageIcon,
} from "lucide-react";
import { fmtPct } from "../../utils/formatters.js";
import { exportSummaryPDF, exportSalesScorecardPDF, exportAllScorecardsPDF, exportSalesGroupComparisonPDF } from "../../utils/pdfExport.js";
import { exportToExcel } from "../../utils/excelExport.js";
import { exportHtmlAsImage, buildSalesGroupComparisonHTML, buildExcelReportHTML } from "../../utils/imageExport.js";

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
        className={`sm-drop cursor-pointer rounded-2xl p-6 flex items-center gap-4 transition-colors ${dragOver ? "sm-pulse" : ""}`}
        style={{
          border: `2px dashed ${dragOver ? colors.mint + "66" : colors.glassBorderElevated}`,
          background: dragOver ? colors.mint + "0F" : colors.glassSubtle,
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
        }}
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
            style={{ background: colors.glassFill, border: `1px solid ${colors.glassBorder}`, color: colors.textMuted }}
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
        className="md:hidden fixed left-3 right-3 z-40 sm-mobile-nav-glass"
        style={{
          bottom: "calc(12px + env(safe-area-inset-bottom))",
          borderRadius: "24px",
        }}
      >
        <div className="flex items-stretch justify-around px-1 py-1.5">
          {primaryTabs.map((t) => {
            const Icon = t.icon;
            const isActive = t.key === activeTab;
            return (
              <button
                key={t.key}
                onClick={() => handleSelect(t.key)}
                className="flex flex-col items-center justify-center gap-0.5 py-1.5 px-1 flex-1 min-w-0 rounded-2xl"
                style={{ color: isActive ? colors.mint : colors.textMuted }}
                aria-label={t.label}
                aria-current={isActive ? "page" : undefined}
              >
                <div className="relative flex items-center justify-center" style={{ width: 20, height: 20 }}>
                  {isActive && <div className="absolute inset-0 rounded-full" style={{ background: colors.mint, opacity: 0.25, filter: "blur(8px)" }} />}
                  <Icon size={20} style={{ strokeWidth: isActive ? 2.4 : 2, position: "relative" }} />
                </div>
                <span className="text-[10px] font-medium leading-tight truncate w-full text-center" style={{ maxWidth: 56 }}>
                  {t.shortLabel}
                </span>
              </button>
            );
          })}
          {moreTabs.length > 0 && (
            <button
              onClick={() => setMoreOpen(true)}
              className="flex flex-col items-center justify-center gap-0.5 py-1.5 px-1 flex-1 min-w-0 rounded-2xl"
              style={{ color: activeIsInMore ? colors.mint : colors.textMuted }}
              aria-label="Lainnya"
              aria-current={activeIsInMore ? "page" : undefined}
            >
              <div className="relative flex items-center justify-center" style={{ width: 20, height: 20 }}>
                {activeIsInMore && <div className="absolute inset-0 rounded-full" style={{ background: colors.mint, opacity: 0.25, filter: "blur(8px)" }} />}
                <Menu size={20} style={{ strokeWidth: activeIsInMore ? 2.4 : 2, position: "relative" }} />
              </div>
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
            className="relative w-full p-4 sm-scale-in sm-modal-glass"
            style={{
              borderRadius: "20px 20px 0 0",
              boxShadow: "0 -10px 40px rgba(0,0,0,0.3)",
              paddingBottom: "calc(16px + env(safe-area-inset-bottom))",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-3 w-10 h-1 rounded-full" style={{ background: colors.glassBorderElevated }} />
            <div className="grid grid-cols-3 gap-3">
              {moreTabs.map((t) => {
                const Icon = t.icon;
                const isActive = t.key === activeTab;
                return (
                  <button
                    key={t.key}
                    onClick={() => handleSelect(t.key)}
                    className="flex flex-col items-center justify-center gap-1.5 py-3 rounded-xl"
                    style={{
                      background: isActive ? colors.mint + "1A" : colors.glassFill,
                      color: isActive ? colors.mint : colors.text,
                      border: `1px solid ${isActive ? colors.mint + "33" : colors.glassBorder}`,
                    }}
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
      <div
        className="md:hidden fixed right-4 z-30 pointer-events-none"
        style={{
          bottom: "calc(88px + env(safe-area-inset-bottom))",
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
          bottom: "calc(88px + env(safe-area-inset-bottom))",
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


export function ExportMenu({ agg, targets, workDays, depotName, disabled, colors }) {
  const [open, setOpen] = useState(false);
  const [scorecardListOpen, setScorecardListOpen] = useState(false);
  // Item "Gambar" mana yang lagi expand pilihan format (PNG/JPEG) — null kalau
  // tidak ada yang expand. imageBusy: nama item yang sedang diproses
  // html2canvas (proses async, bisa beberapa detik untuk tabel besar), dipakai
  // buat kasih feedback "Memproses..." supaya user tidak klik berkali-kali.
  const [imageFormatFor, setImageFormatFor] = useState(null);
  const [imageBusy, setImageBusy] = useState(null);
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
  useEffect(() => { if (!open) { setScorecardListOpen(false); setImageFormatFor(null); } }, [open]);

  const opts = { workDays, depotName };
  const salesSorted = useMemo(() => [...agg.bySales].sort((a, b) => a.name.localeCompare(b.name)), [agg.bySales]);

  const MenuItem = ({ icon: Icon, iconColor, label, desc, onClick }) => (
    <button onClick={onClick}
      className="sm-row w-full text-left px-4 py-2.5 flex items-start gap-3">
      <Icon size={15} className="mt-0.5 shrink-0" style={{ color: iconColor }} />
      <div className="min-w-0">
        <div className="text-sm font-medium">{label}</div>
        {desc && <div className="text-xs" style={{ color: colors.textMuted }}>{desc}</div>}
      </div>
    </button>
  );

  const SectionLabel = ({ children }) => (
    <div className="px-4 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-wider" style={{ color: colors.textMuted }}>{children}</div>
  );

  const handleImageExport = async (key, buildFn, filenameBase, format) => {
    setImageBusy(key);
    try {
      const html = buildFn();
      await exportHtmlAsImage(html, filenameBase, format);
    } finally {
      setImageBusy(null);
      setImageFormatFor(null);
      setOpen(false);
    }
  };

  // Item menu "Gambar" yang expand jadi 2 tombol format (PNG/JPEG) saat diklik
  // — bukan langsung download, supaya user pilih formatnya dulu tiap export.
  const ImageMenuItem = ({ itemKey, label, desc, buildFn, filenameBase }) => (
    <>
      <button onClick={() => setImageFormatFor((v) => (v === itemKey ? null : itemKey))}
        className="sm-row w-full text-left px-4 py-2.5 flex items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <ImageIcon size={15} className="mt-0.5 shrink-0" style={{ color: colors.blue || colors.gold }} />
          <div className="min-w-0">
            <div className="text-sm font-medium">{label}</div>
            <div className="text-xs" style={{ color: colors.textMuted }}>{desc}</div>
          </div>
        </div>
        <ChevronDown size={13} style={{ color: colors.textMuted, transform: imageFormatFor === itemKey ? "rotate(180deg)" : "none", transition: "transform .2s", flexShrink: 0 }} />
      </button>
      {imageFormatFor === itemKey && (
        <div className="flex gap-2 px-4 pb-3 pl-11">
          {["png", "jpeg"].map((fmt) => (
            <button key={fmt} disabled={imageBusy === itemKey}
              onClick={() => handleImageExport(itemKey, buildFn, filenameBase, fmt)}
              className="sm-btn px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-50"
              style={{ background: colors.glassFill, border: `1px solid ${colors.glassBorder}`, color: colors.text }}>
              {imageBusy === itemKey ? "Memproses..." : fmt.toUpperCase()}
            </button>
          ))}
        </div>
      )}
    </>
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

      <div style={{ borderTop: `1px solid ${colors.glassBorder}` }} />
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

      <div style={{ borderTop: `1px solid ${colors.glassBorder}` }} />
      <SectionLabel>Gambar</SectionLabel>
      <ImageMenuItem itemKey="excel" label="Export ke Excel" desc="Tampilan sama seperti file Excel, jadi 1 gambar"
        buildFn={() => buildExcelReportHTML(agg, targets, opts)} filenameBase={`Laporan_Sales_Gambar_${agg.meta.lastDate || "export"}`} />
      <ImageMenuItem itemKey="comparison" label="Laporan Perbandingan Sales" desc="Tampilan sama seperti PDF, jadi 1 gambar"
        buildFn={() => buildSalesGroupComparisonHTML(agg, opts)} filenameBase={`Laporan_Perbandingan_Sales_Gambar_${agg.meta.lastDate || "export"}`} />

      <div style={{ borderTop: `1px solid ${colors.glassBorder}` }} />
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
            <button key={sm.code} onClick={() => { exportSalesScorecardPDF(sm, agg, opts); setOpen(false); }}
              className="sm-row w-full text-left pl-11 pr-4 py-2 flex items-center justify-between gap-2">
              <span className="text-sm truncate">{sm.name}</span>
              <span className="text-xs mono shrink-0" style={{ color: colors.textMuted }}>{fmtPct(sm.ach)}</span>
            </button>
          ))}
        </div>
      )}
    </>
  );

  return (
    <div className="relative z-20" ref={ref}>
      <button onClick={() => setOpen((o) => !o)} disabled={disabled}
        className="sm-btn flex items-center gap-2 px-2.5 md:px-4 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-40"
        style={{ background: colors.gold, color: "#0A1120" }}>
        <Download size={15} /> <span className="hidden md:inline">Export</span> <ChevronDown size={13} className="hidden md:inline" style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform .2s" }} />
      </button>
      {open && (
        <>
          
          <div className="hidden md:block absolute right-0 z-30 mt-2 w-80 max-w-[calc(100vw-2rem)] rounded-xl overflow-hidden sm-fadein"
            style={{ background: colors.modalBg, backdropFilter: "blur(32px)", WebkitBackdropFilter: "blur(32px)", border: `1px solid ${colors.modalBorder}`, boxShadow: colors.glassShadow }}>
            {menuContent}
          </div>

          
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
