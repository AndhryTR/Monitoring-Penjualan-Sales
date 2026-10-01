import { fmtRp, fmtNum, fmtPct, fmtCompactRp, formatDateID, esc } from "./formatters.js";
import { getLastDaySalesMap } from "./aggregation.js";
import { getAchColor } from "../constants/thresholds.js";
import { APP_LOGO_BASE64 } from "./exportLogo.js";

export { getAchColor };

/* ============================================================================
   DAILY REPORT GENERATOR (Fitur B3)
   1. Generator Teks Ringkas WhatsApp (WhatsApp-friendly markdown)
   2. Template HTML Kartu Grafis Ringkas (PNG via html2canvas)
   ============================================================================ */

export { fmtCompactRp };

export function formatIDDate(dateStr, short = false) {
  return formatDateID(dateStr, { short });
}

/**
 * Truncate long names cleanly
 */
function truncateName(str, max = 22) {
  if (!str) return "";
  const s = String(str).trim();
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

/**
 * Generate formatted WhatsApp message text
 */
export function buildDailyReportText({
  agg,
  targets,
  workDays = 26,
  depotName = "",
  options = {},
  smartAlerts = [],
}) {
  if (!agg || !agg.filteredRows || !agg.filteredRows.length) {
    return "Belum ada data transaksi untuk membuat laporan harian.";
  }

  const {
    topSalesCount = 3,
    includeAttention = true,
    attentionCount = 4,
    includeCategories = true,
    includeAo = false,
    includeLastDaySales = false,
    customNote = "",
  } = options;

  const depot = depotName ? String(depotName).trim().toUpperCase() : "SEMUA DEPO";
  const lastDate = agg.meta?.lastDate;
  const dateFormatted = formatIDDate(lastDate, false);
  const uniqueDays = agg.meta?.uniqueDays || 0;
  const totalWorkDays = workDays || 26;
  const timePct = totalWorkDays > 0 ? (uniqueDays / totalWorkDays) : 0;

  const totalTargetValue = targets?.totalValue || agg.totals?.targetValue || 0;
  const totalRealisasiValue = agg.totals?.realisasiValue || 0;
  const totalAch = totalTargetValue > 0 ? (totalRealisasiValue / totalTargetValue) : (agg.totals?.ach || 0);

  const sisaTarget = Math.max(0, totalTargetValue - totalRealisasiValue);
  const sisaHari = Math.max(0, totalWorkDays - uniqueDays);
  const runRatePerDay = uniqueDays > 0 ? totalRealisasiValue / uniqueDays : 0;
  const neededPerDay = sisaHari > 0 && sisaTarget > 0 ? sisaTarget / sisaHari : 0;

  const paceDiff = (totalAch - timePct) * 100;
  let paceStatus = "";
  if (paceDiff >= 2) {
    paceStatus = `+${paceDiff.toFixed(1)}% Di Atas Pace 🚀 (On Track)`;
  } else if (paceDiff <= -2) {
    paceStatus = `${paceDiff.toFixed(1)}% Di Bawah Pace ⚠️ (Perlu Kejar)`;
  } else {
    paceStatus = `Sesuai Pace ✨ (On Track)`;
  }

  const lines = [];

  // 1. Header
  lines.push("📊 *UPDATE PENJUALAN HARIAN*");
  lines.push(`🏢 Depo: *${depot}*`);
  lines.push(`📅 Data: *${dateFormatted}*`);
  lines.push(`⏱️ Progress Waktu: *Hari ke-${uniqueDays} dari ${totalWorkDays}* (${fmtPct(timePct)})`);
  lines.push("");

  // 2. Progress Target
  lines.push("━━━━━━━━━━━━━━━━━━━━━");
  lines.push("🎯 *PROGRESS TARGET BULANAN*");
  lines.push(`• Realisasi: *${fmtRp(totalRealisasiValue)}* (${fmtCompactRp(totalRealisasiValue)})`);
  if (includeAo && agg.totals?.realisasiAo !== undefined) {
    lines.push(`• Toko Aktif (AO): *${fmtNum(agg.totals.realisasiAo)} Outlet*`);
  }
  lines.push(`• Target: *${fmtRp(totalTargetValue)}* (${fmtCompactRp(totalTargetValue)})`);
  lines.push(`• Pencapaian (ACH): *${fmtPct(totalAch)}*`);
  lines.push(`• Ritme Kerja: *${paceStatus}*`);
  if (runRatePerDay > 0) {
    lines.push(`• Run-rate Rata-rata: *${fmtCompactRp(runRatePerDay)}/hari*`);
  }
  if (sisaTarget > 0 && sisaHari > 0) {
    lines.push(`• Target Sisa: *${fmtCompactRp(neededPerDay)}/hari* (${sisaHari} hari kerja tersisa)`);
  } else if (sisaTarget <= 0 && totalTargetValue > 0) {
    lines.push(`• Target Sisa: *LUNAS / TARGET TERCAPAI! 🎉*`);
  }
  lines.push("");

  // 3. Top Sales Leaderboard
  const salesList = [...(agg.bySales || [])];
  salesList.sort((a, b) => (b.ach || 0) - (a.ach || 0) || (b.realisasiValue || 0) - (a.realisasiValue || 0));

  const medals = ["🥇", "🥈", "🥉"];
  const count = topSalesCount === "all" ? salesList.length : Number(topSalesCount);
  const topSales = salesList.slice(0, count);

  if (topSales.length > 0) {
    lines.push("━━━━━━━━━━━━━━━━━━━━━");
    lines.push(`🏆 *LEADERBOARD SALES (${topSalesCount === "all" ? "SEMUA" : `TOP ${count}`})*`);
    topSales.forEach((s, idx) => {
      const badge = medals[idx] || `${idx + 1}.`;
      let line = `${badge} *${s.name}* — *${fmtPct(s.ach)}* (${fmtCompactRp(s.realisasiValue)}`;
      if (s.targetValue > 0) {
        line += ` / Tgt ${fmtCompactRp(s.targetValue)}`;
      }
      line += `)`;
      if (includeAo && s.realisasiAo) {
        line += ` • ${s.realisasiAo} AO`;
      }
      lines.push(line);
    });
    lines.push("");
  }

  // 4. Penjualan Hari Terakhir (Semua Sales) — jika opsi diaktifkan
  if (includeLastDaySales && agg.filteredRows && lastDate) {
    const lastDateRows = agg.filteredRows.filter((r) => r.date === lastDate);
    const totalLastDayValue = lastDateRows.reduce((sum, r) => sum + (r.value || 0), 0);
    const totalLastDayAo = new Set(lastDateRows.map((r) => r.outletCode).filter(Boolean)).size;
    const lastDayMap = getLastDaySalesMap(agg.filteredRows, lastDate);

    const allSalesLastDay = [...(agg.bySales || [])]
      .map((s) => ({
        name: s.name,
        valueLastDay: lastDayMap[s.code]?.valueLastDay || 0,
        aoLastDay: lastDayMap[s.code]?.aoLastDay || 0,
      }))
      .sort((a, b) => b.valueLastDay - a.valueLastDay || a.name.localeCompare(b.name));

    lines.push("━━━━━━━━━━━━━━━━━━━━━");
    lines.push(`⚡ *PENJUALAN HARI TERAKHIR (${dateFormatted})*`);
    lines.push(`• Total Hari Terakhir: *${fmtRp(totalLastDayValue)}* (${fmtCompactRp(totalLastDayValue)}) • *${totalLastDayAo} AO*`);
    allSalesLastDay.forEach((s, idx) => {
      const valStr = s.valueLastDay > 0 ? `+${fmtCompactRp(s.valueLastDay)}` : "-";
      const aoStr = `${s.aoLastDay} AO`;
      const statusIcon = s.valueLastDay > 0 ? "🟢" : "⚪";
      lines.push(`${idx + 1}. ${statusIcon} *${s.name}*: ${valStr} (${aoStr})`);
    });
    lines.push("");
  }

  // 5. Perlu Perhatian (Action Needed)
  if (includeAttention) {
    const attentionItems = [];
    const attentionLimit = attentionCount === "all" ? 999 : Number(attentionCount || 4);

    // Prioritas 1: Critical / Warning dari Smart Alerts (kecualikan isu teknis kualitas data)
    if (smartAlerts && smartAlerts.length > 0) {
      smartAlerts
        .filter((a) =>
          (a.level === "critical" || a.level === "warning") &&
          a.category !== "data_quality" &&
          a.targetTab !== "quality" &&
          !String(a.id || "").includes("data-quality")
        )
        .slice(0, attentionLimit)
        .forEach((a) => {
          attentionItems.push(`• ${a.level === "critical" ? "🚨" : "⚠️"} *${a.title}*: ${a.message || a.desc}`);
        });
    }

    // Prioritas 2: Fallback jika belum mencapai kuota limit dan ada sales lagging pace
    if (attentionItems.length < attentionLimit && salesList.length > 0) {
      const laggingSales = salesList
        .filter((s) => s.targetValue > 0 && (timePct - (s.ach || 0)) >= 0.15)
        .sort((a, b) => (a.ach || 0) - (b.ach || 0));

      for (const s of laggingSales) {
        if (attentionItems.length >= attentionLimit) break;
        const exists = attentionItems.some((item) => item.includes(s.name));
        if (!exists) {
          const gap = ((timePct - (s.ach || 0)) * 100).toFixed(1);
          attentionItems.push(`• ⚠️ *${s.name}*: Tertinggal -${gap}% dari pace (ACH ${fmtPct(s.ach)})`);
        }
      }
    }

    if (attentionItems.length > 0) {
      lines.push("━━━━━━━━━━━━━━━━━━━━━");
      lines.push("⚠️ *PERLU PERHATIAN & TINDAKAN*");
      attentionItems.forEach((item) => lines.push(item));
      lines.push("");
    }
  }

  // 6. Rekap Kategori Produk
  if (includeCategories && agg.byGroup && agg.byGroup.length > 0) {
    const groupsSorted = [...agg.byGroup]
      .sort((a, b) => (b.realisasiValue || 0) - (a.realisasiValue || 0))
      .slice(0, 4);

    lines.push("━━━━━━━━━━━━━━━━━━━━━");
    lines.push("📦 *KONTRIBUSI KATEGORI PRODUK*");
    groupsSorted.forEach((g) => {
      const sharePct = totalRealisasiValue > 0 ? (g.realisasiValue / totalRealisasiValue) : 0;
      let gLine = `• *${g.name}*: ${fmtCompactRp(g.realisasiValue)} (${fmtPct(sharePct)}`;
      if (g.targetValue > 0) {
        gLine += `, ACH ${fmtPct(g.ach)}`;
      }
      gLine += `)`;
      lines.push(gLine);
    });
    lines.push("");
  }

  // 7. Catatan Supervisor (jika ada)
  if (customNote && customNote.trim()) {
    lines.push("━━━━━━━━━━━━━━━━━━━━━");
    lines.push("💬 *CATATAN SUPERVISOR*");
    lines.push(`"${customNote.trim()}"`);
    lines.push("");
  }

  // 8. Footer
  lines.push("━━━━━━━━━━━━━━━━━━━━━");
  lines.push("💡 _Generated otomatis via Monitoring Penjualan Sales_");
  lines.push("#MonitoringSales #DailyUpdate #SemangatJualan");

  return lines.join("\n");
}


/**
 * Membangun template HTML kartu grafis mini beresolusi tinggi untuk di-render oleh html2canvas.
 * Mendukung opsi topSalesCount (3, 5, "all") dan opsi includeLastDaySales (side-by-side 2-kolom).
 */
export function buildDailyReportCardHTML({
  agg,
  targets,
  workDays = 26,
  depotName = "",
  options = {},
  smartAlerts = [],
  isDark = true,
}) {
  const depot = depotName ? String(depotName).trim().toUpperCase() : "SEMUA DEPO";
  const lastDate = agg.meta?.lastDate;
  const dateFormatted = formatIDDate(lastDate, false);
  const uniqueDays = agg.meta?.uniqueDays || 0;
  const totalWorkDays = workDays || 26;
  const timePct = totalWorkDays > 0 ? (uniqueDays / totalWorkDays) : 0;

  const totalTargetValue = targets?.totalValue || agg.totals?.targetValue || 0;
  const totalRealisasiValue = agg.totals?.realisasiValue || 0;
  const totalAch = totalTargetValue > 0 ? (totalRealisasiValue / totalTargetValue) : (agg.totals?.ach || 0);
  const achCapped = Math.min(100, Math.round(totalAch * 100));

  const sisaTarget = Math.max(0, totalTargetValue - totalRealisasiValue);
  const sisaHari = Math.max(0, totalWorkDays - uniqueDays);
  const runRatePerDay = uniqueDays > 0 ? totalRealisasiValue / uniqueDays : 0;

  const paceDiff = (totalAch - timePct) * 100;
  const isAhead = paceDiff >= 0;

  // Tema warna visual
  const c = isDark ? {
    bg: "#0B0F19",
    bgCard: "#111827",
    bgCardSubtle: "#1F2937",
    text: "#F9FAFB",
    textMuted: "#9CA3AF",
    border: "#374151",
    gold: "#F59E0B",
    coral: "#EF4444",
    mint: "#10B981",
    blue: "#3B82F6",
    badgeBg: "rgba(255,255,255,0.06)",
  } : {
    bg: "#F8FAFC",
    bgCard: "#FFFFFF",
    bgCardSubtle: "#F1F5F9",
    text: "#0F172A",
    textMuted: "#64748B",
    border: "#E2E8F0",
    gold: "#D97706",
    coral: "#DC2626",
    mint: "#059669",
    blue: "#2563EB",
    badgeBg: "rgba(0,0,0,0.05)",
  };

  // 1. Leaderboard Sales (Merespons opsi topSalesCount: 3, 5, atau all)
  const salesList = [...(agg.bySales || [])];
  salesList.sort((a, b) => (b.ach || 0) - (a.ach || 0) || (b.realisasiValue || 0) - (a.realisasiValue || 0));

  const topSalesCount = options.topSalesCount || 3;
  const count = topSalesCount === "all" ? salesList.length : Number(topSalesCount);
  const topSales = salesList.slice(0, count);
  const topLabel = topSalesCount === "all" ? `Semua Sales (${salesList.length})` : `Top ${count} Sales`;

  // 2. Data Penjualan Hari Terakhir (Value & AO untuk Semua Sales)
  const lastDayMap = getLastDaySalesMap(agg.filteredRows, lastDate);
  const lastDateRows = (agg.filteredRows || []).filter((r) => r.date === lastDate);
  const totalLastDayValue = lastDateRows.reduce((sum, r) => sum + (r.value || 0), 0);
  const totalLastDayAo = new Set(lastDateRows.map((r) => r.outletCode).filter(Boolean)).size;

  const allSalesLastDay = [...(agg.bySales || [])]
    .map((s) => ({
      code: s.code,
      name: s.name,
      valueLastDay: lastDayMap[s.code]?.valueLastDay || 0,
      aoLastDay: lastDayMap[s.code]?.aoLastDay || 0,
      realisasiValue: s.realisasiValue || 0,
      ach: s.ach || 0,
    }))
    .sort((a, b) => b.valueLastDay - a.valueLastDay || a.name.localeCompare(b.name));

  const medals = ["🥇", "🥈", "🥉"];
  const renderRankBadge = (idx) => {
    if (idx < 3) {
      return `<span style="font-size:15px;line-height:1;display:inline-block;width:20px;text-align:center;">${medals[idx]}</span>`;
    }
    return `<span style="font-size:11px;font-weight:700;color:${c.textMuted};width:20px;display:inline-block;text-align:center;">${idx + 1}.</span>`;
  };

  // Attention alerts
  const attentionItems = [];
  if (options.includeAttention !== false) {
    const attentionCount = options.attentionCount || 4;
    const attentionLimit = attentionCount === "all" ? 999 : Number(attentionCount);

    if (smartAlerts && smartAlerts.length > 0) {
      smartAlerts
        .filter((a) =>
          (a.level === "critical" || a.level === "warning") &&
          a.category !== "data_quality" &&
          a.targetTab !== "quality" &&
          !String(a.id || "").includes("data-quality")
        )
        .slice(0, attentionLimit)
        .forEach((a) => attentionItems.push({ level: a.level, title: a.title, desc: a.message || a.desc }));
    }
    if (attentionItems.length < attentionLimit && salesList.length > 0) {
      const laggingSales = salesList
        .filter((s) => s.targetValue > 0 && (timePct - (s.ach || 0)) >= 0.15)
        .sort((a, b) => (a.ach || 0) - (b.ach || 0));

      for (const lagging of laggingSales) {
        if (attentionItems.length >= attentionLimit) break;
        const exists = attentionItems.some((item) => item.title?.includes(lagging.name) || item.desc?.includes(lagging.name));
        if (!exists) {
          attentionItems.push({
            level: "warning",
            title: `Tertinggal Pace: ${lagging.name}`,
            desc: `ACH ${fmtPct(lagging.ach)} (tertinggal dari waktu ${fmtPct(timePct)})`,
          });
        }
      }
    }
  }

  // Jika opsi Hari Terakhir aktif: kartu diperlebar menjadi 760px dan memakai layout 2 kolom berdampingan
  const includeLastDay = !!options.includeLastDaySales;
  const cardWidth = includeLastDay ? 760 : 640;

  return `
  <div style="width:${cardWidth}px;background:${c.bg};padding:24px;box-sizing:border-box;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:${c.text};border-radius:20px;line-height:1.4;">
    
    <!-- Top Brand & Header -->
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:18px;padding-bottom:14px;border-bottom:1px solid ${c.border};">
      <div style="display:flex;align-items:center;gap:12px;">
        <div style="width:40px;height:40px;border-radius:10px;background:${c.bgCardSubtle};border:1px solid ${c.border};display:flex;align-items:center;justify-content:center;flex-shrink:0;padding:2px;box-sizing:border-box;">
          <img src="${APP_LOGO_BASE64}" width="36" height="36" style="width:100%;height:100%;object-fit:contain;display:block;" alt="Logo" />
        </div>
        <div>
          <div style="font-size:16px;font-weight:800;letter-spacing:-0.02em;color:${c.text};">UPDATE PENJUALAN HARIAN</div>
          <div style="font-size:11px;font-weight:600;color:${c.gold};margin-top:2px;">DEPO: ${esc(depot)}</div>
        </div>
      </div>
      <div style="text-align:right;">
        <div style="font-size:11px;font-weight:700;color:${c.text};">${esc(dateFormatted)}</div>
        <div style="font-size:10px;color:${c.textMuted};margin-top:2px;">Hari ke-${uniqueDays} dari ${totalWorkDays} (${fmtPct(timePct)})</div>
      </div>
    </div>

    <!-- Main KPI Cards (3 Grid) -->
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:16px;">
      
      <!-- Card 1: Realisasi -->
      <div style="background:${c.bgCard};border:1px solid ${c.border};border-radius:14px;padding:12px;">
        <div style="font-size:10px;font-weight:600;text-transform:uppercase;color:${c.textMuted};">Total Realisasi</div>
        <div style="font-size:16px;font-weight:800;color:${c.mint};margin:4px 0 2px;">${esc(fmtCompactRp(totalRealisasiValue))}</div>
        <div style="font-size:10px;color:${c.textMuted};">${esc(fmtRp(totalRealisasiValue))}</div>
      </div>

      <!-- Card 2: Target & ACH -->
      <div style="background:${c.bgCard};border:1px solid ${c.border};border-radius:14px;padding:12px;">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <span style="font-size:10px;font-weight:600;text-transform:uppercase;color:${c.textMuted};">Pencapaian</span>
          <span style="font-size:9px;font-weight:700;padding:2px 6px;border-radius:999px;background:${isAhead ? c.mint + "22" : c.coral + "22"};color:${isAhead ? c.mint : c.coral};">${isAhead ? "ON TRACK" : "BEHIND"}</span>
        </div>
        <div style="font-size:16px;font-weight:800;color:${getAchColor(totalAch, c)};margin:4px 0 2px;">${esc(fmtPct(totalAch))}</div>
        <div style="font-size:10px;color:${c.textMuted};">Target ${esc(fmtCompactRp(totalTargetValue))}</div>
      </div>

      <!-- Card 3: Ritme / Pace -->
      <div style="background:${c.bgCard};border:1px solid ${c.border};border-radius:14px;padding:12px;">
        <div style="font-size:10px;font-weight:600;text-transform:uppercase;color:${c.textMuted};">Ritme Kerja</div>
        <div style="font-size:16px;font-weight:800;color:${isAhead ? c.mint : c.coral};margin:4px 0 2px;">${isAhead ? "+" : ""}${paceDiff.toFixed(1)}%</div>
        <div style="font-size:10px;color:${c.textMuted};">${runRatePerDay > 0 ? `${esc(fmtCompactRp(runRatePerDay))}/hari` : "-"}</div>
      </div>

    </div>

    <!-- Progress Bar Target -->
    <div style="background:${c.bgCard};border:1px solid ${c.border};border-radius:12px;padding:10px 12px;margin-bottom:16px;">
      <div style="display:flex;justify-content:space-between;font-size:10.5px;font-weight:600;margin-bottom:6px;">
        <span style="color:${c.textMuted};">Kemajuan Target Penjualan</span>
        <span style="color:${c.text};"><span style="color:${getAchColor(totalAch, c)};font-weight:700;">${achCapped}%</span> (Sisa ${esc(fmtCompactRp(sisaTarget))} · ${sisaHari} HK tersisa)</span>
      </div>
      <div style="height:8px;background:${c.bgCardSubtle};border-radius:999px;overflow:hidden;position:relative;">
        <div style="height:100%;width:${achCapped}%;background:linear-gradient(90deg,${c.gold},${c.mint});border-radius:999px;"></div>
      </div>
    </div>

    ${includeLastDay ? `
    <!-- LAYOUT 2-KOLOM BERDAMPINGAN: LEADERBOARD (KIRI) & HARI TERAKHIR SEMUA SALES (KANAN) -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px;align-items:start;">
      
      <!-- Kolom Kiri: Leaderboard Sales (Pilihan Top 3, 5, atau Semua) -->
      <div style="background:${c.bgCard};border:1px solid ${c.border};border-radius:14px;padding:12px 14px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
          <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.04em;color:${c.gold};display:flex;align-items:center;gap:5px;">
            <span>🏆</span> ${esc(topLabel)}
          </div>
          <div style="font-size:9.5px;color:${c.textMuted};">Total Periode</div>
        </div>

        <div style="display:flex;flex-direction:column;gap:7px;">
          ${topSales.map((s, idx) => `
            <div style="display:flex;align-items:center;justify-content:space-between;background:${c.bgCardSubtle};padding:7px 10px;border-radius:9px;">
              <div style="display:flex;align-items:center;gap:8px;min-width:0;">
                ${renderRankBadge(idx)}
                <div style="min-width:0;">
                  <div style="font-size:11.5px;font-weight:700;line-height:1.35;color:${c.text};white-space:nowrap;padding-bottom:2px;">${esc(truncateName(s.name, 22))}</div>
                  <div style="font-size:9px;line-height:1.3;color:${c.textMuted};">${esc(fmtCompactRp(s.realisasiValue))} ${s.targetValue ? `/ Tgt ${esc(fmtCompactRp(s.targetValue))}` : ""}</div>
                </div>
              </div>
              <div style="text-align:right;flex-shrink:0;">
                <div style="font-size:12px;font-weight:800;color:${getAchColor(s.ach, c)};">${esc(fmtPct(s.ach))}</div>
                ${options.includeAo && s.realisasiAo ? `<div style="font-size:9px;color:${c.textMuted};">${s.realisasiAo} AO</div>` : ""}
              </div>
            </div>
          `).join("")}
        </div>
      </div>

      <!-- Kolom Kanan: Penjualan Hari Terakhir — Semua Sales -->
      <div style="background:${c.bgCard};border:1px solid ${c.border};border-radius:14px;padding:12px 14px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
          <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.04em;color:${c.mint};display:flex;align-items:center;gap:5px;">
            <span>⚡</span> Hari Terakhir (${esc(formatIDDate(lastDate, true))})
          </div>
          <div style="font-size:9px;font-weight:700;padding:2px 6px;border-radius:6px;background:${c.mint}22;color:${c.mint};">
            ${esc(fmtCompactRp(totalLastDayValue))} · ${totalLastDayAo} AO
          </div>
        </div>

        <div style="display:flex;flex-direction:column;gap:7px;">
          ${allSalesLastDay.map((s, idx) => {
            const hasSales = s.valueLastDay > 0;
            return `
            <div style="display:flex;align-items:center;justify-content:space-between;background:${hasSales ? c.bgCardSubtle : c.badgeBg};padding:7px 10px;border-radius:9px;opacity:${hasSales ? 1 : 0.65};">
              <div style="display:flex;align-items:center;gap:8px;min-width:0;">
                <span style="font-size:10px;font-weight:700;color:${hasSales ? c.gold : c.textMuted};width:16px;text-align:center;">${idx + 1}.</span>
                <div style="min-width:0;">
                  <div style="font-size:11.5px;font-weight:700;line-height:1.35;color:${c.text};white-space:nowrap;padding-bottom:2px;">${esc(truncateName(s.name, 22))}</div>
                  <div style="font-size:9px;line-height:1.3;color:${c.textMuted};">${hasSales ? `${s.aoLastDay} Toko Aktif` : "Tidak ada transaksi"}</div>
                </div>
              </div>
              <div style="text-align:right;flex-shrink:0;">
                <div style="font-size:12px;font-weight:800;color:${hasSales ? c.mint : c.textMuted};">
                  ${hasSales ? `+${esc(fmtCompactRp(s.valueLastDay))}` : "-"}
                </div>
                <div style="font-size:9px;color:${c.textMuted};">${s.aoLastDay} AO</div>
              </div>
            </div>
            `;
          }).join("")}
        </div>
      </div>

    </div>
    ` : `
    <!-- LAYOUT 1-KOLOM STANDAR: LEADERBOARD SALES SESUAI PILIHAN (Top 3 / 5 / Semua) -->
    <div style="background:${c.bgCard};border:1px solid ${c.border};border-radius:14px;padding:14px;margin-bottom:14px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
        <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.04em;color:${c.gold};display:flex;align-items:center;gap:5px;">
          <span>🏆</span> ${esc(topLabel)}
        </div>
        <div style="font-size:10px;color:${c.textMuted};">Berdasarkan ACH %</div>
      </div>

      <div style="display:flex;flex-direction:column;gap:8px;">
        ${topSales.map((s, idx) => `
          <div style="display:flex;align-items:center;justify-content:space-between;background:${c.bgCardSubtle};padding:8px 12px;border-radius:10px;">
            <div style="display:flex;align-items:center;gap:10px;">
              ${renderRankBadge(idx)}
              <div>
                <div style="font-size:12px;font-weight:700;line-height:1.35;color:${c.text};white-space:nowrap;padding-bottom:2px;">${esc(truncateName(s.name, 30))}</div>
                <div style="font-size:10px;line-height:1.3;color:${c.textMuted};">${esc(fmtCompactRp(s.realisasiValue))} ${s.targetValue ? `/ Tgt ${esc(fmtCompactRp(s.targetValue))}` : ""}</div>
              </div>
            </div>
            <div style="text-align:right;">
              <div style="font-size:13px;font-weight:800;color:${getAchColor(s.ach, c)};">${esc(fmtPct(s.ach))}</div>
              ${options.includeAo && s.realisasiAo ? `<div style="font-size:9.5px;color:${c.textMuted};">${s.realisasiAo} AO</div>` : ""}
            </div>
          </div>
        `).join("")}
      </div>
    </div>
    `}

    <!-- Perlu Perhatian / Anomali (jika ada) -->
    ${attentionItems.length > 0 ? `
    <div style="background:${c.bgCard};border-left:4px solid ${c.coral};border-top:1px solid ${c.border};border-right:1px solid ${c.border};border-bottom:1px solid ${c.border};border-radius:12px;padding:10px 14px;margin-bottom:14px;">
      <div style="font-size:10.5px;font-weight:700;color:${c.coral};text-transform:uppercase;margin-bottom:6px;display:flex;align-items:center;gap:5px;">
        <span>⚠️</span> Perlu Perhatian & Tindakan
      </div>
      ${attentionItems.map((item) => `
        <div style="font-size:10.5px;color:${c.text};margin-bottom:3px;">
          • <b>${esc(item.title)}</b>: <span style="color:${c.textMuted};">${esc(item.desc)}</span>
        </div>
      `).join("")}
    </div>
    ` : ""}

    <!-- Custom Supervisor Note (jika diisi) -->
    ${options.customNote && options.customNote.trim() ? `
    <div style="background:${c.badgeBg};border:1px dashed ${c.gold};border-radius:10px;padding:10px 12px;margin-bottom:14px;">
      <div style="font-size:10px;font-weight:700;color:${c.gold};text-transform:uppercase;margin-bottom:3px;">💬 Pesan Supervisor:</div>
      <div style="font-size:11px;font-style:italic;color:${c.text};">${esc(options.customNote.trim())}</div>
    </div>
    ` : ""}

    <!-- Footer -->
    <div style="display:flex;justify-content:space-between;align-items:center;padding-top:10px;border-top:1px solid ${c.border};font-size:9.5px;color:${c.textMuted};">
      <div>Monitoring Penjualan Sales · Sistem Otomatis</div>
      <div>#DailyReport · #KeepPushing</div>
    </div>

  </div>
  `;
}
