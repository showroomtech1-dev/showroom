import React, { useEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { Check, ChevronDown, Search } from "lucide-react"
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
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null)

  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  const activeDial = value?.trim().startsWith("+") ? parsed.dial : selectedDial
  const localPart = value?.trim().startsWith("+") ? parsed.local : value
  const activeCountry =
    COUNTRY_DIAL_OPTIONS.find((c) => c.dial === activeDial) ?? COUNTRY_DIAL_OPTIONS[0]

  const filteredCountries = useMemo(() => {
    if (!search.trim()) return COUNTRY_DIAL_OPTIONS
    const q = search.trim().toLowerCase()
    return COUNTRY_DIAL_OPTIONS.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.code.toLowerCase().includes(q) ||
        c.dial.includes(q)
    )
  }, [search])

  const handleDialChange = (newDial: string) => {
    setSelectedDial(newDial)
    const cleanLocal = localPart.replace(/^0+/, "").trim()
    if (cleanLocal) {
      onChange(`${newDial}${cleanLocal}`)
    }
    setOpen(false)
    setSearch("")
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

  useEffect(() => {
    if (!open) return
    requestAnimationFrame(() => searchInputRef.current?.focus())

    const handleMouseDown = (e: MouseEvent) => {
      const target = e.target as Node
      if (
        triggerRef.current &&
        !triggerRef.current.contains(target) &&
        menuRef.current &&
        !menuRef.current.contains(target)
      ) {
        setOpen(false)
        setSearch("")
      }
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false)
        setSearch("")
      }
    }

    document.addEventListener("mousedown", handleMouseDown)
    document.addEventListener("keydown", handleKeyDown)
    return () => {
      document.removeEventListener("mousedown", handleMouseDown)
      document.removeEventListener("keydown", handleKeyDown)
    }
  }, [open])

  const toggleDropdown = () => {
    if (!open && triggerRef.current) {
      setAnchorRect(triggerRef.current.getBoundingClientRect())
      setSearch("")
    }
    setOpen((o) => !o)
  }

  const openUpward =
    anchorRect !== null &&
    anchorRect.bottom + 280 > window.innerHeight &&
    anchorRect.top > window.innerHeight - anchorRect.bottom

  const menuStyle: React.CSSProperties | undefined = anchorRect
    ? {
        position: "fixed",
        width: 268,
        left: Math.min(Math.max(8, anchorRect.left), window.innerWidth - 276),
        ...(openUpward
          ? { bottom: window.innerHeight - anchorRect.top + 6 }
          : { top: anchorRect.bottom + 6 }),
      }
    : undefined

  return (
    <div className="w-full space-y-1.5">
      {label && (
        <label
          htmlFor={id}
          title={label}
          className="block truncate whitespace-nowrap text-xs font-semibold tracking-wide text-slate-700 dark:text-slate-300"
        >
          {label}
        </label>
      )}

      <div
        className={cn(
          "flex w-full items-center overflow-hidden rounded-xl border border-slate-200 bg-white transition-all focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-900",
          compact ? "h-9" : "h-10",
          open && "border-indigo-500 ring-2 ring-indigo-500/20",
          error && "border-rose-500 focus-within:border-rose-500 focus-within:ring-rose-500/20",
          className
        )}
      >
        <button
          ref={triggerRef}
          type="button"
          aria-label="Country code"
          aria-expanded={open}
          onClick={toggleDropdown}
          data-cy={dataCy ? `${dataCy}-country` : undefined}
          className={cn(
            "flex h-full shrink-0 items-center gap-1.5 border-r border-slate-200 bg-slate-50/90 px-2.5 font-semibold text-slate-800 transition-colors hover:bg-slate-100 focus:outline-none dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-100 dark:hover:bg-slate-800 cursor-pointer",
            compact ? "text-xs" : "text-xs sm:text-sm"
          )}
        >
          <span>{activeCountry.flag}</span>
          <span>{activeCountry.dial}</span>
          <ChevronDown
            className={cn(
              "h-3.5 w-3.5 text-slate-400 transition-transform duration-150",
              open && "rotate-180 text-indigo-600 dark:text-indigo-400"
            )}
          />
        </button>

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

      {open &&
        anchorRect &&
        createPortal(
          <div
            ref={menuRef}
            style={menuStyle}
            className="z-[120] overflow-hidden rounded-2xl border border-slate-200/90 bg-white/98 p-1.5 shadow-2xl ring-1 ring-slate-900/5 backdrop-blur-md dark:border-slate-700/90 dark:bg-slate-900/98 dark:ring-white/10"
          >
            <div className="relative mb-1.5 border-b border-slate-100 pb-1.5 dark:border-slate-800">
              <Search className="pointer-events-none absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-400" />
              <input
                ref={searchInputRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search country or +code..."
                className="h-7 w-full rounded-lg bg-slate-50 pl-8 pr-2.5 text-xs text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:bg-slate-800/70 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:bg-slate-800"
              />
            </div>

            <div className="max-h-56 overflow-y-auto overscroll-contain space-y-0.5 pr-0.5">
              {filteredCountries.length === 0 ? (
                <div className="px-3 py-4 text-center text-xs text-slate-400">No country found</div>
              ) : (
                filteredCountries.map((c) => {
                  const isSelected = c.dial === activeDial
                  return (
                    <button
                      key={c.code}
                      type="button"
                      onClick={() => handleDialChange(c.dial)}
                      className={cn(
                        "flex w-full items-center justify-between gap-2 rounded-xl px-2.5 py-2 text-left text-xs transition-colors cursor-pointer",
                        isSelected
                          ? "bg-indigo-50/90 font-semibold text-indigo-700 dark:bg-indigo-950/70 dark:text-indigo-300"
                          : "font-medium text-slate-700 hover:bg-slate-100/80 dark:text-slate-200 dark:hover:bg-slate-800/70"
                      )}
                    >
                      <span className="flex items-center gap-2 min-w-0">
                        <span className="text-sm">{c.flag}</span>
                        <span className="truncate">{c.name}</span>
                      </span>
                      <span className="flex items-center gap-1.5 shrink-0">
                        <span className="font-mono text-[11px] font-bold text-slate-500 dark:text-slate-400">
                          {c.dial}
                        </span>
                        {isSelected && (
                          <Check className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
                        )}
                      </span>
                    </button>
                  )
                })
              )}
            </div>
          </div>,
          document.body
        )}

      {hint && !error && <p className="text-[11px] text-slate-500 dark:text-slate-400">{hint}</p>}
      {error && <p className="text-xs font-medium text-rose-600 dark:text-rose-400">{error}</p>}
    </div>
  )
}
