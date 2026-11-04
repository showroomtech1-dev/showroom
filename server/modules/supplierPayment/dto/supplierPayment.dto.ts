export interface SupplierPaymentDTO {
  id: string;
  code: string;
  supplierId: string;
  supplierName: string;
  supplierType: string;
  branchId: string | null;
  paymentDate: string;
  amount: number;
  method: string;
  accountId: string;
  accountName: string;
  reference: string | null;
  notes: string | null;
  proofUrl: string | null;
  proofPublicId: string | null;
  allocatedAmount: number;
  isOverpayment: boolean;
  /** Part of this payment not yet applied to any supply (a credit with the supplier). */
  overpaidAmount: number;
  createdByName: string | null;
  createdAt: Date;
}

export interface SupplierPaymentDetailDTO extends SupplierPaymentDTO {
  allocations: Array<{ supplyId: string; supplyCode: string; invoiceNumber: string | null; supplyDate: string; amount: number }>;
}

export interface RecordPaymentResultDTO {
  payment: SupplierPaymentDetailDTO;
  /** Set when the payment is more than what was owed. */
  warning: string | null;
}

export interface UnallocatedPaymentRow {
  id: string;
  amount: number;
  allocatedAmount: number;
}
