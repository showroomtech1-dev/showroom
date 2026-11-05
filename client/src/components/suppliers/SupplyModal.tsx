import { useEffect, useState } from "react"
import { Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { useAuth } from "@/contexts/AuthContext"
import { useCreateSupply, useSaveSupplier, useSuppliers } from "@/hooks/useSuppliers"
import { useStockLevels } from "@/hooks/useInventory"
import { useAccounts } from "@/hooks/useFinance"
import { fromKobo, toKobo } from "@/lib/money"
import { todayIso } from "@/lib/utils"
import { NIGERIAN_BANKS } from "@/lib/banks"
import { Dialog } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { PhoneInput } from "@/components/ui/phone-input"
import { Select } from "@/components/ui/select"
import type { Supplier } from "@/types/supplier.types"

const SUPPLIER_CATEGORIES = [
  "Furniture",
  "Electronics",
  "Home Appliances",
  "Lighting",
  "Fabrics & Upholstery",
  "Mattresses & Bedding",
  "Building Materials",
  "Logistics & Delivery",
  "Maintenance & Repairs",
  "Marketing & Advertising",
  "Utilities",
  "Other",
]

/** Common payment terms, in days (0 = cash on delivery). */
const PAYMENT_TERMS = [0, 7, 14, 30, 45, 60, 90]

interface SupplierEditorModalProps {
  open: boolean
  supplier: Supplier | null
  onClose: () => void
}

export function SupplierEditorModal({ open, supplier, onClose }: SupplierEditorModalProps) {
  const saveSupplier = useSaveSupplier()
  const [type, setType] = useState<"supplier" | "vendor">("supplier")
  const [name, setName] = useState("")
  const [contactPerson, setContactPerson] = useState("")
  const [phone, setPhone] = useState("")
  const [email, setEmail] = useState("")
  const [category, setCategory] = useState("")
  const [bankName, setBankName] = useState("")
  const [bankAccountNumber, setBankAccountNumber] = useState("")
  const [bankAccountName, setBankAccountName] = useState("")
  const [paymentTermsDays, setPaymentTermsDays] = useState("30")

  useEffect(() => {
    if (supplier) {
      setType(supplier.type)
      setName(supplier.name)
      setContactPerson(supplier.contactPerson ?? "")
      setPhone(supplier.phone ?? "")
      setEmail(supplier.email ?? "")
      setCategory(supplier.category ?? "")
      setBankName(supplier.bankName ?? "")
      setBankAccountNumber(supplier.bankAccountNumber ?? "")
      setBankAccountName(supplier.bankAccountName ?? "")
      setPaymentTermsDays(supplier.paymentTermsDays != null ? String(supplier.paymentTermsDays) : "")
    } else {
      setType("supplier")
      setName("")
      setContactPerson("")
      setPhone("")
      setEmail("")
      setCategory("")
      setBankName("")
      setBankAccountNumber("")
      setBankAccountName("")
      setPaymentTermsDays("30")
    }
  }, [supplier, open])

  // Keep a saved value selectable even if it isn't in the standard list (e.g. older free-typed entries).
  const withCurrent = (list: string[], current: string) =>
    current && !list.includes(current) ? [current, ...list] : list
  const categoryOptions = withCurrent(SUPPLIER_CATEGORIES, category)
  const bankOptions = withCurrent(NIGERIAN_BANKS, bankName)
  const termsOptions = (() => {
    const base = PAYMENT_TERMS.map((d) => ({ value: String(d), label: d === 0 ? "Cash on delivery" : `${d} days` }))
    return paymentTermsDays && !base.some((o) => o.value === paymentTermsDays)
      ? [{ value: paymentTermsDays, label: `${paymentTermsDays} days` }, ...base]
      : base
  })()

  const handleSave = async () => {
    if (!name.trim()) return toast.error("Supplier/Vendor name is required")
    if (email.trim() && !/^\S+@\S+\.\S+$/.test(email.trim())) return toast.error("Enter a valid email address")
    if (bankAccountNumber && bankAccountNumber.length !== 10) return toast.error("Account number must be 10 digits")
    try {
      await saveSupplier.mutateAsync({
        id: supplier?.id,
        payload: {
          type,
          name: name.trim(),
          contactPerson: contactPerson.trim() || null,
          phone: phone.trim() || null,
          email: email.trim() || null,
          category: category.trim() || null,
          bankName: bankName.trim() || null,
          bankAccountNumber: bankAccountNumber.trim() || null,
          bankAccountName: bankAccountName.trim() || null,
          paymentTermsDays: paymentTermsDays !== "" ? Number(paymentTermsDays) : null,
        },
      })
      toast.success(supplier ? "Supplier updated" : "Supplier added")
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save supplier")
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={supplier ? "Edit Supplier / Vendor" : "New Supplier / Vendor"}
      maxWidth="max-w-2xl"
    >
      <div className="space-y-4 py-1">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Select
            label="Partner Type"
            value={type}
            onChange={(e) => setType(e.target.value as "supplier" | "vendor")}
            options={[
              { value: "supplier", label: "Stock Supplier (GRN)" },
              { value: "vendor", label: "Service Vendor" },
            ]}
          />
          <Input label="Company / Business Name *" value={name} onChange={(e) => setName(e.target.value)} data-cy="supplier-name" />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input label="Contact Person" value={contactPerson} onChange={(e) => setContactPerson(e.target.value)} />
          <PhoneInput label="Phone" value={phone} onChange={setPhone} />
          <Input label="Email" type="email" placeholder="name@company.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          <Select
            label="Category / Trade"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            options={categoryOptions.map((c) => ({ value: c, label: c }))}
            placeholder="Select category"
          />
        </div>

        <Select
          label="Payment Terms"
          value={paymentTermsDays}
          onChange={(e) => setPaymentTermsDays(e.target.value)}
          options={termsOptions}
          placeholder="No terms set"
          hint="How long you have to pay this partner after receiving goods or services."
        />

        <div className="space-y-3 rounded-xl border border-slate-200 p-3 dark:border-slate-800">
          <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">Bank details (for paying this partner)</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Select
              label="Bank Name"
              value={bankName}
              onChange={(e) => setBankName(e.target.value)}
              options={bankOptions.map((b) => ({ value: b, label: b }))}
              placeholder="Select bank"
            />
            <Input
              label="Account Number"
              inputMode="numeric"
              maxLength={10}
              placeholder="10-digit account number"
              value={bankAccountNumber}
              onChange={(e) => setBankAccountNumber(e.target.value.replace(/\D/g, "").slice(0, 10))}
              error={bankAccountNumber && bankAccountNumber.length !== 10 ? "Account number must be 10 digits" : undefined}
            />
          </div>
          <Input
            label="Account Name"
            placeholder="Name on the account"
            value={bankAccountName}
            onChange={(e) => setBankAccountName(e.target.value)}
          />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saveSupplier.isPending} data-cy="supplier-save">
            {saveSupplier.isPending ? "Saving..." : "Save Partner"}
          </Button>
        </div>
      </div>
    </Dialog>
  )
}

interface RecordSupplyModalProps {
  open: boolean
  onClose: () => void
}

export function RecordSupplyModal({ open, onClose }: RecordSupplyModalProps) {
  const { activeBranchId } = useAuth()
  const suppliersQuery = useSuppliers({ limit: 100 })
  const levelsQuery = useStockLevels({ limit: 100, branchId: activeBranchId || undefined })
  const accountsQuery = useAccounts()
  const createSupply = useCreateSupply()

  const [supplierId, setSupplierId] = useState("")
  const [invoiceNumber, setInvoiceNumber] = useState("")
  const [supplyDate, setSupplyDate] = useState(todayIso())
  const [dueDate, setDueDate] = useState("")
  const [selectedVariantId, setSelectedVariantId] = useState("")
  const [lines, setLines] = useState<
    Array<{ variantId: string; description: string; quantity: number; unitCostNaira: string }>
  >([])
  const [paidAmountNaira, setPaidAmountNaira] = useState("")
  const [method, setMethod] = useState<"cash" | "transfer" | "pos" | "cheque">("transfer")
  const [accountId, setAccountId] = useState("")

  const variants = levelsQuery.data?.data ?? []

  const addLine = () => {
    const v = variants.find((x) => x.variantId === selectedVariantId)
    if (!v) return
    setLines((prev) => [
      ...prev,
      {
        variantId: v.variantId,
        description: v.productName,
        quantity: 1,
        unitCostNaira: v.costPrice ? String(fromKobo(v.costPrice)) : "",
      },
    ])
    setSelectedVariantId("")
  }

  const handleSave = async () => {
    if (!supplierId) return toast.error("Select a supplier")
    if (lines.length === 0) return toast.error("Add at least one supplied item")
    const paidKobo = toKobo(paidAmountNaira)
    try {
      await createSupply.mutateAsync({
        supplierId,
        branchId: activeBranchId || undefined,
        invoiceNumber: invoiceNumber.trim() || undefined,
        supplyDate,
        dueDate: dueDate || undefined,
        items: lines.map((l) => ({
          variantId: l.variantId,
          description: l.description,
          quantity: l.quantity,
          unitCost: toKobo(l.unitCostNaira),
          updateProductCost: true,
        })),
        payment:
          paidKobo > 0
            ? { amount: paidKobo, method, accountId: accountId || undefined }
            : undefined,
      })
      toast.success("Goods Received Note (GRN) recorded")
      setLines([])
      setPaidAmountNaira("")
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not record supply")
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title="Receive Stock Supply (GRN)" maxWidth="max-w-2xl">
      <div className="space-y-3 text-xs">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Select
            label="Supplier *"
            value={supplierId}
            onChange={(e) => setSupplierId(e.target.value)}
            options={(suppliersQuery.data?.data ?? []).map((s) => ({ value: s.id, label: s.name }))}
            placeholder="Select supplier..."
          />
          <Input label="Invoice / Waybill #" placeholder="Optional reference" value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} />
          <Input label="Supply Date" type="date" value={supplyDate} onChange={(e) => setSupplyDate(e.target.value)} />
          <Input label="Payment Due Date" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </div>

        <div className="flex items-end gap-2">
          <div className="flex-1">
            <Select
              label="Add Variant to Receive"
              value={selectedVariantId}
              onChange={(e) => setSelectedVariantId(e.target.value)}
              options={variants.map((v) => ({ value: v.variantId, label: `${v.productName} (${v.sku})` }))}
              placeholder="Choose product..."
            />
          </div>
          <Button type="button" onClick={addLine} disabled={!selectedVariantId}>
            <Plus className="h-4 w-4" />
            Add
          </Button>
        </div>

        <div className="space-y-2">
          {lines.map((l, idx) => (
            <div key={idx} className="grid grid-cols-12 items-center gap-2 rounded-lg border border-slate-200 p-2 dark:border-slate-800">
              <span className="col-span-5 font-medium">{l.description}</span>
              <div className="col-span-3">
                <Input
                  type="number"
                  min={1}
                  placeholder="Qty"
                  value={l.quantity}
                  onChange={(e) =>
                    setLines((prev) =>
                      prev.map((row, i) => (i === idx ? { ...row, quantity: Math.max(1, Number(e.target.value)) } : row))
                    )
                  }
                />
              </div>
              <div className="col-span-3">
                <Input
                  type="number"
                  placeholder="Unit Cost ₦"
                  value={l.unitCostNaira}
                  onChange={(e) =>
                    setLines((prev) =>
                      prev.map((row, i) => (i === idx ? { ...row, unitCostNaira: e.target.value } : row))
                    )
                  }
                />
              </div>
              <button
                type="button"
                onClick={() => setLines((prev) => prev.filter((_, i) => i !== idx))}
                className="col-span-1 text-slate-400 hover:text-rose-600"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-3 gap-2.5 border-t border-slate-200 pt-3 dark:border-slate-800">
          <Input
            label="Amount Paid Now (₦)"
            type="number"
            placeholder="0 (Full Credit)"
            value={paidAmountNaira}
            onChange={(e) => setPaidAmountNaira(e.target.value)}
          />
          <Select
            label="Payment Method"
            value={method}
            onChange={(e) => setMethod(e.target.value as typeof method)}
            options={[
              { value: "transfer", label: "Transfer" },
              { value: "cash", label: "Cash" },
              { value: "cheque", label: "Cheque" },
              { value: "pos", label: "POS" },
            ]}
          />
          <Select
            label="From Account"
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
            options={(accountsQuery.data ?? []).map((a) => ({ value: a.id, label: a.name }))}
            placeholder="Default Account"
          />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={createSupply.isPending}>
            {createSupply.isPending ? "Recording..." : "Save Supply (GRN)"}
          </Button>
        </div>
      </div>
    </Dialog>
  )
}
