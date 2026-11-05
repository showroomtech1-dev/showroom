import React, { useState } from "react"
import { Clock, KeyRound, Shield, UserCheck } from "lucide-react"
import { toast } from "sonner"
import { useAuth } from "@/contexts/AuthContext"
import { AuthEndpoints } from "@/endpoints/auth.endpoints"
import { tokenStorage } from "@/lib/storage"
import { changePasswordFormSchema } from "@/lib/validation"
import { useClockInOut, useMyEmployeeProfile, useTodayAttendance } from "@/hooks/useEmployees"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { PhoneInput } from "@/components/ui/phone-input"
import { StatusBadge } from "@/components/shared/StatusBadge"
import { formatDateTime } from "@/lib/utils"

export default function ProfilePage() {
  const { user, permissions, refreshSession, can } = useAuth()
  const [name, setName] = useState(user?.name ?? "")
  const [phone, setPhone] = useState(user?.phone ?? "")
  const [savingProfile, setSavingProfile] = useState(false)

  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [changingPwd, setChangingPwd] = useState(false)

  const canClock = can("attendance.clock")
  const { data: myEmployee } = useMyEmployeeProfile(canClock)
  const { data: todayAtt } = useTodayAttendance(canClock)
  const clockMutation = useClockInOut()

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      toast.error("Name is required")
      return
    }
    setSavingProfile(true)
    const res = await AuthEndpoints.updateMe({ name: name.trim(), phone: phone.trim() || null })
    setSavingProfile(false)
    if (res.success) {
      await refreshSession()
      toast.success("Profile updated")
    } else {
      toast.error(res.message)
    }
  }

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    const parsed = changePasswordFormSchema.safeParse({ currentPassword, newPassword })
    if (!parsed.success) {
      const f = parsed.error.flatten().fieldErrors
      toast.error(f.newPassword?.[0] || f.currentPassword?.[0] || "Check password fields")
      return
    }
    setChangingPwd(true)
    const res = await AuthEndpoints.changePassword(parsed.data)
    setChangingPwd(false)
    if (res.success && res.data) {
      tokenStorage.set(res.data.accessToken, res.data.refreshToken)
      await refreshSession()
      setCurrentPassword("")
      setNewPassword("")
      toast.success("Password changed")
    } else {
      toast.error(res.message)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">My Profile & Security</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Manage your personal details, password, and daily attendance clock-in.
        </p>
      </div>

      {user?.mustChangePassword && (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-200">
          <strong>Action required:</strong> Please set a new personal password below to complete your account setup.
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Profile Form */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserCheck className="h-4 w-4 text-indigo-500" />
              Account Details
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSaveProfile} className="space-y-4">
              <Input
                label="Full Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                data-cy="profile-name"
              />
              <Input label="Email Address" value={user?.email ?? ""} disabled />
              <PhoneInput
                id="profile-phone"
                label="Phone Number"
                value={phone}
                onChange={setPhone}
                placeholder="803 123 4567"
                data-cy="profile-phone"
              />
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60">
                  <p className="text-[11px] font-semibold uppercase text-slate-400">Assigned Role</p>
                  <p className="mt-0.5 text-sm font-bold text-slate-900 dark:text-slate-100">{user?.roleName}</p>
                </div>
                <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60">
                  <p className="text-[11px] font-semibold uppercase text-slate-400">Home Branch</p>
                  <p className="mt-0.5 text-sm font-bold text-slate-900 dark:text-slate-100">
                    {user?.branchName || "All Branches"}
                  </p>
                </div>
              </div>
              <Button type="submit" disabled={savingProfile} data-cy="profile-save">
                {savingProfile ? "Saving..." : "Save Profile"}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Password Change */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-indigo-500" />
              Change Password
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleChangePassword} className="space-y-4">
              <Input
                label="Current Password"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                data-cy="pwd-current"
              />
              <Input
                label="New Password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                hint="At least 8 characters with a letter and a number"
                data-cy="pwd-new"
              />
              <Button type="submit" disabled={changingPwd} data-cy="pwd-submit">
                {changingPwd ? "Updating..." : "Update Password"}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Attendance Self-Service */}
        {canClock && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-emerald-500" />
                Today's Shift & Attendance
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {myEmployee ? (
                <div className="flex items-center justify-between rounded-xl border border-slate-200 p-3.5 dark:border-slate-800">
                  <div>
                    <p className="text-sm font-bold text-slate-900 dark:text-slate-100">{myEmployee.fullName}</p>
                    <p className="text-xs text-slate-500">
                      {myEmployee.code} · {myEmployee.jobTitle || "Staff"}
                    </p>
                  </div>
                  {todayAtt ? <StatusBadge status={todayAtt.status} /> : <StatusBadge status="pending" label="Not Clocked In" />}
                </div>
              ) : (
                <p className="text-xs text-slate-500">
                  Your user account is not yet linked to an employee record. Ask a manager to link your login under People → Staff.
                </p>
              )}

              {todayAtt && (
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/50">
                    <span className="text-slate-400">Clocked In:</span>
                    <p className="font-semibold text-slate-900 dark:text-slate-100 mt-0.5">
                      {formatDateTime(todayAtt.clockInAt)}
                    </p>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/50">
                    <span className="text-slate-400">Clocked Out:</span>
                    <p className="font-semibold text-slate-900 dark:text-slate-100 mt-0.5">
                      {formatDateTime(todayAtt.clockOutAt)}
                    </p>
                  </div>
                </div>
              )}

              {myEmployee && (
                <div className="flex gap-2">
                  <Button
                    variant="emerald"
                    disabled={Boolean(todayAtt?.clockInAt) || clockMutation.isPending}
                    onClick={() =>
                      clockMutation.mutate(
                        { action: "in" },
                        {
                          onSuccess: () => toast.success("Clocked in!"),
                          onError: (e) => toast.error(e.message),
                        }
                      )
                    }
                    data-cy="profile-clock-in"
                  >
                    Clock In
                  </Button>
                  <Button
                    variant="outline"
                    disabled={!todayAtt?.clockInAt || Boolean(todayAtt?.clockOutAt) || clockMutation.isPending}
                    onClick={() =>
                      clockMutation.mutate(
                        { action: "out" },
                        {
                          onSuccess: () => toast.success("Clocked out!"),
                          onError: (e) => toast.error(e.message),
                        }
                      )
                    }
                    data-cy="profile-clock-out"
                  >
                    Clock Out
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Active Permissions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-indigo-500" />
              Active Permissions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-1.5">
              {permissions.map((p) => (
                <span
                  key={p}
                  className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 font-mono text-xs text-slate-700 dark:border-slate-800 dark:bg-slate-800/70 dark:text-slate-300"
                >
                  {p === "*" ? "Full Access (*)" : p}
                </span>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
