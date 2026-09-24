import { useState, useMemo, useEffect } from "react";
import {
  Coins, UserCheck, TrendingUp, Award, Settings, RotateCcw, Copy, Check, Info,
  Plus, Trash2, Edit3, PackageCheck, AlertCircle, ShieldCheck, CheckSquare, Square,
} from "lucide-react";
import { fmtRp, fmtNum } from "../../utils/formatters.js";
import {
  DEFAULT_COMMISSION_RULES,
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

  // State form penambahan / pengeditan aturan produk fokus
  const [editingFocusRule, setEditingFocusRule] = useState(null);

  useEffect(() => {
    setRules(getStoredCommissionRules(depotName));
  }, [depotName]);

  // Ekstrak daftar golongan/grup barang unik dari data transaksi
  const availableGroups = useMemo(() => {
    const set = new Set();
    filteredRows.forEach((r) => {
      if (r.group) set.add(r.group.trim());
    });
    return Array.from(set).sort();
  }, [filteredRows]);

  const { commissions, summary } = useCommissionWorker(rows, rules, filteredRows);

  const handleRuleChange = (field, val) => {
    setRules((prev) => {
      const next = { ...prev, [field]: Number(val) || 0 };
      saveStoredCommissionRules(depotName, next);
      return next;
    });
  };

  const handleToggleAoBonus = () => {
    setRules((prev) => {
      const next = { ...prev, aoBonusEnabled: !prev.aoBonusEnabled };
      saveStoredCommissionRules(depotName, next);
      return next;
    });
  };

  const handleResetDefault = () => {
    setRules(DEFAULT_COMMISSION_RULES);
    saveStoredCommissionRules(depotName, DEFAULT_COMMISSION_RULES);
    setEditingFocusRule(null);
  };

  // Handler simpan aturan produk fokus
  const handleSaveFocusRule = (ruleData) => {
    setRules((prev) => {
      const currentList = Array.isArray(prev.focusRules) ? [...prev.focusRules] : [];
      let updated;
      if (ruleData.id) {
        updated = currentList.map((r) => (r.id === ruleData.id ? ruleData : r));
      } else {
        updated = [...currentList, { ...ruleData, id: `frule_${Date.now()}` }];
      }
      const next = { ...prev, focusRules: updated };
      saveStoredCommissionRules(depotName, next);
      return next;
    });
    setEditingFocusRule(null);
  };

  // Handler hapus aturan produk fokus
  const handleDeleteFocusRule = (ruleId) => {
    setRules((prev) => {
      const updated = (prev.focusRules || []).filter((r) => r.id !== ruleId);
      const next = { ...prev, focusRules: updated };
      saveStoredCommissionRules(depotName, next);
      return next;
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
            Simulasi insentif komprehensif: komisi omset berjenjang, bonus sebaran AO, dan insentif produk fokus multi-varian.
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
            <Settings size={14} /> Atur Skema & Rate
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
          <div className="flex items-center justify-between pb-2 border-b" style={{ borderColor: colors.glassBorder }}>
            <div className="text-xs font-bold uppercase tracking-wider flex items-center gap-2" style={{ color: colors.blue }}>
              <Settings size={14} /> Parameter Aturan Komisi & Bonus (Tersimpan Otomatis)
            </div>
            <button
              onClick={handleResetDefault}
              className="text-xs font-semibold hover:underline inline-flex items-center gap-1"
              style={{ color: colors.textMuted }}
            >
              <RotateCcw size={12} /> Reset Default
            </button>
          </div>

          {/* Section 1: Tier Pencapaian Omset */}
          <div>
            <div className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: colors.text }}>
              1. Tier Komisi Berjenjang (% ACH Nilai Penjualan)
            </div>
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
                        value={rules.tier1MinAch}
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
                        value={rules.tier1RatePct}
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
                        value={rules.tier2MinAch}
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
                        value={rules.tier2RatePct}
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
                        value={rules.tier3MinAch}
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
                        value={rules.tier3RatePct}
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
          </div>

          {/* Section 2: Bonus Active Outlet */}
          <div className="pt-2 border-t" style={{ borderColor: colors.glassBorder }}>
            <div className="flex flex-wrap items-center justify-between gap-3 text-xs mb-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={rules.aoBonusEnabled}
                  onChange={handleToggleAoBonus}
                  className="w-4 h-4 rounded text-blue-600 cursor-pointer"
                />
                <span className="font-bold uppercase tracking-wider" style={{ color: colors.text }}>
                  2. Bonus Tambahan Active Outlet (Pemerataan Sebaran Toko)
                </span>
              </label>

              {rules.aoBonusEnabled && (
                <div className="flex items-center flex-wrap gap-4">
                  <div className="flex items-center gap-1.5">
                    <span style={{ color: colors.textMuted }}>Syarat Min. ACH AO:</span>
                    <input
                      type="number"
                      value={rules.aoMinAch}
                      onChange={(e) => handleRuleChange("aoMinAch", e.target.value)}
                      className="w-14 px-2 py-1 rounded text-center mono"
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
                      value={rules.aoBonusPerOutlet}
                      onChange={(e) => handleRuleChange("aoBonusPerOutlet", e.target.value)}
                      className="w-20 px-2 py-1 rounded text-center mono"
                      style={{ background: colors.glassFill, border: `1px solid ${colors.glassBorder}` }}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Section 3: Program Insentif Produk Fokus (Multi-Varian & AO Gatekeeper) */}
          <div className="pt-3 border-t" style={{ borderColor: colors.glassBorder }}>
            <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
              <div>
                <div className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5" style={{ color: colors.violet }}>
                  <PackageCheck size={15} /> 3. Insentif Produk Fokus & Multi-Varian (Campur Rasa)
                </div>
                <div className="text-[11px] mt-0.5" style={{ color: colors.textMuted }}>
                  Atur target dorongan SKU tertentu (bisa campur semua rasa) dengan syarat prasyarat AO per golongan barang.
                </div>
              </div>

              {!editingFocusRule && (
                <button
                  onClick={() =>
                    setEditingFocusRule({
                      id: "",
                      name: "",
                      matchMode: "keyword",
                      keyword: "",
                      groupName: availableGroups[0] || "",
                      targetQty: 100,
                      rewardType: "per_unit",
                      rewardRate: 2000,
                      aoGatekeeperMode: "selected_groups",
                      aoGatekeeperMin: 120,
                      aoGatekeeperGroups: availableGroups.slice(0, 3),
                    })
                  }
                  className="sm-btn px-3 py-1.5 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5"
                  style={{ background: colors.violet + "22", border: `1px solid ${colors.violet}55`, color: colors.violet }}
                >
                  <Plus size={13} /> Tambah Program Produk Fokus
                </button>
              )}
            </div>

            {/* Form Editor Aturan Produk Fokus */}
            {editingFocusRule && (
              <FocusRuleEditor
                initialData={editingFocusRule}
                availableGroups={availableGroups}
                colors={colors}
                onSave={handleSaveFocusRule}
                onCancel={() => setEditingFocusRule(null)}
              />
            )}

            {/* List Aturan yang Tersimpan */}
            {Array.isArray(rules.focusRules) && rules.focusRules.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3 text-xs">
                {rules.focusRules.map((fr) => (
                  <div
                    key={fr.id}
                    className="p-3 rounded-xl border relative flex flex-col justify-between"
                    style={{ background: colors.glassSubtle, borderColor: colors.glassBorder }}
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-1.5">
                        <div className="font-bold text-sm" style={{ color: colors.text }}>
                          {fr.name}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => setEditingFocusRule(fr)}
                            className="p-1 rounded hover:opacity-80"
                            style={{ color: colors.blue }}
                            title="Edit Program"
                          >
                            <Edit3 size={13} />
                          </button>
                          <button
                            onClick={() => handleDeleteFocusRule(fr.id)}
                            className="p-1 rounded hover:opacity-80"
                            style={{ color: colors.coral }}
                            title="Hapus Program"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>

                      <div className="space-y-1 text-[11px]" style={{ color: colors.textMuted }}>
                        <div>
                          Metode: <b style={{ color: colors.text }}>
                            {fr.matchMode === "keyword" ? `Kata Kunci "${fr.keyword}" (Campur Varian)` : `Grup "${fr.groupName}"`}
                          </b>
                        </div>
                        <div>
                          Target: <b className="mono" style={{ color: colors.text }}>≥ {fmtNum(fr.targetQty)} ktn/pcs</b>
                          {" · "}
                          Bonus: <b className="mono" style={{ color: colors.mint }}>
                            {fr.rewardType === "flat" ? fmtRp(fr.rewardRate) + " (Flat)" : fmtRp(fr.rewardRate) + " / ktn"}
                          </b>
                        </div>
                        <div className="pt-1 border-t flex items-start gap-1" style={{ borderColor: colors.glassBorder }}>
                          <ShieldCheck size={12} className="mt-0.5 shrink-0" style={{ color: colors.gold }} />
                          <div>
                            Syarat AO:{" "}
                            {fr.aoGatekeeperMode === "none" ? (
                              <span style={{ color: colors.textMuted }}>Tanpa Syarat AO</span>
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
                ))}
              </div>
            ) : (
              !editingFocusRule && (
                <div className="p-4 rounded-xl border border-dashed text-center text-xs" style={{ borderColor: colors.glassBorder, color: colors.textMuted }}>
                  Belum ada program produk fokus yang didaftarkan. Klik tombol di atas untuk menambahkan (misal: Campur Rasa Taro 65g).
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
          label="Komisi Omset & AO"
          value={fmtRp((summary?.totalValueCommission ?? 0) + (summary?.totalAoBonus ?? 0))}
          icon={TrendingUp}
          accent={colors.gold}
          colors={colors}
        />
        <KpiCard
          label="Bonus Produk Fokus"
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
            Daftar Estimasi Komisi Per Salesman
          </div>
          <div className="text-xs inline-flex items-center gap-1" style={{ color: colors.textMuted }}>
            <Info size={13} />
            Klik tombol salin untuk membagikan slip via WhatsApp
          </div>
        </div>

        <DataTable
          colors={colors}
          rowKey="salesCode"
          initialSortKey="totalIncentive"
          searchable
          searchKeys={["salesName", "salesCode"]}
          searchPlaceholder="Cari nama salesman..."
          columns={[
            {
              key: "salesName",
              label: "Salesman",
              render: (r) => (
                <div>
                  <div className="font-semibold text-xs sm:text-sm" style={{ color: colors.text }}>
                    {r.salesName}
                  </div>
                  <div className="mono text-[11px]" style={{ color: colors.textMuted }}>
                    {r.salesCode}
                  </div>
                </div>
              ),
            },
            {
              key: "realValue",
              label: "Realisasi Omset",
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
              render: (r) => <AchBadge ach={r.ach} colors={colors} />,
            },
            {
              key: "valueCommission",
              label: "Komisi Omset",
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
                    {r.tierLabel} ({r.appliedRatePct}%)
                  </span>
                </div>
              ),
            },
            {
              key: "aoBonus",
              label: "Bonus AO",
              render: (r) => (
                <div>
                  <div className="mono font-semibold" style={{ color: r.aoBonus > 0 ? colors.gold : colors.textMuted }}>
                    {fmtRp(r.aoBonus)}
                  </div>
                  <div className="text-[10px] mt-0.5" style={{ color: colors.textMuted }}>
                    AO: {fmtNum(r.realAo)}/{fmtNum(r.targetAo)} ({r.achAo}%)
                  </div>
                </div>
              ),
            },
            {
              key: "totalFocusBonus",
              label: "Bonus Produk Fokus",
              render: (r) => {
                if (!Array.isArray(r.focusBreakdown) || r.focusBreakdown.length === 0) {
                  return <span className="mono text-xs" style={{ color: colors.textMuted }}>—</span>;
                }
                return (
                  <div>
                    <div className="mono font-bold" style={{ color: r.totalFocusBonus > 0 ? colors.violet : colors.textMuted }}>
                      {fmtRp(r.totalFocusBonus)}
                    </div>
                    <div className="flex flex-col gap-1 mt-1 max-w-[200px]">
                      {r.focusBreakdown.map((fb, idx) => {
                        if (fb.isQualified) {
                          return (
                            <span
                              key={idx}
                              className="text-[10px] px-1.5 py-0.5 rounded font-medium inline-flex items-center gap-1"
                              style={{ background: colors.mint + "1A", color: colors.mint, border: `1px solid ${colors.mint}33` }}
                              title={`Lolos: ${fmtNum(fb.totalQty)}/${fmtNum(fb.targetQty)} ktn`}
                            >
                              ✓ {fb.ruleName} ({fmtNum(fb.totalQty)}/{fmtNum(fb.targetQty)})
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
                              title={`Target Qty Lolos (${fmtNum(fb.totalQty)}/${fmtNum(fb.targetQty)}), tapi syarat AO belum lolos: ${failStr}`}
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
                          >
                            ○ {fb.ruleName} ({fmtNum(fb.totalQty)}/{fmtNum(fb.targetQty)})
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
 * Sub-komponen form editor aturan produk fokus
 */
function FocusRuleEditor({ initialData, availableGroups, colors, onSave, onCancel }) {
  const [formData, setFormData] = useState(initialData);

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

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.name.trim()) return;
    onSave(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="p-4 rounded-xl border space-y-4 mb-4" style={{ background: colors.glassFill, borderColor: colors.violet + "66" }}>
      <div className="font-bold text-xs uppercase tracking-wider flex items-center justify-between" style={{ color: colors.violet }}>
        <span>{formData.id ? "Edit Program Produk Fokus" : "Tambah Program Produk Fokus Baru"}</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
        <div>
          <label className="block mb-1 font-semibold" style={{ color: colors.text }}>Nama Program / Produk</label>
          <input
            type="text"
            required
            placeholder="Contoh: Campur Rasa Taro 65g"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className="w-full px-3 py-1.5 rounded-lg"
            style={{ background: colors.glassSubtle, border: `1px solid ${colors.glassBorder}` }}
          />
        </div>

        <div>
          <label className="block mb-1 font-semibold" style={{ color: colors.text }}>Metode Penentuan Produk</label>
          <select
            value={formData.matchMode}
            onChange={(e) => setFormData({ ...formData, matchMode: e.target.value })}
            className="w-full px-3 py-1.5 rounded-lg"
            style={{ background: colors.glassSubtle, border: `1px solid ${colors.glassBorder}` }}
          >
            <option value="keyword">Kata Kunci Nama Produk (Auto-Match Semua Varian Rasa)</option>
            <option value="group">Seluruh Produk Dalam Grup</option>
          </select>
        </div>
      </div>

      {formData.matchMode === "keyword" ? (
        <div className="text-xs">
          <label className="block mb-1 font-semibold" style={{ color: colors.text }}>Kata Kunci Pencarian Varian</label>
          <input
            type="text"
            required
            placeholder="Contoh: TARO 65G (akan mencakup rasa Keju, BBQ, Rumput Laut, dll)"
            value={formData.keyword}
            onChange={(e) => setFormData({ ...formData, keyword: e.target.value })}
            className="w-full px-3 py-1.5 rounded-lg"
            style={{ background: colors.glassSubtle, border: `1px solid ${colors.glassBorder}` }}
          />
          <span className="text-[10.5px] mt-0.5 block" style={{ color: colors.textMuted }}>
            Kuantitas dari semua transaksi yang memuat kata kunci ini akan otomatis diakumulasikan (campur rasa).
          </span>
        </div>
      ) : (
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

      {/* Target & Reward */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs pt-2 border-t" style={{ borderColor: colors.glassBorder }}>
        <div>
          <label className="block mb-1 font-semibold" style={{ color: colors.text }}>Target Minimal Kuantitas</label>
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
            <span style={{ color: colors.textMuted }}>ktn/pcs</span>
          </div>
        </div>

        <div>
          <label className="block mb-1 font-semibold" style={{ color: colors.text }}>Bentuk Komisi</label>
          <select
            value={formData.rewardType}
            onChange={(e) => setFormData({ ...formData, rewardType: e.target.value })}
            className="w-full px-3 py-1.5 rounded-lg"
            style={{ background: colors.glassSubtle, border: `1px solid ${colors.glassBorder}` }}
          >
            <option value="per_unit">Bonus per Kuantitas Terjual (Rp/ktn)</option>
            <option value="flat">Bonus Flat Sekali Cair (Rp)</option>
          </select>
        </div>

        <div>
          <label className="block mb-1 font-semibold" style={{ color: colors.text }}>
            {formData.rewardType === "flat" ? "Besaran Bonus Flat" : "Bonus per Satuan"}
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
      </div>

      {/* AO Gatekeeper (Prasyarat Pemerataan Golongan) */}
      <div className="pt-2 border-t text-xs space-y-2" style={{ borderColor: colors.glassBorder }}>
        <div className="font-bold flex items-center gap-1.5" style={{ color: colors.gold }}>
          <ShieldCheck size={14} /> Prasyarat Pemerataan Toko (AO Gatekeeper)
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block mb-1" style={{ color: colors.textMuted }}>Mode Syarat AO:</label>
            <select
              value={formData.aoGatekeeperMode}
              onChange={(e) => setFormData({ ...formData, aoGatekeeperMode: e.target.value })}
              className="w-full px-3 py-1.5 rounded-lg font-semibold"
              style={{ background: colors.glassSubtle, border: `1px solid ${colors.glassBorder}` }}
            >
              <option value="none">Tanpa Syarat AO (Hanya Target Kuantitas)</option>
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
          Simpan Aturan
        </button>
      </div>
    </form>
  );
}
