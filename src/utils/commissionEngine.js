/* ============================================================================
   SALES COMMISSION & INCENTIVE ENGINE — Sprint 20 / Phase 4, 5 & 6
   Kalkulasi insentif dan komisi sales FMCG komprehensif:
   1. Komisi Omset Berjenjang (% dari Omset ATAU Tier Nominal Tetap Rp / Bobot)
   2. Bonus Pencapaian Sebaran Toko (Active Outlet / AO Per Toko ATAU Tier Nominal Tetap Rp)
   3. Multi-Skema / Rule Per Salesman: setiap skema utama maupun skema tambahan
      serta aturan Produk Fokus / Effective Calls dapat diatur berlaku untuk
      Semua Sales atau Sales Tertentu saja.
   4. Penyimpanan Konfigurasi Lokal & Generator Slip Rincian WhatsApp.
============================================================================ */

import { fmtRp, fmtNum } from "./formatters.js";
import { effectiveKartonQty } from "./excelParse.js";

export const DEFAULT_FLAT_TIERS = [
  { minAch: 80, amount: 75000 },
  { minAch: 90, amount: 100000 },
  { minAch: 95, amount: 150000 },
  { minAch: 100, amount: 200000 },
];

export const DEFAULT_COMMISSION_RULES = {
  // Pengaturan Cakupan Sales untuk Skema Utama
  schemeName: "Skema Utama (Default)",
  salesFilterMode: "all", // "all" (Semua Sales) | "selected" (Hanya Sales Terpilih)
  assignedSales: [], // Array of salesCode jika salesFilterMode === "selected"

  // 1. Insentif Sell Out / Omset (Skema Utama)
  valueMode: "percentage", // "percentage" (% dari omset) | "flat_tier" (Nominal Rp berjenjang / bobot) | "none" (Nonaktif)
  tier1MinAch: 85,
  tier1RatePct: 0.5,
  tier2MinAch: 100,
  tier2RatePct: 1.0,
  tier3MinAch: 110,
  tier3RatePct: 1.5,
  valueTiers: DEFAULT_FLAT_TIERS.map((t) => ({ ...t })),

  // 2. Insentif Active Outlet / AO All Brand (Skema Utama)
  aoBonusEnabled: true,
  aoMode: "per_outlet", // "per_outlet" (Rp per toko) | "flat_tier" (Nominal Rp berjenjang / bobot)
  aoTargetOverride: 0, // 0 = gunakan target AO dari master sales, >0 = target AO seragam (misal 275)
  aoMinAch: 100,
  aoBonusPerOutlet: 5000,
  aoTiers: DEFAULT_FLAT_TIERS.map((t) => ({ ...t })),

  // Daftar Skema / Rule Tambahan Khusus Salesman Tertentu
  customSchemes: [],

  // 3. Daftar aturan Produk Fokus & Effective Calls (AO Produk Fokus)
  focusRules: [],
};

const STORAGE_PREFIX = "sm_commission_rules_";

/**
 * Potong persentase ke 1 desimal ke bawah (dengan toleransi epsilon floating-point)
 * agar 89.99% tetap tampil 89.9% (masuk tier 80-89%) dan harus murni mencapai 90.0% untuk naik tier.
 */
export function floorPct1(rawPct) {
  const n = Number(rawPct);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.floor((n + 1e-9) * 10) / 10;
}

/**
 * Evaluasi daftar tier nominal tetap (misal 80%->75rb, 90%->100rb, 95%->150rb, 100%->200rb).
 * Mengembalikan tier yang dicapai berdasarkan prinsip >= minAch murni (89.9% masuk 80-89%).
 */
