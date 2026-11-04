import { actorOf, handle, input } from "../../../shared/http/handler";
import { FinanceReportService } from "../services/financeReport.service";
import { periodSchema, trendSchema } from "../validators/financeReport.schema";

export class FinanceReportController {
  static profitAndLoss = handle("Profit and loss fetched", (req) => FinanceReportService.Instance.profitAndLoss(actorOf(req), input(req, periodSchema).query));

  static cashFlow = handle("Cash flow fetched", (req) => FinanceReportService.Instance.cashFlow(actorOf(req), input(req, periodSchema).query));

  static profitTrend = handle("Profit trend fetched", (req) => {
    const { months, branchId } = input(req, trendSchema).query;
    return FinanceReportService.Instance.profitTrend(actorOf(req), months, branchId);
  });

  static payablesReceivables = handle("Payables and receivables fetched", (req) => FinanceReportService.Instance.payablesReceivables(actorOf(req)));
}
