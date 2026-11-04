import { db, type Tx } from "../../../infrastructure/database/transaction";
import type { BusinessProfileDTO, SettingsDTO } from "../dto/organization.dto";
import { OrganizationEntity } from "../entities/organization.entity";
import { OrganizationSettingsEntity } from "../entities/organizationSettings.entity";

const PROFILE_FIELDS = ["id", "name", "legalName", "phone", "email", "address", "website", "logoUrl", "logoPublicId"] as const;

export class OrganizationRepository {
  static Instance = new OrganizationRepository();
  private constructor() {}

  async findProfile(organizationId: string, tx?: Tx): Promise<BusinessProfileDTO | null> {
    return db(tx).getRepository(OrganizationEntity).findOne({ where: { id: organizationId }, select: [...PROFILE_FIELDS] });
  }

  async findSettings(organizationId: string, tx?: Tx): Promise<SettingsDTO | null> {
    const row = await db(tx).getRepository(OrganizationSettingsEntity).findOne({ where: { organizationId } });
    if (!row) return null;
    const { id: _id, organizationId: _org, updatedAt: _u, organization: _o, ...settings } = row;
    return settings;
  }

  async createOrganization(data: Partial<BusinessProfileDTO> & { name: string }, tx?: Tx): Promise<BusinessProfileDTO> {
    const repo = db(tx).getRepository(OrganizationEntity);
    const saved = await repo.save(repo.create(data));
    return (await this.findProfile(saved.id, tx)) as BusinessProfileDTO;
  }

  async createSettings(organizationId: string, data: Partial<SettingsDTO>, tx?: Tx): Promise<void> {
    const repo = db(tx).getRepository(OrganizationSettingsEntity);
    await repo.save(repo.create({ ...data, organizationId }));
  }

  async updateProfile(organizationId: string, data: Partial<BusinessProfileDTO>, tx?: Tx): Promise<void> {
    await db(tx).getRepository(OrganizationEntity).update({ id: organizationId }, data);
  }

  async updateSettings(organizationId: string, data: Partial<SettingsDTO>, tx?: Tx): Promise<void> {
    await db(tx).getRepository(OrganizationSettingsEntity).update({ organizationId }, data);
  }

  async listOrganizationIds(): Promise<string[]> {
    const rows: Array<{ id: string }> = await db().query(`SELECT id FROM organizations ORDER BY created_at LIMIT 1000`);
    return rows.map((r) => r.id);
  }
}
