import { actorOf, handle, input, Paged } from "../../../shared/http/handler";
import { QuotationService } from "../services/quotation.service";
import {
  convertQuotationSchema,
  createQuotationSchema,
  listQuotationsSchema,
  quotationIdSchema,
  quotationPdfSchema,
  quotationStatusSchema,
  updateQuotationSchema,
} from "../validators/quotation.schema";

export class QuotationController {
  static list = handle("Quotations fetched", async (req) => Paged.of(await QuotationService.Instance.list(actorOf(req), input(req, listQuotationsSchema).query)));

  static get = handle("Quotation fetched", (req) => QuotationService.Instance.get(actorOf(req), input(req, quotationIdSchema).params.id));

  static pdf = handle("Quotation PDF generated", (req) => {
    const { params, query } = input(req, quotationPdfSchema);
    return QuotationService.Instance.pdf(actorOf(req), params.id, query.title);
  });

  static create = handle("Quotation created", (req) => QuotationService.Instance.create(actorOf(req), input(req, createQuotationSchema).body), 201);

  static update = handle("Quotation updated", (req) => {
    const { params, body } = input(req, updateQuotationSchema);
    return QuotationService.Instance.update(actorOf(req), params.id, body);
  });

  static setStatus = handle("Quotation status updated", (req) => {
    const { params, body } = input(req, quotationStatusSchema);
    return QuotationService.Instance.setStatus(actorOf(req), params.id, body.status);
  });

  static convert = handle(
    "Quotation converted to a sale",
    (req) => {
      const { params, body } = input(req, convertQuotationSchema);
      return QuotationService.Instance.convert(actorOf(req), params.id, body);
    },
    201
  );

  static remove = handle("Quotation deleted", (req) => QuotationService.Instance.remove(actorOf(req), input(req, quotationIdSchema).params.id));
}
