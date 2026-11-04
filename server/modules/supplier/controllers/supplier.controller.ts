import { actorOf, handle, input, Paged } from "../../../shared/http/handler";
import { SupplierService } from "../services/supplier.service";
import {
  createSupplierSchema,
  listSuppliersSchema,
  payablesSchema,
  supplierIdSchema,
  supplierStatementSchema,
  updateSupplierSchema,
} from "../validators/supplier.schema";

export class SupplierController {
  static list = handle("Suppliers fetched", async (req) =>
    Paged.of(await SupplierService.Instance.list(actorOf(req), input(req, listSuppliersSchema).query))
  );

  static payables = handle("Payables summary fetched", (req) =>
    SupplierService.Instance.payables(actorOf(req), input(req, payablesSchema).query.type)
  );

  static get = handle("Supplier fetched", (req) => SupplierService.Instance.get(actorOf(req), input(req, supplierIdSchema).params.id));

  static statement = handle("Supplier statement fetched", (req) => {
    const { params, query } = input(req, supplierStatementSchema);
    return SupplierService.Instance.statement(actorOf(req), params.id, query);
  });

  static create = handle("Supplier created", (req) => SupplierService.Instance.create(actorOf(req), input(req, createSupplierSchema).body), 201);

  static update = handle("Supplier updated", (req) => {
    const { params, body } = input(req, updateSupplierSchema);
    return SupplierService.Instance.update(actorOf(req), params.id, body);
  });

  static remove = handle("Supplier deleted", (req) => SupplierService.Instance.remove(actorOf(req), input(req, supplierIdSchema).params.id));
}
