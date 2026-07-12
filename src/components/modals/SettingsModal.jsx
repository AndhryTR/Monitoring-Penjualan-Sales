import { useState, useEffect } from "react";
import { Settings, X, Crosshair, ChevronDown, Plus } from "lucide-react";
import { SectionTitle } from "../ui/index.jsx";

/* ============================================================================
   SETTINGS MODAL
   Editor konfigurasi target sales: hari kerja, nama depo, target value & AO
   per sales, dan editor produk fokus (tambah/hapus/salin dari sales lain).
   Juga berisi "Zona Berbahaya" untuk hapus semua data tersimpan.

   State lokal (localTargets, localWorkDays, localDepotName) di-sync dari props
   saat modal dibuka, lalu di-commit ke parent state saat "Simpan Perubahan".
============================================================================ */
export function SettingsModal({ isOpen, onClose, targets, setTargets, workDays, setWorkDays, depotName, setDepotName, onClearAll, colors }) {
  const [localTargets, setLocalTargets] = useState(targets);
  const [localWorkDays, setLocalWorkDays] = useState(workDays);
  const [localDepotName, setLocalDepotName] = useState(depotName);
  const [expandedFocusCodes, setExpandedFocusCodes] = useState(() => new Set());
  const [copySourceCode, setCopySourceCode] = useState({});

  useEffect(() => {
    if (isOpen) {
      setLocalTargets(targets);
      setLocalWorkDays(workDays);
      setLocalDepotName(depotName);
    }
  }, [isOpen, targets, workDays, depotName]);

  if (!isOpen) return null;

  const handleTargetChange = (salesCode, field, value) => {
    setLocalTargets(prev => prev.map(t => {
      if (t.code === salesCode) {
        const newTotal = { ...t.total, [field]: Number(value) || 0 };
        return { ...t, total: newTotal };
      }
      return t;
    }));
  };

  const toggleFocusExpand = (code) => {
    setExpandedFocusCodes(prev => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code); else next.add(code);
      return next;
    });
  };

  const handleFocusChange = (salesCode, focusIdx, field, value) => {
    setLocalTargets(prev => prev.map(t => {
      if (t.code !== salesCode) return t;
      const focus = t.focus.map((f, i) => i === focusIdx ? { ...f, [field]: field === "target" ? (Number(value) || 0) : value } : f);
      return { ...t, focus };
    }));
  };

  const handleFocusAdd = (salesCode) => {
    setLocalTargets(prev => prev.map(t => t.code === salesCode
      ? { ...t, focus: [...t.focus, { name: "", target: 0, keyword: "", unit: "KARTON", matchType: "contains" }] }
      : t));
    setExpandedFocusCodes(prev => new Set(prev).add(salesCode));
  };

  const handleFocusRemove = (salesCode, focusIdx) => {
    setLocalTargets(prev => prev.map(t => t.code === salesCode
      ? { ...t, focus: t.focus.filter((_, i) => i !== focusIdx) }
      : t));
  };

  const handleFocusCopyFrom = (salesCode) => {
    const sourceCode = copySourceCode[salesCode];
    const source = localTargets.find(t => t.code === sourceCode);
    if (!source || !source.focus.length) return;
    if (!window.confirm(`Salin ${source.focus.length} produk fokus dari ${source.name}? Daftar fokus yang sudah ada di sales ini akan diganti.`)) return;
    setLocalTargets(prev => prev.map(t => t.code === salesCode
      ? { ...t, focus: source.focus.map(f => ({ ...f })) }
      : t));
    setExpandedFocusCodes(prev => new Set(prev).add(salesCode));
  };

  const handleSave = () => {
    setTargets(localTargets);
    setWorkDays(localWorkDays);
    setDepotName(localDepotName);
    onClose();
  };

  const MATCH_TYPE_OPTIONS = [
    { value: "contains", label: "Mengandung kata kunci" },
    { value: "group", label: "Sama persis Grup Produk" },
    { value: "exact", label: "Sama persis nama produk" },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm sm-fadein">
      <div className="sm-card sm-scale-in w-full max-w-2xl max-h-[85vh] flex flex-col" style={{ background: colors.surface }}>
        <div className="p-5 flex items-center justify-between" style={{ borderBottom: `1px solid ${colors.border}` }}>
          <SectionTitle title="Pengaturan" icon={Settings} colors={colors} />
          <button onClick={onClose} className="sm-btn p-2 rounded-full" style={{ background: colors.surface2 }}><X size={16} /></button>
        </div>
        <div className="p-5 overflow-y-auto">
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium mb-2">Hari Kerja Efektif</label>
              <input type="number" value={localWorkDays} onChange={e => setLocalWorkDays(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-lg mono" style={{ background: colors.surface2, border: `1px solid ${colors.border}` }} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Nama Depo / Cabang</label>
              <input type="text" value={localDepotName} onChange={e => setLocalDepotName(e.target.value)}
                placeholder="DEPO LOTIM"
                className="w-full px-3 py-2 rounded-lg" style={{ background: colors.surface2, border: `1px solid ${colors.border}` }} />
              <p className="text-xs mt-1" style={{ color: colors.textMuted }}>Muncul sebagai judul di hasil export Excel</p>
            </div>
          </div>
          <h3 className="text-base font-semibold disp mb-3">Target Sales</h3>
          <div className="space-y-3">
            {localTargets.map(t => {
              const isExpanded = expandedFocusCodes.has(t.code);
              const otherSales = localTargets.filter(o => o.code !== t.code && o.focus.length > 0);
              return (
              <div key={t.code} className="p-3 rounded-lg" style={{ background: colors.surface2 }}>
                <p className="font-semibold text-sm mb-2">{t.name}</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs mb-1" style={{ color: colors.textMuted }}>Target Value (Rp)</label>
                    <input type="number" value={t.total.value} onChange={e => handleTargetChange(t.code, 'value', e.target.value)}
                      className="w-full px-3 py-1.5 rounded-md mono text-sm" style={{ background: colors.ink, border: `1px solid ${colors.border}` }} />
                  </div>
                  <div>
                    <label className="block text-xs mb-1" style={{ color: colors.textMuted }}>Target Active Outlet (AO)</label>
                    <input type="number" value={t.total.ao} onChange={e => handleTargetChange(t.code, 'ao', e.target.value)}
                      className="w-full px-3 py-1.5 rounded-md mono text-sm" style={{ background: colors.ink, border: `1px solid ${colors.border}` }} />
                  </div>
                </div>

                <div className="mt-3 pt-3" style={{ borderTop: `1px solid ${colors.border}` }}>
                  <button onClick={() => toggleFocusExpand(t.code)} className="sm-btn w-full flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2 text-sm font-medium">
                      <Crosshair size={14} style={{ color: colors.violet }} />
                      Produk Fokus <span style={{ color: colors.textMuted }}>({t.focus.length})</span>
                    </span>
                    <ChevronDown size={14} style={{ color: colors.textMuted, transform: isExpanded ? "rotate(180deg)" : "none", transition: "transform .2s" }} />
                  </button>

                  {isExpanded && (
                    <div className="mt-3 space-y-2">
                      {otherSales.length > 0 && (
                        <div className="flex items-center gap-2 mb-3">
                          <select value={copySourceCode[t.code] || ""} onChange={e => setCopySourceCode(prev => ({ ...prev, [t.code]: e.target.value }))}
                            className="flex-1 px-2.5 py-1.5 rounded-md text-xs" style={{ background: colors.ink, border: `1px solid ${colors.border}`, color: colors.text }}>
                            <option value="">Salin dari sales lain...</option>
                            {otherSales.map(o => <option key={o.code} value={o.code}>{o.name} ({o.focus.length} produk)</option>)}
                          </select>
                          <button onClick={() => handleFocusCopyFrom(t.code)} disabled={!copySourceCode[t.code]}
                            className="sm-btn px-3 py-1.5 rounded-md text-xs font-semibold disabled:opacity-40"
                            style={{ background: colors.surface, border: `1px solid ${colors.border}` }}>
                            Salin
                          </button>
                        </div>
                      )}

                      {t.focus.length === 0 && (
                        <p className="text-xs text-center py-3" style={{ color: colors.textMuted }}>Belum ada produk fokus untuk sales ini.</p>
                      )}

                      {t.focus.map((f, i) => {
                        const matchType = f.matchType || (f.keyword === "__GROUP__" ? "group" : f.keyword === "GAS_EXACT" ? "exact" : "contains");
                        return (
                          <div key={i} className="p-2.5 rounded-lg relative" style={{ background: colors.ink, border: `1px solid ${colors.border}` }}>
                            <button onClick={() => handleFocusRemove(t.code, i)} title="Hapus produk fokus ini"
                              className="sm-btn absolute top-2 right-2 p-1 rounded-md" style={{ color: colors.coral }}>
                              <X size={12} />
                            </button>
                            <div className="grid grid-cols-2 gap-2 mb-2 pr-6">
                              <div>
                                <label className="block text-[10px] mb-0.5" style={{ color: colors.textMuted }}>Nama Produk</label>
                                <input value={f.name} onChange={e => handleFocusChange(t.code, i, 'name', e.target.value)}
                                  placeholder="mis. FISH CAKE"
                                  className="w-full px-2 py-1.5 rounded text-xs" style={{ background: colors.surface2, border: `1px solid ${colors.border}`, color: colors.text }} />
                              </div>
                              <div>
                                <label className="block text-[10px] mb-0.5" style={{ color: colors.textMuted }}>Tipe Pencocokan</label>
                                <select value={matchType} onChange={e => handleFocusChange(t.code, i, 'matchType', e.target.value)}
                                  className="w-full px-2 py-1.5 rounded text-xs" style={{ background: colors.surface2, border: `1px solid ${colors.border}`, color: colors.text }}>
                                  {MATCH_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                                </select>
                              </div>
                            </div>

                            {matchType === "group" ? (
                              <p className="text-[10px] mb-2" style={{ color: colors.textMuted }}>
                                Akan dicocokkan ke baris dengan Grup Produk = <b>{f.name || "(isi Nama Produk di atas)"}</b>
                              </p>
                            ) : (
                              <div className="mb-2">
                                <label className="block text-[10px] mb-0.5" style={{ color: colors.textMuted }}>
                                  Kata Kunci {matchType === "exact" ? "(harus sama persis dengan nama produk)" : "(dicari di dalam nama produk)"}
                                </label>
                                <input value={f.keyword} onChange={e => handleFocusChange(t.code, i, 'keyword', e.target.value)}
                                  placeholder="mis. FISH"
                                  className="w-full px-2 py-1.5 rounded text-xs mono" style={{ background: colors.surface2, border: `1px solid ${colors.border}`, color: colors.text }} />
                                {!f.keyword && (
                                  <p className="text-[10px] mt-0.5" style={{ color: colors.coral }}>Wajib diisi — kalau kosong, akan cocok ke SEMUA produk.</p>
                                )}
                              </div>
                            )}

                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="block text-[10px] mb-0.5" style={{ color: colors.textMuted }}>Target</label>
                                <input type="number" value={f.target} onChange={e => handleFocusChange(t.code, i, 'target', e.target.value)}
                                  className="w-full px-2 py-1.5 rounded text-xs mono" style={{ background: colors.surface2, border: `1px solid ${colors.border}`, color: colors.text }} />
                              </div>
                              <div>
                                <label className="block text-[10px] mb-0.5" style={{ color: colors.textMuted }}>Satuan</label>
                                <input value={f.unit} onChange={e => handleFocusChange(t.code, i, 'unit', e.target.value)}
                                  placeholder="KARTON"
                                  className="w-full px-2 py-1.5 rounded text-xs" style={{ background: colors.surface2, border: `1px solid ${colors.border}`, color: colors.text }} />
                              </div>
                            </div>
                          </div>
                        );
                      })}

                      <button onClick={() => handleFocusAdd(t.code)}
                        className="sm-btn w-full flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-semibold"
                        style={{ background: colors.violet + "14", color: colors.violet, border: `1px dashed ${colors.violet}66` }}>
                        <Plus size={13} /> Tambah Produk Fokus
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );})}
          </div>

          <div className="mt-8 p-4 rounded-lg" style={{ background: colors.coral + "0D", border: `1px solid ${colors.coral}33` }}>
            <h3 className="text-sm font-semibold mb-1" style={{ color: colors.coral }}>Zona Berbahaya</h3>
            <p className="text-xs mb-3" style={{ color: colors.textMuted }}>
              Menghapus semua target, hari kerja, nama depo, tema, dan data upload yang tersimpan otomatis di perangkat ini. Tidak bisa dibatalkan.
            </p>
            <button
              onClick={() => {
                if (window.confirm("Yakin ingin menghapus semua data & pengaturan tersimpan di perangkat ini? Tindakan ini tidak bisa dibatalkan.")) {
                  onClearAll?.();
                  onClose();
                }
              }}
              className="sm-btn px-3 py-2 rounded-lg text-xs font-semibold"
              style={{ background: colors.coral + "1A", color: colors.coral, border: `1px solid ${colors.coral}4D` }}
            >
              Hapus Semua Data Tersimpan
            </button>
          </div>
        </div>
        <div className="p-4 mt-auto flex justify-end gap-3" style={{ background: colors.surface2, borderTop: `1px solid ${colors.border}` }}>
          <button onClick={onClose} className="sm-btn px-4 py-2 rounded-lg text-sm font-semibold" style={{ border: `1px solid ${colors.border}` }}>Batal</button>
          <button onClick={handleSave} className="sm-btn px-4 py-2 rounded-lg text-sm font-semibold" style={{ background: colors.gold, color: "#0A1120" }}>Simpan Perubahan</button>
        </div>
      </div>
    </div>
  );
}
