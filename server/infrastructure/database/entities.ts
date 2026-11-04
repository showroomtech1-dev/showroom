// Entity registry, grouped by build phase. Each phase only references entities from the same
// or earlier phases, and each phase has its own migration.
import type { EntitySchema } from "typeorm";
import { RoleEntity } from "../../modules/access/entities/role.entity";
import { AuditLogEntity } from "../../modules/audit/entities/auditLog.entity";
import { RefreshTokenEntity } from "../../modules/auth/entities/refreshToken.entity";
import { CustomerEntity } from "../../modules/customer/entities/customer.entity";
import { CustomerPaymentEntity } from "../../modules/customer/entities/customerPayment.entity";
import { CustomerPaymentAllocationEntity } from "../../modules/customer/entities/customerPaymentAllocation.entity";
import { AttendanceEntity } from "../../modules/employee/entities/attendance.entity";
import { EmployeeEntity } from "../../modules/employee/entities/employee.entity";
import { EmployeeDocumentEntity } from "../../modules/employee/entities/employeeDocument.entity";
import { LeaveRequestEntity } from "../../modules/employee/entities/leaveRequest.entity";
import { ExpenseEntity } from "../../modules/expense/entities/expense.entity";
import { ExpenseCategoryEntity } from "../../modules/expense/entities/expenseCategory.entity";
import { RecurringExpenseEntity } from "../../modules/expense/entities/recurringExpense.entity";
import { AccountEntity } from "../../modules/finance/entities/account.entity";
import { AccountTransactionEntity } from "../../modules/finance/entities/accountTransaction.entity";
import { AccountTransferEntity } from "../../modules/finance/entities/accountTransfer.entity";
import { StockLevelEntity } from "../../modules/inventory/entities/stockLevel.entity";
import { StockMovementEntity } from "../../modules/inventory/entities/stockMovement.entity";
import { StockTakeEntity } from "../../modules/inventory/entities/stockTake.entity";
import { StockTakeItemEntity } from "../../modules/inventory/entities/stockTakeItem.entity";
import { LoanEntity } from "../../modules/loan/entities/loan.entity";
import { LoanRepaymentEntity } from "../../modules/loan/entities/loanRepayment.entity";
import { NotificationEntity } from "../../modules/notification/entities/notification.entity";
import { NotificationReadEntity } from "../../modules/notification/entities/notificationRead.entity";
import { BranchEntity } from "../../modules/organization/entities/branch.entity";
import { CounterEntity } from "../../modules/organization/entities/counter.entity";
import { OrganizationEntity } from "../../modules/organization/entities/organization.entity";
import { OrganizationSettingsEntity } from "../../modules/organization/entities/organizationSettings.entity";
import { PayrollItemEntity } from "../../modules/payroll/entities/payrollItem.entity";
import { PayrollPaymentEntity } from "../../modules/payroll/entities/payrollPayment.entity";
import { PayrollRunEntity } from "../../modules/payroll/entities/payrollRun.entity";
import { PayslipEntity } from "../../modules/payroll/entities/payslip.entity";
import { ProductEntity } from "../../modules/product/entities/product.entity";
import { ProductCategoryEntity } from "../../modules/product/entities/productCategory.entity";
import { ProductPhotoEntity } from "../../modules/product/entities/productPhoto.entity";
import { ProductVariantEntity } from "../../modules/product/entities/productVariant.entity";
import { QuotationEntity } from "../../modules/quotation/entities/quotation.entity";
import { QuotationItemEntity } from "../../modules/quotation/entities/quotationItem.entity";
import { CashReconciliationEntity } from "../../modules/sale/entities/cashReconciliation.entity";
import { SaleEntity } from "../../modules/sale/entities/sale.entity";
import { SaleItemEntity } from "../../modules/sale/entities/saleItem.entity";
import { SalePaymentEntity } from "../../modules/sale/entities/salePayment.entity";
import { SaleReturnEntity } from "../../modules/sale/entities/saleReturn.entity";
import { SaleReturnItemEntity } from "../../modules/sale/entities/saleReturnItem.entity";
import { SupplierEntity } from "../../modules/supplier/entities/supplier.entity";
import { SupplierPaymentEntity } from "../../modules/supplierPayment/entities/supplierPayment.entity";
import { SupplierPaymentAllocationEntity } from "../../modules/supplierPayment/entities/supplierPaymentAllocation.entity";
import { SupplyEntity } from "../../modules/supply/entities/supply.entity";
import { SupplyItemEntity } from "../../modules/supply/entities/supplyItem.entity";
import { UserEntity } from "../../modules/user/entities/user.entity";

type AnyEntity = EntitySchema;

export const ENTITY_PHASES: Record<1 | 2 | 3 | 4 | 5, AnyEntity[]> = {
  /** Auth, settings, branches, roles, accounts, audit, notifications. */
  1: [
    OrganizationEntity,
    OrganizationSettingsEntity,
    BranchEntity,
    CounterEntity,
    RoleEntity,
    UserEntity,
    RefreshTokenEntity,
    AuditLogEntity,
    AccountEntity,
    AccountTransactionEntity,
    AccountTransferEntity,
    NotificationEntity,
    NotificationReadEntity,
  ],
  /** Suppliers, vendors, supplies, payments, products, stock. */
  2: [
    SupplierEntity,
    SupplyEntity,
    SupplyItemEntity,
    SupplierPaymentEntity,
    SupplierPaymentAllocationEntity,
    ProductCategoryEntity,
    ProductEntity,
    ProductVariantEntity,
    ProductPhotoEntity,
    StockLevelEntity,
    StockMovementEntity,
    StockTakeEntity,
    StockTakeItemEntity,
  ],
  /** POS, customers, returns, quotations, cash-up. */
  3: [
    CustomerEntity,
    SaleEntity,
    SaleItemEntity,
    SalePaymentEntity,
    CustomerPaymentEntity,
    CustomerPaymentAllocationEntity,
    SaleReturnEntity,
    SaleReturnItemEntity,
    QuotationEntity,
    QuotationItemEntity,
    CashReconciliationEntity,
  ],
  /** Expenses. */
  4: [ExpenseCategoryEntity, ExpenseEntity, RecurringExpenseEntity],
  /** Employees, attendance, leave, payroll, loans. */
  5: [
    EmployeeEntity,
    EmployeeDocumentEntity,
    AttendanceEntity,
    LeaveRequestEntity,
    PayrollRunEntity,
    PayrollItemEntity,
    PayrollPaymentEntity,
    PayslipEntity,
    LoanEntity,
    LoanRepaymentEntity,
  ],
};

export const ALL_ENTITIES: AnyEntity[] = Object.values(ENTITY_PHASES).flat();
