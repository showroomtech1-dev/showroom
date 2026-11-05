import { useState } from "react"
import { Bell, CheckCheck, RefreshCw } from "lucide-react"
import { toast } from "sonner"
import { useMarkNotificationRead, useNotifications, useUnreadNotificationCount } from "@/hooks/useOrganization"
import { OrganizationEndpoints } from "@/endpoints/organization.endpoints"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { formatDateTime } from "@/lib/utils"
import { useAuth } from "@/contexts/AuthContext"

export function NotificationBell() {
  const [open, setOpen] = useState(false)
  const [scanning, setScanning] = useState(false)
  const { canAny } = useAuth()
  const { data: unread = 0 } = useUnreadNotificationCount()
  const { data: list, refetch } = useNotifications({ page: 1, limit: 30 })
  const markRead = useMarkNotificationRead()

  const handleScan = async () => {
    setScanning(true)
    const res = await OrganizationEndpoints.scanNotifications()
    setScanning(false)
    if (res.success) {
      toast.success("Alerts refreshed")
      refetch()
    } else {
      toast.error(res.message)
    }
  }

  const notifications = list?.data ?? []

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        data-cy="notification-bell"
        className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 cursor-pointer"
        aria-label="Notifications"
      >
        <Bell className="h-4 w-4" />
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-bold text-white">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg" onClose={() => setOpen(false)}>
          <DialogHeader>
            <div className="flex items-center justify-between pr-7">
              <DialogTitle>Alerts & Notifications</DialogTitle>
              <div className="flex items-center gap-1.5">
                {canAny(["dashboard.read", "inventory.read"]) && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleScan}
                    disabled={scanning}
                    data-cy="notifications-scan"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${scanning ? "animate-spin" : ""}`} />
                    Scan
                  </Button>
                )}
                {unread > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => markRead.mutate(undefined)}
                    disabled={markRead.isPending}
                    data-cy="notifications-read-all"
                  >
                    <CheckCheck className="h-3.5 w-3.5" />
                    Read all
                  </Button>
                )}
              </div>
            </div>
          </DialogHeader>

          <div className="max-h-[65vh] space-y-2.5 overflow-y-auto pr-1">
            {notifications.length === 0 ? (
              <p className="py-10 text-center text-sm text-slate-500">All caught up! No active alerts.</p>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  onClick={() => !n.isRead && markRead.mutate(n.id)}
                  className={`rounded-xl border p-3.5 transition-colors cursor-pointer ${
                    n.isRead
                      ? "border-slate-200/70 bg-slate-50/50 dark:border-slate-800 dark:bg-slate-900/40"
                      : "border-indigo-200 bg-indigo-50/40 dark:border-indigo-900/60 dark:bg-indigo-950/30"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span
                        className={`h-2 w-2 rounded-full ${
                          n.severity === "critical"
                            ? "bg-rose-500"
                            : n.severity === "warning"
                            ? "bg-amber-500"
                            : "bg-indigo-500"
                        }`}
                      />
                      <p className="text-xs font-bold text-slate-900 dark:text-slate-100">{n.title}</p>
                    </div>
                    <span className="text-[11px] text-slate-400">{formatDateTime(n.createdAt)}</span>
                  </div>
                  {n.body && <p className="mt-1 pl-4 text-xs text-slate-600 dark:text-slate-300">{n.body}</p>}
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
