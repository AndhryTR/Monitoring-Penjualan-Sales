import { useMemo } from "react";
import {
  Package, Upload, AlertTriangle, TrendingDown, Clock, History,
} from "lucide-react";
import { fmtRp, fmtNum, fmtMixedUnits } from "../utils/formatters.js";
import { KpiCard } from "../components/KpiCard.jsx";
import { DataTable } from "../components/ui/DataTable.jsx";
import { SectionTitle } from "../components/ui/index.jsx";

/* ============================================================================
   STOCK PAGE — Sprint 19 / Stock Module
   Tab baru "Stok Barang" dengan KPI cards + tabel stok per produk.

   Features:
   - KPI: total produk, total stok (qty + value), stok kritis, stok habis
   - Tabel: kode, nama, grup, awal, terjual, saat ini, coverage, nilai
   - Status flags: habis (coral), rendah (gold), overstock (blue), dead stock (muted)
   - Stale warning: snapshot > 7 hari
   - Empty state: belum ada data stok
   - Upload button: trigger file input di parent
============================================================================ */
export function StockPage({ stockData, colors, onUploadStock }) {
  const {
    loading, uploading, activeSnapshot, stockMetrics, stockSummary, snapshotHistory, adjustments,
  } = stockData;

  // Compute days since last upload (for stale warning)
  const daysSinceUpload = useMemo(() => {
    if (!activeSnapshot?.uploadedAt) return null;
    return Math.floor((Date.now() - new Date(activeSnapshot.uploadedAt)) / 86400000);
  }, [activeSnapshot]);
  const isStale = daysSinceUpload !== null && daysSinceUpload > 7;

  if (loading) {
    return (
      <div className="text-center py-16" style={{ color: colors.textMuted }}>
        <Package size={32} className="mx-auto mb-3 animate-pulse" style={{ opacity: 0.3 }} />
        <p className="text-sm">Memuat data stok...</p>
      </div>
    );
  }

  // Empty state: no snapshot yet
  if (!activeSnapshot) {
    return (
      <div className="sm-page-enter">
        <SectionTitle
          title="Stok Barang"
          sub="Upload master stok untuk mulai tracking inventory"
          icon={Package}
          colors={colors}
          accent={colors.blue}
        />
        <div className="sm-card p-12 text-center">
          <Package size={48} className="mx-auto mb-4" style={{ color: colors.textMuted, opacity: 0.3 }} />
          <p className="text-sm mb-2" style={{ color: colors.text }}>
            Belum ada data stok.
          </p>
          <p className="text-xs mb-6" style={{ color: colors.textMuted }}>
            Upload master stok dari sistem inventory Anda (Excel).
            Stok akan otomatis berkurang saat ada transaksi penjualan.
          </p>
          <button
            onClick={onUploadStock}
            disabled={uploading}
            className="sm-btn inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50"
            style={{ background: colors.mint, color: "#0A1120" }}
          >
            <Upload size={15} /> Upload Master Stok
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="sm-page-enter">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
        <SectionTitle
          title="Stok Barang"
          sub={`Snapshot per ${activeSnapshot.snapshotDate} · ${activeSnapshot.summary?.productCount || 0} produk`}
          icon={Package}
          colors={colors}
          accent={colors.blue}
        />
        <button
          onClick={onUploadStock}
          disabled={uploading}
          className="sm-btn inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-semibold disabled:opacity-50"
          style={{ background: colors.glassFill, color: colors.text, border: `1px solid ${colors.glassBorder}` }}
        >
          <Upload size={15} /> {uploading ? "Mengunggah..." : "Update Stok"}
        </button>
      </div>

      {/* Stale warning */}
      {isStale && (
        <div
          className="mb-4 p-3 rounded-lg flex items-center gap-2"
          style={{ background: colors.gold + "14", border: `1px solid ${colors.gold}33` }}
        >
          <Clock size={14} style={{ color: colors.gold }} />
          <span className="text-sm" style={{ color: colors.gold }}>
            Stok terakhir diupdate {daysSinceUpload} hari lalu — mungkin sudah berubah.
            Upload ulang untuk data terbaru.
          </span>
        </div>
      )}

      {/* KPI Cards */}
      {stockSummary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <KpiCard
            label="Total Produk"
            value={stockSummary.totalProducts}
            icon={Package}
            accent={colors.blue}
            colors={colors}
          />
          <KpiCard
            label="Total Stok"
            value={fmtNum(stockSummary.totalQty)}
            sub={`${stockSummary.totalProducts} SKU`}
            icon={Package}
            accent={colors.mint}
            colors={colors}
          />
          <KpiCard
            label="Nilai Stok"
            value={fmtRp(stockSummary.totalValue)}
            icon={TrendingDown}
            accent={colors.gold}
            colors={colors}
          />
          <KpiCard
            label="Stok Kritis"
            value={stockSummary.lowStockCount + stockSummary.stockoutCount}
            sub={`${stockSummary.stockoutCount} habis · ${stockSummary.lowStockCount} rendah`}
            icon={AlertTriangle}
            accent={colors.coral}
            colors={colors}
          />
        </div>
      )}

      {/* Stock Table */}
      <DataTable
        colors={colors}
        initialSortKey="currentQty"
        searchable
        searchKeys={["productCode", "productName", "group"]}
        searchPlaceholder="Cari kode/nama produk..."
        rows={stockMetrics}
        columns={[
          {
            key: "productCode",
            label: "Kode",
            render: (p) => <span className="mono text-sm">{p.productCode}</span>,
          },
          {
            key: "productName",
            label: "Nama Produk",
            render: (p) => (
              <span className="text-sm truncate inline-block max-w-[200px]" title={p.productName}>
                {p.productName}
              </span>
            ),
          },
          {
            key: "group",
            label: "Grup",
            render: (p) => (
              <span className="text-sm" style={{ color: colors.textMuted }}>
                {p.group || "-"}
              </span>
            ),
          },
          {
            key: "openingQty",
            label: "Awal",
            render: (p) => (
              <span className="mono text-xs" style={{ color: colors.textMuted }}>
                {fmtMixedUnits(p.openingQty, p.conversions)}
              </span>
            ),
          },
          {
            key: "soldQty",
            label: "Terjual",
            render: (p) => (
              <span className="mono text-xs" style={{ color: colors.coral }}>
                {fmtMixedUnits(p.soldQty, p.conversions)}
              </span>
            ),
          },
          {
            key: "currentQty",
            label: "Saat Ini",
            render: (p) => {
              const color = p.isStockout
                ? colors.coral
                : p.isLowStock
                  ? colors.gold
                  : colors.text;
              return (
                <span className="mono text-xs font-bold" style={{ color }}>
                  {fmtMixedUnits(p.currentQty, p.conversions)}
                  {p.isStockout && <span className="ml-1 text-xs" style={{ color: colors.coral }}>⚠ Habis</span>}
                  {p.isLowStock && !p.isStockout && (
                    <span className="ml-1 text-xs" style={{ color: colors.gold }}>↓ Rendah</span>
                  )}
                  {p.isDeadStock && (
                    <span className="ml-1 text-xs" style={{ color: colors.textMuted }}>💤 Dead</span>
                  )}
                </span>
              );
            },
          },
          {
            key: "coverageDays",
            label: "Coverage",
            render: (p) =>
              p.coverageDays !== null ? (
                <span
                  className="mono text-sm"
                  style={{
                    color:
                      p.coverageDays < 7
                        ? colors.coral
                        : p.coverageDays < 30
                          ? colors.gold
                          : colors.mint,
                  }}
                >
                  {p.coverageDays.toFixed(0)} hari
                </span>
              ) : (
                <span style={{ color: colors.textMuted }}>-</span>
              ),
          },
          {
            key: "currentValue",
            label: "Nilai",
            render: (p) => <span className="mono text-sm">{fmtRp(p.currentValue)}</span>,
          },
        ]}
      />

      {/* Snapshot History */}
      {snapshotHistory.length > 0 && (
        <div className="mt-6">
          <SectionTitle
            title="Riwayat Upload Stok"
            sub={`${snapshotHistory.length} upload terakhir`}
            icon={History}
            colors={colors}
            accent={colors.violet}
          />
          <div className="sm-card p-4">
            {snapshotHistory.slice(0, 5).map((snap, i) => (
              <div
                key={snap.id}
                className="py-2 flex items-center justify-between"
                style={{ borderBottom: i < Math.min(4, snapshotHistory.length - 1) ? `1px solid ${colors.glassBorder}` : "none" }}
              >
                <div>
                  <div className="text-sm font-medium" style={{ color: colors.text }}>
                    {new Date(snap.uploadedAt).toLocaleDateString("id-ID", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}{" "}
                    {new Date(snap.uploadedAt).toLocaleTimeString("id-ID", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                  <div className="text-xs" style={{ color: colors.textMuted }}>
                    {snap.summary?.productCount || 0} produk ·{" "}
                    {snap.summary?.totalValue ? fmtRp(snap.summary.totalValue) : "-"}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs" style={{ color: colors.textMuted }}>
                    Snapshot {snap.snapshotDate}
                  </div>
                  {i === 0 && (
                    <span
                      className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                      style={{ background: colors.mint + "1A", color: colors.mint }}
                    >
                      AKTIF
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ⚠️ Sprint 19 / Sprint 2: Adjustment History (Reconciliation log) */}
      {adjustments && adjustments.length > 0 && (
        <div className="mt-6">
          <SectionTitle
            title="Riwayat Penyesuaian"
            sub={`${adjustments.length} penyesuaian terakhir (reconciliation)`}
            icon={TrendingDown}
            colors={colors}
            accent={colors.coral}
          />
          <div className="sm-card p-4">
            {adjustments.slice(0, 5).map((adj, i) => (
              <div
                key={adj.id}
                className="py-2 flex items-center justify-between"
                style={{ borderBottom: i < Math.min(4, adjustments.length - 1) ? `1px solid ${colors.glassBorder}` : "none" }}
              >
                <div>
                  <div className="text-sm font-medium" style={{ color: colors.text }}>
                    {new Date(adj.uploadedAt).toLocaleDateString("id-ID", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}{" "}
                    {new Date(adj.uploadedAt).toLocaleTimeString("id-ID", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                  <div className="text-xs" style={{ color: colors.textMuted }}>
                    {adj.totalProductsChanged || 0} produk berubah
                    {adj.warnings?.length > 0 && ` · ${adj.warnings.length} warning`}
                  </div>
                </div>
                <div className="text-right">
                  <div
                    className="text-sm mono font-bold"
                    style={{ color: (adj.totalQtyChange || 0) >= 0 ? colors.mint : colors.coral }}
                  >
                    {(adj.totalQtyChange || 0) >= 0 ? "+" : ""}
                    {fmtNum(adj.totalQtyChange || 0)}
                  </div>
                  <div className="text-xs mono" style={{ color: colors.textMuted }}>
                    {(adj.totalValueChange || 0) >= 0 ? "+" : ""}
                    {fmtRp(adj.totalValueChange || 0)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
