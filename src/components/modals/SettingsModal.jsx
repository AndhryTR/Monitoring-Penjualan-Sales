import { useState, useEffect, useRef, useMemo } from "react";
import { Settings, X, Plus, Download, Upload, Zap, Package, AlertTriangle, CheckCircle2, FileText, Monitor, Play } from "lucide-react";
import { SectionTitle, CustomSlider } from "../ui/index.jsx";
import { useScrollLock, useEscapeKey } from "../../hooks/useModalA11y.js";
import { TargetSalesEditor } from "./TargetSalesEditor.jsx";
import { fmtRp, fmtNum } from "../../utils/formatters.js";

/* ============================================================================
   SETTINGS MODAL — REDESIGN (Sprint 7)
   ⚠️ Sebelumnya 606 baris dengan tab "Target Sales" yang berantakan (nested
   accordion 3-level, font text-[10px], cramped). Sekarang:

   Improvements:
   - Tab "Target Sales" pakai TargetSalesEditor (master-detail split layout)
   - Tab "Backup & Data" dipisah jadi tab sendiri dengan visual yang jelas
   - Modal diperbesar (max-w-4xl) untuk akomodasi split panel
   - Font lebih besar (text-sm bukan text-[10px])
   - ChangesPreview: highlight field yang berubah sebelum Simpan
   - State lokal tetap pola lama (sync dari props saat isOpen)
============================================================================ */
export function SettingsModal({ isOpen, onClose, targets, setTargets, workDays, setWorkDays, depotName, setDepotName, onClearAll, colors,
  theme, setTheme, powerSaveMode, setPowerSaveMode, filters, setFilters, projectionMethod, setProjectionMethod, history, onImportHistory,
  slideshowConfig, setSlideshowConfig, onStartSlideshow }) {
  const [localTargets, setLocalTargets] = useState(targets);
  const [localWorkDays, setLocalWorkDays] = useState(workDays);
  const [localDepotName, setLocalDepotName] = useState(depotName);
  const [importError, setImportError] = useState("");
  const fileInputRef = useRef(null);
  const [activeSection, setActiveSection] = useState("general");
  // ⚠️ Sprint 7 / D3: track apakah user klik "Review Perubahan" — untuk show
  // ChangesPreview panel. Bila false, tombol Simpan langsung commit (fast path).
  const [showChangesPreview, setShowChangesPreview] = useState(false);

  // ⚠️ Sprint 14 / H18 (bug "modal reset tiap 3 detik"): effect SEBELUMNYA dépend
  // pada [isOpen, targets, workDays, depotName]. Setiap auto-sync mengubah
  // referensi objek props (nilai identik, cuma objek baru dari parse JSON
  // cloud), effect re-run → setActiveSection("general") + setLocalTargets(...)
  // → tab paksa balik ke "Umum" dan edit yang belum disimpan ditimpa cloud.
  // Fix: init local state HANYA saat modal dibuka (transisi isOpen false→true),
  // jangan depend pada props — nilai local bertahan selama modal terbuka.
  const isOpenRef = useRef(isOpen);
  useEffect(() => {
    if (isOpen && !isOpenRef.current) {
      setLocalTargets(targets);
      setLocalWorkDays(workDays);
      setLocalDepotName(depotName);
      setActiveSection("general");
      setShowChangesPreview(false);
    }
    isOpenRef.current = isOpen;
    // isOpenRef di-update di body — eslint-disable untuk exhaustive-deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  useScrollLock(isOpen);
  useEscapeKey(isOpen, onClose);

  // ---- Compute changes (untuk preview sebelum simpan) ----
  // ⚠️ Sprint 7 / D3: bandingkan localTargets dengan targets (props original)
  // untuk detect apa yang berubah. Dipakai untuk ChangesPreview panel.
  // ⚠️ Aturan Hooks: useMemo HARUS dipanggil SEBELUM conditional return.
  // ⚠️ Sprint 14 / H19 (bug "ubah fokus saja tidak terdeteksi"): perbandingan
  // group/fokus SEBELUMNYA pakai `length` (jumlah item) — user yang cuma
  // toggle fokus grup existing, ubah keyword/name/target fokus, atau ubah
  // value/ao/name grup TANPA menambah/menghapus item → diff = 0 → "Tidak ada
  // perubahan" → tombol "Konfirmasi & Simpan" disabled. Fix: bandingkan ISI
  // tiap elemen (element-wise key), bukan panjangnya.
  const groupsKey = (g) => JSON.stringify([g.name ?? "", g.value ?? 0, g.ao ?? 0, g.focus ?? false]);
  const focusKey = (f) => JSON.stringify([f.name ?? "", f.target ?? 0, f.keyword ?? "", f.unit ?? "", f.matchType ?? "contains"]);
  const changes = useMemo(() => {
    if (!isOpen || !showChangesPreview) return null;
    const changedSales = [];
    let totalValueDiff = 0;
    let totalAoDiff = 0;
    let groupsAdded = 0;
    let groupsRemoved = 0;
    let focusAdded = 0;
    let focusRemoved = 0;

    localTargets.forEach((localT) => {
      const origT = targets.find((t) => t.code === localT.code);
      if (!origT) {
        // Sales baru
        changedSales.push({ code: localT.code, name: localT.name, type: "added" });
        return;
      }
      const valueDiff = (localT.total.value || 0) - (origT.total.value || 0);
      const aoDiff = (localT.total.ao || 0) - (origT.total.ao || 0);
      // H19: diff per-elemen — item yang key-nya berubah dihitung sebagai
      // ditambah/dihapus. `.length` tidak cukup (lihat komentar di atas).
      const origGroupKeys = new Set(origT.groups.map(groupsKey));
      const localGroupKeys = new Set(localT.groups.map(groupsKey));
      let gAdd = 0; let gRem = 0;
      localT.groups.forEach((g) => { if (!origGroupKeys.has(groupsKey(g))) gAdd++; });
      origT.groups.forEach((g) => { if (!localGroupKeys.has(groupsKey(g))) gRem++; });
      const origFocusKeys = new Set(origT.focus.map(focusKey));
      const localFocusKeys = new Set(localT.focus.map(focusKey));
      let fAdd = 0; let fRem = 0;
      localT.focus.forEach((f) => { if (!origFocusKeys.has(focusKey(f))) fAdd++; });
      origT.focus.forEach((f) => { if (!localFocusKeys.has(focusKey(f))) fRem++; });

      if (valueDiff !== 0 || aoDiff !== 0 || gAdd > 0 || gRem > 0 || fAdd > 0 || fRem > 0) {
        changedSales.push({
          code: localT.code, name: localT.name, type: "modified",
          valueDiff, aoDiff, groupsDiff: gAdd - gRem, focusDiff: fAdd - fRem,
        });
        totalValueDiff += valueDiff;
        totalAoDiff += aoDiff;
        groupsAdded += gAdd;
        groupsRemoved += gRem;
        focusAdded += fAdd;
        focusRemoved += fRem;
      }
    });

    // Sales yang dihapus (ada di original tapi tidak di local)
    targets.forEach((origT) => {
      if (!localTargets.find((t) => t.code === origT.code)) {
        changedSales.push({ code: origT.code, name: origT.name, type: "removed" });
      }
    });

    return {
      changedSales,
      totalValueDiff,
      totalAoDiff,
      groupsAdded,
      groupsRemoved,
      focusAdded,
      focusRemoved,
      hasChanges: changedSales.length > 0 || localWorkDays !== workDays || localDepotName !== depotName,
    };
  }, [isOpen, showChangesPreview, localTargets, targets, localWorkDays, workDays, localDepotName, depotName]);

  // Aturan Hooks: early return SETELAH semua hooks (useMemo di atas) dipanggil.
  if (!isOpen) return null;

  const handleSave = () => {
    setTargets(localTargets);
    setWorkDays(localWorkDays);
    setDepotName(localDepotName);
    onClose();
  };

  // ⚠️ Sprint 7 / D3: tombol Simpan sekarang punya 2 mode:
  // - Bila ada perubahan & belum preview → tampilkan ChangesPreview dulu
  // - Bila sudah preview atau tidak ada perubahan → langsung simpan
  const handleSaveClick = () => {
    if (!showChangesPreview) {
      setShowChangesPreview(true);
      return;
    }
    handleSave();
  };

  const handleExportBackup = async () => {
    const { buildBackupPayload, downloadBackupFile } = await import("../../utils/backupExport.js");
    const payload = buildBackupPayload({
      theme, filters, workDays: localWorkDays, targets: localTargets, depotName: localDepotName,
      projectionMethod, history,
    });
    downloadBackupFile(payload);
  };

  const handleImportFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setImportError("");
    try {
      const { parseBackupFile } = await import("../../utils/backupExport.js");
      const parsed = await parseBackupFile(file);
      const s = parsed.settings || {};
      const historyCount = (parsed.history || []).length;
      const ok = window.confirm(
        `Impor akan MENGGANTI Target, Hari Kerja, Nama Depo, Tema, Filter & Metode Proyeksi dengan isi file ini, dan MENGGABUNGKAN ${historyCount} riwayat snapshot dari file ke riwayat yang sudah ada di device ini. Lanjutkan?`
      );
      if (!ok) return;
      if (s.targets) setLocalTargets(s.targets);
      if (s.workDays != null) setLocalWorkDays(s.workDays);
      if (s.depotName != null) setLocalDepotName(s.depotName);
      if (s.theme) setTheme?.(s.theme);
      if (s.filters) setFilters?.(s.filters);
      if (s.projectionMethod) setProjectionMethod?.(s.projectionMethod);
      if (parsed.history?.length) onImportHistory?.(parsed.history);
      window.alert("Impor berhasil diterapkan.");
    } catch (err) {
      setImportError(err.message || "Gagal mengimpor file.");
    }
  };

  // Label tombol simpan dinamis: "Simpan Perubahan" → "Konfirmasi & Simpan"
  const saveButtonLabel = showChangesPreview ? "Konfirmasi & Simpan" : "Simpan Perubahan";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm sm-fadein p-4">
      <div className="sm-card sm-modal-glass sm-scale-in w-full max-w-4xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-5 flex items-center justify-between shrink-0" style={{ borderBottom: `1px solid ${colors.glassBorder}` }}>
          <SectionTitle title="Pengaturan" icon={Settings} colors={colors} />
          <button onClick={onClose} className="sm-btn p-2 rounded-full" style={{ background: colors.glassFill }}><X size={16} /></button>
        </div>

        {/* Tab bar */}
        <div className="px-5 pt-3 pb-0 flex gap-1.5 shrink-0" style={{ borderBottom: `1px solid ${colors.glassBorder}` }}>
          {[
            { key: "general", label: "Umum", icon: Settings },
            { key: "sales", label: "Target Sales", icon: Package },
            { key: "backup", label: "Backup & Data", icon: Download },
            { key: "slideshow", label: "Slideshow", icon: Monitor },
          ].map((t) => {
            const Icon = t.icon;
            const on = activeSection === t.key;
            return (
              <button key={t.key} onClick={() => { setActiveSection(t.key); setShowChangesPreview(false); }}
                className="sm-tab-btn px-3 py-2 rounded-lg text-sm font-semibold inline-flex items-center gap-1.5"
                style={{ background: on ? colors.glassFillStrong : "transparent", color: on ? colors.mint : colors.textMuted }}>
                <Icon size={14} /> {t.label}
              </button>
            );
          })}
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto flex-1">
          {/* ---- Tab: Umum ---- */}
          {activeSection === "general" && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Hari Kerja Efektif</label>
                  <CustomSlider value={localWorkDays} onChange={setLocalWorkDays} colors={colors} />
                  <p className="text-xs mt-2" style={{ color: colors.textMuted }}>
                    Jumlah hari kerja dalam 1 bulan — dipakai untuk proyeksi linear & perhitungan pace.
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Nama Depo / Cabang</label>
                  <input type="text" value={localDepotName} onChange={(e) => setLocalDepotName(e.target.value)}
                    placeholder="DEPO LOTIM"
                    className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                    style={{ background: colors.glassFill, border: `1px solid ${colors.glassBorder}`, color: colors.text }} />
                  <p className="text-xs mt-2" style={{ color: colors.textMuted }}>
                    Muncul sebagai judul di hasil export Excel/PDF.
                  </p>
                </div>
              </div>

              <div className="sm-card p-4 flex items-center justify-between gap-4" style={{ borderLeft: `3px solid ${powerSaveMode ? colors.mint : colors.glassBorder}` }}>
                <div className="flex items-start gap-3 min-w-0">
                  <div className="p-2 rounded-xl shrink-0" style={{ background: (powerSaveMode ? colors.mint : colors.textMuted) + "1A" }}>
                    <Zap size={16} style={{ color: powerSaveMode ? colors.mint : colors.textMuted }} />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold">Mode Hemat Daya</div>
                    <p className="text-xs mt-0.5" style={{ color: colors.textMuted }}>
                      Untuk perangkat yang terasa lambat. Mematikan animasi background & efek kaca (blur) —
                      tampilan jadi lebih flat, tapi jauh lebih ringan.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setPowerSaveMode?.((v) => !v)}
                  className="sm-btn shrink-0 relative w-12 h-7 rounded-full transition-colors"
                  style={{ background: powerSaveMode ? colors.mint + "55" : colors.glassBorder }}
                  aria-pressed={powerSaveMode}
                  aria-label="Toggle Mode Hemat Daya"
                >
                  <span
                    className="absolute top-1 rounded-full transition-transform"
                    style={{ width: 20, height: 20, background: powerSaveMode ? colors.mint : colors.textMuted, left: 4, transform: powerSaveMode ? "translateX(20px)" : "translateX(0)" }}
                  />
                </button>
              </div>
            </div>
          )}

          {/* ---- Tab: Target Sales (pakai TargetSalesEditor) ---- */}
          {activeSection === "sales" && (
            <TargetSalesEditor
              localTargets={localTargets}
              setLocalTargets={setLocalTargets}
              colors={colors}
              depotName={localDepotName}
            />
          )}

          {/* ---- Tab: Backup & Data ---- */}
          {activeSection === "backup" && (
            <div className="space-y-4">
              {/* Backup section */}
              <div className="p-4 rounded-lg" style={{ background: colors.mint + "0D", border: `1px solid ${colors.mint}33` }}>
                <div className="flex items-start gap-3 mb-3">
                  <div className="p-2 rounded-xl shrink-0" style={{ background: colors.mint + "1A" }}>
                    <FileText size={16} style={{ color: colors.mint }} />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold" style={{ color: colors.mint }}>Backup & Restore</h3>
                    <p className="text-xs mt-1" style={{ color: colors.textMuted }}>
                      Export Target, Hari Kerja, Nama Depo, Tema, Filter, Metode Proyeksi, dan Riwayat Snapshot
                      jadi 1 file JSON — untuk backup atau pindah ke device/browser lain. Tidak termasuk data
                      transaksi mentah.
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button onClick={handleExportBackup}
                    className="sm-btn inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold"
                    style={{ background: colors.mint + "1A", color: colors.mint, border: `1px solid ${colors.mint}4D` }}>
                    <Download size={14} /> Export ke File
                  </button>
                  <button onClick={() => fileInputRef.current?.click()}
                    className="sm-btn inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold"
                    style={{ background: colors.glassFill, color: colors.text, border: `1px solid ${colors.glassBorder}` }}>
                    <Upload size={14} /> Import dari File
                  </button>
                  <input ref={fileInputRef} type="file" accept="application/json,.json" onChange={handleImportFile} className="hidden" />
                </div>
                {importError && <p className="text-xs mt-2" style={{ color: colors.coral }}>{importError}</p>}
              </div>

              {/* Danger zone */}
              <div className="p-4 rounded-lg" style={{ background: colors.coral + "0D", border: `1px solid ${colors.coral}33` }}>
                <div className="flex items-start gap-3 mb-3">
                  <div className="p-2 rounded-xl shrink-0" style={{ background: colors.coral + "1A" }}>
                    <AlertTriangle size={16} style={{ color: colors.coral }} />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold" style={{ color: colors.coral }}>Zona Berbahaya</h3>
                    <p className="text-xs mt-1" style={{ color: colors.textMuted }}>
                      Menghapus semua target, hari kerja, nama depo, tema, dan data upload yang tersimpan otomatis
                      di perangkat ini. Tindakan ini tidak bisa dibatalkan.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    if (window.confirm("Yakin ingin menghapus semua data & pengaturan tersimpan di perangkat ini? Tindakan ini tidak bisa dibatalkan.")) {
                      onClearAll?.();
                      onClose();
                    }
                  }}
                  className="sm-btn px-3 py-2 rounded-lg text-sm font-semibold"
                  style={{ background: colors.coral + "1A", color: colors.coral, border: `1px solid ${colors.coral}4D` }}
                >
                  Hapus Semua Data Tersimpan
                </button>
              </div>
            </div>
          )}

          {/* ---- Tab: Slideshow ---- */}
          {activeSection === "slideshow" && slideshowConfig && setSlideshowConfig && (
            <div className="space-y-6">
              {/* Durasi & Sinkronisasi */}
              <div className="sm-card p-4">
                <div className="text-xs uppercase tracking-wider font-semibold mb-3" style={{ color: colors.textMuted }}>Durasi & Sinkronisasi</div>
                <div className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-sm font-medium">Durasi per Halaman</label>
                      <span className="mono text-sm font-bold" style={{ color: colors.gold }}>{slideshowConfig.tabDuration}s</span>
                    </div>
                    <input type="range" min={10} max={120} step={5} value={slideshowConfig.tabDuration}
                      onChange={(e) => setSlideshowConfig({ ...slideshowConfig, tabDuration: Number(e.target.value) })}
                      className="w-full accent-[--sm-gold]" style={{ accentColor: colors.gold }} />
                    <div className="flex justify-between text-xs mt-1" style={{ color: colors.textMuted }}>
                      <span>10s</span><span>120s</span>
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-sm font-medium">Auto-Sync Data</label>
                      <span className="mono text-sm font-bold" style={{ color: colors.mint }}>{slideshowConfig.syncInterval}m</span>
                    </div>
                    <input type="range" min={1} max={30} step={1} value={slideshowConfig.syncInterval}
                      onChange={(e) => setSlideshowConfig({ ...slideshowConfig, syncInterval: Number(e.target.value) })}
                      className="w-full" style={{ accentColor: colors.mint }} />
                    <div className="flex justify-between text-xs mt-1" style={{ color: colors.textMuted }}>
                      <span>1m</span><span>30m</span>
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-sm font-medium">Jeda Awal (baca header)</label>
                      <span className="mono text-sm font-bold" style={{ color: colors.blue }}>{slideshowConfig.scrollDelay}s</span>
                    </div>
                    <input type="range" min={0} max={10} step={1} value={slideshowConfig.scrollDelay}
                      onChange={(e) => setSlideshowConfig({ ...slideshowConfig, scrollDelay: Number(e.target.value) })}
                      className="w-full" style={{ accentColor: colors.blue }} />
                    <div className="flex justify-between text-xs mt-1" style={{ color: colors.textMuted }}>
                      <span>0s</span><span>10s</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Pilih Halaman */}
              <div className="sm-card p-4">
                <div className="text-xs uppercase tracking-wider font-semibold mb-3" style={{ color: colors.textMuted }}>Pilih Halaman Slideshow</div>
                <div className="space-y-2">
                  {[
                    { key: "executive", label: "Executive Summary", desc: "Snapshot KPI + Leaderboard + Focus + Outlet Health" },
                    { key: "main", label: "Main Report", desc: "PaceStrip + 6 KPI cards + 2 charts" },
                    { key: "sales", label: "Sales Report", desc: "Leaderboard + bar chart per sales" },
                    { key: "product", label: "Product Report", desc: "Bar chart per grup produk" },
                    { key: "focus", label: "Product Focus", desc: "Kartu progress per sales×produk" },
                    { key: "outlet", label: "Analisis Outlet", desc: "KPI + pie chart distribusi outlet" },
                    { key: "trend", label: "Tren Periode", desc: "Chart + matrix tabel" },
                    { key: "compare", label: "Perbandingan", desc: "Matrix + bar chart" },
                  ].map((tab) => {
                    const isEnabled = slideshowConfig.enabledTabs.includes(tab.key);
                    return (
                      <label key={tab.key} className="flex items-start gap-3 p-2.5 rounded-lg cursor-pointer"
                        style={{ background: isEnabled ? colors.mint + "0D" : colors.glassFill }}>
                        <input type="checkbox" checked={isEnabled}
                          onChange={(e) => {
                            const next = e.target.checked
                              ? [...slideshowConfig.enabledTabs, tab.key]
                              : slideshowConfig.enabledTabs.filter((t) => t !== tab.key);
                            setSlideshowConfig({ ...slideshowConfig, enabledTabs: next });
                          }}
                          className="mt-0.5 w-4 h-4" style={{ accentColor: colors.mint }} />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium">{tab.label}</div>
                          <div className="text-xs mt-0.5" style={{ color: colors.textMuted }}>{tab.desc}</div>
                        </div>
                      </label>
                    );
                  })}
                </div>
                {slideshowConfig.enabledTabs.length < 2 && (
                  <p className="text-xs mt-2" style={{ color: colors.coral }}>⚠️ Minimal 2 halaman harus aktif untuk mulai slideshow</p>
                )}
              </div>

              {/* Tampilan */}
              <div className="sm-card p-4">
                <div className="text-xs uppercase tracking-wider font-semibold mb-3" style={{ color: colors.textMuted }}>Tampilan</div>
                <div className="space-y-2">
                  {[
                    { key: "autoScroll", label: "Auto-scroll halus", desc: "rAF realtime scroll dari atas ke bawah" },
                    { key: "hideAlerts", label: "Sembunyikan alert", desc: "InsightBanner di-hide saat slideshow" },
                    { key: "hideTables", label: "Sembunyikan tabel", desc: "DataTable di-hide saat slideshow" },
                    { key: "largeFont", label: "Font diperbesar", desc: "1.15× ukuran font normal" },
                    { key: "forceDark", label: "Dark mode paksa", desc: "Selalu dark theme saat slideshow aktif" },
                  ].map((opt) => (
                    <label key={opt.key} className="flex items-center gap-3 p-2 rounded-lg cursor-pointer" style={{ background: colors.glassFill }}>
                      <input type="checkbox" checked={slideshowConfig[opt.key]}
                        onChange={(e) => setSlideshowConfig({ ...slideshowConfig, [opt.key]: e.target.checked })}
                        className="w-4 h-4" style={{ accentColor: colors.gold }} />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium">{opt.label}</div>
                        <div className="text-xs" style={{ color: colors.textMuted }}>{opt.desc}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Preview & Mulai */}
              <div className="sm-card p-4" style={{ borderLeft: `3px solid ${colors.mint}` }}>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <div className="text-sm font-semibold disp">Preview</div>
                    <div className="text-xs mt-0.5" style={{ color: colors.textMuted }}>
                      Urutan: {slideshowConfig.enabledTabs.join(" → ")} → (ulang)
                    </div>
                    <div className="text-xs mt-0.5" style={{ color: colors.textMuted }}>
                      Total 1 siklus: ~{Math.ceil(slideshowConfig.enabledTabs.length * slideshowConfig.tabDuration / 60)} menit
                    </div>
                  </div>
                </div>
                <button onClick={() => { onClose(); onStartSlideshow?.(); }}
                  className="sm-btn w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold"
                  style={{ background: colors.mint, color: "#0A1120" }}
                  disabled={slideshowConfig.enabledTabs.length < 2}>
                  <Play size={14} /> Mulai Slideshow Sekarang
                </button>
              </div>
            </div>
          )}

          {/* ---- ChangesPreview panel (overlay saat user klik Simpan) ---- */}
          {showChangesPreview && changes && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
              <div className="sm-card w-full max-w-lg max-h-[80vh] overflow-y-auto p-5" style={{ background: colors.modalBg }}>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-base font-semibold disp">Review Perubahan</h3>
                  <button onClick={() => setShowChangesPreview(false)} className="sm-btn p-2 rounded-full" style={{ background: colors.glassFill }}>
                    <X size={16} />
                  </button>
                </div>

                {changes.hasChanges ? (
                  <>
                    {/* Summary cards */}
                    <div className="grid grid-cols-2 gap-3 mb-4">
                      <div className="p-3 rounded-lg" style={{ background: colors.glassFill }}>
                        <div className="text-xs" style={{ color: colors.textMuted }}>Total Perubahan Value</div>
                        <div className="mono text-sm font-bold" style={{ color: changes.totalValueDiff > 0 ? colors.mint : changes.totalValueDiff < 0 ? colors.coral : colors.text }}>
                          {changes.totalValueDiff > 0 ? "+" : ""}{fmtRp(changes.totalValueDiff)}
                        </div>
                      </div>
                      <div className="p-3 rounded-lg" style={{ background: colors.glassFill }}>
                        <div className="text-xs" style={{ color: colors.textMuted }}>Total Perubahan AO</div>
                        <div className="mono text-sm font-bold" style={{ color: changes.totalAoDiff > 0 ? colors.mint : changes.totalAoDiff < 0 ? colors.coral : colors.text }}>
                          {changes.totalAoDiff > 0 ? "+" : ""}{fmtNum(changes.totalAoDiff)}
                        </div>
                      </div>
                    </div>

                    {/* Detail per sales */}
                    <div className="space-y-2 mb-4">
                      <div className="text-xs uppercase tracking-wider font-semibold" style={{ color: colors.textMuted }}>
                        {changes.changedSales.length} Sales Berubah
                      </div>
                      {changes.changedSales.map((c) => (
                        <div key={c.code} className="flex items-center justify-between p-2 rounded-lg" style={{ background: colors.glassFill }}>
                          <div className="flex items-center gap-2 min-w-0">
                            {c.type === "added" && <Plus size={12} style={{ color: colors.mint }} />}
                            {c.type === "removed" && <X size={12} style={{ color: colors.coral }} />}
                            {c.type === "modified" && <CheckCircle2 size={12} style={{ color: colors.gold }} />}
                            <span className="text-sm truncate">{c.name}</span>
                          </div>
                          {c.type === "modified" && (
                            <div className="flex items-center gap-2 text-xs mono shrink-0">
                              {c.valueDiff !== 0 && (
                                <span style={{ color: c.valueDiff > 0 ? colors.mint : colors.coral }}>
                                  {c.valueDiff > 0 ? "+" : ""}{fmtRp(c.valueDiff)}
                                </span>
                              )}
                              {c.groupsDiff !== 0 && (
                                <span style={{ color: colors.textMuted }}>
                                  {c.groupsDiff > 0 ? "+" : ""}{c.groupsDiff} grup
                                </span>
                              )}
                              {c.focusDiff !== 0 && (
                                <span style={{ color: colors.textMuted }}>
                                  {c.focusDiff > 0 ? "+" : ""}{c.focusDiff} fokus
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>

                    {localWorkDays !== workDays && (
                      <div className="text-xs mb-2" style={{ color: colors.textMuted }}>
                        • Hari kerja: {workDays} → <b>{localWorkDays}</b>
                      </div>
                    )}
                    {localDepotName !== depotName && (
                      <div className="text-xs mb-2" style={{ color: colors.textMuted }}>
                        • Nama depo: "{depotName}" → <b>"{localDepotName}"</b>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-center py-8">
                    <CheckCircle2 size={32} className="mx-auto mb-3" style={{ color: colors.mint }} />
                    <p className="text-sm" style={{ color: colors.text }}>Tidak ada perubahan sejak modal dibuka.</p>
                  </div>
                )}

                <div className="flex justify-end gap-2 mt-4 pt-4" style={{ borderTop: `1px solid ${colors.glassBorder}` }}>
                  <button onClick={() => setShowChangesPreview(false)} className="sm-btn px-4 py-2 rounded-lg text-sm font-semibold" style={{ border: `1px solid ${colors.glassBorder}` }}>
                    Kembali Edit
                  </button>
                  <button onClick={handleSave} disabled={!changes.hasChanges}
                    className="sm-btn px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-40"
                    style={{ background: colors.gold, color: "#0A1120" }}>
                    Konfirmasi & Simpan
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 mt-auto flex justify-end gap-3 shrink-0" style={{ background: colors.glassFill, borderTop: `1px solid ${colors.glassBorder}` }}>
          <button onClick={onClose} className="sm-btn px-4 py-2 rounded-lg text-sm font-semibold" style={{ border: `1px solid ${colors.glassBorder}` }}>
            Batal
          </button>
          <button onClick={handleSaveClick} className="sm-btn px-4 py-2 rounded-lg text-sm font-semibold" style={{ background: colors.gold, color: "#0A1120" }}>
            {saveButtonLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
