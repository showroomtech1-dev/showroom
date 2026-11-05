import { useEffect, useState } from "react"
import { Plus, Save, Trash2, Upload } from "lucide-react"
import { toast } from "sonner"
import { useAuth } from "@/contexts/AuthContext"
import {
  useBranches,
  useDeleteBranch,
  useSaveBranch,
  useSettings,
  useUpdateBusiness,
  useUpdateSettings,
  useUploadLogo,
} from "@/hooks/useOrganization"
import { fromBps, fromKobo, toBps, toKobo } from "@/lib/money"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { PhoneInput } from "@/components/ui/phone-input"
import { EmailSettingsTab } from "@/components/settings/EmailSettingsTab"
import { AuditAndTrashTab, RolesTab, SecurityPasswordTab, UsersTab } from "@/components/settings/UsersAndRolesTabs"

type SettingsTab = "general" | "email" | "branches" | "users" | "roles" | "security" | "audit"

export default function SettingsPage() {
  const { can, refreshSession } = useAuth()
  const [tab, setTab] = useState<SettingsTab>("general")
  const settingsQuery = useSettings()
  const updateBusiness = useUpdateBusiness()
  const updateSettings = useUpdateSettings()
  const uploadLogo = useUploadLogo()
  const branchesQuery = useBranches()
  const saveBranch = useSaveBranch()
  const deleteBranch = useDeleteBranch()

  const [bizName, setBizName] = useState("")
  const [bizPhone, setBizPhone] = useState("")
  const [bizEmail, setBizEmail] = useState("")
  const [bizAddress, setBizAddress] = useState("")
  const [receiptHeader, setReceiptHeader] = useState("")
  const [receiptFooter, setReceiptFooter] = useState("")
  const [taxRatePct, setTaxRatePct] = useState("0")
  const [commRatePct, setCommRatePct] = useState("0")
  const [latenessNaira, setLatenessNaira] = useState("0")

  const [branchName, setBranchName] = useState("")
  const [branchCode, setBranchCode] = useState("")
  const [branchAddress, setBranchAddress] = useState("")

  useEffect(() => {
    if (settingsQuery.data) {
      const { business, settings } = settingsQuery.data
      setBizName(business.name)
      setBizPhone(business.phone ?? "")
      setBizEmail(business.email ?? "")
      setBizAddress(business.address ?? "")
      setReceiptHeader(settings.receiptHeader ?? "")
      setReceiptFooter(settings.receiptFooter ?? "")
      setTaxRatePct(String(fromBps(settings.taxRateBps)))
      setCommRatePct(String(fromBps(settings.commissionRateBps)))
      setLatenessNaira(String(fromKobo(settings.latenessDeduction)))
    }
  }, [settingsQuery.data])

  const handleSaveIdentity = async () => {
    try {
      await updateBusiness.mutateAsync({
        name: bizName.trim(),
        phone: bizPhone.trim() || null,
        email: bizEmail.trim() || null,
        address: bizAddress.trim() || null,
      })
      await updateSettings.mutateAsync({
        receiptHeader: receiptHeader.trim() || null,
        receiptFooter: receiptFooter.trim() || null,
      })
      await refreshSession()
      toast.success("Showroom identity updated")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save showroom identity")
    }
  }

  const handleSaveRules = async () => {
    try {
      await updateSettings.mutateAsync({
        taxRateBps: toBps(taxRatePct),
        commissionRateBps: toBps(commRatePct),
        latenessDeduction: toKobo(latenessNaira),
      })
      await refreshSession()
      toast.success("Tax, commission & attendance rules updated")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save rules")
    }
  }

  return (
    <div className="space-y-4" data-cy="settings-page">
      <div>
        <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100">
          Organization & Access Control
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Configure showroom profile, branches, users, roles, audit logs, and backups
        </p>
      </div>

      <div className="flex gap-1 overflow-x-auto rounded-xl border border-slate-200 bg-white p-1 dark:border-slate-800 dark:bg-slate-900">
        {(
          [
            ["general", "Business & Tax"],
            ["email", "Email & Alerts"],
            ["branches", "Showroom Branches"],
            ["users", "User Accounts"],
            ["roles", "Roles & Permissions"],
            ["security", "Password & Security"],
            ["audit", "Audit, Trash & Backup"],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`rounded-lg px-3.5 py-1.5 text-xs font-medium whitespace-nowrap transition ${
              tab === k ? "bg-blue-600 text-white" : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "general" && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 lg:col-span-7">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Showroom Identity</h3>
              <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-medium hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800">
                <Upload className="h-3.5 w-3.5" /> Upload Logo
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={async (e) => {
                    const f = e.target.files?.[0]
                    if (!f) return
                    await uploadLogo.mutateAsync(f)
                    toast.success("Logo updated")
                  }}
                />
              </label>
            </div>
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              <Input label="Business Name" value={bizName} onChange={(e) => setBizName(e.target.value)} data-cy="biz-name" />
              <PhoneInput label="Phone Number" value={bizPhone} onChange={setBizPhone} data-cy="biz-phone" />
              <Input label="Email Address" value={bizEmail} onChange={(e) => setBizEmail(e.target.value)} />
              <Input label="Address" value={bizAddress} onChange={(e) => setBizAddress(e.target.value)} />
            </div>
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              <Input label="Receipt Header Note" value={receiptHeader} onChange={(e) => setReceiptHeader(e.target.value)} />
              <Input label="Receipt Footer Note" value={receiptFooter} onChange={(e) => setReceiptFooter(e.target.value)} />
            </div>
            {can("settings.manage") && (
              <div className="pt-1">
                <Button
                  className="w-full sm:w-auto"
                  onClick={handleSaveIdentity}
                  disabled={updateBusiness.isPending || updateSettings.isPending}
                  data-cy="save-identity-btn"
                >
                  <Save className="h-4 w-4" />
                  {updateBusiness.isPending ? "Saving..." : "Save Showroom Identity"}
                </Button>
              </div>
            )}
          </div>

          <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 lg:col-span-5 flex flex-col justify-between">
            <div className="space-y-3">
              <h3 className="text-sm font-semibold">Tax, Commission & Attendance Rules</h3>
              <Input label="Default VAT / Tax Rate (%)" type="number" step="0.1" value={taxRatePct} onChange={(e) => setTaxRatePct(e.target.value)} />
              <Input label="Default Seller Commission (%)" type="number" step="0.1" value={commRatePct} onChange={(e) => setCommRatePct(e.target.value)} />
              <Input label="Lateness Penalty Per Day (₦)" type="number" value={latenessNaira} onChange={(e) => setLatenessNaira(e.target.value)} />
            </div>
            {can("settings.manage") && (
              <Button
                className="w-full"
                onClick={handleSaveRules}
                disabled={updateSettings.isPending}
                data-cy="save-settings-btn"
              >
                <Save className="h-4 w-4" />
                {updateSettings.isPending ? "Saving..." : "Save Tax & Rules"}
              </Button>
            )}
          </div>
        </div>
      )}

      {tab === "branches" && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          {can("branch.manage") && (
            <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 lg:col-span-4">
              <h3 className="text-sm font-semibold">Add Showroom Branch</h3>
              <Input label="Branch Name *" value={branchName} onChange={(e) => setBranchName(e.target.value)} />
              <Input label="Short Code *" placeholder="LEK, VI, ABJ" value={branchCode} onChange={(e) => setBranchCode(e.target.value)} />
              <Input label="Address" value={branchAddress} onChange={(e) => setBranchAddress(e.target.value)} />
              <Button
                className="w-full"
                onClick={async () => {
                  if (!branchName.trim() || !branchCode.trim()) return toast.error("Enter branch name and code")
                  await saveBranch.mutateAsync({
                    payload: { name: branchName.trim(), code: branchCode.trim(), address: branchAddress.trim() || null },
                  })
                  toast.success("Branch created")
                  setBranchName("")
                  setBranchCode("")
                  setBranchAddress("")
                }}
              >
                <Plus className="h-4 w-4" /> Add Branch
              </Button>
            </div>
          )}
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 lg:col-span-8">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 bg-slate-50 text-[11px] uppercase text-slate-500 dark:border-slate-800 dark:bg-slate-800/50">
                <tr>
                  <th className="px-4 py-3">Code</th>
                  <th className="px-4 py-3">Branch Name</th>
                  <th className="px-4 py-3">Address</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {(branchesQuery.data ?? []).map((b) => (
                  <tr key={b.id}>
                    <td className="px-4 py-3 font-mono font-semibold">{b.code}</td>
                    <td className="px-4 py-3 font-medium">
                      {b.name} {b.isMain && <span className="ml-1 text-[10px] text-blue-600">(HQ)</span>}
                    </td>
                    <td className="px-4 py-3 text-slate-500">{b.address || "—"}</td>
                    <td className="px-4 py-3 text-right">
                      {!b.isMain && can("branch.manage") && (
                        <Button variant="ghost" size="icon" onClick={() => deleteBranch.mutate(b.id)} className="text-rose-600">
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "email" && <EmailSettingsTab />}
      {tab === "users" && <UsersTab />}
      {tab === "roles" && <RolesTab />}
      {tab === "security" && <SecurityPasswordTab />}
      {tab === "audit" && <AuditAndTrashTab />}
    </div>
  )
}
