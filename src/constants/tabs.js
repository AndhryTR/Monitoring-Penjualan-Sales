import {
  LayoutDashboard, UserRound, Boxes, Crosshair, Store, ClipboardList, TrendingUp, Receipt,
  History, Settings, Gauge, GitCompareArrows, Package, ShieldCheck,
} from "lucide-react";

/* ============================================================================
   APP TABS
   Definisi tab dashboard. shortLabel dipakai di bottom navigation mobile,
   label dipakai di top tab bar desktop. Ikon dari lucide-react.

   ⚠️ Sprint 13 / MN1: sebelumnya ada split PRIMARY_TABS/MORE_TABS (group:
   "primary" vs "more") — sekarang MobileBottomNav pakai horizontal scroll
   untuk SEMUA tab, jadi split tersebut tidak terpakai lagi. Dihapus.

   Desktop pakai SIDEBAR_SECTIONS di bawah (sidebar kiri, bukan tab bar lagi).
============================================================================ */
export const TABS = [
  { key: "executive",    label: "Executive Summary", shortLabel: "Ringkasan", icon: Gauge },
  { key: "main",         label: "Main Report",      shortLabel: "Main",      icon: LayoutDashboard },
  { key: "sales",        label: "Sales Report",     shortLabel: "Sales",     icon: UserRound },
  { key: "product",      label: "Product Report",   shortLabel: "Produk",    icon: Boxes },
  { key: "focus",        label: "Product Focus",    shortLabel: "Fokus",     icon: Crosshair },
  { key: "outlet",       label: "Analisis Outlet",  shortLabel: "Outlet",    icon: Store },
  { key: "trend",        label: "Tren Periode",     shortLabel: "Tren",      icon: TrendingUp },
  { key: "compare",      label: "Perbandingan",     shortLabel: "Banding",   icon: GitCompareArrows },
  { key: "transactions", label: "Transaksi",        shortLabel: "Transaksi", icon: Receipt },
  // ⚠️ Sprint 19 / Stock Module: tab baru untuk tracking inventory
  { key: "stock",        label: "Stok Barang",      shortLabel: "Stok",      icon: Package },
  { key: "quality",      label: "Catatan Data",     shortLabel: "Catatan",   icon: ClipboardList },
];

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
      { key: "compare", label: "Perbandingan", icon: GitCompareArrows, tabKey: "compare" },
      { key: "transactions", label: "Transaksi", icon: Receipt, tabKey: "transactions" },
      // ⚠️ Sprint 19 / Stock Module
      { key: "stock", label: "Stok Barang", icon: Package, tabKey: "stock" },
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
      { key: "history", label: "Snapshot Periode", icon: History, action: "history" },
      { key: "settings", label: "Pengaturan", icon: Settings, action: "settings" },
    ],
  },
  // ⚠️ Superuser Admin Dashboard — hanya tampil di sidebar jika isSuperuser === true.
  // TIDAK ditambahkan ke TABS (tidak muncul di MobileBottomNav).
  {
    label: "Superuser",
    superuserOnly: true,
    items: [
      { key: "admin-access", label: "Admin Dashboard", icon: ShieldCheck, tabKey: "admin-access" },
    ],
  },
];
