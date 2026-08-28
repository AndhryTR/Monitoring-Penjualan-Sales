import { useMemo, useState, useEffect, useRef } from "react";
import { GitCompareArrows, Users, Package, Store, Wallet } from "lucide-react";
import { MultiSelect } from "../components/ui/MultiSelect.jsx";
import { notifyExportSuccess } from "../utils/notifyExport.js";
import { SectionTitle } from "../components/ui/index.jsx";
import { BaseSelector } from "../components/ui/BaseSelector.jsx";
import { PeriodPicker } from "../components/comparison/PeriodPicker.jsx";
import { MetricToggle } from "../components/comparison/MetricToggle.jsx";
import { MatrixKpiTotal } from "../components/comparison/MatrixKpiTotal.jsx";
import { GroupedBarChart, periodColorPicker } from "../components/comparison/GroupedBarChart.jsx";
import { MatrixTable } from "../components/comparison/MatrixTable.jsx";
import {
  computePeriodAggs, buildSalesMatrix, buildGroupMatrix,
  buildOutletMatrix, collectOutletOptions, COMPARISON_METRICS, rowTotal,
} from "../utils/comparison.js";
import { saveCompareState, loadCompareState } from "../utils/storage.js";
import { fmtRp, fmtPct } from "../utils/formatters.js";
// ⚠️ Sprint 5 / S3: comparisonExport.js lazy-loaded di handler Export (~620KB).
// captureChartImage dari trendExport.js hanya dipakai untuk chart screenshot —
// masih static karena trendExport.js juga punya exportTrendExcel/PDF yang
// dipakai di tempat lain (tidak bisa di-code-split perlu jalan).
import { captureChartImage } from "../utils/trendExport.js";
import { computeBaseGrowth } from "../utils/comparisonBase.js";
import { Download } from "lucide-react";

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

