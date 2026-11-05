import { CheckCircle2, ExternalLink, FileText, MessageCircle, Printer } from "lucide-react"
import { toast } from "sonner"
import { Dialog } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { SaleEndpoints } from "@/endpoints/sale.endpoints"
import { useShareSale } from "@/hooks/useSales"
import { formatMoney } from "@/lib/money"
import type { SaleCreatedResult } from "@/types/sale.types"

interface PosReceiptDialogProps {
  open: boolean
  result: SaleCreatedResult | null
  onClose: () => void
}

export function PosReceiptDialog({ open, result, onClose }: PosReceiptDialogProps) {
  const shareMutation = useShareSale()

  if (!result) return null
  const { sale, changeDue, creditApplied } = result

  const handleWhatsAppShare = async () => {
    try {
      const data = await shareMutation.mutateAsync(sale.id)
      window.open(data.whatsappUrl, "_blank", "noopener,noreferrer")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not generate WhatsApp link")
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Sale Completed"
      description={`Receipt ${sale.code} recorded successfully`}
      maxWidth="max-w-md"
    >
      <div className="space-y-4">
        <div className="flex flex-col items-center justify-center rounded-xl bg-emerald-50 p-5 text-center dark:bg-emerald-950/30">
          <CheckCircle2 className="h-10 w-10 text-emerald-600 dark:text-emerald-400" />
          <p className="mt-2 text-xs font-medium uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
            Total Charged
          </p>
          <p className="mt-0.5 text-2xl font-bold text-slate-900 dark:text-slate-100">
            {formatMoney(sale.total)}
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Paid: {formatMoney(sale.amountPaid)}
            {sale.balanceDue > 0 ? ` • Balance Due: ${formatMoney(sale.balanceDue)}` : ""}
          </p>
        </div>

        {(changeDue > 0 || creditApplied > 0) && (
          <div className="grid grid-cols-2 gap-2.5">
            {changeDue > 0 && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-900/50 dark:bg-amber-950/30">
                <p className="text-[11px] font-medium uppercase text-amber-700 dark:text-amber-400">
                  Change Due
                </p>
                <p className="mt-0.5 text-base font-bold text-amber-900 dark:text-amber-200">
                  {formatMoney(changeDue)}
                </p>
              </div>
            )}
            {creditApplied > 0 && (
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 dark:border-blue-900/50 dark:bg-blue-950/30">
                <p className="text-[11px] font-medium uppercase text-blue-700 dark:text-blue-400">
                  Added to Customer Tab
                </p>
                <p className="mt-0.5 text-base font-bold text-blue-900 dark:text-blue-200">
                  {formatMoney(creditApplied)}
                </p>
              </div>
            )}
          </div>
        )}

        <div className="grid grid-cols-2 gap-2.5">
          <Button
            variant="outline"
            onClick={() => SaleEndpoints.openReceiptPdf(sale.id, "thermal")}
            data-cy="pos-receipt-thermal"
          >
            <Printer className="h-4 w-4" />
            Thermal (80mm)
          </Button>
          <Button
            variant="outline"
            onClick={() => SaleEndpoints.openReceiptPdf(sale.id, "a4")}
            data-cy="pos-receipt-a4"
          >
            <FileText className="h-4 w-4" />
            A4 Invoice PDF
          </Button>
          <Button
            variant="outline"
            onClick={handleWhatsAppShare}
            disabled={shareMutation.isPending}
            data-cy="pos-receipt-whatsapp"
          >
            <MessageCircle className="h-4 w-4 text-emerald-600" />
            WhatsApp Share
          </Button>
          <Button
            variant="outline"
            onClick={() => window.open(`/r/${sale.receiptToken}`, "_blank")}
            data-cy="pos-receipt-public"
          >
            <ExternalLink className="h-4 w-4" />
            Digital Receipt
          </Button>
        </div>

        <Button className="w-full" onClick={onClose} data-cy="pos-new-sale">
          Start New Sale
        </Button>
      </div>
    </Dialog>
  )
}
