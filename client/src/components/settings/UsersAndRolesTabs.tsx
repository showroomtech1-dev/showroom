import { useState } from "react"
import { Download, Eye, KeyRound, Plus, RotateCcw, ShieldCheck, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { useAuth } from "@/contexts/AuthContext"
import {
  useAuditLogs,
  useBranches,
  useDeleteRole,
  useDeleteUser,
  usePermissionsCatalog,
  useResetUserPassword,
  useRestoreTrash,
  useRoles,
  useSaveRole,
  useSaveUser,
  useTrash,
  useUsers,
} from "@/hooks/useOrganization"
import { OrganizationEndpoints } from "@/endpoints/organization.endpoints"
import { AuthEndpoints } from "@/endpoints/auth.endpoints"
import { tokenStorage } from "@/lib/storage"
import { changePasswordFormSchema } from "@/lib/validation"
import { ForgotPasswordModal } from "@/components/auth/ForgotPasswordModal"
import { formatDateTime } from "@/lib/utils"
import { Dialog } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { StatusBadge } from "@/components/shared/StatusBadge"
import type { Role, UserRecord } from "@/types/organization.types"

export function UsersTab() {
  const { can } = useAuth()
  const usersQuery = useUsers({ limit: 50 })
  const rolesQuery = useRoles()
  const branchesQuery = useBranches()
  const saveUser = useSaveUser()
  const deleteUser = useDeleteUser()
  const resetUserPassword = useResetUserPassword()

  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [roleId, setRoleId] = useState("")
  const [branchId, setBranchId] = useState("")

  const [resetTarget, setResetTarget] = useState<UserRecord | null>(null)
  const [newResetPassword, setNewResetPassword] = useState("")
  const [mustChangeOnLogin, setMustChangeOnLogin] = useState(true)

  const handleResetPassword = async () => {
    if (!resetTarget) return
    if (newResetPassword.length < 8 || !/(?=.*[A-Za-z])(?=.*\d)/.test(newResetPassword)) {
      return toast.error("Password must be at least 8 characters with a letter and a number")
    }
    try {
      await resetUserPassword.mutateAsync({
        id: resetTarget.id,
        password: newResetPassword,
        mustChangePassword: mustChangeOnLogin,
      })
      toast.success(`Password reset in Firebase for ${resetTarget.name}`)
      setResetTarget(null)
      setNewResetPassword("")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not reset password")
    }
  }

  const handleCreateUser = async () => {
    if (!name.trim() || !email.trim() || !password || !roleId) {
      return toast.error("Fill name, email, password, and role")
    }
    try {
      await saveUser.mutateAsync({
        payload: {
          name: name.trim(),
          email: email.trim(),
          password,
          roleId,
          branchId: branchId || null,
        },
      })
      toast.success("User account created")
      setOpen(false)
      setName("")
      setEmail("")
      setPassword("")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create user")
    }
  }

  return (
    <div className="space-y-3">
      {can("user.manage") && (
        <div className="flex justify-end">
          <Button size="sm" onClick={() => setOpen(true)} data-cy="add-user-btn">
            <Plus className="h-4 w-4" /> New User Login
          </Button>
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-slate-200 bg-slate-50 text-[11px] uppercase text-slate-500 dark:border-slate-800 dark:bg-slate-800/50">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Branch</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
            {(usersQuery.data?.data ?? []).map((u) => (
              <tr key={u.id}>
                <td className="px-4 py-3 font-semibold">{u.name}</td>
                <td className="px-4 py-3 text-slate-500">{u.email}</td>
                <td className="px-4 py-3 font-medium text-blue-600 dark:text-blue-400">{u.roleName}</td>
                <td className="px-4 py-3 text-slate-500">{u.branchName || "All Branches"}</td>
                <td className="px-4 py-3"><StatusBadge status={u.isActive ? "active" : "suspended"} /></td>
                <td className="px-4 py-3 text-right">
                  {can("user.manage") && (
                    <div className="inline-flex items-center gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setResetTarget(u)
                          setNewResetPassword("")
                          setMustChangeOnLogin(true)
                        }}
                        data-cy={`reset-user-pwd-${u.id}`}
                        className="h-7 px-2 text-[11px]"
                      >
                        <KeyRound className="h-3 w-3" /> Reset Password
                      </Button>
                      {u.roleKey !== "owner" && (
                        <Button variant="ghost" size="icon" onClick={() => deleteUser.mutate(u.id)} className="text-rose-600">
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog
        open={Boolean(resetTarget)}
        onClose={() => setResetTarget(null)}
        title={`Reset Password — ${resetTarget?.name ?? ""}`}
        description={`Set a new Firebase Authentication password for ${resetTarget?.email ?? ""}.`}
      >
        <div className="space-y-3">
          <Input
            label="New Password *"
            type="password"
            value={newResetPassword}
            onChange={(e) => setNewResetPassword(e.target.value)}
            placeholder="At least 8 characters with letter & number"
            data-cy="admin-reset-pwd-input"
          />
          <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={mustChangeOnLogin}
              onChange={(e) => setMustChangeOnLogin(e.target.checked)}
              className="rounded border-slate-300"
            />
            Require staff member to change password on next sign-in
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => setResetTarget(null)}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleResetPassword}
              disabled={resetUserPassword.isPending}
              data-cy="admin-reset-pwd-submit"
            >
              {resetUserPassword.isPending ? "Saving to Firebase..." : "Reset Password"}
            </Button>
          </div>
        </div>
      </Dialog>

      <Dialog open={open} onClose={() => setOpen(false)} title="Create Staff User Login">
        <div className="space-y-3">
          <Input label="Full Name *" value={name} onChange={(e) => setName(e.target.value)} data-cy="user-name" />
          <Input label="Email Address *" type="email" value={email} onChange={(e) => setEmail(e.target.value)} data-cy="user-email" />
          <Input label="Temporary Password *" type="password" value={password} onChange={(e) => setPassword(e.target.value)} data-cy="user-password" />
          <div className="grid grid-cols-2 gap-2.5">
            <Select
              label="Role *"
              value={roleId}
              onChange={(e) => setRoleId(e.target.value)}
              options={(rolesQuery.data ?? []).map((r) => ({ value: r.id, label: r.name }))}
              placeholder="Select role..."
            />
            <Select
              label="Assigned Branch"
              value={branchId}
              onChange={(e) => setBranchId(e.target.value)}
              options={(branchesQuery.data ?? []).map((b) => ({ value: b.id, label: b.name }))}
              placeholder="All Branches"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateUser} disabled={saveUser.isPending} data-cy="user-save">Create User</Button>
          </div>
        </div>
      </Dialog>
    </div>
  )
}

export function RolesTab() {
  const { can, startRolePreview } = useAuth()
  const rolesQuery = useRoles()
  const catalogQuery = usePermissionsCatalog()
  const saveRole = useSaveRole()
  const deleteRole = useDeleteRole()

  const [editingRole, setEditingRole] = useState<Role | null>(null)
  const [roleModalOpen, setRoleModalOpen] = useState(false)
  const [name, setName] = useState("")
  const [selectedPerms, setSelectedPerms] = useState<string[]>([])

  const openEditor = (role?: Role) => {
    if (role) {
      setEditingRole(role)
      setName(role.name)
      setSelectedPerms(role.permissions)
    } else {
      setEditingRole(null)
      setName("")
      setSelectedPerms([])
    }
    setRoleModalOpen(true)
  }

  const togglePerm = (code: string) => {
    setSelectedPerms((prev) =>
      prev.includes(code) ? prev.filter((p) => p !== code) : [...prev, code]
    )
  }

  return (
    <div className="space-y-3">
      {can("role.manage") && (
        <div className="flex justify-end">
          <Button size="sm" onClick={() => openEditor()} data-cy="add-role-btn">
            <Plus className="h-4 w-4" /> Create Custom Role
          </Button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {(rolesQuery.data ?? []).map((r) => (
          <div key={r.id} className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">{r.name}</h3>
                </div>
                <span className="text-xs text-slate-500">{r.userCount} users</span>
              </div>
              <p className="mt-1 text-xs text-slate-500">{r.description || `${r.permissions.length} permissions granted`}</p>
            </div>
            <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  startRolePreview({ id: r.id, name: r.name, permissions: r.permissions })
                }
                data-cy={`preview-role-${r.key}`}
              >
                <Eye className="h-3.5 w-3.5" /> Preview UI as {r.name}
              </Button>
              {!r.isLocked && can("role.manage") && (
                <>
                  <Button variant="ghost" size="sm" onClick={() => openEditor(r)}>
                    Edit Permissions
                  </Button>
                  {!r.isBuiltIn && (
                    <Button variant="ghost" size="sm" onClick={() => deleteRole.mutate(r.id)} className="text-rose-600">
                      Delete
                    </Button>
                  )}
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      <Dialog open={roleModalOpen} onClose={() => setRoleModalOpen(false)} title={editingRole ? `Edit Role — ${editingRole.name}` : "Create Custom Role"} maxWidth="max-w-2xl">
        <div className="space-y-3 text-xs">
          <Input label="Role Name *" value={name} onChange={(e) => setName(e.target.value)} />
          <div className="max-h-72 space-y-2 overflow-y-auto rounded-lg border border-slate-200 p-3 dark:border-slate-800">
            {(catalogQuery.data ?? []).map((p) => (
              <label key={p.code} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={selectedPerms.includes(p.code)}
                  onChange={() => togglePerm(p.code)}
                  className="rounded border-slate-300"
                />
                <span className="font-medium text-slate-800 dark:text-slate-200">{p.label}</span>
                <span className="font-mono text-[10px] text-slate-400">({p.code})</span>
              </label>
            ))}
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setRoleModalOpen(false)}>Cancel</Button>
            <Button
              onClick={async () => {
                if (!name.trim()) return toast.error("Enter role name")
                await saveRole.mutateAsync({
                  id: editingRole?.id,
                  payload: { name: name.trim(), permissions: selectedPerms },
                })
                toast.success("Role saved")
                setRoleModalOpen(false)
              }}
            >
              Save Role
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  )
}

export function AuditAndTrashTab() {
  const { can } = useAuth()
  const [trashType, setTrashType] = useState("products")
  const auditQuery = useAuditLogs({ limit: 30 }, can("audit.view"))
  const trashQuery = useTrash(trashType, can("settings.manage"))
  const restoreTrash = useRestoreTrash()

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
      <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 lg:col-span-7">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Recent Security & Audit Logs</h3>
          {can("backup.export") && (
            <Button variant="outline" size="sm" onClick={() => OrganizationEndpoints.downloadBackup()} data-cy="backup-export-btn">
              <Download className="h-3.5 w-3.5" /> Full JSON Backup
            </Button>
          )}
        </div>
        <div className="max-h-80 divide-y divide-slate-200 overflow-y-auto text-xs dark:divide-slate-800">
          {(auditQuery.data?.data ?? []).map((log) => (
            <div key={log.id} className="py-2">
              <p className="font-medium text-slate-900 dark:text-slate-100">{log.summary}</p>
              <p className="text-[11px] text-slate-400">
                {log.userName || "System"} • {formatDateTime(log.createdAt)}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 lg:col-span-5">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Recycle Bin (Trash)</h3>
          <Select
            value={trashType}
            onChange={(e) => setTrashType(e.target.value)}
            options={[
              { value: "products", label: "Products" },
              { value: "customers", label: "Customers" },
              { value: "suppliers", label: "Suppliers" },
              { value: "expenses", label: "Expenses" },
              { value: "employees", label: "Employees" },
            ]}
          />
        </div>
        <div className="max-h-72 divide-y divide-slate-200 overflow-y-auto text-xs dark:divide-slate-800">
          {(trashQuery.data ?? []).map((item) => (
            <div key={item.id} className="flex items-center justify-between py-2">
              <span>{item.label}</span>
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  await restoreTrash.mutateAsync({ type: trashType, id: item.id })
                  toast.success("Record restored")
                }}
              >
                <RotateCcw className="h-3.5 w-3.5" /> Restore
              </Button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export function SecurityPasswordTab() {
  const { user, refreshSession } = useAuth()
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [changingPwd, setChangingPwd] = useState(false)
  const [forgotOpen, setForgotOpen] = useState(false)

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    const parsed = changePasswordFormSchema.safeParse({ currentPassword, newPassword })
    if (!parsed.success) {
      const f = parsed.error.flatten().fieldErrors
      toast.error(f.newPassword?.[0] || f.currentPassword?.[0] || "Check password fields")
      return
    }
    setChangingPwd(true)
    try {
      const res = await AuthEndpoints.changePassword(parsed.data)
      if (res.success && res.data) {
        tokenStorage.set(res.data.accessToken, res.data.refreshToken)
        await refreshSession()
        setCurrentPassword("")
        setNewPassword("")
        toast.success("Password updated in Firebase Authentication")
      } else {
        toast.error(res.message)
      }
    } finally {
      setChangingPwd(false)
    }
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-12" data-cy="settings-security-tab">
      <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 lg:col-span-6">
        <div>
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Change My Password
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Passwords are stored securely in Firebase Authentication and are never saved in the database.
          </p>
        </div>

        <form onSubmit={handleChangePassword} className="space-y-3">
          <Input
            label="Current Password"
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            placeholder="Enter current password"
            data-cy="settings-pwd-current"
          />
          <Input
            label="New Password"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="At least 8 chars with letter & number"
            data-cy="settings-pwd-new"
          />
          <Button type="submit" disabled={changingPwd} data-cy="settings-pwd-submit">
            <KeyRound className="h-4 w-4" />
            {changingPwd ? "Updating in Firebase..." : "Update Password"}
          </Button>
        </form>
      </div>

      <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 lg:col-span-6 flex flex-col justify-between">
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Forgot Current Password / Reset via Email Code
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            If you signed in with Google or don't remember your current password, request a 6-digit verification code to{" "}
            <strong className="text-slate-700 dark:text-slate-200">{user?.email}</strong> to set a new Firebase password.
          </p>
        </div>

        <div>
          <Button
            type="button"
            variant="outline"
            onClick={() => setForgotOpen(true)}
            data-cy="settings-forgot-pwd-btn"
          >
            <KeyRound className="h-4 w-4" />
            Reset Password with 6-Digit Email Code
          </Button>
        </div>
      </div>

      <ForgotPasswordModal
        open={forgotOpen}
        initialEmail={user?.email ?? ""}
        onClose={() => setForgotOpen(false)}
      />
    </div>
  )
}
