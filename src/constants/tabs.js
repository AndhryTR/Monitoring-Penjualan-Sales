import {
  LayoutDashboard, UserRound, Boxes, Crosshair, Store, ClipboardList,
} from "lucide-react";

/* ============================================================================
   APP TABS
   Definisi 6 tab utama dashboard. shortLabel dipakai di bottom navigation
   mobile (H6), label dipakai di top tab bar desktop. Ikon dari lucide-react.
============================================================================ */
export const TABS = [
  { key: "main",    label: "Main Report",     shortLabel: "Main",    icon: LayoutDashboard },
  { key: "sales",   label: "Sales Report",    shortLabel: "Sales",   icon: UserRound },
  { key: "product", label: "Product Report",  shortLabel: "Produk",  icon: Boxes },
  { key: "focus",   label: "Product Focus",   shortLabel: "Fokus",   icon: Crosshair },
  { key: "outlet",  label: "Analisis Outlet", shortLabel: "Outlet",  icon: Store },
  { key: "quality", label: "Catatan Data",    shortLabel: "Catatan", icon: ClipboardList },
];
