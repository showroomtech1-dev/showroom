import { Router } from "express";
import { requireAny, requirePermission } from "../../../shared/access/can";
import { authMiddleware } from "../../../shared/middleware/auth.middleware";
import { uploadDocument } from "../../../shared/middleware/upload.middleware";
import { validate } from "../../../shared/middleware/validate.middleware";
import { SupplierPaymentController } from "../controllers/supplierPayment.controller";
import {
  createSupplierPaymentSchema,
  listSupplierPaymentsSchema,
  supplierPaymentIdSchema,
  supplierPaymentProofSchema,
  updateSupplierPaymentSchema,
} from "../validators/supplierPayment.schema";

/** /api/v1/supplier-payments */
const router = Router();
router.use(authMiddleware);

router.get("/", requireAny("supplier.read", "supplierpayment.manage"), validate(listSupplierPaymentsSchema), SupplierPaymentController.list);
router.get("/:id", requireAny("supplier.read", "supplierpayment.manage"), validate(supplierPaymentIdSchema), SupplierPaymentController.get);
router.post("/", requirePermission("supplierpayment.manage"), validate(createSupplierPaymentSchema), SupplierPaymentController.create);
router.patch("/:id", requirePermission("supplierpayment.manage"), validate(updateSupplierPaymentSchema), SupplierPaymentController.update);
router.delete("/:id", requirePermission("supplierpayment.manage"), validate(supplierPaymentIdSchema), SupplierPaymentController.remove);
router.post("/:id/proof", requirePermission("supplierpayment.manage"), uploadDocument("proof"), validate(supplierPaymentProofSchema), SupplierPaymentController.uploadProof);

export default router;
