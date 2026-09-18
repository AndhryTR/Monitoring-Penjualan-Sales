import { useState, useMemo, useEffect } from "react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell,
} from "recharts";
import {
  Store, Settings, CheckCircle2, AlertTriangle, XCircle, CalendarDays, Table, Map,
} from "lucide-react";
import { fmtRp, fmtNum } from "../utils/formatters.js";
import { computeOutletAnalysis } from "../utils/aggregation.js";
import { KpiCard } from "../components/KpiCard.jsx";
import { DataTable } from "../components/ui/DataTable.jsx";
import { SectionTitle } from "../components/ui/index.jsx";
import { createChartTooltipStyle } from "../styles/globalStyle.js";
// ⚠️ Sprint 5 / S3: reportExcelExport.js lazy-loaded di handler Export.
import { VisitPatternModal } from "../components/modals/VisitPatternModal.jsx";
import { OutletMapView } from "../components/outlet/OutletMapView.jsx";
import { OutletCoordinateModal } from "../components/modals/OutletCoordinateModal.jsx";
import { getStoredCoordinates } from "../utils/geoStorage.js";
import { OUTLET_STATUS_META } from "../constants/thresholds.js";
import { getStoredSchedule, DAY_LABELS, DAY_COLORS } from "../utils/visitScheduleStorage.js";
import { VisitScheduleModal } from "../components/modals/VisitScheduleModal.jsx";

/* ============================================================================
   TAB: ANALISIS OUTLET
   Segmentasi outlet berdasarkan Recency (Aktif/Berisiko/Dormant) dengan
   threshold yang dapat diatur user. Berisi KPI summary, chart distribusi
   status, tabel detail outlet, dan visualisasi peta sebaran interaktif (Leaflet).
============================================================================ */

import { OutletStatusBadge } from "../components/ui/OutletStatusBadge.jsx";
export { OUTLET_STATUS_META, OutletStatusBadge };

