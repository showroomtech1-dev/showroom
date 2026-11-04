import { Router } from "express";
import { requireAny, requireAuthenticatedOnly } from "../../../shared/access/can";
import { authMiddleware } from "../../../shared/middleware/auth.middleware";
import { validate } from "../../../shared/middleware/validate.middleware";
import { NotificationController } from "../controllers/notification.controller";
import { listNotificationsSchema, notificationIdSchema, scanSchema } from "../validators/notification.schema";

/** /api/v1/notifications — each user only sees alerts their permissions allow. */
const router = Router();
router.use(authMiddleware);

router.get("/", requireAuthenticatedOnly(), validate(listNotificationsSchema), NotificationController.list);
router.get("/unread-count", requireAuthenticatedOnly(), NotificationController.unreadCount);
router.post("/read-all", requireAuthenticatedOnly(), NotificationController.markAllRead);
router.post("/scan", requireAny("dashboard.read", "inventory.read"), validate(scanSchema), NotificationController.scan);
router.post("/:id/read", requireAuthenticatedOnly(), validate(notificationIdSchema), NotificationController.markRead);

export default router;
