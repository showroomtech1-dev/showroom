import { db, type Tx } from "../../../infrastructure/database/transaction";
import type { CategoryDTO } from "../dto/product.dto";
import { ProductCategoryEntity } from "../entities/productCategory.entity";

export class CategoryRepository {
  static Instance = new CategoryRepository();
  private constructor() {}

  async list(organizationId: string): Promise<CategoryDTO[]> {
    return db().query(
      `SELECT c.id, c.name, c.description,
              (SELECT COUNT(*) FROM products p WHERE p.category_id = c.id AND p.deleted_at IS NULL) AS "productCount"
       FROM product_categories c
       WHERE c.organization_id = $1 AND c.deleted_at IS NULL
       ORDER BY c.name LIMIT 500`,
      [organizationId]
    );
  }

  async findById(organizationId: string, id: string, tx?: Tx): Promise<CategoryDTO | null> {
    const rows: CategoryDTO[] = await db(tx).query(
      `SELECT c.id, c.name, c.description,
              (SELECT COUNT(*) FROM products p WHERE p.category_id = c.id AND p.deleted_at IS NULL) AS "productCount"
       FROM product_categories c WHERE c.organization_id = $1 AND c.id = $2 AND c.deleted_at IS NULL`,
      [organizationId, id]
    );
    return rows[0] ?? null;
  }

  async findByName(organizationId: string, name: string): Promise<{ id: string } | null> {
    const rows: Array<{ id: string }> = await db().query(
      `SELECT id FROM product_categories WHERE organization_id = $1 AND lower(name) = lower($2) AND deleted_at IS NULL`,
      [organizationId, name]
    );
    return rows[0] ?? null;
  }

  async create(organizationId: string, data: { name: string; description?: string | null }, tx?: Tx): Promise<string> {
    const repo = db(tx).getRepository(ProductCategoryEntity);
    const saved = await repo.save(repo.create({ organizationId, name: data.name, description: data.description ?? null }));
    return saved.id;
  }

  async update(organizationId: string, id: string, data: { name?: string; description?: string | null }, tx?: Tx): Promise<void> {
    await db(tx).getRepository(ProductCategoryEntity).update({ id, organizationId }, data);
  }

  async softDelete(organizationId: string, id: string, tx?: Tx): Promise<void> {
    await db(tx).getRepository(ProductCategoryEntity).softDelete({ id, organizationId });
  }
}
