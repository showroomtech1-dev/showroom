import { Router } from "express";
import { requirePermission } from "../../../shared/access/can";
import { authMiddleware } from "../../../shared/middleware/auth.middleware";
import { validate } from "../../../shared/middleware/validate.middleware";
import { QuotationController } from "../controllers/quotation.controller";
import {
  convertQuotationSchema,
  createQuotationSchema,
  listQuotationsSchema,
  quotationIdSchema,
  quotationPdfSchema,
  quotationStatusSchema,
  updateQuotationSchema,
} from "../validators/quotation.schema";

/** /api/v1/quotations */
const router = Router();
router.use(authMiddleware);

router.get("/", requirePermission("quotation.manage"), validate(listQuotationsSchema), QuotationController.list);
router.get("/:id", requirePermission("quotation.manage"), validate(quotationIdSchema), QuotationController.get);
router.get("/:id/pdf", requirePermission("quotation.manage"), validate(quotationPdfSchema), QuotationController.pdf);
router.post("/", requirePermission("quotation.manage"), validate(createQuotationSchema), QuotationController.create);
router.patch("/:id", requirePermission("quotation.manage"), validate(updateQuotationSchema), QuotationController.update);
router.post("/:id/status", requirePermission("quotation.manage"), validate(quotationStatusSchema), QuotationController.setStatus);
router.post("/:id/convert", requirePermission("sale.create"), validate(convertQuotationSchema), QuotationController.convert);
router.delete("/:id", requirePermission("quotation.manage"), validate(quotationIdSchema), QuotationController.remove);

export default router;
