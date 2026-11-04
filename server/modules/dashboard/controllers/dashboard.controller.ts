import { actorOf, handle, input } from "../../../shared/http/handler";
import { DashboardService } from "../services/dashboard.service";
import { chartsSchema, dashboardSchema } from "../validators/dashboard.schema";

export class DashboardController {
  static summary = handle("Dashboard fetched", (req) => DashboardService.Instance.summary(actorOf(req), input(req, dashboardSchema).query.branchId));

  static charts = handle("Dashboard charts fetched", (req) => DashboardService.Instance.charts(actorOf(req), input(req, chartsSchema).query));
}
