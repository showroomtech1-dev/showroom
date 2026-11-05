import { useCallback, useMemo, useState } from "react"
import { Barcode, Camera, Minus, Plus, ShoppingCart, Trash2, UserPlus, X } from "lucide-react"
import { toast } from "sonner"
import { useAuth } from "@/contexts/AuthContext"
import { usePosSearch } from "@/hooks/useProducts"
import { useStockLevels } from "@/hooks/useInventory"
import { useCustomers } from "@/hooks/useCustomers"
import { useAccounts } from "@/hooks/useFinance"
import { useOrganization } from "@/hooks/useOrganization"
import { useCreateSale } from "@/hooks/useSales"
import { useDebounce } from "@/hooks/useDebounce"
import { formatMoney, fromKobo, toKobo } from "@/lib/money"
import { isConnectivityFailure, offlineSales } from "@/lib/offlineSales"
import { priceCart } from "@/lib/pricing"
import { ApiError } from "@/transport/http"
import { newClientRef } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { BarcodeScannerDialog } from "@/components/sales/BarcodeScannerDialog"
import { PosReceiptDialog } from "@/components/sales/PosReceiptDialog"
import { RefusedOfflineSales } from "@/components/sales/RefusedOfflineSales"
import { ProductEndpoints } from "@/endpoints/product.endpoints"
import type { PosItem } from "@/types/inventory.types"
import type { SaleCreatedResult } from "@/types/sale.types"

interface CartLine {
  variantId: string
  label: string
  sku: string
  maxQty: number
  quantity: number
  unitPriceNaira: string
  listPriceKobo: number
}

interface PaymentLine {
  method: "cash" | "transfer" | "pos" | "cheque"
  accountId: string
  amountNaira: string
  reference: string
}

