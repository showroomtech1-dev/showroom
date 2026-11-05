import { useCallback, useState } from "react"
import { ScanLine } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { BarcodeScannerDialog } from "@/components/sales/BarcodeScannerDialog"

interface BarcodeFieldProps {
  value: string
  onChange: (value: string) => void
  label?: string
  disabled?: boolean
}

/** Barcode text box with a Scan button: point the camera at the product's label to fill it in (or just type it). */
export function BarcodeField({ value, onChange, label = "Barcode (Optional)", disabled }: BarcodeFieldProps) {
  const [scanning, setScanning] = useState(false)
  const close = useCallback(() => setScanning(false), [])
  const detected = useCallback((code: string) => onChange(code.trim()), [onChange])

  return (
    <>
      <div className="flex items-end gap-2">
        <div className="min-w-0 flex-1">
          <Input
            label={label}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Scan or type the number on the product label"
            disabled={disabled}
            tooltip="The number printed under the product's barcode. Once saved, scanning that barcode at the POS adds this product to the sale."
          />
        </div>
        <Button type="button" variant="outline" className="h-10 shrink-0" onClick={() => setScanning(true)} disabled={disabled}>
          <ScanLine className="h-4 w-4" />
          Scan
        </Button>
      </div>
      <BarcodeScannerDialog open={scanning} onClose={close} onDetected={detected} />
    </>
  )
}
