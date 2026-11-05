import { useEffect, useState } from "react"
import { ImagePlus, Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { useAuth } from "@/contexts/AuthContext"
import {
  useDeleteProductPhoto,
  useDeleteVariant,
  useProduct,
  useProductCategories,
  useSaveProduct,
  useSaveVariant,
  useUploadProductPhotos,
} from "@/hooks/useProducts"
import { useSuppliers } from "@/hooks/useSuppliers"
import { formatMoney, fromKobo, toKobo } from "@/lib/money"
import { Dialog } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import type { ProductListItem } from "@/types/inventory.types"

interface ProductEditorModalProps {
  open: boolean
  product: ProductListItem | null
  onClose: () => void
}

export function ProductEditorModal({ open, product, onClose }: ProductEditorModalProps) {
  const { activeBranchId } = useAuth()
  const categoriesQuery = useProductCategories()
  const suppliersQuery = useSuppliers({ limit: 100 })
  const saveProduct = useSaveProduct()

  const [name, setName] = useState("")
  const [brand, setBrand] = useState("")
  const [unit, setUnit] = useState("piece")
  const [categoryId, setCategoryId] = useState("")
  const [supplierId, setSupplierId] = useState("")
  const [sku, setSku] = useState("")
  const [costNaira, setCostNaira] = useState("")
  const [priceNaira, setPriceNaira] = useState("")
  const [reorderLevel, setReorderLevel] = useState("5")
  const [openingStock, setOpeningStock] = useState("0")

  useEffect(() => {
    if (product) {
      setName(product.name)
      setBrand(product.brand ?? "")
      setUnit(product.unit)
      setCategoryId(product.categoryId ?? "")
      setSupplierId(product.supplierId ?? "")
      setSku(product.sku ?? "")
      setCostNaira(product.costPrice !== undefined ? String(fromKobo(product.costPrice)) : "")
      setPriceNaira(String(fromKobo(product.minPrice)))
      setReorderLevel(String(product.reorderLevel))
      setOpeningStock("0")
    } else {
      setName("")
      setBrand("")
      setUnit("piece")
      setCategoryId("")
      setSupplierId("")
      setSku("")
      setCostNaira("")
      setPriceNaira("")
      setReorderLevel("5")
      setOpeningStock("0")
    }
  }, [product, open])

  const handleSave = async () => {
    if (!name.trim()) return toast.error("Product name is required")
    if (toKobo(priceNaira) <= 0) return toast.error("Enter a valid selling price")
    try {
      await saveProduct.mutateAsync({
        id: product?.id,
        payload: {
          name: name.trim(),
          brand: brand.trim() || null,
          unit: unit.trim() || "piece",
          categoryId: categoryId || null,
          supplierId: supplierId || null,
          sku: !product && sku.trim() ? sku.trim() : undefined,
          costPrice: toKobo(costNaira),
          sellingPrice: toKobo(priceNaira),
          reorderLevel: Number(reorderLevel) || 0,
          openingStock: !product ? Number(openingStock) || 0 : undefined,
          branchId: !product && activeBranchId ? activeBranchId : undefined,
        },
      })
      toast.success(product ? "Product updated" : "Product created")
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save product")
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title={product ? "Edit Product" : "New Product"}>
      <div className="space-y-3.5">
        <Input label="Product Name *" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Samsung 65-inch QLED Smart TV" data-cy="product-name" />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Select
            label="Category"
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            options={(categoriesQuery.data ?? []).map((c) => ({ value: c.id, label: c.name }))}
            placeholder="Uncategorized"
          />
          <Select
            label="Primary Supplier"
            value={supplierId}
            onChange={(e) => setSupplierId(e.target.value)}
            options={(suppliersQuery.data?.data ?? []).map((s) => ({ value: s.id, label: s.name }))}
            placeholder="None"
          />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Input label="Brand" value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="e.g. Samsung" />
          <Input label="Unit" value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="piece, box, set" />
          <Input label="SKU (Optional)" value={sku} onChange={(e) => setSku(e.target.value)} placeholder="Auto-generated" disabled={Boolean(product)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input label="Cost Price (₦)" type="number" placeholder="0.00" value={costNaira} onChange={(e) => setCostNaira(e.target.value)} />
          <Input label="Selling Price (₦) *" type="number" placeholder="0.00" value={priceNaira} onChange={(e) => setPriceNaira(e.target.value)} data-cy="product-price" />
        </div>
        <div className={product ? "grid grid-cols-1 gap-3" : "grid grid-cols-2 gap-3"}>
          <Input label="Reorder Level" type="number" value={reorderLevel} onChange={(e) => setReorderLevel(e.target.value)} />
          {!product && (
            <Input label="Opening Stock" type="number" value={openingStock} onChange={(e) => setOpeningStock(e.target.value)} />
          )}
        </div>
        <div className="flex justify-end gap-2.5 border-t border-slate-100 pt-3.5 dark:border-slate-800">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saveProduct.isPending} data-cy="product-save">
            {saveProduct.isPending ? "Saving..." : "Save Product"}
          </Button>
        </div>
      </div>
    </Dialog>
  )
}

interface ProductDetailModalProps {
  productId: string | null
  onClose: () => void
}

export function ProductDetailModal({ productId, onClose }: ProductDetailModalProps) {
  const { can, activeBranchId } = useAuth()
  const productQuery = useProduct(productId ?? "")
  const saveVariant = useSaveVariant()
  const deleteVariant = useDeleteVariant()
  const uploadPhotos = useUploadProductPhotos()
  const deletePhoto = useDeleteProductPhoto()

  const [vName, setVName] = useState("")
  const [vSku, setVSku] = useState("")
  const [vCost, setVCost] = useState("")
  const [vPrice, setVPrice] = useState("")
  const [vOpening, setVOpening] = useState("0")

  const p = productQuery.data

  const handleAddVariant = async () => {
    if (!p || !vName.trim() || toKobo(vPrice) <= 0) {
      return toast.error("Enter variant name and selling price")
    }
    try {
      await saveVariant.mutateAsync({
        productId: p.id,
        payload: {
          name: vName.trim(),
          sku: vSku.trim() || undefined,
          costPrice: toKobo(vCost),
          sellingPrice: toKobo(vPrice),
          openingStock: Number(vOpening) || 0,
          branchId: activeBranchId || undefined,
        },
      })
      toast.success("Variant added")
      setVName("")
      setVSku("")
      setVCost("")
      setVPrice("")
      setVOpening("0")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not add variant")
    }
  }

  return (
    <Dialog
      open={Boolean(productId)}
      onClose={onClose}
      title={p ? p.name : "Product Details"}
      description={p ? `${p.categoryName || "Uncategorized"} • Brand: ${p.brand || "—"}` : ""}
      maxWidth="max-w-3xl"
    >
      {!p ? (
        <p className="py-8 text-center text-xs text-slate-500">Loading product...</p>
      ) : (
        <div className="space-y-4 text-xs">
          {/* Variants Table */}
          <div>
            <h4 className="mb-2 font-semibold text-slate-900 dark:text-slate-100">
              Variants & Stock ({p.variants.length})
            </h4>
            <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
              <table className="w-full text-left">
                <thead className="bg-slate-50 text-[11px] uppercase text-slate-500 dark:bg-slate-800/50">
                  <tr>
                    <th className="px-3 py-2">Variant</th>
                    <th className="px-3 py-2">SKU</th>
                    {can("inventory.cost.view") && <th className="px-3 py-2 text-right">Cost</th>}
                    <th className="px-3 py-2 text-right">Price</th>
                    <th className="px-3 py-2 text-right">Total Stock</th>
                    <th className="px-3 py-2 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {p.variants.map((v) => (
                    <tr key={v.id}>
                      <td className="px-3 py-2 font-medium">{v.name}</td>
                      <td className="px-3 py-2 font-mono text-slate-500">{v.sku}</td>
                      {can("inventory.cost.view") && (
                        <td className="px-3 py-2 text-right">
                          {v.costPrice !== undefined ? formatMoney(v.costPrice) : "—"}
                        </td>
                      )}
                      <td className="px-3 py-2 text-right font-semibold">{formatMoney(v.sellingPrice)}</td>
                      <td className="px-3 py-2 text-right font-bold">{v.quantity}</td>
                      <td className="px-3 py-2 text-right">
                        {p.variants.length > 1 && can("product.delete") && (
                          <button
                            onClick={async () => {
                              try {
                                await deleteVariant.mutateAsync({ productId: p.id, variantId: v.id })
                                toast.success("Variant removed")
                              } catch (err) {
                                toast.error(err instanceof Error ? err.message : "Cannot remove variant")
                              }
                            }}
                            className="text-slate-400 hover:text-rose-600"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {can("product.update") && (
            <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-3 dark:border-slate-800 dark:bg-slate-800/30">
              <p className="mb-2 font-semibold">Add Variant (Size / Color / Model)</p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                <Input placeholder="Name (e.g. 65-inch)" value={vName} onChange={(e) => setVName(e.target.value)} />
                <Input placeholder="SKU (Optional)" value={vSku} onChange={(e) => setVSku(e.target.value)} />
                <Input type="number" placeholder="Cost ₦" value={vCost} onChange={(e) => setVCost(e.target.value)} />
                <Input type="number" placeholder="Price ₦ *" value={vPrice} onChange={(e) => setVPrice(e.target.value)} />
                <Button size="sm" onClick={handleAddVariant} disabled={saveVariant.isPending}>
                  <Plus className="h-4 w-4" />
                  Add
                </Button>
              </div>
            </div>
          )}

          {/* Photos */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <h4 className="font-semibold text-slate-900 dark:text-slate-100">
                Product Photos ({p.photos.length}/5)
              </h4>
              {can("product.update") && p.photos.length < 5 && (
                <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-medium hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800">
                  <ImagePlus className="h-3.5 w-3.5" />
                  Upload Photo
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={async (e) => {
                      const files = Array.from(e.target.files ?? [])
                      if (files.length === 0) return
                      try {
                        await uploadPhotos.mutateAsync({ productId: p.id, files })
                        toast.success("Photos uploaded")
                      } catch (err) {
                        toast.error(err instanceof Error ? err.message : "Upload failed")
                      }
                    }}
                  />
                </label>
              )}
            </div>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
              {p.photos.map((photo) => (
                <div key={photo.id} className="group relative overflow-hidden rounded-lg border border-slate-200 dark:border-slate-800">
                  <img src={photo.url} alt={p.name} className="h-20 w-full object-cover" />
                  {can("product.update") && (
                    <button
                      onClick={() => deletePhoto.mutate({ productId: p.id, photoId: photo.id })}
                      className="absolute top-1 right-1 rounded bg-black/60 p-1 text-white opacity-0 transition group-hover:opacity-100"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </Dialog>
  )
}
