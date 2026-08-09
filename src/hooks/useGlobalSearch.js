import { useMemo, useState, useCallback, useEffect, useRef } from "react";

/* ============================================================================
   useGlobalSearch — hook untuk global search / command palette.
   ⚠️ Sprint 9 / GS1: index semua data (sales, outlet, product, group) dari
   agg + rawRows, lalu expose search function yang return ranked results.

   Data sources:
   - Sales: dari `targets` (static config) — name, code, tier
   - Outlets: dari `rawRows` unique outletCode/outletName — di-index sekali
   - Products: dari `rawRows` unique productCode/productName
   - Groups: dari `agg.byGroup` — name

   Search algorithm:
   - Case-insensitive substring match
   - Priority: exact match > starts-with > contains
   - Limit results per category (default 5) untuk avoid overwhelming

   Returns:
   - results: array of { type, key, label, sublabel, action }
   - query, setQuery
   - selectedIndex, setSelectedIndex, moveUp, moveDown
============================================================================ */

const MAX_PER_CATEGORY = 5;
const MAX_TOTAL = 20;

export function useGlobalSearch({ targets, rawRows, agg }) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);

  // ---- Build search index (memoized, hanya rebuild kalau data berubah) ----
  const index = useMemo(() => {
    const sales = [];
    const outlets = [];
    const products = [];
    const groups = [];

    // Index sales dari targets (config, selalu ada walau belum upload data)
    (targets || []).forEach((t) => {
      sales.push({
        type: "sales",
        key: t.code,
        label: t.name,
        sublabel: `Kode: ${t.code} · ${t.groups.length} grup · ${t.focus.length} fokus`,
        searchTarget: (t.name + " " + t.code).toLowerCase(),
        action: { tabKey: "sales", filter: { salesCodes: [t.code] } },
      });
    });

    // Index outlets + products dari rawRows (kalau ada data)
    if (rawRows && rawRows.length) {
      const outletMap = new Map(); // key=outletCode, value={name, code, salesCodes:Set, count}
      const productMap = new Map(); // key=productCode, value={name, code, count, value}

      rawRows.forEach((r) => {
        // Outlet
        if (r.outletCode || r.outletName) {
          const ok = r.outletCode || r.outletName;
          if (!outletMap.has(ok)) {
            outletMap.set(ok, {
              name: r.outletName || r.outletCode || ok,
              code: r.outletCode || ok,
              salesCodes: new Set(),
              count: 0,
              value: 0,
            });
          }
          const o = outletMap.get(ok);
          if (r.salesCode) o.salesCodes.add(r.salesCode);
          o.count++;
          o.value += r.value || 0;
        }

        // Product
        if (r.productCode || r.productName) {
          const pk = r.productCode || r.productName;
          if (!productMap.has(pk)) {
            productMap.set(pk, {
              name: r.productName || r.productCode || pk,
              code: r.productCode || pk,
              group: r.group || "-",
              count: 0,
              qty: 0,
            });
          }
          const p = productMap.get(pk);
          p.count++;
          p.qty += r.qty || 0;
        }
      });

      outletMap.forEach((o) => {
        outlets.push({
          type: "outlet",
          key: o.code,
          label: o.name,
          sublabel: `${o.count} transaksi · ${o.salesCodes.size} sales · ${fmtRpShort(o.value)}`,
          searchTarget: (o.name + " " + o.code).toLowerCase(),
          action: { tabKey: "transactions", drilldown: { title: o.name, predicate: (row) => row.outletCode === o.code } },
        });
      });

      productMap.forEach((p) => {
        products.push({
          type: "product",
          key: p.code,
          label: p.name,
          sublabel: `Grup: ${p.group} · ${p.count} transaksi · ${fmtNumShort(p.qty)} qty`,
          searchTarget: (p.name + " " + p.code + " " + p.group).toLowerCase(),
          action: { tabKey: "product" },
        });
      });
    }

    // Index groups dari agg.byGroup
    if (agg?.byGroup) {
      agg.byGroup.forEach((g) => {
        groups.push({
          type: "group",
          key: g.name,
          label: g.name,
          sublabel: `Target: ${fmtRpShort(g.targetValue)} · Realisasi: ${fmtRpShort(g.realisasiValue)}`,
          searchTarget: (g.name || "").toLowerCase(),
          action: { tabKey: "product", filter: { groups: [g.name] } },
        });
      });
    }

    return { sales, outlets, products, groups };
  }, [targets, rawRows, agg]);

  // ---- Search function ----
  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q || q.length < 1) return [];

    const matched = [];
    const addMatches = (items) => {
      // Priority: exact > starts-with > contains
      const exact = [];
      const starts = [];
      const contains = [];

      items.forEach((item) => {
        if (item.searchTarget === q) exact.push(item);
        else if (item.searchTarget.startsWith(q)) starts.push(item);
        else if (item.searchTarget.includes(q)) contains.push(item);
      });

      [...exact, ...starts, ...contains].slice(0, MAX_PER_CATEGORY).forEach((item) => {
        matched.push(item);
      });
    };

    addMatches(index.sales);
    addMatches(index.outlets);
    addMatches(index.products);
    addMatches(index.groups);

    return matched.slice(0, MAX_TOTAL);
  }, [query, index]);

  // ---- Keyboard navigation ----
  const moveUp = useCallback(() => {
    setSelectedIndex((prev) => (prev <= 0 ? results.length - 1 : prev - 1));
  }, [results.length]);

  const moveDown = useCallback(() => {
    setSelectedIndex((prev) => (prev >= results.length - 1 ? 0 : prev + 1));
  }, [results.length]);

  // Reset selected index saat query berubah
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  return {
    query, setQuery,
    results,
    selectedIndex, setSelectedIndex,
    moveUp, moveDown,
    // Stats untuk display
    totalIndexed: index.sales.length + index.outlets.length + index.products.length + index.groups.length,
    indexStats: {
      sales: index.sales.length,
      outlets: index.outlets.length,
      products: index.products.length,
      groups: index.groups.length,
    },
  };
}

// Helper: format Rupiah singkat (mis. "Rp 12.3jt" untuk 12.300.000)
function fmtRpShort(n) {
  if (!n) return "Rp 0";
  if (n >= 1e9) return "Rp " + (n / 1e9).toFixed(1).replace(/\.0$/, "") + " M";
  if (n >= 1e6) return "Rp " + (n / 1e6).toFixed(1).replace(/\.0$/, "") + " jt";
  if (n >= 1e3) return "Rp " + (n / 1e3).toFixed(0) + " rb";
  return "Rp " + Math.round(n);
}

function fmtNumShort(n) {
  if (!n) return "0";
  if (n >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, "") + "jt";
  if (n >= 1e3) return (n / 1e3).toFixed(0) + "rb";
  return String(Math.round(n));
}
