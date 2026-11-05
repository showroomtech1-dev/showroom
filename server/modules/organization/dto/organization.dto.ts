export interface BusinessProfileDTO {
  id: string;
  name: string;
  legalName: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  website: string | null;
  logoUrl: string | null;
  logoPublicId: string | null;
}

export interface SettingsDTO {
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
  emailDigestHour: number;
  emailAlertsEnabled: boolean;
  emailReceiptsEnabled: boolean;
  emailDebtRemindersAuto: boolean;
  emailPayslipsEnabled: boolean;
  lastDigestDate: string | null;
}

export interface BusinessDTO {
  business: BusinessProfileDTO;
  settings: SettingsDTO;
}

export interface BranchDTO {
  id: string;
  organizationId: string;
  name: string;
  code: string;
  address: string | null;
  phone: string | null;
  isMain: boolean;
  isActive: boolean;
  createdAt: Date;
}
