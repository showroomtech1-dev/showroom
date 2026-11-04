import { actorOf, handle, input, Paged } from "../../../shared/http/handler";
import { SupplyService } from "../services/supply.service";
import { createSupplySchema, listSuppliesSchema, supplyIdSchema, updateSupplySchema } from "../validators/supply.schema";

export class SupplyController {
  static list = handle("Supplies fetched", async (req) =>
    Paged.of(await SupplyService.Instance.list(actorOf(req), input(req, listSuppliesSchema).query))
  );

  static get = handle("Supply fetched", (req) => SupplyService.Instance.get(actorOf(req), input(req, supplyIdSchema).params.id));

  static create = handle("Supply recorded", (req) => SupplyService.Instance.create(actorOf(req), input(req, createSupplySchema).body), 201);

  static update = handle("Supply updated", (req) => {
    const { params, body } = input(req, updateSupplySchema);
    return SupplyService.Instance.update(actorOf(req), params.id, body);
  });

  static remove = handle("Supply deleted", (req) => SupplyService.Instance.remove(actorOf(req), input(req, supplyIdSchema).params.id));
}
