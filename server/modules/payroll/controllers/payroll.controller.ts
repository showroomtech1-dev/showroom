import { actorOf, handle, input, Paged } from "../../../shared/http/handler";
import { EmailNotifierService } from "../../notification/services/emailNotifier.service";
import { PayrollService } from "../services/payroll.service";
import { PayrollPaymentService } from "../services/payrollPayment.service";
import {
  createRunSchema,
  employeeLedgerSchema,
  itemIdSchema,
  listPayslipsSchema,
  listRunsSchema,
  payItemSchema,
  payRunSchema,
  payslipIdSchema,
  runIdSchema,
  updateItemSchema,
} from "../validators/payroll.schema";

export class PayrollController {
  static list = handle("Payroll runs fetched", async (req) => Paged.of(await PayrollService.Instance.listRuns(actorOf(req), input(req, listRunsSchema).query)));

  static get = handle("Payroll run fetched", (req) => PayrollService.Instance.getRun(actorOf(req), input(req, runIdSchema).params.id));

  static create = handle("Payroll prepared", (req) => PayrollService.Instance.createRun(actorOf(req), input(req, createRunSchema).body), 201);

  static recalculate = handle("Payroll recalculated", (req) => PayrollService.Instance.recalculate(actorOf(req), input(req, runIdSchema).params.id));

  static updateItem = handle("Payroll line updated", (req) => {
    const { params, body } = input(req, updateItemSchema);
    return PayrollService.Instance.updateItem(actorOf(req), params.id, params.itemId, body);
  });

  static removeItem = handle("Employee removed from payroll", (req) => {
    const { params } = input(req, itemIdSchema);
    return PayrollService.Instance.removeItem(actorOf(req), params.id, params.itemId);
  });

  static approve = handle("Payroll approved", (req) => PayrollService.Instance.approve(actorOf(req), input(req, runIdSchema).params.id));

  static cancel = handle("Payroll cancelled", (req) => PayrollService.Instance.cancel(actorOf(req), input(req, runIdSchema).params.id));

  static pay = handle("Salaries paid", (req) => {
    const { params, body } = input(req, payRunSchema);
    return PayrollPaymentService.Instance.payRun(actorOf(req), params.id, body);
  });

  static payItem = handle("Salary paid", (req) => {
    const { params, body } = input(req, payItemSchema);
    return PayrollPaymentService.Instance.payItem(actorOf(req), params.id, params.itemId, body);
  });

  static payslips = handle("Payslips fetched", async (req) => Paged.of(await PayrollPaymentService.Instance.listPayslips(actorOf(req), input(req, listPayslipsSchema).query)));

  static payslip = handle("Payslip fetched", (req) => PayrollPaymentService.Instance.payslip(actorOf(req), input(req, payslipIdSchema).params.id));

  static payslipPdf = handle("Payslip generated", (req) => PayrollPaymentService.Instance.payslipPdf(actorOf(req), input(req, payslipIdSchema).params.id));

  static emailPayslip = handle("Payslip emailed", (req) =>
    EmailNotifierService.Instance.payslip(actorOf(req).organizationId, input(req, payslipIdSchema).params.id, true)
  );

  static employeeLedger = handle("Employee pay ledger fetched", (req) =>
    PayrollPaymentService.Instance.employeeLedger(actorOf(req), input(req, employeeLedgerSchema).params.employeeId)
  );
}
