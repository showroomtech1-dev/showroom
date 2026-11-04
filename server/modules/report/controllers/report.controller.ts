import { actorOf, handle, input } from "../../../shared/http/handler";
import { ReportService } from "../services/report.service";
import { REPORT_TYPES, reportSchema } from "../validators/report.schema";

export class ReportController {
  static types = handle("Report types fetched", async () => REPORT_TYPES);

  static run = handle("Report generated", (req) => {
    const { params, query } = input(req, reportSchema);
    return ReportService.Instance.run(actorOf(req), params.type, query);
  });
}
