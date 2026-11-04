import { actorOf, handle, input, Paged } from "../../../shared/http/handler";
import { requireFiles } from "../../../shared/middleware/upload.middleware";
import { CategoryService } from "../services/category.service";
import { ProductService } from "../services/product.service";
import {
  addVariantSchema,
  barcodeSchema,
  categoryIdSchema,
  createCategorySchema,
  createProductSchema,
  listProductsSchema,
  photoIdSchema,
  posSearchSchema,
  productIdSchema,
  updateCategorySchema,
  updateProductSchema,
  updateVariantSchema,
  variantIdSchema,
} from "../validators/product.schema";

export class ProductController {
  static list = handle("Products fetched", async (req) =>
    Paged.of(await ProductService.Instance.list(actorOf(req), input(req, listProductsSchema).query))
  );

  static posSearch = handle("Products found", (req) => {
    const { q, limit, branchId } = input(req, posSearchSchema).query;
    return ProductService.Instance.posSearch(actorOf(req), q, limit, branchId);
  });

  static byBarcode = handle("Product found", (req) => {
    const { params, query } = input(req, barcodeSchema);
    return ProductService.Instance.byBarcode(actorOf(req), params.code, query.branchId);
  });

  static get = handle("Product fetched", (req) => ProductService.Instance.get(actorOf(req), input(req, productIdSchema).params.id));

  static create = handle("Product created", (req) => ProductService.Instance.create(actorOf(req), input(req, createProductSchema).body), 201);

  static update = handle("Product updated", (req) => {
    const { params, body } = input(req, updateProductSchema);
    return ProductService.Instance.update(actorOf(req), params.id, body);
  });

  static remove = handle("Product deleted", (req) => ProductService.Instance.remove(actorOf(req), input(req, productIdSchema).params.id));

  static addVariant = handle(
    "Variant added",
    (req) => {
      const { params, body } = input(req, addVariantSchema);
      return ProductService.Instance.addVariant(actorOf(req), params.id, body);
    },
    201
  );

  static updateVariant = handle("Variant updated", (req) => {
    const { params, body } = input(req, updateVariantSchema);
    return ProductService.Instance.updateVariant(actorOf(req), params.id, params.variantId, body);
  });

  static removeVariant = handle("Variant deleted", (req) => {
    const { params } = input(req, variantIdSchema);
    return ProductService.Instance.removeVariant(actorOf(req), params.id, params.variantId);
  });

  static addPhotos = handle("Photos uploaded", (req) =>
    ProductService.Instance.addPhotos(
      actorOf(req),
      input(req, productIdSchema).params.id,
      requireFiles(req).map((f) => f.buffer)
    )
  );

  static removePhoto = handle("Photo removed", (req) => {
    const { params } = input(req, photoIdSchema);
    return ProductService.Instance.removePhoto(actorOf(req), params.id, params.photoId);
  });
}

export class CategoryController {
  static list = handle("Categories fetched", (req) => CategoryService.Instance.list(actorOf(req)));

  static create = handle("Category created", (req) => CategoryService.Instance.create(actorOf(req), input(req, createCategorySchema).body), 201);

  static update = handle("Category updated", (req) => {
    const { params, body } = input(req, updateCategorySchema);
    return CategoryService.Instance.update(actorOf(req), params.id, body);
  });

  static remove = handle("Category deleted", (req) => CategoryService.Instance.remove(actorOf(req), input(req, categoryIdSchema).params.id));
}
