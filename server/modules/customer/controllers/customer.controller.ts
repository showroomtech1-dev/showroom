import { actorOf, handle, input, Paged } from "../../../shared/http/handler";
import { EmailNotifierService } from "../../notification/services/emailNotifier.service";
import { CustomerService } from "../services/customer.service";
import { CustomerPaymentService } from "../services/customerPayment.service";
import {
  createCustomerPaymentSchema,
  createCustomerSchema,
  customerHistorySchema,
  customerIdSchema,
  customerPaymentIdSchema,
  customerStatementSchema,
  debtorsSchema,
  listCustomerPaymentsSchema,
  listCustomersSchema,
  updateCustomerSchema,
} from "../validators/customer.schema";

export class CustomerController {
  static list = handle("Customers fetched", async (req) =>
    Paged.of(await CustomerService.Instance.list(actorOf(req), input(req, listCustomersSchema).query))
  );

  static debtors = handle("Debtors fetched", (req) => CustomerService.Instance.debtors(actorOf(req), input(req, debtorsSchema).query.format));

  static receivables = handle("Receivables summary fetched", (req) => CustomerService.Instance.receivables(actorOf(req)));

  static get = handle("Customer fetched", (req) => CustomerService.Instance.get(actorOf(req), input(req, customerIdSchema).params.id));

  static history = handle("Purchase history fetched", async (req) => {
    const { params, query } = input(req, customerHistorySchema);
    return Paged.of(await CustomerService.Instance.history(actorOf(req), params.id, query.page, query.limit));
  });

  static statement = handle("Customer statement fetched", (req) => {
    const { params, query } = input(req, customerStatementSchema);
    return CustomerService.Instance.statement(actorOf(req), params.id, query);
  });

  static emailReminder = handle("Reminder emailed", async (req) => {
    const actor = actorOf(req);
    const { id } = input(req, customerIdSchema).params;
    return EmailNotifierService.Instance.debtReminder(actor.organizationId, id, true);
  });

  static reminder = handle("Reminder prepared", (req) => CustomerService.Instance.reminder(actorOf(req), input(req, customerIdSchema).params.id));

  static create = handle("Customer created", (req) => CustomerService.Instance.create(actorOf(req), input(req, createCustomerSchema).body), 201);

  static update = handle("Customer updated", (req) => {
    const { params, body } = input(req, updateCustomerSchema);
    return CustomerService.Instance.update(actorOf(req), params.id, body);
  });

  static remove = handle("Customer deleted", (req) => CustomerService.Instance.remove(actorOf(req), input(req, customerIdSchema).params.id));
}

export class CustomerPaymentController {
  static list = handle("Customer payments fetched", async (req) =>
    Paged.of(await CustomerPaymentService.Instance.list(actorOf(req), input(req, listCustomerPaymentsSchema).query))
  );

  static get = handle("Customer payment fetched", (req) =>
    CustomerPaymentService.Instance.get(actorOf(req), input(req, customerPaymentIdSchema).params.id)
  );

  static create = handle(
    "Customer payment recorded",
    (req) => CustomerPaymentService.Instance.create(actorOf(req), input(req, createCustomerPaymentSchema).body),
    201
  );

  static remove = handle("Customer payment deleted", (req) =>
    CustomerPaymentService.Instance.remove(actorOf(req), input(req, customerPaymentIdSchema).params.id)
  );
}
