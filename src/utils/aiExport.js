import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import html2canvas from "html2canvas-pro";
import { fmtRp, fmtNum, MONTHS_ID } from "./formatters.js";
import { APP_LOGO_BASE64 } from "./exportLogo.js";

/* ============================================================================
   AI EXPORT UTILITIES
   Menyediakan ekspor interaksi & rekomendasi asisten AI ke:
   1) Clipboard (Markdown terstruktur rapi + tabel ASCII)
   2) PDF Dokumen Resmi (jsPDF + autotable dengan letterhead)
   3) Image PNG (html2canvas-pro HiDPI/Retina)
============================================================================ */

const COLORS = {
  navy: [17, 24, 39],       // #111827
  headerFill: [15, 23, 42], // #0F172A
  gold: [217, 119, 6],      // #D97706
  mint: [5, 150, 105],      // #059669
  coral: [220, 38, 38],     // #DC2626
  blue: [37, 99, 235],      // #2563EB
  text: [31, 41, 55],       // #1F2937
  textMuted: [107, 114, 128],// #6B7280
  border: [229, 231, 235],  // #E5E7EB
  lightBg: [248, 250, 252], // #F8FAFC
  userBg: [238, 242, 255],  // #EEF2FF (indigo soft)
};

function formatGeneratedAt() {
  const now = new Date();
  const d = String(now.getDate()).padStart(2, "0");
  const mo = MONTHS_ID[now.getMonth()] || "";
  const y = now.getFullYear();
  const h = String(now.getHours()).padStart(2, "0");
  const mi = String(now.getMinutes()).padStart(2, "0");
  return `${d} ${mo} ${y}, ${h}:${mi} WIB`;
}

function getFilenameTimestamp() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const h = String(now.getHours()).padStart(2, "0");
  const mi = String(now.getMinutes()).padStart(2, "0");
  return `${y}${m}${d}_${h}${mi}`;
}

// ----------------------------------------------------------------------------
// 1. CLIPBOARD EXPORT
// ----------------------------------------------------------------------------

/**
 * Salin teks string ke clipboard dengan fallback aman untuk browser/webview.
 * @param {string} text
 * @returns {Promise<boolean>}
 */
export async function copyToClipboard(text) {
  if (!text) return false;
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fallback ke textarea jika Clipboard API diblokir permission/iframe
  }

  try {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed";
    textArea.style.left = "-999999px";
    textArea.style.top = "-999999px";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    const successful = document.execCommand("copy");
    textArea.remove();
    return successful;
  } catch {
    return false;
  }
}

/**
 * Format satu pesan chat ke teks Markdown rapi.
 * @param {object} m - objek pesan { role, text, tool, reactTool, data, reactData }
 * @returns {string}
 */
