import { useState, useMemo, useEffect } from "react";
import {
  Coins, UserCheck, TrendingUp, Award, Settings, RotateCcw, Copy, Check, Info,
  Plus, Trash2, Edit3, PackageCheck, AlertCircle, ShieldCheck, CheckSquare, Square, Sparkles, Users, Layers,
} from "lucide-react";
import { fmtRp, fmtNum } from "../../utils/formatters.js";
import {
  DEFAULT_COMMISSION_RULES,
  DEFAULT_FLAT_TIERS,
  getStoredCommissionRules,
  saveStoredCommissionRules,
  formatCommissionWhatsAppSlip,
} from "../../utils/commissionEngine.js";
import { useCommissionWorker } from "../../hooks/useCommissionWorker.js";
import { KpiCard } from "../KpiCard.jsx";
import { DataTable } from "../ui/DataTable.jsx";
import { AchBadge } from "../AchBadge.jsx";

export function SalesCommissionView({ rows = [], filteredRows = [], colors, depotName = "" }) {
  const [rules, setRules] = useState(() => getStoredCommissionRules(depotName));
  const [showSettings, setShowSettings] = useState(false);
  const [copiedCode, setCopiedCode] = useState(null);

  // Tab skema aktif yang sedang diedit: "main" atau ID dari customSchemes
  const [activeSchemeTab, setActiveSchemeTab] = useState("main");

  // State form penambahan / pengeditan aturan produk fokus / Effective Calls
  const [editingFocusRule, setEditingFocusRule] = useState(null);

  useEffect(() => {
    setRules(getStoredCommissionRules(depotName));
    setActiveSchemeTab("main");
  }, [depotName]);

  // Ekstrak daftar salesman unik dari rows / filteredRows
  const availableSales = useMemo(() => {
    const map = new Map();
    (rows || []).forEach((s) => {
      const code = s.code || s.salesCode || "";
      const name = s.name || s.salesName || code;
      if (code) map.set(code, { code, name });
    });
    filteredRows.forEach((r) => {
      const code = r.salesCode || "";
      if (code && !map.has(code)) {
        map.set(code, { code, name: r.salesName || code });
      }
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [rows, filteredRows]);

  // Ekstrak daftar golongan/grup barang unik dari data transaksi
  const availableGroups = useMemo(() => {
    const set = new Set();
    filteredRows.forEach((r) => {
      if (r.group) set.add(r.group.trim());
    });
    return Array.from(set).sort();
  }, [filteredRows]);

  const { commissions, summary } = useCommissionWorker(rows, rules, filteredRows);

  const updateRules = (updater) => {
    setRules((prev) => {
      const next = typeof updater === "function" ? updater(prev) : { ...prev, ...updater };
      saveStoredCommissionRules(depotName, next);
      return next;
    });
  };

  // Helper untuk membaca objek skema yang sedang diedit (Skema Utama vs Custom Scheme)
  const currentScheme = useMemo(() => {
    if (activeSchemeTab === "main") return rules;
    const found = (rules.customSchemes || []).find((cs) => cs.id === activeSchemeTab);
    return found || rules;
  }, [rules, activeSchemeTab]);

  // Helper untuk mengubah field pada skema yang sedang aktif (main maupun customScheme)
  const updateActiveScheme = (patchOrFn) => {
    updateRules((prev) => {
      if (activeSchemeTab === "main") {
        const patch = typeof patchOrFn === "function" ? patchOrFn(prev) : patchOrFn;
        return { ...prev, ...patch };
      }
      const list = Array.isArray(prev.customSchemes) ? [...prev.customSchemes] : [];
      const nextList = list.map((cs) => {
        if (cs.id !== activeSchemeTab) return cs;
        const patch = typeof patchOrFn === "function" ? patchOrFn(cs) : patchOrFn;
        return { ...cs, ...patch };
      });
      return { ...prev, customSchemes: nextList };
    });
  };

  const handleRuleChange = (field, val) => {
    updateActiveScheme({ [field]: Number(val) || 0 });
  };

  const handleModeChange = (field, val) => {
    updateActiveScheme({ [field]: val });
  };

  const handleToggleAoBonus = () => {
    updateActiveScheme((sc) => ({ aoBonusEnabled: !sc.aoBonusEnabled }));
  };

  const handleTierListChange = (listKey, idx, field, val) => {
    updateActiveScheme((sc) => {
      const list = Array.isArray(sc[listKey]) ? [...sc[listKey]] : DEFAULT_FLAT_TIERS.map((t) => ({ ...t }));
      list[idx] = { ...list[idx], [field]: Number(val) || 0 };
      return { [listKey]: list };
    });
  };

  const handleAddTier = (listKey) => {
    updateActiveScheme((sc) => {
      const list = Array.isArray(sc[listKey]) ? [...sc[listKey]] : [];
      const last = list[list.length - 1] || { minAch: 80, amount: 50000 };
      const nextList = [
        ...list,
        { minAch: Math.min(200, (Number(last.minAch) || 80) + 5), amount: (Number(last.amount) || 50000) + 50000 },
      ];
      return { [listKey]: nextList };
    });
  };

  const handleRemoveTier = (listKey, idx) => {
    updateActiveScheme((sc) => {
      const list = Array.isArray(sc[listKey]) ? [...sc[listKey]] : [];
      if (list.length <= 1) return {};
      return { [listKey]: list.filter((_, i) => i !== idx) };
    });
  };

  // Tambah Rule Skema Baru (untuk Sales Tertentu)
  const handleAddNewCustomScheme = () => {
    const newId = `scheme_${Date.now()}`;
    const defaultTiers = DEFAULT_FLAT_TIERS.map((t) => ({ ...t }));
    const newScheme = {
      id: newId,
      name: `Rule Skema #${(rules.customSchemes?.length || 0) + 1}`,
      enabled: true,
      salesFilterMode: "selected",
      assignedSales: [],
      valueMode: "flat_tier",
      tier1MinAch: 85,
      tier1RatePct: 0.5,
      tier2MinAch: 100,
      tier2RatePct: 1.0,
      tier3MinAch: 110,
      tier3RatePct: 1.5,
      valueTiers: defaultTiers.map((t) => ({ ...t })),
      aoBonusEnabled: true,
      aoMode: "flat_tier",
      aoTargetOverride: 275,
      aoMinAch: 100,
      aoBonusPerOutlet: 5000,
      aoTiers: defaultTiers.map((t) => ({ ...t })),
    };
    updateRules((prev) => ({
      ...prev,
      customSchemes: [...(prev.customSchemes || []), newScheme],
    }));
    setActiveSchemeTab(newId);
  };

  // Hapus Rule Skema Tambahan
  const handleDeleteCustomScheme = (schemeId) => {
    updateRules((prev) => ({
      ...prev,
      customSchemes: (prev.customSchemes || []).filter((cs) => cs.id !== schemeId),
    }));
    if (activeSchemeTab === schemeId) {
      setActiveSchemeTab("main");
    }
  };

  // Preset 1-Klik: Skema Bobot 4-Tier pada skema yang sedang dibuka + tambah EC
  const handleApplyWeightedPreset = () => {
    const defaultTiers = DEFAULT_FLAT_TIERS.map((t) => ({ ...t }));
    updateActiveScheme((sc) => ({
      valueMode: "flat_tier",
      valueTiers: defaultTiers.map((t) => ({ ...t })),
      aoBonusEnabled: true,
      aoMode: "flat_tier",
      aoTargetOverride: sc.aoTargetOverride || 275,
      aoTiers: defaultTiers.map((t) => ({ ...t })),
    }));

    updateRules((prev) => {
      const existingFocus = Array.isArray(prev.focusRules) ? [...prev.focusRules] : [];
      const hasEcRule = existingFocus.some((r) => r.metricType === "ao");
      if (hasEcRule) return prev;
      return {
        ...prev,
        focusRules: [
          ...existingFocus,
          {
            id: `frule_ec_${Date.now()}`,
            name: "Effective Calls (Target AO Product Focus)",
            metricType: "ao",
            salesFilterMode: currentScheme.salesFilterMode || "all",
            assignedSales: Array.isArray(currentScheme.assignedSales) ? [...currentScheme.assignedSales] : [],
            matchMode: "master_focus",
            keyword: "",
            groupName: availableGroups[0] || "",
            targetQty: 220,
            targetUnit: "toko",
            rewardType: "tiered_pct",
            rewardRate: 200000,
            tiers: defaultTiers.map((t) => ({ ...t })),
            aoGatekeeperMode: "none",
            aoGatekeeperMin: 120,
            aoGatekeeperGroups: [],
          },
        ],
      };
    });
  };

  const handleResetDefault = () => {
    setRules(DEFAULT_COMMISSION_RULES);
    saveStoredCommissionRules(depotName, DEFAULT_COMMISSION_RULES);
    setActiveSchemeTab("main");
    setEditingFocusRule(null);
  };

  // Handler simpan aturan produk fokus / EC
  const handleSaveFocusRule = (ruleData) => {
    updateRules((prev) => {
      const currentList = Array.isArray(prev.focusRules) ? [...prev.focusRules] : [];
      let updated;
      if (ruleData.id) {
        updated = currentList.map((r) => (r.id === ruleData.id ? ruleData : r));
      } else {
        updated = [...currentList, { ...ruleData, id: `frule_${Date.now()}` }];
      }
      return { ...prev, focusRules: updated };
    });
    setEditingFocusRule(null);
  };

  // Handler hapus aturan produk fokus
  const handleDeleteFocusRule = (ruleId) => {
    updateRules((prev) => {
      const updated = (prev.focusRules || []).filter((r) => r.id !== ruleId);
      return { ...prev, focusRules: updated };
    });
  };

  const handleCopySlip = async (item) => {
    const text = formatCommissionWhatsAppSlip(item, depotName);
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = text;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }
      setCopiedCode(item.salesCode);
      setTimeout(() => setCopiedCode(null), 2500);
    } catch (err) {
      console.warn("Gagal menyalin slip:", err);
    }
  };

  // Helper format daftar nama sales dari kode
  const formatAssignedSalesSummary = (filterMode, assignedList = []) => {
    if (!filterMode || filterMode === "all") return "Semua Salesman";
    if (!Array.isArray(assignedList) || assignedList.length === 0) return "Belum ada sales dipilih";
    const names = assignedList.map((code) => {
      const found = availableSales.find((s) => s.code === code || s.name === code);
      return found ? found.name : code;
    });
    if (names.length <= 3) return names.join(", ");
    return `${names.slice(0, 3).join(", ")} (+${names.length - 3} lainnya)`;
  };

  return (
    <div className="space-y-6">
      {/* Top Banner / Actions */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="text-base font-bold flex items-center gap-2" style={{ color: colors.text }}>
            <Coins size={18} style={{ color: colors.gold }} />
            Kalkulator Komisi & Skema Insentif Sales
          </h3>
          <p className="text-xs mt-0.5" style={{ color: colors.textMuted }}>
            Atur skema insentif (Sell Out, AO All Brand, dan Effective Calls / Produk Fokus) dan tentukan skema mana yang berlaku untuk masing-masing salesman.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="sm-btn px-3 py-1.5 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 shadow-sm"
            style={{
              background: showSettings ? colors.blue + "1F" : colors.glassFill,
              border: `1px solid ${showSettings ? colors.blue : colors.glassBorder}`,
              color: showSettings ? colors.blue : colors.text,
            }}
          >
            <Settings size={14} /> Atur Skema & Rule Sales
          </button>
        </div>
      </div>

      {/* Settings Panel (Collapsible) */}
      {showSettings && (
        <div
          className="sm-card p-5 rounded-2xl transition-all space-y-6"
          style={{
            background: colors.glassFill,
            border: `1px solid ${colors.blue}44`,
          }}
        >
          <div className="flex items-center justify-between flex-wrap gap-2 pb-3 border-b" style={{ borderColor: colors.glassBorder }}>
            <div className="text-xs font-bold uppercase tracking-wider flex items-center gap-2" style={{ color: colors.blue }}>
              <Settings size={14} /> Parameter Aturan Komisi & Rule Per Salesman (Tersimpan Otomatis)
            </div>
            <div className="flex items-center flex-wrap gap-3">
              <button
                type="button"
                onClick={handleApplyWeightedPreset}
                className="px-2.5 py-1 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition-all"
                style={{
                  background: colors.mint + "20",
                  border: `1px solid ${colors.mint}66`,
                  color: colors.mint,
                }}
                title="Terapkan skema 4-Tier (80-89% Rp75rb, 90-94% Rp100rb, 95-99% Rp150rb, 100% UP Rp200rb) pada skema yang sedang dibuka"
              >
                <Sparkles size={12} /> Preset Skema Bobot 4-Tier (Sell Out + AO + EC)
              </button>
              <button
                type="button"
                onClick={handleResetDefault}
                className="text-xs font-semibold hover:underline inline-flex items-center gap-1"
                style={{ color: colors.textMuted }}
              >
                <RotateCcw size={12} /> Reset Default
              </button>
            </div>
          </div>

          {/* ====================================================================
              DAFTAR RULE SKEMA INSENTIF (MULTI-SCHEME TABS)
          ==================================================================== */}
          <div className="space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <div className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5" style={{ color: colors.text }}>
                  <Layers size={14} style={{ color: colors.blue }} /> Pilihan Rule Skema Sell Out & AO All Brand
                </div>
                <div className="text-[11px] mt-0.5" style={{ color: colors.textMuted }}>
                  Buat beberapa rule skema berbeda jika setiap kelompok salesman memiliki perhitungan komisi atau target AO yang berbeda.
                </div>
              </div>

              <button
                type="button"
                onClick={handleAddNewCustomScheme}
                className="sm-btn px-3 py-1.5 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5"
                style={{
                  background: colors.blue + "22",
                  border: `1px solid ${colors.blue}66`,
                  color: colors.blue,
                }}
              >
                <Plus size={13} /> Tambah Rule Skema Sales Baru
              </button>
            </div>

            {/* Tab Bar Skema */}
            <div className="flex items-center flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setActiveSchemeTab("main")}
                className="px-3 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 border"
                style={{
                  background: activeSchemeTab === "main" ? colors.blue + "22" : colors.glassSubtle,
                  borderColor: activeSchemeTab === "main" ? colors.blue : colors.glassBorder,
                  color: activeSchemeTab === "main" ? colors.blue : colors.text,
                }}
              >
                <span>{rules.schemeName || "Skema Utama (Default)"}</span>
                <span
                  className="text-[10px] px-1.5 py-0.5 rounded-full"
                  style={{ background: colors.glassFill, color: colors.textMuted }}
                >
                  {rules.salesFilterMode === "selected"
                    ? `${(rules.assignedSales || []).length} Sales`
                    : "Semua Sales"}
                </span>
              </button>

              {(rules.customSchemes || []).map((cs) => {
                const isActive = activeSchemeTab === cs.id;
                return (
                  <div
                    key={cs.id}
                    className="inline-flex items-center rounded-xl border transition-all overflow-hidden"
                    style={{
                      background: isActive ? colors.mint + "22" : colors.glassSubtle,
                      borderColor: isActive ? colors.mint : colors.glassBorder,
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => setActiveSchemeTab(cs.id)}
                      className="px-3 py-2 text-xs font-semibold flex items-center gap-2"
                      style={{ color: isActive ? colors.mint : colors.text }}
                    >
                      <span>{cs.name || "Rule Khusus"}</span>
                      <span
                        className="text-[10px] px-1.5 py-0.5 rounded-full"
                        style={{ background: colors.glassFill, color: colors.textMuted }}
                      >
                        {cs.salesFilterMode === "all"
                          ? "Semua Sales"
                          : `${(cs.assignedSales || []).length} Sales`}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteCustomScheme(cs.id)}
                      className="px-2 py-2 hover:opacity-80 border-l"
                      style={{ borderColor: colors.glassBorder, color: colors.coral }}
                      title="Hapus Rule Skema Ini"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Box Pengaturan Nama Skema & Penugasan Salesman untuk Skema yang Sedang Dibuka */}
            <div
              className="p-4 rounded-xl border space-y-3"
              style={{
                background: colors.glassSubtle,
                borderColor: activeSchemeTab === "main" ? colors.blue + "55" : colors.mint + "55",
              }}
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block mb-1 font-semibold" style={{ color: colors.text }}>
                    Nama Skema / Rule
                  </label>
                  <input
                    type="text"
                    value={activeSchemeTab === "main" ? (rules.schemeName || "Skema Utama (Default)") : (currentScheme.name || "")}
                    onChange={(e) =>
                      updateActiveScheme(
                        activeSchemeTab === "main"
                          ? { schemeName: e.target.value }
                          : { name: e.target.value }
                      )
                    }
                    placeholder="Contoh: Skema Sales Kanvas / Skema TO"
                    className="w-full px-3 py-1.5 rounded-lg font-semibold"
                    style={{ background: colors.glassFill, border: `1px solid ${colors.glassBorder}` }}
                  />
                </div>

                <div>
                  <label className="block mb-1 font-semibold flex items-center gap-1" style={{ color: colors.text }}>
                    <Users size={13} style={{ color: colors.blue }} /> Berlaku Untuk Salesman:
                  </label>
                  <select
                    value={currentScheme.salesFilterMode || (activeSchemeTab === "main" ? "all" : "selected")}
                    onChange={(e) => updateActiveScheme({ salesFilterMode: e.target.value })}
                    className="w-full px-3 py-1.5 rounded-lg font-semibold"
                    style={{ background: colors.glassFill, border: `1px solid ${colors.glassBorder}` }}
                  >
                    <option value="all">
                      {activeSchemeTab === "main"
                        ? "Semua Salesman (yang tidak punya Rule Khusus)"
                        : "Semua Salesman"}
                    </option>
                    <option value="selected">Hanya Salesman Tertentu yang Dicentang</option>
                  </select>
                </div>
              </div>

              {(currentScheme.salesFilterMode || (activeSchemeTab === "main" ? "all" : "selected")) === "selected" && (
                <SalesmanChecklistPicker
                  availableSales={availableSales}
                  selectedSales={currentScheme.assignedSales || []}
                  colors={colors}
                  onChange={(nextList) => updateActiveScheme({ assignedSales: nextList })}
                />
              )}
            </div>
          </div>

          {/* Section 1: Tier Pencapaian Omset / Sell Out (pada Skema Aktif) */}
          <div className="pt-2 border-t" style={{ borderColor: colors.glassBorder }}>
            <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
              <div>
                <div className="text-xs font-bold uppercase tracking-wider" style={{ color: colors.text }}>
                  1. Insentif Sell Out / Nilai Penjualan — [{activeSchemeTab === "main" ? (rules.schemeName || "Skema Utama") : currentScheme.name}]
                </div>
                <div className="text-[11px] mt-0.5" style={{ color: colors.textMuted }}>
                  Pilih perhitungan berdasarkan persentase omset, nominal tetap berjenjang (skema bobot), atau nonaktifkan.
                </div>
              </div>

              <div className="inline-flex rounded-lg p-0.5 border text-xs" style={{ background: colors.glassSubtle, borderColor: colors.glassBorder }}>
                <button
                  type="button"
                  onClick={() => handleModeChange("valueMode", "percentage")}
                  className="px-2.5 py-1 rounded-md font-semibold transition-all"
                  style={{
                    background: (currentScheme.valueMode || "percentage") === "percentage" ? colors.blue : "transparent",
                    color: (currentScheme.valueMode || "percentage") === "percentage" ? "#FFFFFF" : colors.textMuted,
                  }}
                >
                  % dari Omset
                </button>
                <button
                  type="button"
                  onClick={() => handleModeChange("valueMode", "flat_tier")}
                  className="px-2.5 py-1 rounded-md font-semibold transition-all"
                  style={{
                    background: currentScheme.valueMode === "flat_tier" ? colors.blue : "transparent",
                    color: currentScheme.valueMode === "flat_tier" ? "#FFFFFF" : colors.textMuted,
                  }}
                >
                  Nominal Tetap (Tier Bobot Rp)
                </button>
                <button
                  type="button"
                  onClick={() => handleModeChange("valueMode", "none")}
                  className="px-2.5 py-1 rounded-md font-semibold transition-all"
                  style={{
                    background: currentScheme.valueMode === "none" ? colors.coral : "transparent",
                    color: currentScheme.valueMode === "none" ? "#FFFFFF" : colors.textMuted,
                  }}
                >
                  Nonaktif
                </button>
              </div>
            </div>

            {currentScheme.valueMode === "none" ? (
              <div className="p-3 rounded-xl text-xs border border-dashed text-center" style={{ borderColor: colors.glassBorder, color: colors.textMuted }}>
                Insentif Sell Out (Omset) dinonaktifkan untuk skema ini.
              </div>
            ) : currentScheme.valueMode === "flat_tier" ? (
              <FlatTierListEditor
                tiers={currentScheme.valueTiers || DEFAULT_FLAT_TIERS}
                colors={colors}
                metricLabel="Value"
                onChange={(idx, field, val) => handleTierListChange("valueTiers", idx, field, val)}
                onAdd={() => handleAddTier("valueTiers")}
                onRemove={(idx) => handleRemoveTier("valueTiers", idx)}
              />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                {/* Tier 1 */}
                <div className="p-3 rounded-xl" style={{ background: colors.glassSubtle, border: `1px solid ${colors.glassBorder}` }}>
                  <div className="font-bold mb-2" style={{ color: colors.gold }}>Tier 1 (Pencapaian Awal)</div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span style={{ color: colors.textMuted }}>Min. ACH:</span>
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          value={currentScheme.tier1MinAch}
                          onChange={(e) => handleRuleChange("tier1MinAch", e.target.value)}
                          className="w-16 px-2 py-1 rounded text-center mono font-semibold"
                          style={{ background: colors.glassFill, border: `1px solid ${colors.glassBorder}` }}
                        />
                        <span>%</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span style={{ color: colors.textMuted }}>Rate Komisi:</span>
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          step="0.1"
                          value={currentScheme.tier1RatePct}
                          onChange={(e) => handleRuleChange("tier1RatePct", e.target.value)}
                          className="w-16 px-2 py-1 rounded text-center mono font-semibold"
                          style={{ background: colors.glassFill, border: `1px solid ${colors.glassBorder}` }}
                        />
                        <span>%</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Tier 2 */}
                <div className="p-3 rounded-xl" style={{ background: colors.glassSubtle, border: `1px solid ${colors.glassBorder}` }}>
                  <div className="font-bold mb-2" style={{ color: colors.blue }}>Tier 2 (Target Terpenuhi)</div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span style={{ color: colors.textMuted }}>Min. ACH:</span>
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          value={currentScheme.tier2MinAch}
                          onChange={(e) => handleRuleChange("tier2MinAch", e.target.value)}
                          className="w-16 px-2 py-1 rounded text-center mono font-semibold"
                          style={{ background: colors.glassFill, border: `1px solid ${colors.glassBorder}` }}
                        />
                        <span>%</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span style={{ color: colors.textMuted }}>Rate Komisi:</span>
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          step="0.1"
                          value={currentScheme.tier2RatePct}
                          onChange={(e) => handleRuleChange("tier2RatePct", e.target.value)}
                          className="w-16 px-2 py-1 rounded text-center mono font-semibold"
                          style={{ background: colors.glassFill, border: `1px solid ${colors.glassBorder}` }}
                        />
                        <span>%</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Tier 3 */}
                <div className="p-3 rounded-xl" style={{ background: colors.glassSubtle, border: `1px solid ${colors.glassBorder}` }}>
                  <div className="font-bold mb-2" style={{ color: colors.mint }}>Tier 3 (Super Achiever)</div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span style={{ color: colors.textMuted }}>Min. ACH:</span>
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          value={currentScheme.tier3MinAch}
                          onChange={(e) => handleRuleChange("tier3MinAch", e.target.value)}
                          className="w-16 px-2 py-1 rounded text-center mono font-semibold"
                          style={{ background: colors.glassFill, border: `1px solid ${colors.glassBorder}` }}
                        />
                        <span>%</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span style={{ color: colors.textMuted }}>Rate Komisi:</span>
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          step="0.1"
                          value={currentScheme.tier3RatePct}
                          onChange={(e) => handleRuleChange("tier3RatePct", e.target.value)}
                          className="w-16 px-2 py-1 rounded text-center mono font-semibold"
                          style={{ background: colors.glassFill, border: `1px solid ${colors.glassBorder}` }}
                        />
                        <span>%</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Section 2: Bonus Active Outlet (AO All Brand) pada Skema Aktif */}
          <div className="pt-3 border-t space-y-3" style={{ borderColor: colors.glassBorder }}>
            <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={Boolean(currentScheme.aoBonusEnabled)}
                  onChange={handleToggleAoBonus}
                  className="w-4 h-4 rounded text-blue-600 cursor-pointer"
                />
                <div>
                  <span className="font-bold uppercase tracking-wider block" style={{ color: colors.text }}>
                    2. Insentif Active Outlet (Target AO All Brand) — [{activeSchemeTab === "main" ? (rules.schemeName || "Skema Utama") : currentScheme.name}]
                  </span>
                  <span className="text-[11px]" style={{ color: colors.textMuted }}>
                    Bonus pencapaian jumlah toko aktif keseluruhan untuk salesman dalam skema ini.
                  </span>
                </div>
              </label>

              {currentScheme.aoBonusEnabled && (
                <div className="flex items-center flex-wrap gap-3">
                  <div className="flex items-center gap-1.5" title="Isi 0 untuk mengikuti Target AO bawaan Master Sales masing-masing, atau isi angka (misal 275) untuk menyamakan Target AO All Brand">
                    <span style={{ color: colors.textMuted }}>Target AO Patokan:</span>
                    <input
                      type="number"
                      min="0"
                      placeholder="Ikut Master"
                      value={currentScheme.aoTargetOverride || ""}
                      onChange={(e) => handleRuleChange("aoTargetOverride", e.target.value)}
                      className="w-24 px-2 py-1 rounded text-center mono font-semibold"
                      style={{ background: colors.glassFill, border: `1px solid ${colors.glassBorder}` }}
                    />
                    <span className="text-[11px]" style={{ color: colors.textMuted }}>
                      {currentScheme.aoTargetOverride > 0 ? "toko (Override)" : "(Ikut Master)"}
                    </span>
                  </div>

                  <div className="inline-flex rounded-lg p-0.5 border text-xs" style={{ background: colors.glassSubtle, borderColor: colors.glassBorder }}>
                    <button
                      type="button"
                      onClick={() => handleModeChange("aoMode", "per_outlet")}
                      className="px-2.5 py-1 rounded-md font-semibold transition-all"
                      style={{
                        background: (currentScheme.aoMode || "per_outlet") === "per_outlet" ? colors.blue : "transparent",
                        color: (currentScheme.aoMode || "per_outlet") === "per_outlet" ? "#FFFFFF" : colors.textMuted,
                      }}
                    >
                      Rp / Toko
                    </button>
                    <button
                      type="button"
                      onClick={() => handleModeChange("aoMode", "flat_tier")}
                      className="px-2.5 py-1 rounded-md font-semibold transition-all"
                      style={{
                        background: currentScheme.aoMode === "flat_tier" ? colors.blue : "transparent",
                        color: currentScheme.aoMode === "flat_tier" ? "#FFFFFF" : colors.textMuted,
                      }}
                    >
                      Nominal Tetap (Tier Bobot Rp)
                    </button>
                  </div>
                </div>
              )}
            </div>

            {currentScheme.aoBonusEnabled && (
              currentScheme.aoMode === "flat_tier" ? (
                <FlatTierListEditor
                  tiers={currentScheme.aoTiers || DEFAULT_FLAT_TIERS}
                  colors={colors}
                  metricLabel="AO"
                  onChange={(idx, field, val) => handleTierListChange("aoTiers", idx, field, val)}
                  onAdd={() => handleAddTier("aoTiers")}
                  onRemove={(idx) => handleRemoveTier("aoTiers", idx)}
                />
              ) : (
                <div className="flex items-center flex-wrap gap-4 text-xs p-3 rounded-xl" style={{ background: colors.glassSubtle, border: `1px solid ${colors.glassBorder}` }}>
                  <div className="flex items-center gap-1.5">
                    <span style={{ color: colors.textMuted }}>Syarat Min. ACH AO:</span>
                    <input
                      type="number"
                      value={currentScheme.aoMinAch}
                      onChange={(e) => handleRuleChange("aoMinAch", e.target.value)}
                      className="w-16 px-2 py-1 rounded text-center mono font-semibold"
                      style={{ background: colors.glassFill, border: `1px solid ${colors.glassBorder}` }}
                    />
                    <span>%</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span style={{ color: colors.textMuted }}>Bonus per Toko AO:</span>
                    <span>Rp</span>
                    <input
                      type="number"
                      step="500"
                      value={currentScheme.aoBonusPerOutlet}
                      onChange={(e) => handleRuleChange("aoBonusPerOutlet", e.target.value)}
                      className="w-24 px-2 py-1 rounded text-center mono font-semibold"
                      style={{ background: colors.glassFill, border: `1px solid ${colors.glassBorder}` }}
                    />
                  </div>
                </div>
              )
            )}
          </div>

          {/* Section 3: Program Insentif Produk Fokus & Effective Calls */}
          <div className="pt-3 border-t" style={{ borderColor: colors.glassBorder }}>
            <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
              <div>
                <div className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5" style={{ color: colors.violet }}>
                  <PackageCheck size={15} /> 3. Rule Insentif Produk Fokus & Effective Calls (Bisa Per Salesman)
                </div>
                <div className="text-[11px] mt-0.5" style={{ color: colors.textMuted }}>
                  Setiap rule di bawah dapat diatur berlaku untuk <b>Semua Salesman</b> atau <b>Salesman Tertentu</b> saja.
                </div>
              </div>

              {!editingFocusRule && (
                <div className="flex items-center flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setEditingFocusRule({
                        id: "",
                        name: "Effective Calls (Target AO Product Focus)",
                        metricType: "ao",
                        salesFilterMode: "all",
                        assignedSales: [],
                        matchMode: "master_focus",
                        keyword: "",
                        groupName: availableGroups[0] || "",
                        targetQty: 220,
                        targetUnit: "toko",
                        rewardType: "tiered_pct",
                        rewardRate: 200000,
                        tiers: DEFAULT_FLAT_TIERS.map((t) => ({ ...t })),
                        aoGatekeeperMode: "none",
                        aoGatekeeperMin: 120,
                        aoGatekeeperGroups: [],
                      })
                    }
                    className="sm-btn px-3 py-1.5 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5"
                    style={{ background: colors.blue + "22", border: `1px solid ${colors.blue}55`, color: colors.blue }}
                  >
                    <Plus size={13} /> Tambah Rule Effective Calls (AO Fokus)
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setEditingFocusRule({
                        id: "",
                        name: "",
                        metricType: "qty",
                        salesFilterMode: "all",
                        assignedSales: [],
                        matchMode: "keyword",
                        keyword: "",
                        groupName: availableGroups[0] || "",
                        targetQty: 100,
                        targetUnit: "ktn",
                        rewardType: "per_unit",
                        rewardRate: 2000,
                        tiers: DEFAULT_FLAT_TIERS.map((t) => ({ ...t })),
                        aoGatekeeperMode: "selected_groups",
                        aoGatekeeperMin: 120,
                        aoGatekeeperGroups: availableGroups.slice(0, 3),
                      })
                    }
                    className="sm-btn px-3 py-1.5 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5"
                    style={{ background: colors.violet + "22", border: `1px solid ${colors.violet}55`, color: colors.violet }}
                  >
                    <Plus size={13} /> Tambah Rule Kuantitas Barang
                  </button>
                </div>
              )}
            </div>

            {/* Form Editor Aturan Produk Fokus / EC */}
            {editingFocusRule && (
              <FocusRuleEditor
                initialData={editingFocusRule}
                availableGroups={availableGroups}
                availableSales={availableSales}
                colors={colors}
                onSave={handleSaveFocusRule}
                onCancel={() => setEditingFocusRule(null)}
              />
            )}

            {/* List Aturan yang Tersimpan */}
            {Array.isArray(rules.focusRules) && rules.focusRules.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3 text-xs">
                {rules.focusRules.map((fr) => {
                  const isAoMetric = fr.metricType === "ao";
                  const unitText = isAoMetric ? "toko (AO)" : fr.targetUnit || "ktn/pcs";
                  const salesScopeText = formatAssignedSalesSummary(fr.salesFilterMode, fr.assignedSales);
                  return (
                    <div
                      key={fr.id}
                      className="p-3 rounded-xl border relative flex flex-col justify-between"
                      style={{ background: colors.glassSubtle, borderColor: colors.glassBorder }}
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2 mb-1.5">
                          <div>
                            <div className="font-bold text-sm" style={{ color: colors.text }}>
                              {fr.name}
                            </div>
                            <div className="flex items-center flex-wrap gap-1.5 mt-1">
                              <span
                                className="inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded"
                                style={{
                                  background: isAoMetric ? colors.blue + "1F" : colors.violet + "1F",
                                  color: isAoMetric ? colors.blue : colors.violet,
                                }}
                              >
                                {isAoMetric ? "Metrik: Effective Calls (AO)" : "Metrik: Kuantitas Barang"}
                              </span>
                              <span
                                className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded"
                                style={{
                                  background: fr.salesFilterMode === "selected" ? colors.gold + "22" : colors.glassFill,
                                  color: fr.salesFilterMode === "selected" ? colors.gold : colors.textMuted,
                                  border: `1px solid ${fr.salesFilterMode === "selected" ? colors.gold + "44" : colors.glassBorder}`,
                                }}
                              >
                                <Users size={10} /> {salesScopeText}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => setEditingFocusRule(fr)}
                              className="p-1 rounded hover:opacity-80"
                              style={{ color: colors.blue }}
                              title="Edit Program"
                            >
                              <Edit3 size={13} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteFocusRule(fr.id)}
                              className="p-1 rounded hover:opacity-80"
                              style={{ color: colors.coral }}
                              title="Hapus Program"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>

                        <div className="space-y-1 text-[11px] mt-2" style={{ color: colors.textMuted }}>
                          <div>
                            Cakupan Produk:{" "}
                            <b style={{ color: colors.text }}>
                              {fr.matchMode === "master_focus"
                                ? "Semua Produk Fokus (dari Master Target)"
                                : fr.matchMode === "keyword"
                                ? `Kata Kunci "${fr.keyword}"`
                                : `Grup "${fr.groupName}"`}
                            </b>
                          </div>
                          <div>
                            Target: <b className="mono" style={{ color: colors.text }}>{fmtNum(fr.targetQty)} {unitText}</b>
                            {" · "}
                            Skema Hadiah:{" "}
                            <b className="mono" style={{ color: colors.mint }}>
                              {fr.rewardType === "tiered_pct"
                                ? `Berjenjang (${(fr.tiers || DEFAULT_FLAT_TIERS).length} Tier % ACH)`
                                : fr.rewardType === "flat"
                                ? fmtRp(fr.rewardRate) + " (Flat)"
                                : fmtRp(fr.rewardRate) + ` / ${isAoMetric ? "toko" : fr.targetUnit || "ktn"}`}
                            </b>
                          </div>
                          {fr.rewardType === "tiered_pct" && (
                            <div className="text-[10.5px] mono pt-0.5" style={{ color: colors.textMuted }}>
                              {(fr.tiers || DEFAULT_FLAT_TIERS)
                                .map((t) => `≥${t.minAch}%: ${fmtRp(t.amount)}`)
                                .join(" | ")}
                            </div>
                          )}
                          <div className="pt-1 border-t flex items-start gap-1" style={{ borderColor: colors.glassBorder }}>
                            <ShieldCheck size={12} className="mt-0.5 shrink-0" style={{ color: colors.gold }} />
                            <div>
                              Syarat Gatekeeper AO:{" "}
                              {fr.aoGatekeeperMode === "none" ? (
                                <span style={{ color: colors.textMuted }}>Tanpa Syarat AO Tambahan</span>
                              ) : fr.aoGatekeeperMode === "this_group" ? (
                                <span>Wajib AO Golongan Produk ≥ {fr.aoGatekeeperMin} toko</span>
                              ) : fr.aoGatekeeperMode === "all_groups" ? (
                                <span>Wajib Semua Golongan yang Dibawa ≥ {fr.aoGatekeeperMin} toko</span>
                              ) : (
                                <span>
                                  Wajib Golongan Terpilih ≥ {fr.aoGatekeeperMin} toko:{" "}
                                  <b>{(fr.aoGatekeeperGroups || []).join(", ") || "Semua"}</b>
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              !editingFocusRule && (
                <div className="p-4 rounded-xl border border-dashed text-center text-xs" style={{ borderColor: colors.glassBorder, color: colors.textMuted }}>
                  Belum ada rule Produk Fokus / Effective Calls yang didaftarkan. Gunakan tombol di atas untuk menambahkan.
                </div>
              )
            )}
          </div>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard
          label="Total Estimasi Payout"
          value={fmtRp(summary?.totalPayout ?? 0)}
          icon={Coins}
          accent={colors.mint}
          colors={colors}
        />
        <KpiCard
          label="Sales Lolos Insentif"
          value={`${summary?.qualifiedSalesCount ?? 0} / ${summary?.totalSalesCount ?? 0}`}
          icon={UserCheck}
          accent={colors.blue}
          colors={colors}
        />
        <KpiCard
          label="Insentif Sell Out & AO"
          value={fmtRp((summary?.totalValueCommission ?? 0) + (summary?.totalAoBonus ?? 0))}
          icon={TrendingUp}
          accent={colors.gold}
          colors={colors}
        />
        <KpiCard
          label="Insentif Fokus / EC"
          value={fmtRp(summary?.totalFocusBonus ?? 0)}
          icon={Award}
          accent={colors.violet}
          colors={colors}
        />
      </div>

      {/* Table */}
      <div className="sm-card p-5">
        <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
          <div className="text-xs uppercase tracking-wider font-bold" style={{ color: colors.textMuted }}>
            Daftar Estimasi Komisi & Insentif Per Salesman
          </div>
          <div className="text-xs inline-flex items-center gap-1" style={{ color: colors.textMuted }}>
            <Info size={13} />
            Persentase menggunakan batas murni (contoh: 89.9% tetap di tier 80–89%)
          </div>
        </div>

        <DataTable
          colors={colors}
          rowKey="salesCode"
          initialSortKey="totalIncentive"
          searchable
          searchKeys={["salesName", "salesCode", "schemeName"]}
          searchPlaceholder="Cari nama salesman atau skema..."
          columns={[
            {
              key: "salesName",
              label: "Salesman",
              render: (r) => (
                <div>
                  <div className="font-semibold text-xs sm:text-sm" style={{ color: colors.text }}>
                    {r.salesName}
                  </div>
                  <div className="flex items-center flex-wrap gap-1.5 mt-0.5">
                    <span className="mono text-[11px]" style={{ color: colors.textMuted }}>
                      {r.salesCode}
                    </span>
                    {r.schemeName && (
                      <span
                        className="text-[10px] px-1.5 py-0.2 rounded font-medium"
                        style={{
                          background: r.isCustomScheme ? colors.mint + "1A" : colors.blue + "15",
                          color: r.isCustomScheme ? colors.mint : colors.blue,
                          border: `1px solid ${r.isCustomScheme ? colors.mint + "44" : colors.blue + "33"}`,
                        }}
                      >
                        {r.schemeName}
                      </span>
                    )}
                  </div>
                </div>
              ),
            },
            {
              key: "realValue",
              label: "Sell Out (Omset)",
              render: (r) => (
                <div>
                  <div className="mono font-semibold">{fmtRp(r.realValue)}</div>
                  <div className="mono text-[10.5px]" style={{ color: colors.textMuted }}>
                    Target: {fmtRp(r.targetValue)}
                  </div>
                </div>
              ),
            },
            {
              key: "ach",
              label: "ACH Omset",
              render: (r) => <AchBadge ach={r.ach / 100} colors={colors} />,
            },
            {
              key: "valueCommission",
              label: "Insentif Sell Out",
              render: (r) => (
                <div>
                  <div className="mono font-bold" style={{ color: r.valueCommission > 0 ? colors.text : colors.textMuted }}>
                    {fmtRp(r.valueCommission)}
                  </div>
                  <span
                    className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md inline-block mt-0.5"
                    style={{
                      background: r.tierColor + "1A",
                      color: r.tierColor,
                      border: `1px solid ${r.tierColor}33`,
                    }}
                  >
                    {r.valueMode === "flat_tier" || r.valueMode === "none"
                      ? r.tierLabel
                      : `${r.tierLabel} (${r.appliedRatePct}%)`}
                  </span>
                </div>
              ),
            },
            {
              key: "aoBonus",
              label: "Insentif AO All Brand",
              render: (r) => (
                <div>
                  <div className="mono font-semibold" style={{ color: r.aoBonus > 0 ? colors.gold : colors.textMuted }}>
                    {fmtRp(r.aoBonus)}
                  </div>
                  <div className="text-[10px] mt-0.5" style={{ color: colors.textMuted }}>
                    AO: {fmtNum(r.realAo)}/{fmtNum(r.targetAo)} ({r.achAo}%)
                  </div>
                  {r.aoTierLabel && (
                    <div className="text-[10px] font-medium" style={{ color: r.aoBonus > 0 ? colors.mint : colors.textMuted }}>
                      {r.aoTierLabel}
                    </div>
                  )}
                </div>
              ),
            },
            {
              key: "totalFocusBonus",
              label: "Insentif Fokus / EC",
              render: (r) => {
                if (!r.focusBreakdown || r.focusBreakdown.length === 0) {
                  return <span className="mono text-xs" style={{ color: colors.textMuted }}>—</span>;
                }
                return (
                  <div>
                    <div className="mono font-bold" style={{ color: r.totalFocusBonus > 0 ? colors.violet : colors.textMuted }}>
                      {fmtRp(r.totalFocusBonus)}
                    </div>
                    <div className="flex flex-col gap-1 mt-1 max-w-[230px]">
                      {r.focusBreakdown.map((fb, idx) => {
                        const unitLabel = fb.metricType === "ao" ? "AO" : fb.targetUnit || "ktn";
                        const pctText = fb.targetQty > 0 ? ` · ${fb.achPct}%` : "";
                        if (fb.isQualified) {
                          return (
                            <span
                              key={idx}
                              className="text-[10px] px-1.5 py-0.5 rounded font-medium inline-flex items-center gap-1"
                              style={{ background: colors.mint + "1A", color: colors.mint, border: `1px solid ${colors.mint}33` }}
                              title={`Lolos: ${fmtNum(fb.totalQty)}/${fmtNum(fb.targetQty)} ${unitLabel}${pctText}${fb.tierLabel ? ` (${fb.tierLabel})` : ""} -> ${fmtRp(fb.bonus)}`}
                            >
                              ✓ {fb.ruleName} ({fmtNum(fb.totalQty)}/{fmtNum(fb.targetQty)} {unitLabel}{pctText})
                            </span>
                          );
                        }
                        if (fb.qtyAchieved && !fb.aoGatekeeperPassed) {
                          const failStr = fb.failedGroups.map((g) => `${g.group} (${g.currentAo}/${g.requiredAo})`).join(", ");
                          return (
                            <span
                              key={idx}
                              className="text-[10px] px-1.5 py-0.5 rounded font-medium inline-flex items-center gap-1"
                              style={{ background: colors.gold + "1A", color: colors.gold, border: `1px solid ${colors.gold}33` }}
                              title={`Target Lolos (${fmtNum(fb.totalQty)}/${fmtNum(fb.targetQty)}), tapi syarat AO belum lolos: ${failStr}`}
                            >
                              <AlertCircle size={10} /> AO Kurang: {fb.failedGroups[0]?.group}
                            </span>
                          );
                        }
                        return (
                          <span
                            key={idx}
                            className="text-[10px] px-1.5 py-0.5 rounded font-medium inline-flex items-center gap-1 opacity-70"
                            style={{ background: colors.glassFill, color: colors.textMuted, border: `1px solid ${colors.glassBorder}` }}
                            title={`Belum capai ambang: ${fmtNum(fb.totalQty)}/${fmtNum(fb.targetQty)} ${unitLabel}${pctText}`}
                          >
                            ○ {fb.ruleName} ({fmtNum(fb.totalQty)}/{fmtNum(fb.targetQty)} {unitLabel}{pctText})
                          </span>
                        );
                      })}
                    </div>
                  </div>
                );
              },
            },
            {
              key: "totalIncentive",
              label: "Total Estimasi Insentif",
              render: (r) => (
                <div className="mono font-bold text-sm" style={{ color: r.totalIncentive > 0 ? colors.mint : colors.textMuted }}>
                  {fmtRp(r.totalIncentive)}
                </div>
              ),
            },
            {
              key: "_action",
              label: "Aksi",
              render: (r) => (
                <button
                  onClick={() => handleCopySlip(r)}
                  className="sm-btn px-2.5 py-1.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition-all shadow-sm"
                  style={{
                    background: copiedCode === r.salesCode ? colors.mint + "22" : colors.glassFill,
                    border: `1px solid ${copiedCode === r.salesCode ? colors.mint : colors.glassBorder}`,
                    color: copiedCode === r.salesCode ? colors.mint : colors.text,
                  }}
                  title="Salin Slip WhatsApp"
                >
                  {copiedCode === r.salesCode ? (
                    <>
                      <Check size={13} /> Tersalin
                    </>
                  ) : (
                    <>
                      <Copy size={13} /> Slip WA
                    </>
                  )}
                </button>
              ),
            },
          ]}
          rows={commissions || []}
        />
      </div>
    </div>
  );
}

/**
 * Komponen Checklist Pemilihan Salesman
 */
function SalesmanChecklistPicker({ availableSales = [], selectedSales = [], colors, onChange }) {
  const handleToggle = (code) => {
    const current = Array.isArray(selectedSales) ? [...selectedSales] : [];
    const idx = current.indexOf(code);
    if (idx >= 0) {
      current.splice(idx, 1);
    } else {
      current.push(code);
    }
    onChange(current);
  };

  const handleSelectAll = () => {
    onChange(availableSales.map((s) => s.code));
  };

  const handleClearAll = () => {
    onChange([]);
  };

  return (
    <div className="p-3 rounded-xl border space-y-2 text-xs" style={{ background: colors.glassFill, borderColor: colors.glassBorder }}>
      <div className="flex items-center justify-between flex-wrap gap-2">
        <span className="font-semibold" style={{ color: colors.text }}>
          Centang Salesman yang Mengikuti Rule Ini ({selectedSales.length} / {availableSales.length} dipilih):
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleSelectAll}
            className="text-[11px] hover:underline inline-flex items-center gap-1"
            style={{ color: colors.blue }}
          >
            <CheckSquare size={12} /> Pilih Semua
          </button>
          <button
            type="button"
            onClick={handleClearAll}
            className="text-[11px] hover:underline inline-flex items-center gap-1"
            style={{ color: colors.textMuted }}
          >
            <Square size={12} /> Hapus Semua
          </button>
        </div>
      </div>

      {availableSales.length === 0 ? (
        <div className="text-[11px] italic" style={{ color: colors.textMuted }}>
          Belum ada data salesman yang dimuat.
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 pt-1">
          {availableSales.map((s) => {
            const isChecked = selectedSales.includes(s.code) || selectedSales.includes(s.name);
            return (
              <label
                key={s.code}
                className="flex items-center gap-2 p-1.5 rounded-lg cursor-pointer transition-all border"
                style={{
                  background: isChecked ? colors.blue + "18" : colors.glassSubtle,
                  borderColor: isChecked ? colors.blue : colors.glassBorder,
                }}
              >
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={() => handleToggle(s.code)}
                  className="w-3.5 h-3.5 rounded text-blue-600 cursor-pointer"
                />
                <div className="truncate">
                  <div className="truncate font-semibold text-[11px]" style={{ color: colors.text }}>
                    {s.name}
                  </div>
                  <div className="mono text-[9.5px]" style={{ color: colors.textMuted }}>
                    {s.code}
                  </div>
                </div>
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}

/**
 * Editor daftar tier nominal tetap (contoh: 80% -> 75.000, 90% -> 100.000, 95% -> 150.000, 100% -> 200.000)
 */
function FlatTierListEditor({ tiers = [], colors, metricLabel = "ACH", onChange, onAdd, onRemove }) {
  const sortedPreview = [...tiers].sort((a, b) => (Number(a.minAch) || 0) - (Number(b.minAch) || 0));

  return (
    <div className="space-y-2.5">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
        {tiers.map((tier, idx) => {
          const sortedIdx = sortedPreview.findIndex((t) => t === tier);
          const nextTier = sortedIdx >= 0 ? sortedPreview[sortedIdx + 1] : null;
          const maxBound = nextTier ? Math.max(Number(tier.minAch) || 0, (Number(nextTier.minAch) || 0) - 1) : null;
          const rangeText = nextTier
            ? `${tier.minAch}% s/d ${maxBound}%`
            : `${tier.minAch}% UP`;

          return (
            <div
              key={idx}
              className="p-3 rounded-xl relative space-y-2"
              style={{ background: colors.glassSubtle, border: `1px solid ${colors.glassBorder}` }}
            >
              <div className="flex items-center justify-between gap-1">
                <span className="font-bold" style={{ color: colors.blue }}>
                  Tier {idx + 1} ({rangeText})
                </span>
                {tiers.length > 1 && (
                  <button
                    type="button"
                    onClick={() => onRemove(idx)}
                    className="p-0.5 rounded hover:opacity-80"
                    style={{ color: colors.coral }}
                    title="Hapus Tier"
                  >
                    <Trash2 size={12} />
                  </button>
                )}
              </div>

              <div className="flex items-center justify-between gap-2">
                <span style={{ color: colors.textMuted }}>Min. {metricLabel}:</span>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    step="1"
                    value={tier.minAch}
                    onChange={(e) => onChange(idx, "minAch", e.target.value)}
                    className="w-16 px-2 py-1 rounded text-center mono font-semibold"
                    style={{ background: colors.glassFill, border: `1px solid ${colors.glassBorder}` }}
                  />
                  <span>%</span>
                </div>
              </div>

              <div className="flex items-center justify-between gap-2">
                <span style={{ color: colors.textMuted }}>Insentif:</span>
                <div className="flex items-center gap-1">
                  <span className="text-[11px]" style={{ color: colors.textMuted }}>Rp</span>
                  <input
                    type="number"
                    step="5000"
                    value={tier.amount}
                    onChange={(e) => onChange(idx, "amount", e.target.value)}
                    className="w-24 px-2 py-1 rounded text-right mono font-bold"
                    style={{ background: colors.glassFill, border: `1px solid ${colors.glassBorder}`, color: colors.mint }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between flex-wrap gap-2 text-[11px]" style={{ color: colors.textMuted }}>
        <span>
          * Evaluasi menggunakan batas murni: contoh <b className="mono">89.9%</b> tetap masuk di kriteria <b className="mono">80% s/d 89%</b>.
        </span>
        <button
          type="button"
          onClick={onAdd}
          className="font-semibold hover:underline inline-flex items-center gap-1"
          style={{ color: colors.blue }}
        >
          <Plus size={12} /> Tambah Tier
        </button>
      </div>
    </div>
  );
}

/**
 * Sub-komponen form editor aturan produk fokus & Effective Calls
 */
function FocusRuleEditor({ initialData, availableGroups, availableSales = [], colors, onSave, onCancel }) {
  const [formData, setFormData] = useState(() => ({
    metricType: "qty",
    salesFilterMode: "all",
    assignedSales: [],
    tiers: DEFAULT_FLAT_TIERS.map((t) => ({ ...t })),
    ...initialData,
  }));

  const isAoMetric = formData.metricType === "ao";

  const handleGroupToggle = (grp) => {
    setFormData((prev) => {
      const current = Array.isArray(prev.aoGatekeeperGroups) ? [...prev.aoGatekeeperGroups] : [];
      const idx = current.indexOf(grp);
      if (idx >= 0) {
        current.splice(idx, 1);
      } else {
        current.push(grp);
      }
      return { ...prev, aoGatekeeperGroups: current };
    });
  };

  const handleSelectAllGroups = () => {
    setFormData((prev) => ({ ...prev, aoGatekeeperGroups: [...availableGroups] }));
  };

  const handleClearAllGroups = () => {
    setFormData((prev) => ({ ...prev, aoGatekeeperGroups: [] }));
  };

  const handleRuleTierChange = (idx, field, val) => {
    setFormData((prev) => {
      const list = Array.isArray(prev.tiers) ? [...prev.tiers] : DEFAULT_FLAT_TIERS.map((t) => ({ ...t }));
      list[idx] = { ...list[idx], [field]: Number(val) || 0 };
      return { ...prev, tiers: list };
    });
  };

  const handleRuleAddTier = () => {
    setFormData((prev) => {
      const list = Array.isArray(prev.tiers) ? [...prev.tiers] : [];
      const last = list[list.length - 1] || { minAch: 80, amount: 50000 };
      return {
        ...prev,
        tiers: [...list, { minAch: Math.min(200, (Number(last.minAch) || 80) + 5), amount: (Number(last.amount) || 50000) + 50000 }],
      };
    });
  };

  const handleRuleRemoveTier = (idx) => {
    setFormData((prev) => {
      const list = Array.isArray(prev.tiers) ? [...prev.tiers] : [];
      if (list.length <= 1) return prev;
      return { ...prev, tiers: list.filter((_, i) => i !== idx) };
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.name.trim()) return;
    onSave(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="p-4 rounded-xl border space-y-4 mb-4" style={{ background: colors.glassFill, borderColor: colors.violet + "66" }}>
      <div className="font-bold text-xs uppercase tracking-wider flex items-center justify-between" style={{ color: colors.violet }}>
        <span>{formData.id ? "Edit Rule Produk Fokus / Effective Calls" : "Tambah Rule Produk Fokus / Effective Calls Baru"}</span>
      </div>

      {/* Pilihan Jenis Metrik, Nama, Cakupan Produk, dan Cakupan Salesman */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
        <div>
          <label className="block mb-1 font-semibold" style={{ color: colors.text }}>Jenis Metrik Evaluasi</label>
          <select
            value={formData.metricType || "qty"}
            onChange={(e) => {
              const nextMetric = e.target.value;
              setFormData((prev) => ({
                ...prev,
                metricType: nextMetric,
                targetUnit: nextMetric === "ao" ? "toko" : prev.targetUnit === "toko" ? "ktn" : prev.targetUnit,
              }));
            }}
            className="w-full px-3 py-1.5 rounded-lg font-semibold"
            style={{ background: colors.glassSubtle, border: `1px solid ${colors.glassBorder}` }}
          >
            <option value="ao">Effective Calls / Target AO Fokus</option>
            <option value="qty">Kuantitas Barang (Ktn/Kaleng/Pcs)</option>
          </select>
        </div>

        <div>
          <label className="block mb-1 font-semibold" style={{ color: colors.text }}>Nama Rule / Program</label>
          <input
            type="text"
            required
            placeholder={isAoMetric ? "Contoh: Effective Calls Sales TO" : "Contoh: Campur Rasa Taro 65g"}
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className="w-full px-3 py-1.5 rounded-lg"
            style={{ background: colors.glassSubtle, border: `1px solid ${colors.glassBorder}` }}
          />
        </div>

        <div>
          <label className="block mb-1 font-semibold" style={{ color: colors.text }}>Cakupan Produk Fokus</label>
          <select
            value={formData.matchMode}
            onChange={(e) => setFormData({ ...formData, matchMode: e.target.value })}
            className="w-full px-3 py-1.5 rounded-lg"
            style={{ background: colors.glassSubtle, border: `1px solid ${colors.glassBorder}` }}
          >
            <option value="master_focus">Semua Produk Fokus (Master Target)</option>
            <option value="keyword">Kata Kunci Nama Produk (Pisah Koma)</option>
            <option value="group">Seluruh Produk Dalam Grup</option>
          </select>
        </div>

        <div>
          <label className="block mb-1 font-semibold flex items-center gap-1" style={{ color: colors.text }}>
            <Users size={12} style={{ color: colors.blue }} /> Berlaku Untuk Salesman
          </label>
          <select
            value={formData.salesFilterMode || "all"}
            onChange={(e) => setFormData({ ...formData, salesFilterMode: e.target.value })}
            className="w-full px-3 py-1.5 rounded-lg font-semibold"
            style={{ background: colors.glassSubtle, border: `1px solid ${colors.glassBorder}` }}
          >
            <option value="all">Semua Salesman</option>
            <option value="selected">Pilih Salesman Tertentu</option>
          </select>
        </div>
      </div>

      {formData.salesFilterMode === "selected" && (
        <SalesmanChecklistPicker
          availableSales={availableSales}
          selectedSales={formData.assignedSales || []}
          colors={colors}
          onChange={(nextList) => setFormData((prev) => ({ ...prev, assignedSales: nextList }))}
        />
      )}

      {formData.matchMode === "keyword" && (
        <div className="text-xs">
          <label className="block mb-1 font-semibold" style={{ color: colors.text }}>Kata Kunci Pencarian Produk (Pisahkan dengan koma jika lebih dari satu)</label>
          <input
            type="text"
            required
            placeholder="Contoh: TARO 65G, WAFER, GAS"
            value={formData.keyword}
            onChange={(e) => setFormData({ ...formData, keyword: e.target.value })}
            className="w-full px-3 py-1.5 rounded-lg"
            style={{ background: colors.glassSubtle, border: `1px solid ${colors.glassBorder}` }}
          />
          <span className="text-[10.5px] mt-0.5 block" style={{ color: colors.textMuted }}>
            {isAoMetric
              ? "Toko unik (AO) yang membeli salah satu dari produk dengan kata kunci di atas akan dihitung sebagai Effective Calls."
              : "Kuantitas dari semua transaksi yang memuat kata kunci ini akan otomatis diakumulasikan."}
          </span>
        </div>
      )}

      {formData.matchMode === "group" && (
        <div className="text-xs">
          <label className="block mb-1 font-semibold" style={{ color: colors.text }}>Pilih Grup Produk</label>
          <select
            value={formData.groupName}
            onChange={(e) => setFormData({ ...formData, groupName: e.target.value })}
            className="w-full px-3 py-1.5 rounded-lg"
            style={{ background: colors.glassSubtle, border: `1px solid ${colors.glassBorder}` }}
          >
            {availableGroups.map((grp) => (
              <option key={grp} value={grp}>{grp}</option>
            ))}
          </select>
        </div>
      )}

      {formData.matchMode === "master_focus" && (
        <div className="text-[11px] p-2.5 rounded-lg border" style={{ background: colors.glassSubtle, borderColor: colors.glassBorder, color: colors.textMuted }}>
          Sistem akan otomatis mencocokkan seluruh item <b>Produk Fokus</b> yang terdaftar di Master Target masing-masing salesman.
        </div>
      )}

      {/* Target & Skema Hadiah */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs pt-2 border-t" style={{ borderColor: colors.glassBorder }}>
        <div>
          <label className="block mb-1 font-semibold" style={{ color: colors.text }}>
            {isAoMetric ? "Target AO Product Focus (Toko)" : "Target Kuantitas"}
          </label>
          <div className="flex items-center gap-1.5">
            <input
              type="number"
              min="1"
              required
              value={formData.targetQty}
              onChange={(e) => setFormData({ ...formData, targetQty: Number(e.target.value) || 0 })}
              className="w-full px-3 py-1.5 rounded-lg mono text-center font-bold"
              style={{ background: colors.glassSubtle, border: `1px solid ${colors.glassBorder}` }}
            />
            {isAoMetric ? (
              <span className="px-2.5 py-1.5 rounded-lg font-medium" style={{ background: colors.glassSubtle, border: `1px solid ${colors.glassBorder}`, color: colors.textMuted }}>
                toko
              </span>
            ) : (
              <input
                type="text"
                value={formData.targetUnit || ""}
                onChange={(e) => setFormData({ ...formData, targetUnit: e.target.value })}
                placeholder="ktn"
                className="w-24 px-2 py-1.5 rounded-lg text-center font-medium"
                style={{ background: colors.glassSubtle, border: `1px solid ${colors.glassBorder}`, color: colors.textMuted }}
              />
            )}
          </div>
        </div>

        <div>
          <label className="block mb-1 font-semibold" style={{ color: colors.text }}>Skema Perhitungan Komisi</label>
          <select
            value={formData.rewardType}
            onChange={(e) => setFormData({ ...formData, rewardType: e.target.value })}
            className="w-full px-3 py-1.5 rounded-lg font-semibold"
            style={{ background: colors.glassSubtle, border: `1px solid ${colors.glassBorder}` }}
          >
            <option value="tiered_pct">Tier % Pencapaian (Nominal Berjenjang 80%, 90%, 95%, 100%)</option>
            <option value="flat">Bonus Flat 1 Ambang Target (Rp)</option>
            <option value="per_unit">
              Bonus per {isAoMetric ? "Toko (Rp/toko)" : `Kuantitas (Rp/${formData.targetUnit || "ktn"})`}
            </option>
          </select>
        </div>

        {formData.rewardType !== "tiered_pct" && (
          <div>
            <label className="block mb-1 font-semibold" style={{ color: colors.text }}>
              {formData.rewardType === "flat" ? "Besaran Bonus Flat" : `Bonus per ${isAoMetric ? "Toko" : "Satuan"}`}
            </label>
            <div className="flex items-center gap-1.5">
              <span style={{ color: colors.textMuted }}>Rp</span>
              <input
                type="number"
                step="500"
                required
                value={formData.rewardRate}
                onChange={(e) => setFormData({ ...formData, rewardRate: Number(e.target.value) || 0 })}
                className="w-full px-3 py-1.5 rounded-lg mono font-bold"
                style={{ background: colors.glassSubtle, border: `1px solid ${colors.glassBorder}` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Jika memilih Tier % Pencapaian, tampilkan editor tier */}
      {formData.rewardType === "tiered_pct" && (
        <div className="pt-2 border-t space-y-2" style={{ borderColor: colors.glassBorder }}>
          <div className="text-xs font-bold" style={{ color: colors.blue }}>
            Daftar Tier % Pencapaian {isAoMetric ? "AO Product Focus" : "Kuantitas Produk Fokus"}:
          </div>
          <FlatTierListEditor
            tiers={formData.tiers || DEFAULT_FLAT_TIERS}
            colors={colors}
            metricLabel="ACH"
            onChange={handleRuleTierChange}
            onAdd={handleRuleAddTier}
            onRemove={handleRuleRemoveTier}
          />
        </div>
      )}

      {/* AO Gatekeeper (Prasyarat Pemerataan Golongan) */}
      <div className="pt-2 border-t text-xs space-y-2" style={{ borderColor: colors.glassBorder }}>
        <div className="font-bold flex items-center gap-1.5" style={{ color: colors.gold }}>
          <ShieldCheck size={14} /> Prasyarat Tambahan Pemerataan Toko (AO Gatekeeper - Opsional)
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block mb-1" style={{ color: colors.textMuted }}>Mode Syarat AO Golongan:</label>
            <select
              value={formData.aoGatekeeperMode}
              onChange={(e) => setFormData({ ...formData, aoGatekeeperMode: e.target.value })}
              className="w-full px-3 py-1.5 rounded-lg font-semibold"
              style={{ background: colors.glassSubtle, border: `1px solid ${colors.glassBorder}` }}
            >
              <option value="none">Tanpa Syarat AO Golongan Tambahan</option>
              <option value="selected_groups">Pilih Golongan Tertentu yang Wajib Capai Target AO</option>
              <option value="all_groups">Setiap Golongan yang Dibawa Salesman Wajib Capai Target AO</option>
              <option value="this_group">Hanya Golongan Produk Tersebut yang Wajib Capai Target AO</option>
            </select>
          </div>

          {formData.aoGatekeeperMode !== "none" && (
            <div>
              <label className="block mb-1" style={{ color: colors.textMuted }}>Minimal Target AO per Golongan:</label>
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  min="1"
                  value={formData.aoGatekeeperMin}
                  onChange={(e) => setFormData({ ...formData, aoGatekeeperMin: Number(e.target.value) || 120 })}
                  className="w-24 px-3 py-1.5 rounded-lg mono text-center font-bold"
                  style={{ background: colors.glassSubtle, border: `1px solid ${colors.glassBorder}` }}
                />
                <span style={{ color: colors.textMuted }}>toko unik</span>
              </div>
            </div>
          )}
        </div>

        {/* Checklist Golongan Barang yang Dipilih */}
        {formData.aoGatekeeperMode === "selected_groups" && (
          <div className="p-3 rounded-xl border mt-2 space-y-2" style={{ background: colors.glassSubtle, borderColor: colors.glassBorder }}>
            <div className="flex items-center justify-between flex-wrap gap-2">
              <span className="font-semibold" style={{ color: colors.text }}>
                Pilih Golongan Barang yang Dinilai (Minimal {formData.aoGatekeeperMin} toko):
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSelectAllGroups}
                  className="text-[11px] hover:underline inline-flex items-center gap-1"
                  style={{ color: colors.blue }}
                >
                  <CheckSquare size={12} /> Pilih Semua
                </button>
                <button
                  type="button"
                  onClick={handleClearAllGroups}
                  className="text-[11px] hover:underline inline-flex items-center gap-1"
                  style={{ color: colors.textMuted }}
                >
                  <Square size={12} /> Hapus Semua
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 pt-1">
              {availableGroups.map((grp) => {
                const isChecked = (formData.aoGatekeeperGroups || []).includes(grp);
                return (
                  <label
                    key={grp}
                    className="flex items-center gap-2 p-1.5 rounded-lg cursor-pointer transition-all border"
                    style={{
                      background: isChecked ? colors.blue + "18" : colors.glassFill,
                      borderColor: isChecked ? colors.blue : colors.glassBorder,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => handleGroupToggle(grp)}
                      className="w-3.5 h-3.5 rounded text-blue-600 cursor-pointer"
                    />
                    <span className="truncate font-medium text-[11px]" style={{ color: colors.text }}>
                      {grp}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center justify-end gap-2 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="sm-btn px-3 py-1.5 rounded-lg text-xs font-semibold"
          style={{ background: colors.glassFill, border: `1px solid ${colors.glassBorder}`, color: colors.textMuted }}
        >
          Batal
        </button>
        <button
          type="submit"
          className="sm-btn px-4 py-1.5 rounded-lg text-xs font-semibold shadow-sm"
          style={{ background: colors.violet, color: "#FFFFFF" }}
        >
          Simpan Rule
        </button>
      </div>
    </form>
  );
}
