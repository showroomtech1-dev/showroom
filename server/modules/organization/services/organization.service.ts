import { STORAGE_FOLDERS } from "../../../config/constants";
import { inTransaction } from "../../../infrastructure/database/transaction";
import { assertPermission } from "../../../shared/access/can";
import { AppError } from "../../../shared/errors/AppError";
import type { ExportContext } from "../../../shared/services/export.service";
import { StorageService } from "../../../shared/services/storage.service";
import type { Actor } from "../../../shared/types/actor";
import { AuditService } from "../../audit/services/audit.service";
import type { BusinessDTO, BusinessProfileDTO, SettingsDTO } from "../dto/organization.dto";
import { OrganizationRepository } from "../repositories/organization.repository";
import type { UpdateBusinessInput, UpdateSettingsInput } from "../validators/organization.schema";
import { SettingsService } from "./settings.service";

export class OrganizationService {
  static Instance = new OrganizationService();
  private constructor(
    private readonly repo = OrganizationRepository.Instance,
    private readonly settings = SettingsService.Instance,
    private readonly storage = StorageService.Instance,
    private readonly audit = AuditService.Instance
  ) {}

  async getBusiness(actor: Actor): Promise<BusinessDTO> {
    const business = await this.repo.findProfile(actor.organizationId);
    if (!business) throw AppError.notFound("Business not found");
    const settings = await this.settings.get(actor.organizationId);
    return { business, settings };
  }

  /** Business header + currency used on every exported PDF / spreadsheet. */
  async exportContext(actor: Actor): Promise<ExportContext> {
    const { business, settings } = await this.getBusiness(actor);
    return {
      businessName: business.name,
      businessAddress: business.address,
      businessPhone: business.phone,
      currencySymbol: settings.currencySymbol,
      currencyCode: settings.currencyCode,
      timezone: settings.timezone,
      generatedBy: actor.name,
    };
  }

  async updateBusiness(actor: Actor, data: UpdateBusinessInput): Promise<BusinessDTO> {
    assertPermission(actor, "settings.manage");
    const before = await this.repo.findProfile(actor.organizationId);
    await inTransaction(async (tx) => {
      await this.repo.updateProfile(actor.organizationId, data as Partial<BusinessProfileDTO>, tx);
      await this.audit.log(
        actor,
        { action: "update", entityType: "business", entityId: actor.organizationId, summary: "Updated business profile", before: { ...before }, after: data },
        tx
      );
    });
    return this.getBusiness(actor);
  }

  async updateSettings(actor: Actor, data: UpdateSettingsInput): Promise<BusinessDTO> {
    assertPermission(actor, "settings.manage");
    const before = await this.settings.get(actor.organizationId);
    await inTransaction(async (tx) => {
      await this.repo.updateSettings(actor.organizationId, data as Partial<SettingsDTO>, tx);
      await this.audit.log(
        actor,
        { action: "update", entityType: "settings", entityId: actor.organizationId, summary: "Updated business settings", before: { ...before }, after: data },
        tx
      );
    });
    this.settings.invalidate(actor.organizationId);
    return this.getBusiness(actor);
  }

  async uploadLogo(actor: Actor, buffer: Buffer): Promise<BusinessDTO> {
    assertPermission(actor, "settings.manage");
    const current = await this.repo.findProfile(actor.organizationId);
    const { url, publicId } = await this.storage.replace(
      buffer,
      { folder: STORAGE_FOLDERS.logo, maxDimension: 600 },
      current?.logoPublicId
    );
    await this.repo.updateProfile(actor.organizationId, { logoUrl: url, logoPublicId: publicId });
    return this.getBusiness(actor);
  }

  async removeLogo(actor: Actor): Promise<BusinessDTO> {
    assertPermission(actor, "settings.manage");
    const current = await this.repo.findProfile(actor.organizationId);
    await this.storage.delete(current?.logoPublicId);
    await this.repo.updateProfile(actor.organizationId, { logoUrl: null, logoPublicId: null });
    return this.getBusiness(actor);
  }
}
