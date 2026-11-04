// Read-through cache of each business's settings (currency, tax, timezone…). Almost every
// service needs them; updates invalidate immediately.
import { AppError } from "../../../shared/errors/AppError";
import type { SettingsDTO } from "../dto/organization.dto";
import { OrganizationRepository } from "../repositories/organization.repository";

const TTL_MS = 60_000;

export class SettingsService {
  static Instance = new SettingsService();
  private readonly cache = new Map<string, { value: SettingsDTO; expiresAt: number }>();

  private constructor(private readonly repo = OrganizationRepository.Instance) {}

  async get(organizationId: string): Promise<SettingsDTO> {
    const hit = this.cache.get(organizationId);
    if (hit && hit.expiresAt > Date.now()) return hit.value;
    const value = await this.repo.findSettings(organizationId);
    if (!value) throw AppError.notFound("Business settings not found");
    this.cache.set(organizationId, { value, expiresAt: Date.now() + TTL_MS });
    return value;
  }

  invalidate(organizationId: string): void {
    this.cache.delete(organizationId);
  }
}
