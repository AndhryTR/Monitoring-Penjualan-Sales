import { useState, useMemo } from "react";
import {
  X, ChevronDown, Plus, Copy, Sigma, Search, Crosshair, Package,
  AlertCircle, UserRound, Trash2, FileSpreadsheet, FileDown, Upload,
} from "lucide-react";
import { fmtRp, fmtNum } from "../../utils/formatters.js";
import { notifyExportSuccess } from "../../utils/notifyExport.js";
import { AddSalesModal } from "./AddSalesModal.jsx";
import { MasterImportPreview } from "./MasterImportPreview.jsx";
import { CustomSelect } from "../ui/CustomSelect.jsx";
import { ConfirmDialog } from "../ui/ConfirmDialog.jsx";

/* ============================================================================
   TARGET SALES EDITOR — master-detail layout untuk edit target sales.
   ⚠️ Sprint 7 / D1: sebelumnya inline di SettingsModal.jsx (~330 baris
   dengan nested accordion yang berantakan). Dipisah ke komponen sendiri
   dengan layout split-panel yang lebih jelas.

   Layout:
   - Panel kiri (320px): daftar sales dengan search + badge jumlah grup/fokus
   - Panel kanan (flex): form detail sales terpilih dengan 3 sub-tab
     (Target Value/AO, Grup Produk, Produk Fokus)
   - Mobile: stack vertical dengan tombol Back

   Improvements vs lama:
   - Font lebih besar (text-xs → text-sm, text-[10px] → text-xs)
   - Spacing lebih lega (gap-2 → gap-3, py-1.5 → py-2)
   - Master-detail: tidak perlu scroll panjang cari sales
   - Sub-tab: grup/fokus tidak saling tutup seperti accordion
   - Search + filter di panel kiri
============================================================================ */

const MATCH_TYPE_OPTIONS = [
  { value: "contains", label: "Mengandung (contains)" },
  { value: "exact", label: "Sama persis (exact)" },
  { value: "group", label: "Berdasarkan Grup Produk" },
];

