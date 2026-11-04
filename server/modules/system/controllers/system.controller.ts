import { actorOf, handle, input } from "../../../shared/http/handler";
import { SystemService } from "../services/system.service";
import { restoreSchema, trashListSchema } from "../validators/system.schema";

export class SystemController {
  static backup = handle("Backup generated", (req) => SystemService.Instance.backup(actorOf(req)));

  static trashTypes = handle("Restorable record types", async () => SystemService.Instance.trashTypes());

  static trash = handle("Deleted records fetched", (req) => {
    const { type, limit } = input(req, trashListSchema).query;
    return SystemService.Instance.trash(actorOf(req), type, limit);
  });

  static restore = handle("Record restored", (req) => {
    const { params } = input(req, restoreSchema);
    return SystemService.Instance.restore(actorOf(req), params.type, params.id);
  });
}
