import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Plus, Trash2, Building2, Check, AlertTriangle } from "lucide-react";
import { useScrollLock, useEscapeKey } from "../../hooks/useModalA11y.js";
import { CustomSelect } from "../ui/CustomSelect.jsx";

/* ============================================================================
   DEPOT SWITCHER — Sprint 18 / Multi-Depo
   Dropdown di header sidebar untuk ganti depo aktif. Buka dialog tambah depo
   baru bila user klik "Tambah Depo Baru". Confirm dengan ketik nama bila user
   hapus depo.

   Props:
   - depots: Depot[]
   - activeDepotId: string
   - onSelect: (depotId) => void
   - onAddDepot: (name, code, template, sourceDepot?) => Depot  → return new depot
   - onDeleteDepot: (depotId) => void
   - colors

   ⚠️ Compact mode (collapsed=true di sidebar): render hanya ikon + nama depo
   singkat. Expanded mode: render ikon + nama lengkap + dropdown chevron.
============================================================================ */

export function DepotSwitcher({ depots, activeDepotId, onSelect, onAddDepot, onDeleteDepot, colors, compact = false }) {
  const [isOpen, setIsOpen] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null); // depot object being confirmed for delete
  const dropdownRef = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isOpen]);

  useEscapeKey(isOpen || showAddDialog || deleteTarget, () => {
    setIsOpen(false);
    setShowAddDialog(false);
    setDeleteTarget(null);
  });

  const activeDepot = depots.find((d) => d.id === activeDepotId) || depots[0];

  const handleSelect = (depotId) => {
    onSelect(depotId);
    setIsOpen(false);
  };

  const handleAddClick = () => {
    setIsOpen(false);
    setShowAddDialog(true);
  };

  const handleDeleteClick = (e, depot) => {
    e.stopPropagation();
    setDeleteTarget(depot);
    setIsOpen(false);
  };

  const handleConfirmDelete = () => {
    if (deleteTarget) {
      onDeleteDepot(deleteTarget.id);
    }
    setDeleteTarget(null);
  };

  if (!activeDepot) return null;

  return (
    <>
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setIsOpen((v) => !v)}
          className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-left transition-colors"
          style={{
            background: isOpen ? colors.glassFillStrong : colors.glassFill,
            border: `1px solid ${colors.glassBorder}`,
          }}
          title={compact ? activeDepot.name : undefined}
        >
          <Building2 size={16} className="shrink-0" style={{ color: colors.gold }} />
          {!compact && (
            <div className="flex-1 min-w-0">
              <div className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: colors.textMuted }}>
                Depo Aktif
              </div>
              <div className="text-sm font-bold truncate disp" style={{ color: colors.text }}>
                {activeDepot.name}
              </div>
            </div>
          )}
          {compact && (
            <div className="flex-1 min-w-0">
              <div className="text-xs font-bold truncate" style={{ color: colors.text }}>
                {activeDepot.code}
              </div>
            </div>
          )}
          <ChevronDown
            size={14}
            className="shrink-0 transition-transform"
            style={{ color: colors.textMuted, transform: isOpen ? "rotate(180deg)" : "none" }}
          />
        </button>

        {isOpen && (
          <div
            className="absolute top-full left-0 right-0 mt-1.5 rounded-lg overflow-hidden z-50 sm-sidebar-glass"
            style={{
              background: colors.modalPanelBg || colors.glassFillStrong,
              border: `1px solid ${colors.glassBorder}`,
              boxShadow: "0 8px 24px rgba(0,0,0,0.24)",
            }}
          >
            <div className="max-h-72 overflow-y-auto">
              {depots.map((depot) => {
                const isActive = depot.id === activeDepot.id;
                return (
                  <div
                    key={depot.id}
                    onClick={() => handleSelect(depot.id)}
                    className="flex items-center gap-2 px-3 py-2.5 cursor-pointer transition-colors"
                    style={{
                      background: isActive ? colors.mint + "14" : "transparent",
                      borderBottom: `1px solid ${colors.glassBorder}`,
                    }}
                  >
                    <Building2 size={14} className="shrink-0" style={{ color: isActive ? colors.mint : colors.textMuted }} />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate" style={{ color: isActive ? colors.mint : colors.text }}>
                        {depot.name}
                      </div>
                      <div className="text-xs mono" style={{ color: colors.textMuted }}>
                        {depot.code} · {depot.targets.length} sales
                      </div>
                    </div>
                    {isActive && <Check size={14} className="shrink-0" style={{ color: colors.mint }} />}
                    {!isActive && depots.length > 1 && (
                      <button
                        onClick={(e) => handleDeleteClick(e, depot)}
                        className="p-1 rounded shrink-0 hover:opacity-100 opacity-40 transition-opacity"
                        style={{ color: colors.coral }}
                        title="Hapus depo"
                        aria-label={`Hapus depo ${depot.name}`}
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
            <button
              onClick={handleAddClick}
              className="w-full flex items-center gap-2 px-3 py-2.5 text-sm font-semibold transition-colors"
              style={{
                background: colors.mint + "0D",
                color: colors.mint,
                borderTop: `1px solid ${colors.glassBorder}`,
              }}
            >
              <Plus size={14} /> Tambah Depo Baru
            </button>
          </div>
        )}
      </div>

      {/* ⚠️ Sprint 18d14 / Modal fix: AddDepotDialog & DeleteDepotConfirm dirender
          via createPortal ke document.body supaya muncul di TENGAH layar seperti
          modal lainnya. Sebelumnya dirender sebagai child DepotSwitcher yang ada
          di dalam sidebar — sidebar punya overflow:hidden + stacking context,
          jadi modal terpotong dan tampil di sidebar, bukan tengah layar. */}
      {showAddDialog && createPortal(
        <AddDepotDialog
          depots={depots}
          colors={colors}
          onClose={() => setShowAddDialog(false)}
          onAdd={(name, code, template, sourceDepotId) => {
            const sourceDepot = sourceDepotId ? depots.find((d) => d.id === sourceDepotId) : null;
            onAddDepot(name, code, template, sourceDepot);
            setShowAddDialog(false);
          }}
        />,
        document.body
      )}

      {deleteTarget && createPortal(
        <DeleteDepotConfirm
          depot={deleteTarget}
          colors={colors}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={handleConfirmDelete}
        />,
        document.body
      )}
    </>
  );
}

/* ============================================================================
   ADD DEPO DIALOG — pilih template Blank / Standard / Duplicate
============================================================================ */
function AddDepotDialog({ depots, colors, onClose, onAdd }) {
  useScrollLock(true);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [template, setTemplate] = useState("blank");
  const [sourceDepotId, setSourceDepotId] = useState(depots[0]?.id || "");

  // Auto-generate code dari name bila code masih kosong / user belum edit manual
  const [codeEdited, setCodeEdited] = useState(false);
  const handleNameChange = (v) => {
    setName(v);
    if (!codeEdited) {
      setCode(v.toUpperCase().replace(/[^A-Z0-9]+/g, "").slice(0, 6));
    }
  };

  const handleSubmit = () => {
    if (!name.trim() || !code.trim()) return;
    onAdd(name.trim(), code.trim(), template, template === "duplicate" ? sourceDepotId : null);
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.6)" }}>
      <div
        className="w-full max-w-md rounded-2xl overflow-hidden"
        style={{ background: colors.modalPanelBg || colors.glassFillStrong, border: `1px solid ${colors.glassBorder}` }}
      >
        <div className="p-5" style={{ borderBottom: `1px solid ${colors.glassBorder}` }}>
          <div className="text-lg font-bold disp" style={{ color: colors.text }}>Tambah Depo Baru</div>
          <p className="text-xs mt-1" style={{ color: colors.textMuted }}>
            Depo akan otomatis menjadi depo aktif setelah dibuat.
          </p>
        </div>

        <div className="p-5 space-y-4">
          {/* Nama depo */}
          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: colors.textMuted }}>
              Nama Depo <span style={{ color: colors.coral }}>*</span>
            </label>
            <input
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="DEPO MATARAM"
              autoFocus
              className="w-full px-3 py-2 rounded-lg text-sm outline-none"
              style={{ background: colors.glassSubtle, border: `1px solid ${colors.glassBorder}`, color: colors.text }}
            />
          </div>

          {/* Kode depo */}
          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: colors.textMuted }}>
              Kode Depo <span style={{ color: colors.coral }}>*</span>
            </label>
            <input
              value={code}
              onChange={(e) => {
                setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]+/g, "").slice(0, 6));
                setCodeEdited(true);
              }}
              placeholder="MATARAM"
              className="w-full px-3 py-2 rounded-lg text-sm outline-none mono"
              style={{ background: colors.glassSubtle, border: `1px solid ${colors.glassBorder}`, color: colors.text }}
            />
            <p className="text-xs mt-1" style={{ color: colors.textMuted }}>
              Maks 6 huruf, otomatis dari nama depo.
            </p>
          </div>

          {/* Template pilihan */}
          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: colors.textMuted }}>Template</label>
            <div className="space-y-1.5">
              <TemplateOption
                value="blank" currentValue={template} onSelect={setTemplate}
                colors={colors}
                title="Kosong"
                desc="0 sales, 0 grup — setup dari nol via UI atau Excel import"
              />
              <TemplateOption
                value="standard" currentValue={template} onSelect={setTemplate}
                colors={colors}
                title="Standar"
                desc="5 grup produk placeholder (BERAT, RINGAN, MINUMAN, KECAP, SAMBAL) — 0 sales"
              />
              {depots.length > 0 && (
                <TemplateOption
                  value="duplicate" currentValue={template} onSelect={setTemplate}
                  colors={colors}
                  title="Duplikat dari depo lain"
                  desc="Salin struktur sales+grup+fokus dari depo yang dipilih"
                />
              )}
            </div>
          </div>

          {/* Source depot picker (only visible when duplicate) */}
          {template === "duplicate" && depots.length > 0 && (
            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: colors.textMuted }}>
                Salin dari Depo
              </label>
              <CustomSelect
                value={sourceDepotId}
                onChange={setSourceDepotId}
                icon={Building2}
                fullWidth={true}
                size="md"
                colors={colors}
                options={depots.map((d) => ({
                  value: d.id,
                  label: d.name,
                  badge: d.code,
                }))}
              />
            </div>
          )}
        </div>

        <div className="p-5 flex gap-2" style={{ borderTop: `1px solid ${colors.glassBorder}` }}>
          <button
            onClick={onClose}
            className="flex-1 sm-btn px-4 py-2 rounded-lg text-sm font-semibold"
            style={{ background: colors.glassFill, color: colors.text, border: `1px solid ${colors.glassBorder}` }}
          >
            Batal
          </button>
          <button
            onClick={handleSubmit}
            disabled={!name.trim() || !code.trim()}
            className="flex-1 px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background: colors.mint, color: "#0A1120" }}
          >
            Buat Depo
          </button>
        </div>
      </div>
    </div>
  );
}

