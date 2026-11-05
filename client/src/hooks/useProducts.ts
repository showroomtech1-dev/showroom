import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { ProductEndpoints } from "@/endpoints/product.endpoints"
import { ApiError } from "@/transport/http"

export const PRODUCTS_KEY = "products"
export const PRODUCT_CATEGORIES_KEY = "product-categories"

export function useProducts(params: Record<string, unknown> = {}, enabled = true) {
  return useQuery({
    queryKey: [PRODUCTS_KEY, params],
    queryFn: async () => {
      const res = await ProductEndpoints.list(params)
      if (!res.success) throw new ApiError(res.message, res.statusCode)
      return { data: res.data ?? [], meta: res.meta }
    },
    enabled,
  })
}

export function useProduct(id: string) {
  return useQuery({
    queryKey: [PRODUCTS_KEY, id],
    queryFn: async () => {
      const res = await ProductEndpoints.get(id)
      if (!res.success || !res.data) throw new ApiError(res.message, res.statusCode)
      return res.data
    },
    enabled: Boolean(id),
  })
}

export function usePosSearch(query: string, branchId?: string) {
  return useQuery({
    queryKey: [PRODUCTS_KEY, "pos-search", query, branchId],
    queryFn: async () => {
      const res = await ProductEndpoints.posSearch(query, branchId, 30)
      if (!res.success) throw new ApiError(res.message, res.statusCode)
      return res.data ?? []
    },
    enabled: query.trim().length > 0,
  })
}

export function useSaveProduct() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, payload }: { id?: string; payload: Record<string, unknown> }) => {
      const res = id
        ? await ProductEndpoints.update(id, payload)
        : await ProductEndpoints.create(payload)
      if (!res.success || !res.data) throw new ApiError(res.message, res.statusCode, res.errors)
      return res.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [PRODUCTS_KEY] })
      qc.invalidateQueries({ queryKey: [PRODUCT_CATEGORIES_KEY] })
      qc.invalidateQueries({ queryKey: ["stock-levels"] })
      qc.invalidateQueries({ queryKey: ["stock-movements"] })
    },
  })
}

export function useDeleteProduct() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await ProductEndpoints.remove(id)
      if (!res.success) throw new ApiError(res.message, res.statusCode)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [PRODUCTS_KEY] })
      qc.invalidateQueries({ queryKey: [PRODUCT_CATEGORIES_KEY] })
      qc.invalidateQueries({ queryKey: ["stock-levels"] })
      qc.invalidateQueries({ queryKey: ["stock-movements"] })
    },
  })
}

export function useSaveVariant() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      productId,
      variantId,
      payload,
    }: {
      productId: string
      variantId?: string
      payload: Record<string, unknown>
    }) => {
      const res = variantId
        ? await ProductEndpoints.updateVariant(productId, variantId, payload)
        : await ProductEndpoints.addVariant(productId, payload)
      if (!res.success || !res.data) throw new ApiError(res.message, res.statusCode, res.errors)
      return res.data
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: [PRODUCTS_KEY, vars.productId] })
      qc.invalidateQueries({ queryKey: [PRODUCTS_KEY] })
    },
  })
}

export function useDeleteVariant() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ productId, variantId }: { productId: string; variantId: string }) => {
      const res = await ProductEndpoints.removeVariant(productId, variantId)
      if (!res.success) throw new ApiError(res.message, res.statusCode)
      return res.data
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: [PRODUCTS_KEY, vars.productId] })
      qc.invalidateQueries({ queryKey: [PRODUCTS_KEY] })
    },
  })
}

export function useUploadProductPhotos() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ productId, files }: { productId: string; files: File[] }) => {
      const res = await ProductEndpoints.addPhotos(productId, files)
      if (!res.success || !res.data) throw new ApiError(res.message, res.statusCode, res.errors)
      return res.data
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: [PRODUCTS_KEY, vars.productId] })
      qc.invalidateQueries({ queryKey: [PRODUCTS_KEY] })
    },
  })
}

export function useDeleteProductPhoto() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ productId, photoId }: { productId: string; photoId: string }) => {
      const res = await ProductEndpoints.removePhoto(productId, photoId)
      if (!res.success) throw new ApiError(res.message, res.statusCode)
      return res.data
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: [PRODUCTS_KEY, vars.productId] })
    },
  })
}

export function useProductCategories() {
  return useQuery({
    queryKey: [PRODUCT_CATEGORIES_KEY],
    queryFn: async () => {
      const res = await ProductEndpoints.listCategories()
      if (!res.success) throw new ApiError(res.message, res.statusCode)
      return res.data ?? []
    },
  })
}

export function useSaveProductCategory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, name, description }: { id?: string; name: string; description?: string | null }) => {
      const res = id
        ? await ProductEndpoints.updateCategory(id, { name, description })
        : await ProductEndpoints.createCategory({ name, description })
      if (!res.success || !res.data) throw new ApiError(res.message, res.statusCode, res.errors)
      return res.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [PRODUCT_CATEGORIES_KEY] })
      qc.invalidateQueries({ queryKey: [PRODUCTS_KEY] })
    },
  })
}

export function useDeleteProductCategory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await ProductEndpoints.removeCategory(id)
      if (!res.success) throw new ApiError(res.message, res.statusCode)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [PRODUCT_CATEGORIES_KEY] })
      qc.invalidateQueries({ queryKey: [PRODUCTS_KEY] })
    },
  })
}
