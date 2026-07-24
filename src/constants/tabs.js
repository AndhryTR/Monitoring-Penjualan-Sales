import {
  LayoutDashboard, UserRound, Boxes, Crosshair, Store, ClipboardList, TrendingUp, Receipt,
  History, Settings, Gauge,
} from "lucide-react";

/* ============================================================================
   APP TABS
   Definisi tab dashboard. shortLabel dipakai di bottom navigation mobile,
   label dipakai di top tab bar desktop. Ikon dari lucide-react.

   group:
   - "primary" → selalu terlihat langsung di bottom nav mobile
   - "more"    → dikelompokkan di menu "Lainnya" (mobile) supaya nav tidak sesak

   Catatan: TABS/PRIMARY_TABS/MORE_TABS ini KHUSUS MOBILE (bottom nav) — desktop
   sekarang pakai SIDEBAR_SECTIONS di bawah (sidebar kiri, bukan tab bar lagi).
============================================================================ */
export const TABS = [
  { key: "executive",    label: "Executive Summary", shortLabel: "Ringkasan", icon: Gauge,           group: "primary" },
  { key: "main",         label: "Main Report",      shortLabel: "Main",      icon: LayoutDashboard, group: "primary" },
  { key: "sales",        label: "Sales Report",     shortLabel: "Sales",     icon: UserRound,       group: "primary" },
  { key: "product",      label: "Product Report",   shortLabel: "Produk",    icon: Boxes,           group: "primary" },
  { key: "focus",        label: "Product Focus",    shortLabel: "Fokus",     icon: Crosshair,       group: "more" },
  { key: "outlet",       label: "Analisis Outlet",  shortLabel: "Outlet",    icon: Store,           group: "more" },
  { key: "trend",        label: "Tren Periode",     shortLabel: "Tren",      icon: TrendingUp,      group: "more" },
  { key: "transactions", label: "Transaksi",        shortLabel: "Transaksi", icon: Receipt,         group: "more" },
  { key: "quality",      label: "Catatan Data",     shortLabel: "Catatan",   icon: ClipboardList,   group: "more" },
];

export const PRIMARY_TABS = TABS.filter((t) => t.group === "primary");
export const MORE_TABS = TABS.filter((t) => t.group === "more");

/* ============================================================================
   SIDEBAR SECTIONS (desktop, md: ke atas)
   Item dengan `tabKey` = pindah activeTab (halaman biasa). Item dengan
   `action` = bukan tab, tapi trigger modal (Riwayat/Pengaturan) — ditangani
   khusus di komponen Sidebar, bukan lewat setActiveTab.
============================================================================ */
export const SIDEBAR_SECTIONS = [
  {
    label: "Dashboard",
    items: [
      { key: "executive", label: "Executive Summary", icon: Gauge, tabKey: "executive" },
      { key: "main", label: "Main Report", icon: LayoutDashboard, tabKey: "main" },
      { key: "sales", label: "Sales Report", icon: UserRound, tabKey: "sales" },
      { key: "product", label: "Product Report", icon: Boxes, tabKey: "product" },
      { key: "focus", label: "Product Focus", icon: Crosshair, tabKey: "focus" },
    ],
  },
  {
    label: "Analisis",
    items: [
      { key: "outlet", label: "Analisis Outlet", icon: Store, tabKey: "outlet" },
      { key: "trend", label: "Tren Periode", icon: TrendingUp, tabKey: "trend" },
      { key: "transactions", label: "Transaksi", icon: Receipt, tabKey: "transactions" },
    ],
  },
  {
    label: "Data",
    items: [
      { key: "quality", label: "Catatan Data", icon: ClipboardList, tabKey: "quality" },
    ],
  },
  {
    label: "Tools",
    items: [
      { key: "history", label: "Riwayat", icon: History, action: "history" },
      { key: "settings", label: "Pengaturan", icon: Settings, action: "settings" },
    ],
  },
];
