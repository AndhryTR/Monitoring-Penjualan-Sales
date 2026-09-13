import { useMemo, useState, useCallback, useEffect } from "react";
import { fmtCompactRp, fmtCompactNum } from "../utils/formatters.js";

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

  // 1. Sales index: hanya dibangun ulang jika konfigurasi target sales berubah
  const salesIndex = useMemo(() => {
    const sales = [];
    (targets || []).forEach((t) => {
      sales.push({
        type: "sales",
        key: t.code,
        label: t.name,
        sublabel: `Kode: ${t.code} · ${t.groups?.length || 0} grup · ${t.focus?.length || 0} fokus`,
        searchTarget: (t.name + " " + t.code).toLowerCase(),
        action: { tabKey: "sales", filter: { salesCodes: [t.code] } },
      });
    });
    return sales;
  }, [targets]);

  // 2. Outlets & Products index: loop linear cepat atas rawRows, HANYA rebuild saat file data baru diunggah
  const outletsAndProductsIndex = useMemo(() => {
    const outlets = [];
    const products = [];
    if (!rawRows || !rawRows.length) return { outlets, products };

    const outletMap = new Map();
    const productMap = new Map();

    for (let i = 0; i < rawRows.length; i++) {
      const r = rawRows[i];
      // Outlet
      if (r.outletCode || r.outletName) {
        const ok = r.outletCode || r.outletName;
        let o = outletMap.get(ok);
        if (!o) {
          o = {
            name: r.outletName || r.outletCode || ok,
            code: r.outletCode || ok,
            salesCodes: new Set(),
            count: 0,
            value: 0,
          };
          outletMap.set(ok, o);
        }
        if (r.salesCode) o.salesCodes.add(r.salesCode);
        o.count++;
        o.value += (r.value || 0);
      }

      // Product
      if (r.productCode || r.productName) {
        const pk = r.productCode || r.productName;
        let p = productMap.get(pk);
        if (!p) {
          p = {
            name: r.productName || r.productCode || pk,
            code: r.productCode || pk,
            group: r.group || "-",
            count: 0,
            qty: 0,
          };
          productMap.set(pk, p);
        }
        p.count++;
        p.qty += (r.qty || 0);
      }
    }

    outletMap.forEach((o) => {
      outlets.push({
        type: "outlet",
        key: o.code,
        label: o.name,
        sublabel: `${o.count} transaksi · ${o.salesCodes.size} sales · ${fmtCompactRp(o.value)}`,
        searchTarget: (o.name + " " + o.code).toLowerCase(),
        action: { tabKey: "transactions", drilldown: { title: o.name, predicate: (row) => row.outletCode === o.code } },
      });
    });

    productMap.forEach((p) => {
      products.push({
        type: "product",
        key: p.code,
        label: p.name,
        sublabel: `Grup: ${p.group} · ${p.count} transaksi · ${fmtCompactNum(p.qty)} qty`,
        searchTarget: (p.name + " " + p.code + " " + p.group).toLowerCase(),
        action: { tabKey: "product" },
      });
    });

    return { outlets, products };
  }, [rawRows]);

  // 3. Groups index: hanya bergantung pada agg.byGroup
  const groupsIndex = useMemo(() => {
    if (!agg?.byGroup) return [];
    return agg.byGroup.map((g) => ({
      type: "group",
      key: g.name,
      label: g.name,
      sublabel: `Target: ${fmtCompactRp(g.targetValue)} · Realisasi: ${fmtCompactRp(g.realisasiValue)}`,
      searchTarget: (g.name || "").toLowerCase(),
      action: { tabKey: "product", filter: { groups: [g.name] } },
    }));
  }, [agg?.byGroup]);

  // Gabungan index pencarian
  const index = useMemo(() => ({
    sales: salesIndex,
    outlets: outletsAndProductsIndex.outlets,
    products: outletsAndProductsIndex.products,
    groups: groupsIndex,
  }), [salesIndex, outletsAndProductsIndex, groupsIndex]);

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
