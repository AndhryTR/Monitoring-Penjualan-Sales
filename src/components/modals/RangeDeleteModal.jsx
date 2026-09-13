import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Modal } from "../ui/Modal.jsx";

/* ============================================================================
   RANGE DELETE MODAL (admin)
   Modal hapus rentang tanggal di master_sales. Destructive — butuh konfirmasi
   tombol dua-tahap (klik "Hapus" → klik "Yakin? Klik lagi").
============================================================================ */
export function RangeDeleteModal({ colors, onClose, onConfirm }) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [alsoLocal, setAlsoLocal] = useState(false);
  const [result, setResult] = useState(null); // { ok, message } | null

  const doDelete = async () => {
    if (!confirm) { setConfirm(true); return; }
    setConfirm(false); setBusy(true); setResult(null);
    const res = await onConfirm(from, to, alsoLocal);
    setBusy(false);
    if (res) setResult({ ok: res.ok, message: res.message });
  };

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title="Hapus Rentang Master"
      colors={colors}
      maxWidth="max-w-sm"
      footer={
        <div className="flex gap-2 w-full">
          <button onClick={onClose} disabled={busy} className="sm-btn flex-1 px-3 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-40" style={{ border: `1px solid ${colors.glassBorder}`, color: colors.textMuted }}>
            {result ? "Selesai" : "Batal"}
          </button>
          <button onClick={doDelete} disabled={busy || !from || !to}
            className="sm-btn flex-1 px-3 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-40"
            style={{ background: confirm ? colors.coral : colors.coral + "1A", color: confirm ? "#fff" : colors.coral, border: `1px solid ${colors.coral}44` }}>
            {busy ? "Menghapus…" : confirm ? "Yakin? Klik lagi" : "Hapus"}
          </button>
        </div>
      }
    >
      <p className="text-xs mb-4" style={{ color: colors.textMuted }}>
        Hapus baris data master pada rentang tanggal ini. Tindakan permanen.
      </p>
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div>
          <label className="block text-xs font-semibold mb-1.5" style={{ color: colors.textMuted }}>Dari</label>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} disabled={busy}
            className="w-full px-3 py-2 rounded-xl text-sm outline-none disabled:opacity-50" style={{ background: colors.glassFill, color: colors.text, border: `1px solid ${colors.glassBorder}` }} />
        </div>
        <div>
          <label className="block text-xs font-semibold mb-1.5" style={{ color: colors.textMuted }}>Sampai</label>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} disabled={busy}
            className="w-full px-3 py-2 rounded-xl text-sm outline-none disabled:opacity-50" style={{ background: colors.glassFill, color: colors.text, border: `1px solid ${colors.glassBorder}` }} />
        </div>
      </div>
      {/* Opsi: hapus juga dari data lokal */}
      <label className="flex items-center gap-2 text-xs mb-4 cursor-pointer" style={{ color: colors.text }}>
        <input type="checkbox" checked={alsoLocal} onChange={(e) => setAlsoLocal(e.target.checked)} disabled={busy}
          className="w-4 h-4 accent-[--sm-mint] disabled:opacity-50" />
        Juga hapus dari data lokal perangkat ini
      </label>
      {/* Feedback hasil hapus — tampil DI DALAM modal sebelum ditutup */}
      {busy && <p className="text-xs mb-3" style={{ color: colors.textMuted }}><Loader2 size={12} className="animate-spin inline mr-1" />Menghapus…</p>}
      {result && (
        <p className="text-xs mb-3 px-3 py-2 rounded-lg" style={{ color: result.ok ? colors.mint : colors.coral, background: (result.ok ? colors.mint : colors.coral) + "14", border: `1px solid ${(result.ok ? colors.mint : colors.coral)}33` }}>
          {result.message}
        </p>
      )}
    </Modal>
  );
}
