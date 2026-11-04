import { inTransaction } from "../../../infrastructure/database/transaction";
import { assertPermission } from "../../../shared/access/can";
import { AppError } from "../../../shared/errors/AppError";
import type { Actor } from "../../../shared/types/actor";
import { AuditService } from "../../audit/services/audit.service";
import type { CategoryDTO } from "../dto/product.dto";
import { CategoryRepository } from "../repositories/category.repository";
import type { CreateCategoryInput, UpdateCategoryInput } from "../validators/product.schema";

export class CategoryService {
  static Instance = new CategoryService();
  private constructor(
    private readonly repo = CategoryRepository.Instance,
    private readonly audit = AuditService.Instance
  ) {}

  list(actor: Actor): Promise<CategoryDTO[]> {
    return this.repo.list(actor.organizationId);
  }

  async get(actor: Actor, id: string): Promise<CategoryDTO> {
    const category = await this.repo.findById(actor.organizationId, id);
    if (!category) throw AppError.notFound("Category not found");
    return category;
  }

  async create(actor: Actor, data: CreateCategoryInput): Promise<CategoryDTO> {
    assertPermission(actor, "product.manage");
    if (await this.repo.findByName(actor.organizationId, data.name)) throw AppError.conflict("A category with this name already exists");
    const id = await inTransaction(async (tx) => {
      const categoryId = await this.repo.create(actor.organizationId, data, tx);
      await this.audit.log(actor, { action: "create", entityType: "product_category", entityId: categoryId, summary: `Created category ${data.name}` }, tx);
      return categoryId;
    });
    return this.get(actor, id);
  }

  async update(actor: Actor, id: string, data: UpdateCategoryInput): Promise<CategoryDTO> {
    assertPermission(actor, "product.manage");
    const before = await this.get(actor, id);
    if (data.name && data.name.toLowerCase() !== before.name.toLowerCase()) {
      if (await this.repo.findByName(actor.organizationId, data.name)) throw AppError.conflict("A category with this name already exists");
    }
    await this.repo.update(actor.organizationId, id, data);
    return this.get(actor, id);
  }

  async remove(actor: Actor, id: string): Promise<void> {
    assertPermission(actor, "product.manage");
    const category = await this.get(actor, id);
    if (category.productCount > 0) throw AppError.conflict("Move this category's products to another category first");
    await inTransaction(async (tx) => {
      await this.repo.softDelete(actor.organizationId, id, tx);
      await this.audit.log(actor, { action: "delete", entityType: "product_category", entityId: id, summary: `Deleted category ${category.name}` }, tx);
    });
  }
}