function TemplateOption({ value, currentValue, onSelect, colors, title, desc }) {
  const isSel = value === currentValue;
  return (
    <button
      onClick={() => onSelect(value)}
      className="w-full text-left p-3 rounded-lg transition-colors"
      style={{
        background: isSel ? colors.mint + "0D" : colors.glassSubtle,
        border: `1px solid ${isSel ? colors.mint : colors.glassBorder}`,
      }}
    >
      <div className="flex items-center gap-2">
        <div
          className="w-3.5 h-3.5 rounded-full shrink-0 border-2 flex items-center justify-center"
          style={{ borderColor: isSel ? colors.mint : colors.glassBorder }}
        >
          {isSel && <div className="w-1.5 h-1.5 rounded-full" style={{ background: colors.mint }} />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium" style={{ color: isSel ? colors.mint : colors.text }}>{title}</div>
          <div className="text-xs" style={{ color: colors.textMuted }}>{desc}</div>
        </div>
      </div>
    </button>
  );
}

/* ============================================================================
   DELETE DEPO CONFIRM — konfirmasi dengan ketik nama
============================================================================ */
function DeleteDepotConfirm({ depot, colors, onCancel, onConfirm }) {
  useScrollLock(true);
  const [typed, setTyped] = useState("");

  const canConfirm = typed.trim().toUpperCase() === depot.name.trim().toUpperCase();

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.6)" }}>
      <div
        className="w-full max-w-md rounded-2xl overflow-hidden"
        style={{ background: colors.modalPanelBg || colors.glassFillStrong, border: `1px solid ${colors.coral}` }}
      >
        <div className="p-5" style={{ borderBottom: `1px solid ${colors.glassBorder}` }}>
          <div className="flex items-center gap-2">
            <AlertTriangle size={18} style={{ color: colors.coral }} />
            <div className="text-lg font-bold disp" style={{ color: colors.text }}>Hapus Depo</div>
          </div>
          <p className="text-xs mt-2" style={{ color: colors.textMuted }}>
            Tindakan ini tidak bisa dibatalkan. Semua sales, target, grup, dan fokus di depo ini akan hilang dari perangkat. Transaksi yang sudah diupload TIDAK terhapus (data transaksi disimpan terpisah di IndexedDB).
          </p>
        </div>
        <div className="p-5">
          <p className="text-sm mb-2" style={{ color: colors.text }}>
            Ketik <span className="font-bold mono" style={{ color: colors.coral }}>{depot.name}</span> untuk konfirmasi:
          </p>
          <input
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder={depot.name}
            autoFocus
            className="w-full px-3 py-2 rounded-lg text-sm outline-none mono"
            style={{ background: colors.glassSubtle, border: `1px solid ${colors.glassBorder}`, color: colors.text }}
          />
        </div>
        <div className="p-5 flex gap-2" style={{ borderTop: `1px solid ${colors.glassBorder}` }}>
          <button
            onClick={onCancel}
            className="flex-1 sm-btn px-4 py-2 rounded-lg text-sm font-semibold"
            style={{ background: colors.glassFill, color: colors.text, border: `1px solid ${colors.glassBorder}` }}
          >
            Batal
          </button>
          <button
            onClick={onConfirm}
            disabled={!canConfirm}
            className="flex-1 px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background: colors.coral, color: "#fff" }}
          >
            Hapus Permanen
          </button>
        </div>
      </div>
    </div>
  );
}
