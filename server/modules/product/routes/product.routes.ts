import { Router } from "express";
import { requireAny, requirePermission } from "../../../shared/access/can";
import { authMiddleware } from "../../../shared/middleware/auth.middleware";
import { uploadImages } from "../../../shared/middleware/upload.middleware";
import { validate } from "../../../shared/middleware/validate.middleware";
import { CategoryController, ProductController } from "../controllers/product.controller";
import {
  addVariantSchema,
  barcodeSchema,
  categoryIdSchema,
  createCategorySchema,
  createProductSchema,
  listProductsSchema,
  photoIdSchema,
  posSearchSchema,
  productPhotosSchema,
  productIdSchema,
  updateCategorySchema,
  updateProductSchema,
  updateVariantSchema,
  variantIdSchema,
} from "../validators/product.schema";

/** /api/v1/products */
export const productRouter = Router();
productRouter.use(authMiddleware);
productRouter.get("/pos-search", requireAny("sale.create", "quotation.manage", "product.read"), validate(posSearchSchema), ProductController.posSearch);
productRouter.get("/barcode/:code", requireAny("sale.create", "quotation.manage", "product.read"), validate(barcodeSchema), ProductController.byBarcode);
productRouter.get("/", requirePermission("product.read"), validate(listProductsSchema), ProductController.list);
productRouter.get("/:id", requirePermission("product.read"), validate(productIdSchema), ProductController.get);
productRouter.post("/", requirePermission("product.manage"), validate(createProductSchema), ProductController.create);
productRouter.patch("/:id", requirePermission("product.manage"), validate(updateProductSchema), ProductController.update);
productRouter.delete("/:id", requirePermission("product.manage"), validate(productIdSchema), ProductController.remove);
productRouter.post("/:id/variants", requirePermission("product.manage"), validate(addVariantSchema), ProductController.addVariant);
productRouter.patch("/:id/variants/:variantId", requirePermission("product.manage"), validate(updateVariantSchema), ProductController.updateVariant);
productRouter.delete("/:id/variants/:variantId", requirePermission("product.manage"), validate(variantIdSchema), ProductController.removeVariant);
productRouter.post("/:id/photos", requirePermission("product.manage"), uploadImages("photos", 6), validate(productPhotosSchema), ProductController.addPhotos);
productRouter.delete("/:id/photos/:photoId", requirePermission("product.manage"), validate(photoIdSchema), ProductController.removePhoto);

/** /api/v1/product-categories */
export const categoryRouter = Router();
categoryRouter.use(authMiddleware);
categoryRouter.get("/", requireAny("product.read", "sale.create"), CategoryController.list);
categoryRouter.post("/", requirePermission("product.manage"), validate(createCategorySchema), CategoryController.create);
categoryRouter.patch("/:id", requirePermission("product.manage"), validate(updateCategorySchema), CategoryController.update);
categoryRouter.delete("/:id", requirePermission("product.manage"), validate(categoryIdSchema), CategoryController.remove);
