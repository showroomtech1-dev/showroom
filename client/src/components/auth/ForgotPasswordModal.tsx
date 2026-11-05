import React, { useEffect, useState } from "react"
import { ArrowRight, KeyRound, Lock, Mail, Sparkles } from "lucide-react"
import { toast } from "sonner"
import { AuthEndpoints } from "@/endpoints/auth.endpoints"
import { Dialog } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

interface ForgotPasswordModalProps {
  open: boolean
  initialEmail?: string
  onClose: () => void
  onResetSuccess?: (email: string) => void
}

export function ForgotPasswordModal({
  open,
  initialEmail = "",
  onClose,
  onResetSuccess,
}: ForgotPasswordModalProps) {
  const [step, setStep] = useState<"request" | "verify">("request")
  const [email, setEmail] = useState(initialEmail)
  const [code, setCode] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [devCode, setDevCode] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (open) {
      setEmail(initialEmail)
      setStep("request")
      setCode("")
      setNewPassword("")
      setDevCode(null)
      setError("")
    }
  }, [open, initialEmail])

  const handleRequestCode = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    const trimmed = email.trim()
    if (!trimmed || !trimmed.includes("@")) {
      setError("Enter a valid email address")
      return
    }
    setSubmitting(true)
    try {
      const res = await AuthEndpoints.forgotPassword(trimmed)
      if (!res.success) {
        setError(res.message || "Could not send reset code")
        return
      }
      toast.success(res.data?.message || "Reset code sent to your email")
      if (res.data?.devCode) {
        setDevCode(res.data.devCode)
        setCode(res.data.devCode)
      }
      setStep("verify")
    } finally {
      setSubmitting(false)
    }
  }

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    if (!/^\d{6}$/.test(code.trim())) {
      setError("Enter the 6-digit verification code")
      return
    }
    if (newPassword.length < 8 || !/(?=.*[A-Za-z])(?=.*\d)/.test(newPassword)) {
      setError("Password must be at least 8 characters with a letter and a number")
      return
    }
    setSubmitting(true)
    try {
      const res = await AuthEndpoints.resetPassword({
        email: email.trim(),
        code: code.trim(),
        newPassword,
      })
      if (!res.success) {
        setError(res.message || "Invalid or expired reset code")
        return
      }
      toast.success(res.data?.message || "Password reset! You can sign in now.")
      onResetSuccess?.(email.trim())
      onClose()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={step === "request" ? "Forgot Password" : "Enter Reset Code"}
      description={
        step === "request"
          ? "Enter your account email and we will send a 6-digit password reset code."
          : `Enter the 6-digit code sent to ${email} and choose a new password.`
      }
    >
      {step === "request" ? (
        <form onSubmit={handleRequestCode} className="space-y-3.5" data-cy="forgot-password-form">
          <div className="relative">
            <Input
              id="forgot-email"
              label="Account Email Address"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@showroompro.test"
              error={error}
              className="h-9 text-xs"
              data-cy="forgot-email-input"
            />
            <Mail className="pointer-events-none absolute right-3 top-7.5 h-3.5 w-3.5 text-slate-400" />
          </div>

          <div className="flex items-center justify-between pt-1">
            <button
              type="button"
              onClick={() => setStep("verify")}
              className="text-xs font-semibold text-indigo-600 hover:underline dark:text-indigo-400 cursor-pointer"
            >
              Already have a 6-digit code?
            </button>
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={submitting} data-cy="forgot-send-code-btn">
                {submitting ? "Sending..." : "Send 6-Digit Code"}
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </form>
      ) : (
        <form onSubmit={handleResetPassword} className="space-y-3" data-cy="reset-password-code-form">
          {devCode && (
            <div className="flex items-center justify-between rounded-xl border border-indigo-200 bg-indigo-50/80 px-3 py-2 text-xs text-indigo-900 dark:border-indigo-800/70 dark:bg-indigo-950/50 dark:text-indigo-200">
              <span className="flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-indigo-500" />
                Dev Mode Reset Code: <strong className="font-mono tracking-wider">{devCode}</strong>
              </span>
              <span className="text-[10px] font-semibold text-indigo-600 dark:text-indigo-400">Auto-filled</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div className="relative">
              <Input
                id="reset-code"
                label="6-Digit Code"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="123456"
                maxLength={6}
                className="h-9 text-xs font-mono tracking-widest"
                data-cy="reset-code-input"
              />
              <KeyRound className="pointer-events-none absolute right-3 top-7.5 h-3.5 w-3.5 text-slate-400" />
            </div>

            <div className="relative">
              <Input
                id="reset-new-password"
                label="New Password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="8+ chars, letter & number"
                className="h-9 text-xs"
                data-cy="reset-new-password-input"
              />
              <Lock className="pointer-events-none absolute right-3 top-7.5 h-3.5 w-3.5 text-slate-400" />
            </div>
          </div>

          {error && <p className="text-xs font-medium text-rose-600 dark:text-rose-400">{error}</p>}

          <div className="flex items-center justify-between pt-1">
            <button
              type="button"
              onClick={() => setStep("request")}
              className="text-xs font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer"
            >
              ← Resend code
            </button>
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={submitting} data-cy="reset-password-submit-btn">
                {submitting ? "Resetting..." : "Reset Password"}
              </Button>
            </div>
          </div>
        </form>
      )}
    </Dialog>
  )
}