export function OutletAnalysisPage({ agg, colors, thresholds, setThresholds, onSelectOutlet, rawRows, targets, depotName, slideshowMode = false, canAccess }) {
  const [visitModalOpen, setVisitModalOpen] = useState(false);
  const [coordModalOpen, setCoordModalOpen] = useState(false);
  const [viewMode, setViewMode] = useState("table"); // "table" | "map"
  const [storedCoords, setStoredCoords] = useState(() => getStoredCoordinates(depotName));
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [storedSchedule, setStoredSchedule] = useState(() => getStoredSchedule(depotName));
  const [pointingOutlet, setPointingOutlet] = useState(null);

  useEffect(() => {
    setStoredCoords(getStoredCoordinates(depotName));
    setStoredSchedule(getStoredSchedule(depotName));
  }, [depotName]);

  useEffect(() => {
    const handleCoordsUpdated = (e) => {
      if (!e.detail?.depotName || e.detail.depotName === depotName) {
        setStoredCoords(getStoredCoordinates(depotName));
      }
    };
    const handleScheduleUpdated = (e) => {
      if (!e.detail?.depotName || e.detail.depotName === depotName) {
        setStoredSchedule(getStoredSchedule(depotName));
      }
    };
    window.addEventListener("sm_coords_updated", handleCoordsUpdated);
    window.addEventListener("sm_schedule_updated", handleScheduleUpdated);
    return () => {
      window.removeEventListener("sm_coords_updated", handleCoordsUpdated);
      window.removeEventListener("sm_schedule_updated", handleScheduleUpdated);
    };
  }, [depotName]);

  const { list, summary } = useMemo(
    () => computeOutletAnalysis(agg.filteredRows, agg.meta, thresholds),
    [agg.filteredRows, agg.meta, thresholds]
  );

  const chartData = useMemo(() => [
    { name: "Aktif", value: summary.active, fill: colors.mint },
    { name: "Berisiko", value: summary.atRisk, fill: colors.gold },
    { name: "Dormant", value: summary.dormant, fill: colors.coral },
  ], [summary.active, summary.atRisk, summary.dormant, colors.mint, colors.gold, colors.coral]);

  return (
    <div className="sm-page-enter">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
        <SectionTitle title="Analisis Outlet" sub="Segmentasi outlet berdasarkan aktivitas beli — mengikuti filter yang aktif" icon={Store} colors={colors} accent={colors.violet} />
        
        <div className="flex items-center flex-wrap gap-2.5">
          {/* View Mode Switcher */}
          {!slideshowMode && (
            <div
              className="inline-flex p-1 rounded-xl"
              style={{ background: colors.glassFill, border: `1px solid ${colors.glassBorder}` }}
            >
              <button
                onClick={() => setViewMode("table")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition-all ${
                  viewMode === "table" ? "bg-blue-600 text-white shadow-sm" : ""
                }`}
                style={viewMode !== "table" ? { color: colors.textMuted } : {}}
              >
                <Table size={13} /> Tabel
              </button>
              <button
                onClick={() => setViewMode("map")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition-all ${
                  viewMode === "map" ? "bg-blue-600 text-white shadow-sm" : ""
                }`}
                style={viewMode !== "map" ? { color: colors.textMuted } : {}}
              >
                <Map size={13} /> Peta Sebaran
              </button>
            </div>
          )}

          {(!canAccess || canAccess("feat:visit_schedule")) && (
            <button onClick={() => setScheduleModalOpen(true)}
              className="sm-btn inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-semibold shadow-sm"
              style={{ background: colors.blue + "1A", border: `1px solid ${colors.blue}44`, color: colors.blue }}>
              <CalendarDays size={15} /> Atur Jadwal Kunjungan
            </button>
          )}

          <button onClick={() => setVisitModalOpen(true)}
            className="sm-btn inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-semibold"
            style={{ background: colors.glassFill, border: `1px solid ${colors.glassBorder}`, color: colors.text }}>
            <CalendarDays size={15} style={{ color: colors.violet }} /> Lihat Pola Kunjungan
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <KpiCard label="Total Outlet" value={summary.total} icon={Store} accent={colors.blue} colors={colors} />
        <KpiCard label="Outlet Aktif" value={summary.active} icon={CheckCircle2} accent={colors.mint} colors={colors} />
        <KpiCard label="Outlet Berisiko" value={summary.atRisk} icon={AlertTriangle} accent={colors.gold} colors={colors} />
        <KpiCard label="Outlet Dormant" value={summary.dormant} icon={XCircle} accent={colors.coral} colors={colors} />
      </div>

      <div className="sm-card p-4 mb-6 flex flex-wrap items-center gap-4">
        <div className="text-sm font-medium flex items-center gap-2" style={{ color: colors.textMuted }}>
          <Settings size={14} /> Ambang Status:
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span>Aktif ≤</span>
          <input type="number" min={0} value={thresholds.activeMaxDays}
            onChange={(e) => setThresholds((prev) => ({ ...prev, activeMaxDays: Math.max(0, Number(e.target.value) || 0) }))}
            className="w-16 px-2 py-1 rounded-md mono text-sm text-center" style={{ background: colors.glassFill, border: `1px solid ${colors.glassBorder}` }} />
          <span>hari</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span>Dormant &gt;</span>
          <input type="number" min={0} value={thresholds.dormantMinDays}
            onChange={(e) => setThresholds((prev) => ({ ...prev, dormantMinDays: Math.max(prev.activeMaxDays, Number(e.target.value) || 0) }))}
            className="w-16 px-2 py-1 rounded-md mono text-sm text-center" style={{ background: colors.glassFill, border: `1px solid ${colors.glassBorder}` }} />
          <span>hari</span>
        </div>
        <div className="text-xs" style={{ color: colors.textMuted }}>
          (di antara keduanya = <b>Berisiko</b>)
        </div>
      </div>

      {list.length === 0 ? (
        <div className="sm-card p-16 text-center">
          <p className="text-sm" style={{ color: colors.textMuted }}>Tidak ada data outlet untuk kombinasi filter ini.</p>
        </div>
      ) : (
        <>
          {/* Tampilan Peta Sebaran */}
          {viewMode === "map" && !slideshowMode && (
            <OutletMapView
              outlets={list}
              storedCoords={storedCoords}
              schedule={storedSchedule}
              colors={colors}
              depotName={depotName}
              onSelectOutlet={onSelectOutlet}
              onOpenCoordinateModal={() => setCoordModalOpen(true)}
              onOpenScheduleModal={() => setScheduleModalOpen(true)}
              pointingOutlet={pointingOutlet}
              onClearPointingOutlet={() => setPointingOutlet(null)}
            />
          )}

          {/* Tampilan Tabel Tradisional */}
          {(viewMode === "table" || slideshowMode) && (
            <>
              <div className="sm-card p-5 mb-6">
                <div className="text-xs uppercase tracking-wider mb-3" style={{ color: colors.textMuted }}>Distribusi Status Outlet</div>
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={chartData} layout="vertical" margin={{ left: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={colors.chartGrid} horizontal={false} />
                    <XAxis type="number" allowDecimals={false} tick={{ fill: colors.textMuted, fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="name" width={70} tick={{ fill: colors.text, fontSize: 12 }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={createChartTooltipStyle(colors)} formatter={(v) => `${v} outlet`} cursor={{ fill: colors.glassSubtle }} />
                    <Bar dataKey="value" radius={[0, 6, 6, 0]}>
                      {chartData.map((d, i) => <Cell key={i} fill={d.fill} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Daftar outlet — di-hide di mode slideshow */}
              {!slideshowMode && (
                <DataTable
                  colors={colors}
                  rowKey="outletCode"
                  initialSortKey="value"
                  searchable
                  searchKeys={["outletName", "salesLabel"]}
                  searchPlaceholder="Cari nama outlet atau sales..."
                  columns={[
                    { key: "outletName", label: "Nama Outlet", render: (o) => (
                      <button onClick={() => onSelectOutlet(o)} className="text-left hover:underline" style={{ color: colors.text }}>{o.outletName}</button>
                    ) },
                    { key: "salesLabel", label: "Sales", render: (o) => (
                      <span className="inline-flex items-center gap-1.5 min-w-0 max-w-full sm:max-w-[220px]" title={o.salesLabel}>
                        <span className="truncate">{o.salesLabel}</span>
                        {o.salesNames.length > 1 && (
                          <span className="shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded-full" style={{ background: colors.gold + "1A", color: colors.gold }}>
                            {o.salesNames.length}
                          </span>
                        )}
                      </span>
                    ) },
                    { key: "scheduleDay", label: "Hari Kunjungan", render: (o) => {
                      const sched = storedSchedule[o.outletCode];
                      if (!sched?.day) {
                        return (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md opacity-75" style={{ background: colors.coral + "14", color: colors.coral }}>
                            Belum
                          </span>
                        );
                      }
                      const colorConf = DAY_COLORS[sched.day];
                      return (
                        <span
                          className="text-[10.5px] font-bold px-2 py-0.5 rounded-full inline-flex items-center gap-1 shadow-sm"
                          style={{
                            background: colorConf?.lightBg || colors.glassFill,
                            color: colorConf?.lightText || colors.text,
                            border: `1px solid ${colorConf?.border || colors.glassBorder}`,
                          }}
                        >
                          <span className="w-1.5 h-1.5 rounded-full" style={{ background: colorConf?.badge || colors.blue }} />
                          {DAY_LABELS[sched.day] || sched.day}
                        </span>
                      );
                    } },
                    { key: "value", label: "Total Value", render: (o) => <span className="mono">{fmtRp(o.value)}</span> },
                    { key: "invoiceCount", label: "Frekuensi", render: (o) => <span className="mono">{fmtNum(o.invoiceCount)}×</span> },
                    { key: "groupCount", label: "Grup Produk", render: (o) => <span className="mono">{o.groupCount}</span> },
                    { key: "lastDate", label: "Terakhir Transaksi", render: (o) => <span className="mono text-xs" style={{ color: colors.textMuted }}>{o.lastDate || "-"}</span> },
                    { key: "daysSinceLastPurchase", label: "Jeda", render: (o) => <span className="mono">{o.daysSinceLastPurchase ?? "-"}</span> },
                    { key: "status", label: "Status", render: (o) => <OutletStatusBadge status={o.status} colors={colors} /> },
                  ]}
                  rows={list}
                />
              )}
            </>
          )}
        </>
      )}

      <VisitPatternModal
        isOpen={visitModalOpen}
        onClose={() => setVisitModalOpen(false)}
        rawRows={rawRows}
        targets={targets}
        colors={colors}
        depotName={depotName}
      />

      <OutletCoordinateModal
        isOpen={coordModalOpen}
        onClose={() => setCoordModalOpen(false)}
        outlets={list}
        depotName={depotName}
        colors={colors}
        onCoordinatesSaved={() => setStoredCoords(getStoredCoordinates(depotName))}
        onPickOnMap={(outlet) => {
          setCoordModalOpen(false);
          setViewMode("map");
          setPointingOutlet(outlet);
        }}
      />

      {(!canAccess || canAccess("feat:visit_schedule")) && (
        <VisitScheduleModal
          isOpen={scheduleModalOpen}
          onClose={() => setScheduleModalOpen(false)}
          outlets={list}
          rawRows={rawRows}
          targets={targets}
          colors={colors}
          depotName={depotName}
          coords={storedCoords}
          onScheduleSaved={() => setStoredSchedule(getStoredSchedule(depotName))}
        />
      )}
    </div>
  );
}
