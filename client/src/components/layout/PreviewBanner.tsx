import { Eye, X } from "lucide-react"
import { useAuth } from "@/contexts/AuthContext"
import { Button } from "@/components/ui/button"

export function PreviewBanner() {
  const { previewRole, exitPreview } = useAuth()
  if (!previewRole) return null

  return (
    <div className="sticky top-0 z-30 flex flex-wrap items-center justify-between gap-3 bg-amber-500 px-4 py-2 text-xs font-semibold text-slate-950 shadow-xs sm:px-6">
      <div className="flex items-center gap-2 min-w-0">
        <Eye className="h-4 w-4 shrink-0" />
        <span className="truncate">
          Role Preview Active: Viewing ShowroomPro as <strong>{previewRole.name}</strong> ({previewRole.permissions.length} permissions)
        </span>
      </div>
      <Button
        size="sm"
        variant="secondary"
        className="h-7 shrink-0 bg-slate-950 px-2.5 text-xs text-white hover:bg-slate-800"
        onClick={exitPreview}
        data-cy="exit-role-preview"
      >
        <X className="h-3.5 w-3.5" />
        Exit Preview
      </Button>
    </div>
  )
}
