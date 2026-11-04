import { Router } from "express";
import { requireAuthenticatedOnly, requirePermission } from "../../../shared/access/can";
import { authMiddleware } from "../../../shared/middleware/auth.middleware";
import { uploadImage } from "../../../shared/middleware/upload.middleware";
import { validate } from "../../../shared/middleware/validate.middleware";
import { emptyObject } from "../../../shared/validation/common";
import { z } from "zod";
import { BranchController, OrganizationController } from "../controllers/organization.controller";
import {
  branchIdSchema,
  createBranchSchema,
  listBranchesSchema,
  updateBranchSchema,
  updateBusinessSchema,
  updateSettingsSchema,
} from "../validators/organization.schema";

const none = z.object({ body: emptyObject.optional() });

/** /api/v1/settings */
export const settingsRouter = Router();
settingsRouter.use(authMiddleware);
// Everyone signed in needs currency, tax and receipt layout to render screens and receipts.
settingsRouter.get("/", requireAuthenticatedOnly(), OrganizationController.get);
settingsRouter.patch("/", requirePermission("settings.manage"), validate(updateSettingsSchema), OrganizationController.updateSettings);
settingsRouter.patch("/business", requirePermission("settings.manage"), validate(updateBusinessSchema), OrganizationController.updateBusiness);
settingsRouter.post("/logo", requirePermission("settings.manage"), uploadImage("logo", 3), validate(none), OrganizationController.uploadLogo);
settingsRouter.delete("/logo", requirePermission("settings.manage"), OrganizationController.removeLogo);

/** /api/v1/branches */
export const branchRouter = Router();
branchRouter.use(authMiddleware);
branchRouter.get("/", requireAuthenticatedOnly(), validate(listBranchesSchema), BranchController.list);
branchRouter.post("/", requirePermission("branch.manage"), validate(createBranchSchema), BranchController.create);
branchRouter.patch("/:id", requirePermission("branch.manage"), validate(updateBranchSchema), BranchController.update);
branchRouter.delete("/:id", requirePermission("branch.manage"), validate(branchIdSchema), BranchController.remove);
