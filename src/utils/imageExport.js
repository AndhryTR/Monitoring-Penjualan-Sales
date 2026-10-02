import html2canvas from "html2canvas-pro";
import { fmtRp, fmtNum, fmtPct, fmtDeviasi, fmtDeviasiAo, formatDateID, esc, MONTHS_ID, formatGeneratedAt } from "./formatters.js";
import { dateStrToLocalDate } from "./excelParse.js";
import { getAchColor } from "../constants/thresholds.js";
import { APP_LOGO_BASE64 } from "./exportLogo.js";
import { getStoredCommissionRules, calculateSingleSalesCommission } from "./commissionEngine.js";

/* ============================================================================
   IMAGE EXPORT
   Karena jsPDF dan xlsx-js-style tidak bisa menghasilkan gambar langsung,
   pendekatan di sini: bangun ulang laporan yang sama sebagai HTML biasa
   (warna & struktur meniru template PDF/Excel yang sudah ada), render ke
   elemen tersembunyi di luar layar, lalu "difoto" pakai html2canvas jadi
   PNG/JPEG.

   PENTING — warna di file ini SENGAJA DIDUPLIKASI (bukan di-import) dari
   pdfExport.js dan excelExport.js, supaya perubahan di sini tidak berisiko
   mengubah perilaku 2 fitur export yang sudah berjalan. Kalau warna/struktur
   template PDF atau Excel diubah di masa depan, sesuaikan juga manual di sini.
============================================================================ */

// ---- Warna khusus mirror "Laporan Perbandingan Sales" (PDF) ----
const PDF_COLORS = {
  headerFill: "#111827",
  goldTint: "#F9EBDA",
  gold: "#D97706",
  text: "#111827",
  textMuted: "#6B7280",
  border: "#E5E7EB",
  mint: "#059669",
  coral: "#DC2626",
};

// Mirror PERSIS dari achColor() di pdfExport.js — PDF laporan ini TIDAK pakai
// gradien background (itu cuma fitur Excel), cuma warna TEKS 3-tingkat.
// Jangan pakai achGradientColor (di bawah) untuk mirror PDF — beda template.
function pdfDeviasiTextColor(dev) {
  if (dev === null || dev === undefined) return "#334155";
  return dev < 0 ? "#059669" : "#DC2626";
}

function pdfAchTextColor(ach) {
  return getAchColor(ach, PDF_COLORS);
}

/* ----------------------------------------------------------------------------
   Fungsi generik: render HTML string di elemen tersembunyi, screenshot pakai
   html2canvas, download sebagai PNG/JPEG. `scale: 2` supaya teks tetap tajam
   walau di-zoom (setara retina/HiDPI).

   ⚠️ Bug fix (H12): sebelumnya `canvas.toDataURL(mime, ...)` TANPA try/catch.
   Bila ada gambar di HTML yang di-capture tidak punya header CORS (mis. dari
   domain eksternal tanpa `crossorigin`), canvas jadi "tainted" dan `toDataURL`
   melempar `SecurityError` yang tak tertangkap → export hang diam-diam tanpa
   feedback ke user. Sekarang: catch SecurityError + error umum, throw dengan
   pesan user-friendly supaya caller bisa surface ke UI. Container tetap
   di-cleanup di `finally` block.
---------------------------------------------------------------------------- */
export async function exportHtmlAsImage(html, filenameBase, format = "png") {
  if (typeof document !== "undefined" && document.fonts && document.fonts.ready) {
    try {
      await document.fonts.ready;
    } catch {
      // ignore font loading error
    }
  }

  const container = document.createElement("div");
  // ⚠️ PENTING: Jangan ubah opacity < 1! html2canvas mengalikan canvas globalAlpha
  // dengan computed opacity elemen dan seluruh leluhurnya.
  // Jangan gunakan left: -99999px karena html2canvas akan menghitung offset bounding box
  // x = -99999 sehingga hasil render canvas menjadi kosong/terpotong.
  // Gunakan top: 0, left: 0 dengan zIndex: -99999 agar elemen berada di posisi normal (0,0)
  // namun berada jauh di belakang seluruh antarmuka aplikasi.
  container.style.position = "fixed";
  container.style.top = "0";
  container.style.left = "0";
  container.style.zIndex = "-99999";
  container.style.opacity = "1";
  container.style.pointerEvents = "none";
  container.style.width = "max-content";
  container.innerHTML = html;
  document.body.appendChild(container);

  try {
    const targetEl = container.firstElementChild || container;

    // Beri browser microtask & frame untuk mengkalkulasi layout dimensi elemen sebelum snapshot
    await new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 60)));

    const targetWidth = Math.max(targetEl.scrollWidth || 0, targetEl.offsetWidth || 0, 900);
    const targetHeight = Math.max(targetEl.scrollHeight || 0, targetEl.offsetHeight || 0, 400);

    const canvas = await html2canvas(targetEl, {
      scale: 2,
      backgroundColor: "#ffffff",
      useCORS: true,
      logging: false,
      scrollX: 0,
      scrollY: 0,
      x: 0,
      y: 0,
      width: targetWidth,
      height: targetHeight,
      windowWidth: targetWidth + 50,
      windowHeight: targetHeight + 50,
    });

    const mime = format === "jpeg" ? "image/jpeg" : "image/png";
    const quality = format === "jpeg" ? 0.92 : undefined;

    // ⚠️ Ubah ke Blob lalu buat URL objek untuk mengunduh.
    // toDataURL() menghasilkan base64 raksasa (>5MB) yang sering ditolak secara diam-diam
    // oleh batas URL browser Chromium/WebView2 saat memicu link download.
    const blob = await new Promise((resolve, reject) => {
      try {
        canvas.toBlob((b) => {
          if (b) resolve(b);
          else reject(new Error("Canvas menghasilkan data kosong"));
        }, mime, quality);
      } catch (e) {
        if (e && /security/i.test(e.name || e.message || "")) {
          reject(new Error("Export gambar gagal: canvas tainted oleh gambar cross-origin. Pastikan semua gambar di template berasal dari domain yang sama atau pakai data URL."));
        } else {
          reject(new Error("Export gambar gagal: " + (e?.message || String(e))));
        }
      }
    });

    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = `${filenameBase}.${format === "jpeg" ? "jpg" : "png"}`;
    document.body.appendChild(a);
    a.click();

    setTimeout(() => {
      if (a.parentNode) a.parentNode.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    }, 1000);
  } finally {
    if (container.parentNode) {
      container.parentNode.removeChild(container);
    }
  }
}

