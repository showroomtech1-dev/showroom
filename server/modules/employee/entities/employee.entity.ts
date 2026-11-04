import { EntitySchema } from "typeorm";
import {
  createdAt,
  dateColumn,
  deletedAt,
  intColumn,
  manyToOne,
  moneyColumn,
  primaryId,
  textColumn,
  updatedAt,
  uuidColumn,
  varchar,
} from "../../../infrastructure/database/columns";

export interface Employee {
  id: string;
  organizationId: string;
  branchId: string;
  /** Linked login (for clock-in, own leave requests and sales commission). */
  userId: string | null;
  code: string;
  firstName: string;
  lastName: string;
  photoUrl: string | null;
  photoPublicId: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  jobTitle: string | null;
  startDate: string;
  endDate: string | null;
  status: string;
  payFrequency: string;
  /** Pay per period (per month, or per week for weekly staff). */
  salary: number;
  /** Overrides the business default commission rate. */
  commissionRateBps: number | null;
  bankName: string | null;
  bankAccountNumber: string | null;
  bankAccountName: string | null;
  nextOfKinName: string | null;
  nextOfKinPhone: string | null;
  nextOfKinRelationship: string | null;
  nextOfKinAddress: string | null;
  guarantorName: string | null;
  guarantorPhone: string | null;
  guarantorAddress: string | null;
  guarantorRelationship: string | null;
  guarantorOccupation: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  organization?: { id: string };
  branch?: { id: string };
  user?: { id: string };
}

export const EmployeeEntity = new EntitySchema<Employee>({
  name: "Employee",
  tableName: "employees",
  columns: {
    id: primaryId(),
    organizationId: uuidColumn("organization_id"),
    branchId: uuidColumn("branch_id"),
    userId: uuidColumn("user_id", true),
    code: varchar("code", 20),
    firstName: varchar("first_name", 80),
    lastName: varchar("last_name", 80),
    photoUrl: varchar("photo_url", 500, true),
    photoPublicId: varchar("photo_public_id", 255, true),
    phone: varchar("phone", 30, true),
    email: varchar("email", 160, true),
    address: textColumn("address"),
    jobTitle: varchar("job_title", 80, true),
    startDate: dateColumn("start_date"),
    endDate: dateColumn("end_date", true),
    status: varchar("status", 12, false, "active"),
    payFrequency: varchar("pay_frequency", 10, false, "monthly"),
    salary: moneyColumn("salary"),
    commissionRateBps: intColumn("commission_rate_bps", null),
    bankName: varchar("bank_name", 120, true),
    bankAccountNumber: varchar("bank_account_number", 30, true),
    bankAccountName: varchar("bank_account_name", 160, true),
    nextOfKinName: varchar("next_of_kin_name", 160, true),
    nextOfKinPhone: varchar("next_of_kin_phone", 30, true),
    nextOfKinRelationship: varchar("next_of_kin_relationship", 60, true),
    nextOfKinAddress: textColumn("next_of_kin_address"),
    guarantorName: varchar("guarantor_name", 160, true),
    guarantorPhone: varchar("guarantor_phone", 30, true),
    guarantorAddress: textColumn("guarantor_address"),
    guarantorRelationship: varchar("guarantor_relationship", 60, true),
    guarantorOccupation: varchar("guarantor_occupation", 120, true),
    notes: textColumn("notes"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: deletedAt(),
  },
  relations: {
    organization: manyToOne("Organization", "organization_id", "CASCADE"),
    branch: manyToOne("Branch", "branch_id"),
    user: manyToOne("User", "user_id", "SET NULL"),
  },
  indices: [
    { name: "IDX_employees_org_status", columns: ["organizationId", "status"] },
    { name: "UQ_employees_org_code", columns: ["organizationId", "code"], unique: true },
    {
      name: "UQ_employees_org_user",
      columns: ["organizationId", "userId"],
      unique: true,
      where: "user_id IS NOT NULL AND deleted_at IS NULL",
    },
  ],
});
