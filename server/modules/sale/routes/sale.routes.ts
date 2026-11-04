import { Router } from "express";
import { publicRoute, requireAny, requirePermission } from "../../../shared/access/can";
import { authMiddleware } from "../../../shared/middleware/auth.middleware";
import { validate } from "../../../shared/middleware/validate.middleware";
import { CashupController, SaleController, SaleReturnController } from "../controllers/sale.controller";
import {
  cashupPreviewSchema,
  closeCashupSchema,
  commissionsSchema,
  createReturnSchema,
  createSaleSchema,
  dailySummarySchema,
  listCashupsSchema,
  listReturnsSchema,
  listSalesSchema,
  publicReceiptSchema,
  receiptSchema,
  returnIdSchema,
  saleIdSchema,
  voidSaleSchema,
} from "../validators/sale.schema";

// Sales staff without sale.readall still reach these routes — the service limits them to their own sales.
const SEES_SALES = ["sale.create", "sale.readall"] as const;

/** /api/v1/sales */
export const saleRouter = Router();
saleRouter.use(authMiddleware);
saleRouter.get("/daily-summary", requireAny(...SEES_SALES, "cashup.manage"), validate(dailySummarySchema), SaleController.dailySummary);
saleRouter.get("/commissions", requireAny(...SEES_SALES, "payroll.manage"), validate(commissionsSchema), SaleController.commissions);
saleRouter.get("/", requireAny(...SEES_SALES), validate(listSalesSchema), SaleController.list);
saleRouter.get("/:id", requireAny(...SEES_SALES), validate(saleIdSchema), SaleController.get);
saleRouter.get("/:id/receipt", requireAny(...SEES_SALES), validate(receiptSchema), SaleController.receipt);
saleRouter.get("/:id/share", requireAny(...SEES_SALES), validate(saleIdSchema), SaleController.share);
saleRouter.post("/", requirePermission("sale.create"), validate(createSaleSchema), SaleController.create);
saleRouter.post("/:id/void", requirePermission("sale.void"), validate(voidSaleSchema), SaleController.void);

/** /api/v1/sale-returns */
export const saleReturnRouter = Router();
saleReturnRouter.use(authMiddleware);
saleReturnRouter.get("/", requireAny("sale.return", "sale.readall"), validate(listReturnsSchema), SaleReturnController.list);
saleReturnRouter.get("/:id", requireAny("sale.return", "sale.readall"), validate(returnIdSchema), SaleReturnController.get);
saleReturnRouter.post("/", requirePermission("sale.return"), validate(createReturnSchema), SaleReturnController.create);

/** /api/v1/cash-ups */
export const cashupRouter = Router();
cashupRouter.use(authMiddleware);
cashupRouter.get("/preview", requirePermission("cashup.manage"), validate(cashupPreviewSchema), CashupController.preview);
cashupRouter.get("/", requirePermission("cashup.manage"), validate(listCashupsSchema), CashupController.list);
cashupRouter.post("/", requirePermission("cashup.manage"), validate(closeCashupSchema), CashupController.close);

/** /api/v1/public/receipts — the link shared with customers on WhatsApp. */
export const publicReceiptRouter = Router();
publicReceiptRouter.get("/:token", publicRoute("customer receipt link (unguessable token)"), validate(publicReceiptSchema), SaleController.publicReceipt);
