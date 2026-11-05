import { actorOf, handle, input } from "../../../shared/http/handler";
import { PlatformService } from "../services/platform.service";
import { businessListSchema, loginListSchema, overviewSchema, userListSchema } from "../validators/platform.schema";

export class PlatformController {
  static overview = handle("Platform overview fetched", (req) => {
    const { tz, days } = input(req, overviewSchema).query;
    return PlatformService.Instance.overview(actorOf(req), tz, days);
  });

  static businesses = handle("Businesses fetched", (req) =>
    PlatformService.Instance.businesses(actorOf(req), input(req, businessListSchema).query)
  );

  static users = handle("Users fetched", (req) => PlatformService.Instance.users(actorOf(req), input(req, userListSchema).query));

  static online = handle("Online users fetched", async (req) => PlatformService.Instance.online(actorOf(req)));

  static logins = handle("Recent sign-ins fetched", (req) =>
    PlatformService.Instance.logins(actorOf(req), input(req, loginListSchema).query.limit)
  );
}
