import { useState, useEffect } from "react";
import { UserPlus, AlertCircle } from "lucide-react";
import { Modal } from "../ui/Modal.jsx";

/* ============================================================================
   ADD SALES MODAL — Sprint 18 / Multi-Depo
   Form untuk menambah sales baru ke depo aktif. Hanya field esensial —
   kode, nama, tier, target value, target AO. Grup & fokus bisa di-edit
   nanti lewat TargetSalesEditor setelah sales dibuat.

   Props:
   - isOpen: boolean
   - onClose: () => void
   - onAdd: (sales: Target) => void  → parent akan panggil useSettings.addSales
   - existingCodes: string[]  → daftar kode sales yang sudah ada (untuk validasi duplikat)
   - colors

   Validasi:
   - Kode & nama wajib, tidak boleh duplikat
   - Tier default mint (user bisa pilih)
   - Target value/AO default 0 (boleh 0 — diisi nanti)
============================================================================ */
export function AddSalesModal({ isOpen, onClose, onAdd, existingCodes = [], colors }) {
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [tier, setTier] = useState("mint");
  const [targetValue, setTargetValue] = useState("");
  const [targetAo, setTargetAo] = useState("");
  const [error, setError] = useState("");

  // Reset form saat modal ditutup
  useEffect(() => {
    if (!isOpen) {
      setCode("");
      setName("");
      setTier("mint");
      setTargetValue("");
      setTargetAo("");
      setError("");
    }
  }, [isOpen]);

  const codeUpper = code.toUpperCase().trim();
  const nameTrim = name.trim();
  const isDuplicateCode = existingCodes.includes(codeUpper);
  const canSubmit = codeUpper && nameTrim && !isDuplicateCode;

  const handleSubmit = () => {
    if (!canSubmit) {
      if (!codeUpper) setError("Kode sales wajib diisi");
      else if (isDuplicateCode) setError(`Kode "${codeUpper}" sudah dipakai di depo ini`);
      else if (!nameTrim) setError("Nama sales wajib diisi");
      return;
    }

    const newSales = {
      code: codeUpper,
      name: nameTrim,
      tier: tier,
      total: {
        value: Number(targetValue) || 0,
        ao: Number(targetAo) || 0,
      },
      groups: [],
      focus: [],
    };
    onAdd(newSales);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Tambah Sales Baru"
      subtitle="Sales akan ditambahkan ke depo aktif"
      icon={UserPlus}
      iconColor={colors.mint}
      iconBg={colors.mint + "1A"}
      colors={colors}
      maxWidth="max-w-md"
      contentClassName="space-y-4"
      footer={
        <div className="flex gap-2 w-full">
          <button
            onClick={onClose}
            className="flex-1 sm-btn px-4 py-2 rounded-lg text-sm font-semibold"
            style={{ background: colors.glassFill, color: colors.text, border: `1px solid ${colors.glassBorder}` }}
          >
            Batal
          </button>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="flex-1 px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background: colors.mint, color: "#0A1120" }}
          >
            Simpan Sales Baru
          </button>
        </div>
      }
    >
          {/* Kode Sales */}
          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: colors.textMuted }}>
              Kode Sales <span style={{ color: colors.coral }}>*</span>
            </label>
            <input
              value={code}
              onChange={(e) => {
                setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]+/g, "").slice(0, 6));
                setError("");
              }}
              placeholder="BAR"
              autoFocus
              className="w-full px-3 py-2 rounded-lg text-sm outline-none mono"
              style={{
                background: colors.glassSubtle,
                border: `1px solid ${isDuplicateCode ? colors.coral : colors.glassBorder}`,
                color: colors.text,
              }}
            />
            <p className="text-xs mt-1" style={{ color: isDuplicateCode ? colors.coral : colors.textMuted }}>
              {isDuplicateCode
                ? `Kode "${codeUpper}" sudah dipakai — pilih kode lain`
                : "Maks 6 huruf, otomatis uppercase"}
            </p>
          </div>

          {/* Nama Sales */}
          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: colors.textMuted }}>
              Nama Sales <span style={{ color: colors.coral }}>*</span>
            </label>
            <input
              value={name}
              onChange={(e) => { setName(e.target.value); setError(""); }}
              placeholder="BAMBANG RIYADI"
              className="w-full px-3 py-2 rounded-lg text-sm outline-none"
              style={{ background: colors.glassSubtle, border: `1px solid ${colors.glassBorder}`, color: colors.text }}
            />
          </div>

          {/* Tier */}
          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: colors.textMuted }}>Tier</label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { value: "mint", label: "Mint", color: colors.mint },
                { value: "amber", label: "Amber", color: colors.gold },
                { value: "violet", label: "Violet", color: colors.violet },
              ].map((opt) => {
                const isSel = tier === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setTier(opt.value)}
                    className="px-3 py-2 rounded-lg text-sm font-semibold transition-all"
                    style={{
                      background: isSel ? opt.color + "1A" : colors.glassSubtle,
                      border: `1px solid ${isSel ? opt.color : colors.glassBorder}`,
                      color: isSel ? opt.color : colors.textMuted,
                    }}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Target Value + AO (grid 2-col) */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: colors.textMuted }}>
                Target Value
              </label>
              <input
                type="number"
                value={targetValue}
                onChange={(e) => setTargetValue(e.target.value)}
                placeholder="0"
                min="0"
                className="w-full px-3 py-2 rounded-lg text-sm outline-none mono"
                style={{ background: colors.glassSubtle, border: `1px solid ${colors.glassBorder}`, color: colors.text }}
              />
              <p className="text-xs mt-1" style={{ color: colors.textMuted }}>Rp (boleh 0)</p>
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: colors.textMuted }}>
                Target AO
              </label>
              <input
                type="number"
                value={targetAo}
                onChange={(e) => setTargetAo(e.target.value)}
                placeholder="0"
                min="0"
                className="w-full px-3 py-2 rounded-lg text-sm outline-none mono"
                style={{ background: colors.glassSubtle, border: `1px solid ${colors.glassBorder}`, color: colors.text }}
              />
              <p className="text-xs mt-1" style={{ color: colors.textMuted }}>Integer (boleh 0)</p>
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 p-2.5 rounded-lg text-sm" style={{ background: colors.coral + "1A", color: colors.coral }}>
              <AlertCircle size={14} /> {error}
            </div>
          )}

          <div className="p-3 rounded-lg text-xs" style={{ background: colors.glassSubtle, color: colors.textMuted }}>
            Grup produk & produk fokus bisa diisi nanti lewat editor detail sales, setelah sales ini dibuat.
          </div>
    </Modal>
  );
}