/* ----------------------------------------------------------------------------
   1) MIRROR "Laporan Perbandingan Sales" (PDF) sebagai HTML
---------------------------------------------------------------------------- */
function pdfTd(content, { bg, color, bold, align = "left", fontSize = 11 } = {}) {
  const style = [
    "padding:5px 8px", `text-align:${align}`, `font-size:${fontSize}px`,
    "font-family:Helvetica,Arial,sans-serif", bold ? "font-weight:bold" : "font-weight:normal",
    `color:${color || PDF_COLORS.text}`, bg ? `background:${bg}` : "",
    `border:1px solid ${PDF_COLORS.border}`, "white-space:nowrap",
  ].filter(Boolean).join(";");
  return `<td style="${style}">${esc(content)}</td>`;
}
function pdfTh(content, { align = "center" } = {}) {
  return `<th style="padding:5px 8px;text-align:${align};font-size:12.5px;font-family:Helvetica,Arial,sans-serif;font-weight:bold;color:#fff;background:${PDF_COLORS.headerFill};border:1px solid ${PDF_COLORS.border};white-space:nowrap;">${esc(content)}</th>`;
}

function buildSalesRowHtml(cols, achIndex = -1) {
  // cols = array of {content, align, fontSize} — semua di-highlight gold tint +
  // bold (baris "sales"). Kolom ach (kalau ada, achIndex) teksnya JUGA diwarnai
  // 3-tingkat — persis seperti didParseCell di PDF asli yang menerapkan
  // textColor=achColor(...) ke SEMUA baris (sales maupun grup), bukan cuma grup.
  return `<tr>${cols.map((c, i) => pdfTd(c.content, { bg: PDF_COLORS.goldTint, bold: true, align: c.align, fontSize: c.fontSize, color: c.color || (i === achIndex ? c.achColor : undefined) })).join("")}</tr>`;
}
function buildGroupRowHtml(cols, achIndex) {
  // cols = array of {content, align} — baris "grup" polos, kolom ach (kalau ada)
  // diwarnai TEKS 3-tingkat (mint/gold/coral), BUKAN background gradien —
  // sesuai template PDF asli (achColor), beda dengan template Excel.
  return `<tr>${cols.map((c, i) => pdfTd(c.content, { align: c.align, bold: i === achIndex, color: c.color || (i === achIndex ? c.achColor : undefined) })).join("")}</tr>`;
}

