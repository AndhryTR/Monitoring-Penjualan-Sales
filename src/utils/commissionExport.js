/* ============================================================================
   COMMISSION & INCENTIVE EXPORT — Gambar (PNG/JPG), Excel (.xlsx), dan PDF (.pdf)
   Menampilkan data lengkap:
   1. Ringkasan Eksekutif (KPI Payout, Sales Lolos, Sell Out, AO Brand, Fokus/EC)
   2. Tabel Utama Pencapaian & Insentif Per Salesman (Sell Out + AO + Sub-baris Fokus/EC)
   3. Katalog Referensi Skema & Rule yang Berlaku (ditempatkan di bawah tabel utama)
============================================================================ */

import * as XLSX_MODULE from "xlsx-js-style";
const XLSX = XLSX_MODULE.default || XLSX_MODULE;
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { todayLocalDateStr, dateStrToLocalDate } from "./excelParse.js";
import {
  XL_COLORS,
  XL_NUMFMT_MONEY,
  XL_NUMFMT_INT,
  XL_NUMFMT_PCT1,
  achGradientColor,
  makeSheetBuilder,
  writeTitleBlock,
  writeHeaderRow,
  sanitizeFilename,
} from "./xlsxStyle.js";
import { fmtRp, fmtNum, fmtPct, fmtDeviasi, fmtDeviasiAo, formatGeneratedAt } from "./formatters.js";
import {
  getStoredCommissionRules,
  computeAllSalesCommissions,
  DEFAULT_FLAT_TIERS,
} from "./commissionEngine.js";
import { APP_LOGO_BASE64 } from "./exportLogo.js";
import changelogData from "../data/changelog.json";

const APP_VERSION = changelogData?.[0]?.version || "4.4.3";

const MONTHS_ID = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

