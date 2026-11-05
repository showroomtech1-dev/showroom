import React from "react"
import { cn } from "@/lib/utils"

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "secondary" | "outline" | "ghost" | "destructive" | "emerald"
  size?: "default" | "sm" | "lg" | "icon"
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", ...props }, ref) => {
    const variants: Record<NonNullable<ButtonProps["variant"]>, string> = {
      default:
        "bg-indigo-600 text-white hover:bg-indigo-700 active:bg-indigo-800 shadow-xs shadow-indigo-500/15 dark:bg-indigo-500 dark:hover:bg-indigo-600",
      emerald:
        "bg-emerald-600 text-white hover:bg-emerald-700 active:bg-emerald-800 shadow-xs shadow-emerald-500/15",
      secondary:
        "bg-slate-100 text-slate-900 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700",
      outline:
        "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800",
      ghost:
        "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white",
      destructive:
        "bg-rose-600 text-white hover:bg-rose-700 active:bg-rose-800 shadow-xs shadow-rose-500/15",
    }

    const sizes: Record<NonNullable<ButtonProps["size"]>, string> = {
      default: "h-10 px-4 py-2 text-sm",
      sm: "h-8 px-3 text-xs",
      lg: "h-11 px-6 text-base",
      icon: "h-9 w-9 p-0",
    }

    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40 disabled:pointer-events-none disabled:opacity-50 cursor-pointer select-none",
          variants[variant],
          sizes[size],
          className
        )}
        {...props}
      />
    )
  }
)

Button.displayName = "Button"
