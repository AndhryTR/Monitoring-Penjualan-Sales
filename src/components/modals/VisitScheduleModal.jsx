import { useState, useEffect, useMemo, useRef } from "react";
import {
  CalendarDays, X, Download, Upload, Search, Check, AlertCircle,
  Sparkles, CheckCircle2, Copy, Send, Layers, RotateCcw,
  ArrowRight, Users,
} from "lucide-react";
import { useScrollLock, useEscapeKey } from "../../hooks/useModalA11y.js";
import { fmtRp } from "../../utils/formatters.js";
import { CustomSelect } from "../ui/CustomSelect.jsx";
import { ConfirmDialog } from "../ui/ConfirmDialog.jsx";
import {
  DAYS_OF_WEEK, DAY_LABELS, DAY_COLORS,
  getStoredSchedule, saveStoredSchedule,
  parseOutletCode, detectPreferredOrderDays, groupOutletsByAreaCode,
  exportScheduleExcel, parseScheduleExcel, buildDailyCallSheetWhatsApp,
} from "../../utils/visitScheduleStorage.js";

/* ============================================================================
   VISIT SCHEDULE MODAL (BEAT PLAN MANAGER)
   - Tab 1: Buat Cepat (Auto-Mapping per Kode Alamat & Rekomendasi Histori)
   - Tab 2: Papan Mingguan (Weekly Kanban Board: Senin - Sabtu)
   - Tab 3: Ekspor & Call Sheet WhatsApp
   ============================================================================ */

