import React, { useState, useRef, useMemo, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  Download,
  ChevronDown,
  RefreshCw,
  FileSpreadsheet,
  FileText,
  Printer,
  Image as ImageIcon,
  MessageSquare,
} from "lucide-react";
import { fmtPct } from "../../utils/formatters.js";
import { notifyExportSuccess, notifyError } from "../../utils/notifyExport.js";
import { useFloatingDropdown } from "../../hooks/useFloatingDropdown.js";
import { getLastDaySalesMap, computeOutletAnalysis } from "../../utils/aggregation.js";

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
          ? (active ? (colors.onGold || "#0A1120") : colors.text)
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
  rawRows = [],
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
  const [includeIncentives, setIncludeIncentives] = useState(() => {
    try {
      return localStorage.getItem("sm_export_include_incentives") === "true";
    } catch {
      void 0;
      return false;
    }
  });
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

  const opts = { workDays, depotName, includeIncentives, rawRows };
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

            {/* Switch Opsi Sertakan Kalkulasi Insentif */}
            <div
              className="mx-3.5 mb-2 px-3 py-2 rounded-lg flex items-center justify-between transition-colors cursor-pointer select-none"
              style={{
                background: includeIncentives ? `${colors.gold}18` : colors.glassFill,
                border: `1px solid ${includeIncentives ? `${colors.gold}66` : colors.glassBorder}`,
              }}
              onClick={() => {
                setIncludeIncentives((prev) => {
                  const next = !prev;
                  try {
                    localStorage.setItem("sm_export_include_incentives", String(next));
                  } catch {
                    void 0;
                  }
                  return next;
                });
              }}
              title={includeIncentives ? "Klik untuk menonaktifkan kolom insentif" : "Klik untuk menyertakan kolom insentif"}
            >
              <div className="flex items-center gap-2 min-w-0 pr-2">
                <span className="text-sm shrink-0">💰</span>
                <div className="min-w-0">
                  <div className="text-xs font-semibold truncate" style={{ color: colors.text }}>
                    Sertakan Data Insentif
                  </div>
                  <div className="text-[10px] truncate" style={{ color: colors.textMuted }}>
                    {includeIncentives ? "Rate & total komisi disertakan" : "Tabel performa standar (tanpa insentif)"}
                  </div>
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={includeIncentives}
                onClick={(e) => {
                  e.stopPropagation();
                  setIncludeIncentives((prev) => {
                    const next = !prev;
                    try {
                      localStorage.setItem("sm_export_include_incentives", String(next));
                    } catch {
                      void 0;
                    }
                    return next;
                  });
                }}
                className="relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none"
                style={{
                  backgroundColor: includeIncentives ? (colors.gold || "#10B981") : (colors.glassBorder || "#CBD5E1"),
                }}
              >
                <span
                  className="pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out"
                  style={{ transform: includeIncentives ? "translateX(16px)" : "translateX(0px)" }}
                />
              </button>
            </div>

            <ImageMenuItem
              itemKey="excel"
              label="Laporan Tabel Utama (Gambar)"
              desc={includeIncentives ? "Tampilan visual tabel utama + kalkulasi insentif" : "Tampilan visual tabel laporan utama (PNG / JPG)"}
              imageBusy={imageBusy}
              onImageExport={handleImageExport}
              colors={colors}
              buildFn={async () => {
                // ⚠️ Sprint 5 / S3: lazy-load imageExport.js (~1.2MB).
                const { buildExcelReportHTML } = await import("../../utils/imageExport.js");
                return { html: buildExcelReportHTML(agg, targets, opts) };
              }}
              filenameBase={includeIncentives ? `Laporan_Sales_Insentif_Gambar_${agg?.meta?.lastDate || "export"}` : `Laporan_Sales_Gambar_${agg?.meta?.lastDate || "export"}`}
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
          <MenuItem icon={FileSpreadsheet} iconColor={colors.mint} label="Laporan Detail Grup Produk"
            desc="Ranking performa, value, target & ACH per grup produk"
            colors={colors}
            onClick={async () => {
              const { exportProductReportExcel } = await import("../../utils/reportExcelExport.js");
              exportProductReportExcel(agg.byGroup, opts);
              await notifyExportSuccess("Export berhasil", "Laporan Grup Produk (Excel)");
              setOpen(false);
            }} />
          <MenuItem icon={FileSpreadsheet} iconColor={colors.blue || "#3B82F6"} label="Analisis SKU Lengkap"
            desc="Detail seluruh produk, volume, omset, dan penetrasi toko"
            colors={colors}
            onClick={async () => {
              const { exportSkuAnalysisExcel } = await import("../../utils/reportExcelExport.js");
              exportSkuAnalysisExcel(agg, opts);
              await notifyExportSuccess("Export berhasil", "Analisis SKU Lengkap (Excel)");
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
            }}
          />
        </>
      );
    }

    if (activeTab === "stock") {
      return (
        <>
          <SectionLabel colors={colors}>Excel</SectionLabel>
          <MenuItem
            icon={FileSpreadsheet}
            iconColor={colors.mint}
            label="Export Stok Barang"
            desc="Laporan posisi stok fisik per produk, satuan dasar & kombinasi (tanpa nilai)"
            colors={colors}
            onClick={() => {
              if (currentTabExports.stock?.onExportExcel) {
                currentTabExports.stock.onExportExcel();
              }
              setOpen(false);
            }}
          />
        </>
      );
    }

    // Default: executive, main, quality
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
        className="sm-btn flex items-center gap-1.5 h-9 px-2.5 md:px-3.5 rounded-xl text-xs font-semibold disabled:opacity-40 shrink-0"
        style={{ background: `linear-gradient(135deg, ${colors.skyblue}, ${colors.blue})`, color: colors.onBlue || "#0A1120" }}>
        <Download size={14} /> <span className="hidden md:inline">Export</span> <ChevronDown size={13} className="hidden md:inline" style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform .2s" }} />
      </button>
      {open && (
        <>
          {/* ⚠️ Header Redesign bugfix: desktop dropdown dirender
              via createPortal ke document.body supaya KELUAR dari parent
              `.sm-card` header yang punya backdrop-filter sendiri (itu bikin
              stacking context baru → backdrop-filter child tidak blur konten
              di belakang parent, hanya blur di dalam parent saja → efek glass
              tidak terlihat). Dengan portal, dropdown floating di body level,
              backdrop-filter bekerja penuh terhadap konten header & dashboard
              di belakangnya. */}
          {createPortal(
            <div
              ref={desktopDropdownRef}
              className="hidden md:block fixed z-50 w-80 max-w-[calc(100vw-2rem)] max-h-[calc(100vh-5rem)] overflow-y-auto rounded-xl sm-dropdown-pop"
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
