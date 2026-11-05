import React, { useState } from "react"
import { useNavigate } from "react-router-dom"
import { ArrowRight, Lock, Mail, Moon, ShieldCheck, Sparkles, Store, Sun } from "lucide-react"
import { toast } from "sonner"
import { useAuth } from "@/contexts/AuthContext"
import { useTheme } from "@/contexts/ThemeContext"
import { loginFormSchema } from "@/lib/validation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

const DEMO_ACCOUNTS = [
  { label: "Owner / Admin", email: "owner@showroompro.test", role: "Full Access" },
  { label: "Manager", email: "manager@showroompro.test", role: "Operations" },
  { label: "Sales (Lekki)", email: "sales@showroompro.test", role: "POS & Customers" },
  { label: "Accountant", email: "accountant@showroompro.test", role: "Finance & Reports" },
]

export default function LoginPage() {
  const { login } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const navigate = useNavigate()

  const [email, setEmail] = useState("owner@showroompro.test")
  const [password, setPassword] = useState("Password123!")
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({})
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
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
      if (session.user.mustChangePassword) {
        navigate("/profile")
      } else {
        navigate("/dashboard")
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Invalid login credentials")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-12 bg-slate-50 dark:bg-slate-950">
      {/* Left Brand Showcase */}
      <div className="hidden lg:flex lg:col-span-7 relative overflow-hidden bg-slate-900 p-12 text-white flex-col justify-between">
        <div className="absolute -top-32 -left-32 h-96 w-96 rounded-full bg-indigo-600/25 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 right-0 h-96 w-96 rounded-full bg-violet-600/20 blur-3xl pointer-events-none" />

        <div className="relative z-10 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-lg shadow-indigo-500/30">
            <Store className="h-6 w-6 text-white" />
          </div>
          <div>
            <span className="text-xl font-extrabold tracking-tight">ShowroomPro</span>
            <span className="ml-2 rounded-full bg-indigo-500/20 px-2.5 py-0.5 text-[11px] font-semibold text-indigo-300">
              Enterprise Suite
            </span>
          </div>
        </div>

        <div className="relative z-10 max-w-xl space-y-6">
          <h1 className="text-4xl font-extrabold tracking-tight leading-tight">
            Run your entire showroom from till to balance sheet.
          </h1>
          <p className="text-base text-slate-300 leading-relaxed">
            Multi-branch point of sale, real-time stock control, supplier & customer ledgers, automated commissions, payroll, and instant P&L reporting — engineered for speed and accuracy.
          </p>

          <div className="grid grid-cols-2 gap-4 pt-4">
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

      {/* Right Sign-In Form */}
      <div className="lg:col-span-5 flex flex-col justify-between p-6 sm:p-10 lg:p-12">
        <div className="flex items-center justify-between">
          <div className="flex lg:hidden items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-white">
              <Store className="h-5 w-5" />
            </div>
            <span className="text-lg font-extrabold text-slate-900 dark:text-white">ShowroomPro</span>
          </div>
          <div className="ml-auto">
            <button
              type="button"
              onClick={toggleTheme}
              data-cy="login-theme-toggle"
              className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 cursor-pointer"
            >
              {theme === "dark" ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4" />}
              {theme === "dark" ? "Light Mode" : "Dark Mode"}
            </button>
          </div>
        </div>

        <div className="mx-auto w-full max-w-sm space-y-6 my-auto py-8">
          <div>
            <h2 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              Sign in to your account
            </h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Enter your staff credentials to access your showroom workspace.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="relative">
              <Input
                id="email"
                label="Email Address"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@showroompro.test"
                error={errors.email}
                data-cy="login-email"
              />
              <Mail className="pointer-events-none absolute right-3.5 top-8 h-4 w-4 text-slate-400" />
            </div>

            <div className="relative">
              <Input
                id="password"
                label="Password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                error={errors.password}
                data-cy="login-password"
              />
              <Lock className="pointer-events-none absolute right-3.5 top-8 h-4 w-4 text-slate-400" />
            </div>

            <Button
              type="submit"
              className="w-full h-11"
              disabled={submitting}
              data-cy="login-submit"
            >
              {submitting ? "Signing in..." : "Sign In"}
              <ArrowRight className="h-4 w-4" />
            </Button>
          </form>

          {/* Quick Demo Switcher */}
          <div className="rounded-2xl border border-slate-200/80 bg-white p-4 dark:border-slate-800 dark:bg-slate-900/70">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2.5">
              Quick Demo Accounts (Password123!)
            </p>
            <div className="grid grid-cols-2 gap-2">
              {DEMO_ACCOUNTS.map((acc) => (
                <button
                  key={acc.email}
                  type="button"
                  onClick={() => {
                    setEmail(acc.email)
                    setPassword("Password123!")
                  }}
                  data-cy={`demo-${acc.label.toLowerCase().replace(/[^a-z0-9]/g, "-")}`}
                  className={`rounded-xl border p-2 text-left transition-all cursor-pointer ${
                    email === acc.email
                      ? "border-indigo-500 bg-indigo-50/70 dark:border-indigo-500 dark:bg-indigo-950/50"
                      : "border-slate-200 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/60"
                  }`}
                >
                  <p className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">{acc.label}</p>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">{acc.role}</p>
                </button>
              ))}
            </div>
          </div>
        </div>

        <p className="text-center text-xs text-slate-400">
          Protected by ShowroomPro Access Control
        </p>
      </div>
    </div>
  )
}
