// Every email the system sends. Reacts to domain events (welcome, password, receipt, payslip, leave,
// urgent alerts, automatic debt reminders), sends the daily digest on the scheduler, and handles the
// "email this now" buttons. Each business decides which emails go out in Settings → Notifications.
import { env } from "../../../config/env";
import { AppError } from "../../../shared/errors/AppError";
import { domainEvents, type OpenedAlert } from "../../../shared/events/domainEvents";
import type { Actor } from "../../../shared/types/actor";
import { addDays, startOfMonth, todayIn } from "../../../shared/utils/dates";
import { passwordChangedEmail, passwordResetByAdminEmail, passwordResetCodeEmail, welcomeEmail, type ComposedMail } from "../../../shared/utils/mail/account.mail";
import { debtReminderEmail, receiptEmail } from "../../../shared/utils/mail/customer.mail";
import { dailyDigestEmail, urgentAlertsEmail } from "../../../shared/utils/mail/operations.mail";
import { leaveDecisionEmail, payslipEmail } from "../../../shared/utils/mail/staff.mail";
import { emailConfigured, emailLayout, heading, paragraph, sendMail, type LayoutBrand } from "../../../shared/utils/mailer";
import { formatMoney } from "../../../shared/utils/money";
import { renderPayslip } from "../../../shared/utils/pdf/payslip.pdf";
import type { MailAttachment } from "../../../infrastructure/mail/mailTransport";
import { CustomerRepository } from "../../customer/repositories/customer.repository";
import { AttendanceRepository } from "../../employee/repositories/attendance.repository";
import { EmployeeRepository } from "../../employee/repositories/employee.repository";
import { RecurringExpenseRepository } from "../../expense/repositories/recurringExpense.repository";
import { StockRepository } from "../../inventory/repositories/stock.repository";
import type { SettingsDTO } from "../../organization/dto/organization.dto";
import { OrganizationRepository } from "../../organization/repositories/organization.repository";
import { SettingsService } from "../../organization/services/settings.service";
import { PayrollRepository } from "../../payroll/repositories/payroll.repository";
import { SaleReportRepository } from "../../sale/repositories/saleReport.repository";
import { ReceiptService } from "../../sale/services/receipt.service";
import { SupplierRepository } from "../../supplier/repositories/supplier.repository";
import { UserRepository } from "../../user/repositories/user.repository";

interface Context {
  brand: LayoutBrand;
  settings: SettingsDTO;
  businessPhone: string | null;
  replyTo: string | null;
}

const URGENT_TYPES = new Set(["out_of_stock", "supplier_payment_due"]);

