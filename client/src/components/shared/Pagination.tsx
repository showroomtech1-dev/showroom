import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { PaginationMeta } from "@/types/api.types"

interface PaginationProps {
  meta?: PaginationMeta
  page?: number
  onPageChange: (page: number) => void
}

export function Pagination({ meta, page, onPageChange }: PaginationProps) {
  if (!meta || meta.totalPages <= 1) return null
  const currentPage = page ?? meta.page

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-slate-200/80 px-4 py-3 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
      <div>
        Showing page <span className="font-semibold text-slate-900 dark:text-slate-100">{meta.page}</span> of{" "}
        <span className="font-semibold text-slate-900 dark:text-slate-100">{meta.totalPages}</span>{" "}
        <span className="text-slate-400">({meta.total.toLocaleString()} records)</span>
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={!meta.hasPrev || currentPage <= 1}
          onClick={() => onPageChange(currentPage - 1)}
          data-cy="pagination-prev"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          Prev
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={!meta.hasNext || currentPage >= meta.totalPages}
          onClick={() => onPageChange(currentPage + 1)}
          data-cy="pagination-next"
        >
          Next
          <ChevronRight className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  )
}
