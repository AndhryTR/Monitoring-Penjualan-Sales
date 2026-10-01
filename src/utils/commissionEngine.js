/* ============================================================================
   SALES COMMISSION & INCENTIVE ENGINE — Sprint 20 / Phase 4 & 5
   Kalkulasi insentif dan komisi sales FMCG komprehensif:
   1. Komisi Omset Berjenjang (Tiered Accelerator based on % ACH Target)
   2. Bonus Pencapaian Sebaran Toko (Active Outlet / AO Threshold Bonus)
   3. Insentif Produk Fokus / Push Item Multi-Varian (Campur Rasa) dengan
      Prasyarat Pemerataan AO Golongan Barang (AO Gatekeeper & Checklist Groups)
   4. Penyimpanan Konfigurasi Lokal & Generator Slip Rincian WhatsApp.
============================================================================ */

import { fmtRp, fmtNum } from "./formatters.js";

export const DEFAULT_COMMISSION_RULES = {
  tier1MinAch: 85,
  tier1RatePct: 0.5,
  tier2MinAch: 100,
  tier2RatePct: 1.0,
  tier3MinAch: 110,
  tier3RatePct: 1.5,
  aoBonusEnabled: true,
  aoMinAch: 100,
  aoBonusPerOutlet: 5000,
  focusRules: [], // Daftar aturan produk fokus / dorongan multi-varian
};

const STORAGE_PREFIX = "sm_commission_rules_";

export function getStoredCommissionRules(depotName = "default") {
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${depotName}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        ...DEFAULT_COMMISSION_RULES,
        ...parsed,
        focusRules: Array.isArray(parsed.focusRules) ? parsed.focusRules : [],
      };
    }
  } catch (err) {
    console.warn("Gagal memuat aturan komisi:", err);
  }
  return { ...DEFAULT_COMMISSION_RULES, focusRules: [] };
}

export function saveStoredCommissionRules(depotName = "default", rules) {
  try {
    localStorage.setItem(`${STORAGE_PREFIX}${depotName}`, JSON.stringify(rules));
    window.dispatchEvent(new CustomEvent("sm_commission_rules_updated", { detail: { depotName, rules } }));
  } catch (err) {
    console.warn("Gagal menyimpan aturan komisi:", err);
  }
}

/**
 * Cek apakah produk atau baris transaksi cocok dengan aturan produk fokus.
 * Mendukung pencocokan kata kunci multi-varian (campur rasa), grup produk, atau multi-select SKU.
 */
export function matchProductFocusRule(product = {}, rule = {}) {
  if (!rule) return false;
  const mode = rule.matchMode || "keyword";

  if (mode === "keyword") {
    const kw = (rule.keyword || "").trim().toLowerCase();
    if (!kw) return false;
    const pName = (product.productName || product.name || "").toLowerCase();
    const pCode = (product.productCode || product.code || "").toLowerCase();
    return pName.includes(kw) || pCode.includes(kw);
  }

  if (mode === "group") {
    const gName = (rule.groupName || "").trim().toLowerCase();
    const pGroup = (product.group || product.groupName || "").toLowerCase();
    return pGroup === gName;
  }

  if (mode === "skus") {
    const code = (product.productCode || product.code || "").trim();
    return Array.isArray(rule.skuCodes) && rule.skuCodes.includes(code);
  }

  return false;
}

/**
 * Hitung insentif produk fokus beserta evaluasi Gatekeeper AO per salesman
 */
