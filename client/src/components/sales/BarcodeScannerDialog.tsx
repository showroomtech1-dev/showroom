import { useEffect, useRef, useState } from "react"
import { CameraOff, Keyboard } from "lucide-react"
import { Dialog } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

/** Real product codes (EAN-8/13, UPC, SKUs) are at least this long; shorter reads are noise. */
const MIN_CODE_LENGTH = 6

interface Props {
  open: boolean
  onClose: () => void
  /** Called once per successful read; the dialog closes itself afterwards. */
  onDetected: (code: string) => void
}

/**
 * Scans product barcodes with the phone / laptop camera (back camera preferred). ZXing is loaded
 * only when the scanner opens, so it doesn't slow down the POS.
 *
 * Tuned for shop barcodes: HD video (thin 1D bars are unreadable at the default 640x480), only the
 * formats products actually use, "try harder" decoding, continuous autofocus and fast re-scans.
 */
export function BarcodeScannerDialog({ open, onClose, onDetected }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [starting, setStarting] = useState(true)
  const [manual, setManual] = useState("")

  // Keep the latest callbacks in refs so the camera isn't restarted whenever the parent re-renders.
  const onDetectedRef = useRef(onDetected)
  const onCloseRef = useRef(onClose)
  useEffect(() => {
    onDetectedRef.current = onDetected
    onCloseRef.current = onClose
  })

  useEffect(() => {
    if (!open) return
    let stop: (() => void) | null = null
    let cancelled = false
    setError(null)
    setStarting(true)
    setManual("")

    ;(async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error(
            window.isSecureContext
              ? "This browser can't use the camera. Use a barcode scanner or type the code below."
              : "The camera only works on a secure (https) page. Open the app over https, or type the code below."
          )
        }
        const [{ BrowserMultiFormatReader }, { BarcodeFormat, DecodeHintType }] = await Promise.all([
          import("@zxing/browser"),
          import("@zxing/library"),
        ])
        const hints = new Map<import("@zxing/library").DecodeHintType, unknown>()
        hints.set(DecodeHintType.POSSIBLE_FORMATS, [
          BarcodeFormat.EAN_13,
          BarcodeFormat.EAN_8,
          BarcodeFormat.UPC_A,
          BarcodeFormat.UPC_E,
          BarcodeFormat.CODE_128,
          BarcodeFormat.CODE_39,
          BarcodeFormat.QR_CODE,
          BarcodeFormat.DATA_MATRIX,
        ])
        hints.set(DecodeHintType.TRY_HARDER, true)
        // Noise on a blurry frame can "decode" as a short bogus code, so only accept a code that is long enough
        // and is read twice in a row.
        let lastText = ""
        let lastAt = 0
        let hits = 0
        const reader = new BrowserMultiFormatReader(hints, {
          delayBetweenScanAttempts: 80,
          delayBetweenScanSuccess: 400,
        })
        if (cancelled || !videoRef.current) return

        const controls = await reader.decodeFromConstraints(
          {
            video: {
              facingMode: { ideal: "environment" },
              width: { ideal: 1920 },
              height: { ideal: 1080 },
              // Not in every TS lib typing; keeps close-up barcodes sharp on phones that support it.
              advanced: [{ focusMode: "continuous" } as unknown as MediaTrackConstraintSet],
            },
            audio: false,
          },
          videoRef.current,
          (result, _err, ctrl) => {
            if (!result || cancelled) return
            const text = result.getText().trim()
            if (text.length < MIN_CODE_LENGTH) return
            const now = Date.now()
            hits = text === lastText && now - lastAt < 2000 ? hits + 1 : 1
            lastText = text
            lastAt = now
            if (hits < 2) return
            cancelled = true
            navigator.vibrate?.(80)
            ctrl.stop()
            onDetectedRef.current(text)
            onCloseRef.current()
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
              : err instanceof DOMException && err.name === "NotReadableError"
                ? "The camera is being used by another app or tab. Close it and try again."
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
  }, [open])

  const submitManual = () => {
    const code = manual.trim()
    if (!code) return
    onDetectedRef.current(code)
    onCloseRef.current()
  }

  return (
    <Dialog open={open} onClose={onClose} title="Scan a barcode" description="Hold the barcode flat in the box, 15–25 cm from the camera, in good light" maxWidth="max-w-md">
      <div className="space-y-3">
        {error ? (
          <div className="flex flex-col items-center gap-2 py-6 text-center text-sm text-slate-600 dark:text-slate-300">
            <CameraOff className="h-8 w-8 text-slate-400" />
            <p>{error}</p>
          </div>
        ) : (
          <div className="relative overflow-hidden rounded-xl bg-black">
            <video ref={videoRef} className="aspect-4/3 w-full object-cover" autoPlay muted playsInline />
            {/* Aiming guide */}
            <div className="pointer-events-none absolute inset-x-8 top-1/2 h-24 -translate-y-1/2 rounded-lg border-2 border-white/80" />
            {starting && <p className="absolute inset-x-0 bottom-3 text-center text-xs text-white/80">Starting camera…</p>}
          </div>
        )}

        <form
          className="flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            submitManual()
          }}
        >
          <div className="relative flex-1">
            <Keyboard className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={manual}
              onChange={(e) => setManual(e.target.value)}
              placeholder="Can't scan? Type the barcode or SKU"
              inputMode="text"
              className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
          </div>
          <Button type="submit" disabled={!manual.trim()}>
            Add
          </Button>
        </form>
      </div>
    </Dialog>
  )
}
