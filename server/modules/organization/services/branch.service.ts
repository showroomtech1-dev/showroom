import { inTransaction, type Tx } from "../../../infrastructure/database/transaction";
import { assertPermission, can } from "../../../shared/access/can";
import { writeBranchScope } from "../../../shared/access/scope";
import { AppError } from "../../../shared/errors/AppError";
import type { Actor } from "../../../shared/types/actor";
import { AuditService } from "../../audit/services/audit.service";
import type { BranchDTO } from "../dto/organization.dto";
import { BranchRepository } from "../repositories/branch.repository";
import type { CreateBranchInput, UpdateBranchInput } from "../validators/organization.schema";
import { ReferenceCodeService } from "./referenceCode.service";

export class BranchService {
  static Instance = new BranchService();
  private constructor(
    private readonly repo = BranchRepository.Instance,
    private readonly codes = ReferenceCodeService.Instance,
    private readonly audit = AuditService.Instance
  ) {}

  async list(actor: Actor, includeInactive = false): Promise<BranchDTO[]> {
    return this.repo.list(actor.organizationId, includeInactive && can(actor, "branch.manage"));
  }

  async get(actor: Actor, id: string): Promise<BranchDTO> {
    const branch = await this.repo.findById(actor.organizationId, id);
    if (!branch) throw AppError.notFound("Branch not found");
    return branch;
  }

  /**
   * The branch a write lands in: the requested one (if the actor may use it), else the actor's home
   * branch, else the main branch. Always verified to belong to the actor's organisation.
   */
  async resolveForWrite(actor: Actor, requested?: string | null, tx?: Tx): Promise<string> {
    const scoped = writeBranchScope(actor, requested);
    if (scoped) {
      const branch = await this.repo.findById(actor.organizationId, scoped, tx);
      if (!branch || !branch.isActive) throw AppError.badRequest("Branch not found or inactive");
      return branch.id;
    }
    const main = await this.repo.findMain(actor.organizationId, tx);
    if (!main) throw AppError.badRequest("Create a branch first");
    return main.id;
  }

  async create(actor: Actor, data: CreateBranchInput): Promise<BranchDTO> {
    assertPermission(actor, "branch.manage");
    return inTransaction(async (tx) => {
      const code = data.code || (await this.codes.next(actor.organizationId, "branch", tx));
      if (data.isMain) await this.repo.clearMain(actor.organizationId, tx);
      const branch = await this.repo.create(
        {
          organizationId: actor.organizationId,
          name: data.name,
          code,
          address: data.address ?? null,
          phone: data.phone ?? null,
          isMain: Boolean(data.isMain),
          isActive: true,
        },
        tx
      );
      await this.audit.log(actor, { action: "create", entityType: "branch", entityId: branch.id, summary: `Created branch ${branch.name}`, after: { ...branch } }, tx);
      return branch;
    });
  }

  async update(actor: Actor, id: string, data: UpdateBranchInput): Promise<BranchDTO> {
    assertPermission(actor, "branch.manage");
    const before = await this.get(actor, id);
    if (before.isMain && data.isActive === false) throw AppError.badRequest("The main branch cannot be deactivated");
    if (before.isMain && data.isMain === false) throw AppError.badRequest("Mark another branch as main instead");
    await inTransaction(async (tx) => {
      if (data.isMain) await this.repo.clearMain(actor.organizationId, tx);
      await this.repo.update(actor.organizationId, id, data, tx);
      await this.audit.log(actor, { action: "update", entityType: "branch", entityId: id, summary: `Updated branch ${before.name}`, before: { ...before }, after: data }, tx);
    });
    return this.get(actor, id);
  }

  async remove(actor: Actor, id: string): Promise<void> {
    assertPermission(actor, "branch.manage");
    const branch = await this.get(actor, id);
    if (branch.isMain) throw AppError.badRequest("The main branch cannot be deleted");
    if (await this.repo.isInUse(id)) {
      throw AppError.conflict("This branch still has staff or stock. Move them first, or deactivate the branch instead.");
    }
    await inTransaction(async (tx) => {
      await this.repo.softDelete(actor.organizationId, id, tx);
      await this.audit.log(actor, { action: "delete", entityType: "branch", entityId: id, summary: `Deleted branch ${branch.name}`, before: { ...branch } }, tx);
    });
  }
}
