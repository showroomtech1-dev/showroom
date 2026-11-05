import { useState } from "react"
import { Edit2, Eye, Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { useAuth } from "@/contexts/AuthContext"
import {
  useDeleteProduct,
  useDeleteProductCategory,
  useProductCategories,
  useProducts,
  useSaveProductCategory,
} from "@/hooks/useProducts"
import { useDebouncedSearch } from "@/hooks/useDebounce"
import { formatMoney } from "@/lib/money"
import { Button } from "@/components/ui/button"
import { TableStatus } from "@/components/shared/TableStatus"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { SearchInput } from "@/components/shared/SearchInput"
import { StatusBadge } from "@/components/shared/StatusBadge"
import { Pagination } from "@/components/shared/Pagination"
import { ConfirmDialog } from "@/components/shared/ConfirmDialog"
import { ProductDetailModal, ProductEditorModal } from "@/components/inventory/ProductDetailModal"
import type { ProductListItem } from "@/types/inventory.types"

export default function ProductsPage() {
  const { can, activeBranchId } = useAuth()
  const [tab, setTab] = useState<"catalog" | "categories">("catalog")
  const [search, setSearch] = useState("")
  const [categoryId, setCategoryId] = useState("")
  const [stockStatus, setStockStatus] = useState("")
  const [page, setPage] = useState(1)
  const [editorOpen, setEditorOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<ProductListItem | null>(null)
  const [detailId, setDetailId] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<ProductListItem | null>(null)
  const [editCatId, setEditCatId] = useState<string | null>(null)
  const [catName, setCatName] = useState("")
  const [catDesc, setCatDesc] = useState("")

  const debouncedSearch = useDebouncedSearch(search, 300, () => setPage(1))

  const productsQuery = useProducts({
    page,
    limit: 20,
    search: debouncedSearch || undefined,
    categoryId: categoryId || undefined,
    stockStatus: stockStatus || undefined,
    branchId: activeBranchId || undefined,
  })
  const categoriesQuery = useProductCategories()
  const deleteProduct = useDeleteProduct()
  const saveCategory = useSaveProductCategory()
  const deleteCategory = useDeleteProductCategory()

  const handleSaveCategory = async () => {
    if (!catName.trim()) return toast.error("Category name is required")
    try {
      await saveCategory.mutateAsync({
        id: editCatId ?? undefined,
        name: catName.trim(),
        description: catDesc.trim() || null,
      })
      toast.success(editCatId ? "Category updated" : "Category created")
      setEditCatId(null)
      setCatName("")
      setCatDesc("")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save category")
    }
  }

  const handleCancelEditCategory = () => {
    setEditCatId(null)
    setCatName("")
    setCatDesc("")
  }

  return (
    <div className="space-y-4" data-cy="products-page">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100">Products & Catalog</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Manage showroom items, variants, pricing, and product categories
          </p>
        </div>
        {can("product.create") && (
          <Button
            size="sm"
            onClick={() => {
              setEditTarget(null)
              setEditorOpen(true)
            }}
            data-cy="add-product-btn"
          >
            <Plus className="h-4 w-4" />
            New Product
          </Button>
        )}
      </div>

      <div className="flex gap-1 rounded-xl border border-slate-200 bg-white p-1 dark:border-slate-800 dark:bg-slate-900">
        {(
          [
            ["catalog", "Product Catalog"],
            ["categories", "Product Categories"],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`rounded-lg px-3.5 py-1.5 text-xs font-medium transition ${
              tab === k
                ? "bg-blue-600 text-white"
                : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "catalog" && (
        <div className="space-y-3">
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
            <SearchInput value={search} onChange={setSearch} placeholder="Search name, brand, SKU..." />
            <Select
              value={categoryId}
              onChange={(e) => {
                setCategoryId(e.target.value)
                setPage(1)
              }}
              options={(categoriesQuery.data ?? []).map((c) => ({ value: c.id, label: c.name }))}
              placeholder="All Categories"
            />
            <Select
              value={stockStatus}
              onChange={(e) => {
                setStockStatus(e.target.value)
                setPage(1)
              }}
              options={[
                { value: "attention", label: "Low or Out of Stock" },
                { value: "low", label: "Low Stock" },
                { value: "out", label: "Out of Stock" },
              ]}
              placeholder="All Stock Levels"
            />
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 bg-slate-50 text-[11px] uppercase text-slate-500 dark:border-slate-800 dark:bg-slate-800/50">
                <tr>
                  <th className="px-4 py-3">Product</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">SKU</th>
                  {can("inventory.cost.view") && <th className="px-4 py-3 text-right">Cost</th>}
                  <th className="px-4 py-3 text-right">Price</th>
                  <th className="px-4 py-3 text-right">Stock</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                <TableStatus loading={productsQuery.isLoading} error={productsQuery.isError} empty={(productsQuery.data?.data ?? []).length === 0} cols={7} />
                {(productsQuery.data?.data ?? []).map((p) => {
                  const status =
                    p.quantity <= 0 ? "out" : p.quantity <= p.reorderLevel ? "low" : "in_stock"
                  return (
                    <tr key={p.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                      <td className="px-4 py-3">
                        <p className="font-semibold text-slate-900 dark:text-slate-100">{p.name}</p>
                        {p.brand && <p className="text-[11px] text-slate-400">{p.brand}</p>}
                      </td>
                      <td className="px-4 py-3 text-slate-500">{p.categoryName || "—"}</td>
                      <td className="px-4 py-3 font-mono text-slate-500">{p.sku || `${p.variantCount} variants`}</td>
                      {can("inventory.cost.view") && (
                        <td className="px-4 py-3 text-right">
                          {p.costPrice !== undefined ? formatMoney(p.costPrice) : "—"}
                        </td>
                      )}
                      <td className="px-4 py-3 text-right font-semibold">{formatMoney(p.minPrice)}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <span className="font-bold">{p.quantity}</span>
                          <StatusBadge status={status} />
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => setDetailId(p.id)} title="Variants & Photos">
                            <Eye className="h-4 w-4" />
                          </Button>
                          {can("product.update") && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                setEditTarget(p)
                                setEditorOpen(true)
                              }}
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          {can("product.delete") && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setDeleteTarget(p)}
                              className="text-rose-600"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <Pagination meta={productsQuery.data?.meta} onPageChange={setPage} />
        </div>
      )}

      {tab === "categories" && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          {(can("product.create") || can("product.update")) && (
            <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 lg:col-span-4 h-fit">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {editCatId ? "Edit Category" : "Add Category"}
                </h3>
                {editCatId && (
                  <button
                    type="button"
                    onClick={handleCancelEditCategory}
                    className="text-xs font-semibold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 cursor-pointer"
                  >
                    Cancel
                  </button>
                )}
              </div>
              <Input
                label="Category Name *"
                placeholder="e.g. Televisions & Audio"
                value={catName}
                onChange={(e) => setCatName(e.target.value)}
                data-cy="category-name-input"
              />
              <Input
                label="Description"
                placeholder="Optional category notes"
                value={catDesc}
                onChange={(e) => setCatDesc(e.target.value)}
                data-cy="category-desc-input"
              />
              <div className="flex gap-2">
                {editCatId && (
                  <Button variant="outline" className="flex-1" onClick={handleCancelEditCategory}>
                    Cancel
                  </Button>
                )}
                <Button
                  className="flex-1"
                  onClick={handleSaveCategory}
                  disabled={saveCategory.isPending}
                  data-cy="category-save-btn"
                >
                  {saveCategory.isPending
                    ? "Saving..."
                    : editCatId
                      ? "Update Category"
                      : "Save Category"}
                </Button>
              </div>
            </div>
          )}
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 lg:col-span-8">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 bg-slate-50 text-[11px] uppercase text-slate-500 dark:border-slate-800 dark:bg-slate-800/50">
                <tr>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Description</th>
                  <th className="px-4 py-3 text-right">Products</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                <TableStatus loading={categoriesQuery.isLoading} error={categoriesQuery.isError} empty={(categoriesQuery.data ?? []).length === 0} cols={4} />
                {(categoriesQuery.data ?? []).map((cat) => {
                  const isEditing = editCatId === cat.id
                  return (
                    <tr
                      key={cat.id}
                      className={
                        isEditing
                          ? "bg-indigo-50/60 dark:bg-indigo-950/30"
                          : "hover:bg-slate-50/80 dark:hover:bg-slate-800/40"
                      }
                    >
                      <td className="px-4 py-3 font-semibold text-slate-900 dark:text-slate-100">
                        {cat.name}
                      </td>
                      <td className="px-4 py-3 text-slate-500 dark:text-slate-400">
                        {cat.description || "—"}
                      </td>
                      <td className="px-4 py-3 text-right font-medium">{cat.productCount}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-1">
                          {(can("product.update") || can("product.create")) && (
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Edit category"
                              data-cy={`edit-category-${cat.id}`}
                              onClick={() => {
                                setEditCatId(cat.id)
                                setCatName(cat.name)
                                setCatDesc(cat.description ?? "")
                              }}
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          {can("product.delete") && (
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Delete category"
                              onClick={async () => {
                                try {
                                  await deleteCategory.mutateAsync(cat.id)
                                  if (editCatId === cat.id) handleCancelEditCategory()
                                  toast.success("Category removed")
                                } catch (err) {
                                  toast.error(
                                    err instanceof Error ? err.message : "Could not delete category"
                                  )
                                }
                              }}
                              className="text-rose-600"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <ProductEditorModal open={editorOpen} product={editTarget} onClose={() => setEditorOpen(false)} />
      <ProductDetailModal productId={detailId} onClose={() => setDetailId(null)} />
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={async () => {
          if (!deleteTarget) return
          try {
            await deleteProduct.mutateAsync(deleteTarget.id)
            toast.success("Product moved to trash")
            setDeleteTarget(null)
          } catch (err) {
            toast.error(err instanceof Error ? err.message : "Could not delete product")
          }
        }}
        title="Delete Product"
        description={`Move ${deleteTarget?.name} to trash?`}
        confirmLabel="Delete"
        loading={deleteProduct.isPending}
      />
    </div>
  )
}
