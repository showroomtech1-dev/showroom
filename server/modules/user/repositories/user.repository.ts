import { likePattern, SqlParams } from "../../../infrastructure/database/sql";
import { db, type Tx } from "../../../infrastructure/database/transaction";
import { fromWindowedRows, getOffset, type PagedRows } from "../../../shared/pagination/paginate";
import type { ActorRow, CredentialRow, UserDTO, UserLookupDTO } from "../dto/user.dto";
import { UserEntity, type User } from "../entities/user.entity";

const SELECT_USER = `
  SELECT u.id, u.name, u.email, u.phone, u.branch_id AS "branchId", b.name AS "branchName",
         u.role_id AS "roleId", r.key AS "roleKey", r.name AS "roleName", u.is_active AS "isActive",
         u.must_change_password AS "mustChangePassword", u.last_login_at AS "lastLoginAt", u.created_at AS "createdAt"
  FROM users u
  JOIN roles r ON r.id = u.role_id
  LEFT JOIN branches b ON b.id = u.branch_id`;

export interface UserListFilter {
  page: number;
  limit: number;
  search?: string;
  roleId?: string;
  branchId?: string;
  isActive?: boolean;
}

export class UserRepository {
  static Instance = new UserRepository();
  private constructor() {}

  async findActor(userId: string): Promise<ActorRow | null> {
    const rows: ActorRow[] = await db().query(
      `SELECT u.id, u.organization_id AS "organizationId", u.branch_id AS "branchId", u.role_id AS "roleId",
              r.key AS "roleKey", r.name AS "roleName", u.name, u.email, u.is_active AS "isActive", r.permissions
       FROM users u JOIN roles r ON r.id = u.role_id
       WHERE u.id = $1 AND u.deleted_at IS NULL AND r.deleted_at IS NULL`,
      [userId]
    );
    return rows[0] ?? null;
  }

  async findCredentialsByEmail(email: string): Promise<CredentialRow | null> {
    return db()
      .getRepository(UserEntity)
      .findOne({ where: { email: email.toLowerCase() }, select: ["id", "organizationId", "passwordHash", "isActive"] });
  }

  async findPasswordHash(userId: string): Promise<string | null> {
    const row = await db().getRepository(UserEntity).findOne({ where: { id: userId }, select: ["id", "passwordHash"] });
    return row?.passwordHash ?? null;
  }

  async findById(organizationId: string, id: string, tx?: Tx): Promise<UserDTO | null> {
    const rows: UserDTO[] = await db(tx).query(
      `${SELECT_USER} WHERE u.organization_id = $1 AND u.id = $2 AND u.deleted_at IS NULL`,
      [organizationId, id]
    );
    return rows[0] ?? null;
  }

  async existsByEmail(email: string): Promise<boolean> {
    return (await db().getRepository(UserEntity).count({ where: { email: email.toLowerCase() } })) > 0;
  }

  async list(organizationId: string, f: UserListFilter): Promise<PagedRows<UserDTO>> {
    const p = new SqlParams();
    const where = [`u.organization_id = ${p.add(organizationId)}`, "u.deleted_at IS NULL"];
    if (f.search) {
      const s = p.add(likePattern(f.search));
      where.push(`(u.name ILIKE ${s} OR u.email ILIKE ${s} OR u.phone ILIKE ${s})`);
    }
    if (f.roleId) where.push(`u.role_id = ${p.add(f.roleId)}`);
    if (f.branchId) where.push(`u.branch_id = ${p.add(f.branchId)}`);
    if (f.isActive !== undefined) where.push(`u.is_active = ${p.add(f.isActive)}`);
    const rows = await db().query(
      `SELECT x.*, COUNT(*) OVER() AS "__total" FROM (${SELECT_USER} WHERE ${where.join(" AND ")}) x
       ORDER BY x.name LIMIT ${p.add(f.limit)} OFFSET ${p.add(getOffset(f.page, f.limit))}`,
      p.values
    );
    return fromWindowedRows<UserDTO & Record<string, unknown>>(rows, f.page, f.limit);
  }

  async lookup(organizationId: string, branchId: string | null): Promise<UserLookupDTO[]> {
    const p = new SqlParams();
    const where = [`u.organization_id = ${p.add(organizationId)}`, "u.deleted_at IS NULL", "u.is_active = true"];
    if (branchId) where.push(`u.branch_id = ${p.add(branchId)}`);
    return db().query(
      `SELECT u.id, u.name, u.email, u.phone, r.name AS "roleName", u.branch_id AS "branchId"
       FROM users u JOIN roles r ON r.id = u.role_id
       WHERE ${where.join(" AND ")} ORDER BY u.name LIMIT 500`,
      p.values
    );
  }

  async create(data: Omit<User, "id" | "createdAt" | "updatedAt" | "deletedAt" | "lastLoginAt" | "lastSeenAt">, tx?: Tx): Promise<string> {
    const repo = db(tx).getRepository(UserEntity);
    const saved = await repo.save(repo.create(data));
    return saved.id;
  }

  async update(organizationId: string, id: string, data: Partial<User>, tx?: Tx): Promise<void> {
    await db(tx).getRepository(UserEntity).update({ id, organizationId }, data);
  }

  async touchLogin(id: string): Promise<void> {
    const now = new Date();
    await db().getRepository(UserEntity).update({ id }, { lastLoginAt: now, lastSeenAt: now });
  }

  async touchSeen(id: string, at = new Date()): Promise<void> {
    await db().query(`UPDATE users SET last_seen_at = $2 WHERE id = $1`, [id, at]);
  }

  async softDelete(organizationId: string, id: string, tx?: Tx): Promise<void> {
    await db(tx).getRepository(UserEntity).softDelete({ id, organizationId });
  }

  async findContactByEmail(email: string): Promise<{ id: string; organizationId: string; name: string; email: string; isActive: boolean } | null> {
    const rows = await db().query(
      `SELECT id, organization_id AS "organizationId", name, email, is_active AS "isActive" FROM users WHERE email = $1 AND deleted_at IS NULL`,
      [email.toLowerCase()]
    );
    return rows[0] ?? null;
  }

  /**
   * Active users who hold `permission` (directly or through the owner's "*"), optionally limited to
   * people who can see `branchId` (their own branch, no branch, or every branch).
   */
  async recipientsWithPermission(organizationId: string, permission: string, branchId: string | null = null): Promise<Array<{ id: string; name: string; email: string }>> {
    return db().query(
      `SELECT u.id, u.name, u.email FROM users u JOIN roles r ON r.id = u.role_id
       WHERE u.organization_id = $1 AND u.deleted_at IS NULL AND u.is_active = true AND r.deleted_at IS NULL
         AND ('*' = ANY(r.permissions) OR $2 = ANY(r.permissions))
         AND ($3::uuid IS NULL OR u.branch_id IS NULL OR u.branch_id = $3 OR '*' = ANY(r.permissions) OR 'branch.all' = ANY(r.permissions))
       ORDER BY u.name LIMIT 50`,
      [organizationId, permission, branchId]
    );
  }

  async countActiveWithRole(organizationId: string, roleId: string): Promise<number> {
    return db().getRepository(UserEntity).count({ where: { organizationId, roleId, isActive: true } });
  }
}
