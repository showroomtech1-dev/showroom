import { Router } from "express";
import { requireAny, requirePermission } from "../../../shared/access/can";
import { authMiddleware } from "../../../shared/middleware/auth.middleware";
import { validate } from "../../../shared/middleware/validate.middleware";
import { InventoryController, StockTakeController } from "../controllers/inventory.controller";
import {
  adjustStockSchema,
  branchQuerySchema,
  listLevelsSchema,
  listMovementsSchema,
  listStockTakesSchema,
  recordCountsSchema,
  startStockTakeSchema,
  stockTakeIdSchema,
  stockTakeItemsSchema,
  transferStockSchema,
} from "../validators/inventory.schema";

/** /api/v1/inventory */
export const inventoryRouter = Router();
inventoryRouter.use(authMiddleware);
inventoryRouter.get("/levels", requirePermission("inventory.read"), validate(listLevelsSchema), InventoryController.levels);
inventoryRouter.get("/alerts", requirePermission("inventory.read"), validate(branchQuerySchema), InventoryController.alerts);
inventoryRouter.get("/movements", requirePermission("inventory.read"), validate(listMovementsSchema), InventoryController.movements);
inventoryRouter.get("/valuation", requireAny("inventory.read", "finance.read"), validate(branchQuerySchema), InventoryController.valuation);
inventoryRouter.post("/adjustments", requirePermission("inventory.adjust"), validate(adjustStockSchema), InventoryController.adjust);
inventoryRouter.post("/transfers", requirePermission("inventory.transfer"), validate(transferStockSchema), InventoryController.transfer);

/** /api/v1/stock-takes */
export const stockTakeRouter = Router();
stockTakeRouter.use(authMiddleware);
stockTakeRouter.get("/", requireAny("stocktake.manage", "inventory.read"), validate(listStockTakesSchema), StockTakeController.list);
stockTakeRouter.get("/:id", requireAny("stocktake.manage", "inventory.read"), validate(stockTakeIdSchema), StockTakeController.get);
stockTakeRouter.get("/:id/items", requirePermission("stocktake.manage"), validate(stockTakeItemsSchema), StockTakeController.items);
stockTakeRouter.post("/", requirePermission("stocktake.manage"), validate(startStockTakeSchema), StockTakeController.start);
stockTakeRouter.post("/:id/counts", requirePermission("stocktake.manage"), validate(recordCountsSchema), StockTakeController.recordCounts);
stockTakeRouter.post("/:id/complete", requirePermission("stocktake.manage"), validate(stockTakeIdSchema), StockTakeController.complete);
stockTakeRouter.post("/:id/cancel", requirePermission("stocktake.manage"), validate(stockTakeIdSchema), StockTakeController.cancel);
