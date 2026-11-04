// Creates a new business with everything it needs on day one: settings, a main branch, the
// built-in roles, default expense categories, cash / bank / POS accounts and the owner login.
import { inTransaction } from "../../../infrastructure/database/transaction";
import { AppError } from "../../../shared/errors/AppError";
import { hashPassword } from "../../../shared/utils/password";
import { OWNER_ROLE_KEY } from "../../access/catalog/roles.catalog";
import { RoleService } from "../../access/services/role.service";
import { AuditService } from "../../audit/services/audit.service";
import { ExpenseService } from "../../expense/services/expense.service";
import { AccountRepository } from "../../finance/repositories/account.repository";
import { UserRepository } from "../../user/repositories/user.repository";
import { BranchRepository } from "../repositories/branch.repository";
import { OrganizationRepository } from "../repositories/organization.repository";

export interface CreateBusinessInput {
  businessName: string;
  ownerName: string;
  ownerEmail: string;
  ownerPassword: string;
  phone?: string | null;
  address?: string | null;
  branchName?: string;
  bankName?: string;
}

export interface CreatedBusiness {
  organizationId: string;
  ownerUserId: string;
  mainBranchId: string;
  roleIds: Record<string, string>;
}

export class OnboardingService {
  static Instance = new OnboardingService();
  private constructor(
    private readonly organizations = OrganizationRepository.Instance,
    private readonly branches = BranchRepository.Instance,
    private readonly roles = RoleService.Instance,
    private readonly expenses = ExpenseService.Instance,
    private readonly accounts = AccountRepository.Instance,
    private readonly users = UserRepository.Instance,
    private readonly audit = AuditService.Instance
  ) {}

  async createBusiness(input: CreateBusinessInput): Promise<CreatedBusiness> {
    const email = input.ownerEmail.trim().toLowerCase();
    if (await this.users.existsByEmail(email)) throw AppError.conflict("A user with this email already exists");
    const passwordHash = await hashPassword(input.ownerPassword);

    return inTransaction(async (tx) => {
      const org = await this.organizations.createOrganization({ name: input.businessName, phone: input.phone ?? null, address: input.address ?? null }, tx);
      await this.organizations.createSettings(org.id, { receiptFooter: "Thank you for your patronage! Goods sold in good condition are not returnable after 7 days." }, tx);
      const branch = await this.branches.create(
        { organizationId: org.id, name: input.branchName ?? "Main Showroom", code: "MAIN", address: input.address ?? null, phone: input.phone ?? null, isMain: true, isActive: true },
        tx
      );
      const roleIds = await this.roles.seedBuiltIns(org.id, tx);
      await this.expenses.seedCategories(org.id, tx);

      const account = (name: string, type: "cash" | "bank" | "pos", bankName: string | null = null) =>
        this.accounts.create({ organizationId: org.id, branchId: null, name, type, bankName, accountNumber: null, openingBalance: 0, isDefault: true, isActive: true, notes: null }, tx);
      await account("Cash in hand", "cash");
      await account(input.bankName ?? "Business bank account", "bank", input.bankName ?? null);
      await account("POS terminal", "pos");

      const ownerUserId = await this.users.create(
        {
          organizationId: org.id,
          branchId: branch.id,
          roleId: roleIds[OWNER_ROLE_KEY],
          name: input.ownerName,
          email,
          phone: input.phone ?? null,
          passwordHash,
          isActive: true,
          mustChangePassword: false,
        },
        tx
      );
      await this.audit.record(null, org.id, { action: "create", entityType: "business", entityId: org.id, summary: `Business "${input.businessName}" created for ${email}` }, tx);
      return { organizationId: org.id, ownerUserId, mainBranchId: branch.id, roleIds };
    });
  }
}
