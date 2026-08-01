import { useMemo, useState, useEffect, useRef } from "react";
import { GitCompareArrows, Users, Package, Store, Wallet } from "lucide-react";
import { MultiSelect } from "../components/ui/MultiSelect.jsx";
import { SectionTitle } from "../components/ui/index.jsx";
import { PeriodPicker } from "../components/comparison/PeriodPicker.jsx";
import { MetricToggle } from "../components/comparison/MetricToggle.jsx";
import { MatrixKpiTotal } from "../components/comparison/MatrixKpiTotal.jsx";
import { GroupedBarChart, periodColorPicker } from "../components/comparison/GroupedBarChart.jsx";
import { MatrixTable } from "../components/comparison/MatrixTable.jsx";
import {
  computePeriodAggs, buildSalesMatrix, buildGroupMatrix,
  buildOutletMatrix, collectOutletOptions, COMPARISON_METRICS, rowTotal, computeGrowth,
} from "../utils/comparison.js";
import { saveCompareState, loadCompareState } from "../utils/storage.js";
import { fmtRp, fmtPct } from "../utils/formatters.js";

/* ============================================================================
   TAB: PERBANDINGAN (Comparison Studio)
   Matriks entitas × periode: pilih 2+ entitas (sales/grup/outlet) dan 2+
   periode (preset rentang cepat atau rentang manual), lalu bandingkan
   Value / AO / Qty KARTON / ACH / Deviasi per sel.

   Semua agregasi dihitung di sini dari rawRows + targets (bukan agg yang
   difilter) — sama seperti autoTrendComparisonData di SalesMonitoringApp —
   supaya tiap periode dihitung penuh tanpa tergantung filter grup aktif.
============================================================================ */

const MODES = [
  { key: "sales", label: "Sales", icon: Users },
  { key: "group", label: "Grup Produk", icon: Package },
  { key: "outlet", label: "Outlet", icon: Store },
];

