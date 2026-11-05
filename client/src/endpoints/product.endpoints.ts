import { uploadCall, wrapCall } from "@/transport/http"
import type {
  PosItem,
  ProductCategory,
  ProductDetail,
  ProductListItem,
} from "@/types/inventory.types"

export const ProductEndpoints = {
  list: (params?: Record<string, unknown>) =>
    wrapCall<ProductListItem[]>("GET", "/api/v1/products", params),

  get: (id: string) =>
    wrapCall<ProductDetail>("GET", `/api/v1/products/${id}`),

  posSearch: (q: string, branchId?: string, limit = 24) =>
    wrapCall<PosItem[]>("GET", "/api/v1/products/pos-search", { q, branchId, limit }),

  byBarcode: (code: string, branchId?: string) =>
    wrapCall<PosItem>("GET", `/api/v1/products/barcode/${encodeURIComponent(code)}`, branchId ? { branchId } : undefined),

  create: (payload: Record<string, unknown>) =>
    wrapCall<ProductDetail>("POST", "/api/v1/products", payload),

  update: (id: string, payload: Record<string, unknown>) =>
    wrapCall<ProductDetail>("PATCH", `/api/v1/products/${id}`, payload),

  remove: (id: string) =>
    wrapCall<null>("DELETE", `/api/v1/products/${id}`),

  addVariant: (id: string, payload: Record<string, unknown>) =>
    wrapCall<ProductDetail>("POST", `/api/v1/products/${id}/variants`, payload),

  updateVariant: (id: string, variantId: string, payload: Record<string, unknown>) =>
    wrapCall<ProductDetail>("PATCH", `/api/v1/products/${id}/variants/${variantId}`, payload),

  removeVariant: (id: string, variantId: string) =>
    wrapCall<ProductDetail>("DELETE", `/api/v1/products/${id}/variants/${variantId}`),

  addPhotos: (id: string, files: File[]) =>
    uploadCall<ProductDetail>(`/api/v1/products/${id}/photos`, files, "photos"),

  removePhoto: (id: string, photoId: string) =>
    wrapCall<ProductDetail>("DELETE", `/api/v1/products/${id}/photos/${photoId}`),

  listCategories: () =>
    wrapCall<ProductCategory[]>("GET", "/api/v1/product-categories"),

  createCategory: (payload: { name: string; description?: string | null }) =>
    wrapCall<ProductCategory>("POST", "/api/v1/product-categories", payload as Record<string, unknown>),

  updateCategory: (id: string, payload: { name?: string; description?: string | null }) =>
    wrapCall<ProductCategory>("PATCH", `/api/v1/product-categories/${id}`, payload as Record<string, unknown>),

  removeCategory: (id: string) =>
    wrapCall<null>("DELETE", `/api/v1/product-categories/${id}`),
}
