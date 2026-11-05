import { useEffect, useState } from "react"
import { Mail, Save, Send } from "lucide-react"
import { toast } from "sonner"
import { useAuth } from "@/contexts/AuthContext"
import { useSendTestEmail, useSettings, useUpdateSettings } from "@/hooks/useOrganization"
import { Button } from "@/components/ui/button"
import { Select } from "@/components/ui/select"
import type { OrganizationSettings } from "@/types/auth.types"

type EmailFlags = Pick<
  OrganizationSettings,
  "emailDigestEnabled" | "emailDigestHour" | "emailAlertsEnabled" | "emailReceiptsEnabled" | "emailDebtRemindersAuto" | "emailPayslipsEnabled"
>

const TOGGLES: Array<{ key: Exclude<keyof EmailFlags, "emailDigestHour">; title: string; detail: string }> = [
  { key: "emailDigestEnabled", title: "Daily summary", detail: "Every morning to the owner, managers and accountants: yesterday's sales, low stock, and payments, debts and bills due." },
  { key: "emailAlertsEnabled", title: "Urgent alerts", detail: "As soon as a product runs out, or a supplier payment becomes overdue (once per problem)." },
  { key: "emailReceiptsEnabled", title: "Receipts to customers", detail: "Automatically after each sale, for customers with an email address. The PDF is attached." },
  { key: "emailPayslipsEnabled", title: "Payslips to staff", detail: "When a salary is paid in full, to the employee's email. The PDF is attached." },
  { key: "emailDebtRemindersAuto", title: "Automatic debt reminders", detail: "Email a customer when their debt becomes overdue. Off by default — you can always send one from the customer's page." },
]

const HOURS = Array.from({ length: 24 }, (_, h) => ({
  value: String(h),
  label: new Date(2000, 0, 1, h).toLocaleTimeString("en-GB", { hour: "numeric", hour12: true }),
}))

export function EmailSettingsTab() {
  const { can } = useAuth()
  const settingsQuery = useSettings()
  const updateSettings = useUpdateSettings()
  const sendTest = useSendTestEmail()
  const [form, setForm] = useState<EmailFlags | null>(null)
  const editable = can("settings.manage")

  useEffect(() => {
    const s = settingsQuery.data?.settings
    if (s) {
      setForm({
        emailDigestEnabled: s.emailDigestEnabled,
        emailDigestHour: s.emailDigestHour,
        emailAlertsEnabled: s.emailAlertsEnabled,
        emailReceiptsEnabled: s.emailReceiptsEnabled,
        emailDebtRemindersAuto: s.emailDebtRemindersAuto,
        emailPayslipsEnabled: s.emailPayslipsEnabled,
      })
    }
  }, [settingsQuery.data])

  if (!form) return <p className="py-8 text-center text-xs text-slate-400">Loading email settings…</p>

  const handleSave = async () => {
    try {
      await updateSettings.mutateAsync(form)
      toast.success("Email settings saved")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save email settings")
    }
  }

  const handleTest = async () => {
    try {
      const res = await sendTest.mutateAsync()
      toast.success(`Test email sent to ${res.sentTo}. Check the inbox (and spam folder).`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "The test email could not be sent")
    }
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
      <div className="space-y-1 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 lg:col-span-8">
        <h3 className="mb-2 text-sm font-semibold">Which emails go out</h3>
        {TOGGLES.map((t) => (
          <label
            key={t.key}
            className={`flex items-start gap-3 rounded-lg p-2.5 ${editable ? "cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50" : "opacity-80"}`}
          >
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 shrink-0 accent-blue-600"
              checked={form[t.key]}
              disabled={!editable}
              onChange={(e) => setForm({ ...form, [t.key]: e.target.checked })}
              data-cy={`email-toggle-${t.key}`}
            />
            <span>
              <span className="block text-sm font-medium text-slate-900 dark:text-slate-100">{t.title}</span>
              <span className="block text-xs text-slate-500 dark:text-slate-400">{t.detail}</span>
            </span>
          </label>
        ))}
        <div className="max-w-xs px-2.5 pt-2">
          <Select
            label="Send the daily summary after"
            value={String(form.emailDigestHour)}
            disabled={!editable || !form.emailDigestEnabled}
            onChange={(e) => setForm({ ...form, emailDigestHour: Number(e.target.value) })}
            options={HOURS}
          />
        </div>
        <p className="px-2.5 pt-2 text-xs text-slate-500 dark:text-slate-400">
          Welcome emails, password reset codes and leave decisions are always sent.
        </p>
        {editable && (
          <div className="px-2.5 pt-3">
            <Button onClick={handleSave} disabled={updateSettings.isPending} data-cy="save-email-settings">
              <Save className="h-4 w-4" />
              {updateSettings.isPending ? "Saving…" : "Save Email Settings"}
            </Button>
          </div>
        )}
      </div>

      <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 lg:col-span-4">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <Mail className="h-4 w-4 text-blue-600" /> Check email works
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Sends a test email to your own address using the server's email settings (Gmail by default). If it fails, the
          message tells you what's missing.
        </p>
        {editable && (
          <Button variant="outline" className="w-full" onClick={handleTest} disabled={sendTest.isPending} data-cy="send-test-email">
            <Send className="h-4 w-4" />
            {sendTest.isPending ? "Sending…" : "Send Test Email"}
          </Button>
        )}
      </div>
    </div>
  )
}
