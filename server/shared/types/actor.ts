// The authenticated caller. Built by authMiddleware from the JWT + the database (never from the token alone),
// passed as the first argument to every service method.
export interface Actor {
  id: string;
  organizationId: string;
  /** Home branch. `null` means not tied to a branch (only meaningful with `branch.all`). */
  branchId: string | null;
  roleId: string;
  roleKey: string;
  roleName: string;
  name: string;
  email: string;
  /** Resolved permission codes. `"*"` means every permission inside the organisation. */
  permissions: readonly string[];
  ip?: string;
}
