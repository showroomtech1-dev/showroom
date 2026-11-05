import { NavLink, useLocation } from "react-router-dom"
import { ChevronLeft, ChevronRight, Menu, Store, X } from "lucide-react"
import { useAuth } from "@/contexts/AuthContext"
import { NAV_SECTIONS } from "./nav"
import { cn } from "@/lib/utils"

interface AppSidebarProps {
  collapsed: boolean
  onToggleCollapse: () => void
  mobileOpen: boolean
  onCloseMobile: () => void
  onOpenMobile: () => void
}

export function AppSidebar({
  collapsed,
  onToggleCollapse,
  mobileOpen,
  onCloseMobile,
  onOpenMobile,
}: AppSidebarProps) {
  const { canAny, business } = useAuth()
  const location = useLocation()

  const visibleSections = NAV_SECTIONS.map((sec) => ({
    ...sec,
    items: sec.items.filter((item) => !item.anyOf || canAny(item.anyOf)),
  })).filter((sec) => sec.items.length > 0)

  const mobilePrimaryItems = visibleSections
    .flatMap((s) => s.items)
    .filter((i) => i.mobilePrimary)
    .slice(0, 4)

  const renderNavContent = (isCollapsed: boolean, isMobile = false) => (
    <div className="flex h-full flex-col bg-slate-900 text-slate-200 dark:bg-slate-950 border-r border-slate-800">
      {/* Brand header */}
      <div className="flex h-16 items-center justify-between border-b border-slate-800/80 px-4">
        <div className="flex items-center gap-3 min-w-0">
          {business?.logoUrl ? (
            <img src={business.logoUrl} alt={business.name} className="h-9 w-9 rounded-xl object-cover shrink-0" />
          ) : (
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-md shadow-indigo-500/20">
              <Store className="h-5 w-5" />
            </div>
          )}
          {!isCollapsed && (
            <div className="min-w-0">
              <p className="truncate text-sm font-extrabold tracking-tight text-white">
                {business?.name || "ShowroomPro"}
              </p>
              <p className="truncate text-[11px] font-medium text-slate-400">Retail & POS ERP</p>
            </div>
          )}
        </div>
        {isMobile ? (
          <button
            type="button"
            onClick={onCloseMobile}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        ) : (
          <button
            type="button"
            onClick={onToggleCollapse}
            className="hidden lg:flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white cursor-pointer"
            title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
        )}
      </div>

      {/* Nav Links */}
      <div className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
        {visibleSections.map((section) => (
          <div key={section.title} className="space-y-1">
            {!isCollapsed && (
              <p className="px-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                {section.title}
              </p>
            )}
            {section.items.map((item) => {
              const Icon = item.icon
              const active = location.pathname === item.path || location.pathname.startsWith(`${item.path}/`)
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  onClick={() => isMobile && onCloseMobile()}
                  data-cy={`nav-${item.path.replace("/", "")}`}
                  className={cn(
                    "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-semibold transition-all",
                    active
                      ? "bg-indigo-600 text-white shadow-sm shadow-indigo-500/30"
                      : "text-slate-400 hover:bg-slate-800/70 hover:text-slate-100",
                    isCollapsed && "justify-center px-2"
                  )}
                  title={isCollapsed ? item.label : undefined}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {!isCollapsed && <span className="flex-1 truncate">{item.label}</span>}
                  {!isCollapsed && item.badge && (
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[10px] font-bold",
                        active ? "bg-white/20 text-white" : "bg-indigo-500/20 text-indigo-300"
                      )}
                    >
                      {item.badge}
                    </span>
                  )}
                </NavLink>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )

  return (
    <>
      {/* Desktop Sidebar */}
      <aside
        className={cn(
          "hidden lg:block shrink-0 transition-all duration-200",
          collapsed ? "w-18" : "w-64"
        )}
      >
        <div className={cn("fixed inset-y-0 left-0 z-30", collapsed ? "w-18" : "w-64")}>
          {renderNavContent(collapsed, false)}
        </div>
      </aside>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs" onClick={onCloseMobile} />
          <div className="fixed inset-y-0 left-0 w-72 max-w-[85vw] shadow-2xl">
            {renderNavContent(false, true)}
          </div>
        </div>
      )}

      {/* Mobile Sticky Bottom Navigation Bar */}
      <nav className="fixed bottom-0 inset-x-0 z-40 flex h-16 items-center justify-around border-t border-slate-200 bg-white/95 px-2 backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/95 lg:hidden">
        {mobilePrimaryItems.map((item) => {
          const Icon = item.icon
          const active = location.pathname === item.path || location.pathname.startsWith(`${item.path}/`)
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={cn(
                "flex flex-col items-center justify-center gap-1 rounded-xl px-3 py-1.5 text-[11px] font-semibold transition-colors",
                active
                  ? "text-indigo-600 dark:text-indigo-400"
                  : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
              )}
            >
              <Icon className="h-5 w-5" />
              <span className="truncate max-w-[68px]">{item.label.split(" ")[0]}</span>
            </NavLink>
          )
        })}
        <button
          type="button"
          onClick={onOpenMobile}
          className="flex flex-col items-center justify-center gap-1 rounded-xl px-3 py-1.5 text-[11px] font-semibold text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 cursor-pointer"
          data-cy="mobile-menu-more"
        >
          <Menu className="h-5 w-5" />
          <span>Menu</span>
        </button>
      </nav>
    </>
  )
}
