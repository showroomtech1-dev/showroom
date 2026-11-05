// Platform operator view across every business. Access is decided by PLATFORM_ADMIN_EMAILS, not by
// any role inside a business, and re-checked here so the service is safe to call from anywhere.
import { presence, type OnlineUserDTO } from "../../../infrastructure/realtime/presence";
import { isPlatformAdmin } from "../../../shared/access/can";
import { AppError } from "../../../shared/errors/AppError";
import { Paged } from "../../../shared/http/handler";
import type { Actor } from "../../../shared/types/actor";
import type { PlatformBusinessDTO, PlatformLoginDTO, PlatformOverviewDTO, PlatformUserDTO } from "../dto/platform.dto";
import {
  PlatformRepository,
  type BusinessSort,
  type BusinessStatus,
  type UserSort,
  type UserStatus,
} from "../repositories/platform.repository";
import { realtimeEnabled } from "./realtimeState";

export class PlatformService {
  static Instance = new PlatformService();
  private constructor(private readonly repo = PlatformRepository.Instance) {}

  private assertAdmin(actor: Actor): void {
    if (!isPlatformAdmin(actor)) throw AppError.forbidden("Only platform admins can open this");
  }

  async overview(actor: Actor, timezone: string, days: number): Promise<PlatformOverviewDTO> {
    this.assertAdmin(actor);
    const [totals, daily, recentSignups] = await Promise.all([
      this.repo.totals(timezone),
      this.repo.daily(timezone, days),
      this.repo.recentSignups(8),
    ]);
    return {
      totals: { ...totals, onlineNow: presence.userIds().length, onlineBusinesses: presence.organizationIds().length },
      daily,
      recentSignups,
      realtime: realtimeEnabled(),
    };
  }

  async businesses(
    actor: Actor,
    q: { page: number; limit: number; search?: string; sort: BusinessSort; status?: BusinessStatus }
  ): Promise<Paged<PlatformBusinessDTO>> {
    this.assertAdmin(actor);
    const result = await this.repo.businesses({ ...q, onlineOrgIds: presence.organizationIds() });
    const online = presence.countsByOrganization();
    return new Paged(
      result.data.map((b) => ({ ...b, onlineCount: online.get(b.id) ?? 0 })),
      result.meta
    );
  }

  async users(
    actor: Actor,
    q: { page: number; limit: number; search?: string; sort: UserSort; status?: UserStatus; organizationId?: string }
  ): Promise<Paged<PlatformUserDTO>> {
    this.assertAdmin(actor);
    const result = await this.repo.users({ ...q, onlineUserIds: presence.userIds() });
    return new Paged(
      result.data.map((u) => {
        const live = presence.get(u.id);
        return { ...u, online: Boolean(live), currentPath: live?.currentPath ?? null, device: live?.device ?? null };
      }),
      result.meta
    );
  }

  online(actor: Actor): OnlineUserDTO[] {
    this.assertAdmin(actor);
    return presence.list();
  }

  async logins(actor: Actor, limit: number): Promise<PlatformLoginDTO[]> {
    this.assertAdmin(actor);
    return this.repo.recentLogins(limit);
  }
}
