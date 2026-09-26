import { useState, useMemo, useEffect, useCallback } from "react";
import {
  Package, Upload, AlertTriangle, TrendingDown, Clock, History,
  Calendar,
} from "lucide-react";
import { fmtRp, fmtNum, fmtMixedUnits } from "../utils/formatters.js";
import { KpiCard } from "../components/KpiCard.jsx";
import { DataTable } from "../components/ui/DataTable.jsx";
import { SectionTitle } from "../components/ui/index.jsx";
import { exportStockExcel } from "../utils/stockExport.js";
import { notifyExportSuccess, notifyError } from "../utils/notifyExport.js";

function formatDepletion(dateStr) {
  if (!dateStr) return "-";
  try {
    const d = new Date(dateStr + "T00:00:00");
    const day = d.getDate();
    const months = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
    return `${day} ${months[d.getMonth()]}`;
  } catch {
    return dateStr;
  }
}

/* ============================================================================
   STOCK PAGE — Sprint 19 / Stock Module
   Tab baru "Stok Barang" dengan KPI cards + tabel stok per produk.

   Features:
   - KPI: total produk, total stok (qty + value), rata-rata runway (DOI), stok kritis
   - Tabel: kode, nama, grup, awal, terjual, saat ini, coverage, estimasi habis, nilai
   - Status flags: habis (coral), rendah (gold), overstock (blue), dead stock (muted)
   - Stale warning: snapshot > 7 hari
   - Empty state: belum ada data stok
   - Upload button: trigger file input di parent
   - Export Excel: terintegrasi ke tombol export global
============================================================================ */
export function StockPage({
  stockData,
  colors,
  onUploadStock,
  filters,
  depotName = "",
  registerTabExport,
  unregisterTabExport,
}) {
  const {
    loading, uploading, activeSnapshot, stockMetrics, snapshotHistory, adjustments,
  } = stockData;

  const [statusFilter, setStatusFilter] = useState("all");

  const filteredStock = useMemo(() => {
    const groups = filters?.groups || [];
    if (!groups.length) return stockMetrics || [];
    return (stockMetrics || []).filter((product) => groups.includes(product.group));
  }, [stockMetrics, filters?.groups]);

  // Handler ekspor excel untuk tombol Export Global
  const handleExportExcel = useCallback(() => {
    try {
      exportStockExcel(filteredStock, {
        depotName,
        snapshotDate: activeSnapshot?.snapshotDate,
      });
      notifyExportSuccess("Export berhasil", "Stok Barang (Excel)");
    } catch (err) {
      console.error("Export stok gagal:", err);
      notifyError("Export stok gagal", err?.message || String(err));
    }
  }, [filteredStock, depotName, activeSnapshot?.snapshotDate]);

  // Daftarkan ke tombol Export Global di navbar/toolbar atas
  useEffect(() => {
    registerTabExport?.("stock", {
      onExportExcel: handleExportExcel,
      disabled: !filteredStock || filteredStock.length === 0,
    });
    return () => unregisterTabExport?.("stock");
  }, [registerTabExport, unregisterTabExport, handleExportExcel, filteredStock]);

  // KPI ringkasan dan estimasi runway inventaris
  const stockKpis = useMemo(() => {
    if (!filteredStock || !filteredStock.length) return null;
    const totalItems = filteredStock.length;
    const totalQty = filteredStock.reduce((s, p) => s + (p.currentQty || 0), 0);
    const totalVal = filteredStock.reduce((s, p) => s + (p.currentValue || 0), 0);
    const stockouts = filteredStock.filter((p) => p.isStockout).length;
    const lowStocks = filteredStock.filter((p) => p.isLowStock && !p.isStockout).length;
    const needReorders = filteredStock.filter((p) => (p.isNeedReorder || p.isLowStock) && !p.isStockout).length;
    const overstocks = filteredStock.filter((p) => p.isOverstock).length;

    // Rata-rata DOI (Days of Inventory) untuk SKU yang ada transaksi penjualan
    const itemsWithCov = filteredStock.filter((p) => p.coverageDays !== null && p.coverageDays >= 0);
    const avgDoi = itemsWithCov.length > 0
      ? itemsWithCov.reduce((s, p) => s + p.coverageDays, 0) / itemsWithCov.length
      : null;

    return {
      totalItems,
      totalQty,
      totalVal,
      stockouts,
      lowStocks,
      needReorders,
      overstocks,
      avgDoi,
    };
  }, [filteredStock]);

  // Filter tampilan berdasarkan chip status
  const displayedStock = useMemo(() => {
    if (statusFilter === "stockout") return filteredStock.filter((p) => p.isStockout);
    if (statusFilter === "low") return filteredStock.filter((p) => p.isLowStock && !p.isStockout);
    if (statusFilter === "reorder") return filteredStock.filter((p) => (p.isNeedReorder || p.isLowStock) && !p.isStockout);
    if (statusFilter === "overstock") return filteredStock.filter((p) => p.isOverstock);
    if (statusFilter === "normal") return filteredStock.filter((p) => !p.isStockout && !p.isLowStock && !p.isNeedReorder && !p.isOverstock);
    return filteredStock;
  }, [filteredStock, statusFilter]);

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
            style={{ background: colors.mint, color: colors.onMint || "#0A1120" }}
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
          sub={`Snapshot per ${activeSnapshot.snapshotDate} · ${activeSnapshot.summary?.count || 0} produk`}
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
      {stockKpis && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3.5 mb-6">
          <KpiCard
            label="Total Produk"
            value={stockKpis.totalItems}
            icon={Package}
            accent={colors.blue}
            colors={colors}
          />
          <KpiCard
            label="Total Stok"
            value={fmtNum(stockKpis.totalQty)}
            sub={`${stockKpis.totalItems} SKU`}
            icon={Package}
            accent={colors.mint}
            colors={colors}
          />
          <KpiCard
            label="Nilai Stok"
            value={fmtRp(stockKpis.totalVal)}
            icon={TrendingDown}
            accent={colors.gold}
            colors={colors}
          />
          <KpiCard
            label="Rata-rata Runway"
            value={stockKpis.avgDoi !== null ? `${stockKpis.avgDoi.toFixed(0)} hari` : "-"}
            sub="Days of Inventory (DOI)"
            icon={Calendar}
            accent={colors.violet || colors.blue}
            colors={colors}
          />
          <KpiCard
            label="Stok Kritis"
            value={stockKpis.stockouts + stockKpis.lowStocks}
            sub={`${stockKpis.stockouts} habis · ${stockKpis.lowStocks} kritis`}
            icon={AlertTriangle}
            accent={colors.coral}
            colors={colors}
          />
        </div>
      )}

      {/* Quick Status Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 mb-3 text-xs">
        <button
          onClick={() => setStatusFilter("all")}
          className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
            statusFilter === "all" ? "font-bold shadow-sm" : "opacity-75 hover:opacity-100"
          }`}
          style={{
            background: statusFilter === "all" ? colors.blue : colors.glassFill,
            color: statusFilter === "all" ? "#FFFFFF" : colors.text,
            border: `1px solid ${statusFilter === "all" ? colors.blue : colors.glassBorder}`,
          }}
        >
          Semua ({filteredStock.length})
        </button>
        <button
          onClick={() => setStatusFilter("stockout")}
          className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
            statusFilter === "stockout" ? "font-bold shadow-sm" : "opacity-75 hover:opacity-100"
          }`}
          style={{
            background: statusFilter === "stockout" ? colors.coral : colors.glassFill,
            color: statusFilter === "stockout" ? "#FFFFFF" : colors.coral,
            border: `1px solid ${statusFilter === "stockout" ? colors.coral : colors.glassBorder}`,
          }}
        >
          Habis / 0 ({stockKpis?.stockouts || 0})
        </button>
        <button
          onClick={() => setStatusFilter("low")}
          className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
            statusFilter === "low" ? "font-bold shadow-sm" : "opacity-75 hover:opacity-100"
          }`}
          style={{
            background: statusFilter === "low" ? colors.gold : colors.glassFill,
            color: statusFilter === "low" ? (colors.onGold || "#0A1120") : colors.gold,
            border: `1px solid ${statusFilter === "low" ? colors.gold : colors.glassBorder}`,
          }}
        >
          Kritis &lt; 7 Hari ({stockKpis?.lowStocks || 0})
        </button>
        <button
          onClick={() => setStatusFilter("reorder")}
          className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
            statusFilter === "reorder" ? "font-bold shadow-sm" : "opacity-75 hover:opacity-100"
          }`}
          style={{
            background: statusFilter === "reorder" ? colors.mint : colors.glassFill,
            color: statusFilter === "reorder" ? (colors.onMint || "#0A1120") : colors.mint,
            border: `1px solid ${statusFilter === "reorder" ? colors.mint : colors.glassBorder}`,
          }}
        >
          Perlu Restock &lt; 14 Hari ({stockKpis?.needReorders || 0})
        </button>
        <button
          onClick={() => setStatusFilter("overstock")}
          className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
            statusFilter === "overstock" ? "font-bold shadow-sm" : "opacity-75 hover:opacity-100"
          }`}
          style={{
            background: statusFilter === "overstock" ? (colors.violet || colors.blue) : colors.glassFill,
            color: statusFilter === "overstock" ? "#FFFFFF" : (colors.violet || colors.blue),
            border: `1px solid ${statusFilter === "overstock" ? (colors.violet || colors.blue) : colors.glassBorder}`,
          }}
        >
          Overstock &gt; 60 Hari ({stockKpis?.overstocks || 0})
        </button>
      </div>

      {/* Stock Table */}
      <DataTable
        colors={colors}
        rowKey="productCode"
        initialSortKey="currentQty"
        searchable
        searchKeys={["productCode", "productName", "group"]}
        searchPlaceholder="Cari kode/nama produk..."
        rows={displayedStock}
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
            key: "estimatedDepletionDate",
            label: "Estimasi Habis & Saran",
            render: (p) => {
              if (p.isStockout) {
                return (
                  <span
                    className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold"
                    style={{ background: colors.coral + "22", color: colors.coral }}
                  >
                    Stok Habis
                  </span>
                );
              }
              if (!p.estimatedDepletionDate) {
                return <span style={{ color: colors.textMuted }}>-</span>;
              }
              const isUrgent = p.isLowStock;
              const isWarning = p.isNeedReorder && !p.isLowStock;
              const badgeBg = isUrgent
                ? colors.coral + "22"
                : isWarning
                  ? colors.gold + "22"
                  : colors.glassFill;
              const badgeColor = isUrgent
                ? colors.coral
                : isWarning
                  ? colors.gold
                  : colors.text;

              return (
                <div className="flex flex-col gap-0.5">
                  <span
                    className="inline-flex items-center gap-1 text-xs font-medium px-1.5 py-0.5 rounded w-fit"
                    style={{ background: badgeBg, color: badgeColor }}
                  >
                    📅 {formatDepletion(p.estimatedDepletionDate)}
                    {isUrgent && <span className="text-[10px] font-bold">(! Segera)</span>}
                  </span>
                  {p.suggestedReorderQty > 0 && (
                    <span className="text-[10.5px]" style={{ color: colors.textMuted }}>
                      Saran: +{fmtNum(p.suggestedReorderQty)} {p.unit || "PCS"}
                    </span>
                  )}
                </div>
              );
            },
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
                    {snap.summary?.count || 0} produk ·{" "}
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
