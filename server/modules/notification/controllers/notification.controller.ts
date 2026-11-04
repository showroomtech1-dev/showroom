import { actorOf, handle, input, Paged } from "../../../shared/http/handler";
import { AlertScannerService } from "../services/alertScanner.service";
import { NotificationService } from "../services/notification.service";
import { listNotificationsSchema, notificationIdSchema } from "../validators/notification.schema";

export class NotificationController {
  static list = handle("Notifications fetched", async (req) =>
    Paged.of(await NotificationService.Instance.list(actorOf(req), input(req, listNotificationsSchema).query))
  );

  static unreadCount = handle("Unread count fetched", (req) => NotificationService.Instance.unreadCount(actorOf(req)));

  static markRead = handle("Notification marked as read", (req) => NotificationService.Instance.markRead(actorOf(req), input(req, notificationIdSchema).params.id));

  static markAllRead = handle("All notifications marked as read", (req) => NotificationService.Instance.markAllRead(actorOf(req)));

  static scan = handle("Alerts refreshed", (req) => AlertScannerService.Instance.scanOrganization(actorOf(req).organizationId));
}
