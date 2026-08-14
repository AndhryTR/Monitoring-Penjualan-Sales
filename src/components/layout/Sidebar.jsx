import { ChevronsLeft, ChevronsRight } from "lucide-react";
import { SIDEBAR_SECTIONS } from "../../constants/tabs.js";
import { DepotSwitcher } from "../modals/DepotSwitcher.jsx";

const WIDTH_EXPANDED = 240;
const WIDTH_COLLAPSED = 68;

/* ============================================================================
   SIDEBAR (desktop, md: ke atas)
   Menggantikan tab bar horizontal lama sepenuhnya untuk desktop. Mobile TIDAK
   memakai komponen ini sama sekali — tetap pakai MobileBottomNav yang lama
   (lihat komentar di constants/tabs.js). Collapsible: lebar berubah antara
   WIDTH_EXPANDED/WIDTH_COLLAPSED, status disimpan di parent (persist ke
   localStorage lewat saveSettings, sama seperti tema/filter/dll).

   ⚠️ Sprint 18 / Multi-Depo: DepotSwitcher ditaruh di header sidebar (di atas
   brand logo) supaya user bisa ganti depo dengan cepat tanpa buka Settings.
   Compact mode: switcher render hanya kode depo singkat.
============================================================================ */
export function Sidebar({ activeTab, onChangeTab, collapsed, onToggleCollapse, onOpenHistory, onOpenSettings, historyDisabled, colors,
  // ⚠️ Sprint 18: multi-depo props
  depots, activeDepotId, onSelectDepot, onAddDepot, onDeleteDepot }) {
  const width = collapsed ? WIDTH_COLLAPSED : WIDTH_EXPANDED;

  const handleItemClick = (item) => {
    if (item.action === "history") { onOpenHistory(); return; }
    if (item.action === "settings") { onOpenSettings(); return; }
    onChangeTab(item.tabKey);
  };

  const isItemActive = (item) => item.tabKey && item.tabKey === activeTab;
  const isItemDisabled = (item) => item.action === "history" && historyDisabled;

  return (
    <aside
      // ⚠️ Sprint 18d: sidebar kembali ke posisi semula — sejajar dengan header
      // di kolom kanan (sticky top-4, margin-left 16px, margin-top 16px). Sebelumnya
      // pernah dipindah ke bawah header (full-width layout), tapi user prefer
      // sidebar di kiri. Brand logo di sidebar dihapus karena sudah ada di header
      // utama — sekarang langsung DepotSwitcher + nav sections.
      className="hidden md:flex flex-col shrink-0 sticky top-4 transition-all duration-300 ease-out sm-sidebar-glass"
      style={{ width, height: "calc(100vh - 2rem)", marginLeft: "16px", marginTop: "16px", borderRadius: "20px" }}
    >
      {/* Depot Switcher — di paling atas supaya selalu terlihat */}
      {depots && activeDepotId && onSelectDepot && (
        <div className="px-3 pt-3 shrink-0">
          <DepotSwitcher
            depots={depots}
            activeDepotId={activeDepotId}
            onSelect={onSelectDepot}
            onAddDepot={onAddDepot}
            onDeleteDepot={onDeleteDepot}
            colors={colors}
            compact={collapsed}
          />
        </div>
      )}

      {/* ⚠️ Sprint 18d / Header Redesign: brand logo "Monitoring Sales"
          dihapus dari sidebar karena sudah ada di header utama (glass card
          full-width). Sekarang sidebar langsung dimulai dengan nav sections.
          DepotSwitcher tetap di paling atas (jika ada), lalu nav sections. */}

      <nav className="flex-1 overflow-y-auto px-2.5 pb-3 pt-2">
        {SIDEBAR_SECTIONS.map((section) => (
          <div key={section.label} className="mb-4">
            {collapsed ? (
              <div className="mx-1.5 my-2 border-t" style={{ borderColor: colors.glassBorder }} />
            ) : (
              <div className="px-2.5 mb-1.5 text-[10px] font-semibold uppercase tracking-wider" style={{ color: colors.textMuted, letterSpacing: "0.06em" }}>
                {section.label}
              </div>
            )}
            <div className="flex flex-col gap-0.5">
              {section.items.map((item) => {
                const Icon = item.icon;
                const active = isItemActive(item);
                const disabled = isItemDisabled(item);
                return (
                  <button
                    key={item.key}
                    onClick={() => !disabled && handleItemClick(item)}
                    disabled={disabled}
                    title={collapsed ? item.label : undefined}
                    className="sm-row flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm font-medium text-left disabled:opacity-40 disabled:cursor-not-allowed"
                    style={{
                      background: active ? colors.mint + "1F" : "transparent",
                      color: active ? colors.mint : colors.text,
                      borderLeft: `2px solid ${active ? colors.mint : "transparent"}`,
                      boxShadow: active ? `0 0 16px ${colors.mint}33` : "none",
                      justifyContent: collapsed ? "center" : "flex-start",
                    }}
                  >
                    <Icon size={16} className="shrink-0" />
                    {!collapsed && <span className="truncate">{item.label}</span>}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Toggle collapse — di bawah sidebar, pola umum (mirip VSCode/Notion) */}
      <button
        onClick={onToggleCollapse}
        title={collapsed ? "Perluas sidebar" : "Ciutkan sidebar"}
        className="sm-row flex items-center gap-2.5 px-4 py-3 text-sm shrink-0"
        style={{ color: colors.textMuted, borderTop: `1px solid ${colors.glassBorder}`, justifyContent: collapsed ? "center" : "flex-start" }}
      >
        {collapsed ? <ChevronsRight size={16} /> : <><ChevronsLeft size={16} /> <span>Ciutkan</span></>}
      </button>
    </aside>
  );
}