export function formatMessageAsMarkdown(m) {
  if (!m) return "";
  const isUser = m.role === "user";
  const toolName = m.reactTool || m.tool;
  const effectiveData = m.reactData || m.data;

  let out = "";
  if (isUser) {
    out += `### 👤 Pengguna\n${m.text}\n`;
  } else {
    out += `### 🤖 Asisten AI${toolName ? ` *(Tool: ${toolName})*` : ""}\n`;
    if (m.text) {
      out += `${m.text}\n\n`;
    }

    // Format data tabel ke markdown jika ada
    if (effectiveData && typeof effectiveData === "object") {
      // 1. cariOutlet
      if (toolName === "cariOutlet" && Array.isArray(effectiveData.rows)) {
        out += `| No | Outlet | Omzet | Faktur | Sales | Terakhir |\n`;
        out += `|---|---|---|---|---|---|\n`;
        effectiveData.rows.forEach((r, i) => {
          out += `| ${i + 1} | ${r.name} (${r.code}) | ${fmtRp(r.value)} | ${r.invoiceCount} | ${r.salesList} | ${r.lastDate || "-"} |\n`;
        });
        out += `\n*Total: ${effectiveData.ditampilkan} dari ${effectiveData.total} outlet*\n\n`;
      }
      // 2. cariProduk
      else if (toolName === "cariProduk" && Array.isArray(effectiveData.rows)) {
        out += `| No | SKU / Produk | Grup | Qty | Omzet | Toko |\n`;
        out += `|---|---|---|---|---|---|\n`;
        effectiveData.rows.forEach((r, i) => {
          out += `| ${i + 1} | ${r.name} | ${r.group} | ${fmtNum(r.qty)} | ${fmtRp(r.value)} | ${r.outletCount} |\n`;
        });
        out += `\n*Total: ${effectiveData.ditampilkan} dari ${effectiveData.total} produk*\n\n`;
      }
      // 3. cariStok / bacaStok
      else if ((toolName === "cariStok" || toolName === "bacaStok") && Array.isArray(effectiveData.rows)) {
        out += `| No | SKU / Produk | Qty | Satuan | Coverage | Status |\n`;
        out += `|---|---|---|---|---|---|\n`;
        effectiveData.rows.forEach((r, i) => {
          const st = r.isStockout ? "HABIS" : r.isLowStock ? "KRITIS" : r.isOverstock ? "OVERSTOCK" : "AMAN";
          const cov = r.coverageDays != null ? `${r.coverageDays} hari` : "-";
          out += `| ${i + 1} | ${r.nama} | ${fmtNum(r.currentQty)} | ${r.unit} | ${cov} | ${st} |\n`;
        });
        out += `\n*Stok: ${effectiveData.habisTotal ?? 0} habis, ${effectiveData.kritisTotal ?? 0} kritis*\n\n`;
      }
      // 4. queryData
      else if (toolName === "queryData" && Array.isArray(effectiveData.rows)) {
        out += `| No | Sales | ACH | Total Omzet |\n`;
        out += `|---|---|---|---|\n`;
        effectiveData.rows.forEach((r, i) => {
          out += `| ${i + 1} | ${r.nama || r.kode} | ${r.ach}% | ${fmtRp(r.total)} |\n`;
        });
        out += `\n*ACH Global: ${effectiveData.achGlobal ?? "-"}%*\n\n`;
      }
      // 5. bacaBulanan
      else if (toolName === "bacaBulanan" && Array.isArray(effectiveData.tren)) {
        out += `| Bulan | Target | Realisasi | ACH |\n`;
        out += `|---|---|---|---|\n`;
        effectiveData.tren.forEach((m) => {
          out += `| ${m.label || m.bulan} | ${fmtRp(m.target)} | ${fmtRp(m.total)} | ${m.ach}% |\n`;
        });
        out += `\n`;
      }
      // 6. detailSales
      else if (toolName === "detailSales") {
        out += `**Sales:** ${effectiveData.nama} (${effectiveData.salesCode})\n`;
        out += `- Total Penjualan: ${fmtRp(effectiveData.total)}\n`;
        out += `- Target: ${fmtRp(effectiveData.target)} (ACH: ${effectiveData.ach ?? "-"}%)\n`;
        out += `- Outlet Unik (AO): ${effectiveData.ao}\n\n`;
        if (Array.isArray(effectiveData.topOutlet) && effectiveData.topOutlet.length > 0) {
          out += `Top Outlet:\n`;
          effectiveData.topOutlet.forEach((o, i) => {
            out += `${i + 1}. ${o.name}: ${fmtRp(o.value)} (${o.count} transaksi)\n`;
          });
          out += `\n`;
        }
      }
    }
  }
  return out;
}

/**
 * Format seluruh riwayat chat menjadi string Markdown lengkap.
 * @param {Array} messages - daftar pesan
 * @param {object} opts
 * @returns {string}
 */
export function formatChatAsMarkdown(messages = [], opts = {}) {
  const timestamp = formatGeneratedAt();
  const modelName = opts.model || "Asisten AI";

  let md = `# 💬 Riwayat Percakapan & Rekomendasi AI\n`;
  md += `**Aplikasi**: Monitoring Penjualan Sales\n`;
  md += `**Waktu Ekspor**: ${timestamp}\n`;
  md += `**Model**: ${modelName}\n`;
  md += `**Jumlah Pesan**: ${messages.length}\n\n`;
  md += `---\n\n`;

  for (const m of messages) {
    md += formatMessageAsMarkdown(m) + "\n---\n\n";
  }

  md += `*Laporan dihasilkan secara otomatis oleh Asisten AI Monitoring Penjualan.*`;
  return md;
}

