import { EntitySchema } from "typeorm";
import {
  boolColumn,
  dateColumn,
  intColumn,
  manyToOne,
  moneyColumn,
  primaryId,
  textColumn,
  updatedAt,
  uuidColumn,
  varchar,
} from "../../../infrastructure/database/columns";

export interface OrganizationSettings {
  id: string;
  organizationId: string;
  currencyCode: string;
  currencySymbol: string;
  timezone: string;
  receiptHeader: string | null;
  receiptFooter: string | null;
  taxEnabled: boolean;
  taxName: string;
  taxRateBps: number;
  taxInclusive: boolean;
  taxNumber: string | null;
  commissionEnabled: boolean;
  commissionRateBps: number;
  allowNegativeStock: boolean;
  reminderDaysBeforeDue: number;
  defaultCreditDays: number;
  workStartTime: string;
  lateGraceMinutes: number;
  latenessDeduction: number;
  absenceDeduction: number;
  emailDigestEnabled: boolean;
  /** Local hour (0–23) after which the daily digest goes out. */
  emailDigestHour: number;
  emailAlertsEnabled: boolean;
  emailReceiptsEnabled: boolean;
  /** Automatically email customers when a debt becomes overdue. */
  emailDebtRemindersAuto: boolean;
  emailPayslipsEnabled: boolean;
  lastDigestDate: string | null;
  updatedAt: Date;
  organization?: { id: string };
}

export const OrganizationSettingsEntity = new EntitySchema<OrganizationSettings>({
  name: "OrganizationSettings",
  tableName: "organization_settings",
  columns: {
    id: primaryId(),
    organizationId: uuidColumn("organization_id"),
    currencyCode: varchar("currency_code", 3, false, "NGN"),
    currencySymbol: varchar("currency_symbol", 8, false, "₦"),
    timezone: varchar("timezone", 60, false, "Africa/Lagos"),
    receiptHeader: textColumn("receipt_header"),
    receiptFooter: textColumn("receipt_footer"),
    taxEnabled: boolColumn("tax_enabled", false),
    taxName: varchar("tax_name", 30, false, "VAT"),
    taxRateBps: intColumn("tax_rate_bps", 750),
    taxInclusive: boolColumn("tax_inclusive", false),
    taxNumber: varchar("tax_number", 60, true),
    commissionEnabled: boolColumn("commission_enabled", false),
    commissionRateBps: intColumn("commission_rate_bps", 0),
    allowNegativeStock: boolColumn("allow_negative_stock", false),
    reminderDaysBeforeDue: intColumn("reminder_days_before_due", 3),
    defaultCreditDays: intColumn("default_credit_days", 30),
    workStartTime: varchar("work_start_time", 5, false, "08:30"),
    lateGraceMinutes: intColumn("late_grace_minutes", 15),
    latenessDeduction: moneyColumn("lateness_deduction"),
    absenceDeduction: moneyColumn("absence_deduction"),
    emailDigestEnabled: boolColumn("email_digest_enabled", true),
    emailDigestHour: intColumn("email_digest_hour", 7),
    emailAlertsEnabled: boolColumn("email_alerts_enabled", true),
    emailReceiptsEnabled: boolColumn("email_receipts_enabled", true),
    emailDebtRemindersAuto: boolColumn("email_debt_reminders_auto", false),
    emailPayslipsEnabled: boolColumn("email_payslips_enabled", true),
    lastDigestDate: dateColumn("last_digest_date", true),
    updatedAt: updatedAt(),
  },
  relations: { organization: manyToOne("Organization", "organization_id", "CASCADE") },
  indices: [{ name: "UQ_organization_settings_org", columns: ["organizationId"], unique: true }],
});