export function buildSalesGroupComparisonHTML(agg, opts) {
  const { depotName } = opts || {};
  const periodLabel = `${formatDateID(agg.meta.firstDate)} — ${formatDateID(agg.meta.lastDate)}`;
  const groupLabel = agg.byGroup.length ? agg.byGroup.map((g) => g.name).join(", ") : "Semua Grup";
  const sortedGroups = [...agg.byGroup].sort((a, b) => b.realisasiValue - a.realisasiValue);
  const sortedSales = [...agg.bySales].sort((a, b) => (b.ach ?? -1) - (a.ach ?? -1));
  const lastDateRows = agg.meta.lastDate ? agg.filteredRows.filter((r) => r.date === agg.meta.lastDate) : [];

  const wrap = "font-family:Helvetica,Arial,sans-serif;width:820px;padding:24px;background:#fff;";
  let html = `<div style="${wrap}">`;
  html += `<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;padding-bottom:12px;border-bottom:2px solid ${PDF_COLORS.border};">`;
  html += `<div>`;
  html += `<div style="font-size:16px;font-weight:bold;color:${PDF_COLORS.text};">${esc(depotName || "DEPO")}</div>`;
  html += `<div style="font-size:13px;font-weight:bold;color:${PDF_COLORS.text};margin-top:3px;">LAPORAN PERBANDINGAN PENCAPAIAN SALES</div>`;
  html += `<div style="font-size:11.5px;color:${PDF_COLORS.textMuted};margin-top:2px;">Grup: ${esc(groupLabel)} &nbsp;·&nbsp; ${esc(periodLabel)}</div>`;
  html += `</div>`;
  html += `<div style="width:48px;height:48px;flex-shrink:0;">`;
  html += `<img src="${APP_LOGO_BASE64}" width="48" height="48" style="width:100%;height:100%;object-fit:contain;display:block;" alt="Logo" />`;
  html += `</div>`;
  html += `</div>`;

  // Section 1
  html += `<div style="font-size:12.5px;font-weight:bold;color:${PDF_COLORS.text};margin:10px 0 4px;">Rekap per Grup Produk</div>`;
  html += `<table style="border-collapse:collapse;width:100%;margin-bottom:14px;"><thead><tr>${pdfTh("Grup Produk", { align: "left" })}${pdfTh("Target")}${pdfTh("Realisasi")}${pdfTh("Ach%")}</tr></thead><tbody>`;
  sortedGroups.forEach((g) => {
    html += `<tr>${pdfTd(g.name)}${pdfTd(fmtRp(g.targetValue), { align: "right" })}${pdfTd(fmtRp(g.realisasiValue), { align: "right" })}${pdfTd(fmtPct(g.ach), { align: "right", bold: true, color: pdfAchTextColor(g.ach) })}</tr>`;
  });
  html += `</tbody></table>`;

  // Section 2
  html += `<div style="font-size:12.5px;font-weight:bold;color:${PDF_COLORS.text};margin:10px 0 4px;">Rekap per Sales — Total Periode</div>`;
  html += `<table style="border-collapse:collapse;width:100%;margin-bottom:14px;"><thead><tr>${pdfTh("#")}${pdfTh("Nama", { align: "left" })}${pdfTh("Target")}${pdfTh("Realisasi")}${pdfTh("Ach%")}${pdfTh("Deviasi")}${pdfTh("AO")}</tr></thead><tbody>`;
  sortedSales.forEach((s, idx) => {
    html += buildSalesRowHtml([
      { content: idx + 1, align: "center" }, { content: s.name, align: "left" },
      { content: fmtRp(s.targetValue), align: "right" }, { content: fmtRp(s.realisasiValue), align: "right" },
      { content: fmtPct(s.ach), align: "right", achColor: pdfAchTextColor(s.ach) }, { content: s.deviasiValue !== null ? fmtDeviasi(s.deviasiValue) : "-", align: "right", color: pdfDeviasiTextColor(s.deviasiValue) },
      { content: fmtNum(s.realisasiAo), align: "right" },
    ], 4);
    s.groups.forEach((g) => {
      html += buildGroupRowHtml([
        { content: "", align: "center" }, { content: g.name, align: "left" },
        { content: fmtRp(g.targetValue), align: "right" }, { content: fmtRp(g.realisasiValue), align: "right" },
        { content: fmtPct(g.ach), align: "right", achColor: pdfAchTextColor(g.ach) },
        { content: g.deviasiValue !== null ? fmtDeviasi(g.deviasiValue) : "-", align: "right", color: pdfDeviasiTextColor(g.deviasiValue) },
        { content: fmtNum(g.realisasiAo), align: "right" },
      ], 4);
    });
  });
  html += `</tbody></table>`;

  // Section 3
  html += `<div style="font-size:12.5px;font-weight:bold;color:${PDF_COLORS.text};margin:10px 0 4px;">Pencapaian Hari Terakhir — ${esc(formatDateID(agg.meta.lastDate))}</div>`;
  if (lastDateRows.length === 0) {
    html += `<div style="font-size:11.5px;color:${PDF_COLORS.textMuted};">Tidak ada transaksi pada tanggal ini untuk grup yang difilter.</div>`;
  } else {
    html += `<table style="border-collapse:collapse;width:100%;"><thead><tr>${pdfTh("#")}${pdfTh("Nama", { align: "left" })}${pdfTh("Realisasi")}${pdfTh("AO")}</tr></thead><tbody>`;
    sortedSales.forEach((s, idx) => {
      const salesLastRows = lastDateRows.filter((r) => r.salesCode === s.code);
      const realAoToday = new Set(salesLastRows.map((r) => r.outletCode)).size;
      const salesLastValue = salesLastRows.reduce((sum, r) => sum + r.value, 0);
      html += buildSalesRowHtml([
        { content: idx + 1, align: "center" }, { content: s.name, align: "left" },
        { content: salesLastRows.length ? fmtRp(salesLastValue) : "-", align: "right" },
        { content: salesLastRows.length ? fmtNum(realAoToday) : "-", align: "right" },
      ]);
      if (salesLastRows.length === 0) return;
      s.groups.forEach((g) => {
        const grs = salesLastRows.filter((r) => r.group === g.name);
        if (grs.length === 0) return;
        html += buildGroupRowHtml([
          { content: "", align: "center" }, { content: g.name, align: "left" },
          { content: fmtRp(grs.reduce((sum, r) => sum + r.value, 0)), align: "right" },
          { content: fmtNum(new Set(grs.map((r) => r.outletCode)).size), align: "right" },
        ], -1);
      });
    });
    html += `</tbody></table>`;
  }

  html += `</div>`;
  return html;
}

/* ----------------------------------------------------------------------------
   2) LAPORAN TABEL UTAMA (GAMBAR)
   Laporan eksekutif beresolusi tinggi dengan kartu ringkasan KPI, hierarki
   salesman & sub-brand, produk fokus, serta opsi data kalkulasi insentif.
---------------------------------------------------------------------------- */

function renderAchPill(ach) {
  if (ach === null || ach === undefined || Number.isNaN(ach)) {
    return `<span style="color:${PDF_COLORS.textMuted};font-size:12.5px;">-</span>`;
  }
  const color = getAchColor(ach, PDF_COLORS);
  return `<span style="display:inline-block;padding:2px 7px;border-radius:12px;font-size:11.5px;font-weight:700;color:${color};background:${color}1A;border:1px solid ${color}44;white-space:nowrap;">${fmtPct(ach)}</span>`;
}

