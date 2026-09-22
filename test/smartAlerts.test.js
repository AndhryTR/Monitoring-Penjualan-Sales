import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { computeSmartAlerts, ALERT_LEVELS } from "../src/utils/smartAlerts.js";

describe("computeSmartAlerts", () => {
  it("returns empty array when agg or filteredRows is empty", () => {
    assert.deepEqual(computeSmartAlerts({ agg: null }), []);
    assert.deepEqual(computeSmartAlerts({ agg: { filteredRows: [] } }), []);
  });

  it("detects AO coverage lag when value achievement is high but AO is lagging", () => {
    const agg = {
      filteredRows: [
        { date: "2026-05-01", salesCode: "S1" },
        { date: "2026-05-02", salesCode: "S1" },
        { date: "2026-05-03", salesCode: "S1" },
        { date: "2026-05-04", salesCode: "S1" },
        { date: "2026-05-05", salesCode: "S1" },
      ],
      bySales: [
        {
          code: "S1",
          name: "Budi",
          targetValue: 100_000_000,
          realisasiValue: 70_000_000, // 70%
          targetAo: 50,
          realisasiAo: 15, // 30% -> gap 40% (>= 25%)
          groups: [],
          focus: [],
        },
      ],
      focusRows: [],
      meta: { uniqueDays: 5, lastDate: "2026-05-05" },
    };

    const alerts = computeSmartAlerts({ agg, workDays: 25 });
    const aoAlert = alerts.find((a) => a.category === "distribution_health");
    assert.ok(aoAlert, "AO lag alert should be present");
    assert.equal(aoAlert.level, ALERT_LEVELS.WARNING);
    assert.equal(aoAlert.salesCode, "S1");
    assert.match(aoAlert.title, /Sebaran Outlet Tertinggal/);
    assert.equal(aoAlert.targetTab, "sales");
    assert.equal(aoAlert.actionLabel, "Lihat Outlet");
  });

  it("does not trigger AO coverage lag when AO and value achievement are balanced", () => {
    const agg = {
      filteredRows: [
        { date: "2026-05-01", salesCode: "S1" },
        { date: "2026-05-02", salesCode: "S1" },
        { date: "2026-05-03", salesCode: "S1" },
        { date: "2026-05-04", salesCode: "S1" },
        { date: "2026-05-05", salesCode: "S1" },
      ],
      bySales: [
        {
          code: "S1",
          name: "Budi",
          targetValue: 100_000_000,
          realisasiValue: 30_000_000, // 30%
          targetAo: 50,
          realisasiAo: 14, // 28% -> gap 2%, healthy
          groups: [],
          focus: [],
        },
      ],
      focusRows: [],
      meta: { uniqueDays: 5, lastDate: "2026-05-05" },
    };

    const alerts = computeSmartAlerts({ agg, workDays: 25 });
    const aoAlert = alerts.find((a) => a.category === "distribution_health");
    assert.equal(aoAlert, undefined, "AO lag should not trigger for balanced sales");
  });

  it("detects end-of-month run rate crunch when remaining days <= 5 and required pace is extreme", () => {
    // 21 days completed out of 25 work days -> 4 days remaining
    const dates = Array.from({ length: 21 }, (_, i) => `2026-05-${String(i + 1).padStart(2, "0")}`);
    const filteredRows = dates.map((d) => ({ date: d, salesCode: "S2" }));

    const agg = {
      filteredRows,
      bySales: [
        {
          code: "S2",
          name: "Iwan",
          targetValue: 100_000_000,
          realisasiValue: 50_000_000, // 50% ACH in 21 days (~2.38M/day). Remaining 50M in 4 days = 12.5M/day (5.25x crunch ratio -> critical)
          targetAo: 50,
          realisasiAo: 45,
          groups: [],
          focus: [],
        },
      ],
      focusRows: [],
      meta: { uniqueDays: 21, lastDate: "2026-05-21" },
    };

    const alerts = computeSmartAlerts({ agg, workDays: 25 });
    const crunchAlert = alerts.find((a) => a.category === "projection_risk");
    assert.ok(crunchAlert, "End-of-month crunch alert should be present");
    assert.equal(crunchAlert.level, ALERT_LEVELS.CRITICAL);
    assert.equal(crunchAlert.salesCode, "S2");
    assert.match(crunchAlert.title, /Risiko Beban Target Akhir Bulan/);
    assert.match(crunchAlert.message, /Sisa 4 hari kerja/);
  });

  it("triggers warning level for moderate crunch ratio (2.0x to 2.4x)", () => {
    // 20 days completed out of 25 work days -> 5 days remaining
    const dates = Array.from({ length: 20 }, (_, i) => `2026-05-${String(i + 1).padStart(2, "0")}`);
    const filteredRows = dates.map((d) => ({ date: d, salesCode: "S3" }));

    // Target 100M. Realisasi 68M in 20 days -> 3.4M/day.
    // Remaining 32M in 5 days -> 6.4M/day.
    // Ratio = 6.4 / 3.4 = 1.88 -> not quite 2.0x.
    // Let's adjust: Realisasi 65M in 20 days -> 3.25M/day.
    // Remaining 35M in 5 days -> 7M/day.
    // Ratio = 7 / 3.25 = 2.15x -> between 2.0x and 2.5x -> WARNING!
    const agg = {
      filteredRows,
      bySales: [
        {
          code: "S3",
          name: "Siti",
          targetValue: 100_000_000,
          realisasiValue: 65_000_000,
          targetAo: 50,
          realisasiAo: 40,
          groups: [],
          focus: [],
        },
      ],
      focusRows: [],
      meta: { uniqueDays: 20, lastDate: "2026-05-20" },
    };

    const alerts = computeSmartAlerts({ agg, workDays: 25 });
    const crunchAlert = alerts.find((a) => a.category === "projection_risk");
    assert.ok(crunchAlert, "End-of-month crunch alert should be present");
    assert.equal(crunchAlert.level, ALERT_LEVELS.WARNING);
  });

  it("does not trigger crunch when remaining days > 5 or target already >= 85%", () => {
    // 15 days completed out of 25 work days -> 10 days remaining (too early for crunch)
    const dates = Array.from({ length: 15 }, (_, i) => `2026-05-${String(i + 1).padStart(2, "0")}`);
    const filteredRows = dates.map((d) => ({ date: d, salesCode: "S4" }));

    const agg = {
      filteredRows,
      bySales: [
        {
          code: "S4",
          name: "Rian",
          targetValue: 100_000_000,
          realisasiValue: 30_000_000,
          targetAo: 50,
          realisasiAo: 30,
          groups: [],
          focus: [],
        },
      ],
      focusRows: [],
      meta: { uniqueDays: 15, lastDate: "2026-05-15" },
    };

    const alerts = computeSmartAlerts({ agg, workDays: 25 });
    const crunchAlert = alerts.find((a) => a.category === "projection_risk");
    assert.equal(crunchAlert, undefined, "Crunch should not trigger when > 5 days remain");
  });

  it("detects Pareto outlet concentration risk when 1 outlet represents >= 45% of sales", () => {
    const agg = {
      filteredRows: [
        { date: "2026-05-01", salesCode: "S1", outletCode: "OUT-1", outletName: "Toko Utama", value: 50_000_000 },
        { date: "2026-05-02", salesCode: "S1", outletCode: "OUT-2", outletName: "Toko Kedua", value: 25_000_000 },
        { date: "2026-05-03", salesCode: "S1", outletCode: "OUT-3", outletName: "Toko Ketiga", value: 25_000_000 },
        { date: "2026-05-04", salesCode: "S1", outletCode: "OUT-2", outletName: "Toko Kedua", value: 10_000_000 },
        { date: "2026-05-05", salesCode: "S1", outletCode: "OUT-3", outletName: "Toko Ketiga", value: 10_000_000 },
      ],
      bySales: [
        {
          code: "S1",
          name: "Budi",
          targetValue: 150_000_000,
          realisasiValue: 120_000_000, // OUT-1 has 50M out of 120M = 41.7% -> not >= 45%
          targetAo: 30,
          realisasiAo: 20,
          groups: [],
          focus: [],
        },
      ],
      focusRows: [],
      meta: { uniqueDays: 5, lastDate: "2026-05-05" },
    };

    // First test: 41.7% -> should NOT trigger
    let alerts = computeSmartAlerts({ agg, workDays: 25 });
    let concAlert = alerts.find((a) => a.category === "concentration_risk");
    assert.equal(concAlert, undefined, "Should not trigger when top outlet is < 45%");

    // Second test: bump OUT-1 to 60M out of 120M = 50% (>= 45%)
    agg.filteredRows[0].value = 60_000_000;
    agg.filteredRows[1].value = 15_000_000;
    alerts = computeSmartAlerts({ agg, workDays: 25 });
    concAlert = alerts.find((a) => a.category === "concentration_risk");
    assert.ok(concAlert, "Should trigger concentration alert when >= 45%");
    assert.equal(concAlert.level, ALERT_LEVELS.WARNING);
    assert.match(concAlert.title, /Ketergantungan Outlet Tinggi/);
    assert.match(concAlert.message, /Toko Utama/);
    assert.equal(concAlert.targetTab, "outlet");
  });

  it("detects momentum stalling when last 4 days run-rate drops >= 40% vs earlier days", () => {
    // 10 days of data: 6 earlier days (May 1-6) and 4 recent days (May 7-10)
    // Earlier: 6 days x 10M/day = 60M
    // Recent: 4 days x 3M/day = 12M (daily rate 3M vs 10M -> 70% drop, >= 40%)
    const filteredRows = [];
    for (let i = 1; i <= 6; i++) {
      filteredRows.push({
        date: `2026-05-${String(i).padStart(2, "0")}`,
        salesCode: "S1",
        outletCode: `OUT-${i}`,
        value: 10_000_000,
      });
    }
    for (let i = 7; i <= 10; i++) {
      filteredRows.push({
        date: `2026-05-${String(i).padStart(2, "0")}`,
        salesCode: "S1",
        outletCode: `OUT-${i}`,
        value: 3_000_000,
      });
    }

    const agg = {
      filteredRows,
      bySales: [
        {
          code: "S1",
          name: "Budi",
          targetValue: 120_000_000,
          realisasiValue: 72_000_000, // 60% ach
          targetAo: 30,
          realisasiAo: 25,
          groups: [],
          focus: [],
        },
      ],
      focusRows: [],
      meta: { uniqueDays: 10, lastDate: "2026-05-10" },
    };

    const alerts = computeSmartAlerts({ agg, workDays: 25 });
    const momentumAlert = alerts.find((a) => a.category === "momentum");
    assert.ok(momentumAlert, "Momentum drop alert should be present");
    assert.equal(momentumAlert.level, ALERT_LEVELS.WARNING);
    assert.match(momentumAlert.title, /Tren Penjualan Melambat/);
    assert.match(momentumAlert.tag, /Drop -70%/);
  });

  it("recognizes All-Rounder achievement when all active product groups reach >= 90%", () => {
    const agg = {
      filteredRows: [
        { date: "2026-05-01", salesCode: "S1" },
        { date: "2026-05-02", salesCode: "S1" },
        { date: "2026-05-03", salesCode: "S1" },
      ],
      bySales: [
        {
          code: "S1",
          name: "Rian",
          targetValue: 100_000_000,
          realisasiValue: 92_000_000, // 92% overall (< 100%)
          targetAo: 50,
          realisasiAo: 45,
          groups: [
            { name: "Snack", targetValue: 50_000_000, ach: 0.94 },
            { name: "Biskuit", targetValue: 50_000_000, ach: 0.90 },
          ],
          focus: [],
        },
      ],
      focusRows: [],
      meta: { uniqueDays: 3, lastDate: "2026-05-03" },
    };

    const alerts = computeSmartAlerts({ agg, workDays: 25 });
    const allRounder = alerts.find((a) => a.id === "positive-allrounder-S1");
    assert.ok(allRounder, "All-rounder alert should be generated");
    assert.equal(allRounder.level, ALERT_LEVELS.POSITIVE);
    assert.match(allRounder.title, /Penjualan Merata di Semua Kategori/);
  });

  it("recognizes AO Champion achievement when active outlet target is reached 100%+", () => {
    const agg = {
      filteredRows: [
        { date: "2026-05-01", salesCode: "S1" },
        { date: "2026-05-02", salesCode: "S1" },
        { date: "2026-05-03", salesCode: "S1" },
      ],
      bySales: [
        {
          code: "S1",
          name: "Rian",
          targetValue: 100_000_000,
          realisasiValue: 80_000_000, // 80% overall (< 100%)
          targetAo: 40,
          realisasiAo: 42, // 105% AO
          groups: [],
          focus: [],
        },
      ],
      focusRows: [],
      meta: { uniqueDays: 3, lastDate: "2026-05-03" },
    };

    const alerts = computeSmartAlerts({ agg, workDays: 25 });
    const aoChamp = alerts.find((a) => a.id === "positive-ao-champion-S1");
    assert.ok(aoChamp, "AO Champion alert should be generated");
    assert.equal(aoChamp.level, ALERT_LEVELS.POSITIVE);
    assert.match(aoChamp.title, /Target Sebaran Toko Tercapai/);
  });

  it("detects outlet churn when a key outlet hasn't ordered in >= 7 data days", () => {
    // 10 distinct days: May 1 to May 10
    const filteredRows = [];
    for (let i = 1; i <= 10; i++) {
      const d = `2026-05-${String(i).padStart(2, "0")}`;
      if (i <= 3) {
        // Toko Penting ordered only on days 1..3 (last date May 03, gap = 7 days to May 10)
        filteredRows.push({ date: d, salesCode: "S1", outletCode: "OUT-KEY", outletName: "Toko Penting", value: 15_000_000 });
      }
      // other outlets order throughout
      filteredRows.push({ date: d, salesCode: "S1", outletCode: "OUT-REG", outletName: "Toko Biasa", value: 5_000_000 });
      filteredRows.push({ date: d, salesCode: "S1", outletCode: "OUT-OTHER", outletName: "Toko Lain", value: 2_000_000 });
    }

    const agg = {
      filteredRows,
      bySales: [
        {
          code: "S1",
          name: "Budi",
          targetValue: 150_000_000,
          realisasiValue: 115_000_000,
          targetAo: 30,
          realisasiAo: 20,
          groups: [],
          focus: [],
        },
      ],
      focusRows: [],
      meta: { uniqueDays: 10, lastDate: "2026-05-10" },
    };

    const alerts = computeSmartAlerts({ agg, workDays: 25 });
    const churnAlert = alerts.find((a) => a.category === "outlet_churn");
    assert.ok(churnAlert, "Churn alert should be generated for key outlet");
    assert.equal(churnAlert.level, ALERT_LEVELS.WARNING);
    assert.match(churnAlert.title, /Toko "Toko Penting" Berhenti Order/);
    assert.match(churnAlert.tag, /Vakum 7 hari/);
  });

  it("recognizes Focus Product Champion when all focus targets reach 100%+", () => {
    const agg = {
      filteredRows: [
        { date: "2026-05-01", salesCode: "S1" },
        { date: "2026-05-02", salesCode: "S1" },
      ],
      bySales: [
        {
          code: "S1",
          name: "Budi",
          targetValue: 100_000_000,
          realisasiValue: 80_000_000, // 80% overall (< 100%)
          targetAo: 40,
          realisasiAo: 30,
          groups: [],
          focus: [
            { name: "Kopi ABC", target: 100, realisasi: 120 },
            { name: "Teh Botol", target: 50, realisasi: 55 },
          ],
        },
      ],
      focusRows: [],
      meta: { uniqueDays: 2, lastDate: "2026-05-02" },
    };

    const alerts = computeSmartAlerts({ agg, workDays: 25 });
    const focusChamp = alerts.find((a) => a.id === "positive-focus-champion-S1");
    assert.ok(focusChamp, "Focus champion alert should be generated");
    assert.equal(focusChamp.level, ALERT_LEVELS.POSITIVE);
    assert.match(focusChamp.title, /Seluruh Produk Fokus Tembus 100%!/);
    assert.match(focusChamp.tag, /Fokus 100% \(2 SKU\)/);
  });

  it("detects top shortfall contributor when one sales accounts for >= 35% of team shortfall", () => {
    // 10 days out of 25 -> timePace = 0.40
    // Total Team Target = 300M, Team Realisasi = 85M (team shortfall = 215M)
    // S1 has target 100M, realisasi 20M (shortfall 80M -> 80M / 215M = 37.2% >= 35% -> WARNING)
    const dates = Array.from({ length: 10 }, (_, i) => `2026-05-${String(i + 1).padStart(2, "0")}`);
    const filteredRows = dates.flatMap((d) => [
      { date: d, salesCode: "S1", value: 2_000_000 },
      { date: d, salesCode: "S2", value: 3_000_000 },
      { date: d, salesCode: "S3", value: 3_500_000 },
    ]);

    const agg = {
      filteredRows,
      bySales: [
        { code: "S1", name: "Andi", targetValue: 100_000_000, realisasiValue: 20_000_000, groups: [], focus: [] },
        { code: "S2", name: "Budi", targetValue: 100_000_000, realisasiValue: 30_000_000, groups: [], focus: [] },
        { code: "S3", name: "Citra", targetValue: 100_000_000, realisasiValue: 35_000_000, groups: [], focus: [] },
      ],
      focusRows: [],
      meta: { uniqueDays: 10, lastDate: "2026-05-10" },
    };

    const alerts = computeSmartAlerts({ agg, workDays: 25 });
    const shortfallAlert = alerts.find((a) => a.category === "shortfall");
    assert.ok(shortfallAlert, "Top shortfall contributor alert should be generated");
    assert.equal(shortfallAlert.level, ALERT_LEVELS.WARNING);
    assert.equal(shortfallAlert.salesCode, "S1");
    assert.match(shortfallAlert.title, /Kontributor Defisit Terbesar/);
    assert.match(shortfallAlert.tag, /Beban 37% Defisit/);
  });

  it("detects low basket size (AOV drop) when sales average order value is >= 40% below team", () => {
    // 5 distinct days data, 24 total invoices in team
    // Team has 24 invoices: 12 invoices from S1 (total 12M -> AOV 1M), 12 invoices from S2 (total 60M -> AOV 5M)
    // Total team value = 72M / 24 invoices = 3M average.
    // S1 AOV = 1M vs Team AOV 3M -> 66.7% drop (>= 40%) -> WARNING
    const filteredRows = [];
    for (let i = 1; i <= 12; i++) {
      const dayNum = ((i - 1) % 5) + 1;
      const d = `2026-05-0${dayNum}`;
      filteredRows.push({
        date: d,
        salesCode: "S1",
        invoiceNo: `INV-S1-${i}`,
        value: 1_000_000,
      });
      filteredRows.push({
        date: d,
        salesCode: "S2",
        invoiceNo: `INV-S2-${i}`,
        value: 5_000_000,
      });
    }

    const agg = {
      filteredRows,
      bySales: [
        { code: "S1", name: "Deni", targetValue: 30_000_000, realisasiValue: 12_000_000, groups: [], focus: [] },
        { code: "S2", name: "Eko", targetValue: 70_000_000, realisasiValue: 60_000_000, groups: [], focus: [] },
      ],
      focusRows: [],
      meta: { uniqueDays: 5, lastDate: "2026-05-05" },
    };

    const alerts = computeSmartAlerts({ agg, workDays: 25 });
    const aovAlert = alerts.find((a) => a.category === "basket_size");
    assert.ok(aovAlert, "Basket size alert should be generated");
    assert.equal(aovAlert.level, ALERT_LEVELS.WARNING);
    assert.equal(aovAlert.salesCode, "S1");
    assert.match(aovAlert.title, /Nilai Rata-rata Nota Rendah/);
  });
});


