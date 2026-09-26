import { useState, useMemo, useRef } from "react";
import {
  X, MessageSquare, Image as ImageIcon, Copy, Check, Share2,
  Download, Sparkles, Send, Eye,
} from "lucide-react";
import { useScrollLock, useEscapeKey } from "../../hooks/useModalA11y.js";
import { showToast } from "../../utils/toastBus.js";
import {
  buildDailyReportText,
  buildDailyReportCardHTML,
  formatIDDate,
} from "../../utils/dailyReportGenerator.js";

/* ============================================================================
   DAILY REPORT MODAL
   Generator Laporan Harian 1-Klik:
   - Tab 1: Pesan Teks WhatsApp (dengan Live WhatsApp Bubble Preview + Customizer)
   - Tab 2: Kartu Grafis Mini (PNG Card Preview + Download / Copy to Clipboard)
   ============================================================================ */

export function DailyReportModal({
  isOpen,
  onClose,
  agg,
  targets,
  workDays = 26,
  depotName = "",
  smartAlerts = [],
  colors,
}) {
  useScrollLock(isOpen);
  useEscapeKey(isOpen, onClose);

  const [activeTab, setActiveTab] = useState("text"); // 'text' | 'image'
  const [topSalesCount, setTopSalesCount] = useState(3);
  const [includeAttention, setIncludeAttention] = useState(true);
  const [attentionCount, setAttentionCount] = useState(4); // 2 | 4 | 6 | 'all'
  const [includeCategories, setIncludeCategories] = useState(true);
  const [includeAo, setIncludeAo] = useState(false);
  const [includeLastDaySales, setIncludeLastDaySales] = useState(false);
  const [customNote, setCustomNote] = useState("");

  const isLight = colors?.colorScheme === "light";
  const [cardTheme, setCardTheme] = useState(isLight ? "light" : "dark");
  const [isGenerating, setIsGenerating] = useState(false);
  const [copiedText, setCopiedText] = useState(false);
  const [copiedImage, setCopiedImage] = useState(false);

  const cardContainerRef = useRef(null);

  const options = useMemo(() => ({
    topSalesCount,
    includeAttention,
    attentionCount,
    includeCategories,
    includeAo,
    includeLastDaySales,
    customNote,
  }), [topSalesCount, includeAttention, attentionCount, includeCategories, includeAo, includeLastDaySales, customNote]);

  const availableAlertsCount = useMemo(() => {
    return (smartAlerts || []).filter((a) =>
      (a.level === "critical" || a.level === "warning") &&
      a.category !== "data_quality" &&
      a.targetTab !== "quality" &&
      !String(a.id || "").includes("data-quality")
    ).length;
  }, [smartAlerts]);

  // Generate WhatsApp Message Text
  const reportText = useMemo(() => {
    if (!isOpen || !agg) return "";
    return buildDailyReportText({
      agg,
      targets,
      workDays,
      depotName,
      options,
      smartAlerts,
    });
  }, [isOpen, agg, targets, workDays, depotName, options, smartAlerts]);

  // Generate HTML for Card
  const cardHtml = useMemo(() => {
    if (!isOpen || !agg) return "";
    return buildDailyReportCardHTML({
      agg,
      targets,
      workDays,
      depotName,
      options,
      smartAlerts,
      isDark: cardTheme === "dark",
    });
  }, [isOpen, agg, targets, workDays, depotName, options, smartAlerts, cardTheme]);

  if (!isOpen) return null;

  // Actions
  const handleCopyText = async () => {
    try {
      await navigator.clipboard.writeText(reportText);
      setCopiedText(true);
      setTimeout(() => setCopiedText(false), 2000);
      showToast({
        title: "Teks Laporan Disalin",
        body: "Format WhatsApp siap ditempel di grup sales atau chat.",
      });
    } catch (err) {
      console.warn("Gagal copy text:", err);
      showToast({
        title: "Gagal Menyalin",
        body: "Silakan blok dan salin teks langsung dari kotak pratinjau.",
      });
    }
  };

  const handleOpenWhatsApp = () => {
    const encoded = encodeURIComponent(reportText);
    const url = `https://api.whatsapp.com/send?text=${encoded}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Update Penjualan - ${depotName || "Depo"}`,
          text: reportText,
        });
        showToast({ title: "Berhasil Dibagikan", body: "Laporan harian berhasil dibagikan." });
      } catch (err) {
        if (err.name !== "AbortError") {
          console.warn("Share error:", err);
        }
      }
    } else {
      handleCopyText();
    }
  };

  const handleDownloadCard = async () => {
    setIsGenerating(true);
    try {
      if (document.fonts && document.fonts.ready) {
        await document.fonts.ready;
      }
      const { default: html2canvas } = await import("html2canvas-pro");
      const container = document.createElement("div");
      container.style.position = "fixed";
      container.style.left = "-9999px";
      container.style.top = "0";
      container.style.zIndex = "-1";
      container.innerHTML = cardHtml;
      document.body.appendChild(container);

      const targetEl = container.firstElementChild || container;
      const canvas = await html2canvas(targetEl, {
        scale: 2,
        useCORS: true,
        backgroundColor: cardTheme === "dark" ? "#0B0F19" : "#F8FAFC",
        logging: false,
        scrollX: 0,
        scrollY: 0,
      });
      document.body.removeChild(container);

      const safeDepot = (depotName || "DEPO").replace(/[^a-zA-Z0-9_-]/g, "_");
      const safeDate = agg?.meta?.lastDate || new Date().toISOString().slice(0, 10);
      const link = document.createElement("a");
      link.download = `Laporan_Harian_${safeDepot}_${safeDate}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();

      showToast({
        title: "Gambar PNG Diunduh",
        body: `File ${link.download} siap dibagikan.`,
      });
    } catch (err) {
      console.error("Gagal generate kartu:", err);
      showToast({
        title: "Gagal Generate Gambar",
        body: err?.message || String(err),
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopyCardImage = async () => {
    setIsGenerating(true);
    try {
      if (document.fonts && document.fonts.ready) {
        await document.fonts.ready;
      }
      const { default: html2canvas } = await import("html2canvas-pro");
      const container = document.createElement("div");
      container.style.position = "fixed";
      container.style.left = "-9999px";
      container.style.top = "0";
      container.style.zIndex = "-1";
      container.innerHTML = cardHtml;
      document.body.appendChild(container);

      const targetEl = container.firstElementChild || container;
      const canvas = await html2canvas(targetEl, {
        scale: 2,
        useCORS: true,
        backgroundColor: cardTheme === "dark" ? "#0B0F19" : "#F8FAFC",
        logging: false,
        scrollX: 0,
        scrollY: 0,
      });
      document.body.removeChild(container);

      canvas.toBlob(async (blob) => {
        if (!blob) throw new Error("Gagal membuat blob gambar");
        if (navigator.clipboard && window.ClipboardItem) {
          try {
            await navigator.clipboard.write([
              new ClipboardItem({ "image/png": blob }),
            ]);
            setCopiedImage(true);
            setTimeout(() => setCopiedImage(false), 2000);
            showToast({
              title: "Gambar Berhasil Disalin",
              body: "Bisa langsung di-paste (Ctrl+V) di WhatsApp Web atau aplikasi lain.",
            });
            return;
          } catch (clipErr) {
            console.warn("ClipboardItem write failed, fallback to download:", clipErr);
          }
        }
        // Fallback jika tidak didukung
        const link = document.createElement("a");
        link.download = `Laporan_Harian_${agg?.meta?.lastDate || "export"}.png`;
        link.href = URL.createObjectURL(blob);
        link.click();
        showToast({
          title: "Gambar Diunduh",
          body: "Gambar otomatis diunduh sebagai file PNG.",
        });
      }, "image/png");
    } catch (err) {
      console.error("Gagal salin gambar:", err);
      showToast({
        title: "Gagal Menyalin Gambar",
        body: err?.message || String(err),
      });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-6 bg-black/65 backdrop-blur-md sm-fadein"
      onClick={onClose}
    >
      <div
        className="w-full max-w-4xl max-h-[92vh] flex flex-col rounded-2xl shadow-2xl overflow-hidden sm-scale-in"
        style={{
          background: colors.modalPanelBg || (isLight ? "#FFFFFF" : colors.surface),
          border: `1px solid ${colors.modalBorder || colors.glassBorder}`,
          color: colors.text,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ===== MODAL HEADER ===== */}
        <div
          className="px-5 py-3.5 flex items-center justify-between shrink-0"
          style={{
            borderBottom: `1px solid ${colors.glassBorder}`,
            background: colors.glassSubtle,
          }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 shadow-sm"
              style={{
                background: `${colors.mint}22`,
                color: colors.mint,
                border: `1px solid ${colors.mint}44`,
              }}
            >
              <MessageSquare size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="disp text-base font-bold tracking-tight">Quick Daily Report Generator</h2>
              </div>
              <p className="text-xs" style={{ color: colors.textMuted }}>
                {depotName || "Semua Depo"} · Data {formatIDDate(agg?.meta?.lastDate, true)}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="sm-btn p-2 rounded-xl transition-colors"
            style={{
              background: colors.glassFill,
              color: colors.textMuted,
              border: `1px solid ${colors.glassBorder}`,
            }}
            aria-label="Tutup modal"
          >
            <X size={16} />
          </button>
        </div>

        {/* ===== TAB NAVIGATOR ===== */}
        <div
          className="px-5 pt-3 pb-2 flex items-center justify-between shrink-0"
          style={{
            borderBottom: `1px solid ${colors.glassBorder}`,
          }}
        >
          <div
            className="inline-flex p-1 rounded-xl"
            style={{ background: colors.glassSubtle }}
          >
            <button
              onClick={() => setActiveTab("text")}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === "text" ? "shadow-sm" : "opacity-70 hover:opacity-100"
              }`}
              style={{
                background: activeTab === "text" ? colors.surface : "transparent",
                color: activeTab === "text" ? colors.text : colors.textMuted,
              }}
            >
              <MessageSquare size={14} style={{ color: colors.mint }} />
              Pesan Teks (WhatsApp)
            </button>
            <button
              onClick={() => setActiveTab("image")}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === "image" ? "shadow-sm" : "opacity-70 hover:opacity-100"
              }`}
              style={{
                background: activeTab === "image" ? colors.surface : "transparent",
                color: activeTab === "image" ? colors.text : colors.textMuted,
              }}
            >
              <ImageIcon size={14} style={{ color: colors.gold }} />
              Kartu Gambar Mini (PNG)
            </button>
          </div>

          {activeTab === "image" && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium" style={{ color: colors.textMuted }}>Tema Kartu:</span>
              <button
                onClick={() => setCardTheme("dark")}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                  cardTheme === "dark" ? "ring-2" : "opacity-60 hover:opacity-100"
                }`}
                style={{
                  background: colors.surface2,
                  color: colors.text,
                  border: `1px solid ${cardTheme === "dark" ? colors.mint : colors.glassBorder}`,
                }}
              >
                Gelap
              </button>
              <button
                onClick={() => setCardTheme("light")}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                  cardTheme === "light" ? "ring-2" : "opacity-60 hover:opacity-100"
                }`}
                style={{
                  background: colors.surface,
                  color: colors.text,
                  border: `1px solid ${cardTheme === "light" ? colors.mint : colors.glassBorder}`,
                }}
              >
                Terang
              </button>
            </div>
          )}
        </div>

        {/* ===== MODAL BODY ===== */}
        <div className="flex-1 overflow-y-auto p-4 md:p-5">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">

            {/* KOLOM KIRI: PREVIEW (WhatsApp Bubble or Graphic Card) */}
            <div className="lg:col-span-7 flex flex-col min-h-0">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5" style={{ color: colors.textMuted }}>
                  <Eye size={13} />
                  Pratinjau {activeTab === "text" ? "WhatsApp" : "Kartu Ringkasan"}
                </span>
                <span className="text-[11px]" style={{ color: colors.textMuted }}>
                  {activeTab === "text" ? "Format teks otomatis" : "Resolusi tinggi (HiDPI 2x)"}
                </span>
              </div>

              {activeTab === "text" ? (
                /* WhatsApp Preview Bubble */
                <div
                  className="flex-1 rounded-2xl p-4 overflow-y-auto max-h-[52vh] font-mono text-xs leading-relaxed relative"
                  style={{
                    background: isLight ? "#EFEAE2" : "#0C1317",
                    border: `1px solid ${isLight ? "#D1D7DB" : "#2A3942"}`,
                  }}
                >
                  <div
                    className="max-w-[95%] mx-auto rounded-xl p-3.5 shadow-sm whitespace-pre-wrap select-text"
                    style={{
                      background: isLight ? "#FFFFFF" : "#1F2C34",
                      color: isLight ? "#111B21" : "#E9EDEF",
                      borderLeft: "4px solid #25D366",
                    }}
                  >
                    {reportText}
                  </div>
                </div>
              ) : (
                /* Card Graphic Preview */
                <div
                  className="flex-1 rounded-2xl p-4 overflow-auto max-h-[52vh] flex items-center justify-center"
                  style={{
                    background: isLight ? "#F1F5F9" : "#030712",
                    border: `1px solid ${isLight ? "#E2E8F0" : "#1F2937"}`,
                  }}
                  ref={cardContainerRef}
                >
                  <div
                    className={`origin-top transition-transform shadow-xl rounded-2xl ${
                      includeLastDaySales
                        ? "transform scale-[0.58] sm:scale-[0.66] md:scale-[0.74]"
                        : "transform scale-[0.72] sm:scale-[0.82] md:scale-[0.88]"
                    }`}
                    dangerouslySetInnerHTML={{ __html: cardHtml }}
                  />
                </div>
              )}
            </div>

            {/* KOLOM KANAN: KUSTOMISASI & TOGGLE FILTER */}
            <div className="lg:col-span-5 flex flex-col gap-4">
              <div
                className="rounded-2xl p-4 flex flex-col gap-3.5"
                style={{
                  background: colors.glassSubtle,
                  border: `1px solid ${colors.glassBorder}`,
                }}
              >
                <div className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5" style={{ color: colors.textMuted }}>
                  <Sparkles size={13} style={{ color: colors.gold }} />
                  Kustomisasi Konten Laporan
                </div>

                {/* Opsi 1: Jumlah Top Sales */}
                <div>
                  <label className="text-xs font-medium block mb-1.5" style={{ color: colors.text }}>
                    Leaderboard Sales:
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { val: 3, label: "Top 3" },
                      { val: 5, label: "Top 5" },
                      { val: "all", label: "Semua" },
                    ].map((opt) => (
                      <button
                        key={opt.val}
                        onClick={() => setTopSalesCount(opt.val)}
                        className={`py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                          topSalesCount === opt.val
                            ? "shadow-sm"
                            : "border-transparent opacity-75 hover:opacity-100"
                        }`}
                        style={{
                          background: topSalesCount === opt.val ? colors.mint : colors.glassFill,
                          color: topSalesCount === opt.val ? (isLight ? "#ffffff" : "#0A1120") : colors.text,
                          border: `1px solid ${topSalesCount === opt.val ? colors.mint : colors.glassBorder}`,
                        }}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Opsi 2: Checkboxes / Toggles */}
                <div className="space-y-2.5 pt-1">
                  <div className="space-y-2">
                    <label className="flex items-center gap-2.5 cursor-pointer text-xs font-medium select-none">
                      <input
                        type="checkbox"
                        checked={includeAttention}
                        onChange={(e) => setIncludeAttention(e.target.checked)}
                        className="rounded w-4 h-4 cursor-pointer"
                        style={{ accentColor: colors.mint }}
                      />
                      <span>Sertakan Peringatan & Isu Butuh Perhatian</span>
                      {availableAlertsCount > 0 && (
                        <span
                          className="text-[10px] px-2 py-0.5 rounded-full font-bold"
                          style={{
                            background: `${colors.gold}22`,
                            color: colors.gold,
                            border: `1px solid ${colors.gold}44`,
                          }}
                        >
                          {availableAlertsCount} terdeteksi
                        </span>
                      )}
                    </label>

                    {includeAttention && (
                      <div className="pl-6 pt-1 pb-1">
                        <span className="text-[11px] font-medium block mb-1.5" style={{ color: colors.textMuted }}>
                          Maksimum Peringatan Ditampilkan:
                        </span>
                        <div className="grid grid-cols-4 gap-1.5">
                          {[
                            { val: 2, label: "2 Isu" },
                            { val: 4, label: "4 Isu" },
                            { val: 6, label: "6 Isu" },
                            { val: "all", label: "Semua" },
                          ].map((opt) => (
                            <button
                              key={opt.val}
                              type="button"
                              onClick={() => setAttentionCount(opt.val)}
                              className={`py-1 rounded-lg text-[11px] font-semibold border transition-all ${
                                attentionCount === opt.val
                                  ? "shadow-sm"
                                  : "border-transparent opacity-75 hover:opacity-100"
                              }`}
                              style={{
                                background: attentionCount === opt.val ? colors.gold : colors.glassFill,
                                color: attentionCount === opt.val ? (isLight ? "#ffffff" : "#0A1120") : colors.text,
                                border: `1px solid ${attentionCount === opt.val ? colors.gold : colors.glassBorder}`,
                              }}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <label className="flex items-center gap-2.5 cursor-pointer text-xs font-medium select-none">
                    <input
                      type="checkbox"
                      checked={includeCategories}
                      onChange={(e) => setIncludeCategories(e.target.checked)}
                      className="rounded w-4 h-4 cursor-pointer"
                      style={{ accentColor: colors.mint }}
                    />
                    <span>Sertakan Rekap Kategori Produk</span>
                  </label>

                  <label className="flex items-center gap-2.5 cursor-pointer text-xs font-medium select-none">
                    <input
                      type="checkbox"
                      checked={includeAo}
                      onChange={(e) => setIncludeAo(e.target.checked)}
                      className="rounded w-4 h-4 cursor-pointer"
                      style={{ accentColor: colors.mint }}
                    />
                    <span>Tampilkan Jumlah Toko Aktif (AO)</span>
                  </label>

                  <label className="flex items-center gap-2.5 cursor-pointer text-xs font-medium select-none">
                    <input
                      type="checkbox"
                      checked={includeLastDaySales}
                      onChange={(e) => setIncludeLastDaySales(e.target.checked)}
                      className="rounded w-4 h-4 cursor-pointer"
                      style={{ accentColor: colors.mint }}
                    />
                    <span>⚡ Tampilkan Penjualan Hari Terakhir Semua Sales (Value & AO)</span>
                  </label>
                </div>

                {/* Opsi 3: Catatan Kustom Supervisor */}
                <div className="pt-1">
                  <label className="text-xs font-medium block mb-1" style={{ color: colors.text }}>
                    Pesan / Catatan Tambahan (Opsional):
                  </label>
                  <textarea
                    rows={3}
                    value={customNote}
                    onChange={(e) => setCustomNote(e.target.value)}
                    placeholder="Contoh: Besok briefing pagi jam 07:30 di kantor..."
                    className="w-full text-xs p-2.5 rounded-xl border transition-all resize-none focus:outline-none"
                    style={{
                      background: colors.glassFill,
                      borderColor: colors.glassBorder,
                      color: colors.text,
                    }}
                  />
                </div>
              </div>

              {/* Info box */}
              <div
                className="p-3 rounded-xl text-xs flex items-start gap-2"
                style={{
                  background: `${colors.mint}14`,
                  border: `1px solid ${colors.mint}33`,
                  color: colors.text,
                }}
              >
                <Sparkles size={14} className="shrink-0 mt-0.5" style={{ color: colors.mint }} />
                <p className="leading-snug">
                  <b>Tips:</b> Gunakan tombol <b>Buka WhatsApp</b> untuk langsung membuka aplikasi dengan teks yang sudah terisi otomatis, atau <b>Salin Teks</b> untuk menempelkannya ke grup manapun.
                </p>
              </div>
            </div>

          </div>
        </div>

        {/* ===== MODAL FOOTER & ACTION BUTTONS ===== */}
        <div
          className="px-5 py-3.5 flex flex-wrap items-center justify-between gap-3 shrink-0"
          style={{
            borderTop: `1px solid ${colors.glassBorder}`,
            background: colors.glassSubtle,
          }}
        >
          <div className="text-xs hidden sm:block" style={{ color: colors.textMuted }}>
            {activeTab === "text" ? "Siap dikirim ke WhatsApp / Telegram" : "Format PNG siap kirim"}
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
            {activeTab === "text" ? (
              <>
                {/* Tombol Salin Teks */}
                <button
                  type="button"
                  onClick={handleCopyText}
                  className="sm-btn px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm transition-all"
                  style={{
                    background: copiedText ? `${colors.mint}22` : colors.glassFill,
                    border: `1px solid ${copiedText ? colors.mint : colors.glassBorder}`,
                    color: copiedText ? colors.mint : colors.text,
                  }}
                >
                  {copiedText ? <Check size={15} /> : <Copy size={15} />}
                  <span>{copiedText ? "Tersalin!" : "Salin Teks"}</span>
                </button>

                {/* Tombol Share (Mobile / Web Share) */}
                {typeof navigator !== "undefined" && typeof navigator.share === "function" && (
                  <button
                    type="button"
                    onClick={handleShare}
                    className="sm-btn px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm"
                    style={{
                      background: colors.glassFill,
                      border: `1px solid ${colors.glassBorder}`,
                      color: colors.text,
                    }}
                  >
                    <Share2 size={15} />
                    <span>Bagikan</span>
                  </button>
                )}

                {/* Tombol Buka WhatsApp (Utama) */}
                <button
                  type="button"
                  onClick={handleOpenWhatsApp}
                  className="sm-btn px-5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 text-white shadow-md hover:brightness-105 active:scale-95 transition-all"
                  style={{
                    background: "linear-gradient(135deg, #25D366, #128C7E)",
                  }}
                >
                  <Send size={15} />
                  <span>Buka WhatsApp</span>
                </button>
              </>
            ) : (
              <>
                {/* Tombol Salin Gambar */}
                <button
                  type="button"
                  onClick={handleCopyCardImage}
                  disabled={isGenerating}
                  className="sm-btn px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm transition-all disabled:opacity-50"
                  style={{
                    background: copiedImage ? `${colors.mint}22` : colors.glassFill,
                    border: `1px solid ${copiedImage ? colors.mint : colors.glassBorder}`,
                    color: copiedImage ? colors.mint : colors.text,
                  }}
                >
                  {copiedImage ? <Check size={15} /> : <Copy size={15} />}
                  <span>{copiedImage ? "Gambar Tersalin!" : "Salin Gambar"}</span>
                </button>

                {/* Tombol Download Kartu PNG (Utama) */}
                <button
                  type="button"
                  onClick={handleDownloadCard}
                  disabled={isGenerating}
                  className="sm-btn px-5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 shadow-md hover:brightness-105 active:scale-95 transition-all disabled:opacity-50"
                  style={{
                    background: `linear-gradient(135deg, ${colors.gold}, ${colors.coral || '#DC2626'})`,
                    color: colors.onGold || (isLight ? "#FFFFFF" : "#0A1120"),
                  }}
                >
                  <Download size={15} />
                  <span>{isGenerating ? "Memproses..." : "Download Kartu PNG"}</span>
                </button>
              </>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