// ----------------------------------------------------------------------------
// 2. PDF EXPORT
// ----------------------------------------------------------------------------

function drawPdfHeader(doc, { title, subtitle }) {
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setFillColor(...COLORS.headerFill);
  doc.rect(0, 0, pageWidth, 26, "F");

  // Logo resmi baru di kanan atas header bar
  if (APP_LOGO_BASE64) {
    try {
      const logoSize = 18;
      doc.addImage(APP_LOGO_BASE64, "PNG", pageWidth - 14 - logoSize, 4, logoSize, logoSize);
    } catch {
      // Fallback jika terjadi kendala rendering raster
    }
  }

  doc.setTextColor(...COLORS.gold);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("MONITORING PENJUALAN SALES", 14, 11);

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(title || "Laporan Percakapan & Rekomendasi Asisten AI", 14, 18);

  doc.setFontSize(8);
  doc.setTextColor(200, 200, 200);
  doc.text(subtitle || `Dibuat: ${formatGeneratedAt()}`, 14, 23);

  doc.setTextColor(...COLORS.text);
  return 34;
}

function ensurePdfSpace(doc, y, needed, headerOpts) {
  const pageHeight = doc.internal.pageSize.getHeight();
  const remaining = pageHeight - y - 14;
  if (remaining < needed) {
    doc.addPage();
    return drawPdfHeader(doc, headerOpts);
  }
  return y;
}

function drawPdfFooter(doc) {
  const pageCount = doc.internal.getNumberOfPages();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...COLORS.textMuted);
    doc.text(`Dibuat otomatis oleh Asisten AI Monitoring Penjualan — ${formatGeneratedAt()}`, 14, pageHeight - 8);
    doc.text(`Halaman ${i} / ${pageCount}`, pageWidth - 14, pageHeight - 8, { align: "right" });
  }
}

/**
 * Ekspor percakapan AI ke file PDF profesional.
 * @param {Array} messages - daftar pesan chat
 * @param {object} opts - { model, filename }
 */
