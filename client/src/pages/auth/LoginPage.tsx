import React, { useState } from "react"
import { useNavigate } from "react-router-dom"
import { ArrowRight, Mail, Moon, ShieldCheck, Sparkles, Store, Sun } from "lucide-react"
import { toast } from "sonner"
import { useAuth } from "@/contexts/AuthContext"
import { useTheme } from "@/contexts/ThemeContext"
import { loginFormSchema } from "@/lib/validation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { GoogleIcon, promptGoogleAccountPopup } from "@/components/auth/GoogleSignInModal"
import { ForgotPasswordModal } from "@/components/auth/ForgotPasswordModal"
import { RegisterForm } from "@/components/auth/RegisterForm"
import type { RegisterPayload } from "@/types/auth.types"

const DEMO_ACCOUNTS = [
  { label: "Owner / Admin", email: "owner@showroompro.test", role: "Full Access" },
  { label: "Manager", email: "manager@showroompro.test", role: "Operations" },
  { label: "Sales (Lekki)", email: "sales@showroompro.test", role: "POS & Customers" },
  { label: "Accountant", email: "accountant@showroompro.test", role: "Finance & Reports" },
]

export default function LoginPage() {
  const { login, register, googleSignIn } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const navigate = useNavigate()

  const [mode, setMode] = useState<"login" | "register">("login")
  const [email, setEmail] = useState("owner@showroompro.test")
  const [password, setPassword] = useState("Password123!")
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({})
  const [submitting, setSubmitting] = useState(false)
  const [forgotModalOpen, setForgotModalOpen] = useState(false)

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrors({})
    const parsed = loginFormSchema.safeParse({ email, password })
    if (!parsed.success) {
      const f = parsed.error.flatten().fieldErrors
      setErrors({ email: f.email?.[0], password: f.password?.[0] })
      return
    }
    setSubmitting(true)
    try {
      const session = await login(parsed.data)
      toast.success(`Welcome back, ${session.user.name}!`)
      navigate(session.user.mustChangePassword ? "/profile" : "/dashboard")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Invalid login credentials")
    } finally {
      setSubmitting(false)
    }
  }

  const handleRegisterSubmit = async (payload: RegisterPayload) => {
    setSubmitting(true)
    try {
      const session = await register(payload)
      toast.success(`Welcome to ShowroomPro, ${session.user.name}!`)
      navigate("/dashboard")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unable to create account")
    } finally {
      setSubmitting(false)
    }
  }

  const handleGoogleSignIn = async () => {
    setSubmitting(true)
    try {
      const token = await promptGoogleAccountPopup()
      const session = await googleSignIn({ idToken: token })
      toast.success(`Signed in as ${session.user.name}`)
      navigate("/dashboard")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Google sign-in failed")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="h-screen overflow-hidden grid lg:grid-cols-12 bg-slate-50 dark:bg-slate-950">
      {/* Left Brand Showcase */}
      <div className="hidden lg:flex lg:col-span-7 relative overflow-hidden bg-slate-900 p-10 xl:p-12 text-white flex-col justify-between">
        <div className="absolute -top-32 -left-32 h-96 w-96 rounded-full bg-indigo-600/25 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 right-0 h-96 w-96 rounded-full bg-violet-600/20 blur-3xl pointer-events-none" />

        <div className="relative z-10 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-lg shadow-indigo-500/30">
            <Store className="h-5 w-5 text-white" />
          </div>
          <div>
            <span className="text-xl font-extrabold tracking-tight">ShowroomPro</span>
            <span className="ml-2 rounded-full bg-indigo-500/20 px-2.5 py-0.5 text-[11px] font-semibold text-indigo-300">
              Enterprise Suite
            </span>
          </div>
        </div>

        <div className="relative z-10 max-w-xl space-y-5">
          <h1 className="text-3xl xl:text-4xl font-extrabold tracking-tight leading-tight">
            Run your entire showroom from till to balance sheet.
          </h1>
          <p className="text-sm xl:text-base text-slate-300 leading-relaxed">
            Multi-branch point of sale, real-time stock control, supplier & customer ledgers, automated commissions, payroll, and instant P&L reporting — engineered for speed and accuracy.
          </p>

          <div className="grid grid-cols-2 gap-4 pt-2">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-xs">
              <ShieldCheck className="h-5 w-5 text-emerald-400" />
              <p className="mt-2 text-sm font-bold">Kobo-Exact Ledger</p>
              <p className="mt-0.5 text-xs text-slate-400">
                Every sale, split payment, return, and expense balances to the kobo.
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-xs">
              <Sparkles className="h-5 w-5 text-indigo-400" />
              <p className="mt-2 text-sm font-bold">Multi-Branch Ready</p>
              <p className="mt-0.5 text-xs text-slate-400">
                Track stock, transfers, staff attendance, and cash-ups per location.
              </p>
            </div>
          </div>
        </div>

        <div className="relative z-10 flex items-center justify-between text-xs text-slate-400">
          <span>ShowroomPro Retail Operating System</span>
          <span>Permission-gated · Audit-logged</span>
        </div>
      </div>

      {/* Right Sign-In / Sign-Up Form */}
      <div className="lg:col-span-5 h-full overflow-hidden flex flex-col justify-between px-6 py-4 sm:px-10 sm:py-6">
        <div className="flex items-center justify-between shrink-0">
          <div className="flex lg:hidden items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-600 text-white">
              <Store className="h-4 w-4" />
            </div>
            <span className="text-base font-extrabold text-slate-900 dark:text-white">ShowroomPro</span>
          </div>
          <div className="ml-auto">
            <button
              type="button"
              onClick={toggleTheme}
              data-cy="login-theme-toggle"
              className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 cursor-pointer"
            >
              {theme === "dark" ? <Sun className="h-3.5 w-3.5 text-amber-400" /> : <Moon className="h-3.5 w-3.5" />}
              {theme === "dark" ? "Light Mode" : "Dark Mode"}
            </button>
          </div>
        </div>

        <div className="mx-auto w-full max-w-sm space-y-3 my-auto">
          {/* Mode Switcher Tabs */}
          <div className="grid grid-cols-2 rounded-xl bg-slate-200/70 p-1 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setMode("login")}
              data-cy="auth-mode-login"
              className={`rounded-lg py-1.5 text-xs font-bold transition-all cursor-pointer ${
                mode === "login"
                  ? "bg-white text-slate-900 shadow-xs dark:bg-slate-800 dark:text-white"
                  : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => setMode("register")}
              data-cy="auth-mode-register"
              className={`rounded-lg py-1.5 text-xs font-bold transition-all cursor-pointer ${
                mode === "register"
                  ? "bg-white text-slate-900 shadow-xs dark:bg-slate-800 dark:text-white"
                  : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
              }`}
            >
              Create Account
            </button>
          </div>

          <div>
            <h2 className="text-xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              {mode === "login" ? "Sign in to your account" : "Register your showroom"}
            </h2>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              {mode === "login"
                ? "Enter your staff credentials to access your showroom workspace."
                : "Set up a new showroom workspace with Owner access in seconds."}
            </p>
          </div>

          {/* Google Sign-In Button */}
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={submitting}
            data-cy="google-signin-btn"
            className="flex h-9 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-xs font-semibold text-slate-700 shadow-2xs transition-all hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800/80 cursor-pointer"
          >
            <GoogleIcon className="h-4 w-4" />
            <span>{mode === "login" ? "Continue with Google" : "Sign up with Google"}</span>
          </button>

          <div className="relative flex items-center justify-center">
            <div className="border-t border-slate-200 dark:border-slate-800 w-full" />
            <span className="bg-slate-50 dark:bg-slate-950 px-2.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400 shrink-0">
              Or with email
            </span>
            <div className="border-t border-slate-200 dark:border-slate-800 w-full" />
          </div>

          {mode === "login" ? (
            <>
              <form onSubmit={handleLoginSubmit} className="space-y-2.5">
                <div className="relative">
                  <Input
                    id="email"
                    label="Email Address"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@showroompro.test"
                    error={errors.email}
                    className="h-9 text-xs"
                    data-cy="login-email"
                  />
                  <Mail className="pointer-events-none absolute right-3 top-7.5 h-3.5 w-3.5 text-slate-400" />
                </div>

                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setForgotModalOpen(true)}
                    data-cy="forgot-password-btn"
                    className="absolute right-0 top-0 z-10 text-[11px] font-semibold text-indigo-600 hover:underline dark:text-indigo-400 cursor-pointer"
                  >
                    Forgot password?
                  </button>
                  <Input
                    id="password"
                    label="Password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    error={errors.password}
                    className="h-9 text-xs"
                    data-cy="login-password"
                  />
                </div>

                <Button type="submit" className="w-full h-10" disabled={submitting} data-cy="login-submit">
                  {submitting ? "Signing in..." : "Sign In"}
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </form>

              {/* Quick Demo Switcher */}
              <div className="rounded-xl border border-slate-200/80 bg-white p-2.5 dark:border-slate-800 dark:bg-slate-900/70">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                  Quick Demo Accounts (Password123!)
                </p>
                <div className="grid grid-cols-2 gap-1.5">
                  {DEMO_ACCOUNTS.map((acc) => (
                    <button
                      key={acc.email}
                      type="button"
                      onClick={() => {
                        setEmail(acc.email)
                        setPassword("Password123!")
                      }}
                      data-cy={`demo-${acc.label.toLowerCase().replace(/[^a-z0-9]/g, "-")}`}
                      className={`rounded-lg border px-2 py-1.5 text-left transition-all cursor-pointer ${
                        email === acc.email
                          ? "border-indigo-500 bg-indigo-50/70 dark:border-indigo-500 dark:bg-indigo-950/50"
                          : "border-slate-200 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/60"
                      }`}
                    >
                      <p className="text-[11px] font-bold text-slate-900 dark:text-slate-100 truncate">{acc.label}</p>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">{acc.role}</p>
                    </button>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <RegisterForm onSubmit={handleRegisterSubmit} submitting={submitting} />
          )}

          <p className="text-center text-xs text-slate-500 dark:text-slate-400">
            {mode === "login" ? (
              <>
                New to ShowroomPro?{" "}
                <button
                  type="button"
                  onClick={() => setMode("register")}
                  className="font-bold text-indigo-600 hover:underline dark:text-indigo-400 cursor-pointer"
                >
                  Create a showroom account
                </button>
              </>
            ) : (
              <>
                Already have an account?{" "}
                <button
                  type="button"
                  onClick={() => setMode("login")}
                  className="font-bold text-indigo-600 hover:underline dark:text-indigo-400 cursor-pointer"
                >
                  Sign in instead
                </button>
              </>
            )}
          </p>
        </div>

        <p className="text-center text-[11px] text-slate-400 shrink-0">
          Protected by ShowroomPro Access Control
        </p>
      </div>

      <ForgotPasswordModal
        open={forgotModalOpen}
        initialEmail={email}
        onClose={() => setForgotModalOpen(false)}
        onResetSuccess={(resetEmail) => {
          setEmail(resetEmail)
          setPassword("")
        }}
      />
    </div>
  )
}
