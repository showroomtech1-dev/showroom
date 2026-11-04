export interface SupplyListItemDTO {
  id: string;
  code: string;
  supplierId: string;
  supplierName: string;
  supplierType: string;
  branchId: string;
  branchName: string;
  invoiceNumber: string | null;
  supplyDate: string;
  dueDate: string | null;
  totalCost: number;
  amountPaid: number;
  outstanding: number;
  paymentStatus: "paid" | "part_paid" | "credit";
  isOverdue: boolean;
  itemCount: number;
  createdByName: string | null;
  createdAt: Date;
}

export interface SupplyItemDTO {
  id: string;
  variantId: string | null;
  productId: string | null;
  description: string;
  sku: string | null;
  quantity: number;
  unitCost: number;
  totalCost: number;
}

export interface SupplyAllocationDTO {
  paymentId: string;
  paymentCode: string;
  paymentDate: string;
  method: string;
  amount: number;
}

export interface SupplyDetailDTO extends SupplyListItemDTO {
  subtotal: number;
  discount: number;
  notes: string | null;
  items: SupplyItemDTO[];
  payments: SupplyAllocationDTO[];
}

/** Locked row used while allocating payments. */
export interface OpenSupplyRow {
  id: string;
  totalCost: number;
  amountPaid: number;
}