export default function PosPage() {
  const { can, activeBranchId, user } = useAuth()
  const canOverridePrice = can("sale.priceoverride")
  const [query, setQuery] = useState("")
  const debouncedQuery = useDebounce(query, 200)
  const [cart, setCart] = useState<CartLine[]>([])
  const [mobileCartOpen, setMobileCartOpen] = useState(false)
  const [customerId, setCustomerId] = useState("")
  const [walkInMode, setWalkInMode] = useState(false)
  const [walkInName, setWalkInName] = useState("")
  const [walkInPhone, setWalkInPhone] = useState("")
  const [discountType, setDiscountType] = useState<"amount" | "percent">("amount")
  const [discountInput, setDiscountInput] = useState("")
  const [dueDate, setDueDate] = useState("")
  const [notes, setNotes] = useState("")
  const [payments, setPayments] = useState<PaymentLine[]>([
    { method: "cash", accountId: "", amountNaira: "", reference: "" },
  ])
  const [receiptResult, setReceiptResult] = useState<SaleCreatedResult | null>(null)
  const [scannerOpen, setScannerOpen] = useState(false)

  const posSearch = usePosSearch(debouncedQuery, activeBranchId || undefined)
  const defaultLevels = useStockLevels({
    limit: 24,
    branchId: activeBranchId || undefined,
  })
  const customersQuery = useCustomers({ limit: 100 })
  const accountsQuery = useAccounts()
  const orgQuery = useOrganization()
  const createSale = useCreateSale()

  const catalogItems: PosItem[] = useMemo(() => {
    if (debouncedQuery.trim()) return posSearch.data ?? []
    return (defaultLevels.data?.data ?? []).map((row) => ({
      variantId: row.variantId,
      productId: row.productId,
      productName: row.productName,
      variantName: row.variantName,
      label:
        row.variantName && row.variantName !== "Default"
          ? `${row.productName} (${row.variantName})`
          : row.productName,
      sku: row.sku,
      barcode: row.barcode,
      unit: row.unit,
      sellingPrice: row.sellingPrice,
      quantity: row.quantity,
      photoUrl: null,
    }))
  }, [debouncedQuery, posSearch.data, defaultLevels.data])

  const addItemToCart = (item: PosItem) => {
    setCart((prev) => {
      const existing = prev.find((c) => c.variantId === item.variantId)
      if (existing) {
        return prev.map((c) =>
          c.variantId === item.variantId ? { ...c, quantity: c.quantity + 1 } : c
        )
      }
      return [
        ...prev,
        {
          variantId: item.variantId,
          label: item.label || item.productName,
          sku: item.sku,
          maxQty: item.quantity,
          quantity: 1,
          unitPriceNaira: String(fromKobo(item.sellingPrice)),
          listPriceKobo: item.sellingPrice,
        },
      ]
    })
  }

  // Same maths as the server: VAT only when enabled, and either included in prices or added on top.
  const discountValue = discountType === "percent" ? Math.max(0, Number(discountInput) || 0) : toKobo(discountInput)
  const totals = priceCart(
    cart.reduce((sum, c) => sum + toKobo(c.unitPriceNaira) * c.quantity, 0),
    discountInput ? { type: discountType, value: discountValue } : null,
    orgQuery.data
  )
  /** Adds the product whose barcode / SKU is exactly `code`; falls back to `fallback` (a single search hit). */
  const addByCode = async (code: string, fallback: PosItem | null) => {
    const res = await ProductEndpoints.byBarcode(code, activeBranchId || undefined)
    if (res.success && res.data) {
      addItemToCart(res.data)
      setQuery("")
      toast.success(`Added ${res.data.label || res.data.productName}`)
    } else if (fallback) {
      addItemToCart(fallback)
      setQuery("")
    } else {
      setQuery(code)
      toast.error(`No product with barcode or SKU "${code}"`)
    }
  }

  const closeScanner = useCallback(() => setScannerOpen(false), [])
  const handleScanned = useCallback(
    (code: string) => void addByCode(code, null),
    [activeBranchId]
  )

  const subtotalKobo = totals.subtotal
  const discountKobo = totals.discount
  const taxKobo = totals.taxAmount
  const totalKobo = totals.total
  const paidKobo = payments.reduce((s, p) => s + toKobo(p.amountNaira), 0)
  const balanceKobo = Math.max(0, totalKobo - paidKobo)

  const resetTerminal = () => {
    setCart([])
    setCustomerId("")
    setWalkInMode(false)
    setWalkInName("")
    setWalkInPhone("")
    setDiscountInput("")
    setDueDate("")
    setNotes("")
    setPayments([{ method: "cash", accountId: "", amountNaira: "", reference: "" }])
  }

  const handleCheckout = async () => {
    if (cart.length === 0) return toast.error("Add at least one item to the cart")
    const validPayments = payments
      .filter((p) => toKobo(p.amountNaira) > 0)
      .map((p) => ({
        method: p.method,
        accountId: p.accountId || undefined,
        amount: toKobo(p.amountNaira),
        reference: p.reference || undefined,
      }))

    if (validPayments.length === 0 && !customerId && !(walkInMode && walkInName.trim())) {
      return toast.error("Credit sales require selecting or adding a customer")
    }

    const payload: Record<string, unknown> = {
      clientRef: newClientRef(),
      branchId: activeBranchId || undefined,
      customerId: customerId || undefined,
      customer:
        !customerId && walkInMode && walkInName.trim()
          ? { name: walkInName.trim(), phone: walkInPhone.trim() || undefined }
          : undefined,
      items: cart.map((c) => ({
        variantId: c.variantId,
        quantity: c.quantity,
        unitPrice: canOverridePrice ? toKobo(c.unitPriceNaira) : undefined,
      })),
      discount: discountInput && discountValue > 0 ? { type: discountType, value: discountValue } : undefined,
      payments: validPayments,
      dueDate: balanceKobo > 0 && dueDate ? dueDate : undefined,
      notes: notes.trim() || undefined,
    }

    // No connection: keep the sale on this device (with the time it happened) and sync it later.
    const saveOffline = () => {
      const customerName = customersQuery.data?.data.find((c) => c.id === customerId)?.name ?? (walkInMode ? walkInName.trim() : null)
      offlineSales.add({
        userId: user?.id ?? "",
        clientRef: payload.clientRef as string,
        payload: { ...payload, soldAt: new Date().toISOString() },
        summary: { items: cart.reduce((s, c) => s + c.quantity, 0), total: totalKobo, customer: customerName || null },
      })
      toast.success("No connection — sale saved on this device. It will sync automatically.")
      resetTerminal()
      setMobileCartOpen(false)
    }
    if (!navigator.onLine) return saveOffline()

    try {
      const res = await createSale.mutateAsync(payload)
      setReceiptResult(res)
      resetTerminal()
      setMobileCartOpen(false)
    } catch (err) {
      if (err instanceof ApiError && isConnectivityFailure(err.statusCode)) return saveOffline()
      toast.error(err instanceof Error ? err.message : "Failed to complete sale")
    }
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-12" data-cy="pos-page">
      {/* Left: Catalog & Barcode Search */}
      <div className="space-y-4 lg:col-span-7 xl:col-span-8">
        <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-3 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <Barcode className="h-5 w-5 shrink-0 text-blue-600 dark:text-blue-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              // Handheld scanners type the code and press Enter: try an exact barcode / SKU match first.
              if (e.key === "Enter" && query.trim()) void addByCode(query.trim(), catalogItems.length === 1 ? catalogItems[0] : null)
            }}
            placeholder="Scan barcode or search product name, SKU, model..."
            className="w-full bg-transparent text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none dark:text-slate-100"
            data-cy="pos-search-input"
          />
          {query && (
            <button onClick={() => setQuery("")} className="text-slate-400 hover:text-slate-600" aria-label="Clear search">
              <X className="h-4 w-4" />
            </button>
          )}
          <button
            type="button"
            onClick={() => setScannerOpen(true)}
            className="flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            aria-label="Scan barcode with camera"
            data-cy="pos-camera-scan"
          >
            <Camera className="h-4 w-4" />
            <span className="hidden sm:inline">Scan</span>
          </button>
        </div>
        <BarcodeScannerDialog open={scannerOpen} onClose={closeScanner} onDetected={handleScanned} />
        <RefusedOfflineSales />

        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-4">
          {catalogItems.map((item) => (
            <button
              key={item.variantId}
              type="button"
              onClick={() => addItemToCart(item)}
              className="group flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-3 text-left transition hover:border-blue-500 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:hover:border-blue-500"
              data-cy={`pos-item-${item.sku}`}
            >
              <div>
                <div className="flex items-center justify-between gap-1">
                  <span className="truncate font-mono text-[10px] text-slate-400">{item.sku}</span>
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                      item.quantity > 0
                        ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"
                        : "bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300"
                    }`}
                  >
                    {item.quantity} {item.unit}
                  </span>
                </div>
                <p className="mt-1.5 line-clamp-2 text-xs font-semibold text-slate-900 group-hover:text-blue-600 dark:text-slate-100 dark:group-hover:text-blue-400">
                  {item.label || item.productName}
                </p>
              </div>
              <p className="mt-3 text-sm font-bold text-slate-900 dark:text-slate-100">
                {formatMoney(item.sellingPrice)}
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* Right: Cart & Checkout Drawer */}
      <div
        className={`${
          mobileCartOpen ? "fixed inset-0 z-50 bg-black/60 p-3 lg:static lg:bg-transparent lg:p-0" : "hidden lg:block"
        } lg:col-span-5 xl:col-span-4`}
      >
        <div className="flex h-full max-h-[calc(100vh-5rem)] flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <ShoppingCart className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Current Sale ({cart.reduce((s, i) => s + i.quantity, 0)})
              </h2>
            </div>
            <div className="flex items-center gap-1">
              {cart.length > 0 && (
                <Button variant="ghost" size="sm" onClick={resetTerminal}>
                  Clear
                </Button>
              )}
              <button onClick={() => setMobileCartOpen(false)} className="p-1 lg:hidden">
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Cart Items */}
          <div className="my-3 flex-1 space-y-2 overflow-y-auto pr-1">
            {cart.length === 0 ? (
              <p className="py-10 text-center text-xs text-slate-400">
                Tap any product or scan a barcode to add items
              </p>
            ) : (
              cart.map((line) => (
                <div
                  key={line.variantId}
                  className="rounded-lg border border-slate-200 p-2.5 dark:border-slate-800"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs font-medium text-slate-900 dark:text-slate-100">{line.label}</p>
                    <button
                      onClick={() => setCart((c) => c.filter((x) => x.variantId !== line.variantId))}
                      className="text-slate-400 hover:text-rose-600"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() =>
                          setCart((c) =>
                            c.map((x) =>
                              x.variantId === line.variantId
                                ? { ...x, quantity: Math.max(1, x.quantity - 1) }
                                : x
                            )
                          )
                        }
                        className="rounded border border-slate-200 p-1 dark:border-slate-700"
                      >
                        <Minus className="h-3 w-3" />
                      </button>
                      <span className="w-7 text-center text-xs font-semibold">{line.quantity}</span>
                      <button
                        type="button"
                        onClick={() =>
                          setCart((c) =>
                            c.map((x) =>
                              x.variantId === line.variantId ? { ...x, quantity: x.quantity + 1 } : x
                            )
                          )
                        }
                        className="rounded border border-slate-200 p-1 dark:border-slate-700"
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                    </div>
                    {canOverridePrice ? (
                      <input
                        type="number"
                        value={line.unitPriceNaira}
                        onChange={(e) =>
                          setCart((c) =>
                            c.map((x) =>
                              x.variantId === line.variantId ? { ...x, unitPriceNaira: e.target.value } : x
                            )
                          )
                        }
                        className="w-24 rounded border border-slate-300 px-2 py-1 text-right text-xs dark:border-slate-700 dark:bg-slate-800"
                      />
                    ) : (
                      <span className="text-xs font-semibold">
                        {formatMoney(toKobo(line.unitPriceNaira) * line.quantity)}
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Customer & Payments */}
          <div className="space-y-2.5 border-t border-slate-200 pt-3 text-xs dark:border-slate-800">
            <div className="flex items-center gap-2">
              {!walkInMode ? (
                <Select
                  value={customerId}
                  onChange={(e) => setCustomerId(e.target.value)}
                  options={(customersQuery.data?.data ?? []).map((c) => ({
                    value: c.id,
                    label: `${c.name} (${c.phone || "No phone"})`,
                  }))}
                  placeholder="Walk-in Customer (Optional)"
                />
              ) : (
                <div className="grid flex-1 grid-cols-2 gap-1.5">
                  <Input placeholder="Customer Name" value={walkInName} onChange={(e) => setWalkInName(e.target.value)} />
                  <Input placeholder="Phone" value={walkInPhone} onChange={(e) => setWalkInPhone(e.target.value)} />
                </div>
              )}
              <Button variant="outline" size="icon" onClick={() => setWalkInMode(!walkInMode)} title="Quick New Customer">
                <UserPlus className="h-4 w-4" />
              </Button>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <Select
                value={discountType}
                onChange={(e) => setDiscountType(e.target.value as "amount" | "percent")}
                options={[
                  { value: "amount", label: "Disc ₦" },
                  { value: "percent", label: "Disc %" },
                ]}
              />
              <Input
                type="number"
                placeholder="Discount"
                value={discountInput}
                onChange={(e) => setDiscountInput(e.target.value)}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  setPayments([
                    { method: "cash", accountId: "", amountNaira: String(fromKobo(totalKobo)), reference: "" },
                  ])
                }
              >
                Exact Cash
              </Button>
            </div>

            {payments.map((p, idx) => (
              <div key={idx} className="grid grid-cols-12 gap-1.5">
                <div className="col-span-4">
                  <Select
                    value={p.method}
                    onChange={(e) =>
                      setPayments((list) =>
                        list.map((row, i) =>
                          i === idx ? { ...row, method: e.target.value as PaymentLine["method"] } : row
                        )
                      )
                    }
                    options={[
                      { value: "cash", label: "Cash" },
                      { value: "transfer", label: "Transfer" },
                      { value: "pos", label: "POS Card" },
                      { value: "cheque", label: "Cheque" },
                    ]}
                  />
                </div>
                <div className="col-span-4">
                  <Select
                    value={p.accountId}
                    onChange={(e) =>
                      setPayments((list) =>
                        list.map((row, i) => (i === idx ? { ...row, accountId: e.target.value } : row))
                      )
                    }
                    options={(accountsQuery.data ?? []).map((a) => ({ value: a.id, label: a.name }))}
                    placeholder="Default Acct"
                  />
                </div>
                <div className="col-span-4">
                  <Input
                    type="number"
                    placeholder="Amount ₦"
                    value={p.amountNaira}
                    onChange={(e) =>
                      setPayments((list) =>
                        list.map((row, i) => (i === idx ? { ...row, amountNaira: e.target.value } : row))
                      )
                    }
                  />
                </div>
              </div>
            ))}

            {balanceKobo > 0 && (
              <Input
                type="date"
                label="Credit Due Date (Optional)"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            )}

            <div className="space-y-1 rounded-lg bg-slate-50 p-2.5 dark:bg-slate-800/60">
              <div className="flex justify-between">
                <span className="text-slate-500">Subtotal</span>
                <span>{formatMoney(subtotalKobo)}</span>
              </div>
              {discountKobo > 0 && (
                <div className="flex justify-between text-emerald-600">
                  <span>Discount</span>
                  <span>-{formatMoney(discountKobo)}</span>
                </div>
              )}
              {taxKobo > 0 && (
                <div className="flex justify-between">
                  <span className="text-slate-500">{orgQuery.data?.taxName ?? "VAT"}{totals.taxInclusive ? " (included)" : ""}</span>
                  <span>{formatMoney(taxKobo)}</span>
                </div>
              )}
              <div className="flex justify-between border-t border-slate-200 pt-1 text-sm font-bold dark:border-slate-700">
                <span>Total</span>
                <span>{formatMoney(totalKobo)}</span>
              </div>
            </div>

            <Button
              className="w-full"
              onClick={handleCheckout}
              disabled={createSale.isPending || cart.length === 0}
              data-cy="pos-submit"
            >
              {createSale.isPending ? "Processing..." : `Complete Sale • ${formatMoney(totalKobo)}`}
            </Button>
          </div>
        </div>
      </div>

      {/* Mobile Floating Cart Button */}
      <button
        type="button"
        onClick={() => setMobileCartOpen(true)}
        className="fixed right-4 bottom-20 z-30 flex items-center gap-2 rounded-full bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-lg lg:hidden"
      >
        <ShoppingCart className="h-4 w-4" />
        Cart ({cart.reduce((s, i) => s + i.quantity, 0)}) • {formatMoney(totalKobo)}
      </button>

      <PosReceiptDialog
        open={Boolean(receiptResult)}
        result={receiptResult}
        onClose={() => setReceiptResult(null)}
      />
    </div>
  )
}