function renderRatePill(rate) {
  if (!rate) {
    return `<span style="display:inline-block;padding:2px 6px;border-radius:10px;font-size:12px;font-weight:700;background:#F1F5F9;color:${PDF_COLORS.textMuted};border:1px solid #E2E8F0;">0%</span>`;
  }
  return `<span style="display:inline-block;padding:2px 6px;border-radius:10px;font-size:12px;font-weight:700;background:${PDF_COLORS.gold}1A;color:${PDF_COLORS.gold};border:1px solid ${PDF_COLORS.gold}44;">${rate}%*</span>`;
}

function renderTierBadge(tier) {
  if (!tier) return "";
  const tUpper = String(tier).toUpperCase();
  let label = "T1", color = PDF_COLORS.mint;
  if (tUpper === "VIOLET" || tUpper === "T3" || tUpper === "3") {
    label = "T3"; color = "#6366F1";
  } else if (tUpper === "AMBER" || tUpper === "T2" || tUpper === "2") {
    label = "T2"; color = PDF_COLORS.gold;
  }
  return `<span style="display:inline-block;margin-left:6px;padding:1px 5px;font-size:9px;font-weight:800;border-radius:4px;background:${color}18;color:${color};border:1px solid ${color}44;vertical-align:middle;">${label}</span>`;
}

