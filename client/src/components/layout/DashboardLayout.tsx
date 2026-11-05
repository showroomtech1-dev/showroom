import { useEffect, useState } from "react"
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom"
import {
  Building2,
  Clock,
  LogOut,
  Menu,
  Moon,
  ShoppingCart,
  Sun,
  User as UserIcon,
} from "lucide-react"
import { toast } from "sonner"
import { useAuth } from "@/contexts/AuthContext"
import { useTheme } from "@/contexts/ThemeContext"
import { usePersistedState } from "@/hooks/usePersistedState"
import { connectRealtime, disconnectRealtime, reportPage } from "@/lib/socket"
import { useBranches } from "@/hooks/useOrganization"
import { useClockInOut, useTodayAttendance } from "@/hooks/useEmployees"
import { AppSidebar } from "./AppSidebar"
import { NotificationBell } from "./NotificationBell"
import { OfflineSalesBanner } from "./OfflineSalesBanner"
import { PreviewBanner } from "./PreviewBanner"
import { PwaInstallButton } from "./PwaInstallButton"
import { Button } from "@/components/ui/button"
import { Select } from "@/components/ui/select"

export function DashboardLayout() {
  const { user, actualUser, can, selectedBranchId, setSelectedBranchId, logout } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const navigate = useNavigate()
  const location = useLocation()

  // Live presence: connected while signed in, reconnects when a different user signs in.
  useEffect(() => {
    if (!actualUser?.id) return
    connectRealtime()
    return () => disconnectRealtime()
  }, [actualUser?.id])

  useEffect(() => {
    reportPage(location.pathname)
  }, [location.pathname])
  const [collapsed, setCollapsed] = usePersistedState("sidebar_collapsed", false)
  const [mobileOpen, setMobileOpen] = useState(false)

  const canAllBranches = can("branch.all")
  const canClock = can("attendance.clock")
  const { data: branches = [] } = useBranches(false)
  const { data: todayAttendance } = useTodayAttendance(canClock)
  const clockMutation = useClockInOut()

  const handleClock = async () => {
    const action = todayAttendance && !todayAttendance.clockOutAt ? "out" : "in"
    try {
      await clockMutation.mutateAsync({ action })
      toast.success(action === "in" ? "Clocked in for today" : "Clocked out for today")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Clock action failed")
    }
  }

  return (
    <div className="min-h-screen bg-slate-50/70 dark:bg-slate-950 flex flex-col">
      <div className="flex flex-1">
        <AppSidebar
          collapsed={collapsed}
          onToggleCollapse={() => setCollapsed((c) => !c)}
          mobileOpen={mobileOpen}
          onCloseMobile={() => setMobileOpen(false)}
          onOpenMobile={() => setMobileOpen(true)}
        />

        <div className="flex flex-1 flex-col min-w-0 pb-20 lg:pb-6">
          <PreviewBanner />
          <OfflineSalesBanner />

          {/* Sticky Top Bar */}
          <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-3 border-b border-slate-200/80 bg-white/90 px-4 sm:px-6 backdrop-blur-md dark:border-slate-800/80 dark:bg-slate-900/90">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <button
                type="button"
                onClick={() => setMobileOpen(true)}
                className="flex lg:hidden h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-600 dark:border-slate-800 dark:text-slate-300 cursor-pointer"
                aria-label="Open menu"
                data-cy="mobile-sidebar-trigger"
              >
                <Menu className="h-4 w-4" />
              </button>

              {/* Branch Selector */}
              {canAllBranches && branches.length > 0 ? (
                <div className="min-w-0 flex-1 sm:w-56 sm:flex-none">
                  <Select
                    value={selectedBranchId}
                    onChange={(e) => setSelectedBranchId(e.target.value)}
                    data-cy="global-branch-selector"
                    icon={<Building2 className="h-3.5 w-3.5" />}
                    className="h-9 rounded-xl border-slate-200/90 bg-slate-50/90 px-3 py-1.5 text-xs font-semibold shadow-2xs dark:border-slate-800 dark:bg-slate-800/70"
                    options={[
                      { value: "", label: "All Branches" },
                      ...branches.map((b) => ({
                        value: b.id,
                        label: b.name,
                        badge: b.isMain ? "Main" : undefined,
                      })),
                    ]}
                  />
                </div>
              ) : user?.branchName ? (
                <div className="flex items-center gap-1.5 rounded-xl bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                  <Building2 className="h-3.5 w-3.5 text-indigo-500" />
                  <span className="truncate max-w-[140px]">{user.branchName}</span>
                </div>
              ) : null}
            </div>

            <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
              <PwaInstallButton />

              {/* Quick POS button on desktop/tablet */}
              {can("sale.create") && (
                <Button
                  size="sm"
                  variant="emerald"
                  onClick={() => navigate("/pos")}
                  className="hidden sm:inline-flex"
                  data-cy="header-pos-btn"
                >
                  <ShoppingCart className="h-3.5 w-3.5" />
                  Open POS
                </Button>
              )}

              {/* Quick Clock-in / Clock-out pill */}
              {canClock && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleClock}
                  disabled={clockMutation.isPending || Boolean(todayAttendance?.clockOutAt)}
                  className="hidden md:inline-flex"
                  data-cy="header-clock-btn"
                >
                  <Clock className="h-3.5 w-3.5 text-indigo-500" />
                  {!todayAttendance
                    ? "Clock In"
                    : !todayAttendance.clockOutAt
                    ? "Clock Out"
                    : "Shift Done"}
                </Button>
              )}

              <NotificationBell />

              <button
                type="button"
                onClick={toggleTheme}
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 cursor-pointer"
                aria-label="Toggle theme"
                data-cy="theme-toggle"
              >
                {theme === "dark" ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4" />}
              </button>

              <Link
                to="/profile"
                className="flex items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800"
                data-cy="header-profile-link"
              >
                <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-indigo-100 text-xs font-bold text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                  {user?.name?.charAt(0).toUpperCase() || <UserIcon className="h-3.5 w-3.5" />}
                </div>
                <div className="hidden md:block text-left">
                  <p className="text-xs font-bold leading-none text-slate-900 dark:text-slate-100 truncate max-w-[110px]">
                    {user?.name}
                  </p>
                  <p className="text-[10px] font-medium text-slate-500 dark:text-slate-400">{user?.roleName}</p>
                </div>
              </Link>

              <button
                type="button"
                onClick={async () => {
                  await logout()
                  navigate("/login")
                }}
                title="Sign out"
                data-cy="header-logout-btn"
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-rose-600 hover:bg-rose-50 dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-rose-950/30 cursor-pointer"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </header>

          {/* Main Workspace */}
          <main className="min-w-0 flex-1 px-4 py-5 sm:px-6 lg:px-8 max-w-[1600px] w-full mx-auto">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  )
}
