import { Loader2 } from "lucide-react"

interface TableStatusProps {
  /** Query is fetching for the first time (no data to show yet). */
  loading: boolean
  /** Query failed and there is nothing to show. */
  error?: boolean
  /** Data loaded but the list is empty. */
  empty: boolean
  /** Number of columns in the table, so the message spans the full row. */
  cols: number
  emptyText?: string
}

/**
 * Drop this as the first child of a `<tbody>`, above the rows. It renders a spinner row while the
 * first load is in flight, an error row if it failed, and an empty row when there are no records;
 * otherwise it renders nothing and the rows show as usual.
 */
export function TableStatus({ loading, error, empty, cols, emptyText = "No records found" }: TableStatusProps) {
  if (!loading && !error && !empty) return null
  return (
    <tr>
      <td colSpan={cols} className="px-4 py-10 text-center">
        {loading ? (
          <div className="flex items-center justify-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400" role="status">
            <Loader2 className="h-4 w-4 animate-spin text-indigo-600 dark:text-indigo-400" />
            Loading...
          </div>
        ) : error ? (
          <span className="text-xs font-medium text-rose-600 dark:text-rose-400">Could not load data. Try again.</span>
        ) : (
          <span className="text-xs text-slate-400">{emptyText}</span>
        )}
      </td>
    </tr>
  )
}
