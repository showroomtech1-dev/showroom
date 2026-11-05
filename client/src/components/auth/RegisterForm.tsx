import React, { useState } from "react"
import { ArrowRight, Building2, Lock, Mail, Phone, User } from "lucide-react"
import { registerFormSchema } from "@/lib/validation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { RegisterPayload } from "@/types/auth.types"

interface RegisterFormProps {
  onSubmit: (payload: RegisterPayload) => Promise<void>
  submitting: boolean
}

export function RegisterForm({ onSubmit, submitting }: RegisterFormProps) {
  const [businessName, setBusinessName] = useState("")
  const [ownerName, setOwnerName] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [password, setPassword] = useState("")
  const [errors, setErrors] = useState<{
    businessName?: string
    ownerName?: string
    email?: string
    phone?: string
    password?: string
  }>({})

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrors({})
    const parsed = registerFormSchema.safeParse({
      businessName,
      ownerName,
      email,
      phone: phone || undefined,
      password,
    })
    if (!parsed.success) {
      const f = parsed.error.flatten().fieldErrors
      setErrors({
        businessName: f.businessName?.[0],
        ownerName: f.ownerName?.[0],
        email: f.email?.[0],
        phone: f.phone?.[0],
        password: f.password?.[0],
      })
      return
    }
    await onSubmit(parsed.data)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2.5" data-cy="register-form">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        <div className="relative">
          <Input
            id="register-business"
            label="Showroom Name"
            value={businessName}
            onChange={(e) => setBusinessName(e.target.value)}
            placeholder="Lekki Luxury Living"
            error={errors.businessName}
            className="h-9 text-xs"
            data-cy="register-business-name"
          />
          <Building2 className="pointer-events-none absolute right-3 top-7.5 h-3.5 w-3.5 text-slate-400" />
        </div>

        <div className="relative">
          <Input
            id="register-owner"
            label="Your Full Name"
            value={ownerName}
            onChange={(e) => setOwnerName(e.target.value)}
            placeholder="Chinedu Okafor"
            error={errors.ownerName}
            className="h-9 text-xs"
            data-cy="register-owner-name"
          />
          <User className="pointer-events-none absolute right-3 top-7.5 h-3.5 w-3.5 text-slate-400" />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        <div className="relative">
          <Input
            id="register-email"
            label="Work Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
            error={errors.email}
            className="h-9 text-xs"
            data-cy="register-email"
          />
          <Mail className="pointer-events-none absolute right-3 top-7.5 h-3.5 w-3.5 text-slate-400" />
        </div>

        <div className="relative">
          <Input
            id="register-phone"
            label="Phone (Optional)"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="0803 000 0000"
            error={errors.phone}
            className="h-9 text-xs"
            data-cy="register-phone"
          />
          <Phone className="pointer-events-none absolute right-3 top-7.5 h-3.5 w-3.5 text-slate-400" />
        </div>
      </div>

      <div className="relative">
        <Input
          id="register-password"
          label="Create Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="At least 8 chars with letter & number"
          error={errors.password}
          className="h-9 text-xs"
          data-cy="register-password"
        />
        <Lock className="pointer-events-none absolute right-3 top-7.5 h-3.5 w-3.5 text-slate-400" />
      </div>

      <Button
        type="submit"
        className="w-full h-10"
        disabled={submitting}
        data-cy="register-submit"
      >
        {submitting ? "Creating Showroom..." : "Create Showroom Account"}
        <ArrowRight className="h-4 w-4" />
      </Button>
    </form>
  )
}
