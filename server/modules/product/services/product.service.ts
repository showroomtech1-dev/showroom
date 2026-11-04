import { STORAGE_FOLDERS } from "../../../config/constants";
import { inTransaction, type Tx } from "../../../infrastructure/database/transaction";
import { assertPermission, can } from "../../../shared/access/can";
import { readBranchScope } from "../../../shared/access/scope";
import { AppError } from "../../../shared/errors/AppError";
import { StorageService } from "../../../shared/services/storage.service";
import type { Actor } from "../../../shared/types/actor";
import { AuditService } from "../../audit/services/audit.service";
import { StockService } from "../../inventory/services/stock.service";
import { StockRepository } from "../../inventory/repositories/stock.repository";
import { BranchService } from "../../organization/services/branch.service";
import { ReferenceCodeService } from "../../organization/services/referenceCode.service";
import { SupplierRepository } from "../../supplier/repositories/supplier.repository";
import type { PosItemDTO, ProductDetailDTO, VariantDTO } from "../dto/product.dto";
import { CategoryRepository } from "../repositories/category.repository";
import { ProductRepository } from "../repositories/product.repository";
import { VariantRepository } from "../repositories/variant.repository";
import type {
  AddVariantInput,
  CreateProductInput,
  ListProductsQuery,
  UpdateProductInput,
  UpdateVariantInput,
  VariantInput,
} from "../validators/product.schema";

const variantName = (v: Pick<VariantInput, "name" | "size" | "color" | "model">): string =>
  v.name?.trim() || [v.size, v.color, v.model].filter(Boolean).join(" / ") || "Default";

export class ProductService {
  static Instance = new ProductService();
  private constructor(
    private readonly products = ProductRepository.Instance,
    private readonly variants = VariantRepository.Instance,
    private readonly categories = CategoryRepository.Instance,
    private readonly suppliers = SupplierRepository.Instance,
    private readonly stock = StockService.Instance,
    private readonly stockRepo = StockRepository.Instance,
    private readonly branches = BranchService.Instance,
    private readonly codes = ReferenceCodeService.Instance,
    private readonly storage = StorageService.Instance,
    private readonly audit = AuditService.Instance
  ) {}

  private hideCost<T extends { costPrice?: number }>(actor: Actor, row: T): T {
    if (can(actor, "product.viewcost")) return row;
    const { costPrice: _c, ...rest } = row;
    return rest as T;
  }

  async list(actor: Actor, query: ListProductsQuery) {
    const result = await this.products.list(actor.organizationId, { ...query, branchId: readBranchScope(actor, query.branchId) });
    return { data: result.data.map((r) => this.hideCost(actor, r)), meta: result.meta };
  }

  async get(actor: Actor, id: string): Promise<ProductDetailDTO> {
    const product = await this.products.findById(actor.organizationId, id);
    if (!product) throw AppError.notFound("Product not found");
    const [variants, photos] = await Promise.all([this.variants.listByProduct(id), this.products.photos(id)]);
    const perBranch = await this.stockRepo.byBranch(variants.map((v) => v.id));
    const withStock: VariantDTO[] = variants.map((v) =>
      this.hideCost(actor, { ...v, stockByBranch: perBranch.filter((s) => s.variantId === v.id).map(({ variantId: _v, ...s }) => s) })
    );
    return this.hideCost(actor, { ...product, variants: withStock, photos });
  }

  async posSearch(actor: Actor, q: string, limit: number, branchId?: string): Promise<PosItemDTO[]> {
    const branch = readBranchScope(actor, branchId) ?? (await this.branches.resolveForWrite(actor, null));
    return this.variants.posSearch(actor.organizationId, branch, q, limit);
  }

  async byBarcode(actor: Actor, code: string, branchId?: string): Promise<PosItemDTO> {
    const branch = readBranchScope(actor, branchId) ?? (await this.branches.resolveForWrite(actor, null));
    const item = await this.variants.findByBarcode(actor.organizationId, branch, code);
    if (!item) throw AppError.notFound("No product with this barcode or SKU");
    return item;
  }

  private async assertRefs(actor: Actor, categoryId?: string | null, supplierId?: string | null): Promise<void> {
    if (categoryId && !(await this.categories.findById(actor.organizationId, categoryId))) throw AppError.badRequest("Category not found");
    if (supplierId && !(await this.suppliers.findById(actor.organizationId, supplierId))) throw AppError.badRequest("Supplier not found");
  }