export function exportChatToPdf(messages = [], opts = {}) {
  if (!messages || !messages.length) return false;

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const contentWidth = pageWidth - 28; // margin kiri 14, kanan 14

  const headerOpts = {
    title: "Laporan Percakapan & Rekomendasi AI Asisten",
    subtitle: `Dibuat: ${formatGeneratedAt()} · Model: ${opts.model || "AI"} · Total ${messages.length} pesan`,
  };

  let y = drawPdfHeader(doc, headerOpts);

  for (let idx = 0; idx < messages.length; idx++) {
    const m = messages[idx];
    const isUser = m.role === "user";
    const toolName = m.reactTool || m.tool;
    const effectiveData = m.reactData || m.data;

    // Pastikan ada ruang cukup untuk header pesan
    y = ensurePdfSpace(doc, y, 20, headerOpts);

    if (isUser) {
      // Kotak Pertanyaan Pengguna
      doc.setFillColor(...COLORS.userBg);
      doc.setDrawColor(...COLORS.border);
      const textLines = doc.splitTextToSize(`Tanya: ${m.text || "-"}`, contentWidth - 8);
      const boxHeight = Math.max(10, textLines.length * 4.5 + 6);

      y = ensurePdfSpace(doc, y, boxHeight + 4, headerOpts);

      doc.roundedRect(14, y, contentWidth, boxHeight, 2, 2, "FD");
      doc.setFillColor(...COLORS.blue);
      doc.rect(14, y, 2, boxHeight, "F"); // strip aksen biru

      doc.setTextColor(...COLORS.blue);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.text("PERTANYAAN PENGGUNA", 18, y + 5);

      doc.setTextColor(...COLORS.text);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      doc.text(textLines, 18, y + 10);

      y += boxHeight + 6;
    } else {
      // Pesan Asisten AI
      doc.setFillColor(...COLORS.lightBg);
      doc.setDrawColor(...COLORS.border);

      doc.setTextColor(...COLORS.mint);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      const badgeText = toolName ? `REKOMENDASI AI · TOOL: ${toolName.toUpperCase()}` : "REKOMENDASI AI";
      doc.text(badgeText, 14, y);
      y += 5;

      // Narasi teks AI
      if (m.text) {
        doc.setTextColor(...COLORS.text);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8.5);
        const narrativeLines = doc.splitTextToSize(m.text, contentWidth);
        const narrativeHeight = narrativeLines.length * 4.5;
        y = ensurePdfSpace(doc, y, narrativeHeight + 5, headerOpts);
        doc.text(narrativeLines, 14, y);
        y += narrativeHeight + 5;
      }

      // Render tabel terstruktur bila ada data pendukung
      if (effectiveData && typeof effectiveData === "object") {
        // --- cariOutlet ---
        if (toolName === "cariOutlet" && Array.isArray(effectiveData.rows) && effectiveData.rows.length > 0) {
          y = ensurePdfSpace(doc, y, 30, headerOpts);
          autoTable(doc, {
            startY: y,
            margin: { left: 14, right: 14 },
            head: [["No", "Nama Outlet", "Kode", "Total Omzet", "Faktur", "Sales", "Tgl Akhir"]],
            body: effectiveData.rows.map((r, i) => [
              i + 1,
              r.name,
              r.code,
              fmtRp(r.value),
              r.invoiceCount,
              r.salesList || "-",
              r.lastDate ? r.lastDate.slice(0, 10) : "-",
            ]),
            styles: { fontSize: 7.5, cellPadding: 2 },
            headStyles: { fillColor: COLORS.headerFill, textColor: 255, fontStyle: "bold" },
            alternateRowStyles: { fillColor: COLORS.lightBg },
          });
          y = doc.lastAutoTable.finalY + 6;
        }

        // --- cariProduk ---
        else if (toolName === "cariProduk" && Array.isArray(effectiveData.rows) && effectiveData.rows.length > 0) {
          y = ensurePdfSpace(doc, y, 30, headerOpts);
          autoTable(doc, {
            startY: y,
            margin: { left: 14, right: 14 },
            head: [["No", "Nama Produk / SKU", "Kode", "Grup", "Qty", "Total Omzet", "Toko"]],
            body: effectiveData.rows.map((r, i) => [
              i + 1,
              r.name,
              r.code,
              r.group,
              fmtNum(r.qty),
              fmtRp(r.value),
              r.outletCount,
            ]),
            styles: { fontSize: 7.5, cellPadding: 2 },
            headStyles: { fillColor: COLORS.headerFill, textColor: 255, fontStyle: "bold" },
            alternateRowStyles: { fillColor: COLORS.lightBg },
          });
          y = doc.lastAutoTable.finalY + 6;
        }

        // --- cariStok / bacaStok ---
        else if ((toolName === "cariStok" || toolName === "bacaStok") && Array.isArray(effectiveData.rows) && effectiveData.rows.length > 0) {
          y = ensurePdfSpace(doc, y, 30, headerOpts);
          autoTable(doc, {
            startY: y,
            margin: { left: 14, right: 14 },
            head: [["No", "Nama Barang / SKU", "Qty Fisik", "Satuan", "Coverage", "Status"]],
            body: effectiveData.rows.map((r, i) => {
              const st = r.isStockout ? "HABIS" : r.isLowStock ? "KRITIS" : r.isOverstock ? "OVERSTOCK" : "AMAN";
              return [
                i + 1,
                r.nama,
                fmtNum(r.currentQty),
                r.unit,
                r.coverageDays != null ? `${r.coverageDays} hr` : "-",
                st,
              ];
            }),
            styles: { fontSize: 7.5, cellPadding: 2 },
            headStyles: { fillColor: COLORS.headerFill, textColor: 255, fontStyle: "bold" },
            alternateRowStyles: { fillColor: COLORS.lightBg },
          });
          y = doc.lastAutoTable.finalY + 6;
        }

        // --- queryData ---
        else if (toolName === "queryData" && Array.isArray(effectiveData.rows) && effectiveData.rows.length > 0) {
          y = ensurePdfSpace(doc, y, 30, headerOpts);
          autoTable(doc, {
            startY: y,
            margin: { left: 14, right: 14 },
            head: [["No", "Nama Sales", "Kode", "ACH %", "Total Omzet"]],
            body: effectiveData.rows.map((r, i) => [
              i + 1,
              r.nama || "-",
              r.kode || "-",
              `${r.ach}%`,
              fmtRp(r.total),
            ]),
            styles: { fontSize: 7.5, cellPadding: 2 },
            headStyles: { fillColor: COLORS.headerFill, textColor: 255, fontStyle: "bold" },
            alternateRowStyles: { fillColor: COLORS.lightBg },
          });
          y = doc.lastAutoTable.finalY + 6;
        }

        // --- detailSales ---
        else if (toolName === "detailSales") {
          y = ensurePdfSpace(doc, y, 25, headerOpts);
          doc.setFillColor(...COLORS.lightBg);
          doc.roundedRect(14, y, contentWidth, 16, 2, 2, "FD");
          doc.setTextColor(...COLORS.text);
          doc.setFont("helvetica", "bold");
          doc.setFontSize(8.5);
          doc.text(`Sales: ${effectiveData.nama} (${effectiveData.salesCode})`, 18, y + 6);
          doc.setFont("helvetica", "normal");
          doc.text(`Omzet: ${fmtRp(effectiveData.total)}  |  Target: ${fmtRp(effectiveData.target)}  |  ACH: ${effectiveData.ach ?? "-"}%  |  AO: ${effectiveData.ao}`, 18, y + 12);
          y += 20;

          if (Array.isArray(effectiveData.topOutlet) && effectiveData.topOutlet.length > 0) {
            y = ensurePdfSpace(doc, y, 25, headerOpts);
            autoTable(doc, {
              startY: y,
              margin: { left: 14, right: 14 },
              head: [["Top Outlet", "Nilai Transaksi", "Jumlah Transaksi", "Transaksi Terakhir"]],
              body: effectiveData.topOutlet.map((o) => [
                o.name,
                fmtRp(o.value),
                o.count,
                o.lastDate ? o.lastDate.slice(0, 10) : "-",
              ]),
              styles: { fontSize: 7.5, cellPadding: 2 },
              headStyles: { fillColor: COLORS.headerFill, textColor: 255, fontStyle: "bold" },
              alternateRowStyles: { fillColor: COLORS.lightBg },
            });
            y = doc.lastAutoTable.finalY + 6;
          }
        }
      }

      // Separator antar percakapan
      y += 4;
      y = ensurePdfSpace(doc, y, 6, headerOpts);
      doc.setDrawColor(...COLORS.border);
      doc.line(14, y, pageWidth - 14, y);
      y += 6;
    }
  }

  drawPdfFooter(doc);

  const filename = opts.filename || `AI_Rekomendasi_Penjualan_${getFilenameTimestamp()}.pdf`;
  doc.save(filename);
  return true;
}

// ----------------------------------------------------------------------------
// 3. IMAGE EXPORT (PNG)
// ----------------------------------------------------------------------------

/**
 * Tangkap elemen DOM dan simpan sebagai file gambar PNG beresolusi tinggi (Retina/HiDPI).
 * @param {HTMLElement} element - elemen DOM yang ingin difoto
 * @param {string} [filename] - nama file tujuan
 * @param {object} [opts] - opsi tambahan html2canvas
 * @returns {Promise<boolean>}
 */
export async function exportElementToPng(element, filename, opts = {}) {
  if (!element) return false;
  try {
    const canvas = await html2canvas(element, {
      scale: 2, // HiDPI
      useCORS: true,
      logging: false,
      backgroundColor: opts.backgroundColor || "#0F172A", // Dark theme background
      ...opts,
    });

    const dataUrl = canvas.toDataURL("image/png");
    const safeFilename = filename || `AI_Rekomendasi_${getFilenameTimestamp()}.png`;

    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = safeFilename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    return true;
  } catch (err) {
    console.error("Gagal mengekspor gambar AI:", err);
    return false;
  }
}
