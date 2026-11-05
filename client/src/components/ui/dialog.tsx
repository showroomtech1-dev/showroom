import React, { useCallback, useEffect } from "react"
import { createPortal } from "react-dom"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"

export interface DialogProps {
  open: boolean
  onOpenChange?: (open: boolean) => void
  onClose?: () => void
  title?: string
  description?: string
  maxWidth?: string
  children: React.ReactNode
}

export function Dialog({
  open,
  onOpenChange,
  onClose,
  title,
  description,
  maxWidth,
  children,
}: DialogProps) {
  const handleClose = useCallback(() => {
    onClose?.()
    onOpenChange?.(false)
  }, [onClose, onOpenChange])

  useEffect(() => {
    if (!open) return
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose()
    }
    window.addEventListener("keydown", handleKey)
    return () => window.removeEventListener("keydown", handleKey)
  }, [open, handleClose])

  if (!open || typeof document === "undefined") return null

  const isSelfContained = Boolean(title || onClose)

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto p-0 sm:items-center sm:p-4">
      <div
        className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs transition-opacity"
        onClick={handleClose}
      />
      {isSelfContained ? (
        <DialogContent className={maxWidth} onClose={handleClose}>
          {title && (
            <DialogHeader className="shrink-0 pr-6">
              <DialogTitle>{title}</DialogTitle>
              {description && <DialogDescription>{description}</DialogDescription>}
            </DialogHeader>
          )}
          <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
        </DialogContent>
      ) : (
        children
      )}
    </div>,
    document.body
  )
}

export function DialogContent({
  className,
  children,
  onClose,
}: {
  className?: string
  children: React.ReactNode
  onClose?: () => void
}) {
  return (
    <div
      className={cn(
        "relative z-10 my-auto flex w-full max-h-[88vh] flex-col overflow-hidden rounded-t-2xl border border-slate-200 bg-white p-5 shadow-2xl sm:max-w-lg sm:rounded-2xl sm:p-6 dark:border-slate-800 dark:bg-slate-900",
        className
      )}
      onClick={(e) => e.stopPropagation()}
    >
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 cursor-pointer rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>
      )}
      {children}
    </div>
  )
}

export function DialogHeader({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn("mb-4 space-y-1", className)}>{children}</div>
}

export function DialogTitle({ className, children }: { className?: string; children: React.ReactNode }) {
  return <h2 className={cn("text-lg font-bold tracking-tight text-slate-900 dark:text-slate-50", className)}>{children}</h2>
}

export function DialogDescription({ className, children }: { className?: string; children: React.ReactNode }) {
  return <p className={cn("text-sm text-slate-500 dark:text-slate-400", className)}>{children}</p>
}

export function DialogFooter({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn("mt-6 flex flex-col-reverse gap-2.5 sm:flex-row sm:justify-end", className)}>{children}</div>
}
