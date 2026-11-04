import { Router } from "express";
import { requireAny, requirePermission } from "../../../shared/access/can";
import { authMiddleware } from "../../../shared/middleware/auth.middleware";
import { validate } from "../../../shared/middleware/validate.middleware";
import { SupplyController } from "../controllers/supply.controller";
import { createSupplySchema, listSuppliesSchema, supplyIdSchema, updateSupplySchema } from "../validators/supply.schema";

/** /api/v1/supplies */
const router = Router();
router.use(authMiddleware);

router.get("/", requireAny("supplier.read", "supply.manage"), validate(listSuppliesSchema), SupplyController.list);
router.get("/:id", requireAny("supplier.read", "supply.manage"), validate(supplyIdSchema), SupplyController.get);
router.post("/", requirePermission("supply.manage"), validate(createSupplySchema), SupplyController.create);
router.patch("/:id", requirePermission("supply.manage"), validate(updateSupplySchema), SupplyController.update);
router.delete("/:id", requirePermission("supply.manage"), validate(supplyIdSchema), SupplyController.remove);

export default router;
