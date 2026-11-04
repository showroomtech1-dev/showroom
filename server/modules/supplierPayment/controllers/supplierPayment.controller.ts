import { actorOf, handle, input, Paged } from "../../../shared/http/handler";
import { requireFile } from "../../../shared/middleware/upload.middleware";
import { SupplierPaymentService } from "../services/supplierPayment.service";
import {
  createSupplierPaymentSchema,
  listSupplierPaymentsSchema,
  supplierPaymentIdSchema,
  supplierPaymentProofSchema,
  updateSupplierPaymentSchema,
} from "../validators/supplierPayment.schema";

export class SupplierPaymentController {
  static list = handle("Supplier payments fetched", async (req) =>
    Paged.of(await SupplierPaymentService.Instance.list(actorOf(req), input(req, listSupplierPaymentsSchema).query))
  );

  static get = handle("Supplier payment fetched", (req) =>
    SupplierPaymentService.Instance.get(actorOf(req), input(req, supplierPaymentIdSchema).params.id)
  );

  static create = handle(
    "Supplier payment recorded",
    (req) => SupplierPaymentService.Instance.create(actorOf(req), input(req, createSupplierPaymentSchema).body),
    201
  );

  static update = handle("Supplier payment updated", (req) => {
    const { params, body } = input(req, updateSupplierPaymentSchema);
    return SupplierPaymentService.Instance.update(actorOf(req), params.id, body);
  });

  static remove = handle("Supplier payment deleted", (req) =>
    SupplierPaymentService.Instance.remove(actorOf(req), input(req, supplierPaymentIdSchema).params.id)
  );

  static uploadProof = handle("Proof of payment attached", (req) =>
    SupplierPaymentService.Instance.uploadProof(actorOf(req), input(req, supplierPaymentProofSchema).params.id, requireFile(req))
  );
}
