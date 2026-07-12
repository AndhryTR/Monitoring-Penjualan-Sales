import {
  LayoutDashboard, UserRound, Boxes, Crosshair, Store, ClipboardList, TrendingUp, Receipt,
} from "lucide-react";

/* ============================================================================
   APP TABS
   Definisi tab dashboard. shortLabel dipakai di bottom navigation mobile,
   label dipakai di top tab bar desktop. Ikon dari lucide-react.

   group:
   - "primary" → selalu terlihat langsung di tab bar (desktop) / bottom nav (mobile)
   - "more"    → dikelompokkan di menu "Lainnya" supaya tab bar tidak sesak
============================================================================ */
export const TABS = [
  { key: "main",         label: "Main Report",     shortLabel: "Main",      icon: LayoutDashboard, group: "primary" },
  { key: "sales",        label: "Sales Report",    shortLabel: "Sales",     icon: UserRound,       group: "primary" },
  { key: "product",      label: "Product Report",  shortLabel: "Produk",    icon: Boxes,           group: "primary" },
  { key: "focus",        label: "Product Focus",   shortLabel: "Fokus",     icon: Crosshair,       group: "primary" },
  { key: "outlet",       label: "Analisis Outlet", shortLabel: "Outlet",    icon: Store,           group: "more" },
  { key: "trend",        label: "Tren Periode",    shortLabel: "Tren",      icon: TrendingUp,      group: "more" },
  { key: "transactions", label: "Transaksi",       shortLabel: "Transaksi", icon: Receipt,         group: "more" },
  { key: "quality",      label: "Catatan Data",    shortLabel: "Catatan",   icon: ClipboardList,   group: "more" },
];

export const PRIMARY_TABS = TABS.filter((t) => t.group === "primary");
export const MORE_TABS = TABS.filter((t) => t.group === "more");
