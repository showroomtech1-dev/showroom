import { actorOf, handle, input } from "../../../shared/http/handler";
import { RoleService } from "../services/role.service";
import { createRoleSchema, roleIdSchema, updateRoleSchema } from "../validators/role.schema";

export class RoleController {
  static catalog = handle("Permission catalog fetched", async () => RoleService.Instance.catalog());

  static list = handle("Roles fetched", (req) => RoleService.Instance.list(actorOf(req)));

  static create = handle("Role created", (req) => RoleService.Instance.create(actorOf(req), input(req, createRoleSchema).body), 201);

  static update = handle("Role updated", (req) => {
    const { params, body } = input(req, updateRoleSchema);
    return RoleService.Instance.update(actorOf(req), params.id, body);
  });

  static remove = handle("Role deleted", (req) => RoleService.Instance.remove(actorOf(req), input(req, roleIdSchema).params.id));
}