  private async assertCodesFree(actor: Actor, list: Array<{ sku?: string | null; barcode?: string | null }>, exceptId?: string): Promise<void> {
    const skus = list.map((v) => v.sku?.toLowerCase()).filter((s): s is string => Boolean(s));
    const barcodes = list.map((v) => v.barcode).filter((b): b is string => Boolean(b));
    if (new Set(skus).size !== skus.length) throw AppError.badRequest("Each variant needs a different SKU");
    if (new Set(barcodes).size !== barcodes.length) throw AppError.badRequest("Each variant needs a different barcode");
    for (const sku of skus) if (await this.variants.skuTaken(actor.organizationId, sku, exceptId)) throw AppError.conflict(`SKU "${sku}" is already in use`);
    for (const code of barcodes) if (await this.variants.barcodeTaken(actor.organizationId, code, exceptId)) throw AppError.conflict(`Barcode "${code}" is already in use`);
  }

  private async insertVariant(actor: Actor, productId: string, productName: string, v: VariantInput, defaults: { costPrice: number; sellingPrice: number }, branchId: string, tx: Tx): Promise<string> {
    const sku = v.sku || (await this.codes.next(actor.organizationId, "sku", tx));
    const name = variantName(v);
    const costPrice = v.costPrice ?? defaults.costPrice;
    const id = await this.variants.create(
      {
        organizationId: actor.organizationId,
        productId,
        name,
        size: v.size ?? null,
        color: v.color ?? null,
        model: v.model ?? null,
        sku,
        barcode: v.barcode || null,
        costPrice,
        sellingPrice: v.sellingPrice ?? defaults.sellingPrice,
        reorderLevel: v.reorderLevel ?? null,
        isActive: true,
      },
      tx
    );
    if (v.openingQuantity && v.openingQuantity > 0) {
      await this.stock.move(
        actor,
        actor.organizationId,
        { branchId, variantId: id, productId, delta: v.openingQuantity, type: "opening", unitCost: costPrice, note: "Opening stock", label: `${productName} (${name})` },
        tx
      );
    }
    return id;
  }

  async create(actor: Actor, data: CreateProductInput): Promise<ProductDetailDTO> {
    assertPermission(actor, "product.manage");
    await this.assertRefs(actor, data.categoryId, data.supplierId);
    const hasVariants = Boolean(data.variants && data.variants.length > 0);
    const variantInputs: VariantInput[] = hasVariants
      ? (data.variants as VariantInput[])
      : [{ name: "Default", sku: data.sku, barcode: data.barcode, openingQuantity: data.openingQuantity }];
    await this.assertCodesFree(actor, variantInputs);
    const branchId = await this.branches.resolveForWrite(actor, data.branchId);

    const id = await inTransaction(async (tx) => {
      const productId = await this.products.create(
        {
          organizationId: actor.organizationId,
          name: data.name,
          categoryId: data.categoryId ?? null,
          brand: data.brand ?? null,
          description: data.description ?? null,
          unit: data.unit,
          costPrice: data.costPrice,
          sellingPrice: data.sellingPrice,
          reorderLevel: data.reorderLevel,
          supplierId: data.supplierId ?? null,
          hasVariants,
          isActive: true,
        },
        tx
      );
      for (const v of variantInputs) {
        await this.insertVariant(actor, productId, data.name, v, { costPrice: data.costPrice, sellingPrice: data.sellingPrice }, branchId, tx);
      }
      await this.audit.log(actor, { action: "create", entityType: "product", entityId: productId, summary: `Created product ${data.name}`, after: { name: data.name, costPrice: data.costPrice, sellingPrice: data.sellingPrice, variants: variantInputs.length } }, tx);
      return productId;
    });
    return this.get(actor, id);
  }

  async update(actor: Actor, id: string, data: UpdateProductInput): Promise<ProductDetailDTO> {
    assertPermission(actor, "product.manage");
    const before = await this.products.findById(actor.organizationId, id);
    if (!before) throw AppError.notFound("Product not found");
    await this.assertRefs(actor, data.categoryId, data.supplierId);
    const { applyPricesToVariants, ...fields } = data;
    await inTransaction(async (tx) => {
      await this.products.update(actor.organizationId, id, fields, tx);
      if (applyPricesToVariants && (data.costPrice !== undefined || data.sellingPrice !== undefined)) {
        await this.variants.updatePricesForProduct(id, { costPrice: data.costPrice, sellingPrice: data.sellingPrice }, tx);
      } else if (!before.hasVariants && (data.costPrice !== undefined || data.sellingPrice !== undefined)) {
        await this.variants.updatePricesForProduct(id, { costPrice: data.costPrice, sellingPrice: data.sellingPrice }, tx);
      }
      await this.audit.log(actor, { action: "update", entityType: "product", entityId: id, summary: `Updated product ${before.name}`, before: { ...before }, after: fields }, tx);
    });
    return this.get(actor, id);
  }