export function TargetSalesEditor({ localTargets, setLocalTargets, colors, depotName = "" }) {
  const [selectedCode, setSelectedCode] = useState(localTargets[0]?.code || null);
  const [salesQuery, setSalesQuery] = useState("");
  const [subTab, setSubTab] = useState("target"); // "target" | "groups" | "focus"
  const [mobileShowDetail, setMobileShowDetail] = useState(false);
  // ⚠️ Sprint 18 / B: state untuk AddSalesModal
  const [addSalesOpen, setAddSalesOpen] = useState(false);
  // ⚠️ Sprint 18 / B: state untuk konfirmasi hapus sales
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  // ⚠️ Sprint 18 / C: state untuk MasterImportPreview modal
  const [importOpen, setImportOpen] = useState(false);
  // Konfirmasi salin grup/fokus dari sales lain (pengganti window.confirm)
  const [copyConfirm, setCopyConfirm] = useState(null); // { kind: 'groups'|'focus', salesCode, sourceCode }

  // Filter sales berdasarkan search query
  const filteredTargets = useMemo(() => {
    if (!salesQuery.trim()) return localTargets;
    const q = salesQuery.toLowerCase().trim();
    return localTargets.filter((t) =>
      t.name.toLowerCase().includes(q) || t.code.toLowerCase().includes(q)
    );
  }, [localTargets, salesQuery]);

  const selected = localTargets.find((t) => t.code === selectedCode) || null;

  // ⚠️ Sprint 18 / B: handler tambah sales baru
  const handleAddSales = (newSales) => {
    setLocalTargets((prev) => [...prev, newSales]);
    setSelectedCode(newSales.code);
  };

  // ⚠️ Sprint 18 / B: handler hapus sales
  const handleDeleteSales = (salesCode) => {
    setLocalTargets((prev) => prev.filter((t) => t.code !== salesCode));
    // Bila sales yang dihapus sedang dipilih, pilih sales pertama yang tersisa
    if (selectedCode === salesCode) {
      setSelectedCode(null);
    }
    setDeleteConfirm(null);
  };

  // ⚠️ Sprint 18 / C: handler import Excel master
  // Replace seluruh localTargets dengan hasil import (user sudah konfirmasi di modal preview).
  const handleImportConfirm = (importedTargets) => {
    setLocalTargets(importedTargets);
    // Reset selection — sales yang sebelumnya dipilih mungkin tidak ada lagi
    setSelectedCode(importedTargets[0]?.code || null);
  };

  // ⚠️ Sprint 18 / C: handler download template Excel kosong
  const handleDownloadTemplate = async () => {
    const { downloadMasterTemplate } = await import("../../utils/masterTemplate.js");
    downloadMasterTemplate({ depotName: "template" });
  };

  // ⚠️ Sprint 18 / C+: handler export localTargets ke Excel 3-sheet
  // Format sama dengan template — bisa di-import balik (round-trip).
  const handleExportExcel = async () => {
    const { exportMasterExcel } = await import("../../utils/masterExport.js");
    exportMasterExcel(localTargets, { depotName });
    await notifyExportSuccess("Export berhasil", "Master Target (Excel)");
  };

  // ---- Handlers (sama logic dengan versi lama, dipindah ke sini) ----
  const handleTargetChange = (salesCode, field, value) => {
    setLocalTargets((prev) => prev.map((t) => {
      if (t.code === salesCode) {
        const newTotal = { ...t.total, [field]: Number(value) || 0 };
        return { ...t, total: newTotal };
      }
      return t;
    }));
  };

  const handleAutoSumValue = (salesCode) => {
    setLocalTargets((prev) => prev.map((t) => {
      if (t.code !== salesCode) return t;
      const sum = (t.groups || []).reduce((acc, g) => acc + (Number(g.value) || 0), 0);
      return { ...t, total: { ...t.total, value: sum } };
    }));
  };

  // ---- Grup Produk handlers ----
  const handleGroupChange = (salesCode, groupIdx, field, value) => {
    setLocalTargets((prev) => prev.map((t) => {
      if (t.code !== salesCode) return t;
      const groups = t.groups.map((g, i) =>
        i === groupIdx ? { ...g, [field]: field === "name" ? value : (Number(value) || 0) } : g
      );
      return { ...t, groups };
    }));
  };

  const handleGroupAdd = (salesCode) => {
    setLocalTargets((prev) => prev.map((t) =>
      t.code === salesCode
        ? { ...t, groups: [...t.groups, { name: "", value: 0, ao: 0, focus: false }] }
        : t
    ));
  };

  const handleGroupRemove = (salesCode, groupIdx) => {
    setLocalTargets((prev) => prev.map((t) =>
      t.code === salesCode
        ? { ...t, groups: t.groups.filter((_, i) => i !== groupIdx) }
        : t
    ));
  };

  const handleGroupFocusToggle = (salesCode, groupIdx) => {
    setLocalTargets((prev) => prev.map((t) => {
      if (t.code !== salesCode) return t;
      const groups = t.groups.map((g, i) =>
        i === groupIdx ? { ...g, focus: !g.focus } : g
      );
      return { ...t, groups };
    }));
  };

  const handleGroupCopyFrom = (salesCode, sourceCode) => {
    const source = localTargets.find((t) => t.code === sourceCode);
    if (!source || !source.groups.length) return;
    setCopyConfirm(null);
    setLocalTargets((prev) => prev.map((t) =>
      t.code === salesCode
        ? { ...t, groups: source.groups.map((g) => ({ ...g })) }
        : t
    ));
  };

  // ---- Produk Fokus handlers ----
  const handleFocusChange = (salesCode, focusIdx, field, value) => {
    setLocalTargets((prev) => prev.map((t) => {
      if (t.code !== salesCode) return t;
      const focus = t.focus.map((f, i) =>
        i === focusIdx ? { ...f, [field]: field === "target" ? (Number(value) || 0) : value } : f
      );
      return { ...t, focus };
    }));
  };

  const handleFocusAdd = (salesCode) => {
    setLocalTargets((prev) => prev.map((t) =>
      t.code === salesCode
        ? { ...t, focus: [...t.focus, { name: "", target: 0, keyword: "", unit: "KARTON", matchType: "contains" }] }
        : t
    ));
  };

  const handleFocusRemove = (salesCode, focusIdx) => {
    setLocalTargets((prev) => prev.map((t) =>
      t.code === salesCode
        ? { ...t, focus: t.focus.filter((_, i) => i !== focusIdx) }
        : t
    ));
  };

  const handleFocusCopyFrom = (salesCode, sourceCode) => {
    const source = localTargets.find((t) => t.code === sourceCode);
    if (!source || !source.focus.length) return;
    setCopyConfirm(null);
    setLocalTargets((prev) => prev.map((t) =>
      t.code === salesCode
        ? { ...t, focus: source.focus.map((f) => ({ ...f })) }
        : t
    ));
  };

  // ---- Mobile: back to list ----
  const handleMobileBack = () => {
    setMobileShowDetail(false);
  };

  // ---- Pilih sales di panel kiri ----
  const handleSelectSales = (code) => {
    setSelectedCode(code);
    setMobileShowDetail(true);
    setSubTab("target"); // reset ke tab pertama tiap ganti sales
  };

  // ---- Other sales untuk dropdown "Salin dari" ----
  const otherSalesWithGroups = selected
    ? localTargets.filter((o) => o.code !== selected.code && o.groups.length > 0)
    : [];
  const otherSalesWithFocus = selected
    ? localTargets.filter((o) => o.code !== selected.code && o.focus.length > 0)
    : [];

  return (
    <div className="flex flex-col md:flex-row gap-3 h-[60vh] md:h-[65vh]">
      {/* ---- Panel kiri: daftar sales ---- */}
      <div
        className={`md:w-80 shrink-0 flex flex-col rounded-xl overflow-hidden ${mobileShowDetail ? "hidden md:flex" : "flex"}`}
        style={{ background: colors.glassFill, border: `1px solid ${colors.glassBorder}` }}
      >
        {/* Header panel kiri: toolbar + search */}
        <div className="p-3 shrink-0" style={{ borderBottom: `1px solid ${colors.glassBorder}` }}>
          {/* ⚠️ Sprint 18 / B+C+C+: Toolbar — Add Sales + Import Excel + Export Excel + Download Template */}
          <div className="flex gap-1.5 mb-2.5">
            <button
              onClick={() => setAddSalesOpen(true)}
              className="flex-1 sm-btn inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold"
              style={{ background: colors.mint + "1A", color: colors.mint, border: `1px solid ${colors.mint}55` }}
              title="Tambah sales baru"
            >
              <Plus size={12} /> Tambah Sales
            </button>
            <button
              onClick={() => setImportOpen(true)}
              className="flex-1 sm-btn inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold"
              style={{ background: colors.violet + "1A", color: colors.violet, border: `1px solid ${colors.violet}55` }}
              title="Import master sales+target dari Excel 3-sheet"
            >
              <Upload size={12} /> Import
            </button>
            <button
              onClick={handleExportExcel}
              disabled={localTargets.length === 0}
              className="sm-btn inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ background: colors.gold + "1A", color: colors.gold, border: `1px solid ${colors.gold}55` }}
              title={localTargets.length === 0 ? "Belum ada sales untuk di-export" : "Export daftar sales+target ke Excel 3-sheet"}
              aria-label="Export ke Excel"
            >
              <FileDown size={12} /> Export
            </button>
            <button
              onClick={handleDownloadTemplate}
              className="sm-btn inline-flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-semibold"
              style={{ background: colors.glassSubtle, color: colors.textMuted, border: `1px solid ${colors.glassBorder}` }}
              title="Download template Excel kosong"
              aria-label="Download template Excel"
            >
              <FileSpreadsheet size={12} />
            </button>
          </div>

          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: colors.textMuted }} />
            <input
              value={salesQuery}
              onChange={(e) => setSalesQuery(e.target.value)}
              placeholder="Cari sales..."
              className="w-full pl-9 pr-8 py-2 rounded-lg text-sm outline-none"
              style={{ background: colors.glassSubtle, border: `1px solid ${colors.glassBorder}`, color: colors.text }}
            />
            {salesQuery && (
              <button onClick={() => setSalesQuery("")} className="absolute right-2.5 top-1/2 -translate-y-1/2" style={{ color: colors.textMuted }} aria-label="Bersihkan pencarian">
                <X size={14} />
              </button>
            )}
          </div>
          <p className="text-xs mt-2" style={{ color: colors.textMuted }}>
            {filteredTargets.length} dari {localTargets.length} sales
          </p>
        </div>

        {/* List sales */}
        <div className="overflow-y-auto flex-1">
          {filteredTargets.length === 0 ? (
            <div className="text-center py-8" style={{ color: colors.textMuted }}>
              <UserRound size={24} className="mx-auto mb-2" style={{ opacity: 0.3 }} />
              <p className="text-sm">Tidak ada sales yang cocok</p>
            </div>
          ) : (
            filteredTargets.map((t) => {
              const isSelected = t.code === selectedCode;
              return (
                <div
                  key={t.code}
                  onClick={() => handleSelectSales(t.code)}
                  className="w-full text-left px-3 py-2.5 flex items-center gap-2.5 transition-colors cursor-pointer group"
                  style={{
                    background: isSelected ? colors.glassFillStrong : "transparent",
                    borderBottom: `1px solid ${colors.glassBorder}`,
                  }}
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate" style={{ color: isSelected ? colors.mint : colors.text }}>
                      {t.name}
                    </div>
                    <div className="text-xs mono" style={{ color: colors.textMuted }}>{t.code}</div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full" style={{ background: colors.mint + "1A", color: colors.mint }}>
                      {t.groups.length}G
                    </span>
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full" style={{ background: colors.violet + "1A", color: colors.violet }}>
                      {t.focus.length}F
                    </span>
                    {/* ⚠️ Sprint 18 / B: tombol hapus sales — tampil saat hover */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteConfirm(t);
                      }}
                      className="p-1 rounded opacity-0 group-hover:opacity-60 hover:!opacity-100 transition-opacity"
                      style={{ color: colors.coral }}
                      title="Hapus sales"
                      aria-label={`Hapus sales ${t.name}`}
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ---- Panel kanan: form detail sales terpilih ---- */}
      <div
        className={`flex-1 flex flex-col rounded-xl overflow-hidden ${mobileShowDetail ? "flex" : "hidden md:flex"}`}
        style={{ background: colors.glassFill, border: `1px solid ${colors.glassBorder}` }}
      >
        {selected ? (
          <>
            {/* Header panel kanan: nama sales + tombol back mobile */}
            <div className="p-3 shrink-0 flex items-center gap-2" style={{ borderBottom: `1px solid ${colors.glassBorder}` }}>
              <button
                onClick={handleMobileBack}
                className="md:hidden sm-btn p-1.5 rounded-lg shrink-0"
                style={{ background: colors.glassSubtle }}
                aria-label="Kembali ke daftar sales"
              >
                <ChevronDown size={16} style={{ transform: "rotate(90deg)" }} />
              </button>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold disp truncate">{selected.name}</div>
                <div className="text-xs mono" style={{ color: colors.textMuted }}>Kode: {selected.code} · Tier: {selected.tier || "-"}</div>
              </div>
            </div>

            {/* Sub-tab navigation */}
            <div className="px-3 pt-2 flex gap-1 shrink-0" style={{ borderBottom: `1px solid ${colors.glassBorder}` }}>
              {[
                { key: "target", label: "Target", icon: Sigma },
                { key: "groups", label: `Grup (${selected.groups.length})`, icon: Package },
                { key: "focus", label: `Fokus (${selected.focus.length})`, icon: Crosshair },
              ].map((tab) => {
                const Icon = tab.icon;
                const on = subTab === tab.key;
                return (
                  <button
                    key={tab.key}
                    onClick={() => setSubTab(tab.key)}
                    className="px-3 py-2 rounded-t-lg text-xs font-semibold inline-flex items-center gap-1.5 transition-colors"
                    style={{
                      background: on ? colors.glassFillStrong : "transparent",
                      color: on ? colors.mint : colors.textMuted,
                      borderBottom: on ? `2px solid ${colors.mint}` : "2px solid transparent",
                    }}
                  >
                    <Icon size={12} /> {tab.label}
                  </button>
                );
              })}
            </div>

            {/* Content area */}
            <div className="overflow-y-auto flex-1 p-4">
              {/* ---- Sub-tab: Target Value/AO ---- */}
              {subTab === "target" && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Target Value (Rp)</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        value={selected.total.value}
                        onChange={(e) => handleTargetChange(selected.code, "value", e.target.value)}
                        className="flex-1 px-3 py-2 rounded-lg mono text-sm outline-none"
                        style={{ background: colors.glassSubtle, border: `1px solid ${colors.glassBorder}`, color: colors.text }}
                      />
                      <button
                        onClick={() => handleAutoSumValue(selected.code)}
                        disabled={!(selected.groups || []).length}
                        title="Jumlahkan otomatis semua target value grup produk sales ini"
                        className="sm-btn px-3 py-2 rounded-lg shrink-0 disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-1.5 text-xs font-semibold"
                        style={{ background: colors.gold + "1A", color: colors.gold, border: `1px solid ${colors.gold}55` }}
                      >
                        <Sigma size={14} /> Auto-sum
                      </button>
                    </div>
                    <p className="text-xs mt-1.5" style={{ color: colors.textMuted }}>
                      Total target penjualan dalam Rupiah. Klik Auto-sum untuk jumlahkan dari target grup produk di bawah.
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Target Active Outlet (AO)</label>
                    <input
                      type="number"
                      value={selected.total.ao}
                      onChange={(e) => handleTargetChange(selected.code, "ao", e.target.value)}
                      className="w-full px-3 py-2 rounded-lg mono text-sm outline-none"
                      style={{ background: colors.glassSubtle, border: `1px solid ${colors.glassBorder}`, color: colors.text }}
                    />
                    <p className="text-xs mt-1.5" style={{ color: colors.textMuted }}>
                      Jumlah outlet aktif yang ditargetkan untuk sales ini.
                    </p>
                  </div>

                  {/* Summary card */}
                  <div className="p-3 rounded-lg" style={{ background: colors.glassSubtle, border: `1px solid ${colors.glassBorder}` }}>
                    <div className="text-xs uppercase tracking-wider font-semibold mb-2" style={{ color: colors.textMuted }}>Ringkasan Target</div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <div className="text-xs" style={{ color: colors.textMuted }}>Target Value</div>
                        <div className="mono text-sm font-bold">{fmtRp(selected.total.value)}</div>
                      </div>
                      <div>
                        <div className="text-xs" style={{ color: colors.textMuted }}>Target AO</div>
                        <div className="mono text-sm font-bold">{fmtNum(selected.total.ao)}</div>
                      </div>
                      <div>
                        <div className="text-xs" style={{ color: colors.textMuted }}>Sum Grup Value</div>
                        <div className="mono text-sm font-bold" style={{ color: selected.groups.reduce((a, g) => a + (Number(g.value) || 0), 0) === selected.total.value ? colors.mint : colors.coral }}>
                          {fmtRp(selected.groups.reduce((a, g) => a + (Number(g.value) || 0), 0))}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs" style={{ color: colors.textMuted }}>Selisih</div>
                        <div className="mono text-sm font-bold" style={{ color: selected.groups.reduce((a, g) => a + (Number(g.value) || 0), 0) === selected.total.value ? colors.mint : colors.coral }}>
                          {fmtRp(selected.total.value - selected.groups.reduce((a, g) => a + (Number(g.value) || 0), 0))}
                        </div>
                      </div>
                    </div>
                    {selected.groups.reduce((a, g) => a + (Number(g.value) || 0), 0) !== selected.total.value && (
                      <div className="flex items-center gap-1.5 mt-2 text-xs" style={{ color: colors.coral }}>
                        <AlertCircle size={12} /> Sum grup ≠ target value — mungkin perlu Auto-sum
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ---- Sub-tab: Grup Produk ---- */}
              {subTab === "groups" && (
                <div className="space-y-3">
                  {/* Copy from other sales */}
                  {otherSalesWithGroups.length > 0 && (
                    <div className="p-2 rounded-lg" style={{ background: colors.glassSubtle }}>
                      <CustomSelect
                        value=""
                        onChange={(val) => val && setCopyConfirm({ kind: "groups", salesCode: selected.code, sourceCode: val })}
                        placeholder="Salin grup dari sales lain..."
                        icon={Copy}
                        size="xs"
                        fullWidth={true}
                        colors={colors}
                        options={otherSalesWithGroups.map((o) => ({
                          value: o.code,
                          label: o.name,
                          badge: `${o.groups.length} grup`,
                        }))}
                      />
                    </div>
                  )}

                  {selected.groups.length === 0 ? (
                    <div className="text-center py-8" style={{ color: colors.textMuted }}>
                      <Package size={24} className="mx-auto mb-2" style={{ opacity: 0.3 }} />
                      <p className="text-sm">Belum ada target grup untuk sales ini.</p>
                      <p className="text-xs mt-1">Klik tombol di bawah untuk menambah grup produk.</p>
                    </div>
                  ) : (
                    selected.groups.map((g, gi) => (
                      <div
                        key={`g-${gi}`}
                        className="p-3 rounded-lg relative"
                        style={{ background: colors.glassSubtle, border: `1px solid ${g.focus ? colors.violet + "66" : colors.glassBorder}` }}
                      >
                        {/* Action buttons */}
                        <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5">
                          <button
                            onClick={() => handleGroupFocusToggle(selected.code, gi)}
                            title={g.focus ? "Hapus dari grup fokus" : "Jadikan grup fokus"}
                            aria-pressed={!!g.focus}
                            className="sm-btn px-2 py-1 rounded-md flex items-center gap-1 text-[10px] font-semibold"
                            style={{
                              background: g.focus ? colors.violet + "1A" : "transparent",
                              color: g.focus ? colors.violet : colors.textMuted,
                              border: `1px solid ${g.focus ? colors.violet + "66" : colors.glassBorder}`,
                            }}
                          >
                            <Crosshair size={11} /> {g.focus ? "FOKUS" : "Fokus"}
                          </button>
                          <button
                            onClick={() => handleGroupRemove(selected.code, gi)}
                            title="Hapus target grup ini"
                            className="sm-btn p-1 rounded-md"
                            style={{ color: colors.coral }}
                          >
                            <X size={12} />
                          </button>
                        </div>

                        <div className="mb-2 pr-28">
                          <label className="block text-xs mb-1" style={{ color: colors.textMuted }}>Nama Grup</label>
                          <input
                            value={g.name}
                            onChange={(e) => handleGroupChange(selected.code, gi, "name", e.target.value)}
                            placeholder="mis. ENESIS"
                            className="w-full px-2.5 py-1.5 rounded text-sm outline-none"
                            style={{ background: colors.glassFill, border: `1px solid ${colors.glassBorder}`, color: colors.text }}
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-xs mb-1" style={{ color: colors.textMuted }}>Target Value (Rp)</label>
                            <input
                              type="number"
                              value={g.value}
                              onChange={(e) => handleGroupChange(selected.code, gi, "value", e.target.value)}
                              className="w-full px-2.5 py-1.5 rounded text-sm mono outline-none"
                              style={{ background: colors.glassFill, border: `1px solid ${colors.glassBorder}`, color: colors.text }}
                            />
                          </div>
                          <div>
                            <label className="block text-xs mb-1" style={{ color: colors.textMuted }}>Target AO</label>
                            <input
                              type="number"
                              value={g.ao}
                              onChange={(e) => handleGroupChange(selected.code, gi, "ao", e.target.value)}
                              className="w-full px-2.5 py-1.5 rounded text-sm mono outline-none"
                              style={{ background: colors.glassFill, border: `1px solid ${colors.glassBorder}`, color: colors.text }}
                            />
                          </div>
                        </div>
                      </div>
                    ))
                  )}

                  <button
                    onClick={() => handleGroupAdd(selected.code)}
                    className="sm-btn w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold"
                    style={{ background: colors.mint + "14", color: colors.mint, border: `1px dashed ${colors.mint}66` }}
                  >
                    <Plus size={14} /> Tambah Grup Produk
                  </button>
                </div>
              )}

              {/* ---- Sub-tab: Produk Fokus ---- */}
              {subTab === "focus" && (
                <div className="space-y-3">
                  {otherSalesWithFocus.length > 0 && (
                    <div className="p-2 rounded-lg" style={{ background: colors.glassSubtle }}>
                      <CustomSelect
                        value=""
                        onChange={(val) => val && setCopyConfirm({ kind: "focus", salesCode: selected.code, sourceCode: val })}
                        placeholder="Salin fokus dari sales lain..."
                        icon={Copy}
                        size="xs"
                        fullWidth={true}
                        colors={colors}
                        options={otherSalesWithFocus.map((o) => ({
                          value: o.code,
                          label: o.name,
                          badge: `${o.focus.length} produk`,
                        }))}
                      />
                    </div>
                  )}

                  {selected.focus.length === 0 ? (
                    <div className="text-center py-8" style={{ color: colors.textMuted }}>
                      <Crosshair size={24} className="mx-auto mb-2" style={{ opacity: 0.3 }} />
                      <p className="text-sm">Belum ada produk fokus untuk sales ini.</p>
                      <p className="text-xs mt-1">Klik tombol di bawah untuk menambah produk fokus.</p>
                    </div>
                  ) : (
                    selected.focus.map((f, i) => {
                      const matchType = f.matchType || (f.keyword === "__GROUP__" ? "group" : f.keyword === "GAS_EXACT" ? "exact" : "contains");
                      return (
                        <div
                          key={`f-${i}`}
                          className="p-3 rounded-lg relative"
                          style={{ background: colors.glassSubtle, border: `1px solid ${colors.glassBorder}` }}
                        >
                          <button
                            onClick={() => handleFocusRemove(selected.code, i)}
                            title="Hapus produk fokus ini"
                            className="sm-btn absolute top-2.5 right-2.5 p-1 rounded-md"
                            style={{ color: colors.coral }}
                          >
                            <X size={12} />
                          </button>

                          <div className="grid grid-cols-2 gap-2 mb-2 pr-8">
                            <div>
                              <label className="block text-xs mb-1" style={{ color: colors.textMuted }}>Nama Produk</label>
                              <input
                                value={f.name}
                                onChange={(e) => handleFocusChange(selected.code, i, "name", e.target.value)}
                                placeholder="mis. FISH CAKE"
                                className="w-full px-2.5 py-1.5 rounded text-sm outline-none"
                                style={{ background: colors.glassFill, border: `1px solid ${colors.glassBorder}`, color: colors.text }}
                              />
                            </div>
                            <div>
                              <label className="block text-xs mb-1" style={{ color: colors.textMuted }}>Tipe Pencocokan</label>
                              <CustomSelect
                                value={matchType}
                                onChange={(val) => handleFocusChange(selected.code, i, "matchType", val)}
                                size="sm"
                                fullWidth={true}
                                colors={colors}
                                searchable={false}
                                options={MATCH_TYPE_OPTIONS.map((o) => ({
                                  value: o.value,
                                  label: o.label,
                                }))}
                              />
                            </div>
                          </div>

                          {matchType === "group" ? (
                            <p className="text-xs mb-2" style={{ color: colors.textMuted }}>
                              Akan dicocokkan ke baris dengan Grup Produk = <b>{f.name || "(isi Nama Produk di atas)"}</b>
                            </p>
                          ) : (
                            <div className="mb-2">
                              <label className="block text-xs mb-1" style={{ color: colors.textMuted }}>
                                Kata Kunci {matchType === "exact" ? "(harus sama persis dengan nama produk)" : "(dicari di dalam nama produk)"}
                              </label>
                              <input
                                value={f.keyword}
                                onChange={(e) => handleFocusChange(selected.code, i, "keyword", e.target.value)}
                                placeholder="mis. FISH"
                                className="w-full px-2.5 py-1.5 rounded text-sm mono outline-none"
                                style={{ background: colors.glassFill, border: `1px solid ${colors.glassBorder}`, color: colors.text }}
                              />
                              {!f.keyword && (
                                <p className="text-xs mt-1" style={{ color: colors.coral }}>Wajib diisi — kalau kosong, akan cocok ke SEMUA produk.</p>
                              )}
                            </div>
                          )}

                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-xs mb-1" style={{ color: colors.textMuted }}>Target</label>
                              <input
                                type="number"
                                value={f.target}
                                onChange={(e) => handleFocusChange(selected.code, i, "target", e.target.value)}
                                className="w-full px-2.5 py-1.5 rounded text-sm mono outline-none"
                                style={{ background: colors.glassFill, border: `1px solid ${colors.glassBorder}`, color: colors.text }}
                              />
                            </div>
                            <div>
                              <label className="block text-xs mb-1" style={{ color: colors.textMuted }}>Satuan</label>
                              <input
                                value={f.unit}
                                onChange={(e) => handleFocusChange(selected.code, i, "unit", e.target.value)}
                                placeholder="KARTON"
                                className="w-full px-2.5 py-1.5 rounded text-sm outline-none"
                                style={{ background: colors.glassFill, border: `1px solid ${colors.glassBorder}`, color: colors.text }}
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}

                  <button
                    onClick={() => handleFocusAdd(selected.code)}
                    className="sm-btn w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold"
                    style={{ background: colors.violet + "14", color: colors.violet, border: `1px dashed ${colors.violet}66` }}
                  >
                    <Plus size={14} /> Tambah Produk Fokus
                  </button>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-center p-8">
            <div>
              <UserRound size={32} className="mx-auto mb-3" style={{ color: colors.textMuted, opacity: 0.3 }} />
              <p className="text-sm" style={{ color: colors.textMuted }}>Pilih sales di panel kiri untuk mulai edit</p>
            </div>
          </div>
        )}
      </div>

      {/* ⚠️ Sprint 18 / B: AddSalesModal */}
      <AddSalesModal
        isOpen={addSalesOpen}
        onClose={() => setAddSalesOpen(false)}
        onAdd={handleAddSales}
        existingCodes={localTargets.map((t) => t.code)}
        colors={colors}
      />

      {/* ⚠️ Sprint 18 / C: MasterImportPreview modal */}
      <MasterImportPreview
        isOpen={importOpen}
        onClose={() => setImportOpen(false)}
        onConfirm={handleImportConfirm}
        existingCodes={localTargets.map((t) => t.code)}
        colors={colors}
      />

      {/* ⚠️ Sprint 18 / B: Konfirmasi hapus sales */}
      {deleteConfirm && (
        <DeleteSalesConfirm
          sales={deleteConfirm}
          colors={colors}
          onCancel={() => setDeleteConfirm(null)}
          onConfirm={() => handleDeleteSales(deleteConfirm.code)}
        />
      )}

      {/* Konfirmasi salin grup/fokus (pengganti window.confirm) */}
      {(() => {
        if (!copyConfirm) return null;
        const source = localTargets.find((t) => t.code === copyConfirm.sourceCode);
        const isGroups = copyConfirm.kind === "groups";
        const count = isGroups ? (source?.groups.length || 0) : (source?.focus.length || 0);
        return (
          <ConfirmDialog
            isOpen={!!copyConfirm}
            onCancel={() => setCopyConfirm(null)}
            onConfirm={() => isGroups
              ? handleGroupCopyFrom(copyConfirm.salesCode, copyConfirm.sourceCode)
              : handleFocusCopyFrom(copyConfirm.salesCode, copyConfirm.sourceCode)}
            title={isGroups ? "Salin target grup?" : "Salin produk fokus?"}
            subtitle={source
              ? `Salin ${count} ${isGroups ? "target grup" : "produk fokus"} dari ${source.name}? Daftar yang sudah ada di sales ini akan diganti.`
              : ""}
            confirmLabel="Salin"
            variant="default"
            colors={colors}
          />
        );
      })()}
    </div>
  );
}

/* ============================================================================
   DELETE SALES CONFIRM — konfirmasi sederhana sebelum hapus sales.
   Tidak perlu ketik nama (sales hapus tidak sekrusial depo hapus).
============================================================================ */
function DeleteSalesConfirm({ sales, colors, onCancel, onConfirm }) {
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.6)" }}
      onClick={onCancel}
    >
      <div
        className="w-full max-w-sm rounded-2xl overflow-hidden"
        style={{ background: colors.modalPanelBg || colors.glassFillStrong, border: `1px solid ${colors.coral}` }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5" style={{ borderBottom: `1px solid ${colors.glassBorder}` }}>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg" style={{ background: colors.coral + "1A" }}>
              <AlertCircle size={18} style={{ color: colors.coral }} />
            </div>
            <div className="text-lg font-bold disp" style={{ color: colors.text }}>Hapus Sales</div>
          </div>
          <p className="text-sm mt-3" style={{ color: colors.text }}>
            Hapus sales <span className="font-bold" style={{ color: colors.coral }}>{sales.name}</span> ({sales.code})?
          </p>
          <p className="text-xs mt-2" style={{ color: colors.textMuted }}>
            Target, grup, dan fokus untuk sales ini akan dihapus. Transaksi yang sudah diupload TIDAK terhapus — hanya relasi sales ke depo aktif.
          </p>
        </div>
        <div className="p-5 flex gap-2">
          <button
            onClick={onCancel}
            className="flex-1 sm-btn px-4 py-2 rounded-lg text-sm font-semibold"
            style={{ background: colors.glassFill, color: colors.text, border: `1px solid ${colors.glassBorder}` }}
          >
            Batal
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 px-4 py-2 rounded-lg text-sm font-semibold"
            style={{ background: colors.coral, color: "#fff" }}
          >
            Hapus
          </button>
        </div>
      </div>
    </div>
  );
}
