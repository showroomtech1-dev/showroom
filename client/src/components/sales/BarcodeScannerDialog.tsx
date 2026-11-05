import { useEffect, useRef, useState } from "react"
import { CameraOff } from "lucide-react"
import { Dialog } from "@/components/ui/dialog"

interface Props {
  open: boolean
  onClose: () => void
  /** Called once per successful read; the dialog closes itself afterwards. */
  onDetected: (code: string) => void
}

/**
 * Scans product barcodes with the phone / laptop camera (back camera preferred). ZXing is loaded
 * only when the scanner opens, so it doesn't slow down the POS.
 */
export function BarcodeScannerDialog({ open, onClose, onDetected }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [starting, setStarting] = useState(true)

  useEffect(() => {
    if (!open) return
    let stop: (() => void) | null = null
    let cancelled = false
    setError(null)
    setStarting(true)

    ;(async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error("This browser can't use the camera. Use a barcode scanner or type the code.")
        const { BrowserMultiFormatReader } = await import("@zxing/browser")
        const reader = new BrowserMultiFormatReader()
        if (cancelled || !videoRef.current) return
        const controls = await reader.decodeFromConstraints(
          { video: { facingMode: { ideal: "environment" } }, audio: false },
          videoRef.current,
          (result) => {
            if (result && !cancelled) {
              cancelled = true
              navigator.vibrate?.(80)
              controls.stop()
              onDetected(result.getText())
              onClose()
            }
          }
        )
        stop = () => controls.stop()
        if (cancelled) controls.stop()
        setStarting(false)
      } catch (err) {
        const message =
          err instanceof DOMException && err.name === "NotAllowedError"
            ? "Camera permission was denied. Allow camera access for this site in your browser settings."
            : err instanceof DOMException && err.name === "NotFoundError"
              ? "No camera was found on this device."
              : err instanceof Error
                ? err.message
                : "The camera could not be started."
        setError(message)
        setStarting(false)
      }
    })()

    return () => {
      cancelled = true
      stop?.()
    }
  }, [open, onClose, onDetected])

  return (
    <Dialog open={open} onClose={onClose} title="Scan a barcode" description="Point the camera at the product's barcode" maxWidth="max-w-md">
      {error ? (
        <div className="flex flex-col items-center gap-2 py-8 text-center text-sm text-slate-600 dark:text-slate-300">
          <CameraOff className="h-8 w-8 text-slate-400" />
          <p>{error}</p>
        </div>
      ) : (
        <div className="relative overflow-hidden rounded-xl bg-black">
          <video ref={videoRef} className="aspect-[4/3] w-full object-cover" muted playsInline />
          {/* Aiming guide */}
          <div className="pointer-events-none absolute inset-x-8 top-1/2 h-24 -translate-y-1/2 rounded-lg border-2 border-white/80" />
          {starting && <p className="absolute inset-x-0 bottom-3 text-center text-xs text-white/80">Starting camera…</p>}
        </div>
      )}
    </Dialog>
  )
}
