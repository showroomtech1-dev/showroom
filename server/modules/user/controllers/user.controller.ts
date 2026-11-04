import { actorOf, handle, input, Paged } from "../../../shared/http/handler";
import { UserService } from "../services/user.service";
import {
  createUserSchema,
  listUsersSchema,
  lookupUsersSchema,
  resetPasswordSchema,
  updateUserSchema,
  userIdSchema,
} from "../validators/user.schema";

export class UserController {
  static list = handle("Users fetched", async (req) =>
    Paged.of(await UserService.Instance.list(actorOf(req), input(req, listUsersSchema).query))
  );

  static lookup = handle("Staff fetched", (req) =>
    UserService.Instance.lookup(actorOf(req), input(req, lookupUsersSchema).query.branchId)
  );

  static get = handle("User fetched", (req) => UserService.Instance.get(actorOf(req), input(req, userIdSchema).params.id));

  static create = handle("User created", (req) => UserService.Instance.create(actorOf(req), input(req, createUserSchema).body), 201);

  static update = handle("User updated", (req) => {
    const { params, body } = input(req, updateUserSchema);
    return UserService.Instance.update(actorOf(req), params.id, body);
  });

  static resetPassword = handle("Password reset", (req) => {
    const { params, body } = input(req, resetPasswordSchema);
    return UserService.Instance.resetPassword(actorOf(req), params.id, body);
  });

  static remove = handle("User deleted", (req) => UserService.Instance.remove(actorOf(req), input(req, userIdSchema).params.id));
}
