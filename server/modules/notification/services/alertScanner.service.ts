// Turns business conditions into in-app alerts: low / out-of-stock items, supplier payments due,
// customer debts due, recurring expenses due. Runs on a schedule and on demand; an alert closes
// itself once its condition clears.
import { domainEvents } from "../../../shared/events/domainEvents";
import { addDays, todayIn } from "../../../shared/utils/dates";
import { formatMoney } from "../../../shared/utils/money";
import { CustomerRepository } from "../../customer/repositories/customer.repository";
import { RecurringExpenseRepository } from "../../expense/repositories/recurringExpense.repository";
import { StockRepository } from "../../inventory/repositories/stock.repository";
import { OrganizationRepository } from "../../organization/repositories/organization.repository";
import { SettingsService } from "../../organization/services/settings.service";
import { SupplierRepository } from "../../supplier/repositories/supplier.repository";
import { NotificationRepository, type AlertInput } from "../repositories/notification.repository";

const STOCK_TYPES = ["low_stock", "out_of_stock"];
const OTHER_TYPES = ["supplier_payment_due", "customer_debt_due", "recurring_expense_due"];
const LOW_STOCK_DEBOUNCE_MS = 60_000;

export class AlertScannerService {
  static Instance = new AlertScannerService();
  private readonly lastStockScan = new Map<string, number>();

  private constructor(
    private readonly notifications = NotificationRepository.Instance,
    private readonly stock = StockRepository.Instance,
    private readonly suppliers = SupplierRepository.Instance,
    private readonly customers = CustomerRepository.Instance,
    private readonly recurring = RecurringExpenseRepository.Instance,
    private readonly organizations = OrganizationRepository.Instance,
    private readonly settings = SettingsService.Instance
  ) {}

  private async openAll(organizationId: string, alerts: AlertInput[], types: string[]): Promise<number> {
    const opened: AlertInput[] = [];
    for (const alert of alerts) if (await this.notifications.open(organizationId, alert)) opened.push(alert);
    await this.notifications.resolveStale(organizationId, types, alerts.map((a) => a.dedupeKey));
    // Only brand-new alerts are announced (emails), so nobody is emailed about the same thing twice.
    if (opened.length > 0) domainEvents.emit("alerts.opened", { organizationId, alerts: opened });
    return alerts.length;
  }

  async scanStock(organizationId: string): Promise<number> {
    const rows = await this.stock.attentionPerBranch(organizationId);
    const alerts: AlertInput[] = rows.map((r) => {
      const out = Number(r.quantity) <= 0;
      return {
        type: out ? "out_of_stock" : "low_stock",
        severity: out ? "critical" : "warning",
        title: `${out ? "Out of stock" : "Low stock"}: ${r.label}`,
        body: out ? `None left at ${r.branchName}. Reorder level is ${r.reorderLevel}.` : `Only ${r.quantity} left at ${r.branchName} (reorder level ${r.reorderLevel}).`,
        entityType: "product_variant",
        entityId: r.variantId,
        branchId: r.branchId,
        permission: "inventory.read",
        // Separate keys for low vs out, so going from low → out raises a new (critical) alert.
        dedupeKey: `${out ? "out" : "low"}:${r.variantId}:${r.branchId}`,
      };
    });
    return this.openAll(organizationId, alerts, STOCK_TYPES);
  }

  /** Called after each sale; at most one stock scan per business per minute. */
  scanLowStockSoon(organizationId: string): void {
    const last = this.lastStockScan.get(organizationId) ?? 0;
    if (Date.now() - last < LOW_STOCK_DEBOUNCE_MS) return;
    this.lastStockScan.set(organizationId, Date.now());
    this.scanStock(organizationId).catch((err) => console.error("[alerts] stock scan failed", err));
  }

  async scanDues(organizationId: string): Promise<number> {
    const settings = await this.settings.get(organizationId);
    const today = todayIn(settings.timezone);
    const until = addDays(today, settings.reminderDaysBeforeDue);
    const money = (v: number) => formatMoney(v, settings.currencySymbol);
    const [supplies, debts, bills] = await Promise.all([
      this.suppliers.dueSupplies(organizationId, today, until, 500),
      this.customers.dueDebts(organizationId, today, until),
      this.recurring.due(organizationId, today, until),
    ]);

    const alerts: AlertInput[] = [
      ...supplies.map((s) => {
        const overdue = s.dueDate < today;
        return {
          type: "supplier_payment_due",
          severity: overdue ? ("critical" as const) : ("warning" as const),
          title: `${overdue ? "Overdue" : "Due soon"}: pay ${s.supplierName} ${money(Number(s.outstanding))}`,
          body: `${s.code}${s.invoiceNumber ? ` (invoice ${s.invoiceNumber})` : ""} ${overdue ? `was due ${s.dueDate} — ${s.daysOverdue} day(s) late` : `is due ${s.dueDate}`}.`,
          entityType: "supply",
          entityId: s.supplyId,
          branchId: null,
          permission: "supplierpayment.manage",
          dedupeKey: `supply:${s.supplyId}:${overdue ? "overdue" : "soon"}`,
        };
      }),
      ...debts.map((d) => {
        const overdue = Number(d.overdue) > 0;
        return {
          type: "customer_debt_due",
          severity: overdue ? ("warning" as const) : ("info" as const),
          title: `${d.name} owes ${money(Number(d.amountDue))}`,
          body: overdue ? `${money(Number(d.overdue))} is overdue (oldest due ${d.oldestDueDate}). Send a reminder.` : `Due by ${d.oldestDueDate}.`,
          entityType: "customer",
          entityId: d.customerId,
          branchId: null,
          permission: "customer.read",
          dedupeKey: `debt:${d.customerId}:${overdue ? "overdue" : "soon"}`,
        };
      }),
      ...bills.map((b) => ({
        type: "recurring_expense_due",
        severity: b.nextDueDate < today ? ("warning" as const) : ("info" as const),
        title: `${b.name} ${b.nextDueDate < today ? "is overdue" : "is due"}: ${money(Number(b.amount))}`,
        body: `${b.frequency} ${b.categoryName.toLowerCase()} expense due ${b.nextDueDate}${b.payee ? ` to ${b.payee}` : ""}.`,
        entityType: "recurring_expense",
        entityId: b.id,
        branchId: b.branchId,
        permission: "expense.manage",
        dedupeKey: `recurring:${b.id}:${b.nextDueDate}`,
      })),
    ];
    return this.openAll(organizationId, alerts, OTHER_TYPES);
  }

  async scanOrganization(organizationId: string): Promise<{ stockAlerts: number; dueAlerts: number }> {
    const stockAlerts = await this.scanStock(organizationId);
    const dueAlerts = await this.scanDues(organizationId);
    return { stockAlerts, dueAlerts };
  }

  async scanAll(): Promise<void> {
    for (const id of await this.organizations.listOrganizationIds()) {
      await this.scanOrganization(id).catch((err) => console.error(`[alerts] scan failed for ${id}`, err));
    }
    await this.notifications.purgeOld().catch(() => undefined);
  }
}
