import { IsNull } from "typeorm";
import { db, type Tx } from "../../../infrastructure/database/transaction";
import type { BranchDTO } from "../dto/organization.dto";
import { BranchEntity } from "../entities/branch.entity";

const FIELDS = ["id", "organizationId", "name", "code", "address", "phone", "isMain", "isActive", "createdAt"] as const;

export class BranchRepository {
  static Instance = new BranchRepository();
  private constructor() {}

  async list(organizationId: string, includeInactive: boolean): Promise<BranchDTO[]> {
    return db()
      .getRepository(BranchEntity)
      .find({
        where: includeInactive ? { organizationId } : { organizationId, isActive: true },
        select: [...FIELDS],
        order: { isMain: "DESC", name: "ASC" },
        take: 200,
      });
  }

  async findById(organizationId: string, id: string, tx?: Tx): Promise<BranchDTO | null> {
    return db(tx).getRepository(BranchEntity).findOne({ where: { id, organizationId }, select: [...FIELDS] });
  }

  async findMain(organizationId: string, tx?: Tx): Promise<BranchDTO | null> {
    const repo = db(tx).getRepository(BranchEntity);
    const main = await repo.findOne({ where: { organizationId, isMain: true, deletedAt: IsNull() }, select: [...FIELDS] });
    return main ?? repo.findOne({ where: { organizationId, isActive: true }, select: [...FIELDS], order: { createdAt: "ASC" } });
  }

  async findByCode(organizationId: string, code: string): Promise<BranchDTO | null> {
    return db().getRepository(BranchEntity).findOne({ where: { organizationId, code }, select: [...FIELDS] });
  }

  async create(data: Omit<BranchDTO, "id" | "createdAt">, tx?: Tx): Promise<BranchDTO> {
    const repo = db(tx).getRepository(BranchEntity);
    const saved = await repo.save(repo.create(data));
    return (await this.findById(data.organizationId, saved.id, tx)) as BranchDTO;
  }

  async update(organizationId: string, id: string, data: Partial<BranchDTO>, tx?: Tx): Promise<void> {
    await db(tx).getRepository(BranchEntity).update({ id, organizationId }, data);
  }

  async clearMain(organizationId: string, tx?: Tx): Promise<void> {
    await db(tx).getRepository(BranchEntity).update({ organizationId, isMain: true }, { isMain: false });
  }

  async softDelete(organizationId: string, id: string, tx?: Tx): Promise<void> {
    await db(tx).getRepository(BranchEntity).softDelete({ id, organizationId });
  }

  /** True when anything (users, stock, sales…) still points at this branch. */
  async isInUse(id: string): Promise<boolean> {
    const rows: Array<{ used: boolean }> = await db().query(
      `SELECT (EXISTS (SELECT 1 FROM users WHERE branch_id = $1 AND deleted_at IS NULL)
            OR EXISTS (SELECT 1 FROM stock_levels WHERE branch_id = $1 AND quantity <> 0)) AS used`,
      [id]
    );
    return Boolean(rows[0]?.used);
  }
}