export function calculateFocusProductIncentiveForSales(salesCode, transactionRows = [], focusRules = []) {
  if (!salesCode || !Array.isArray(focusRules) || focusRules.length === 0) {
    return { totalFocusBonus: 0, focusBreakdown: [] };
  }

  // 1. Filter baris transaksi salesman ini
  const salesRows = transactionRows.filter((r) => r.salesCode === salesCode);

  // 2. Hitung sebaran AO per golongan barang salesman ini
  const groupAoMap = new Map();
  for (const r of salesRows) {
    const grp = (r.group || "LAINNYA").trim();
    if (!groupAoMap.has(grp)) {
      groupAoMap.set(grp, new Set());
    }
    if (r.outletCode) {
      groupAoMap.get(grp).add(r.outletCode);
    }
  }

  let totalFocusBonus = 0;
  const focusBreakdown = [];

  for (const rule of focusRules) {
    // Kumpulkan baris yang cocok dengan aturan (misal semua varian rasa Taro 65g)
    const matchingRows = salesRows.filter((r) => matchProductFocusRule(r, rule));
    const totalQty = matchingRows.reduce((sum, r) => sum + (Number(r.qty) || 0), 0);
    const targetQty = Number(rule.targetQty || 0);
    const qtyAchieved = totalQty >= targetQty && targetQty > 0;

    // Evaluasi AO Gatekeeper (Prasyarat Pemerataan Golongan Barang)
    const gatekeeperMode = rule.aoGatekeeperMode || "none"; // "none" | "this_group" | "selected_groups" | "all_groups"
    const minAo = Number(rule.aoGatekeeperMin || 120);
    let aoGatekeeperPassed = true;
    const failedGroups = [];

    if (gatekeeperMode === "this_group") {
      // Golongan barang produk fokus tersebut
      const relevantGroups = new Set(matchingRows.map((r) => (r.group || "LAINNYA").trim()));
      for (const g of relevantGroups) {
        const currentAo = groupAoMap.get(g)?.size || 0;
        if (currentAo < minAo) {
          failedGroups.push({ group: g, currentAo, requiredAo: minAo });
        }
      }
      aoGatekeeperPassed = failedGroups.length === 0;
    } else if (gatekeeperMode === "selected_groups") {
      // Golongan barang tertentu yang dicentang oleh user
      const selected = Array.isArray(rule.aoGatekeeperGroups) ? rule.aoGatekeeperGroups : [];
      for (const g of selected) {
        const currentAo = groupAoMap.get(g)?.size || 0;
        if (currentAo < minAo) {
          failedGroups.push({ group: g, currentAo, requiredAo: minAo });
        }
      }
      aoGatekeeperPassed = failedGroups.length === 0;
    } else if (gatekeeperMode === "all_groups") {
      // Seluruh golongan barang yang dibawa salesman ini
      for (const [g, set] of groupAoMap.entries()) {
        const currentAo = set.size;
        if (currentAo < minAo) {
          failedGroups.push({ group: g, currentAo, requiredAo: minAo });
        }
      }
      aoGatekeeperPassed = failedGroups.length === 0;
    }

    const isQualified = qtyAchieved && aoGatekeeperPassed;
    let bonus = 0;

    if (isQualified) {
      if (rule.rewardType === "flat") {
        bonus = Number(rule.rewardRate || 0);
      } else {
        // per_unit
        bonus = Math.round(totalQty * Number(rule.rewardRate || 0));
      }
    }

    totalFocusBonus += bonus;

    focusBreakdown.push({
      ruleId: rule.id,
      ruleName: rule.name || "Program Produk Fokus",
      matchMode: rule.matchMode || "keyword",
      keyword: rule.keyword || "",
      totalQty,
      targetQty,
      targetUnit: rule.targetUnit || "ktn/pcs",
      qtyAchieved,
      gatekeeperMode,
      minAo,
      aoGatekeeperPassed,
      failedGroups,
      isQualified,
      rewardType: rule.rewardType || "per_unit",
      rewardRate: Number(rule.rewardRate || 0),
      bonus,
    });
  }

  return { totalFocusBonus, focusBreakdown };
}

/**
 * Hitung komisi untuk satu sales
 */
export function calculateSingleSalesCommission(sales, rules = DEFAULT_COMMISSION_RULES, transactionRows = []) {
  const realValue = Number(sales.realisasiValue || sales.value || 0);
  const targetValue = Number(sales.targetValue || 0);
  const ach = targetValue > 0 ? (realValue / targetValue) * 100 : (sales.ach ?? 0);

  const realAo = Number(sales.realisasiAo || sales.ao || 0);
  const targetAo = Number(sales.targetAo || 0);
  const achAo = targetAo > 0 ? (realAo / targetAo) * 100 : (sales.achAo ?? 0);

  let appliedRatePct = 0;
  let tierLabel = "Tidak Capai Ambang";
  let tierColor = "#EF4444"; // red

  if (ach >= rules.tier3MinAch) {
    appliedRatePct = rules.tier3RatePct;
    tierLabel = `Tier 3 (≥${rules.tier3MinAch}%)`;
    tierColor = "#10B981"; // green / mint
  } else if (ach >= rules.tier2MinAch) {
    appliedRatePct = rules.tier2RatePct;
    tierLabel = `Tier 2 (≥${rules.tier2MinAch}%)`;
    tierColor = "#3B82F6"; // blue
  } else if (ach >= rules.tier1MinAch) {
    appliedRatePct = rules.tier1RatePct;
    tierLabel = `Tier 1 (≥${rules.tier1MinAch}%)`;
    tierColor = "#F59E0B"; // gold / warning
  }

  const valueCommission = Math.round((realValue * appliedRatePct) / 100);

  let aoBonus = 0;
  let aoBonusQualified = false;
  if (rules.aoBonusEnabled && achAo >= rules.aoMinAch) {
    aoBonusQualified = true;
    aoBonus = Math.round(realAo * rules.aoBonusPerOutlet);
  }

  // Hitung insentif produk fokus (multi-varian + AO gatekeeper)
  const salesCode = sales.code || sales.salesCode || "";
  const { totalFocusBonus, focusBreakdown } = calculateFocusProductIncentiveForSales(
    salesCode,
    transactionRows,
    rules.focusRules || []
  );

  const totalIncentive = valueCommission + aoBonus + totalFocusBonus;

  return {
    salesCode,
    salesName: sales.name || sales.salesName || "",
    realValue,
    targetValue,
    ach: Number(ach.toFixed(1)),
    appliedRatePct,
    tierLabel,
    tierColor,
    valueCommission,
    realAo,
    targetAo,
    achAo: Number(achAo.toFixed(1)),
    aoBonusQualified,
    aoBonus,
    totalFocusBonus,
    focusBreakdown,
    totalIncentive,
  };
}

