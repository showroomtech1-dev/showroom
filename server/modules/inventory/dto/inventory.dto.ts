import type { AdjustmentReason, StockMovementType } from "../../../config/constants";

export interface StockMoveInput {
  branchId: string;
  variantId: string;
  productId: string;
  /** Positive = in, negative = out. */
  delta: number;
  type: StockMovementType;
  unitCost: number;
  reason?: AdjustmentReason | null;
  note?: string | null;
  referenceType?: string | null;
  referenceId?: string | null;
  /** Used in "not enough stock" messages. */
  label?: string;
}

export interface StockLevelRowDTO {
  variantId: string;
  productId: string;
  productName: string;
  variantName: string;
  sku: string;
  barcode: string | null;
  categoryName: string | null;
  brand: string | null;
  unit: string;
  branchId: string | null;
  branchName: string | null;
  quantity: number;
  reorderLevel: number;
  status: "in_stock" | "low" | "out";
  costPrice?: number;
  sellingPrice: number;
  valueAtCost?: number;
  valueAtSelling: number;
}

export interface StockMovementDTO {
  id: string;
  createdAt: Date;
  branchId: string;
  branchName: string;
  variantId: string;
  productName: string;
  variantName: string;
  sku: string;
  type: string;
  quantityChange: number;
  balanceAfter: number;
  unitCost?: number;
  reason: string | null;
  note: string | null;
  referenceType: string | null;
  referenceId: string | null;
  createdByName: string | null;
}

export interface ValuationDTO {
  branchId: string | null;
  totalUnits: number;
  distinctItems: number;
  valueAtCost: number | null;
  valueAtSelling: number;
  potentialMargin: number | null;
  byCategory: Array<{ categoryName: string | null; units: number; valueAtCost: number | null; valueAtSelling: number }>;
}

export interface StockAlertCountsDTO {
  low: number;
  out: number;
}

export interface StockTakeDTO {
  id: string;
  code: string;
  branchId: string;
  branchName: string;
  status: string;
  notes: string | null;
  itemsCounted: number;
  totalItems: number;
  varianceQuantity: number;
  varianceValue?: number;
  createdByName: string | null;
  completedByName: string | null;
  completedAt: Date | null;
  createdAt: Date;
}

export interface StockTakeItemDTO {
  id: string;
  variantId: string;
  productId: string;
  productName: string;
  variantName: string;
  sku: string;
  systemQuantity: number;
  countedQuantity: number | null;
  variance: number | null;
  unitCost?: number;
  countedAt: Date | null;
}