  async remove(actor: Actor, id: string): Promise<void> {
    assertPermission(actor, "product.manage");
    const product = await this.products.findById(actor.organizationId, id);
    if (!product) throw AppError.notFound("Product not found");
    if ((await this.products.totalStock(id)) !== 0) {
      throw AppError.conflict("This product still has stock. Adjust it to zero first, or deactivate the product.");
    }
    await inTransaction(async (tx) => {
      await this.products.softDelete(actor.organizationId, id, tx);
      await this.audit.log(actor, { action: "delete", entityType: "product", entityId: id, summary: `Deleted product ${product.name}`, before: { ...product } }, tx);
    });
  }

  async addVariant(actor: Actor, productId: string, data: AddVariantInput): Promise<ProductDetailDTO> {
    assertPermission(actor, "product.manage");
    const product = await this.products.findById(actor.organizationId, productId);
    if (!product) throw AppError.notFound("Product not found");
    await this.assertCodesFree(actor, [data]);
    const branchId = await this.branches.resolveForWrite(actor, data.branchId);
    await inTransaction(async (tx) => {
      const variantId = await this.insertVariant(actor, productId, product.name, data, { costPrice: product.costPrice ?? 0, sellingPrice: product.sellingPrice }, branchId, tx);
      if (!product.hasVariants) await this.products.update(actor.organizationId, productId, { hasVariants: true }, tx);
      await this.audit.log(actor, { action: "create", entityType: "product_variant", entityId: variantId, summary: `Added variant ${variantName(data)} to ${product.name}` }, tx);
    });
    return this.get(actor, productId);
  }

  async updateVariant(actor: Actor, productId: string, variantId: string, data: UpdateVariantInput): Promise<ProductDetailDTO> {
    assertPermission(actor, "product.manage");
    const variants = await this.variants.listByProduct(productId);
    const current = variants.find((v) => v.id === variantId);
    if (!current || !(await this.products.findById(actor.organizationId, productId))) throw AppError.notFound("Variant not found");
    await this.assertCodesFree(actor, [{ sku: data.sku, barcode: data.barcode }], variantId);
    // An explicit name wins; otherwise a changed size/colour/model renames the variant from its attributes.
    const attributesChanged = data.size !== undefined || data.color !== undefined || data.model !== undefined;
    const name =
      data.name?.trim() ||
      (attributesChanged
        ? variantName({
            size: data.size !== undefined ? data.size : current.size,
            color: data.color !== undefined ? data.color : current.color,
            model: data.model !== undefined ? data.model : current.model,
          })
        : current.name);
    await inTransaction(async (tx) => {
      await this.variants.update(actor.organizationId, variantId, { ...data, name }, tx);
      await this.audit.log(actor, { action: "update", entityType: "product_variant", entityId: variantId, summary: `Updated variant ${current.sku}`, before: { ...current }, after: data }, tx);
    });
    return this.get(actor, productId);
  }

  async removeVariant(actor: Actor, productId: string, variantId: string): Promise<ProductDetailDTO> {
    assertPermission(actor, "product.manage");
    const variants = await this.variants.listByProduct(productId);
    const current = variants.find((v) => v.id === variantId);
    if (!current || !(await this.products.findById(actor.organizationId, productId))) throw AppError.notFound("Variant not found");
    if (variants.length === 1) throw AppError.badRequest("A product needs at least one variant — delete the product instead");
    if (current.quantity !== 0) throw AppError.conflict("This variant still has stock. Adjust it to zero first.");
    await inTransaction(async (tx) => {
      await this.variants.softDelete(actor.organizationId, variantId, tx);
      await this.audit.log(actor, { action: "delete", entityType: "product_variant", entityId: variantId, summary: `Deleted variant ${current.sku}` }, tx);
    });
    return this.get(actor, productId);
  }

  async addPhotos(actor: Actor, productId: string, buffers: Buffer[]): Promise<ProductDetailDTO> {
    assertPermission(actor, "product.manage");
    const product = await this.products.findById(actor.organizationId, productId);
    if (!product) throw AppError.notFound("Product not found");
    const existing = await this.products.photos(productId);
    if (existing.length + buffers.length > 10) throw AppError.badRequest("A product can have at most 10 photos");
    let order = existing.length;
    for (const buffer of buffers) {
      const { url, publicId } = await this.storage.upload(buffer, { folder: STORAGE_FOLDERS.product });
      await this.products.addPhoto(productId, url, publicId, order);
      order += 1;
    }
    return this.get(actor, productId);
  }

  async removePhoto(actor: Actor, productId: string, photoId: string): Promise<ProductDetailDTO> {
    assertPermission(actor, "product.manage");
    if (!(await this.products.findById(actor.organizationId, productId))) throw AppError.notFound("Product not found");
    const photo = await this.products.findPhoto(productId, photoId);
    if (!photo) throw AppError.notFound("Photo not found");
    await this.products.deletePhoto(photoId);
    await this.storage.delete(photo.publicId);
    return this.get(actor, productId);
  }
}
