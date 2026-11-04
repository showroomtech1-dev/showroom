import { actorOf, handle, input, Paged } from "../../../shared/http/handler";
import { AccountService } from "../services/account.service";
import { TransferService } from "../services/transfer.service";
import {
  accountIdSchema,
  accountStatementSchema,
  createAccountSchema,
  createTransferSchema,
  listAccountsSchema,
  listTransfersSchema,
  transferIdSchema,
  updateAccountSchema,
} from "../validators/finance.schema";

export class AccountController {
  static list = handle("Accounts fetched", (req) => AccountService.Instance.list(actorOf(req), input(req, listAccountsSchema).query));

  static options = handle("Account options fetched", (req) => AccountService.Instance.options(actorOf(req)));

  static get = handle("Account fetched", (req) => AccountService.Instance.get(actorOf(req), input(req, accountIdSchema).params.id));

  static statement = handle("Account statement fetched", (req) => {
    const { params, query } = input(req, accountStatementSchema);
    return AccountService.Instance.statement(actorOf(req), params.id, query);
  });

  static create = handle("Account created", (req) => AccountService.Instance.create(actorOf(req), input(req, createAccountSchema).body), 201);

  static update = handle("Account updated", (req) => {
    const { params, body } = input(req, updateAccountSchema);
    return AccountService.Instance.update(actorOf(req), params.id, body);
  });

  static remove = handle("Account deleted", (req) => AccountService.Instance.remove(actorOf(req), input(req, accountIdSchema).params.id));
}

export class TransferController {
  static list = handle("Transfers fetched", async (req) =>
    Paged.of(await TransferService.Instance.list(actorOf(req), input(req, listTransfersSchema).query))
  );

  static create = handle("Transfer recorded", (req) => TransferService.Instance.create(actorOf(req), input(req, createTransferSchema).body), 201);

  static remove = handle("Transfer cancelled", (req) => TransferService.Instance.remove(actorOf(req), input(req, transferIdSchema).params.id));
}