export function ComparisonPage({ rawRows, targets, colors, workDays, depotName, comparisonBase = "prev", onBaseChange }) {
  const [exportBusy, setExportBusy] = useState(false);
  const chartRef = useRef(null);
  // State di-restore dari localStorage (tab ini di-unmount tiap pindah tab —
  // tanpa persist, semua pilihan hilang saat kembali). Lazy init: baca sekali
  // di mount; guard pakai useRef supaya "Clear All" yang dipicu dari luar
  // (halaman lain) tidak ter-overwrite oleh persist effect yang terlambat.
  //
  // ---- PER-MODE SELECTION STORAGE ----
  // Sebelumnya: selectedEntities tunggal + tombol mode onClick pakai
  // setSelectedEntities([]) -> ganti mode mengosongkan pilihan mode lain,
  // dan save effect langsung menimpa localStorage dgn array kosong. Akibatnya
  // pilihan outlet "selalu hilang" begitu user ganti mode (tombol Sales/Grup/
  // Outlet yang di-style sebagai tab). Fix: simpan selection PER mode, ganti
  // mode hanya swap tampilan, tidak clear. Backward-compat: kalau load state
  // lama (selectedEntities tunggal), migrate ke selectedByMode[mode].
  //
  // ⚠️ Bug fix (Sprint 3 / P7): sebelumnya `const savedRef = useRef(loadCompareState() || {});`
  // — argumen ke useRef di-evaluate di SETIAP render meski hanya nilai pertama
  // yang di-retained. loadCompareState() baca localStorage (synchronous I/O)
  // di setiap render — minor cost tapi boros. Fix: lazy init via useState
  // initializer (cuma jalan sekali saat mount).
  const [saved] = useState(() => loadCompareState() || {});
  const migrateSaved = (saved) => {
    if (saved?.selectedByMode) return saved.selectedByMode;
    // Legacy: selectedEntities tunggal — asumsikan milik mode yg aktif saat itu.
    const legacy = saved?.selectedEntities || [];
    const byMode = { sales: [], group: [], outlet: [] };
    if (legacy.length && saved?.mode && byMode[saved.mode] != null) {
      byMode[saved.mode] = legacy;
    }
    return byMode;
  };
  const [mode, setMode] = useState(saved.mode || "sales");
  const [selectedByMode, setSelectedByMode] = useState(() => migrateSaved(saved));
  const [periods, setPeriods] = useState(saved.periods || []);
  const [metric, setMetric] = useState(saved.metric || "value");

  // Helper derive: ambil selection untuk mode aktif.
  const selectedEntities = selectedByMode[mode] || [];
  // Helper setter: update selection untuk mode aktif saja, mode lain tetap.
  const updateSelectedEntities = (next) => {
    setSelectedByMode((prev) => ({ ...prev, [mode]: typeof next === "function" ? next(prev[mode] || []) : next }));
  };

  // Simpan otomatis setiap kali pilihan berubah — supaya pilihan tetap ada
  // saat pindah tab lalu kembali (karena tab di-unmount).
  useEffect(() => {
    saveCompareState({ mode, selectedByMode, periods, metric });
  }, [mode, selectedByMode, periods, metric]);

  // Nama -> kode sales (picker memakai nama, agregasi memakai kode).
  const salesCodeByName = useMemo(() => Object.fromEntries(targets.map((t) => [t.name, t.code])), [targets]);
  // ⚠️ Bug fix (Sprint 3 / P5): sebelumnya `const salesKeys = mode === "sales" ? selectedEntities.map((n) => salesCodeByName[n] || n) : [];`
  // — inline derivation produce new array ref every render → invalidate
  // periodAggs useMemo yang depend on `salesKeys`. Fix: wrap in useMemo.
  const salesKeys = useMemo(() => mode === "sales" ? selectedEntities.map((n) => salesCodeByName[n] || n) : [], [mode, selectedEntities, salesCodeByName]);

  // ---- Agregat per periode (hanya periode yang dipilih user) ----
  // Sales mode wajib filter pakai KODE — nama tidak cocok dengan r.salesCode
  // (pencocokan di computeAggregates), kalau nama yang dikirim semua baris
  // terfilter habis dan value jadi 0.
  const periodAggs = useMemo(() => {
    if (!periods.length) return [];
    return computePeriodAggs(rawRows, targets, salesKeys, periods, workDays);
  }, [rawRows, targets, salesKeys, periods, workDays]);

  // ---- Opsi entitas per mode ----
  // Sales: {label: nama, code} untuk picker; matriks pakai KODE (sama seperti
  // FilterBar/agg). Kalau hanya nama yang dikirim, pencocokan nama vs kode
  // (t.code) gagal -> semua baris sales terfilter -> data hilang.
  const salesOptions = useMemo(() => targets.map((t) => ({ label: t.name, code: t.code })), [targets]);
  const groupOptions = useMemo(() => {
    const s = new Set();
    targets.forEach((t) => t.groups.forEach((g) => s.add(g.name)));
    rawRows.forEach((r) => r.group && s.add(r.group));
    return Array.from(s).sort();
  }, [targets, rawRows]);
  const outletOptions = useMemo(() => collectOutletOptions(periodAggs).map((o) => ({ label: o.label, key: o.key })), [periodAggs]);

  // ⚠️ Bug fix (Sprint 3 / P5): sebelumnya `const entityOptions = mode === "sales" ? ... : mode === "group" ? ... : ...;`
  // — inline ternary produce new array every render → kalahkan memoization
  // MultiSelect yang menerima `options` prop. Fix: wrap in useMemo.
  const entityOptions = useMemo(() => {
    if (mode === "sales") return salesOptions.map((o) => o.label);
    if (mode === "group") return groupOptions;
    return outletOptions.map((o) => o.label);
  }, [mode, salesOptions, groupOptions, outletOptions]);
  // Konversi label -> kode untuk mode outlet (label bisa dobel antar outlet).
  const outletKeyByLabel = useMemo(() => {
    const m = new Map();
    outletOptions.forEach((o) => m.set(o.label, o.key));
    return m;
  }, [outletOptions]);
  // ⚠️ Bug fix (Sprint 3 / P5): sebelumnya `const selectedKeys = mode === "sales" ? ... : mode === "outlet" ? ... : selectedEntities;`
  // — inline derivation produce new array every render → invalidate matrix
  // useMemo. Fix: wrap in useMemo.
  const selectedKeys = useMemo(() => {
    if (mode === "sales") return selectedEntities.map((n) => salesCodeByName[n] || n);
    if (mode === "outlet") return selectedEntities.map((l) => outletKeyByLabel.get(l) || l);
    return selectedEntities;
  }, [mode, selectedEntities, salesCodeByName, outletKeyByLabel]);

  // ---- Matriks sesuai mode (sales pakai KODE, bukan nama) ----
  const matrix = useMemo(() => {
    if (mode === "sales") return buildSalesMatrix(periodAggs, selectedKeys);
    if (mode === "group") return buildGroupMatrix(periodAggs, selectedEntities);
    return buildOutletMatrix(periodAggs, selectedKeys);
  }, [mode, periodAggs, selectedEntities, selectedKeys]);

  // ---- KPI: nilai periode TERAKHIR (current) + sortir + growth ----
  // Value yang ditampilkan di kartu KPI = nilai metrik pada periode TERAKHIR
  // yang punya data (bukan Σ semua periode), supaya KONSISTEN dengan growth
  // badge di bawahnya — growth selalu membandingkan titik terakhir vs baseline
  // (prev / avg3 / avg6 / yoy). Sebelumnya kartu menampilkan Σ semua periode
  // sehingga angka besar di atas tidak ada hubungannya dengan % di bawahnya.
  //
  // Catatan: _total (dari rowTotal) tetap dihitung karena dipakai oleh
  // comparisonExport.js sebagai kolom "Total" di file Excel — di sana Σ semua
  // periode memang kontekstual dan bermanfaat untuk analisis.
  const kpiRows = useMemo(() => {
    const withTotal = rowTotal(matrix.rows, metric);
    return withTotal
      .map((r) => {
        // Pasangan {v, label} untuk sel yang ADA datanya, urut kronologis sesuai
        // urutan periode di picker. Label dipakai utk sub-caption periode di kartu.
        const pairs = r.cells
          .map((c, idx) => {
            if (!c.exists) return null;
            let v;
            if (metric === "qty") v = r.qtyByPeriod && r.qtyByPeriod[idx] ? r.qtyByPeriod[idx].qty : null;
            else if (metric === "ach") v = c.ach;
            else if (metric === "deviasi") v = c.deviasi;
            else if (metric === "ao") v = c.ao;
            else v = c.value;
            if (v === null || v === undefined || Number.isNaN(v)) return null;
            return { v, label: c.period?.label };
          })
          .filter(Boolean);
        const vals = pairs.map((p) => p.v);
        const last = pairs.length ? pairs[pairs.length - 1] : null;
        const growth = computeBaseGrowth(vals, comparisonBase).growth;
        return {
          ...r,
          _current: last ? last.v : null,
          _currentPeriodLabel: last ? last.label : null,
          growth,
        };
      })
      .sort((a, b) => (b._current ?? -Infinity) - (a._current ?? -Infinity));
  }, [matrix.rows, metric, comparisonBase]);

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

  // ---- GATE "pilih dulu" khusus mode OUTLET ----
  // Mode sales/grup: jumlah entitas kecil (5–20), aman menampilkan semua sbg
  // view awal saat user belum memilih (kpiRows.length >= 2 cukup).
  // Mode outlet: jumlahnya bisa ratusan/ribuan. Kalau auto-tampilkan semua,
  // KPI cards + chart + table langsung dirender utk semua outlet → UI freeze
  // ratusan ms-detik. Solusi: mode outlet WAJIB user pilih minimal 2 outlet
  // sebelum apa pun dirender. Empty-state existing sudah menyampaikan pesan ini.
  const ready = periods.length >= 2 && (
    mode === "outlet"
      ? selectedEntities.length >= 2
      : kpiRows.length >= 2
  );

  // Rentang label untuk subtitle export (dari periode pertama & terakhir).
  const rangeLabel = periods.length
    ? `${periods[0].label} — ${periods[periods.length - 1].label}`
    : "";

  const handleExport = async () => {
    if (!ready || exportBusy) return;
    setExportBusy(true);
    try {
      let chartImage = null;
      try {
        chartImage = chartRef.current ? await captureChartImage(chartRef.current, colors.surface) : null;
      } catch (e) {
        console.error("Gagal menangkap grafik:", e);
      }
      // ⚠️ Sprint 5 / S3: lazy-load comparisonExport.js (~620KB) saat user klik Export.
      const { exportComparisonExcel } = await import("../utils/comparisonExport.js");
      exportComparisonExcel(kpiRows, periods, {
        depotName: depotName || "DEPO LOTIM",
        mode,
        metricKey: metric,
        metricLabel,
        rangeLabel,
        chartImage,
      });
      await notifyExportSuccess("Export berhasil", `Perbandingan ${metricLabel}`);
    } catch (e) {
      console.error("Gagal export perbandingan:", e);
    } finally {
      setExportBusy(false);
    }
  };

  return (
    <div className="sm-page-enter">
      <SectionTitle title="Perbandingan" sub="Bandingkan entitas (sales / grup / outlet) lintas periode pilihan Anda" icon={GitCompareArrows} colors={colors} accent={colors.violet} />

      {/* Mode selector — wrapper relative z-10: dropdown MultiSelect entitas
          harus tetap di atas konten di bawahnya (card Periode dll), TAPI tidak
          boleh menutupi dropdown FilterBar global di atas (z-20/z-30). */}
      <div className="relative z-10 flex flex-wrap items-center gap-2 mb-4">
        <div className="flex p-1 rounded-xl" style={{ background: colors.glassSubtle, border: `1px solid ${colors.glassBorder}` }}>
          {MODES.map((m) => {
            const Icon = m.icon;
            const on = mode === m.key;
            return (
              <button key={m.key} onClick={() => setMode(m.key)}
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
          onChange={updateSelectedEntities}
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
          <div className="text-xs uppercase tracking-wider font-semibold mt-4 mb-2" style={{ color: colors.textMuted }}>Pembanding Growth</div>
          <BaseSelector value={comparisonBase} onChange={onBaseChange || (() => {})} colors={colors} />
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
              : mode === "outlet" && selectedEntities.length < 2
                ? `Pilih minimal 2 outlet untuk membandingkan (terpilih ${selectedEntities.length}). Karena jumlah outlet bisa sangat banyak, daftar tidak dimuat otomatis.`
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
                value={r._current}
                periodLabel={r._currentPeriodLabel}
                growth={r.growth}
                isMoney={metricMeta.money}
                isPct={metricMeta.pct}
                accent={pickColor(null, i)}
                colors={colors}
              />
            ))}
          </div>

          {/* Bar chart */}
          <div className="sm-card p-5 mb-5 sm-fadeup" ref={chartRef}>
            <div className="flex items-center justify-between mb-3">
              <div className="text-xs uppercase tracking-wider" style={{ color: colors.textMuted }}>
                {metricLabel} per Periode
              </div>
              <button onClick={handleExport} disabled={exportBusy}
                className="sm-btn inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
                style={{ background: colors.glassFill, border: `1px solid ${colors.glassBorder}`, color: colors.mint }}>
                <Download size={14} /> {exportBusy ? "Menyiapkan..." : "Export Excel"}
              </button>
            </div>
            <GroupedBarChart data={chartData} periods={periods} periodColor={pickColor} metricKey={metric} isMoney={metricMeta.money} isPct={metricMeta.pct} colors={colors} />
          </div>
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
