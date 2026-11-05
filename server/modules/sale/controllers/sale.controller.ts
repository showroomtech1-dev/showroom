import { actorOf, handle, input, Paged } from "../../../shared/http/handler";
import { EmailNotifierService } from "../../notification/services/emailNotifier.service";
import { CashupService } from "../services/cashup.service";
import { ReceiptService } from "../services/receipt.service";
import { SaleService } from "../services/sale.service";
import { SaleReturnService } from "../services/saleReturn.service";
import {
  cashupPreviewSchema,
  closeCashupSchema,
  commissionsSchema,
  createReturnSchema,
  createSaleSchema,
  dailySummarySchema,
  listCashupsSchema,
  listReturnsSchema,
  listSalesSchema,
  publicReceiptSchema,
  receiptSchema,
  returnIdSchema,
  saleIdSchema,
  voidSaleSchema,
} from "../validators/sale.schema";

export class SaleController {
  static list = handle("Sales fetched", async (req) => Paged.of(await SaleService.Instance.list(actorOf(req), input(req, listSalesSchema).query)));

  static get = handle("Sale fetched", (req) => SaleService.Instance.get(actorOf(req), input(req, saleIdSchema).params.id));

  static create = handle("Sale recorded", (req) => SaleService.Instance.create(actorOf(req), input(req, createSaleSchema).body), 201);

  static void = handle("Sale voided", (req) => {
    const { params, body } = input(req, voidSaleSchema);
    return SaleService.Instance.void(actorOf(req), params.id, body.reason);
  });

  static receipt = handle("Receipt generated", (req) => {
    const { params, query } = input(req, receiptSchema);
    return ReceiptService.Instance.pdf(actorOf(req), params.id, query.size);
  });

  static email = handle("Receipt emailed", async (req) => {
    const actor = actorOf(req);
    const { id } = input(req, saleIdSchema).params;
    await SaleService.Instance.get(actor, id); // the caller must be allowed to see this sale
    return EmailNotifierService.Instance.saleReceipt(actor.organizationId, id, true);
  });

  static share = handle("Share links ready", (req) => ReceiptService.Instance.share(actorOf(req), input(req, saleIdSchema).params.id));

  static publicReceipt = handle("Receipt generated", (req) => {
    const { params, query } = input(req, publicReceiptSchema);
    return ReceiptService.Instance.publicPdf(params.token, query.size);
  });

  static dailySummary = handle("Daily summary fetched", (req) => CashupService.Instance.dailySummary(actorOf(req), input(req, dailySummarySchema).query));

  static commissions = handle("Commissions fetched", (req) => CashupService.Instance.commissions(actorOf(req), input(req, commissionsSchema).query));
}

export class SaleReturnController {
  static list = handle("Returns fetched", async (req) => Paged.of(await SaleReturnService.Instance.list(actorOf(req), input(req, listReturnsSchema).query)));

  static get = handle("Return fetched", (req) => SaleReturnService.Instance.get(actorOf(req), input(req, returnIdSchema).params.id));

  static create = handle("Return processed", (req) => SaleReturnService.Instance.create(actorOf(req), input(req, createReturnSchema).body), 201);
}

export class CashupController {
  static preview = handle("Cash-up preview ready", (req) => CashupService.Instance.preview(actorOf(req), input(req, cashupPreviewSchema).query));

  static close = handle("Cash closed for the day", (req) => CashupService.Instance.close(actorOf(req), input(req, closeCashupSchema).body), 201);

  static list = handle("Cash-ups fetched", async (req) => Paged.of(await CashupService.Instance.list(actorOf(req), input(req, listCashupsSchema).query)));
}
