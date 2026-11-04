import { actorOf, handle, input, Paged } from "../../../shared/http/handler";
import { AuditService } from "../services/audit.service";
import { listAuditSchema } from "../validators/audit.schema";

export class AuditController {
  static list = handle("Audit log fetched", async (req) =>
    Paged.of(await AuditService.Instance.list(actorOf(req), input(req, listAuditSchema).query))
  );
}
