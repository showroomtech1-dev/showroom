// Human-readable reference codes (RCP-000123). Generated inside the caller's transaction, so codes
// are never duplicated; a rolled-back record at worst leaves a gap in the sequence.
import type { Tx } from "../../../infrastructure/database/transaction";
import { CounterRepository } from "../repositories/counter.repository";

export const CODE_SERIES = {
  supplier: { prefix: "SUP", width: 4 },
  supply: { prefix: "GRN", width: 6 },
  supplierPayment: { prefix: "SPY", width: 6 },
  stockTake: { prefix: "STK", width: 4 },
  customer: { prefix: "CUS", width: 5 },
  sale: { prefix: "RCP", width: 6 },
  saleReturn: { prefix: "RTN", width: 5 },
  quotation: { prefix: "QT", width: 5 },
  customerPayment: { prefix: "CPY", width: 6 },
  expense: { prefix: "EXP", width: 6 },
  transfer: { prefix: "TRF", width: 5 },
  employee: { prefix: "EMP", width: 3 },
  payrollRun: { prefix: "PR", width: 4 },
  payslip: { prefix: "PS", width: 6 },
  loan: { prefix: "LN", width: 4 },
  advance: { prefix: "ADV", width: 4 },
  branch: { prefix: "BR", width: 2 },
  sku: { prefix: "SKU", width: 5 },
} as const;

export type CodeSeries = keyof typeof CODE_SERIES;

export class ReferenceCodeService {
  static Instance = new ReferenceCodeService();
  private constructor(private readonly counters = CounterRepository.Instance) {}

  async next(organizationId: string, series: CodeSeries, tx?: Tx): Promise<string> {
    const { prefix, width } = CODE_SERIES[series];
    const value = await this.counters.next(organizationId, series, tx);
    return `${prefix}-${String(value).padStart(width, "0")}`;
  }
}
