import { EntitySchema } from "typeorm";
import { createdAt, manyToOne } from "../../../infrastructure/database/columns";

export interface NotificationRead {
  notificationId: string;
  userId: string;
  readAt: Date;
  notification?: { id: string };
  user?: { id: string };
}

export const NotificationReadEntity = new EntitySchema<NotificationRead>({
  name: "NotificationRead",
  tableName: "notification_reads",
  columns: {
    notificationId: { type: "uuid", name: "notification_id", primary: true },
    userId: { type: "uuid", name: "user_id", primary: true },
    readAt: { ...createdAt(), name: "read_at" },
  },
  relations: {
    notification: manyToOne("Notification", "notification_id", "CASCADE"),
    user: manyToOne("User", "user_id", "CASCADE"),
  },
});