export function evaluateFlatTiers(rawAchPct, tiers = DEFAULT_FLAT_TIERS) {
  const ach = Number(rawAchPct) || 0;
  const validTiers = (Array.isArray(tiers) && tiers.length > 0 ? tiers : DEFAULT_FLAT_TIERS)
    .map((t) => ({ minAch: Number(t.minAch) || 0, amount: Number(t.amount) || 0 }))
    .filter((t) => t.minAch > 0)
    .sort((a, b) => a.minAch - b.minAch);

  if (validTiers.length === 0) {
    return {
      qualified: false,
      amount: 0,
      tierIndex: -1,
      tierLabel: "Tidak Capai Ambang",
      tierShortLabel: "—",
      tierColor: "#EF4444",
    };
  }

  let matchedIdx = -1;
  for (let i = validTiers.length - 1; i >= 0; i--) {
    if (ach + 1e-9 >= validTiers[i].minAch) {
      matchedIdx = i;
      break;
    }
  }

  if (matchedIdx === -1) {
    return {
      qualified: false,
      amount: 0,
      tierIndex: -1,
      tierLabel: `< ${validTiers[0].minAch}% (Tidak Capai)`,
      tierShortLabel: "—",
      tierColor: "#EF4444",
    };
  }

  const matched = validTiers[matchedIdx];
  const nextTier = validTiers[matchedIdx + 1];
  const isTopTier = !nextTier;
  const maxBound = nextTier ? Math.max(matched.minAch, nextTier.minAch - 1) : null;
  const rangeStr = isTopTier ? `${matched.minAch}% UP` : `${matched.minAch}% - ${maxBound}%`;

  const palette = ["#F59E0B", "#8B5CF6", "#3B82F6", "#10B981"];
  const colorIdx = isTopTier
    ? 3
    : Math.min(2, Math.floor((matchedIdx / Math.max(1, validTiers.length - 1)) * 3));

  return {
    qualified: true,
    amount: Math.round(matched.amount),
    tierIndex: matchedIdx + 1,
    tierLabel: `Tier ${matchedIdx + 1} (${rangeStr})`,
    tierShortLabel: rangeStr,
    tierColor: palette[colorIdx] || "#10B981",
  };
}

export function getStoredCommissionRules(depotName = "default") {
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${depotName}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        ...DEFAULT_COMMISSION_RULES,
        ...parsed,
        assignedSales: Array.isArray(parsed.assignedSales) ? parsed.assignedSales : [],
        valueTiers:
          Array.isArray(parsed.valueTiers) && parsed.valueTiers.length > 0
            ? parsed.valueTiers
            : DEFAULT_FLAT_TIERS.map((t) => ({ ...t })),
        aoTiers:
          Array.isArray(parsed.aoTiers) && parsed.aoTiers.length > 0
            ? parsed.aoTiers
            : DEFAULT_FLAT_TIERS.map((t) => ({ ...t })),
        customSchemes: Array.isArray(parsed.customSchemes) ? parsed.customSchemes : [],
        focusRules: Array.isArray(parsed.focusRules) ? parsed.focusRules : [],
      };
    }
  } catch (err) {
    console.warn("Gagal memuat aturan komisi:", err);
  }
  return {
    ...DEFAULT_COMMISSION_RULES,
    assignedSales: [],
    valueTiers: DEFAULT_FLAT_TIERS.map((t) => ({ ...t })),
    aoTiers: DEFAULT_FLAT_TIERS.map((t) => ({ ...t })),
    customSchemes: [],
    focusRules: [],
  };
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
 * Cek apakah salesman masuk dalam cakupan suatu rule/skema
 */
export function isSalesmanIncludedInRule(salesCode, salesName, filterMode = "all", assignedList = []) {
  if (!filterMode || filterMode === "all") return true;
  if (!Array.isArray(assignedList) || assignedList.length === 0) return false;
  const codeNorm = String(salesCode || "").trim().toLowerCase();
  const nameNorm = String(salesName || "").trim().toLowerCase();
  return assignedList.some((item) => {
    const v = String(item || "").trim().toLowerCase();
    return v && (v === codeNorm || v === nameNorm);
  });
}

/**
 * Tentukan skema Sell Out & AO mana yang berlaku untuk seorang salesman.
 * Prioritas:
 * 1. Custom Scheme (Rule Tambahan) yang aktif dan mencantumkan sales tersebut (atau diset "all").
 * 2. Skema Utama (Default) jika sales tersebut termasuk dalam cakupan Skema Utama.
 * 3. null jika salesman dikecualikan dari semua skema.
 */
export function resolveSchemeForSales(sales, rules = DEFAULT_COMMISSION_RULES) {
  const salesCode = sales.code || sales.salesCode || "";
  const salesName = sales.name || sales.salesName || "";

  const customSchemes = Array.isArray(rules.customSchemes) ? rules.customSchemes : [];
  for (const cs of customSchemes) {
    if (cs.enabled === false) continue;
    const mode = cs.salesFilterMode || "selected";
    if (isSalesmanIncludedInRule(salesCode, salesName, mode, cs.assignedSales)) {
      return {
        ...DEFAULT_COMMISSION_RULES,
        ...cs,
        schemeName: cs.name || "Skema Khusus",
        isCustomScheme: true,
      };
    }
  }

  // Cek apakah masuk ke Skema Utama
  const mainFilterMode = rules.salesFilterMode || "all";
  if (isSalesmanIncludedInRule(salesCode, salesName, mainFilterMode, rules.assignedSales)) {
    return {
      ...DEFAULT_COMMISSION_RULES,
      ...rules,
      schemeName: rules.schemeName || "Skema Utama",
      isCustomScheme: false,
    };
  }

  return null;
}