export function ComparisonPage({ rawRows, targets, colors, workDays }) {
  // State di-restore dari localStorage (tab ini di-unmount tiap pindah tab —
  // tanpa persist, semua pilihan hilang saat kembali). Lazy init: baca sekali
  // di mount; guard pakai useRef supaya "Clear All" yang dipicu dari luar
  // (halaman lain) tidak ter-overwrite oleh persist effect yang terlambat.
  const savedRef = useRef(loadCompareState() || {});
  const [mode, setMode] = useState(savedRef.current.mode || "sales");
  const [selectedEntities, setSelectedEntities] = useState(savedRef.current.selectedEntities || []);
  const [periods, setPeriods] = useState(savedRef.current.periods || []);
  const [metric, setMetric] = useState("value");

  // Simpan otomatis setiap kali pilihan berubah — supaya pilihan tetap ada
  // saat pindah tab lalu kembali (karena tab di-unmount).
  useEffect(() => {
    saveCompareState({ mode, selectedEntities, periods });
  }, [mode, selectedEntities, periods]);

  // ---- Agregat per periode (hanya periode yang dipilih user) ----
  const periodAggs = useMemo(() => {
    if (!periods.length) return [];
    return computePeriodAggs(rawRows, targets, mode === "sales" ? selectedEntities : [], periods, workDays);
  }, [rawRows, targets, mode, selectedEntities, periods, workDays]);

  // ---- Opsi entitas per mode ----
  const salesOptions = useMemo(() => targets.map((t) => t.name), [targets]);
  const groupOptions = useMemo(() => {
    const s = new Set();
    targets.forEach((t) => t.groups.forEach((g) => s.add(g.name)));
    rawRows.forEach((r) => r.group && s.add(r.group));
    return Array.from(s).sort();
  }, [targets, rawRows]);
  const outletOptions = useMemo(() => collectOutletOptions(periodAggs).map((o) => ({ label: o.label, key: o.key })), [periodAggs]);

  const entityOptions = mode === "sales" ? salesOptions : mode === "group" ? groupOptions : outletOptions.map((o) => o.label);
  // Konversi label -> kode untuk mode outlet (label bisa dobel antar outlet).
  const outletKeyByLabel = useMemo(() => {
    const m = new Map();
    outletOptions.forEach((o) => m.set(o.label, o.key));
    return m;
  }, [outletOptions]);
  const selectedKeys = mode === "outlet" ? selectedEntities.map((l) => outletKeyByLabel.get(l) || l) : selectedEntities;

  // ---- Matriks sesuai mode ----
  const matrix = useMemo(() => {
    if (mode === "sales") return buildSalesMatrix(periodAggs, selectedEntities);
    if (mode === "group") return buildGroupMatrix(periodAggs, selectedEntities);
    return buildOutletMatrix(periodAggs, selectedKeys);
  }, [mode, periodAggs, selectedEntities, selectedKeys]);

  // ---- KPI total + sortir + growth ----
  const kpiRows = useMemo(() => {
    const withTotal = rowTotal(matrix.rows, metric);
    return withTotal
      .map((r) => ({ ...r, growth: computeGrowth(r, metric) }))
      .sort((a, b) => b._total - a._total);
  }, [matrix.rows, metric]);

  // ---- Chart data ----
  const chartData = useMemo(() => {
    const metricMeta = COMPARISON_METRICS.find((m) => m.key === metric);
    return kpiRows.map((r) => {
      const point = { name: r.name };
      r.cells.forEach((c, i) => {
        if (!c.exists) return;
        let v;
        if (metric === "qty") v = r.qtyByPeriod ? r.qtyByPeriod[i].qty : c.qty;
        else if (metric === "ach") v = c.ach;
        else if (metric === "deviasi") v = c.deviasi;
        else if (metric === "ao") v = c.ao;
        else v = c.value;
        if (v !== null && v !== undefined) point[c.period.label] = v;
      });
      return point;
    });
  }, [kpiRows, metric]);

  const metricMeta = COMPARISON_METRICS.find((m) => m.key === metric);
  // Sama seperti relabeling di MetricToggle — "AO" tidak bermakna per-outlet,
  // jadi labelnya disesuaikan jadi "Frekuensi Transaksi" khusus mode outlet.
  const metricLabel = mode === "outlet" && metric === "ao" ? "Frekuensi Transaksi" : metricMeta.label;
  const pickColor = periodColorPicker(colors);
  const ready = periods.length >= 2 && kpiRows.length >= 2;

  return (
    <div className="sm-page-enter">
      <SectionTitle title="Perbandingan" sub="Bandingkan entitas (sales / grup / outlet) lintas periode pilihan Anda" icon={GitCompareArrows} colors={colors} accent={colors.violet} />

      {/* Mode selector */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="flex p-1 rounded-xl" style={{ background: colors.glassSubtle, border: `1px solid ${colors.glassBorder}` }}>
          {MODES.map((m) => {
            const Icon = m.icon;
            const on = mode === m.key;
            return (
              <button key={m.key} onClick={() => { setMode(m.key); setSelectedEntities([]); }}
                className="sm-tab-btn px-3 py-1.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5"
                style={{ background: on ? colors.glassFillStrong : "transparent", color: on ? colors.mint : colors.textMuted }}>
                <Icon size={13} /> {m.label}
              </button>
            );
          })}
        </div>
        <MultiSelect
          label={mode === "sales" ? "Pilih Sales" : mode === "group" ? "Pilih Grup" : "Pilih Outlet"}
          icon={mode === "sales" ? Users : mode === "group" ? Package : Store}
          options={entityOptions}
          selected={selectedEntities}
          onChange={setSelectedEntities}
          placeholder={`Cari ${mode === "sales" ? "sales" : mode === "group" ? "grup" : "outlet"}...`}
          colors={colors}
          fullWidth
        />
      </div>

      {/* Periode + metrik */}
      <div className="grid lg:grid-cols-2 gap-4 mb-5">
        <PeriodPicker
          periods={periods}
          onChange={setPeriods}
          rawRows={rawRows}
          colors={colors}
        />
        <div className="sm-card p-4">
          <div className="text-xs uppercase tracking-wider font-semibold mb-2" style={{ color: colors.textMuted }}>Metrik</div>
          <MetricToggle metric={metric} onChange={setMetric} colors={colors} mode={mode} />
          <p className="text-xs mt-3" style={{ color: colors.textMuted }}>
            {metric === "ach" || metric === "deviasi"
              ? "ACH & Deviasi hanya dihitung untuk periode 1 bulan kalender penuh (target berlaku per bulan). Sub-rentang parsial ditampilkan '—'."
              : metric === "qty"
                ? "Qty KARTON = jumlah setara karton (hasil konversi otomatis dari satuan asli transaksi)."
                : metric === "ao"
                  ? "AO = outlet unik yang bertransaksi pada periode tersebut."
                  : "Value = total nilai penjualan dalam Rupiah."}
          </p>
        </div>
      </div>

      {!ready ? (
        <div className="sm-card p-12 text-center">
          <div className="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center" style={{ background: colors.glassFill }}>
            <GitCompareArrows size={24} style={{ color: colors.textMuted }} />
          </div>
          <div className="disp text-base font-semibold mb-1">Belum bisa dibandingkan</div>
          <p className="text-sm" style={{ color: colors.textMuted }}>
            {periods.length < 2
              ? "Pilih minimal 2 periode untuk membandingkan."
              : "Pilih minimal 2 entitas (sales/grup/outlet)."}
          </p>
        </div>
      ) : (
        <>
          {/* KPI total per entitas */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 mb-5">
            {kpiRows.map((r, i) => (
              <MatrixKpiTotal
                key={r.code}
                label={r.name}
                value={r._total}
                growth={r.growth}
                isMoney={metricMeta.money}
                isPct={metricMeta.pct}
                accent={pickColor(null, i)}
                colors={colors}
              />
            ))}
          </div>

          {/* Bar chart */}
          <div className="sm-card p-5 mb-5 sm-fadeup">
            <div className="text-xs uppercase tracking-wider mb-3" style={{ color: colors.textMuted }}>
              {metricLabel} per Periode
            </div>
            <GroupedBarChart data={chartData} periods={periods} periodColor={pickColor} metricKey={metric} isMoney={metricMeta.money} isPct={metricMeta.pct} colors={colors} />
          </div>

          {/* Tabel matrix */}
          <div className="sm-card p-5 sm-fadeup">
            <SectionTitle title={`Detail ${metricLabel} per Entitas`} sub="Kolom = periode · angka kecil di bawah = ACH (hanya periode 1 bulan penuh)" icon={Wallet} colors={colors} />
            <MatrixTable
              rows={kpiRows}
              periods={periods}
              periodColor={pickColor}
              metricKey={metric}
              isMoney={metricMeta.money}
              isPct={metricMeta.pct}
              showAch={metric !== "ach"}
              colors={colors}
            />
          </div>
        </>
      )}
    </div>
  );
}
