import { useState, useEffect } from "react";
import { Store, X, Search } from "lucide-react";
import { fmtRp, fmtNum } from "../../utils/formatters.js";
import { OutletStatusBadge } from "../../pages/OutletAnalysisPage.jsx";

/* ============================================================================
   OUTLET DETAIL MODAL
   Modal detail 1 outlet spesifik — dipicu dari tab Analisis Outlet saat user
   klik nama outlet. Menampilkan KPI outlet (value, frekuensi, terakhir, status)
   + breakdown produk yang dibeli outlet tersebut.
============================================================================ */
export function OutletDetailModal({ isOpen, onClose, outlet, products, colors }) {
  const [query, setQuery] = useState("");
  useEffect(() => { if (isOpen) setQuery(""); }, [isOpen, outlet]);

  if (!isOpen || !outlet) return null;

  const filtered = query.trim()
    ? products.filter((p) => p.productName.toLowerCase().includes(query.trim().toLowerCase()))
    : products;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm sm-fadein">
      <div className="sm-card sm-scale-in w-full max-w-2xl max-h-[85vh] flex flex-col" style={{ background: colors.surface }}>
        <div className="p-5 flex items-center justify-between" style={{ borderBottom: `1px solid ${colors.border}` }}>
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-2 rounded-xl shrink-0" style={{ background: colors.blue + "1A" }}><Store size={16} style={{ color: colors.blue }} /></div>
            <div className="min-w-0">
              <div className="disp text-base font-semibold truncate">{outlet.outletName}</div>
              <div className="text-xs" style={{ color: colors.textMuted }}>Sales: {outlet.salesLabel}</div>
            </div>
          </div>
          <button onClick={onClose} className="sm-btn p-2 rounded-full shrink-0" style={{ background: colors.surface2 }}><X size={16} /></button>
        </div>

        <div className="p-5 pb-0 grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="sm-card p-3">
            <div className="text-xs mb-1" style={{ color: colors.textMuted }}>Total Value</div>
            <div className="mono text-sm font-bold">{fmtRp(outlet.value)}</div>
          </div>
          <div className="sm-card p-3">
            <div className="text-xs mb-1" style={{ color: colors.textMuted }}>Frekuensi</div>
            <div className="mono text-sm font-bold">{fmtNum(outlet.invoiceCount)}×</div>
          </div>
          <div className="sm-card p-3">
            <div className="text-xs mb-1" style={{ color: colors.textMuted }}>Terakhir Transaksi</div>
            <div className="mono text-sm font-bold">{outlet.lastDate || "-"}</div>
          </div>
          <div className="sm-card p-3">
            <div className="text-xs mb-1" style={{ color: colors.textMuted }}>Status</div>
            <OutletStatusBadge status={outlet.status} colors={colors} />
          </div>
        </div>

        <div className="p-5">
          {products.length > 0 && (
            <div className="relative mb-3">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: colors.textMuted }} />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Cari produk..."
                className="w-full pl-9 pr-3 py-2 rounded-xl text-sm outline-none"
                style={{ background: colors.surface2, border: `1px solid ${colors.border}`, color: colors.text }} />
            </div>
          )}
          <div className="text-xs uppercase tracking-wider mb-2" style={{ color: colors.textMuted }}>
            {filtered.length} Produk Dibeli
          </div>
        </div>
        <div className="px-5 pb-5 overflow-y-auto">
          {products.length === 0 ? (
            <div className="text-center py-10" style={{ color: colors.textMuted }}>Tidak ada data produk untuk outlet ini.</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: colors.surface2 }}>
                  <th className="px-3 py-2 text-left" style={{ fontSize: 11, color: colors.textMuted }}>PRODUK</th>
                  <th className="px-3 py-2 text-left" style={{ fontSize: 11, color: colors.textMuted }}>GRUP</th>
                  <th className="px-3 py-2 text-right" style={{ fontSize: 11, color: colors.textMuted }}>VALUE</th>
                  <th className="px-3 py-2 text-center" style={{ fontSize: 11, color: colors.textMuted }}>TRANSAKSI</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p, i) => (
                  <tr key={i} className="sm-row" style={{ borderTop: `1px solid ${colors.border}` }}>
                    <td className="px-3 py-2">{p.productName}</td>
                    <td className="px-3 py-2 text-xs" style={{ color: colors.textMuted }}>{p.group}</td>
                    <td className="px-3 py-2 mono text-right">{fmtRp(p.value)}</td>
                    <td className="px-3 py-2 mono text-center">{p.invoiceCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
