import { useState } from "react"
import { useParams } from "react-router-dom"
import { Download, FileText, Printer, Store } from "lucide-react"
import { getPublicApiUrl } from "@/transport/http"
import { Button } from "@/components/ui/button"

export default function PublicReceiptPage() {
  const { token } = useParams<{ token: string }>()
  const [size, setSize] = useState<"thermal" | "a4">("thermal")

  const pdfUrl = getPublicApiUrl(`/api/v1/public/receipts/${token}?size=${size}`)

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 flex flex-col">
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-600 text-white">
            <Store className="h-4 w-4" />
          </div>
          <div>
            <p className="text-sm font-bold text-slate-900 dark:text-white">Customer Digital Receipt</p>
            <p className="text-[11px] text-slate-500">Verified ShowroomPro Receipt</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={size === "thermal" ? "default" : "outline"}
            size="sm"
            onClick={() => setSize("thermal")}
            data-cy="receipt-size-thermal"
          >
            <Printer className="h-3.5 w-3.5" />
            Thermal (80mm)
          </Button>
          <Button
            variant={size === "a4" ? "default" : "outline"}
            size="sm"
            onClick={() => setSize("a4")}
            data-cy="receipt-size-a4"
          >
            <FileText className="h-3.5 w-3.5" />
            A4 Invoice
          </Button>
          <a
            href={pdfUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-8 items-center gap-1.5 rounded-xl bg-emerald-600 px-3 text-xs font-semibold text-white hover:bg-emerald-700"
          >
            <Download className="h-3.5 w-3.5" />
            Open PDF
          </a>
        </div>
      </header>

      <div className="flex-1 p-4 flex justify-center">
        <iframe
          title="Customer Receipt PDF"
          src={pdfUrl}
          className="w-full max-w-4xl min-h-[82vh] rounded-2xl border border-slate-200 bg-white shadow-lg dark:border-slate-800"
        />
      </div>
    </div>
  )
}