export function VisitScheduleModal({
  isOpen,
  onClose,
  outlets = [],
  rawRows = [],
  targets = [],
  colors,
  depotName = "",
  coords = {},
  onScheduleSaved,
}) {
  const isLight = colors?.colorScheme === "light";

  const [activeTab, setActiveTab] = useState("quick"); // "quick" | "kanban" | "export"
  const [selectedSales, setSelectedSales] = useState("all");
  const [schedule, setSchedule] = useState({});
  const [search, setSearch] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [notification, setNotification] = useState(null); // { type: 'success'|'error', text: '' }
  const [copiedWA, setCopiedWA] = useState(false);
  // Konfirmasi reset jadwal sales (pengganti window.confirm)
  const [resetConfirm, setResetConfirm] = useState(false);

  // Tab export & quick-assign state
  const [exportDay, setExportDay] = useState("senin");
  const [areaDays, setAreaDays] = useState({});

  const fileInputRef = useRef(null);

  useScrollLock(isOpen);
  useEscapeKey(isOpen, onClose);

  // Muat jadwal tersimpan saat modal dibuka
  useEffect(() => {
    if (isOpen) {
      const stored = getStoredSchedule(depotName);
      setSchedule(stored);
      setNotification(null);
      setSearch("");
      setCopiedWA(false);
    }
  }, [isOpen, depotName]);

  // Daftar sales unik yang ada di data (tanpa duplikasi antara targets & outlet)
  const salesOptions = useMemo(() => {
    const countsByName = new Map();
    const normalizedMap = new Map();

    const registerSales = (rawName, countToAdd = 0) => {
      if (!rawName || rawName === "-") return;
      const cleanName = String(rawName).trim();
      const normKey = cleanName.toLowerCase();
      if (normalizedMap.has(normKey)) {
        const canonical = normalizedMap.get(normKey);
        countsByName.set(canonical, (countsByName.get(canonical) || 0) + countToAdd);
      } else {
        normalizedMap.set(normKey, cleanName);
        countsByName.set(cleanName, countToAdd);
      }
    };

    // 1. Kumpulkan nama sales asli langsung dari data outlet
    outlets.forEach((o) => {
      if (Array.isArray(o.salesNames)) {
        o.salesNames.forEach((sName) => registerSales(sName, 1));
      } else if (o.salesLabel && o.salesLabel !== "-") {
        registerSales(o.salesLabel, 1);
      }
    });

    // 2. Daftarkan sales dari targets jika ada yang belum bertransaksi di outlet
    if (targets && targets.length) {
      targets.forEach((t) => {
        const sName = t.name || t.code;
        registerSales(sName, 0);
      });
    }

    // 3. Susun daftar opsi bersih terurut berdasarkan jumlah toko terbanyak
    return Array.from(countsByName.entries())
      .map(([name, count]) => ({
        code: name,
        name,
        count,
      }))
      .sort((a, b) => {
        if ((a.count > 0) !== (b.count > 0)) {
          return a.count > 0 ? -1 : 1;
        }
        if (b.count !== a.count) return b.count - a.count;
        return a.name.localeCompare(b.name);
      });
  }, [targets, outlets]);

  // Analisis hari order transaksi historis
  const preferredDays = useMemo(() => {
    return detectPreferredOrderDays(rawRows);
  }, [rawRows]);

  // Filter outlet berdasarkan sales yang sedang dipilih
  const currentSalesOutlets = useMemo(() => {
    if (selectedSales === "all") return outlets;
    return outlets.filter((o) => {
      if (Array.isArray(o.salesNames)) {
        return o.salesNames.includes(selectedSales);
      }
      return o.salesLabel === selectedSales;
    });
  }, [outlets, selectedSales]);

  // Kelompokkan outlet sales terpilih berdasarkan Kode Alamat
  const areaGroups = useMemo(() => {
    return groupOutletsByAreaCode(currentSalesOutlets, preferredDays);
  }, [currentSalesOutlets, preferredDays]);

  // Statistik kelengkapan jadwal
  const stats = useMemo(() => {
    let scheduled = 0;
    currentSalesOutlets.forEach((o) => {
      if (schedule[o.outletCode]?.day) {
        scheduled++;
      }
    });
    const total = currentSalesOutlets.length;
    const unscheduled = Math.max(0, total - scheduled);
    const pct = total > 0 ? Math.round((scheduled / total) * 100) : 0;
    return { total, scheduled, unscheduled, pct };
  }, [currentSalesOutlets, schedule]);

  // WhatsApp Call Sheet Text
  const currentSalesName = selectedSales === "all" ? "Semua Tim Sales" : (salesOptions.find((s) => s.code === selectedSales)?.name || selectedSales);
  const waText = useMemo(() => {
    if (!isOpen) return "";
    return buildDailyCallSheetWhatsApp({
      day: exportDay,
      salesName: currentSalesName,
      depotName,
      outlets: currentSalesOutlets,
      schedule,
    });
  }, [isOpen, exportDay, currentSalesName, depotName, currentSalesOutlets, schedule]);

  if (!isOpen) return null;

  const showToast = (type, text) => {
    setNotification({ type, text });
    setTimeout(() => {
      setNotification((prev) => (prev?.text === text ? null : prev));
    }, 4000);
  };

  // Simpan perubahan ke storage
  const handleSaveSchedule = (newSchedule) => {
    setIsSaving(true);
    const mapToSave = newSchedule || schedule;
    try {
      saveStoredSchedule(depotName, mapToSave);
      setSchedule(mapToSave);
      if (onScheduleSaved) onScheduleSaved();
      showToast("success", "Jadwal kunjungan berhasil disimpan!");
    } catch (err) {
      showToast("error", `Gagal menyimpan jadwal: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  // 1. Terapkan hari ke seluruh toko di satu kode alamat
  const handleApplyAreaDay = (areaCode, targetDay) => {
    if (!targetDay) return;
    const targetOutlets = currentSalesOutlets.filter(
      (o) => parseOutletCode(o.outletCode).areaCode === areaCode
    );

    if (targetOutlets.length === 0) return;

    const next = { ...schedule };
    targetOutlets.forEach((o) => {
      next[o.outletCode] = {
        day: targetDay,
        areaCode,
        updatedAt: new Date().toISOString(),
      };
    });

    handleSaveSchedule(next);
    showToast(
      "success",
      `Berhasil menjadwalkan ${targetOutlets.length} outlet wilayah "${areaCode}" ke hari ${DAY_LABELS[targetDay]}.`
    );
  };

  // 2. Rekomendasi otomatis berdasarkan hari transaksi dominan toko
  const handleAutoScheduleFromHistory = () => {
    let appliedCount = 0;
    const next = { ...schedule };

    currentSalesOutlets.forEach((o) => {
      const pref = preferredDays[o.outletCode];
      if (pref && pref.topDay) {
        const parsed = parseOutletCode(o.outletCode);
        next[o.outletCode] = {
          day: pref.topDay,
          areaCode: parsed.areaCode,
          updatedAt: new Date().toISOString(),
        };
        appliedCount++;
      }
    });

    if (appliedCount === 0) {
      showToast("error", "Tidak ada riwayat transaksi yang cukup untuk menyarankan hari pembelian otomatis.");
      return;
    }

    handleSaveSchedule(next);
    showToast(
      "success",
      `Berhasil menjadwalkan ${appliedCount} outlet secara otomatis berdasarkan kebiasaan hari order historis!`
    );
  };

  // 3. Reset jadwal sales saat ini (via ConfirmDialog)
  const handleResetSalesSchedule = () => {
    setResetConfirm(false);
    const next = { ...schedule };
    currentSalesOutlets.forEach((o) => {
      delete next[o.outletCode];
    });
    handleSaveSchedule(next);
    showToast("success", "Jadwal kunjungan sales ini telah di-reset.");
  };

  // 4. Ubah hari satu toko
  const handleSetSingleDay = (outletCode, targetDay) => {
    const next = { ...schedule };
    if (!targetDay || targetDay === "none") {
      delete next[outletCode];
    } else {
      const parsed = parseOutletCode(outletCode);
      next[outletCode] = {
        day: targetDay,
        areaCode: parsed.areaCode,
        updatedAt: new Date().toISOString(),
      };
    }
    handleSaveSchedule(next);
  };

  // 5. Download Master Jadwal Excel
  const handleDownloadExcel = () => {
    try {
      const filename = exportScheduleExcel(schedule, outlets, depotName, coords);
      showToast("success", `File ${filename} berhasil diunduh.`);
    } catch (err) {
      showToast("error", `Gagal mengunduh Excel: ${err.message}`);
    }
  };

  // 6. Upload Master Jadwal Excel
  const handleUploadExcel = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      showToast("info", "Memproses file Excel jadwal...");
      const result = await parseScheduleExcel(file);
      const merged = { ...schedule, ...result.scheduleMap };
      handleSaveSchedule(merged);
      showToast(
        "success",
        `Berhasil mengimpor ${result.successCount} jadwal outlet! (${result.skippedCount} baris dilewati)`
      );
    } catch (err) {
      showToast("error", `Gagal mengimpor file: ${err.message}`);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // 7. Copy WhatsApp Call Sheet
  const handleCopyWhatsApp = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedWA(true);
      setTimeout(() => setCopiedWA(false), 2000);
      showToast("success", "Teks jadwal WhatsApp berhasil disalin ke clipboard!");
    } catch (err) {
      console.warn("Clipboard error:", err);
      showToast("error", "Gagal menyalin teks.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-3 sm-fadein">
      <div
        className="sm-card sm-modal-glass sm-scale-in w-full max-w-5xl max-h-[92vh] flex flex-col rounded-2xl overflow-hidden shadow-2xl"
        style={{
          background: isLight ? "#FFFFFF" : "#0F172A",
          border: `1px solid ${colors.glassBorder}`,
        }}
      >
        {/* HEADER MODAL */}
        <div
          className="p-4 sm:p-5 flex items-center justify-between gap-3 shrink-0"
          style={{ borderBottom: `1px solid ${colors.glassBorder}` }}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="p-2.5 rounded-xl shrink-0"
              style={{ background: colors.violet + "20", color: colors.violet }}
            >
              <CalendarDays size={20} />
            </div>
            <div className="min-w-0">
              <div className="disp text-base sm:text-lg font-bold truncate" style={{ color: colors.text }}>
                Rencana Jadwal Kunjungan Harian (Beat Plan)
              </div>
              <div className="text-xs truncate" style={{ color: colors.textMuted }}>
                Atur hari kunjungan outlet (Senin – Sabtu) per sales berdasarkan Kode Alamat & Pola Transaksi
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-full hover:opacity-75 transition-opacity shrink-0"
            style={{ background: colors.glassFill, color: colors.text }}
            title="Tutup (Esc)"
          >
            <X size={18} />
          </button>
        </div>

        {/* SUB-BAR: PEMILIHAN SALES & STATS */}
        <div
          className="px-4 py-3 sm:px-5 flex flex-wrap items-center justify-between gap-3 shrink-0"
          style={{ background: colors.glassSubtle, borderBottom: `1px solid ${colors.glassBorder}` }}
        >
          <div className="flex items-center gap-2 flex-wrap">
            <label className="text-xs font-semibold" style={{ color: colors.textMuted }}>
              Pilih Sales:
            </label>
            <CustomSelect
              value={selectedSales}
              onChange={setSelectedSales}
              icon={Users}
              colors={colors}
              size="sm"
              searchable={true}
              searchPlaceholder="Cari nama sales..."
              menuWidth={280}
              options={[
                { value: "all", label: "Semua Sales", badge: `${outlets.length} Toko` },
                ...salesOptions.map((s) => ({
                  value: s.name,
                  label: s.name,
                  badge: `${s.count} Toko`,
                })),
              ]}
            />
          </div>

          {/* Badges Progress */}
          <div className="flex items-center gap-2 text-xs flex-wrap">
            <span
              className="px-2.5 py-1 rounded-lg font-semibold flex items-center gap-1.5"
              style={{ background: colors.mint + "18", color: colors.mint }}
            >
              <CheckCircle2 size={13} /> {stats.scheduled} / {stats.total} Terjadwal ({stats.pct}%)
            </span>
            {stats.unscheduled > 0 && (
              <span
                className="px-2.5 py-1 rounded-lg font-semibold flex items-center gap-1.5"
                style={{ background: colors.coral + "18", color: colors.coral }}
              >
                <AlertCircle size={13} /> {stats.unscheduled} Belum Terjadwal
              </span>
            )}
          </div>
        </div>

        {/* TAB SWITCHER */}
        <div
          className="flex items-center px-4 sm:px-5 gap-2 shrink-0 overflow-x-auto"
          style={{ borderBottom: `1px solid ${colors.glassBorder}` }}
        >
          {[
            { key: "quick", label: "⚡ Buat Cepat (Kode Alamat)", icon: Layers },
            { key: "kanban", label: "📋 Papan Mingguan (Kanban)", icon: CalendarDays },
            { key: "export", label: "📲 Ekspor & WhatsApp Call Sheet", icon: Send },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`py-3 px-3.5 text-xs sm:text-sm font-semibold inline-flex items-center gap-2 border-b-2 transition-all whitespace-nowrap ${
                  active ? "border-blue-500 text-blue-500" : "border-transparent opacity-75 hover:opacity-100"
                }`}
                style={!active ? { color: colors.textMuted } : {}}
              >
                <Icon size={15} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* NOTIFICATION TOAST */}
        {notification && (
          <div
            className="mx-4 mt-3 sm:mx-5 p-2.5 rounded-xl text-xs flex items-center justify-between sm-fadein shrink-0"
            style={{
              background: notification.type === "success" ? colors.mint + "20" : colors.coral + "20",
              color: notification.type === "success" ? colors.mint : colors.coral,
              border: `1px solid ${notification.type === "success" ? colors.mint + "44" : colors.coral + "44"}`,
            }}
          >
            <span>{notification.text}</span>
            <button onClick={() => setNotification(null)} className="ml-2 opacity-75 hover:opacity-100">
              <X size={14} />
            </button>
          </div>
        )}

        {/* TAB CONTENTS */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5">
          {/* =========================================================================
              TAB 1: BUAT CEPAT (AUTO-MAPPING VIA KODE ALAMAT)
              ========================================================================= */}
          {activeTab === "quick" && (
            <div className="flex flex-col gap-4">
              <div
                className="p-3.5 rounded-xl flex items-start gap-3"
                style={{
                  background: colors.blue + "12",
                  border: `1px solid ${colors.blue + "33"}`,
                }}
              >
                <Sparkles size={18} style={{ color: colors.blue, flexShrink: 0, marginTop: 2 }} />
                <div className="text-xs leading-relaxed" style={{ color: colors.text }}>
                  <b>Jalan Pintas Cepat:</b> Format kode outlet Anda adalah{" "}
                  <code className="px-1.5 py-0.5 rounded bg-blue-500/10 font-bold">[Inisial]-[KODE ALAMAT]-[No Urut]</code>{" "}
                  (contoh: <b>A-AKL-0001</b>). Sistem telah mengelompokkan toko-toko berdasarkan wilayah alamatnya. Anda
                  hanya perlu menentukan hari untuk setiap kode wilayah di bawah ini, lalu klik tombol{" "}
                  <b>Terapkan</b>.
                </div>
              </div>

              {/* Tabel Pemetaan Kode Alamat */}
              <div
                className="rounded-xl overflow-hidden border"
                style={{ borderColor: colors.glassBorder, background: colors.glassFill }}
              >
                <div
                  className="p-3 font-bold text-xs uppercase tracking-wider flex items-center justify-between"
                  style={{
                    background: colors.glassFill,
                    borderBottom: `1px solid ${colors.glassBorder}`,
                    color: colors.textMuted,
                  }}
                >
                  <span>Daftar Wilayah (Kode Alamat) — {areaGroups.length} Wilayah Terdeteksi</span>
                  <span>Total {currentSalesOutlets.length} Toko</span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead>
                      <tr
                        style={{
                          background: colors.glassSubtle,
                          borderBottom: `1px solid ${colors.glassBorder}`,
                          color: colors.textMuted,
                        }}
                      >
                        <th className="p-3 font-semibold">Kode Wilayah</th>
                        <th className="p-3 font-semibold">Jumlah Toko</th>
                        <th className="p-3 font-semibold">Total Nilai Jual</th>
                        <th className="p-3 font-semibold">Hari Dominan Order</th>
                        <th className="p-3 font-semibold">Pilih Hari Kunjungan</th>
                        <th className="p-3 font-semibold text-center">Aksi Cepat</th>
                      </tr>
                    </thead>
                    <tbody>
                      {areaGroups.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="p-8 text-center text-xs" style={{ color: colors.textMuted }}>
                            Tidak ada data toko untuk sales ini.
                          </td>
                        </tr>
                      ) : (
                        areaGroups.map((g) => {
                          const sampleScheduledDay = schedule[g.outlets[0]?.outletCode]?.day;
                          return (
                            <tr
                              key={g.areaCode}
                              className="border-b transition-colors hover:bg-white/5"
                              style={{ borderColor: colors.glassBorder }}
                            >
                              <td className="p-3 font-bold">
                                <span
                                  className="px-2 py-0.5 rounded-md font-mono text-xs"
                                  style={{
                                    background: colors.blue + "22",
                                    color: colors.blue,
                                    border: `1px solid ${colors.blue}44`,
                                  }}
                                >
                                  {g.areaCode}
                                </span>
                                <div className="text-[11px] font-normal truncate mt-0.5" style={{ color: colors.textMuted }}>
                                  Contoh: {g.sampleName}
                                </div>
                              </td>

                              <td className="p-3 font-semibold" style={{ color: colors.text }}>
                                {g.totalOutlets} Toko
                              </td>

                              <td className="p-3 font-mono" style={{ color: colors.text }}>
                                {fmtRp(g.totalValue)}
                              </td>

                              <td className="p-3">
                                {g.dominantDay ? (
                                  <span
                                    className="inline-flex items-center gap-1 font-semibold px-2 py-0.5 rounded-md text-[11px]"
                                    style={{
                                      background: DAY_COLORS[g.dominantDay]?.lightBg || colors.glassFill,
                                      color: DAY_COLORS[g.dominantDay]?.lightText || colors.text,
                                    }}
                                  >
                                    {DAY_LABELS[g.dominantDay]} ({g.dominantPct}%)
                                  </span>
                                ) : (
                                  <span style={{ color: colors.textMuted }}>-</span>
                                )}
                              </td>

                              <td className="p-3">
                                <CustomSelect
                                  value={areaDays[g.areaCode] || sampleScheduledDay || g.dominantDay || "senin"}
                                  onChange={(val) => setAreaDays((prev) => ({ ...prev, [g.areaCode]: val }))}
                                  options={DAYS_OF_WEEK.map((d) => ({
                                    value: d,
                                    label: DAY_LABELS[d],
                                  }))}
                                  colors={colors}
                                  size="xs"
                                  searchable={false}
                                  menuWidth={130}
                                />
                              </td>

                              <td className="p-3 text-center">
                                <button
                                  onClick={() => {
                                    const chosenDay = areaDays[g.areaCode] || sampleScheduledDay || g.dominantDay || "senin";
                                    handleApplyAreaDay(g.areaCode, chosenDay);
                                  }}
                                  className="px-3 py-1.5 rounded-lg font-semibold text-xs text-white bg-blue-600 hover:bg-blue-500 transition-all inline-flex items-center gap-1.5 shadow-sm"
                                >
                                  <Check size={13} /> Terapkan ({g.totalOutlets})
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Action Bar Bawah */}
              <div
                className="p-4 rounded-xl flex flex-wrap items-center justify-between gap-3"
                style={{ background: colors.glassFill, border: `1px solid ${colors.glassBorder}` }}
              >
                <div className="text-xs" style={{ color: colors.textMuted }}>
                  Ingin mengisi toko yang belum terjadwal secara otomatis?
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    onClick={handleAutoScheduleFromHistory}
                    className="px-3 py-2 rounded-xl text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 transition-all inline-flex items-center gap-1.5 shadow-sm"
                  >
                    <Sparkles size={14} /> Jadwalkan Otomatis dari Hari Order Favorit
                  </button>

                  <button
                    onClick={() => setResetConfirm(true)}
                    className="px-3 py-2 rounded-xl text-xs font-semibold text-rose-500 hover:bg-rose-500/10 transition-all inline-flex items-center gap-1.5"
                  >
                    <RotateCcw size={14} /> Reset Jadwal Sales Ini
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* =========================================================================
              TAB 2: PAPAN MINGGUAN (KANBAN BOARD SENIN - SABTU)
              ========================================================================= */}
          {activeTab === "kanban" && (
            <div className="flex flex-col gap-4">
              {/* Search filter in Kanban */}
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="relative flex-1 min-w-[200px] max-w-sm">
                  <Search
                    size={14}
                    className="absolute left-3 top-1/2 -translate-y-1/2"
                    style={{ color: colors.textMuted }}
                  />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Cari toko atau kode wilayah..."
                    className="w-full pl-8 pr-3 py-1.5 rounded-xl text-xs"
                    style={{
                      background: colors.glassFill,
                      border: `1px solid ${colors.glassBorder}`,
                      color: colors.text,
                    }}
                  />
                </div>

                <div className="text-xs font-medium" style={{ color: colors.textMuted }}>
                  Total {currentSalesOutlets.length} outlet
                </div>
              </div>

              {/* 6 Kolom Hari + 1 Kolom Belum Terjadwal */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
                {DAYS_OF_WEEK.map((dayKey) => {
                  const dayOutlets = currentSalesOutlets.filter((o) => {
                    if (schedule[o.outletCode]?.day !== dayKey) return false;
                    if (!search.trim()) return true;
                    const q = search.toLowerCase();
                    return (
                      (o.outletName && o.outletName.toLowerCase().includes(q)) ||
                      (o.outletCode && o.outletCode.toLowerCase().includes(q))
                    );
                  });

                  const dayValue = dayOutlets.reduce((sum, o) => sum + (o.value || 0), 0);
                  const colorConf = DAY_COLORS[dayKey];
                  const isDense = dayOutlets.length > 30;

                  return (
                    <div
                      key={dayKey}
                      className="rounded-xl flex flex-col max-h-[62vh] border overflow-hidden"
                      style={{
                        background: colors.glassFill,
                        borderColor: colors.glassBorder,
                      }}
                    >
                      {/* Column Header */}
                      <div
                        className="p-3 border-b flex flex-col gap-1 shrink-0"
                        style={{
                          borderColor: colors.glassBorder,
                          background: colorConf.lightBg,
                        }}
                      >
                        <div className="flex items-center justify-between">
                          <span
                            className="font-bold text-xs uppercase px-2 py-0.5 rounded text-white"
                            style={{ background: colorConf.badge }}
                          >
                            {DAY_LABELS[dayKey]}
                          </span>
                          <span
                            className="text-xs font-bold"
                            style={{ color: colorConf.lightText }}
                          >
                            {dayOutlets.length} Toko
                          </span>
                        </div>
                        <div
                          className="flex items-center justify-between text-[11px] font-medium"
                          style={{ color: colorConf.lightText }}
                        >
                          <span>{fmtRp(dayValue)}</span>
                          {isDense && (
                            <span className="text-[10px] font-bold text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded">
                              Padat
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Store Card List */}
                      <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-2">
                        {dayOutlets.length === 0 ? (
                          <div
                            className="p-6 text-center text-xs border border-dashed rounded-lg opacity-60"
                            style={{ borderColor: colors.glassBorder, color: colors.textMuted }}
                          >
                            Tidak ada toko
                          </div>
                        ) : (
                          dayOutlets.map((o) => {
                            const parsed = parseOutletCode(o.outletCode);
                            return (
                              <div
                                key={o.outletCode}
                                className="p-2.5 rounded-lg border flex flex-col gap-1.5 shadow-sm transition-all hover:scale-[1.01]"
                                style={{
                                  background: isLight ? "#FFFFFF" : "rgba(255,255,255,0.04)",
                                  borderColor: colors.glassBorder,
                                }}
                              >
                                <div className="flex items-start justify-between gap-1.5">
                                  <div className="font-bold text-xs line-clamp-1" style={{ color: colors.text }}>
                                    {o.outletName}
                                  </div>
                                  <span
                                    className="px-1.5 py-0.2 text-[10px] font-mono rounded font-bold shrink-0"
                                    style={{
                                      background: colors.blue + "18",
                                      color: colors.blue,
                                    }}
                                  >
                                    {parsed.areaCode}
                                  </span>
                                </div>

                                <div className="flex items-center justify-between text-[11px]" style={{ color: colors.textMuted }}>
                                  <span className="font-mono truncate">{o.outletCode}</span>
                                  <span className="font-mono font-semibold" style={{ color: colors.text }}>
                                    {fmtRp(o.value)}
                                  </span>
                                </div>

                                {/* Quick Reassign Select */}
                                <div className="pt-1 flex items-center justify-between border-t" style={{ borderColor: colors.glassBorder }}>
                                  <span className="text-[10px]" style={{ color: colors.textMuted }}>Pindah:</span>
                                  <CustomSelect
                                    value={dayKey}
                                    onChange={(newDay) => handleSetSingleDay(o.outletCode, newDay)}
                                    options={[
                                      ...DAYS_OF_WEEK.map((d) => ({
                                        value: d,
                                        label: DAY_LABELS[d],
                                      })),
                                      { value: "none", label: "Lepas Jadwal" },
                                    ]}
                                    colors={colors}
                                    size="xs"
                                    searchable={false}
                                    menuWidth={130}
                                    align="right"
                                  />
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Toko Belum Terjadwal Drawer / Box */}
              {stats.unscheduled > 0 && (
                <div
                  className="p-4 rounded-xl border flex flex-col gap-2 mt-2"
                  style={{
                    background: colors.coral + "0A",
                    borderColor: colors.coral + "33",
                  }}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold flex items-center gap-1.5" style={{ color: colors.coral }}>
                      <AlertCircle size={14} /> Toko Belum Terjadwal ({stats.unscheduled} Toko)
                    </span>
                    <span className="text-xs" style={{ color: colors.textMuted }}>
                      Silakan tetapkan hari melalui tab "Buat Cepat" atau pilih hari di bawah ini.
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 max-h-48 overflow-y-auto pt-1">
                    {currentSalesOutlets
                      .filter((o) => !schedule[o.outletCode]?.day)
                      .map((o) => {
                        const parsed = parseOutletCode(o.outletCode);
                        return (
                          <div
                            key={o.outletCode}
                            className="p-2 rounded-lg border flex items-center justify-between text-xs"
                            style={{
                              background: isLight ? "#FFFFFF" : colors.glassFill,
                              borderColor: colors.glassBorder,
                            }}
                          >
                            <div className="min-w-0 pr-2">
                              <div className="font-semibold truncate" style={{ color: colors.text }}>
                                {o.outletName}
                              </div>
                              <div className="text-[10px] font-mono text-blue-500 font-bold">
                                {parsed.areaCode} · {o.outletCode}
                              </div>
                            </div>

                            <CustomSelect
                              value=""
                              onChange={(newDay) => {
                                if (newDay) handleSetSingleDay(o.outletCode, newDay);
                              }}
                              placeholder="+ Set Hari"
                              options={DAYS_OF_WEEK.map((d) => ({
                                value: d,
                                label: DAY_LABELS[d],
                              }))}
                              colors={colors}
                              size="xs"
                              searchable={false}
                              menuWidth={120}
                              align="right"
                            />
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* =========================================================================
              TAB 3: EKSPOR & CALL SHEET WHATSAPP
              ========================================================================= */}
          {activeTab === "export" && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
              {/* Kolom Kiri: WhatsApp Call Sheet Generator */}
              <div className="lg:col-span-7 flex flex-col gap-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5" style={{ color: colors.textMuted }}>
                    <Send size={14} className="text-emerald-500" />
                    Kirim Call Sheet WhatsApp ke Sales
                  </div>

                  {/* Pilih Hari */}
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs" style={{ color: colors.textMuted }}>Hari:</span>
                    <div className="flex items-center rounded-lg border overflow-hidden" style={{ borderColor: colors.glassBorder }}>
                      {DAYS_OF_WEEK.map((d) => (
                        <button
                          key={d}
                          onClick={() => setExportDay(d)}
                          className={`px-2 py-1 text-xs font-semibold transition-all ${
                            exportDay === d ? "bg-emerald-600 text-white" : "opacity-75 hover:opacity-100"
                          }`}
                          style={exportDay !== d ? { background: colors.glassFill, color: colors.text } : {}}
                        >
                          {DAY_LABELS[d].slice(0, 3)}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Pratinjau WhatsApp Bubble */}
                <div
                  className="rounded-xl p-4 font-mono text-xs max-h-[46vh] overflow-y-auto whitespace-pre-wrap select-text border shadow-inner"
                  style={{
                    background: isLight ? "#EFEAE2" : "#0C1317",
                    borderColor: isLight ? "#D1D7DB" : "#2A3942",
                    color: isLight ? "#111B21" : "#E9EDEF",
                  }}
                >
                  <div
                    className="p-3 rounded-xl shadow-sm border-l-4 border-emerald-500"
                    style={{ background: isLight ? "#FFFFFF" : "#1F2C34" }}
                  >
                    {waText}
                  </div>
                </div>

                {/* Tombol Aksi WhatsApp */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleCopyWhatsApp(waText)}
                    className="flex-1 py-2 rounded-xl text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 transition-all inline-flex items-center justify-center gap-1.5 shadow-sm"
                  >
                    {copiedWA ? <Check size={14} /> : <Copy size={14} />}
                    {copiedWA ? "Tersalin ke Clipboard!" : "Salin Teks WhatsApp"}
                  </button>

                  <a
                    href={`https://api.whatsapp.com/send?text=${encodeURIComponent(waText)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 transition-all inline-flex items-center gap-1.5 shadow-sm"
                  >
                    <ArrowRight size={14} /> Buka WhatsApp
                  </a>
                </div>
              </div>

              {/* Kolom Kanan: Master Jadwal Excel */}
              <div className="lg:col-span-5 flex flex-col gap-4">
                <div className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5" style={{ color: colors.textMuted }}>
                  <Download size={14} className="text-blue-500" />
                  Master Jadwal Excel
                </div>

                {/* Card 1: Unduh Excel */}
                <div
                  className="p-4 rounded-xl border flex flex-col gap-2.5"
                  style={{ background: colors.glassFill, borderColor: colors.glassBorder }}
                >
                  <div className="font-bold text-xs" style={{ color: colors.text }}>
                    Unduh Master Jadwal (.xlsx)
                  </div>
                  <div className="text-xs leading-relaxed" style={{ color: colors.textMuted }}>
                    Unduh seluruh jadwal outlet ke dalam file Excel yang mencakup kolom kode outlet, nama toko, kode
                    wilayah, nama sales, hari kunjungan resmi, dan koordinat.
                  </div>
                  <button
                    onClick={handleDownloadExcel}
                    className="py-2 px-3 rounded-lg text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 transition-all inline-flex items-center justify-center gap-2 shadow-sm"
                  >
                    <Download size={14} /> Unduh File Excel Jadwal
                  </button>
                </div>

                {/* Card 2: Unggah Excel */}
                <div
                  className="p-4 rounded-xl border flex flex-col gap-2.5"
                  style={{ background: colors.glassFill, borderColor: colors.glassBorder }}
                >
                  <div className="font-bold text-xs" style={{ color: colors.text }}>
                    Unggah File Excel Jadwal
                  </div>
                  <div className="text-xs leading-relaxed" style={{ color: colors.textMuted }}>
                    Jika Anda mengedit jadwal secara massal di luar aplikasi melalui Excel, Anda dapat mengunggahnya
                    kembali ke sini untuk memperbarui jadwal secara instan.
                  </div>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onChange={handleUploadExcel}
                    className="hidden"
                  />

                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="py-2 px-3 rounded-lg text-xs font-semibold border transition-all inline-flex items-center justify-center gap-2 hover:bg-white/5"
                    style={{
                      borderColor: colors.glassBorder,
                      color: colors.text,
                    }}
                  >
                    <Upload size={14} /> Pilih & Unggah File Excel
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* FOOTER MODAL */}
        <div
          className="p-4 sm:px-5 flex items-center justify-between gap-3 border-t shrink-0"
          style={{ borderColor: colors.glassBorder, background: colors.glassSubtle }}
        >
          <div className="text-xs font-medium" style={{ color: colors.textMuted }}>
            Depo: <b>{depotName || "SEMUA DEPO"}</b> · Tersimpan di database lokal browser
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold border transition-all hover:bg-white/5"
              style={{ borderColor: colors.glassBorder, color: colors.text }}
            >
              Tutup
            </button>

            <button
              onClick={() => handleSaveSchedule(schedule)}
              disabled={isSaving}
              className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 transition-all inline-flex items-center gap-2 shadow-sm disabled:opacity-50"
            >
              {isSaving ? "Menyimpan..." : "Simpan Jadwal"}
            </button>
          </div>
        </div>
      </div>

      <ConfirmDialog
        isOpen={resetConfirm}
        onCancel={() => setResetConfirm(false)}
        onConfirm={handleResetSalesSchedule}
        title="Reset jadwal sales ini?"
        subtitle={`${currentSalesName}: ${currentSalesOutlets.length} outlet dihapus dari jadwal. Data transaksi tidak ikut terhapus.`}
        confirmLabel="Reset"
        variant="danger"
        colors={colors}
      />
    </div>
  );
}
