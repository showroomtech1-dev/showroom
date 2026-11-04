import { actorOf, handle, input } from "../../../shared/http/handler";
import { requireFile } from "../../../shared/middleware/upload.middleware";
import { BranchService } from "../services/branch.service";
import { OrganizationService } from "../services/organization.service";
import {
  branchIdSchema,
  createBranchSchema,
  listBranchesSchema,
  updateBranchSchema,
  updateBusinessSchema,
  updateSettingsSchema,
} from "../validators/organization.schema";

export class OrganizationController {
  static get = handle("Business settings fetched", (req) => OrganizationService.Instance.getBusiness(actorOf(req)));

  static updateBusiness = handle("Business profile updated", (req) =>
    OrganizationService.Instance.updateBusiness(actorOf(req), input(req, updateBusinessSchema).body)
  );

  static updateSettings = handle("Settings updated", (req) =>
    OrganizationService.Instance.updateSettings(actorOf(req), input(req, updateSettingsSchema).body)
  );

  static uploadLogo = handle("Logo uploaded", (req) => OrganizationService.Instance.uploadLogo(actorOf(req), requireFile(req).buffer));

  static removeLogo = handle("Logo removed", (req) => OrganizationService.Instance.removeLogo(actorOf(req)));
}

export class BranchController {
  static list = handle("Branches fetched", (req) =>
    BranchService.Instance.list(actorOf(req), input(req, listBranchesSchema).query.includeInactive ?? false)
  );

  static create = handle(
    "Branch created",
    (req) => BranchService.Instance.create(actorOf(req), input(req, createBranchSchema).body),
    201
  );

  static update = handle("Branch updated", (req) => {
    const { params, body } = input(req, updateBranchSchema);
    return BranchService.Instance.update(actorOf(req), params.id, body);
  });

  static remove = handle("Branch deleted", (req) =>
    BranchService.Instance.remove(actorOf(req), input(req, branchIdSchema).params.id)
  );
}