export function buildExcelReportHTML(agg, targets, opts) {
  const { workDays, depotName, includeIncentives = false, rawRows = [] } = opts || {};
  const firstDateObj = dateStrToLocalDate(agg?.meta?.firstDate) || new Date();
  const lastDateObj = dateStrToLocalDate(agg?.meta?.lastDate) || new Date();
  const sdHariIni = Number(agg?.meta?.uniqueDays || 0);
  const sisaHk = Math.max(0, (workDays || 0) - sdHariIni);
  const timeGone = workDays ? sdHariIni / workDays : 0;
  const sisaTimePct = Math.max(0, 1 - timeGone);

  const fmtMonYY = (d) => `${MONTHS_ID[d.getMonth()]}-${String(d.getFullYear()).slice(2)}`;
  const fmtDMonYY = (d) => `${d.getDate()}-${MONTHS_ID[d.getMonth()]}-${String(d.getFullYear()).slice(2)}`;

  const salesList = agg?.bySales || [];

  // Totals calculations (ACH as ratio 0..1 to be consistent with fmtPct and getAchColor)
  const totalTargetV = salesList.reduce((acc, s) => acc + (s.targetValue || 0), 0);
  const totalTargetAo = salesList.reduce((acc, s) => acc + (s.targetAo || 0), 0);
  const totalRealV = salesList.reduce((acc, s) => acc + (s.realisasiValue || 0), 0);
  const totalRealAo = salesList.reduce((acc, s) => acc + (s.realisasiAo || 0), 0);
  const totalDeviasiV = totalTargetV - totalRealV;
  const totalDeviasiAo = totalTargetAo - totalRealAo;
  const totalAchV = totalTargetV > 0 ? (totalRealV / totalTargetV) : null;
  const totalAchAo = totalTargetAo > 0 ? (totalRealAo / totalTargetAo) : null;

  const fmtCompactRp = (num) => {
    if (!num) return "Rp 0";
    const abs = Math.abs(num);
    if (abs >= 1e9) return "Rp " + (num / 1e9).toFixed(2).replace(".", ",") + " Mly";
    if (abs >= 1e6) return "Rp " + (num / 1e6).toFixed(2).replace(".", ",") + " Jt";
    return fmtRp(num);
  };

  // Incentive calculations if enabled
  const commissionRules = includeIncentives ? getStoredCommissionRules(depotName || "default") : null;
  let totalDepoIncentive = 0;
  const salesCommissions = new Map();

  if (includeIncentives) {
    salesList.forEach((sm) => {
      const comm = calculateSingleSalesCommission(sm, commissionRules, rawRows);
      salesCommissions.set(sm.name, comm);
      totalDepoIncentive += (comm?.totalIncentive || 0);
    });
  }

  const containerWidth = includeIncentives ? 1380 : 1200;

  let html = `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;width:${containerWidth}px;background:#F8FAFC;padding:24px;box-sizing:border-box;color:#0F172A;">`;

  // Main Card Wrapper
  html += `<div style="background:#FFFFFF;border-radius:12px;border:1px solid #E2E8F0;box-shadow:0 4px 6px -1px rgba(0,0,0,0.05);padding:24px;">`;

  // 1. TOP HEADER & BRANDING
  html += `<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;padding-bottom:16px;border-bottom:1px solid #E2E8F0;">`;
  html += `<div style="display:flex;align-items:center;gap:14px;">`;
  html += `<div style="width:48px;height:48px;border-radius:10px;background:#F1F5F9;display:flex;align-items:center;justify-content:center;padding:6px;border:1px solid #E2E8F0;flex-shrink:0;">`;
  html += `<img src="${APP_LOGO_BASE64}" width="36" height="36" style="width:100%;height:100%;object-fit:contain;display:block;" alt="App Logo" />`;
  html += `</div>`;
  html += `<div>`;
  html += `<div style="font-size:20px;font-weight:800;color:#0F172A;letter-spacing:-0.02em;">${esc(depotName || "DEPO LOTIM")}</div>`;
  html += `<div style="font-size:12.5px;font-weight:600;color:#334155;letter-spacing:0.04em;text-transform:uppercase;">${includeIncentives ? "LAPORAN MONITORING PENCAPAIAN PENJUALAN & KALKULASI INSENTIF SALES" : "LAPORAN MONITORING PENCAPAIAN PENJUALAN SALES"}</div>`;
  html += `</div>`;
  html += `</div>`;

  html += `<div style="text-align:right;">`;
  html += `<div style="display:inline-flex;align-items:center;gap:6px;background:#F1F5F9;padding:6px 12px;border-radius:8px;border:1px solid #E2E8F0;font-size:11.5px;font-weight:600;color:#334155;">`;
  html += `<span>📅 Periode: <b>${esc(fmtMonYY(firstDateObj))}</b></span>`;
  html += `<span style="color:#CBD5E1;">•</span>`;
  html += `<span>Cut-off: <b>${esc(fmtDMonYY(lastDateObj))}</b></span>`;
  html += `</div>`;
  if (includeIncentives && commissionRules) {
    html += `<div style="font-size:12px;color:#334155;margin-top:4px;">Aturan Insentif: Standar FMCG Depo (Tier 1 ≥${commissionRules.tier1MinAch}%, T2 ≥${commissionRules.tier2MinAch}%, T3 ≥${commissionRules.tier3MinAch}%)</div>`;
  }
  html += `</div>`;
  html += `</div>`;

  // 2. EXECUTIVE KPI SUMMARY CARDS
  const cardCount = includeIncentives ? 5 : 4;
  html += `<div style="display:grid;grid-template-columns:repeat(${cardCount}, 1fr);gap:12px;margin-bottom:20px;">`;

  // Card 1: Hari Kerja
  html += `<div style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:10px;padding:12px 14px;">`;
  html += `<div style="font-size:11.5px;font-weight:700;color:#334155;text-transform:uppercase;letter-spacing:0.04em;margin-bottom:4px;">PROGRESS HARI KERJA</div>`;
  html += `<div style="font-size:16px;font-weight:800;color:#0F172A;">Hari ke-${sdHariIni} <span style="font-size:12px;font-weight:500;color:#334155;">/ ${workDays || 0} HK</span></div>`;
  html += `<div style="font-size:12px;font-weight:600;color:${PDF_COLORS.gold};margin-top:2px;">Time Gone ${fmtPct(timeGone)}</div>`;
  html += `</div>`;

  // Card 2: Sisa Waktu
  html += `<div style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:10px;padding:12px 14px;">`;
  html += `<div style="font-size:11.5px;font-weight:700;color:#334155;text-transform:uppercase;letter-spacing:0.04em;margin-bottom:4px;">SISA WAKTU KERJA</div>`;
  html += `<div style="font-size:16px;font-weight:800;color:#0F172A;">${sisaHk} Hari</div>`;
  html += `<div style="font-size:12px;color:${PDF_COLORS.textMuted};margin-top:2px;">${fmtPct(sisaTimePct)} periode tersisa</div>`;
  html += `</div>`;

  // Card 3: Realisasi Depo
  html += `<div style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:10px;padding:12px 14px;">`;
  html += `<div style="font-size:11.5px;font-weight:700;color:#334155;text-transform:uppercase;letter-spacing:0.04em;margin-bottom:4px;">TOTAL REALISASI DEPO</div>`;
  html += `<div style="font-size:16px;font-weight:800;color:${PDF_COLORS.mint};">${fmtCompactRp(totalRealV)}</div>`;
  html += `<div style="font-size:12px;font-weight:600;color:${PDF_COLORS.mint};margin-top:2px;">Pencapaian ${fmtPct(totalAchV)} <span style="font-weight:normal;color:${PDF_COLORS.textMuted};">• ${fmtNum(totalRealAo)} AO</span></div>`;
  html += `</div>`;

  // Card 4: Target Bulanan
  html += `<div style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:10px;padding:12px 14px;">`;
  html += `<div style="font-size:11.5px;font-weight:700;color:#334155;text-transform:uppercase;letter-spacing:0.04em;margin-bottom:4px;">TARGET BULANAN DEPO</div>`;
  html += `<div style="font-size:16px;font-weight:800;color:#0F172A;">${fmtCompactRp(totalTargetV)}</div>`;
  html += `<div style="font-size:12px;color:#334155;margin-top:2px;">Sisa Target: ${fmtCompactRp(totalDeviasiV)}</div>`;
  html += `</div>`;

  // Card 5: Estimasi Insentif (Optional)
  if (includeIncentives) {
    html += `<div style="background:#ECFDF5;border:1px solid #A7F3D0;border-radius:10px;padding:12px 14px;">`;
    html += `<div style="font-size:11.5px;font-weight:700;color:#065F46;text-transform:uppercase;letter-spacing:0.04em;margin-bottom:4px;">ESTIMASI INSENTIF DEPO</div>`;
    html += `<div style="font-size:16px;font-weight:800;color:#047857;">${fmtRp(totalDepoIncentive)}*</div>`;
    html += `<div style="font-size:12px;font-weight:600;color:#059669;margin-top:2px;">Kalkulasi Berjalan Depo</div>`;
    html += `</div>`;
  }

  html += `</div>`; // End KPI Grid

  // 3. MAIN DATA TABLE
  html += `<table style="width:100%;border-collapse:collapse;font-size:12.5px;border:1px solid #CBD5E1;">`;
  html += `<thead>`;

  // Header Row 1
  html += `<tr style="color:#FFFFFF;text-align:center;">`;
  html += `<th rowspan="2" style="background:#0F172A;width:36px;padding:8px 4px;font-weight:700;border:1px solid #334155;font-size:11.5px;vertical-align:middle;line-height:1.2;">NO</th>`;
  html += `<th rowspan="2" style="background:#0F172A;padding:8px 8px;font-weight:700;border:1px solid #334155;text-align:center;font-size:12px;min-width:140px;vertical-align:middle;line-height:1.2;">SALESMAN</th>`;
  html += `<th colspan="2" style="background:#0F172A;padding:6px;font-weight:700;border:1px solid #334155;font-size:11.5px;letter-spacing:0.03em;">TARGET</th>`;
  html += `<th colspan="2" style="background:#0F172A;padding:6px;font-weight:700;border:1px solid #334155;font-size:11.5px;letter-spacing:0.03em;">REALISASI</th>`;
  html += `<th colspan="2" style="background:#0F172A;padding:6px;font-weight:700;border:1px solid #334155;font-size:11.5px;letter-spacing:0.03em;">ACH</th>`;
  html += `<th colspan="2" style="background:#0F172A;padding:6px;font-weight:700;border:1px solid #334155;font-size:11.5px;letter-spacing:0.03em;">DEVIASI</th>`;
  html += `<th colspan="4" style="background:#1E3A8A;padding:6px;font-weight:700;border:1px solid #3B82F6;font-size:11.5px;letter-spacing:0.03em;">PRODUK FOKUS</th>`;
  if (includeIncentives) {
    html += `<th colspan="3" style="background:#064E3B;padding:6px;font-weight:700;border:1px solid #059669;font-size:11.5px;letter-spacing:0.03em;">ESTIMASI INSENTIF</th>`;
  }
  html += `</tr>`;

  // Header Row 2
  html += `<tr style="color:#CBD5E1;font-size:12px;text-align:center;">`;
  html += `<th style="background:#1E293B;padding:5px 6px;border:1px solid #334155;width:90px;">VALUE</th>`;
  html += `<th style="background:#1E293B;padding:5px 4px;border:1px solid #334155;width:34px;">AO</th>`;
  html += `<th style="background:#1E293B;padding:5px 6px;border:1px solid #334155;width:90px;">VALUE</th>`;
  html += `<th style="background:#1E293B;padding:5px 4px;border:1px solid #334155;width:34px;">AO</th>`;
  html += `<th style="background:#1E293B;padding:5px 4px;border:1px solid #334155;width:55px;">VALUE</th>`;
  html += `<th style="background:#1E293B;padding:5px 4px;border:1px solid #334155;width:50px;">AO</th>`;
  html += `<th style="background:#1E293B;padding:5px 6px;border:1px solid #334155;width:90px;">VALUE</th>`;
  html += `<th style="background:#1E293B;padding:5px 4px;border:1px solid #334155;width:34px;">AO</th>`;

  // Focus headers
  html += `<th style="background:#1E3A8A;color:#DBEAFE;padding:5px 6px;border:1px solid #3B82F6;text-align:left;width:120px;">NAMA PRODUK</th>`;
  html += `<th style="background:#1E3A8A;color:#DBEAFE;padding:5px 4px;border:1px solid #3B82F6;width:42px;">TARGET</th>`;
  html += `<th style="background:#1E3A8A;color:#DBEAFE;padding:5px 4px;border:1px solid #3B82F6;width:42px;">REAL</th>`;
  html += `<th style="background:#1E3A8A;color:#DBEAFE;padding:5px 4px;border:1px solid #3B82F6;width:46px;">%</th>`;

  // Incentive headers
  if (includeIncentives) {
    html += `<th style="background:#064E3B;color:#A7F3D0;padding:5px 4px;border:1px solid #059669;width:52px;">RATE</th>`;
    html += `<th style="background:#064E3B;color:#A7F3D0;padding:5px 6px;border:1px solid #059669;width:95px;">KOMISI OMSET</th>`;
    html += `<th style="background:#064E3B;color:#A7F3D0;padding:5px 6px;border:1px solid #059669;width:95px;">TOTAL ESTIMASI</th>`;
  }
  html += `</tr>`;
  html += `</thead><tbody>`;

  // Salesmen Rows
  salesList.forEach((sm, idx) => {
    const groups = sm.groups || [];
    const focusList = sm.focus || [];
    const maxSub = Math.max(groups.length, focusList.length, 1);
    const totalRows = 1 + maxSub;
    const comm = salesCommissions.get(sm.name);
    const rowBg = idx % 2 === 0 ? "#FFFFFF" : "#F8FAFC";

    // 1. SALESMAN SUMMARY ROW (Row 0)
    html += `<tr style="border-top:1px solid #94A3B8;">`;
    // NO column: centered horizontally and vertically across the salesman block
    html += `<td rowspan="${totalRows}" style="text-align:center;vertical-align:middle;font-weight:800;color:#0F172A;border:1px solid #CBD5E1;background:${rowBg};padding:6px 4px;font-size:12.5px;">${idx + 1}</td>`;
    html += `<td style="padding:6px 8px;font-weight:800;color:#0F172A;border:1px solid #E2E8F0;background:${rowBg};white-space:nowrap;">`;
    html += `<span style="display:inline-block;width:3px;height:12px;background:#059669;border-radius:2px;margin-right:6px;vertical-align:middle;"></span>`;
    html += `${esc(sm.name)} ${renderTierBadge(sm.tier)}`;
    html += `</td>`;

    html += `<td style="padding:6px 7px;text-align:right;font-weight:800;border:1px solid #E2E8F0;background:${rowBg};white-space:nowrap;">${fmtRp(sm.targetValue)}</td>`;
    html += `<td style="padding:6px 4px;text-align:center;font-weight:800;border:1px solid #E2E8F0;background:${rowBg};">${fmtNum(sm.targetAo)}</td>`;
    html += `<td style="padding:6px 7px;text-align:right;font-weight:800;color:#059669;border:1px solid #E2E8F0;background:${rowBg};white-space:nowrap;">${fmtRp(sm.realisasiValue)}</td>`;
    html += `<td style="padding:6px 4px;text-align:center;font-weight:800;border:1px solid #E2E8F0;background:${rowBg};">${fmtNum(sm.realisasiAo)}</td>`;
    html += `<td style="padding:6px 4px;text-align:center;border:1px solid #E2E8F0;background:${rowBg};">${renderAchPill(sm.ach)}</td>`;
    html += `<td style="padding:6px 4px;text-align:center;border:1px solid #E2E8F0;background:${rowBg};">${renderAchPill(sm.achAo)}</td>`;
    html += `<td style="padding:6px 7px;text-align:right;font-weight:700;color:${pdfDeviasiTextColor(sm.deviasiValue)};border:1px solid #E2E8F0;background:${rowBg};white-space:nowrap;">${fmtDeviasi(sm.deviasiValue)}</td>`;
    html += `<td style="padding:6px 4px;text-align:center;color:${pdfDeviasiTextColor(sm.deviasiAo)};font-weight:700;border:1px solid #E2E8F0;background:${rowBg};">${fmtDeviasiAo(sm.deviasiAo)}</td>`;

    // Focus product col in Row 0
    if (focusList.length === 0) {
      html += `<td colspan="4" rowspan="${totalRows}" style="padding:6px;text-align:center;vertical-align:middle;color:#1E293B;font-size:12px;font-style:italic;border:1px solid #E2E8F0;background:#FAFAFA;white-space:nowrap;">— Tidak ada target fokus —</td>`;
    } else {
      html += `<td colspan="4" style="padding:5px 6px;text-align:center;font-weight:700;font-size:12px;color:#1E40AF;background:#EFF6FF;border:1px solid #BFDBFE;white-space:nowrap;">🎯 TARGET PRODUK FOKUS (${focusList.length} SKU)</td>`;
    }

    // Incentive cols in Row 0
    if (includeIncentives) {
      html += `<td rowspan="${totalRows}" style="padding:6px 4px;text-align:center;vertical-align:middle;border:1px solid #E2E8F0;background:${rowBg};">${renderRatePill(comm?.appliedRatePct)}</td>`;
      html += `<td rowspan="${totalRows}" style="padding:6px 7px;text-align:right;vertical-align:middle;font-weight:700;color:#0F172A;border:1px solid #E2E8F0;background:${rowBg};white-space:nowrap;">${fmtRp(comm?.valueCommission || 0)}*</td>`;
      html += `<td rowspan="${totalRows}" style="padding:6px 7px;text-align:right;vertical-align:middle;font-weight:800;color:#059669;border:1px solid #E2E8F0;background:${rowBg};white-space:nowrap;">${fmtRp(comm?.totalIncentive || 0)}*</td>`;
    }
    html += `</tr>`;

    // 2. SUBROWS: ALL PRODUCT GROUPS (i from 0 to maxSub - 1) & FOCUS ITEMS
    for (let i = 0; i < maxSub; i++) {
      const isLast = i === maxSub - 1;

      html += `<tr style="${isLast ? 'border-bottom:1px solid #CBD5E1;' : ''}">`;
      // NO column already spanned by Row 0 td[rowspan]

      if (i < groups.length) {
        const g = groups[i];
        html += `<td style="padding:4px 8px 4px 18px;font-size:11.5px;color:#1E293B;border:1px solid #E2E8F0;background:${rowBg};white-space:nowrap;">↳ ${esc(g.name)}</td>`;
        html += `<td style="padding:4px 7px;text-align:right;font-size:11.5px;color:#334155;border:1px solid #E2E8F0;background:${rowBg};white-space:nowrap;">${fmtRp(g.targetValue)}</td>`;
        html += `<td style="padding:4px 4px;text-align:center;font-size:11.5px;color:#334155;border:1px solid #E2E8F0;background:${rowBg};">${fmtNum(g.targetAo)}</td>`;
        html += `<td style="padding:4px 7px;text-align:right;font-size:11.5px;color:#0F172A;border:1px solid #E2E8F0;background:${rowBg};white-space:nowrap;">${fmtRp(g.realisasiValue)}</td>`;
        html += `<td style="padding:4px 4px;text-align:center;font-size:11.5px;color:#0F172A;border:1px solid #E2E8F0;background:${rowBg};">${fmtNum(g.realisasiAo)}</td>`;
        html += `<td style="padding:4px 4px;text-align:center;border:1px solid #E2E8F0;background:${rowBg};">${renderAchPill(g.ach)}</td>`;
        html += `<td style="padding:4px 4px;text-align:center;border:1px solid #E2E8F0;background:${rowBg};">${renderAchPill(g.achAo)}</td>`;
        html += `<td style="padding:4px 7px;text-align:right;font-size:11.5px;color:${pdfDeviasiTextColor(g.deviasiValue)};border:1px solid #E2E8F0;background:${rowBg};white-space:nowrap;">${fmtDeviasi(g.deviasiValue)}</td>`;
        html += `<td style="padding:4px 4px;text-align:center;font-size:11.5px;color:${pdfDeviasiTextColor(g.deviasiAo)};border:1px solid #E2E8F0;background:${rowBg};">${fmtDeviasiAo(g.deviasiAo)}</td>`;
      } else {
        for (let c = 0; c < 9; c++) {
          html += `<td style="border:1px solid #E2E8F0;background:${rowBg};"></td>`;
        }
      }

      // Focus product column for subrow i (only if salesman has focus items, otherwise spanned by Row 0)
      if (focusList.length > 0) {
        if (i < focusList.length) {
          const fi = focusList[i];
          html += `<td style="padding:4px 6px;border:1px solid #E2E8F0;font-size:11.5px;color:#334155;background:${rowBg};white-space:nowrap;">${esc(fi.hasUnconvertible ? `${fi.name} *` : fi.name)}</td>`;
          html += `<td style="padding:4px 4px;text-align:center;border:1px solid #E2E8F0;font-size:11.5px;background:${rowBg};">${fmtNum(fi.target)}</td>`;
          html += `<td style="padding:4px 4px;text-align:center;border:1px solid #E2E8F0;font-size:11.5px;font-weight:600;background:${rowBg};">${fmtNum(fi.realisasi)}</td>`;
          html += `<td style="padding:4px 4px;text-align:center;border:1px solid #E2E8F0;background:${rowBg};">${renderAchPill(fi.pct)}</td>`;
        } else {
          for (let c = 0; c < 4; c++) {
            html += `<td style="border:1px solid #E2E8F0;background:${rowBg};"></td>`;
          }
        }
      }

      html += `</tr>`;
    }
  });

  // 4. TOTAL FOOTER ROW
  html += `</tbody><tfoot>`;
  html += `<tr style="background:#0F172A;color:#FFFFFF;font-weight:800;border:1px solid #0F172A;">`;
  html += `<td colspan="2" style="padding:9px 10px;text-align:left;font-size:12.5px;letter-spacing:0.04em;border:1px solid #334155;">TOTAL PENCAPAIAN DEPO</td>`;
  html += `<td style="padding:9px 7px;text-align:right;border:1px solid #334155;white-space:nowrap;">${fmtRp(totalTargetV)}</td>`;
  html += `<td style="padding:9px 4px;text-align:center;border:1px solid #334155;">${fmtNum(totalTargetAo)}</td>`;
  html += `<td style="padding:9px 7px;text-align:right;color:#34D399;border:1px solid #334155;white-space:nowrap;">${fmtRp(totalRealV)}</td>`;
  html += `<td style="padding:9px 4px;text-align:center;color:#34D399;border:1px solid #334155;">${fmtNum(totalRealAo)}</td>`;
  html += `<td style="padding:9px 4px;text-align:center;border:1px solid #334155;">${renderAchPill(totalAchV)}</td>`;
  html += `<td style="padding:9px 4px;text-align:center;border:1px solid #334155;">${renderAchPill(totalAchAo)}</td>`;
  html += `<td style="padding:9px 7px;text-align:right;color:${pdfDeviasiTextColor(totalDeviasiV)};border:1px solid #334155;white-space:nowrap;">${fmtDeviasi(totalDeviasiV)}</td>`;
  html += `<td style="padding:9px 4px;text-align:center;color:${pdfDeviasiTextColor(totalDeviasiAo)};border:1px solid #334155;">${fmtDeviasiAo(totalDeviasiAo)}</td>`;
  html += `<td colspan="4" style="padding:9px 8px;text-align:center;font-size:12px;color:#E5E7EB;font-weight:500;border:1px solid #334155;">* Kuantitas produk fokus mengikuti satuan target</td>`;

  if (includeIncentives) {
    html += `<td colspan="3" style="padding:9px 10px;text-align:right;color:#34D399;font-size:12.5px;font-weight:800;border:1px solid #059669;white-space:nowrap;">${fmtRp(totalDepoIncentive)}*</td>`;
  }
  html += `</tr>`;
  html += `</tfoot></table>`;

  // 5. FOOTER NOTES
  html += `<div style="display:flex;align-items:flex-start;justify-content:space-between;margin-top:14px;padding-top:10px;border-top:1px solid #E2E8F0;font-size:12px;color:#334155;">`;
  html += `<div>`;
  if (includeIncentives) {
    html += `<div>💡 <b>Catatan Insentif:</b> Angka bertanda (*) adalah estimasi proyeksi/kalkulasi insentif berdasarkan target & aturan komisi berjalan depo.</div>`;
  }
  const anyUnconvertible = salesList.some((sm) => (sm.focus || []).some((f) => f.hasUnconvertible));
  if (anyUnconvertible) {
    html += `<div style="margin-top:2px;">⚠️ <b>Produk Fokus:</b> Sebagian transaksi tidak memiliki satuan karton di data mentah sehingga memakai satuan asli.</div>`;
  }
  html += `</div>`;
  html += `<div style="text-align:right;flex-shrink:0;">`;
  html += `<div style="font-weight:600;color:#334155;">Dibuat otomatis oleh Monitoring Penjualan — ${esc(formatGeneratedAt())}</div>`;
  html += `<div style="font-size:12px;color:#1E293B;margin-top:2px;">Monitoring Penjualan Sales • Versi 4.4.2</div>`;
  html += `</div>`;
  html += `</div>`;

  html += `</div>`; // End Main Card
  html += `</div>`; // End Wrapper
  return html;
}

