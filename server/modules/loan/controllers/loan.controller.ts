import { actorOf, handle, input, Paged } from "../../../shared/http/handler";
import { LoanService } from "../services/loan.service";
import { createLoanSchema, listLoansSchema, loanIdSchema, repayLoanSchema, updateLoanSchema } from "../validators/loan.schema";

export class LoanController {
  static list = handle("Loans fetched", async (req) => Paged.of(await LoanService.Instance.list(actorOf(req), input(req, listLoansSchema).query)));

  static get = handle("Loan fetched", (req) => LoanService.Instance.get(actorOf(req), input(req, loanIdSchema).params.id));

  static create = handle("Loan issued", (req) => LoanService.Instance.create(actorOf(req), input(req, createLoanSchema).body), 201);

  static update = handle("Loan updated", (req) => {
    const { params, body } = input(req, updateLoanSchema);
    return LoanService.Instance.update(actorOf(req), params.id, body);
  });

  static repay = handle("Repayment recorded", (req) => {
    const { params, body } = input(req, repayLoanSchema);
    return LoanService.Instance.repay(actorOf(req), params.id, body);
  }, 201);

  static remove = handle("Loan deleted", (req) => LoanService.Instance.remove(actorOf(req), input(req, loanIdSchema).params.id));
}
