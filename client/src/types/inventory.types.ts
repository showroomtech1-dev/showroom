export interface ProductCategory {
  id: string
  name: string
  description: string | null
  productCount: number
}

export interface ProductVariant {
  id: string
  productId: string
  name: string
  size: string | null
  color: string | null
  model: string | null
  sku: string
  barcode: string | null
  costPrice?: number
  sellingPrice: number
  reorderLevel: number | null
  isActive: boolean
  quantity: number
  stockByBranch?: Array<{ branchId: string; branchName: string; quantity: number }>
}

export interface ProductPhoto {
  id: string
  url: string
  publicId: string
  sortOrder: number
}

export interface ProductListItem {
  id: string
  name: string
  brand: string | null
  unit: string
  categoryId: string | null
  categoryName: string | null
  supplierId: string | null
  supplierName: string | null
  hasVariants: boolean
  isActive: boolean
  variantCount: number
  sku: string | null
  minPrice: number
  maxPrice: number
  costPrice?: number
  quantity: number
  reorderLevel: number
  photoUrl: string | null
  createdAt: string
}

export interface ProductDetail {
  id: string
  name: string
  categoryId: string | null
  categoryName: string | null
  brand: string | null
  description: string | null
  unit: string
  costPrice?: number
  sellingPrice: number
  reorderLevel: number
  supplierId: string | null
  supplierName: string | null
  hasVariants: boolean
  isActive: boolean
  createdAt: string
  updatedAt: string
  variants: ProductVariant[]
  photos: ProductPhoto[]
}

export interface PosItem {
  variantId: string
  productId: string
  productName: string
  variantName: string
  label: string
  sku: string
  barcode: string | null
  unit: string
  sellingPrice: number
  quantity: number
  photoUrl: string | null
}

export interface StockLevelRow {
  variantId: string
  productId: string
  productName: string
  variantName: string
  sku: string
  barcode: string | null
  categoryName: string | null
  brand: string | null
  unit: string
  branchId: string | null
  branchName: string | null
  quantity: number
  reorderLevel: number
  status: "in_stock" | "low" | "out"
  costPrice?: number
  sellingPrice: number
  valueAtCost?: number
  valueAtSelling: number
}

export interface StockMovement {
  id: string
  createdAt: string
  branchId: string
  branchName: string
  variantId: string
  productName: string
  variantName: string
  sku: string
  type: string
  quantityChange: number
  balanceAfter: number
  unitCost?: number
  reason: string | null
  note: string | null
  referenceType: string | null
  referenceId: string | null
  createdByName: string | null
}

export interface InventoryValuation {
  branchId: string | null
  totalUnits: number
  distinctItems: number
  valueAtCost: number | null
  valueAtSelling: number
  potentialMargin: number | null
  byCategory: Array<{ categoryName: string | null; units: number; valueAtCost: number | null; valueAtSelling: number }>
}

export interface StockTake {
  id: string
  code: string
  branchId: string
  branchName: string
  status: "in_progress" | "completed" | "cancelled"
  notes: string | null
  itemsCounted: number
  totalItems: number
  varianceQuantity: number
  varianceValue?: number
  createdByName: string | null
  completedByName: string | null
  completedAt: string | null
  createdAt: string
}

export interface StockTakeItem {
  id: string
  variantId: string
  productId: string
  productName: string
  variantName: string
  sku: string
  systemQuantity: number
  countedQuantity: number | null
  variance: number | null
  unitCost?: number
  countedAt: string | null
}
