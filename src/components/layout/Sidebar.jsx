import { ChevronsLeft, ChevronsRight, FileSpreadsheet } from "lucide-react";
import { SIDEBAR_SECTIONS } from "../../constants/tabs.js";

const WIDTH_EXPANDED = 240;
const WIDTH_COLLAPSED = 68;

/* ============================================================================
   SIDEBAR (desktop, md: ke atas)
   Menggantikan tab bar horizontal lama sepenuhnya untuk desktop. Mobile TIDAK
   memakai komponen ini sama sekali — tetap pakai MobileBottomNav yang lama
   (lihat komentar di constants/tabs.js). Collapsible: lebar berubah antara
   WIDTH_EXPANDED/WIDTH_COLLAPSED, status disimpan di parent (persist ke
   localStorage lewat saveSettings, sama seperti tema/filter/dll).
============================================================================ */
export function Sidebar({ activeTab, onChangeTab, collapsed, onToggleCollapse, onOpenHistory, onOpenSettings, historyDisabled, colors }) {
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
      className="hidden md:flex flex-col shrink-0 sticky top-0 h-screen transition-all duration-300 ease-out"
      style={{ width, background: colors.surface, borderRight: `1px solid ${colors.border}` }}
    >
      {/* Logo/brand kecil di atas sidebar — cuma ikon saat collapsed */}
      <div className="flex items-center gap-2.5 px-4 py-5 shrink-0 overflow-hidden">
        <div className="p-2 rounded-xl shrink-0" style={{ background: `linear-gradient(135deg, ${colors.gold}, ${colors.coral})` }}>
          <FileSpreadsheet size={16} color="#0A1120" />
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <div className="text-sm font-bold truncate" style={{ color: colors.text }}>Monitoring Sales</div>
          </div>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto px-2.5 pb-3">
        {SIDEBAR_SECTIONS.map((section) => (
          <div key={section.label} className="mb-4">
            {collapsed ? (
              <div className="mx-1.5 my-2 border-t" style={{ borderColor: colors.border }} />
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
                      background: active ? colors.gold + "14" : "transparent",
                      color: active ? colors.gold : colors.text,
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
        style={{ color: colors.textMuted, borderTop: `1px solid ${colors.border}`, justifyContent: collapsed ? "center" : "flex-start" }}
      >
        {collapsed ? <ChevronsRight size={16} /> : <><ChevronsLeft size={16} /> <span>Ciutkan</span></>}
      </button>
    </aside>
  );
}