function esc(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatPeriodLabel(agg) {
  const f = dateStrToLocalDate(agg?.meta?.firstDate);
  const l = dateStrToLocalDate(agg?.meta?.lastDate);
  if (!f || !l) return "Periode Berjalan";
  const fmtD = (d) => `${d.getDate()} ${MONTHS_ID[d.getMonth()]} ${d.getFullYear()}`;
  return `${fmtD(f)} s/d ${fmtD(l)}`;
}

/**
 * Helper menyusun daftar ringkasan skema Sell Out & AO + Rule Fokus/EC yang aktif
 */
export function buildActiveSchemesSummary(rules, salesList = []) {
  const salesMap = new Map();
  (salesList || []).forEach((s) => {
    const code = s.code || s.salesCode || "";
    const name = s.name || s.salesName || code;
    if (code) salesMap.set(code, name);
  });

  const formatSalesScope = (mode, assigned = [], isMain = false) => {
    if (!mode || mode === "all") {
      return isMain && (rules?.customSchemes?.length || 0) > 0
        ? "Semua Salesman (Selain yang punya Rule Khusus)"
        : "Semua Salesman";
    }
    if (!Array.isArray(assigned) || assigned.length === 0) return "Tidak ada sales dipilih";
    return assigned.map((c) => salesMap.get(c) || c).join(", ");
  };

  const formatValueRuleDesc = (sc) => {
    const mode = sc.valueMode || "percentage";
    if (mode === "none") return "Nonaktif";
    if (mode === "flat_tier") {
      const tiers = [...(sc.valueTiers || DEFAULT_FLAT_TIERS)].sort((a, b) => (a.minAch || 0) - (b.minAch || 0));
      return (
        "Bobot Nominal Berjenjang: " +
        tiers
          .map((t, idx) => {
            const next = tiers[idx + 1];
            const range = next ? `${t.minAch}%-${Math.max(t.minAch, next.minAch - 1)}%` : `≥${t.minAch}%`;
            return `${range} = ${fmtRp(t.amount)}`;
          })
          .join(" | ")
      );
    }
    return `% dari Omset: T1 (≥${sc.tier1MinAch}%) = ${sc.tier1RatePct}% | T2 (≥${sc.tier2MinAch}%) = ${sc.tier2RatePct}% | T3 (≥${sc.tier3MinAch}%) = ${sc.tier3RatePct}%`;
  };

  const formatAoRuleDesc = (sc) => {
    if (!sc.aoBonusEnabled) return "Nonaktif";
    const targetInfo = sc.aoTargetOverride > 0 ? `Target Patokan: ${fmtNum(sc.aoTargetOverride)} toko` : "Target: Ikut Master Sales";
    const mode = sc.aoMode || "per_outlet";
    if (mode === "flat_tier") {
      const tiers = [...(sc.aoTiers || DEFAULT_FLAT_TIERS)].sort((a, b) => (a.minAch || 0) - (b.minAch || 0));
      const tierStr = tiers
        .map((t, idx) => {
          const next = tiers[idx + 1];
          const range = next ? `${t.minAch}%-${Math.max(t.minAch, next.minAch - 1)}%` : `≥${t.minAch}%`;
          return `${range} = ${fmtRp(t.amount)}`;
        })
        .join(" | ");
      return `${targetInfo} · Bobot Berjenjang: ${tierStr}`;
    }
    return `${targetInfo} · Syarat ≥${sc.aoMinAch}% ACH -> ${fmtRp(sc.aoBonusPerOutlet)} / toko`;
  };

  const schemes = [
    {
      name: rules.schemeName || "Skema Utama (Default)",
      isCustom: false,
      salesScope: formatSalesScope(rules.salesFilterMode, rules.assignedSales, true),
      valueModeLabel:
        rules.valueMode === "flat_tier" ? "Tier Bobot Nominal (Rp)" : rules.valueMode === "none" ? "Nonaktif" : "% dari Omset",
      valueDesc: formatValueRuleDesc(rules),
      aoModeLabel: !rules.aoBonusEnabled
        ? "Nonaktif"
        : rules.aoMode === "flat_tier"
        ? "Tier Bobot Nominal (Rp)"
        : "Rp per Toko",
      aoDesc: formatAoRuleDesc(rules),
    },
  ];

  (rules.customSchemes || []).forEach((cs) => {
    if (cs.enabled === false) return;
    schemes.push({
      name: cs.name || "Rule Skema Khusus",
      isCustom: true,
      salesScope: formatSalesScope(cs.salesFilterMode || "selected", cs.assignedSales, false),
      valueModeLabel:
        cs.valueMode === "flat_tier" ? "Tier Bobot Nominal (Rp)" : cs.valueMode === "none" ? "Nonaktif" : "% dari Omset",
      valueDesc: formatValueRuleDesc(cs),
      aoModeLabel: !cs.aoBonusEnabled
        ? "Nonaktif"
        : cs.aoMode === "flat_tier"
        ? "Tier Bobot Nominal (Rp)"
        : "Rp per Toko",
      aoDesc: formatAoRuleDesc(cs),
    });
  });

  const focusRulesSummary = (rules.focusRules || []).map((fr) => {
    const isAo = fr.metricType === "ao";
    const unit = isAo ? "toko (AO)" : fr.targetUnit || "ktn/pcs";
    const productScope =
      fr.matchMode === "master_focus"
        ? "Semua Produk Fokus (Master Target)"
        : fr.matchMode === "keyword"
        ? `Kata Kunci: "${fr.keyword}"`
        : `Grup Produk: "${fr.groupName}"`;

    let rewardDesc = "";
    if (fr.rewardType === "tiered_pct") {
      const tiers = [...(fr.tiers || DEFAULT_FLAT_TIERS)].sort((a, b) => (a.minAch || 0) - (b.minAch || 0));
      rewardDesc =
        "Tier % ACH: " +
        tiers
          .map((t, idx) => {
            const next = tiers[idx + 1];
            const range = next ? `${t.minAch}%-${Math.max(t.minAch, next.minAch - 1)}%` : `≥${t.minAch}%`;
            return `${range} = ${fmtRp(t.amount)}`;
          })
          .join(" | ");
    } else if (fr.rewardType === "flat") {
      rewardDesc = `Flat ${fmtRp(fr.rewardRate)} (jika capai target)`;
    } else {
      rewardDesc = `${fmtRp(fr.rewardRate)} per ${isAo ? "toko" : fr.targetUnit || "ktn"}`;
    }

    let gatekeeperDesc = "Tanpa syarat AO tambahan";
    if (fr.aoGatekeeperMode === "this_group") {
      gatekeeperDesc = `Wajib AO Golongan Produk ≥ ${fr.aoGatekeeperMin} toko`;
    } else if (fr.aoGatekeeperMode === "all_groups") {
      gatekeeperDesc = `Wajib Semua Golongan ≥ ${fr.aoGatekeeperMin} toko`;
    } else if (fr.aoGatekeeperMode === "selected_groups") {
      gatekeeperDesc = `Wajib Golongan (${(fr.aoGatekeeperGroups || []).join(", ") || "Semua"}) ≥ ${fr.aoGatekeeperMin} toko`;
    }

    return {
      name: fr.name || "Program Fokus / EC",
      metricLabel: isAo ? "Effective Calls (Toko Unik AO)" : "Kuantitas Barang",
      productScope,
      salesScope: formatSalesScope(fr.salesFilterMode || "all", fr.assignedSales, false),
      targetDesc: `${fmtNum(fr.targetQty)} ${unit}`,
      rewardDesc,
      gatekeeperDesc,
    };
  });

  return { schemes, focusRulesSummary };
}

/* ============================================================================
   1. EXPORT GAMBAR HD (HTML -> Canvas -> PNG / JPG)
============================================================================ */
export function buildCommissionReportHTML(agg, opts = {}) {
  const { depotName = "DEPO", rawRows = [] } = opts;
  const salesList = agg?.bySales || [];
  const txRows = agg?.filteredRows || rawRows || [];
  const rules = getStoredCommissionRules(depotName || "default");
  const { commissions, summary } = computeAllSalesCommissions(salesList, rules, txRows);
  const { schemes, focusRulesSummary } = buildActiveSchemesSummary(rules, salesList);
  const periodLabel = formatPeriodLabel(agg);

  const totalTargetV = commissions.reduce((s, c) => s + (c.targetValue || 0), 0);
  const totalRealV = commissions.reduce((s, c) => s + (c.realValue || 0), 0);
  const totalDevV = totalTargetV - totalRealV;
  const totalAchV = totalTargetV > 0 ? totalRealV / totalTargetV : 0;

  const totalTargetAo = commissions.reduce((s, c) => s + (c.targetAo || 0), 0);
  const totalRealAo = commissions.reduce((s, c) => s + (c.realAo || 0), 0);
  const totalDevAo = totalTargetAo - totalRealAo;
  const totalAchAo = totalTargetAo > 0 ? totalRealAo / totalTargetAo : 0;

  const devColor = (dev) => (dev !== null && dev !== undefined && dev < 0 ? "#059669" : "#DC2626");
  const achPill = (pct100) => {
    const ratio = (Number(pct100) || 0) / 100;
    const color = ratio >= 1 ? "#059669" : ratio >= 0.8 ? "#D97706" : "#DC2626";
    return `<span style="display:inline-block;padding:2px 7px;border-radius:10px;font-size:11.5px;font-weight:700;color:${color};background:${color}18;border:1px solid ${color}44;white-space:nowrap;">${Number(pct100 || 0).toFixed(1)}%</span>`;
  };

  let html = `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;width:1420px;background:#F8FAFC;padding:24px;box-sizing:border-box;color:#0F172A;">`;
  html += `<div style="background:#FFFFFF;border-radius:14px;border:1px solid #E2E8F0;box-shadow:0 4px 10px rgba(0,0,0,0.05);padding:24px;">`;

  // ---- 1. HEADER ----
  html += `<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;padding-bottom:16px;border-bottom:2px solid #E2E8F0;">`;
  html += `<div style="display:flex;align-items:center;gap:14px;">`;
  html += `<div style="width:48px;height:48px;border-radius:10px;background:#F1F5F9;display:flex;align-items:center;justify-content:center;padding:6px;border:1px solid #E2E8F0;">`;
  html += `<img src="${APP_LOGO_BASE64}" width="36" height="36" style="width:100%;height:100%;object-fit:contain;display:block;" alt="Logo" />`;
  html += `</div>`;
  html += `<div>`;
  html += `<div style="font-size:20px;font-weight:800;color:#0F172A;">${esc(depotName || "DEPO")}</div>`;
  html += `<div style="font-size:13px;font-weight:700;color:#047857;letter-spacing:0.03em;text-transform:uppercase;">LAPORAN DETAIL KALKULASI KOMISI & SKEMA INSENTIF SALES</div>`;
  html += `</div>`;
  html += `</div>`;

  html += `<div style="text-align:right;">`;
  html += `<div style="display:inline-flex;align-items:center;gap:8px;background:#F1F5F9;padding:6px 12px;border-radius:8px;border:1px solid #CBD5E1;font-size:12px;font-weight:600;color:#1E293B;">`;
  html += `<span>📅 Periode: <b>${esc(periodLabel)}</b></span>`;
  html += `<span style="color:#94A3B8;">•</span>`;
  html += `<span>Skema Aktif: <b>${schemes.length} Skema Sales & ${focusRulesSummary.length} Rule Fokus/EC</b></span>`;
  html += `</div>`;
  html += `<div style="font-size:11.5px;color:#475569;margin-top:4px;">Evaluasi Batas Murni (Contoh: 89.9% tetap di tier 80%–89%, wajib ≥90.0% untuk naik tier)</div>`;
  html += `</div>`;
  html += `</div>`;

  // ---- 2. KPI SUMMARY CARDS ----
  html += `<div style="display:grid;grid-template-columns:repeat(5, 1fr);gap:12px;margin-bottom:20px;">`;

  html += `<div style="background:#ECFDF5;border:1px solid #A7F3D0;border-radius:10px;padding:12px 14px;">`;
  html += `<div style="font-size:11px;font-weight:800;color:#065F46;text-transform:uppercase;">TOTAL ESTIMASI PAYOUT</div>`;
  html += `<div style="font-size:18px;font-weight:800;color:#047857;margin-top:2px;">${fmtRp(summary.totalPayout)}</div>`;
  html += `<div style="font-size:11.5px;color:#059669;margin-top:2px;">Rata-rata: ${fmtRp(summary.avgPayout)} / sales lolos</div>`;
  html += `</div>`;

  html += `<div style="background:#EFF6FF;border:1px solid #BFDBFE;border-radius:10px;padding:12px 14px;">`;
  html += `<div style="font-size:11px;font-weight:800;color:#1E40AF;text-transform:uppercase;">SALES LOLOS INSENTIF</div>`;
  html += `<div style="font-size:18px;font-weight:800;color:#1D4ED8;margin-top:2px;">${summary.qualifiedSalesCount} / ${summary.totalSalesCount} Sales</div>`;
  html += `<div style="font-size:11.5px;color:#2563EB;margin-top:2px;">Rasio Lolos: ${summary.totalSalesCount > 0 ? Math.round((summary.qualifiedSalesCount / summary.totalSalesCount) * 100) : 0}%</div>`;
  html += `</div>`;

  html += `<div style="background:#FFFBEB;border:1px solid #FDE68A;border-radius:10px;padding:12px 14px;">`;
  html += `<div style="font-size:11px;font-weight:800;color:#92400E;text-transform:uppercase;">INSENTIF SELL OUT (OMSET)</div>`;
  html += `<div style="font-size:18px;font-weight:800;color:#B45309;margin-top:2px;">${fmtRp(summary.totalValueCommission)}</div>`;
  html += `<div style="font-size:11.5px;color:#D97706;margin-top:2px;">ACH Omset Depo: ${fmtPct(totalAchV)}</div>`;
  html += `</div>`;

  html += `<div style="background:#F0FDF4;border:1px solid #BBF7D0;border-radius:10px;padding:12px 14px;">`;
  html += `<div style="font-size:11px;font-weight:800;color:#166534;text-transform:uppercase;">INSENTIF AO ALL BRAND</div>`;
  html += `<div style="font-size:18px;font-weight:800;color:#15803D;margin-top:2px;">${fmtRp(summary.totalAoBonus)}</div>`;
  html += `<div style="font-size:11.5px;color:#16A34A;margin-top:2px;">Total AO: ${fmtNum(totalRealAo)} / ${fmtNum(totalTargetAo)}</div>`;
  html += `</div>`;

  html += `<div style="background:#F5F3FF;border:1px solid #DDD6FE;border-radius:10px;padding:12px 14px;">`;
  html += `<div style="font-size:11px;font-weight:800;color:#5B21B6;text-transform:uppercase;">INSENTIF FOKUS & EC</div>`;
  html += `<div style="font-size:18px;font-weight:800;color:#6D28D9;margin-top:2px;">${fmtRp(summary.totalFocusBonus)}</div>`;
  html += `<div style="font-size:11.5px;color:#7C3AED;margin-top:2px;">${focusRulesSummary.length} Program Terdaftar</div>`;
  html += `</div>`;

  html += `</div>`;

  // ---- 3. MAIN COMMISSION TABLE ----
  html += `<table style="width:100%;border-collapse:collapse;font-size:12px;border:1px solid #CBD5E1;">`;
  html += `<thead>`;
  html += `<tr style="color:#FFFFFF;text-align:center;">`;
  html += `<th rowspan="2" style="background:#0F172A;width:32px;padding:8px 4px;border:1px solid #334155;">NO</th>`;
  html += `<th rowspan="2" style="background:#0F172A;min-width:155px;padding:8px 8px;border:1px solid #334155;">SALESMAN & SKEMA</th>`;
  html += `<th colspan="6" style="background:#1E293B;padding:6px;border:1px solid #334155;">PENCAPAIAN & INSENTIF SELL OUT (OMSET)</th>`;
  html += `<th colspan="5" style="background:#064E3B;padding:6px;border:1px solid #059669;">PENCAPAIAN & INSENTIF AO ALL BRAND</th>`;
  html += `<th colspan="4" style="background:#3B0764;padding:6px;border:1px solid #7C3AED;">RINCIAN PRODUK FOKUS & EFFECTIVE CALLS</th>`;
  html += `<th rowspan="2" style="background:#047857;width:110px;padding:8px 6px;border:1px solid #059669;">TOTAL INSENTIF</th>`;
  html += `</tr>`;

  html += `<tr style="color:#E2E8F0;font-size:11px;text-align:center;">`;
  // Sell Out cols
  html += `<th style="background:#334155;padding:5px 6px;border:1px solid #475569;">TARGET</th>`;
  html += `<th style="background:#334155;padding:5px 6px;border:1px solid #475569;">REALISASI</th>`;
  html += `<th style="background:#334155;padding:5px 6px;border:1px solid #475569;">DEVIASI</th>`;
  html += `<th style="background:#334155;padding:5px 4px;border:1px solid #475569;">ACH</th>`;
  html += `<th style="background:#334155;padding:5px 6px;border:1px solid #475569;">TIER / RATE</th>`;
  html += `<th style="background:#334155;padding:5px 6px;border:1px solid #475569;">INSENTIF</th>`;
  // AO cols
  html += `<th style="background:#065F46;padding:5px 4px;border:1px solid #059669;">TGT</th>`;
  html += `<th style="background:#065F46;padding:5px 4px;border:1px solid #059669;">REAL</th>`;
  html += `<th style="background:#065F46;padding:5px 4px;border:1px solid #059669;">DEV</th>`;
  html += `<th style="background:#065F46;padding:5px 4px;border:1px solid #059669;">ACH</th>`;
  html += `<th style="background:#065F46;padding:5px 6px;border:1px solid #059669;">INSENTIF AO</th>`;
  // Focus / EC cols
  html += `<th style="background:#4C1D95;padding:5px 6px;border:1px solid #7C3AED;text-align:left;">PROGRAM / RULE</th>`;
  html += `<th style="background:#4C1D95;padding:5px 4px;border:1px solid #7C3AED;">REAL / TGT</th>`;
  html += `<th style="background:#4C1D95;padding:5px 4px;border:1px solid #7C3AED;">ACH & STATUS</th>`;
  html += `<th style="background:#4C1D95;padding:5px 6px;border:1px solid #7C3AED;">BONUS</th>`;
  html += `</tr>`;
  html += `</thead><tbody>`;

  commissions.forEach((c, idx) => {
    const fbList = Array.isArray(c.focusBreakdown) ? c.focusBreakdown : [];
    const rowSpan = Math.max(1, fbList.length);
    const rowBg = idx % 2 === 0 ? "#FFFFFF" : "#F8FAFC";
    const devV = (c.targetValue || 0) - (c.realValue || 0);
    const devAo = (c.targetAo || 0) - (c.realAo || 0);

    const tierDisplay =
      c.valueMode === "flat_tier" || c.valueMode === "none"
        ? c.tierLabel
        : `${c.tierLabel} (${c.appliedRatePct}%)`;

    for (let i = 0; i < rowSpan; i++) {
      const fb = fbList[i];
      html += `<tr style="${i === 0 ? "border-top:1.5px solid #94A3B8;" : ""}">`;

      if (i === 0) {
        html += `<td rowspan="${rowSpan}" style="text-align:center;vertical-align:middle;font-weight:800;background:${rowBg};border:1px solid #CBD5E1;padding:6px 4px;">${idx + 1}</td>`;
        html += `<td rowspan="${rowSpan}" style="vertical-align:middle;background:${rowBg};border:1px solid #CBD5E1;padding:6px 8px;">`;
        html += `<div style="font-weight:800;color:#0F172A;font-size:12.5px;">${esc(c.salesName)}</div>`;
        html += `<div style="font-size:11px;color:#475569;margin-top:2px;">${esc(c.salesCode)} · <span style="display:inline-block;padding:1px 5px;border-radius:4px;font-weight:700;font-size:10.5px;background:${c.isCustomScheme ? "#D1FAE5" : "#DBEAFE"};color:${c.isCustomScheme ? "#065F46" : "#1E40AF"};">${esc(c.schemeName)}</span></div>`;
        html += `</td>`;

        // Sell Out
        html += `<td rowspan="${rowSpan}" style="text-align:right;vertical-align:middle;padding:6px;background:${rowBg};border:1px solid #E2E8F0;white-space:nowrap;">${fmtRp(c.targetValue)}</td>`;
        html += `<td rowspan="${rowSpan}" style="text-align:right;vertical-align:middle;padding:6px;font-weight:700;color:#0F172A;background:${rowBg};border:1px solid #E2E8F0;white-space:nowrap;">${fmtRp(c.realValue)}</td>`;
        html += `<td rowspan="${rowSpan}" style="text-align:right;vertical-align:middle;padding:6px;font-weight:700;color:${devColor(devV)};background:${rowBg};border:1px solid #E2E8F0;white-space:nowrap;">${fmtDeviasi(devV)}</td>`;
        html += `<td rowspan="${rowSpan}" style="text-align:center;vertical-align:middle;padding:6px 4px;background:${rowBg};border:1px solid #E2E8F0;">${achPill(c.ach)}</td>`;
        html += `<td rowspan="${rowSpan}" style="text-align:center;vertical-align:middle;padding:6px;font-size:11px;font-weight:700;color:${c.tierColor || "#334155"};background:${rowBg};border:1px solid #E2E8F0;">${esc(tierDisplay)}</td>`;
        html += `<td rowspan="${rowSpan}" style="text-align:right;vertical-align:middle;padding:6px;font-weight:800;color:${c.valueCommission > 0 ? "#B45309" : "#64748B"};background:${rowBg};border:1px solid #E2E8F0;white-space:nowrap;">${fmtRp(c.valueCommission)}</td>`;

        // AO All Brand
        html += `<td rowspan="${rowSpan}" style="text-align:center;vertical-align:middle;padding:6px 4px;background:${rowBg};border:1px solid #E2E8F0;">${fmtNum(c.targetAo)}</td>`;
        html += `<td rowspan="${rowSpan}" style="text-align:center;vertical-align:middle;padding:6px 4px;font-weight:700;background:${rowBg};border:1px solid #E2E8F0;">${fmtNum(c.realAo)}</td>`;
        html += `<td rowspan="${rowSpan}" style="text-align:center;vertical-align:middle;padding:6px 4px;font-weight:700;color:${devColor(devAo)};background:${rowBg};border:1px solid #E2E8F0;">${fmtDeviasiAo(devAo)}</td>`;
        html += `<td rowspan="${rowSpan}" style="text-align:center;vertical-align:middle;padding:6px 4px;background:${rowBg};border:1px solid #E2E8F0;">${achPill(c.achAo)}</td>`;
        html += `<td rowspan="${rowSpan}" style="text-align:right;vertical-align:middle;padding:6px;background:${rowBg};border:1px solid #E2E8F0;white-space:nowrap;">`;
        html += `<div style="font-weight:800;color:${c.aoBonus > 0 ? "#047857" : "#64748B"};">${fmtRp(c.aoBonus)}</div>`;
        if (c.aoTierLabel) {
          html += `<div style="font-size:10px;color:#475569;margin-top:1px;">${esc(c.aoTierLabel)}</div>`;
        }
        html += `</td>`;
      }

      // Focus / EC Row
      if (fb) {
        const unitLbl = fb.metricType === "ao" ? "toko" : fb.targetUnit || "ktn";
        let statusBadge = "";
        if (fb.isQualified) {
          statusBadge = `<span style="color:#059669;font-weight:700;">✓ Lolos (${fb.achPct}%${fb.tierLabel ? ` · ${esc(fb.tierLabel)}` : ""})</span>`;
        } else if (fb.qtyAchieved && !fb.aoGatekeeperPassed) {
          const failG = fb.failedGroups.map((g) => `${g.group} ${g.currentAo}/${g.requiredAo}`).join(", ");
          statusBadge = `<span style="color:#D97706;font-weight:700;">⚠ Tertahan AO (${esc(failG)})</span>`;
        } else {
          statusBadge = `<span style="color:#64748B;">Belum Capai (${fb.achPct}%)</span>`;
        }

        html += `<td style="padding:5px 6px;background:${rowBg};border:1px solid #E2E8F0;font-weight:600;color:#1E293B;">${esc(fb.ruleName)}</td>`;
        html += `<td style="padding:5px 4px;text-align:center;background:${rowBg};border:1px solid #E2E8F0;font-weight:700;white-space:nowrap;">${fmtNum(fb.totalQty)} / ${fmtNum(fb.targetQty)} ${esc(unitLbl)}</td>`;
        html += `<td style="padding:5px 6px;text-align:center;background:${rowBg};border:1px solid #E2E8F0;font-size:11px;">${statusBadge}</td>`;
        html += `<td style="padding:5px 6px;text-align:right;background:${rowBg};border:1px solid #E2E8F0;font-weight:700;color:${fb.bonus > 0 ? "#6D28D9" : "#64748B"};white-space:nowrap;">${fmtRp(fb.bonus)}</td>`;
      } else {
        html += `<td colspan="4" style="padding:6px;text-align:center;color:#64748B;font-style:italic;background:${rowBg};border:1px solid #E2E8F0;">— Tidak ada rule Fokus/EC —</td>`;
      }

      if (i === 0) {
        html += `<td rowspan="${rowSpan}" style="text-align:right;vertical-align:middle;padding:6px 8px;font-size:13px;font-weight:800;color:${c.totalIncentive > 0 ? "#047857" : "#64748B"};background:${c.totalIncentive > 0 ? "#ECFDF5" : rowBg};border:1px solid #CBD5E1;white-space:nowrap;">${fmtRp(c.totalIncentive)}</td>`;
      }

      html += `</tr>`;
    }
  });

  // ---- GRAND TOTAL ROW ----
  html += `</tbody><tfoot>`;
  html += `<tr style="background:#0F172A;color:#FFFFFF;font-weight:800;font-size:12px;">`;
  html += `<td colspan="2" style="padding:9px 10px;border:1px solid #334155;">TOTAL KESELURUHAN DEPO</td>`;
  html += `<td style="padding:9px 6px;text-align:right;border:1px solid #334155;">${fmtRp(totalTargetV)}</td>`;
  html += `<td style="padding:9px 6px;text-align:right;color:#34D399;border:1px solid #334155;">${fmtRp(totalRealV)}</td>`;
  html += `<td style="padding:9px 6px;text-align:right;color:${totalDevV < 0 ? "#34D399" : "#F87171"};border:1px solid #334155;">${fmtDeviasi(totalDevV)}</td>`;
  html += `<td style="padding:9px 4px;text-align:center;border:1px solid #334155;">${fmtPct(totalAchV)}</td>`;
  html += `<td style="padding:9px 6px;text-align:center;border:1px solid #334155;">—</td>`;
  html += `<td style="padding:9px 6px;text-align:right;color:#FBBF24;border:1px solid #334155;">${fmtRp(summary.totalValueCommission)}</td>`;
  html += `<td style="padding:9px 4px;text-align:center;border:1px solid #334155;">${fmtNum(totalTargetAo)}</td>`;
  html += `<td style="padding:9px 4px;text-align:center;border:1px solid #334155;">${fmtNum(totalRealAo)}</td>`;
  html += `<td style="padding:9px 4px;text-align:center;color:${totalDevAo < 0 ? "#34D399" : "#F87171"};border:1px solid #334155;">${fmtDeviasiAo(totalDevAo)}</td>`;
  html += `<td style="padding:9px 4px;text-align:center;border:1px solid #334155;">${fmtPct(totalAchAo)}</td>`;
  html += `<td style="padding:9px 6px;text-align:right;color:#34D399;border:1px solid #334155;">${fmtRp(summary.totalAoBonus)}</td>`;
  html += `<td colspan="3" style="padding:9px 8px;text-align:right;border:1px solid #334155;">SUBTOTAL FOKUS & EC</td>`;
  html += `<td style="padding:9px 6px;text-align:right;color:#C4B5FD;border:1px solid #334155;">${fmtRp(summary.totalFocusBonus)}</td>`;
  html += `<td style="padding:9px 8px;text-align:right;font-size:13.5px;color:#6EE7B7;background:#064E3B;border:1px solid #059669;">${fmtRp(summary.totalPayout)}</td>`;
  html += `</tr>`;
  html += `</tfoot></table>`;

  // ---- 4. REFERENSI SKEMA & RULE AKTIF (DI BAWAH TABEL) ----
  html += `<div style="margin-top:20px;padding:16px;background:#F8FAFC;border:1px solid #CBD5E1;border-radius:10px;">`;
  html += `<div style="font-size:12.5px;font-weight:800;color:#0F172A;text-transform:uppercase;letter-spacing:0.03em;margin-bottom:10px;">📌 RINCIAN SKEMA & RULE INSENTIF YANG BERLAKU</div>`;

  html += `<div style="display:grid;grid-template-columns:repeat(2, 1fr);gap:10px;">`;
  schemes.forEach((sc) => {
    html += `<div style="background:#FFFFFF;border:1px solid #E2E8F0;border-left:4px solid ${sc.isCustom ? "#10B981" : "#3B82F6"};border-radius:8px;padding:10px 12px;font-size:11.5px;">`;
    html += `<div style="font-weight:800;color:#0F172A;font-size:12px;">${esc(sc.name)} <span style="font-weight:600;color:#475569;">(Sales: ${esc(sc.salesScope)})</span></div>`;
    html += `<div style="color:#334155;margin-top:4px;">• <b>Sell Out:</b> ${esc(sc.valueDesc)}</div>`;
    html += `<div style="color:#334155;margin-top:2px;">• <b>AO All Brand:</b> ${esc(sc.aoDesc)}</div>`;
    html += `</div>`;
  });
  html += `</div>`;

  if (focusRulesSummary.length > 0) {
    html += `<div style="font-size:11.5px;font-weight:800;color:#4C1D95;text-transform:uppercase;margin-top:12px;margin-bottom:6px;">🎯 RULE PRODUK FOKUS & EFFECTIVE CALLS (EC):</div>`;
    html += `<div style="display:grid;grid-template-columns:repeat(2, 1fr);gap:10px;">`;
    focusRulesSummary.forEach((fr) => {
      html += `<div style="background:#FFFFFF;border:1px solid #DDD6FE;border-left:4px solid #7C3AED;border-radius:8px;padding:10px 12px;font-size:11.5px;">`;
      html += `<div style="font-weight:800;color:#0F172A;font-size:12px;">${esc(fr.name)} <span style="font-weight:600;color:#6D28D9;">[${esc(fr.metricLabel)}]</span></div>`;
      html += `<div style="color:#334155;margin-top:3px;">• <b>Cakupan:</b> ${esc(fr.productScope)} | <b>Sales:</b> ${esc(fr.salesScope)}</div>`;
      html += `<div style="color:#334155;margin-top:2px;">• <b>Target:</b> ${esc(fr.targetDesc)} | <b>Komisi:</b> ${esc(fr.rewardDesc)}</div>`;
      html += `<div style="color:#475569;margin-top:2px;">• <b>Syarat AO:</b> ${esc(fr.gatekeeperDesc)}</div>`;
      html += `</div>`;
    });
    html += `</div>`;
  }
  html += `</div>`;

  // ---- 5. FOOTER ----
  html += `<div style="margin-top:14px;display:flex;justify-content:space-between;align-items:center;font-size:11.5px;color:#334155;">`;
  html += `<div>Dicetak otomatis pada ${esc(formatGeneratedAt())} • Evaluasi persentase menggunakan batas murni (89.9% masuk 80–89%).</div>`;
  html += `<div style="font-weight:700;">Monitoring Penjualan Sales • Versi ${APP_VERSION}</div>`;
  html += `</div>`;

  html += `</div></div>`;
  return html;
}

/* ============================================================================
   2. EXPORT EXCEL MULTI-SHEET (.xlsx)
============================================================================ */
export function exportCommissionExcel(agg, opts = {}) {
  const { depotName = "DEPO", rawRows = [] } = opts;
  const salesList = agg?.bySales || [];
  const txRows = agg?.filteredRows || rawRows || [];
  const rules = getStoredCommissionRules(depotName || "default");
  const { commissions, summary } = computeAllSalesCommissions(salesList, rules, txRows);
  const { schemes, focusRulesSummary } = buildActiveSchemesSummary(rules, salesList);
  const periodLabel = formatPeriodLabel(agg);

  const wb = XLSX.utils.book_new();

  // =========================================================================
  // SHEET 1: REKAP INSENTIF SALES + REFERENSI SKEMA DI BAWAH TABEL
  // =========================================================================
  const b1 = makeSheetBuilder();
  writeTitleBlock(
    b1,
    `LAPORAN KALKULASI KOMISI & INSENTIF SALES — ${depotName}`,
    `Periode: ${periodLabel} · Dibuat: ${formatGeneratedAt()} · Versi ${APP_VERSION}`,
    17
  );

  // KPI Baris 4
  b1.setCell(4, 1, "Total Estimasi Payout:", { bold: true, fill: "ECFDF5" });
  b1.setCell(4, 2, summary.totalPayout, { bold: true, numFmt: XL_NUMFMT_MONEY, fill: "ECFDF5", color: "047857" });
  b1.setCell(4, 3, "Sales Lolos:", { bold: true, fill: "EFF6FF" });
  b1.setCell(4, 4, `${summary.qualifiedSalesCount} / ${summary.totalSalesCount}`, { bold: true, align: "center", fill: "EFF6FF" });
  b1.setCell(4, 5, "Total Sell Out:", { bold: true, fill: "FFFBEB" });
  b1.setCell(4, 6, summary.totalValueCommission, { bold: true, numFmt: XL_NUMFMT_MONEY, fill: "FFFBEB" });
  b1.setCell(4, 7, "Total AO Brand:", { bold: true, fill: "F0FDF4" });
  b1.setCell(4, 8, summary.totalAoBonus, { bold: true, numFmt: XL_NUMFMT_MONEY, fill: "F0FDF4" });
  b1.setCell(4, 9, "Total Fokus/EC:", { bold: true, fill: "F5F3FF" });
  b1.setCell(4, 10, summary.totalFocusBonus, { bold: true, numFmt: XL_NUMFMT_MONEY, fill: "F5F3FF" });

  // Header Tabel Utama di Baris 6
  const headers1 = [
    "No",
    "Kode Sales",
    "Nama Salesman",
    "Skema Aktif",
    "Target Omset (Rp)",
    "Realisasi Omset (Rp)",
    "Deviasi Omset (Rp)",
    "ACH Omset",
    "Tier / Rate Sell Out",
    "Insentif Sell Out (Rp)",
    "Target AO",
    "Realisasi AO",
    "Deviasi AO",
    "ACH AO",
    "Tier / Status AO",
    "Insentif AO Brand (Rp)",
    "Rincian Fokus & Effective Calls",
    "Insentif Fokus / EC (Rp)",
    "Total Estimasi Insentif (Rp)",
  ];
  writeHeaderRow(b1, 6, headers1, XL_COLORS.headerCyan);

  let rowIdx = 7;
  let sumTargetV = 0,
    sumRealV = 0,
    sumTargetAo = 0,
    sumRealAo = 0;

  commissions.forEach((c, idx) => {
    const devV = (c.realValue || 0) - (c.targetValue || 0);
    const devAo = (c.realAo || 0) - (c.targetAo || 0);
    const achRatio = (c.ach || 0) / 100;
    const achAoRatio = (c.achAo || 0) / 100;
    const tierText =
      c.valueMode === "flat_tier" || c.valueMode === "none"
        ? c.tierLabel
        : `${c.tierLabel} (${c.appliedRatePct}%)`;

    const focusSummaryText =
      Array.isArray(c.focusBreakdown) && c.focusBreakdown.length > 0
        ? c.focusBreakdown
            .map((fb) => {
              const u = fb.metricType === "ao" ? "toko" : fb.targetUnit || "ktn";
              const st = fb.isQualified ? "Lolos" : fb.qtyAchieved && !fb.aoGatekeeperPassed ? "Tertahan AO" : "Belum Capai";
              return `${fb.ruleName}: ${fb.totalQty}/${fb.targetQty} ${u} (${fb.achPct}% - ${st}) = ${fmtRp(fb.bonus)}`;
            })
            .join("; ")
        : "—";

    b1.setCell(rowIdx, 1, idx + 1, { align: "center" });
    b1.setCell(rowIdx, 2, c.salesCode, { align: "center" });
    b1.setCell(rowIdx, 3, c.salesName, { bold: true });
    b1.setCell(rowIdx, 4, c.schemeName || "Skema Utama");
    b1.setCell(rowIdx, 5, c.targetValue || 0, { numFmt: XL_NUMFMT_MONEY });
    b1.setCell(rowIdx, 6, c.realValue || 0, { numFmt: XL_NUMFMT_MONEY, bold: true });
    b1.setCell(rowIdx, 7, devV, { numFmt: XL_NUMFMT_MONEY, color: devV >= 0 ? "059669" : "DC2626" });
    b1.setCell(rowIdx, 8, achRatio, { numFmt: XL_NUMFMT_PCT1, fill: achGradientColor(achRatio) || undefined });
    b1.setCell(rowIdx, 9, tierText, { align: "center" });
    b1.setCell(rowIdx, 10, c.valueCommission || 0, { numFmt: XL_NUMFMT_MONEY, bold: true });
    b1.setCell(rowIdx, 11, c.targetAo || 0, { numFmt: XL_NUMFMT_INT, align: "center" });
    b1.setCell(rowIdx, 12, c.realAo || 0, { numFmt: XL_NUMFMT_INT, align: "center", bold: true });
    b1.setCell(rowIdx, 13, devAo, { numFmt: XL_NUMFMT_INT, align: "center", color: devAo >= 0 ? "059669" : "DC2626" });
    b1.setCell(rowIdx, 14, achAoRatio, { numFmt: XL_NUMFMT_PCT1, fill: achGradientColor(achAoRatio) || undefined });
    b1.setCell(rowIdx, 15, c.aoTierLabel || (c.aoBonusQualified ? "Tercapai" : "Belum Capai"), { align: "center" });
    b1.setCell(rowIdx, 16, c.aoBonus || 0, { numFmt: XL_NUMFMT_MONEY, bold: true });
    b1.setCell(rowIdx, 17, focusSummaryText, { wrap: true });
    b1.setCell(rowIdx, 18, c.totalFocusBonus || 0, { numFmt: XL_NUMFMT_MONEY, bold: true });
    b1.setCell(rowIdx, 19, c.totalIncentive || 0, {
      numFmt: XL_NUMFMT_MONEY,
      bold: true,
      fill: c.totalIncentive > 0 ? "ECFDF5" : undefined,
      color: c.totalIncentive > 0 ? "047857" : "000000",
    });

    sumTargetV += c.targetValue || 0;
    sumRealV += c.realValue || 0;
    sumTargetAo += c.targetAo || 0;
    sumRealAo += c.realAo || 0;
    rowIdx++;
  });

  // Grand Total Row
  b1.setCell(rowIdx, 1, "TOTAL", { bold: true, fill: XL_COLORS.headerFill, color: "FFFFFF", align: "center" });
  b1.setCell(rowIdx, 2, "", { fill: XL_COLORS.headerFill });
  b1.setCell(rowIdx, 3, "TOTAL KESELURUHAN DEPO", { bold: true, fill: XL_COLORS.headerFill, color: "FFFFFF" });
  b1.setCell(rowIdx, 4, "", { fill: XL_COLORS.headerFill });
  b1.setCell(rowIdx, 5, sumTargetV, { bold: true, numFmt: XL_NUMFMT_MONEY, fill: XL_COLORS.headerFill, color: "FFFFFF" });
  b1.setCell(rowIdx, 6, sumRealV, { bold: true, numFmt: XL_NUMFMT_MONEY, fill: XL_COLORS.headerFill, color: "FFFFFF" });
  b1.setCell(rowIdx, 7, sumRealV - sumTargetV, { bold: true, numFmt: XL_NUMFMT_MONEY, fill: XL_COLORS.headerFill, color: "FFFFFF" });
  b1.setCell(rowIdx, 8, sumTargetV > 0 ? sumRealV / sumTargetV : 0, { bold: true, numFmt: XL_NUMFMT_PCT1, fill: XL_COLORS.headerFill, color: "FFFFFF" });
  b1.setCell(rowIdx, 9, "", { fill: XL_COLORS.headerFill });
  b1.setCell(rowIdx, 10, summary.totalValueCommission, { bold: true, numFmt: XL_NUMFMT_MONEY, fill: XL_COLORS.headerFill, color: "FFFFFF" });
  b1.setCell(rowIdx, 11, sumTargetAo, { bold: true, numFmt: XL_NUMFMT_INT, fill: XL_COLORS.headerFill, color: "FFFFFF", align: "center" });
  b1.setCell(rowIdx, 12, sumRealAo, { bold: true, numFmt: XL_NUMFMT_INT, fill: XL_COLORS.headerFill, color: "FFFFFF", align: "center" });
  b1.setCell(rowIdx, 13, sumRealAo - sumTargetAo, { bold: true, numFmt: XL_NUMFMT_INT, fill: XL_COLORS.headerFill, color: "FFFFFF", align: "center" });
  b1.setCell(rowIdx, 14, sumTargetAo > 0 ? sumRealAo / sumTargetAo : 0, { bold: true, numFmt: XL_NUMFMT_PCT1, fill: XL_COLORS.headerFill, color: "FFFFFF" });
  b1.setCell(rowIdx, 15, "", { fill: XL_COLORS.headerFill });
  b1.setCell(rowIdx, 16, summary.totalAoBonus, { bold: true, numFmt: XL_NUMFMT_MONEY, fill: XL_COLORS.headerFill, color: "FFFFFF" });
  b1.setCell(rowIdx, 17, "", { fill: XL_COLORS.headerFill });
  b1.setCell(rowIdx, 18, summary.totalFocusBonus, { bold: true, numFmt: XL_NUMFMT_MONEY, fill: XL_COLORS.headerFill, color: "FFFFFF" });
  b1.setCell(rowIdx, 19, summary.totalPayout, { bold: true, numFmt: XL_NUMFMT_MONEY, fill: XL_COLORS.headerFill, color: "4BFF9C" });

  // Bagian Referensi Skema di Bawah Tabel Utama (Sheet 1)
  rowIdx += 2;
  b1.setCell(rowIdx, 1, "RINCIAN SKEMA & RULE INSENTIF YANG BERLAKU", { bold: true, size: 11, color: XL_COLORS.navy });
  b1.merge(rowIdx, 1, rowIdx, 10);
  rowIdx++;

  writeHeaderRow(b1, rowIdx, ["Nama Skema / Rule", "Berlaku Untuk Salesman", "Aturan Sell Out (Omset)", "Aturan Active Outlet (AO All Brand)"]);
  rowIdx++;
  schemes.forEach((sc) => {
    b1.setCell(rowIdx, 1, sc.name, { bold: true });
    b1.setCell(rowIdx, 2, sc.salesScope, { wrap: true });
    b1.setCell(rowIdx, 3, sc.valueDesc, { wrap: true });
    b1.setCell(rowIdx, 4, sc.aoDesc, { wrap: true });
    rowIdx++;
  });

  if (focusRulesSummary.length > 0) {
    rowIdx++;
    writeHeaderRow(b1, rowIdx, ["Nama Rule Fokus / EC", "Metrik & Cakupan Produk", "Berlaku Untuk Salesman", "Target & Skema Hadiah", "Syarat Gatekeeper AO"]);
    rowIdx++;
    focusRulesSummary.forEach((fr) => {
      b1.setCell(rowIdx, 1, fr.name, { bold: true });
      b1.setCell(rowIdx, 2, `${fr.metricLabel} — ${fr.productScope}`, { wrap: true });
      b1.setCell(rowIdx, 3, fr.salesScope, { wrap: true });
      b1.setCell(rowIdx, 4, `Target ${fr.targetDesc} · ${fr.rewardDesc}`, { wrap: true });
      b1.setCell(rowIdx, 5, fr.gatekeeperDesc, { wrap: true });
      rowIdx++;
    });
  }

  XLSX.utils.book_append_sheet(
    wb,
    b1.finalize([6, 14, 24, 22, 18, 18, 18, 12, 22, 18, 12, 12, 12, 12, 20, 18, 42, 18, 20]),
    "Rekap Insentif Sales"
  );

  // =========================================================================
  // SHEET 2: DETAIL PENCAPAIAN PRODUK FOKUS & EFFECTIVE CALLS PER SALESMAN
  // =========================================================================
  const b2 = makeSheetBuilder();
  writeTitleBlock(
    b2,
    `DETAIL PENCAPAIAN PRODUK FOKUS & EFFECTIVE CALLS — ${depotName}`,
    `Periode: ${periodLabel} · Dibuat: ${formatGeneratedAt()}`,
    12
  );
  writeHeaderRow(b2, 4, [
    "No",
    "Kode Sales",
    "Nama Salesman",
    "Skema Sales",
    "Nama Rule Fokus / EC",
    "Jenis Metrik",
    "Target",
    "Realisasi",
    "Satuan",
    "ACH (%)",
    "Status Evaluasi / Tier / Syarat AO",
    "Nominal Bonus (Rp)",
  ]);

  let r2 = 5;
  let seq2 = 1;
  commissions.forEach((c) => {
    const fbList = Array.isArray(c.focusBreakdown) ? c.focusBreakdown : [];
    if (fbList.length === 0) {
      b2.setCell(r2, 1, seq2++, { align: "center" });
      b2.setCell(r2, 2, c.salesCode, { align: "center" });
      b2.setCell(r2, 3, c.salesName, { bold: true });
      b2.setCell(r2, 4, c.schemeName);
      b2.setCell(r2, 5, "— Tidak ada rule Fokus/EC —");
      b2.setCell(r2, 6, "-");
      b2.setCell(r2, 7, 0, { numFmt: XL_NUMFMT_INT });
      b2.setCell(r2, 8, 0, { numFmt: XL_NUMFMT_INT });
      b2.setCell(r2, 9, "-", { align: "center" });
      b2.setCell(r2, 10, 0, { numFmt: XL_NUMFMT_PCT1 });
      b2.setCell(r2, 11, "Tidak Ada Rule");
      b2.setCell(r2, 12, 0, { numFmt: XL_NUMFMT_MONEY });
      r2++;
    } else {
      fbList.forEach((fb) => {
        const achR = (fb.achPct || 0) / 100;
        let statusStr = "";
        if (fb.isQualified) {
          statusStr = `LOLOS${fb.tierLabel ? ` — ${fb.tierLabel}` : ""}`;
        } else if (fb.qtyAchieved && !fb.aoGatekeeperPassed) {
          const failStr = fb.failedGroups.map((g) => `${g.group} (${g.currentAo}/${g.requiredAo})`).join(", ");
          statusStr = `TERTAHAN SYARAT AO: ${failStr}`;
        } else {
          statusStr = `BELUM CAPAI AMBANG (${fb.achPct}%)`;
        }

        b2.setCell(r2, 1, seq2++, { align: "center" });
        b2.setCell(r2, 2, c.salesCode, { align: "center" });
        b2.setCell(r2, 3, c.salesName, { bold: true });
        b2.setCell(r2, 4, c.schemeName);
        b2.setCell(r2, 5, fb.ruleName, { bold: true });
        b2.setCell(r2, 6, fb.metricType === "ao" ? "Effective Calls (AO Fokus)" : "Kuantitas Barang");
        b2.setCell(r2, 7, fb.targetQty || 0, { numFmt: XL_NUMFMT_INT });
        b2.setCell(r2, 8, fb.totalQty || 0, { numFmt: XL_NUMFMT_INT, bold: true });
        b2.setCell(r2, 9, fb.metricType === "ao" ? "toko" : fb.targetUnit || "ktn", { align: "center" });
        b2.setCell(r2, 10, achR, { numFmt: XL_NUMFMT_PCT1, fill: achGradientColor(achR) || undefined });
        b2.setCell(r2, 11, statusStr, { color: fb.isQualified ? "059669" : fb.qtyAchieved ? "D97706" : "6B7280" });
        b2.setCell(r2, 12, fb.bonus || 0, { numFmt: XL_NUMFMT_MONEY, bold: true });
        r2++;
      });
    }
  });

  XLSX.utils.book_append_sheet(
    wb,
    b2.finalize([6, 14, 24, 20, 28, 24, 12, 12, 12, 12, 36, 18]),
    "Detail Fokus & EC"
  );

  // =========================================================================
  // SHEET 3: PARAMETER SKEMA & RULE AKTIF
  // =========================================================================
  const b3 = makeSheetBuilder();
  writeTitleBlock(
    b3,
    `DOKUMENTASI PARAMETER SKEMA & RULE INSENTIF — ${depotName}`,
    `Periode: ${periodLabel} · Dicetak: ${formatGeneratedAt()}`,
    6
  );

  writeHeaderRow(b3, 4, [
    "No",
    "Nama Skema Sell Out & AO",
    "Cakupan Salesman",
    "Mode Sell Out",
    "Rincian Tier / Rate Sell Out",
    "Rincian Aturan AO All Brand",
  ]);

  let r3 = 5;
  schemes.forEach((sc, idx) => {
    b3.setCell(r3, 1, idx + 1, { align: "center" });
    b3.setCell(r3, 2, sc.name, { bold: true });
    b3.setCell(r3, 3, sc.salesScope, { wrap: true });
    b3.setCell(r3, 4, sc.valueModeLabel, { align: "center" });
    b3.setCell(r3, 5, sc.valueDesc, { wrap: true });
    b3.setCell(r3, 6, sc.aoDesc, { wrap: true });
    r3++;
  });

  r3 += 2;
  b3.setCell(r3, 1, "DAFTAR RULE PRODUK FOKUS & EFFECTIVE CALLS (EC)", { bold: true, size: 11, color: XL_COLORS.navy });
  b3.merge(r3, 1, r3, 6);
  r3++;

  writeHeaderRow(b3, r3, [
    "No",
    "Nama Rule Fokus / EC",
    "Jenis Metrik & Produk",
    "Cakupan Salesman",
    "Target & Skema Hadiah",
    "Syarat Gatekeeper AO",
  ]);
  r3++;

  if (focusRulesSummary.length === 0) {
    b3.setCell(r3, 1, "-", { align: "center" });
    b3.setCell(r3, 2, "Belum ada rule Produk Fokus / Effective Calls terdaftar");
  } else {
    focusRulesSummary.forEach((fr, idx) => {
      b3.setCell(r3, 1, idx + 1, { align: "center" });
      b3.setCell(r3, 2, fr.name, { bold: true });
      b3.setCell(r3, 3, `${fr.metricLabel} (${fr.productScope})`, { wrap: true });
      b3.setCell(r3, 4, fr.salesScope, { wrap: true });
      b3.setCell(r3, 5, `Target: ${fr.targetDesc} | ${fr.rewardDesc}`, { wrap: true });
      b3.setCell(r3, 6, fr.gatekeeperDesc, { wrap: true });
      r3++;
    });
  }

  XLSX.utils.book_append_sheet(wb, b3.finalize([6, 26, 34, 24, 44, 44]), "Skema & Rule Aktif");

  const safeDepot = sanitizeFilename(depotName || "Depo");
  XLSX.writeFile(wb, `Laporan_Kalkulator_Insentif_${safeDepot}_${todayLocalDateStr()}.xlsx`);
}

/* ============================================================================
   3. EXPORT PDF RESMI LANDSCAPE (.pdf)
============================================================================ */
export function exportCommissionPDF(agg, opts = {}) {
  const { depotName = "DEPO", rawRows = [] } = opts;
  const salesList = agg?.bySales || [];
  const txRows = agg?.filteredRows || rawRows || [];
  const rules = getStoredCommissionRules(depotName || "default");
  const { commissions, summary } = computeAllSalesCommissions(salesList, rules, txRows);
  const { schemes, focusRulesSummary } = buildActiveSchemesSummary(rules, salesList);
  const periodLabel = formatPeriodLabel(agg);

  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 8;

  // ---- 1. Header Bar ----
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, pageWidth, 22, "F");

  if (APP_LOGO_BASE64) {
    try {
      doc.addImage(APP_LOGO_BASE64, "PNG", pageWidth - margin - 16, 3, 16, 16);
    } catch {
      // ignore logo error
    }
  }

  doc.setTextColor(251, 191, 36);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(depotName || "DEPO", margin, 8.5);

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(9.5);
  doc.text("LAPORAN DETAIL KALKULASI KOMISI & SKEMA INSENTIF SALES", margin, 14);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(203, 213, 225);
  doc.text(
    `Periode: ${periodLabel} · Dicetak: ${formatGeneratedAt()} · Evaluasi Batas Murni (89.9% masuk 80–89%)`,
    margin,
    19
  );

  let y = 26;

  // ---- 2. KPI Summary Strip ----
  const kpiBoxes = [
    { label: "TOTAL ESTIMASI PAYOUT", value: fmtRp(summary.totalPayout), sub: `Rata-rata ${fmtRp(summary.avgPayout)}` },
    { label: "SALES LOLOS INSENTIF", value: `${summary.qualifiedSalesCount} / ${summary.totalSalesCount} Sales`, sub: "Penerima Insentif" },
    { label: "INSENTIF SELL OUT", value: fmtRp(summary.totalValueCommission), sub: "Komisi Nilai Omset" },
    { label: "INSENTIF AO ALL BRAND", value: fmtRp(summary.totalAoBonus), sub: "Bonus Toko Aktif" },
    { label: "INSENTIF FOKUS & EC", value: fmtRp(summary.totalFocusBonus), sub: `${focusRulesSummary.length} Rule Aktif` },
  ];

  const boxGap = 3;
  const boxW = (pageWidth - margin * 2 - boxGap * (kpiBoxes.length - 1)) / kpiBoxes.length;
  kpiBoxes.forEach((kb, i) => {
    const bx = margin + i * (boxW + boxGap);
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(203, 213, 225);
    doc.roundedRect(bx, y, boxW, 14, 1.5, 1.5, "FD");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.5);
    doc.setTextColor(71, 85, 105);
    doc.text(kb.label, bx + 2.5, y + 4);

    doc.setFontSize(9.5);
    doc.setTextColor(15, 23, 42);
    doc.text(kb.value, bx + 2.5, y + 9);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);
    doc.text(kb.sub, bx + 2.5, y + 12.5);
  });

  y += 18;

  // ---- 3. Tabel Utama Pencapaian & Insentif Per Salesman ----
  let sumTargetV = 0,
    sumRealV = 0,
    sumTargetAo = 0,
    sumRealAo = 0;

  const mainBody = commissions.map((c, idx) => {
    sumTargetV += c.targetValue || 0;
    sumRealV += c.realValue || 0;
    sumTargetAo += c.targetAo || 0;
    sumRealAo += c.realAo || 0;

    const devV = (c.targetValue || 0) - (c.realValue || 0);
    const devAo = (c.targetAo || 0) - (c.realAo || 0);
    const tierStr =
      c.valueMode === "flat_tier" || c.valueMode === "none"
        ? c.tierLabel
        : `${c.tierLabel} (${c.appliedRatePct}%)`;

    const fbText =
      Array.isArray(c.focusBreakdown) && c.focusBreakdown.length > 0
        ? c.focusBreakdown
            .map((fb) => {
              const u = fb.metricType === "ao" ? "toko" : fb.targetUnit || "ktn";
              const st = fb.isQualified ? "Lolos" : fb.qtyAchieved && !fb.aoGatekeeperPassed ? "Tertahan AO" : "Blm Capai";
              return `• ${fb.ruleName}: ${fmtNum(fb.totalQty)}/${fmtNum(fb.targetQty)} ${u} (${fb.achPct}% - ${st}) -> ${fmtRp(fb.bonus)}`;
            })
            .join("\n")
        : "—";

    return [
      idx + 1,
      `${c.salesName}\n(${c.salesCode})`,
      c.schemeName || "Skema Utama",
      fmtRp(c.targetValue),
      fmtRp(c.realValue),
      fmtDeviasi(devV),
      `${c.ach}%`,
      tierStr,
      fmtRp(c.valueCommission),
      `${fmtNum(c.realAo)} / ${fmtNum(c.targetAo)}\n(${c.achAo}% · Dev ${fmtDeviasiAo(devAo)})`,
      `${fmtRp(c.aoBonus)}${c.aoTierLabel ? `\n[${c.aoTierLabel}]` : ""}`,
      fbText,
      fmtRp(c.totalFocusBonus),
      fmtRp(c.totalIncentive),
    ];
  });

  const totalDevV = sumTargetV - sumRealV;
  const totalDevAo = sumTargetAo - sumRealAo;
  const totalAchVStr = sumTargetV > 0 ? ((sumRealV / sumTargetV) * 100).toFixed(1) + "%" : "0.0%";
  const totalAchAoStr = sumTargetAo > 0 ? ((sumRealAo / sumTargetAo) * 100).toFixed(1) + "%" : "0.0%";

  mainBody.push([
    "",
    "TOTAL KESELURUHAN DEPO",
    "",
    fmtRp(sumTargetV),
    fmtRp(sumRealV),
    fmtDeviasi(totalDevV),
    totalAchVStr,
    "—",
    fmtRp(summary.totalValueCommission),
    `${fmtNum(sumRealAo)} / ${fmtNum(sumTargetAo)} (${totalAchAoStr} · Dev ${fmtDeviasiAo(totalDevAo)})`,
    fmtRp(summary.totalAoBonus),
    "Subtotal Fokus & EC",
    fmtRp(summary.totalFocusBonus),
    fmtRp(summary.totalPayout),
  ]);

  autoTable(doc, {
    head: [
      [
        "No",
        "Salesman",
        "Skema Aktif",
        "Target Omset",
        "Realisasi Omset",
        "Deviasi Omset",
        "ACH",
        "Tier Sell Out",
        "Insentif Sell Out",
        "Real / Tgt AO",
        "Insentif AO",
        "Detail Produk Fokus & Effective Calls",
        "Bonus Fokus/EC",
        "Total Insentif",
      ],
    ],
    body: mainBody,
    startY: y,
    margin: { left: margin, right: margin },
    styles: {
      fontSize: 6.8,
      cellPadding: 1.6,
      textColor: [15, 23, 42],
      lineColor: [203, 213, 225],
      lineWidth: 0.1,
      valign: "middle",
    },
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: [255, 255, 255],
      fontSize: 6.8,
      fontStyle: "bold",
      halign: "center",
    },
    columnStyles: {
      0: { cellWidth: 7, halign: "center" },
      1: { cellWidth: 24, fontStyle: "bold" },
      2: { cellWidth: 20 },
      3: { cellWidth: 21, halign: "right" },
      4: { cellWidth: 21, halign: "right" },
      5: { cellWidth: 21, halign: "right" },
      6: { cellWidth: 11, halign: "center" },
      7: { cellWidth: 20, halign: "center" },
      8: { cellWidth: 19, halign: "right", fontStyle: "bold" },
      9: { cellWidth: 22, halign: "center" },
      10: { cellWidth: 19, halign: "right" },
      11: { cellWidth: "auto" },
      12: { cellWidth: 18, halign: "right" },
      13: { cellWidth: 21, halign: "right", fontStyle: "bold" },
    },
    didParseCell: (data) => {
      if (data.section === "body" && data.row.index === mainBody.length - 1) {
        data.cell.styles.fontStyle = "bold";
        data.cell.styles.fillColor = [15, 23, 42];
        data.cell.styles.textColor = [255, 255, 255];
      }
    },
  });

  y = doc.lastAutoTable.finalY + 6;

  // ---- 4. Referensi Skema & Rule yang Berlaku (Di Bawah Tabel) ----
  if (y > pageHeight - 45) {
    doc.addPage();
    y = 12;
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text("REFERENSI SKEMA & RULE INSENTIF YANG BERLAKU", margin, y);
  y += 2;

  const schemeRows = schemes.map((sc, i) => [
    i + 1,
    sc.name,
    sc.salesScope,
    sc.valueDesc,
    sc.aoDesc,
  ]);

  autoTable(doc, {
    head: [["No", "Nama Skema", "Berlaku Untuk Salesman", "Aturan Sell Out (Omset)", "Aturan Active Outlet (AO All Brand)"]],
    body: schemeRows,
    startY: y,
    margin: { left: margin, right: margin },
    styles: { fontSize: 6.8, cellPadding: 1.5, textColor: [30, 41, 59], lineColor: [203, 213, 225], lineWidth: 0.1 },
    headStyles: { fillColor: [30, 58, 138], textColor: [255, 255, 255], fontSize: 6.8, fontStyle: "bold" },
    columnStyles: {
      0: { cellWidth: 8, halign: "center" },
      1: { cellWidth: 34, fontStyle: "bold" },
      2: { cellWidth: 48 },
      3: { cellWidth: 95 },
      4: { cellWidth: "auto" },
    },
  });

  y = doc.lastAutoTable.finalY + 4;

  if (focusRulesSummary.length > 0) {
    if (y > pageHeight - 35) {
      doc.addPage();
      y = 12;
    }
    const focusRuleBody = focusRulesSummary.map((fr, i) => [
      i + 1,
      fr.name,
      `${fr.metricLabel} (${fr.productScope})`,
      fr.salesScope,
      `Target: ${fr.targetDesc} · ${fr.rewardDesc}`,
      fr.gatekeeperDesc,
    ]);

    autoTable(doc, {
      head: [["No", "Nama Rule Fokus / EC", "Metrik & Produk", "Berlaku Untuk Salesman", "Target & Skema Komisi", "Syarat Gatekeeper AO"]],
      body: focusRuleBody,
      startY: y,
      margin: { left: margin, right: margin },
      styles: { fontSize: 6.8, cellPadding: 1.5, textColor: [30, 41, 59], lineColor: [203, 213, 225], lineWidth: 0.1 },
      headStyles: { fillColor: [88, 28, 135], textColor: [255, 255, 255], fontSize: 6.8, fontStyle: "bold" },
      columnStyles: {
        0: { cellWidth: 8, halign: "center" },
        1: { cellWidth: 34, fontStyle: "bold" },
        2: { cellWidth: 48 },
        3: { cellWidth: 42 },
        4: { cellWidth: 85 },
        5: { cellWidth: "auto" },
      },
    });
  }

  // ---- Footer semua halaman ----
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text(
      `Monitoring Penjualan Sales • Versi ${APP_VERSION} • Dicetak ${formatGeneratedAt()}`,
      margin,
      pageHeight - 4
    );
    doc.text(`Halaman ${i} / ${pageCount}`, pageWidth - margin, pageHeight - 4, { align: "right" });
  }

  const safeDepot = sanitizeFilename(depotName || "Depo");
  doc.save(`Laporan_Kalkulator_Insentif_${safeDepot}_${todayLocalDateStr()}.pdf`);
}
