import { Router } from "express";
import { requireAny, requirePermission } from "../../../shared/access/can";
import { authMiddleware } from "../../../shared/middleware/auth.middleware";
import { validate } from "../../../shared/middleware/validate.middleware";
import { SupplierController } from "../controllers/supplier.controller";
import {
  createSupplierSchema,
  listSuppliersSchema,
  payablesSchema,
  supplierIdSchema,
  supplierStatementSchema,
  updateSupplierSchema,
} from "../validators/supplier.schema";

/** /api/v1/suppliers — suppliers and vendors (filter with ?type=). */
const router = Router();
router.use(authMiddleware);

router.get("/payables", requireAny("supplier.read", "finance.read", "dashboard.read"), validate(payablesSchema), SupplierController.payables);
router.get("/", requirePermission("supplier.read"), validate(listSuppliersSchema), SupplierController.list);
router.get("/:id", requirePermission("supplier.read"), validate(supplierIdSchema), SupplierController.get);
router.get("/:id/statement", requirePermission("supplier.read"), validate(supplierStatementSchema), SupplierController.statement);
router.post("/", requirePermission("supplier.manage"), validate(createSupplierSchema), SupplierController.create);
router.patch("/:id", requirePermission("supplier.manage"), validate(updateSupplierSchema), SupplierController.update);
router.delete("/:id", requirePermission("supplier.manage"), validate(supplierIdSchema), SupplierController.remove);

export default router;