/**
 * Cek apakah baris transaksi cocok dengan daftar produk fokus dari Master Target salesman
 */
function matchSalesMasterFocus(product = {}, sales = {}) {
  const focusItems = Array.isArray(sales?.focus) ? sales.focus : [];
  const focusGroups = Array.isArray(sales?.focusGroups) ? sales.focusGroups : [];

  const pName = (product.productName || product.name || "").trim().toLowerCase();
  const pCode = (product.productCode || product.code || "").trim().toLowerCase();
  const pGroup = (product.group || product.groupName || "").trim().toLowerCase();

  for (const fg of focusGroups) {
    const gName = (fg.name || "").trim().toLowerCase();
    if (gName && pGroup === gName) return true;
  }

  for (const f of focusItems) {
    const matchType =
      f.matchType ||
      (f.keyword === "__GROUP__" ? "group" : f.keyword === "GAS_EXACT" ? "exact" : "contains");
    if (matchType === "group") {
      const fName = (f.name || "").trim().toLowerCase();
      if (fName && pGroup === fName) return true;
    } else if (matchType === "exact") {
      const target = (f.keyword === "GAS_EXACT" ? "gas" : f.keyword || "").trim().toLowerCase();
      if (target && pName === target) return true;
    } else {
      const kw = (f.keyword || f.name || "").trim().toLowerCase();
      if (kw && (pName.includes(kw) || pCode.includes(kw))) return true;
    }
  }

  return false;
}

/**
 * Cek apakah produk atau baris transaksi cocok dengan aturan produk fokus / Effective Calls.
 * Mendukung pencocokan kata kunci (termasuk dipisah koma), grup produk, master_focus, atau multi-select SKU.
 */
