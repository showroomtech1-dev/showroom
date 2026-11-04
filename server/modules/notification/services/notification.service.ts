import { seesAllBranches } from "../../../shared/access/scope";
import { AppError } from "../../../shared/errors/AppError";
import type { Actor } from "../../../shared/types/actor";
import { NotificationRepository, type Audience } from "../repositories/notification.repository";

export class NotificationService {
  static Instance = new NotificationService();
  private constructor(private readonly repo = NotificationRepository.Instance) {}

  private audience(actor: Actor): Audience {
    return { userId: actor.id, permissions: actor.permissions, branchId: seesAllBranches(actor) ? null : actor.branchId };
  }

  async list(actor: Actor, query: { page: number; limit: number; unreadOnly?: boolean }) {
    return this.repo.list(actor.organizationId, this.audience(actor), query);
  }

  async unreadCount(actor: Actor): Promise<{ unread: number }> {
    return { unread: await this.repo.unreadCount(actor.organizationId, this.audience(actor)) };
  }

  async markRead(actor: Actor, id: string): Promise<void> {
    const found = await this.repo.markRead(actor.organizationId, actor.id, id);
    if (!found) throw AppError.notFound("Notification not found");
  }

  async markAllRead(actor: Actor): Promise<void> {
    await this.repo.markAllRead(actor.organizationId, this.audience(actor));
  }
}
