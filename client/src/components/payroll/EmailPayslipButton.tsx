import { Mail } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/contexts/AuthContext"
import { useEmailPayslip } from "@/hooks/usePayroll"

/** Emails a payslip (PDF attached) to the employee. Shown to people who can pay salaries. */
export function EmailPayslipButton({ payslipId, variant = "outline" }: { payslipId: string; variant?: "outline" | "ghost" }) {
  const { can } = useAuth()
  const emailPayslip = useEmailPayslip()
  if (!can("payroll.pay")) return null

  const handleClick = async () => {
    try {
      const sent = await emailPayslip.mutateAsync(payslipId)
      toast.success(`Payslip emailed to ${sent.sentTo}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not email the payslip")
    }
  }

  return (
    <Button variant={variant} size="sm" onClick={handleClick} disabled={emailPayslip.isPending}>
      <Mail className="h-3.5 w-3.5" /> {emailPayslip.isPending ? "Sending…" : "Email"}
    </Button>
  )
}