export function matchProductFocusRule(product = {}, rule = {}, sales = {}) {
  if (!rule) return false;
  const mode = rule.matchMode || "keyword";

  if (mode === "master_focus") {
    return matchSalesMasterFocus(product, sales);
  }

  if (mode === "keyword") {
    const rawKw = (rule.keyword || "").trim().toLowerCase();
    if (!rawKw) return false;
    const keywords = rawKw
      .split(",")
      .map((k) => k.trim())
      .filter(Boolean);
    if (keywords.length === 0) return false;
    const pName = (product.productName || product.name || "").toLowerCase();
    const pCode = (product.productCode || product.code || "").toLowerCase();
    return keywords.some((kw) => pName.includes(kw) || pCode.includes(kw));
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
 * Hitung insentif produk fokus & Effective Calls beserta evaluasi Gatekeeper AO per salesman
 */
export function calculateFocusProductIncentiveForSales(salesOrCode, transactionRows = [], focusRules = []) {
  const salesObj = typeof salesOrCode === "object" && salesOrCode !== null ? salesOrCode : { code: salesOrCode };
  const salesCode = salesObj.code || salesObj.salesCode || "";
  const salesName = salesObj.name || salesObj.salesName || "";

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
    // Cek apakah aturan ini berlaku untuk salesman ini
    const filterMode = rule.salesFilterMode || "all";
    if (!isSalesmanIncludedInRule(salesCode, salesName, filterMode, rule.assignedSales)) {
      continue;
    }

    const matchingRows = salesRows.filter((r) => matchProductFocusRule(r, rule, salesObj));
    const metricType = rule.metricType || "qty"; // "qty" (Kuantitas Barang) | "ao" (Effective Calls / Toko Unik)

    let totalQty = 0;
    let targetUnitLabel = rule.targetUnit || "ktn";

    if (metricType === "ao") {
      // Effective Calls: Hitung jumlah outlet unik yang membeli produk fokus ini
      const uniqueOutlets = new Set();
      for (const r of matchingRows) {
        if (r.outletCode) uniqueOutlets.add(r.outletCode);
      }
      totalQty = uniqueOutlets.size;
      targetUnitLabel = "toko";
    } else {
      // Kuantitas barang (karton atau satuan dasar)
      const targetUnitRaw = String(rule.targetUnit || "ktn").trim().toLowerCase();
      const isKarton = targetUnitRaw === "ktn" || targetUnitRaw === "karton" || targetUnitRaw === "krt";

      totalQty = matchingRows.reduce((sum, r) => {
        let q = 0;
        if (isKarton) {
          q = effectiveKartonQty(r);
        } else {
          const txnUnit = String(r.unit || "").trim().toUpperCase();
          if (txnUnit === "PCS" || !txnUnit) {
            q = Number(r.qty) || 0;
          } else {
            q = r.konv && r.konv > 0 ? (Number(r.qty) || 0) * r.konv : Number(r.qty) || 0;
          }
        }
        return sum + q;
      }, 0);
    }

    const targetQty = Number(rule.targetQty || 0);
    const rawAchPct = targetQty > 0 ? (totalQty / targetQty) * 100 : 0;
    const achPct = floorPct1(rawAchPct);

    // Evaluasi AO Gatekeeper (Prasyarat Pemerataan Golongan Barang)
    const gatekeeperMode = rule.aoGatekeeperMode || "none";
    const minAo = Number(rule.aoGatekeeperMin || 120);
    let aoGatekeeperPassed = true;
    const failedGroups = [];

    if (gatekeeperMode === "this_group") {
      const relevantGroups = new Set(matchingRows.map((r) => (r.group || "LAINNYA").trim()));
      for (const g of relevantGroups) {
        const currentAo = groupAoMap.get(g)?.size || 0;
        if (currentAo < minAo) {
          failedGroups.push({ group: g, currentAo, requiredAo: minAo });
        }
      }
      aoGatekeeperPassed = failedGroups.length === 0;
    } else if (gatekeeperMode === "selected_groups") {
      const selected = Array.isArray(rule.aoGatekeeperGroups) ? rule.aoGatekeeperGroups : [];
      for (const g of selected) {
        const currentAo = groupAoMap.get(g)?.size || 0;
        if (currentAo < minAo) {
          failedGroups.push({ group: g, currentAo, requiredAo: minAo });
        }
      }
      aoGatekeeperPassed = failedGroups.length === 0;
    } else if (gatekeeperMode === "all_groups") {
      for (const [g, set] of groupAoMap.entries()) {
        const currentAo = set.size;
        if (currentAo < minAo) {
          failedGroups.push({ group: g, currentAo, requiredAo: minAo });
        }
      }
      aoGatekeeperPassed = failedGroups.length === 0;
    }

    const rewardType = rule.rewardType || "per_unit"; // "per_unit" | "flat" | "tiered_pct"
    let qtyAchieved = false;
    let isQualified = false;
    let bonus = 0;
    let tierLabel = "";

    if (rewardType === "tiered_pct") {
      const tierEval = evaluateFlatTiers(rawAchPct, rule.tiers || DEFAULT_FLAT_TIERS);
      qtyAchieved = tierEval.qualified && targetQty > 0;
      isQualified = qtyAchieved && aoGatekeeperPassed;
      bonus = isQualified ? tierEval.amount : 0;
      tierLabel = tierEval.tierLabel;
    } else {
      qtyAchieved = totalQty + 1e-9 >= targetQty && targetQty > 0;
      isQualified = qtyAchieved && aoGatekeeperPassed;
      if (isQualified) {
        if (rewardType === "flat") {
          bonus = Number(rule.rewardRate || 0);
        } else {
          bonus = Math.round(totalQty * Number(rule.rewardRate || 0));
        }
      }
    }

    totalFocusBonus += bonus;

    focusBreakdown.push({
      ruleId: rule.id,
      ruleName: rule.name || (metricType === "ao" ? "Effective Calls (AO Fokus)" : "Program Produk Fokus"),
      metricType,
      matchMode: rule.matchMode || "keyword",
      keyword: rule.keyword || "",
      groupName: rule.groupName || "",
      totalQty: Math.round(totalQty * 100) / 100,
      targetQty,
      targetUnit: targetUnitLabel,
      achPct,
      qtyAchieved,
      gatekeeperMode,
      minAo,
      aoGatekeeperPassed,
      failedGroups,
      isQualified,
      rewardType,
      rewardRate: Number(rule.rewardRate || 0),
      tierLabel,
      bonus,
    });
  }

  return { totalFocusBonus, focusBreakdown };
}

/**
 * Hitung komisi untuk satu sales
 */
export function calculateSingleSalesCommission(sales, rules = DEFAULT_COMMISSION_RULES, transactionRows = []) {
  const activeScheme = resolveSchemeForSales(sales, rules);

  const realValue = Number(sales.realisasiValue || sales.value || 0);
  const targetValue = Number(sales.targetValue || 0);
  const rawAch = targetValue > 0 ? (realValue / targetValue) * 100 : Number(sales.ach ?? 0) * 100;
  const ach = floorPct1(rawAch);

  const realAo = Number(sales.realisasiAo || sales.ao || 0);
  const overrideAo = Number(activeScheme?.aoTargetOverride || 0);
  const targetAo = overrideAo > 0 ? overrideAo : Number(sales.targetAo || 0);
  const rawAchAo = targetAo > 0 ? (realAo / targetAo) * 100 : Number(sales.achAo ?? 0) * 100;
  const achAo = floorPct1(rawAchAo);

  let valueMode = activeScheme?.valueMode || "percentage";
  let appliedRatePct = 0;
  let tierLabel = "Tidak Capai Ambang";
  let tierShortLabel = "—";
  let tierColor = "#EF4444";
  let valueCommission = 0;

  let aoMode = activeScheme?.aoMode || "per_outlet";
  let aoBonus = 0;
  let aoBonusQualified = false;
  let aoTierLabel = "";

  if (!activeScheme) {
    // Salesman tidak masuk dalam skema Sell Out / AO mana pun
    valueMode = "none";
    tierLabel = "Tidak Masuk Skema";
    tierShortLabel = "—";
    tierColor = "#64748B";
  } else {
    // 1. Evaluasi Komisi Omset / Sell Out berdasarkan activeScheme
    if (valueMode === "none") {
      tierLabel = "Sell Out Nonaktif";
      tierShortLabel = "—";
      tierColor = "#64748B";
      valueCommission = 0;
      appliedRatePct = null;
    } else if (valueMode === "flat_tier") {
      const valEval = evaluateFlatTiers(rawAch, activeScheme.valueTiers);
      valueCommission = targetValue > 0 ? valEval.amount : 0;
      tierLabel = valEval.tierLabel;
      tierShortLabel = valEval.tierShortLabel;
      tierColor = valEval.tierColor;
      appliedRatePct = null;
    } else {
      if (rawAch + 1e-9 >= activeScheme.tier3MinAch) {
        appliedRatePct = activeScheme.tier3RatePct;
        tierLabel = `Tier 3 (≥${activeScheme.tier3MinAch}%)`;
        tierShortLabel = `${activeScheme.tier3RatePct}%`;
        tierColor = "#10B981"; // green / mint
      } else if (rawAch + 1e-9 >= activeScheme.tier2MinAch) {
        appliedRatePct = activeScheme.tier2RatePct;
        tierLabel = `Tier 2 (≥${activeScheme.tier2MinAch}%)`;
        tierShortLabel = `${activeScheme.tier2RatePct}%`;
        tierColor = "#3B82F6"; // blue
      } else if (rawAch + 1e-9 >= activeScheme.tier1MinAch) {
        appliedRatePct = activeScheme.tier1RatePct;
        tierLabel = `Tier 1 (≥${activeScheme.tier1MinAch}%)`;
        tierShortLabel = `${activeScheme.tier1RatePct}%`;
        tierColor = "#F59E0B"; // gold / warning
      }
      valueCommission = Math.round((realValue * appliedRatePct) / 100);
    }

    // 2. Evaluasi Bonus Active Outlet (AO All Brand) berdasarkan activeScheme
    if (activeScheme.aoBonusEnabled) {
      if (aoMode === "flat_tier") {
        const aoEval = evaluateFlatTiers(rawAchAo, activeScheme.aoTiers);
        aoBonusQualified = aoEval.qualified && targetAo > 0;
        aoBonus = aoBonusQualified ? aoEval.amount : 0;
        aoTierLabel = aoEval.tierLabel;
      } else {
        if (rawAchAo + 1e-9 >= activeScheme.aoMinAch && targetAo > 0) {
          aoBonusQualified = true;
          aoBonus = Math.round(realAo * activeScheme.aoBonusPerOutlet);
          aoTierLabel = `≥${activeScheme.aoMinAch}% (Rp ${fmtNum(activeScheme.aoBonusPerOutlet)}/toko)`;
        }
      }
    }
  }

  // 3. Evaluasi Insentif Produk Fokus & Effective Calls (masing-masing rule punya filter sales sendiri)
  const salesCode = sales.code || sales.salesCode || "";
  const { totalFocusBonus, focusBreakdown } = calculateFocusProductIncentiveForSales(
    sales,
    transactionRows,
    rules.focusRules || []
  );

  const totalIncentive = valueCommission + aoBonus + totalFocusBonus;

  return {
    salesCode,
    salesName: sales.name || sales.salesName || "",
    schemeName: activeScheme ? activeScheme.schemeName : "Tidak Masuk Skema",
    isCustomScheme: Boolean(activeScheme?.isCustomScheme),
    realValue,
    targetValue,
    ach,
    valueMode,
    appliedRatePct,
    tierLabel,
    tierShortLabel,
    tierColor,
    valueCommission,
    realAo,
    targetAo,
    achAo,
    aoMode,
    aoBonusQualified,
    aoTierLabel,
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
    focusLines = "\n-----------------------------------------\n*Insentif Produk Fokus / Effective Calls:*\n";
    item.focusBreakdown.forEach((fb) => {
      const unitStr = fb.metricType === "ao" ? "toko" : fb.targetUnit || "ktn/pcs";
      const pctInfo = fb.targetQty > 0 ? ` (${fb.achPct}%)` : "";
      if (fb.isQualified) {
        const tierInfo = fb.tierLabel ? ` [${fb.tierLabel}]` : "";
        focusLines += `• *${fb.ruleName}*: ${fmtNum(fb.totalQty)} / ${fmtNum(fb.targetQty)} ${unitStr}${pctInfo}${tierInfo} (*Lolos*) -> ${fmtRp(fb.bonus)}\n`;
      } else if (fb.qtyAchieved && !fb.aoGatekeeperPassed) {
        const failText = fb.failedGroups.map((g) => `${g.group} ${g.currentAo}/${g.requiredAo} toko`).join(", ");
        focusLines += `• *${fb.ruleName}*: ${fmtNum(fb.totalQty)} / ${fmtNum(fb.targetQty)} ${unitStr}${pctInfo} (_Tertahan Syarat AO: ${failText}_) -> Rp 0\n`;
      } else {
        focusLines += `• *${fb.ruleName}*: ${fmtNum(fb.totalQty)} / ${fmtNum(fb.targetQty)} ${unitStr}${pctInfo} (_Belum Capai Ambang_) -> Rp 0\n`;
      }
    });
    focusLines += `Subtotal Fokus/EC: ${fmtRp(item.totalFocusBonus)}\n`;
  }

  const valueTierText =
    item.valueMode === "flat_tier"
      ? `${item.tierLabel} (Bobot Nominal)`
      : item.valueMode === "none"
      ? item.tierLabel
      : `${item.tierLabel} (${item.appliedRatePct}%)`;

  const aoStatusText = item.aoBonusQualified
    ? `Tercapai ${item.aoTierLabel ? `[${item.aoTierLabel}]` : "(Bonus AO Aktif)"}`
    : "Belum Capai Ambang AO";

  return `*ESTIMASI SLIP KOMISI & INSENTIF SALES*
Tanggal Cetak: ${dateStr}
${depotName ? `Depot: ${depotName}\n` : ""}Sales: *${item.salesName}* (${item.salesCode})
Skema Aktif: *${item.schemeName || "Skema Utama"}*
-----------------------------------------
Target Omset : ${fmtRp(item.targetValue)}
Realisasi    : ${fmtRp(item.realValue)} (*${item.ach}%*)
Status Tier  : ${valueTierText}

Target AO    : ${fmtNum(item.targetAo)} toko
Realisasi AO : ${fmtNum(item.realAo)} toko (*${item.achAo}%*)
Status AO    : ${aoStatusText}
-----------------------------------------
Insentif Sell Out : ${fmtRp(item.valueCommission)}
Insentif AO Brand : ${fmtRp(item.aoBonus)}${focusLines}-----------------------------------------
*TOTAL ESTIMASI INSENTIF: ${fmtRp(item.totalIncentive)}*
-----------------------------------------
_Catatan: Angka di atas merupakan estimasi sistem berdasarkan data penjualan berjalan._`;
}
