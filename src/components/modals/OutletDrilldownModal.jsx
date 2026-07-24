import { useState, useEffect } from "react";
import { Store, X, Search } from "lucide-react";
import sumBy from "lodash/sumBy";
import { fmtRp, fmtNum } from "../../utils/formatters.js";

/* ============================================================================
   OUTLET DRILLDOWN MODAL
   Modal rincian outlet — dipakai dari semua halaman (Main, Sales, Product,
   Product Focus) lewat callback onDrilldown yang sama. Menampilkan daftar
   outlet dengan value, qty, frekuensi transaksi, dan tanggal terakhir.
============================================================================ */
export function OutletDrilldownModal({ isOpen, onClose, title, subtitle, outlets, colors }) {
  const [query, setQuery] = useState("");
  // Reset pencarian setiap kali modal dibuka untuk konteks (sales/grup/fokus) yang baru,
  // supaya query lama dari drilldown sebelumnya tidak nyangkut.
  useEffect(() => { if (isOpen) setQuery(""); }, [isOpen, title]);

  if (!isOpen) return null;

  const filteredOutlets = query.trim()
    ? outlets.filter((o) => String(o.outletName || "").toLowerCase().includes(query.trim().toLowerCase()))
    : outlets;
  const totalValue = sumBy(filteredOutlets, "value");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm sm-fadein">
      <div className="sm-card sm-modal-glass sm-scale-in w-full max-w-2xl max-h-[85vh] flex flex-col">
        <div className="p-5 flex items-center justify-between" style={{ borderBottom: `1px solid ${colors.glassBorder}` }}>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl" style={{ background: colors.violet + "1A" }}><Store size={16} style={{ color: colors.violet }} /></div>
            <div>
              <div className="disp text-base font-semibold">{title}</div>
              {subtitle && <div className="text-xs" style={{ color: colors.textMuted }}>{subtitle}</div>}
            </div>
          </div>
          <button onClick={onClose} className="sm-btn p-2 rounded-full" style={{ background: colors.glassFill }}><X size={16} /></button>
        </div>
        {outlets.length > 0 && (
          <div className="px-5 pt-4">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: colors.textMuted }} />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Cari nama outlet..."
                className="w-full pl-9 pr-8 py-2 rounded-xl text-sm outline-none"
                style={{ background: colors.glassFill, border: `1px solid ${colors.glassBorder}`, color: colors.text }}
              />
              {query && (
                <button onClick={() => setQuery("")} className="absolute right-2.5 top-1/2 -translate-y-1/2" style={{ color: colors.textMuted }}>
                  <X size={14} />
                </button>
              )}
            </div>
          </div>
        )}
        <div className="p-5 overflow-y-auto">
          {outlets.length === 0 ? (
            <div className="text-center py-10" style={{ color: colors.textMuted }}>Tidak ada transaksi outlet untuk kombinasi filter ini.</div>
          ) : filteredOutlets.length === 0 ? (
            <div className="text-center py-10" style={{ color: colors.textMuted }}>Tidak ada outlet yang cocok dengan pencarian "{query}".</div>
          ) : (
            <>
              <div className="text-xs mb-3" style={{ color: colors.textMuted }}>
                {filteredOutlets.length} outlet · total <span className="mono font-semibold" style={{ color: colors.text }}>{fmtRp(totalValue)}</span>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ background: colors.glassFill }}>
                    <th className="px-3 py-2 text-left" style={{ fontSize: 11, color: colors.tableHeader }}>OUTLET</th>
                    <th className="px-3 py-2 text-right" style={{ fontSize: 11, color: colors.tableHeader }}>VALUE</th>
                    <th className="px-3 py-2 text-center" style={{ fontSize: 11, color: colors.tableHeader }}>QTY</th>
                    <th className="px-3 py-2 text-center" style={{ fontSize: 11, color: colors.tableHeader }}>TRANSAKSI</th>
                    <th className="px-3 py-2 text-center" style={{ fontSize: 11, color: colors.tableHeader }}>TERAKHIR</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredOutlets.map((o, i) => (
                    <tr key={i} className="sm-row" style={{ borderTop: `1px solid ${colors.glassBorder}` }}>
                      <td className="px-3 py-2">{o.outletName}</td>
                      <td className="px-3 py-2 mono text-right">{fmtRp(o.value)}</td>
                      <td className="px-3 py-2 mono text-center">{fmtNum(o.qty)}</td>
                      <td className="px-3 py-2 mono text-center">{o.invoiceCount}</td>
                      <td className="px-3 py-2 mono text-center" style={{ color: colors.textMuted }}>{o.lastDate || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