function localHour(timeZone: string): number {
  return Number(new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", hour12: false }).format(new Date())) % 24;
}

export class EmailNotifierService {
  static Instance = new EmailNotifierService();
  private registered = false;

  private constructor(
    private readonly organizations = OrganizationRepository.Instance,
    private readonly settingsService = SettingsService.Instance,
    private readonly users = UserRepository.Instance,
    private readonly customers = CustomerRepository.Instance,
    private readonly receipts = ReceiptService.Instance,
    private readonly employees = EmployeeRepository.Instance,
    private readonly attendance = AttendanceRepository.Instance,
    private readonly payroll = PayrollRepository.Instance,
    private readonly saleReports = SaleReportRepository.Instance,
    private readonly stock = StockRepository.Instance,
    private readonly suppliers = SupplierRepository.Instance,
    private readonly recurring = RecurringExpenseRepository.Instance
  ) {}

  private async context(organizationId: string): Promise<Context> {
    const [profile, settings] = await Promise.all([this.organizations.findProfile(organizationId), this.settingsService.get(organizationId)]);
    return {
      brand: { businessName: profile?.name ?? "ShowroomPro", footerEmail: profile?.email ?? null },
      settings,
      businessPhone: profile?.phone ?? null,
      replyTo: profile?.email ?? null,
    };
  }

  private send(ctx: Context, to: string, mail: ComposedMail, attachments?: MailAttachment[]): Promise<boolean> {
    return sendMail({ to, ...mail, fromName: ctx.brand.businessName, replyTo: ctx.replyTo, attachments });
  }

  /** Wire the event listeners once at boot. */
  register(): void {
    if (this.registered) return;
    this.registered = true;
    domainEvents.on("user.created", (e) => this.welcome(e.organizationId, e.userId, e.tempPassword, e.mustChangePassword));
    domainEvents.on("user.passwordResetByAdmin", (e) => this.passwordResetByAdmin(e.organizationId, e.userId, e.tempPassword));
    domainEvents.on("user.passwordChanged", (e) => this.passwordChanged(e.organizationId, e.userId));
    domainEvents.on("auth.passwordResetRequested", (e) => this.passwordResetCode(e.organizationId, e.userId, e.code));
    domainEvents.on("sale.created", async (e) => {
      const ctx = await this.context(e.organizationId);
      if (ctx.settings.emailReceiptsEnabled) await this.saleReceipt(e.organizationId, e.saleId, false);
    });
    domainEvents.on("payslip.issued", async (e) => {
      const ctx = await this.context(e.organizationId);
      if (!ctx.settings.emailPayslipsEnabled) return;
      for (const id of e.payslipIds) await this.payslip(e.organizationId, id, false);
    });
    domainEvents.on("leave.reviewed", (e) => this.leaveDecision(e.organizationId, e.leaveId));
    domainEvents.on("alerts.opened", (e) => this.onAlerts(e.organizationId, e.alerts));
  }

  // ── Account ────────────────────────────────────────────────────────────────
  private async welcome(organizationId: string, userId: string, tempPassword: string, mustChange: boolean): Promise<void> {
    const [ctx, user] = await Promise.all([this.context(organizationId), this.users.findById(organizationId, userId)]);
    if (!user) return;
    await this.send(ctx, user.email, welcomeEmail({ brand: ctx.brand, name: user.name, email: user.email, roleName: user.roleName, tempPassword, mustChange, loginUrl: `${env.frontendUrl}/login` }));
  }

  private async passwordResetByAdmin(organizationId: string, userId: string, tempPassword: string): Promise<void> {
    const [ctx, user] = await Promise.all([this.context(organizationId), this.users.findById(organizationId, userId)]);
    if (!user) return;
    await this.send(ctx, user.email, passwordResetByAdminEmail({ brand: ctx.brand, name: user.name, tempPassword, loginUrl: `${env.frontendUrl}/login` }));
  }

  private async passwordChanged(organizationId: string, userId: string): Promise<void> {
    const [ctx, user] = await Promise.all([this.context(organizationId), this.users.findById(organizationId, userId)]);
    if (!user) return;
    const when = new Date().toLocaleString("en-GB", { timeZone: ctx.settings.timezone, dateStyle: "medium", timeStyle: "short" });
    await this.send(ctx, user.email, passwordChangedEmail({ brand: ctx.brand, name: user.name, when }));
  }

  public async passwordResetCode(organizationId: string, userId: string, code: string): Promise<void> {
    const [ctx, user] = await Promise.all([this.context(organizationId), this.users.findById(organizationId, userId)]);
    if (!user) return;
    await this.send(ctx, user.email, passwordResetCodeEmail({ brand: ctx.brand, name: user.name, code, minutes: env.otpTtlMinutes }));
  }

  // ── Customers ──────────────────────────────────────────────────────────────
  /** Emails the receipt (PDF attached). `strict` = called from a button, so explain why it can't be sent. */
  async saleReceipt(organizationId: string, saleId: string, strict: boolean): Promise<{ sentTo: string } | null> {
    const receipt = await this.receipts.forEmail(organizationId, saleId);
    if (!receipt) {
      if (strict) throw AppError.notFound("Sale not found");
      return null;
    }
    const customer = receipt.sale.customerId ? await this.customers.findById(organizationId, receipt.sale.customerId) : null;
    if (!customer?.email) {
      if (strict) throw AppError.badRequest("This sale has no customer email address. Add one to the customer's profile first.");
      return null;
    }
    if (strict) this.assertConfigured();
    const ctx = await this.context(organizationId);
    const date = new Date(receipt.sale.soldAt).toLocaleString("en-GB", { timeZone: ctx.settings.timezone, dateStyle: "medium", timeStyle: "short" });
    await this.send(
      ctx,
      customer.email,
      receiptEmail({
        brand: ctx.brand,
        currencySymbol: ctx.settings.currencySymbol,
        customerName: customer.name,
        code: receipt.sale.code,
        date,
        items: receipt.items.map((i) => ({ name: i.variantName ? `${i.productName} (${i.variantName})` : i.productName, quantity: i.quantity, lineTotal: i.lineTotal })),
        total: receipt.sale.total,
        amountPaid: receipt.sale.amountPaid,
        balanceDue: receipt.sale.balanceDue,
        dueDate: receipt.sale.dueDate,
        receiptUrl: receipt.receiptUrl,
      }),
      [{ filename: `receipt-${receipt.sale.code}.pdf`, contentType: "application/pdf", content: receipt.pdf }]
    );
    return { sentTo: customer.email };
  }

  async debtReminder(organizationId: string, customerId: string, strict: boolean): Promise<{ sentTo: string } | null> {
    const ctx = await this.context(organizationId);
    const customer = await this.customers.findById(organizationId, customerId);
    if (!customer) {
      if (strict) throw AppError.notFound("Customer not found");
      return null;
    }
    const balance = await this.customers.balance(organizationId, customerId, todayIn(ctx.settings.timezone));
    if (balance.balance <= 0) {
      if (strict) throw AppError.badRequest(`${customer.name} has no outstanding balance`);
      return null;
    }
    if (!customer.email) {
      if (strict) throw AppError.badRequest("This customer has no email address. Add one, or send the reminder on WhatsApp.");
      return null;
    }
    if (strict) this.assertConfigured();
    await this.send(ctx, customer.email, debtReminderEmail({ brand: ctx.brand, currencySymbol: ctx.settings.currencySymbol, customerName: customer.name, balance: balance.balance, overdue: balance.overdueAmount, businessPhone: ctx.businessPhone }));
    return { sentTo: customer.email };
  }

  // ── Staff ──────────────────────────────────────────────────────────────────
  private async employeeEmail(organizationId: string, employeeId: string): Promise<{ name: string; email: string } | null> {
    const employee = await this.employees.findById(organizationId, employeeId);
    const email = employee?.email || employee?.userEmail;
    return employee && email ? { name: employee.fullName, email } : null;
  }

  async payslip(organizationId: string, payslipId: string, strict: boolean): Promise<{ sentTo: string } | null> {
    const slip = await this.payroll.findPayslip(organizationId, payslipId);
    if (!slip) {
      if (strict) throw AppError.notFound("Payslip not found");
      return null;
    }
    const recipient = await this.employeeEmail(organizationId, slip.employeeId);
    if (!recipient) {
      if (strict) throw AppError.badRequest("This employee has no email address on their profile");
      return null;
    }
    if (strict) this.assertConfigured();
    const ctx = await this.context(organizationId);
    const s = slip.snapshot;
    await this.send(
      ctx,
      recipient.email,
      payslipEmail({ brand: ctx.brand, currencySymbol: ctx.settings.currencySymbol, name: recipient.name, code: s.code, period: s.period, payDate: s.payDate, grossPay: s.grossPay, totalDeductions: s.totalDeductions, netPay: s.netPay }),
      [{ filename: `payslip-${s.code}.pdf`, contentType: "application/pdf", content: await renderPayslip(s) }]
    );
    return { sentTo: recipient.email };
  }

  private async leaveDecision(organizationId: string, leaveId: string): Promise<void> {
    const leave = await this.attendance.findLeave(organizationId, leaveId);
    if (!leave || (leave.status !== "approved" && leave.status !== "rejected")) return;
    const recipient = await this.employeeEmail(organizationId, leave.employeeId);
    if (!recipient) return;
    const ctx = await this.context(organizationId);
    await this.send(
      ctx,
      recipient.email,
      leaveDecisionEmail({ brand: ctx.brand, name: recipient.name, decision: leave.status, type: leave.type, startDate: leave.startDate, endDate: leave.endDate, days: leave.days, note: leave.reviewNote })
    );
  }

  // ── Operations: urgent alerts, automatic debt reminders, daily digest ──────
  private async onAlerts(organizationId: string, alerts: OpenedAlert[]): Promise<void> {
    const ctx = await this.context(organizationId);
    if (ctx.settings.emailDebtRemindersAuto) {
      for (const alert of alerts.filter((a) => a.type === "customer_debt_due" && a.dedupeKey.endsWith(":overdue"))) {
        await this.debtReminder(organizationId, alert.entityId, false);
      }
    }
    if (!ctx.settings.emailAlertsEnabled) return;
    const urgent = alerts.filter((a) => URGENT_TYPES.has(a.type) && a.severity === "critical");
    if (urgent.length === 0) return;
    // One email per person, listing every new urgent alert they're allowed to see.
    const perUser = new Map<string, { name: string; email: string; alerts: OpenedAlert[] }>();
    for (const alert of urgent) {
      for (const user of await this.users.recipientsWithPermission(organizationId, alert.permission, alert.branchId)) {
        const entry = perUser.get(user.id) ?? { name: user.name, email: user.email, alerts: [] };
        entry.alerts.push(alert);
        perUser.set(user.id, entry);
      }
    }
    for (const entry of perUser.values()) {
      await this.send(ctx, entry.email, urgentAlertsEmail({ brand: ctx.brand, name: entry.name, alerts: entry.alerts.slice(0, 30), url: env.frontendUrl }));
    }
  }

  /** Called by the scheduler: sends today's digest once per business, after its configured hour. */
  async sendDueDigests(): Promise<void> {
    if (!emailConfigured()) return;
    for (const organizationId of await this.organizations.listOrganizationIds()) {
      await this.digestFor(organizationId).catch((err) => console.error(`[mail] digest failed for ${organizationId}`, err));
    }
  }

  private async digestFor(organizationId: string): Promise<void> {
    const ctx = await this.context(organizationId);
    const s = ctx.settings;
    const today = todayIn(s.timezone);
    if (!s.emailDigestEnabled || s.lastDigestDate === today || localHour(s.timezone) < s.emailDigestHour) return;
    // Mark first, so a crash mid-send can't produce duplicate digests.
    await this.organizations.updateSettings(organizationId, { lastDigestDate: today });
    this.settingsService.invalidate(organizationId);

    const yesterday = addDays(today, -1);
    const until = addDays(today, s.reminderDaysBeforeDue);
    const scope = (from: string, to: string) => ({ organizationId, branchId: null, from, to, timezone: s.timezone, soldById: null });
    const [y, month, counts, attention, supplies, debts, bills] = await Promise.all([
      this.saleReports.totals(scope(yesterday, yesterday)),
      this.saleReports.totals(scope(startOfMonth(today), today)),
      this.stock.alertCounts(organizationId, null),
      this.stock.attentionPerBranch(organizationId),
      this.suppliers.dueSupplies(organizationId, today, until, 15),
      this.customers.dueDebts(organizationId, today, until),
      this.recurring.due(organizationId, today, until),
    ]);
    const money = (v: number) => formatMoney(v, s.currencySymbol);
    const data = {
      date: today,
      yesterday: { date: yesterday, salesCount: y.salesCount, totalSales: y.totalSales },
      monthToDate: { salesCount: month.salesCount, totalSales: month.totalSales },
      stock: {
        low: counts.low,
        out: counts.out,
        items: attention
          .sort((a, b) => Number(a.quantity) - Number(b.quantity))
          .slice(0, 10)
          .map((a) => `${a.label} — ${Number(a.quantity) <= 0 ? "out of stock" : `${a.quantity} left`} at ${a.branchName}`),
      },
      supplierPayments: supplies.map((d) => ({ label: `${d.supplierName} (${d.code}, due ${d.dueDate})`, amount: Number(d.outstanding), overdue: d.dueDate < today })),
      customerDebts: debts.slice(0, 15).map((d) => ({ label: `${d.name} (due ${d.oldestDueDate})`, amount: Number(d.amountDue), overdue: Number(d.overdue) > 0 })),
      recurringExpenses: bills.map((b) => ({ label: `${b.name} (due ${b.nextDueDate})`, amount: Number(b.amount), overdue: b.nextDueDate < today })),
    };
    for (const user of await this.users.recipientsWithPermission(organizationId, "dashboard.read")) {
      await this.send(ctx, user.email, dailyDigestEmail({ brand: ctx.brand, currencySymbol: s.currencySymbol, name: user.name, data, dashboardUrl: env.frontendUrl }));
    }
    console.info(`[mail] daily digest sent for ${ctx.brand.businessName} (${money(y.totalSales)} yesterday)`);
  }

  /** Owner's "send me a test email" button. */
  async sendTest(actor: Actor): Promise<{ sentTo: string; provider: string }> {
    this.assertConfigured();
    const ctx = await this.context(actor.organizationId);
    const ok = await this.send(ctx, actor.email, {
      subject: `Test email — ${ctx.brand.businessName}`,
      html: emailLayout(
        heading("Email is working") + paragraph(`This test was sent from ShowroomPro using ${env.email.provider === "script" ? "the Apps Script relay" : "Gmail"}.`),
        ctx.brand
      ),
      text: "Email is working. This test was sent from ShowroomPro.",
    });
    if (!ok) throw AppError.unavailable("The email could not be sent. Check the EMAIL_* settings on the server (see the server log for details).");
    return { sentTo: actor.email, provider: env.email.provider };
  }

  private assertConfigured(): void {
    if (!emailConfigured()) throw AppError.unavailable("Email is not set up on the server. Add EMAIL_USER and EMAIL_PASSWORD (Gmail app password), or EMAIL_PROVIDER=script with EMAIL_SCRIPT_URL.");
  }
}
