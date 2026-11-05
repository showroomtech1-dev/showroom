import React, { useEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { Check, ChevronDown, Search } from "lucide-react"
import { cn } from "@/lib/utils"
import { FieldTooltip } from "@/components/ui/input"

export interface SelectOption {
  value: string
  label: string
  badge?: string
}

export interface SelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "onChange"> {
  label?: string
  error?: string
  hint?: string
  tooltip?: string
  placeholder?: string
  options?: SelectOption[]
  icon?: React.ReactNode
  onChange?: (e: React.ChangeEvent<HTMLSelectElement>) => void
  onValueChange?: (value: string) => void
  "data-cy"?: string
}

function extractChildrenOptions(children: React.ReactNode): SelectOption[] {
  const result: SelectOption[] = []
  React.Children.forEach(children, (child) => {
    if (!React.isValidElement<{ value?: string | number; children?: React.ReactNode }>(child)) return
    if (child.type === "option") {
      const val = child.props.value !== undefined ? String(child.props.value) : ""
      const label =
        typeof child.props.children === "string" || typeof child.props.children === "number"
          ? String(child.props.children)
          : Array.isArray(child.props.children)
            ? child.props.children.join("")
            : val
      result.push({ value: val, label: label.trim() })
    }
  })
  return result
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  (
    {
      className,
      label,
      error,
      hint,
      tooltip,
      placeholder,
      options,
      icon,
      children,
      id,
      name,
      value,
      defaultValue,
      disabled,
      required,
      onChange,
      onValueChange,
      "data-cy": dataCy,
      ...rest
    },
    ref
  ) => {
    const [internalValue, setInternalValue] = useState<string>(
      defaultValue !== undefined ? String(defaultValue) : ""
    )
    const [open, setOpen] = useState(false)
    const [search, setSearch] = useState("")
    const [highlightedIndex, setHighlightedIndex] = useState<number>(-1)
    const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null)

    const triggerRef = useRef<HTMLButtonElement>(null)
    const menuRef = useRef<HTMLDivElement>(null)
    const searchInputRef = useRef<HTMLInputElement>(null)

    const currentValue = value !== undefined ? String(value) : internalValue

    const allOptions = useMemo<SelectOption[]>(() => {
      const list: SelectOption[] = []
      if (placeholder !== undefined) {
        list.push({ value: "", label: placeholder })
      }
      const base = options ? options : extractChildrenOptions(children)
      for (const opt of base) {
        if (placeholder !== undefined && opt.value === "" && list.length > 0) continue
        list.push(opt)
      }
      return list
    }, [placeholder, options, children])

    const selectedOption = useMemo(
      () => allOptions.find((o) => o.value === currentValue) ?? allOptions[0],
      [allOptions, currentValue]
    )

    const showSearch = allOptions.length > 7

    const filteredOptions = useMemo(() => {
      if (!showSearch || !search.trim()) return allOptions
      const q = search.trim().toLowerCase()
      return allOptions.filter((o) => o.label.toLowerCase().includes(q))
    }, [allOptions, showSearch, search])

    const updateRect = () => {
      if (triggerRef.current) {
        setAnchorRect(triggerRef.current.getBoundingClientRect())
      }
    }

    const openMenu = () => {
      if (disabled) return
      updateRect()
      setSearch("")
      const idx = allOptions.findIndex((o) => o.value === currentValue)
      setHighlightedIndex(idx >= 0 ? idx : 0)
      setOpen(true)
    }

    const closeMenu = () => {
      setOpen(false)
      setSearch("")
    }

    const commitValue = (newValue: string) => {
      if (value === undefined) {
        setInternalValue(newValue)
      }
      onValueChange?.(newValue)
      if (onChange) {
        const syntheticEvent = {
          target: { value: newValue, name: name ?? "", id: id ?? "" },
          currentTarget: { value: newValue, name: name ?? "", id: id ?? "" },
          preventDefault: () => {},
          stopPropagation: () => {},
        } as unknown as React.ChangeEvent<HTMLSelectElement>
        onChange(syntheticEvent)
      }
      closeMenu()
    }

    useEffect(() => {
      if (!open) return
      if (showSearch) {
        requestAnimationFrame(() => searchInputRef.current?.focus())
      }

      const handleMouseDown = (e: MouseEvent) => {
        const target = e.target as Node
        if (
          triggerRef.current &&
          !triggerRef.current.contains(target) &&
          menuRef.current &&
          !menuRef.current.contains(target)
        ) {
          closeMenu()
        }
      }

      const handleScrollOrResize = (e: Event) => {
        if (menuRef.current && e.target instanceof Node && menuRef.current.contains(e.target)) {
          return
        }
        updateRect()
      }

      document.addEventListener("mousedown", handleMouseDown)
      window.addEventListener("resize", handleScrollOrResize)
      window.addEventListener("scroll", handleScrollOrResize, true)
      return () => {
        document.removeEventListener("mousedown", handleMouseDown)
        window.removeEventListener("resize", handleScrollOrResize)
        window.removeEventListener("scroll", handleScrollOrResize, true)
      }
    }, [open, showSearch])

    const handleKeyDown = (e: React.KeyboardEvent) => {
      if (disabled) return
      if (!open) {
        if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown" || e.key === "ArrowUp") {
          e.preventDefault()
          openMenu()
        }
        return
      }

      if (e.key === "Escape") {
        e.preventDefault()
        closeMenu()
        triggerRef.current?.focus()
      } else if (e.key === "ArrowDown") {
        e.preventDefault()
        setHighlightedIndex((prev) =>
          filteredOptions.length === 0 ? -1 : (prev + 1) % filteredOptions.length
        )
      } else if (e.key === "ArrowUp") {
        e.preventDefault()
        setHighlightedIndex((prev) =>
          filteredOptions.length === 0
            ? -1
            : (prev - 1 + filteredOptions.length) % filteredOptions.length
        )
      } else if (e.key === "Enter") {
        e.preventDefault()
        const picked = filteredOptions[highlightedIndex]
        if (picked) {
          commitValue(picked.value)
          triggerRef.current?.focus()
        }
      } else if (e.key === "Tab") {
        closeMenu()
      }
    }

    const isPlaceholderSelected =
      placeholder !== undefined && currentValue === "" && selectedOption?.value === ""

    // Compute portal position
    const menuMaxHeight = showSearch ? 300 : 256
    const openUpward =
      anchorRect !== null &&
      anchorRect.bottom + menuMaxHeight + 12 > window.innerHeight &&
      anchorRect.top > window.innerHeight - anchorRect.bottom

    const menuStyle: React.CSSProperties | undefined = anchorRect
      ? {
          position: "fixed",
          width: Math.max(anchorRect.width, 190),
          maxWidth: "calc(100vw - 16px)",
          left: Math.min(
            Math.max(8, anchorRect.left),
            window.innerWidth - Math.max(anchorRect.width, 190) - 8
          ),
          ...(openUpward
            ? { bottom: window.innerHeight - anchorRect.top + 6 }
            : { top: anchorRect.bottom + 6 }),
        }
      : undefined

    return (
      <div className="w-full space-y-1.5">
        {label && (
          <div className="flex items-center gap-1.5">
            <label
              htmlFor={id}
              title={label}
              className="block truncate whitespace-nowrap text-xs font-semibold tracking-wide text-slate-700 dark:text-slate-300"
            >
              {label}
            </label>
            {tooltip && <FieldTooltip text={tooltip} />}
          </div>
        )}

        {/* Hidden native select for form compatibility / refs if needed */}
        <select
          ref={ref}
          id={id ? `${id}-native` : undefined}
          name={name}
          value={currentValue}
          required={required}
          disabled={disabled}
          tabIndex={-1}
          aria-hidden="true"
          onChange={(e) => commitValue(e.target.value)}
          className="sr-only pointer-events-none"
          {...rest}
        >
          {allOptions.map((opt) => (
            <option key={`${opt.value}-${opt.label}`} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>

        <button
          ref={triggerRef}
          id={id}
          type="button"
          disabled={disabled}
          aria-haspopup="listbox"
          aria-expanded={open}
          data-cy={dataCy}
          onClick={() => (open ? closeMenu() : openMenu())}
          onKeyDown={handleKeyDown}
          className={cn(
            "group flex h-10 w-full items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-left text-sm transition-all hover:border-slate-300 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-slate-600 cursor-pointer",
            open && "border-indigo-500 ring-2 ring-indigo-500/20 dark:border-indigo-500",
            error && "border-rose-500 focus:border-rose-500 focus:ring-rose-500/20",
            className
          )}
        >
          <span className="flex items-center gap-2 min-w-0 flex-1">
            {icon && <span className="shrink-0 text-indigo-600 dark:text-indigo-400">{icon}</span>}
            <span
              className={cn(
                "truncate font-medium",
                isPlaceholderSelected
                  ? "text-slate-400 dark:text-slate-500 font-normal"
                  : "text-slate-900 dark:text-slate-100"
              )}
            >
              {selectedOption ? selectedOption.label : placeholder || "Select..."}
            </span>
            {selectedOption?.badge && (
              <span className="shrink-0 rounded-md bg-indigo-50 px-1.5 py-0.5 text-[10px] font-bold text-indigo-600 dark:bg-indigo-950/80 dark:text-indigo-300">
                {selectedOption.badge}
              </span>
            )}
          </span>

          <ChevronDown
            className={cn(
              "h-4 w-4 shrink-0 text-slate-400 transition-transform duration-150 group-hover:text-slate-600 dark:group-hover:text-slate-300",
              open && "rotate-180 text-indigo-600 dark:text-indigo-400"
            )}
          />
        </button>

        {open &&
          anchorRect &&
          createPortal(
            <div
              ref={menuRef}
              style={menuStyle}
              role="listbox"
              onKeyDown={handleKeyDown}
              className="z-[120] overflow-hidden rounded-2xl border border-slate-200/90 bg-white/98 p-1.5 shadow-2xl ring-1 ring-slate-900/5 backdrop-blur-md dark:border-slate-700/90 dark:bg-slate-900/98 dark:ring-white/10"
            >
              {showSearch && (
                <div className="relative mb-1.5 border-b border-slate-100 pb-1.5 dark:border-slate-800">
                  <Search className="pointer-events-none absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-400" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value)
                      setHighlightedIndex(0)
                    }}
                    placeholder="Filter options..."
                    className="h-7 w-full rounded-lg bg-slate-50 pl-8 pr-2.5 text-xs text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:bg-slate-800/70 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:bg-slate-800"
                  />
                </div>
              )}

              <div className="max-h-60 overflow-y-auto overscroll-contain space-y-0.5 pr-0.5">
                {filteredOptions.length === 0 ? (
                  <div className="px-3 py-4 text-center text-xs text-slate-400 dark:text-slate-500">
                    No matching options
                  </div>
                ) : (
                  filteredOptions.map((opt, idx) => {
                    const isSelected = opt.value === currentValue
                    const isHighlighted = idx === highlightedIndex
                    const isPlaceholder = placeholder !== undefined && opt.value === ""

                    return (
                      <button
                        key={`${opt.value}-${idx}`}
                        type="button"
                        role="option"
                        aria-selected={isSelected}
                        onMouseEnter={() => setHighlightedIndex(idx)}
                        onClick={() => commitValue(opt.value)}
                        className={cn(
                          "flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-left text-xs sm:text-sm transition-colors cursor-pointer",
                          isSelected
                            ? "bg-indigo-50/90 font-semibold text-indigo-700 dark:bg-indigo-950/70 dark:text-indigo-300"
                            : isHighlighted
                              ? "bg-slate-100/90 text-slate-900 dark:bg-slate-800/80 dark:text-slate-100"
                              : isPlaceholder
                                ? "text-slate-400 dark:text-slate-500"
                                : "font-medium text-slate-700 hover:bg-slate-100/80 dark:text-slate-200 dark:hover:bg-slate-800/70"
                        )}
                      >
                        <span className="flex items-center gap-2 min-w-0 flex-1">
                          <span className="truncate">{opt.label}</span>
                          {opt.badge && (
                            <span
                              className={cn(
                                "shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-bold",
                                isSelected
                                  ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/80 dark:text-indigo-200"
                                  : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                              )}
                            >
                              {opt.badge}
                            </span>
                          )}
                        </span>
                        {isSelected && (
                          <Check className="h-3.5 w-3.5 shrink-0 text-indigo-600 dark:text-indigo-400" />
                        )}
                      </button>
                    )
                  })
                )}
              </div>
            </div>,
            document.body
          )}

        {error ? (
          <p className="text-xs font-medium text-rose-600 dark:text-rose-400">{error}</p>
        ) : hint ? (
          <p className="text-[11px] text-slate-500 dark:text-slate-400">{hint}</p>
        ) : null}
      </div>
    )
  }
)

Select.displayName = "Select"