/**
 * Hitung komisi untuk seluruh daftar sales
 */
export function computeAllSalesCommissions(salesList = [], rules = DEFAULT_COMMISSION_RULES, transactionRows = []) {
  if (!Array.isArray(salesList) || salesList.length === 0) {
    return {
      commissions: [],
      summary: {
        totalPayout: 0,
        totalValueCommission: 0,
        totalAoBonus: 0,
        totalFocusBonus: 0,
        qualifiedSalesCount: 0,
        totalSalesCount: 0,
        avgPayout: 0,
      },
    };
  }

  const commissions = salesList.map((s) => calculateSingleSalesCommission(s, rules, transactionRows));
  commissions.sort((a, b) => b.totalIncentive - a.totalIncentive);

  const totalSalesCount = commissions.length;
  let totalPayout = 0;
  let totalValueCommission = 0;
  let totalAoBonus = 0;
  let totalFocusBonus = 0;
  let qualifiedSalesCount = 0;

  commissions.forEach((c) => {
    totalPayout += c.totalIncentive;
    totalValueCommission += c.valueCommission;
    totalAoBonus += c.aoBonus;
    totalFocusBonus += c.totalFocusBonus;
    if (c.totalIncentive > 0) qualifiedSalesCount++;
  });

  const avgPayout = qualifiedSalesCount > 0 ? Math.round(totalPayout / qualifiedSalesCount) : 0;

  return {
    commissions,
    summary: {
      totalPayout,
      totalValueCommission,
      totalAoBonus,
      totalFocusBonus,
      qualifiedSalesCount,
      totalSalesCount,
      avgPayout,
    },
  };
}

/**
 * Format teks slip komisi untuk disalin ke WhatsApp
 */
export function formatCommissionWhatsAppSlip(item, depotName = "") {
  const dateStr = new Date().toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  let focusLines = "";
  if (Array.isArray(item.focusBreakdown) && item.focusBreakdown.length > 0) {
    focusLines = "\n-----------------------------------------\n*Bonus Produk Fokus (Push SKU):*\n";
    item.focusBreakdown.forEach((fb) => {
      if (fb.isQualified) {
        focusLines += `• *${fb.ruleName}*: ${fmtNum(fb.totalQty)} / ${fmtNum(fb.targetQty)} ${fb.targetUnit || "ktn/pcs"} (*Lolos*) -> ${fmtRp(fb.bonus)}\n`;
      } else if (fb.qtyAchieved && !fb.aoGatekeeperPassed) {
        const failText = fb.failedGroups.map((g) => `${g.group} ${g.currentAo}/${g.requiredAo} toko`).join(", ");
        focusLines += `• *${fb.ruleName}*: ${fmtNum(fb.totalQty)} / ${fmtNum(fb.targetQty)} ${fb.targetUnit || "ktn/pcs"} (_Tertahan Syarat AO: ${failText}_) -> Rp 0\n`;
      } else {
        focusLines += `• *${fb.ruleName}*: ${fmtNum(fb.totalQty)} / ${fmtNum(fb.targetQty)} ${fb.targetUnit || "ktn/pcs"} (_Belum Capai Target Qty_) -> Rp 0\n`;
      }
    });
    focusLines += `Subtotal Produk Fokus: ${fmtRp(item.totalFocusBonus)}\n`;
  }

  return `*ESTIMASI SLIP KOMISI & INSENTIF SALES*
Tanggal Cetak: ${dateStr}
${depotName ? `Depot: ${depotName}\n` : ""}Sales: *${item.salesName}* (${item.salesCode})
-----------------------------------------
Target Omset : ${fmtRp(item.targetValue)}
Realisasi    : ${fmtRp(item.realValue)} (*${item.ach}%*)
Status Tier  : ${item.tierLabel} (${item.appliedRatePct}%)

Target AO    : ${fmtNum(item.targetAo)} toko
Realisasi AO : ${fmtNum(item.realAo)} toko (*${item.achAo}%*)
Status AO    : ${item.aoBonusQualified ? "Tercapai (Bonus AO Aktif)" : "Belum Capai Target AO"}
-----------------------------------------
Komisi Omset : ${fmtRp(item.valueCommission)}
Bonus AO     : ${fmtRp(item.aoBonus)}${focusLines}-----------------------------------------
*TOTAL ESTIMASI INSENTIF: ${fmtRp(item.totalIncentive)}*
-----------------------------------------
_Catatan: Angka di atas merupakan estimasi sistem berdasarkan data penjualan berjalan._`;
}
