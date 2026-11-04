export interface CategoryDTO {
  id: string;
  name: string;
  description: string | null;
  productCount: number;
}

export interface VariantDTO {
  id: string;
  productId: string;
  name: string;
  size: string | null;
  color: string | null;
  model: string | null;
  sku: string;
  barcode: string | null;
  costPrice?: number;
  sellingPrice: number;
  reorderLevel: number | null;
  isActive: boolean;
  quantity: number;
  stockByBranch?: Array<{ branchId: string; branchName: string; quantity: number }>;
}

export interface ProductPhotoDTO {
  id: string;
  url: string;
  publicId: string;
  sortOrder: number;
}

export interface ProductListItemDTO {
  id: string;
  name: string;
  brand: string | null;
  unit: string;
  categoryId: string | null;
  categoryName: string | null;
  supplierId: string | null;
  supplierName: string | null;
  hasVariants: boolean;
  isActive: boolean;
  variantCount: number;
  sku: string | null;
  minPrice: number;
  maxPrice: number;
  costPrice?: number;
  quantity: number;
  reorderLevel: number;
  photoUrl: string | null;
  createdAt: Date;
}

export interface ProductDetailDTO {
  id: string;
  name: string;
  categoryId: string | null;
  categoryName: string | null;
  brand: string | null;
  description: string | null;
  unit: string;
  costPrice?: number;
  sellingPrice: number;
  reorderLevel: number;
  supplierId: string | null;
  supplierName: string | null;
  hasVariants: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  variants: VariantDTO[];
  photos: ProductPhotoDTO[];
}

/** A variant as the POS / stock code needs it. */
export interface SellableVariant {
  id: string;
  productId: string;
  productName: string;
  variantName: string;
  label: string;
  sku: string;
  barcode: string | null;
  costPrice: number;
  sellingPrice: number;
  unit: string;
  isActive: boolean;
}

export interface PosItemDTO {
  variantId: string;
  productId: string;
  productName: string;
  variantName: string;
  label: string;
  sku: string;
  barcode: string | null;
  unit: string;
  sellingPrice: number;
  quantity: number;
  photoUrl: string | null;
}
