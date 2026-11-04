import { db, type Tx } from "../../../infrastructure/database/transaction";
import { RoleEntity, type Role } from "../entities/role.entity";

export interface RoleDTO {
  id: string;
  key: string;
  name: string;
  description: string | null;
  permissions: string[];
  isBuiltIn: boolean;
  isLocked: boolean;
  userCount: number;
}

export class RoleRepository {
  static Instance = new RoleRepository();
  private constructor() {}

  async list(organizationId: string): Promise<RoleDTO[]> {
    return db().query(
      `SELECT r.id, r.key, r.name, r.description, r.permissions, r.is_built_in AS "isBuiltIn", r.is_locked AS "isLocked",
              (SELECT COUNT(*) FROM users u WHERE u.role_id = r.id AND u.deleted_at IS NULL) AS "userCount"
       FROM roles r
       WHERE r.organization_id = $1 AND r.deleted_at IS NULL
       ORDER BY r.is_built_in DESC, r.name
       LIMIT 200`,
      [organizationId]
    );
  }

  async findById(organizationId: string, id: string, tx?: Tx): Promise<RoleDTO | null> {
    const rows: RoleDTO[] = await db(tx).query(
      `SELECT r.id, r.key, r.name, r.description, r.permissions, r.is_built_in AS "isBuiltIn", r.is_locked AS "isLocked",
              (SELECT COUNT(*) FROM users u WHERE u.role_id = r.id AND u.deleted_at IS NULL) AS "userCount"
       FROM roles r WHERE r.organization_id = $1 AND r.id = $2 AND r.deleted_at IS NULL`,
      [organizationId, id]
    );
    return rows[0] ?? null;
  }

  async findByKey(organizationId: string, key: string, tx?: Tx): Promise<{ id: string } | null> {
    return db(tx).getRepository(RoleEntity).findOne({ where: { organizationId, key }, select: ["id"] });
  }

  async create(data: Omit<Role, "id" | "createdAt" | "updatedAt" | "deletedAt">, tx?: Tx): Promise<string> {
    const repo = db(tx).getRepository(RoleEntity);
    const saved = await repo.save(repo.create(data));
    return saved.id;
  }

  async update(organizationId: string, id: string, data: Partial<Role>, tx?: Tx): Promise<void> {
    await db(tx).getRepository(RoleEntity).update({ id, organizationId }, data);
  }

  async softDelete(organizationId: string, id: string, tx?: Tx): Promise<void> {
    await db(tx).getRepository(RoleEntity).softDelete({ id, organizationId });
  }
}
