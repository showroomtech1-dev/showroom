import React, { useMemo, useState } from "react"
import { cn } from "@/lib/utils"

export interface CountryDialOption {
  code: string
  dial: string
  flag: string
  name: string
}

export const COUNTRY_DIAL_OPTIONS: CountryDialOption[] = [
  { code: "NG", dial: "+234", flag: "🇳🇬", name: "Nigeria" },
  { code: "GH", dial: "+233", flag: "🇬🇭", name: "Ghana" },
  { code: "KE", dial: "+254", flag: "🇰🇪", name: "Kenya" },
  { code: "ZA", dial: "+27", flag: "🇿🇦", name: "South Africa" },
  { code: "GB", dial: "+44", flag: "🇬🇧", name: "United Kingdom" },
  { code: "US", dial: "+1", flag: "🇺🇸", name: "United States / Canada" },
  { code: "AE", dial: "+971", flag: "🇦🇪", name: "UAE (Dubai)" },
  { code: "CN", dial: "+86", flag: "🇨🇳", name: "China" },
  { code: "IN", dial: "+91", flag: "🇮🇳", name: "India" },
  { code: "TR", dial: "+90", flag: "🇹🇷", name: "Turkey" },
  { code: "DE", dial: "+49", flag: "🇩🇪", name: "Germany" },
  { code: "FR", dial: "+33", flag: "🇫🇷", name: "France" },
  { code: "IT", dial: "+39", flag: "🇮🇹", name: "Italy" },
  { code: "CM", dial: "+237", flag: "🇨🇲", name: "Cameroon" },
  { code: "CI", dial: "+225", flag: "🇨🇮", name: "Côte d'Ivoire" },
  { code: "SN", dial: "+221", flag: "🇸🇳", name: "Senegal" },
  { code: "UG", dial: "+256", flag: "🇺🇬", name: "Uganda" },
  { code: "TZ", dial: "+255", flag: "🇹🇿", name: "Tanzania" },
  { code: "RW", dial: "+250", flag: "🇷🇼", name: "Rwanda" },
  { code: "EG", dial: "+20", flag: "🇪🇬", name: "Egypt" },
]

const SORTED_BY_DIAL_LENGTH = [...COUNTRY_DIAL_OPTIONS].sort(
  (a, b) => b.dial.length - a.dial.length
)

function parsePhoneValue(raw: string): { dial: string; local: string } {
  const trimmed = (raw || "").trim()
  if (!trimmed) return { dial: "+234", local: "" }

  if (trimmed.startsWith("+")) {
    const matched = SORTED_BY_DIAL_LENGTH.find((c) => trimmed.startsWith(c.dial))
    if (matched) {
      return {
        dial: matched.dial,
        local: trimmed.slice(matched.dial.length).trim(),
      }
    }
  }

  return { dial: "+234", local: trimmed }
}

export interface PhoneInputProps {
  id?: string
  label?: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  error?: string
  hint?: string
  compact?: boolean
  className?: string
  "data-cy"?: string
}

export const PhoneInput: React.FC<PhoneInputProps> = ({
  id,
  label,
  value,
  onChange,
  placeholder = "803 123 4567",
  error,
  hint,
  compact = false,
  className,
  "data-cy": dataCy,
}) => {
  const parsed = useMemo(() => parsePhoneValue(value), [value])
  const [selectedDial, setSelectedDial] = useState<string>(parsed.dial)

  const activeDial = value?.trim().startsWith("+") ? parsed.dial : selectedDial
  const localPart = value?.trim().startsWith("+") ? parsed.local : value

  const handleDialChange = (newDial: string) => {
    setSelectedDial(newDial)
    const cleanLocal = localPart.replace(/^0+/, "").trim()
    if (cleanLocal) {
      onChange(`${newDial}${cleanLocal}`)
    }
  }

  const handleLocalChange = (rawLocal: string) => {
    const cleaned = rawLocal.replace(/[^\d ()-]/g, "")
    if (!cleaned.trim()) {
      onChange("")
      return
    }
    const withoutLeadingZero = cleaned.replace(/^0+/, "")
    onChange(`${activeDial}${withoutLeadingZero}`)
  }

  return (
    <div className="w-full space-y-1.5">
      {label && (
        <label
          htmlFor={id}
          className="block text-xs font-semibold tracking-wide text-slate-700 dark:text-slate-300"
        >
          {label}
        </label>
      )}

      <div
        className={cn(
          "flex w-full items-center overflow-hidden rounded-xl border border-slate-200 bg-white transition-all focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-900",
          compact ? "h-9" : "h-10",
          error && "border-rose-500 focus-within:border-rose-500 focus-within:ring-rose-500/20",
          className
        )}
      >
        <select
          aria-label="Country code"
          value={activeDial}
          onChange={(e) => handleDialChange(e.target.value)}
          data-cy={dataCy ? `${dataCy}-country` : undefined}
          className={cn(
            "h-full shrink-0 border-r border-slate-200 bg-slate-50/90 pl-2.5 pr-1.5 font-semibold text-slate-800 focus:outline-none dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-100 cursor-pointer",
            compact ? "text-xs" : "text-xs sm:text-sm"
          )}
        >
          {COUNTRY_DIAL_OPTIONS.map((c) => (
            <option
              key={c.code}
              value={c.dial}
              className="bg-white text-slate-900 dark:bg-slate-900 dark:text-slate-100"
            >
              {c.flag} {c.dial} ({c.code})
            </option>
          ))}
        </select>

        <input
          id={id}
          type="tel"
          value={localPart}
          onChange={(e) => handleLocalChange(e.target.value)}
          placeholder={placeholder}
          data-cy={dataCy}
          className={cn(
            "h-full w-full min-w-0 flex-1 bg-transparent px-3 text-slate-900 placeholder:text-slate-400 focus:outline-none dark:text-slate-100 dark:placeholder:text-slate-500",
            compact ? "text-xs" : "text-sm"
          )}
        />
      </div>

      {hint && !error && <p className="text-[11px] text-slate-500 dark:text-slate-400">{hint}</p>}
      {error && <p className="text-xs font-medium text-rose-600 dark:text-rose-400">{error}</p>}
    </div>
  )
}
