export interface UserDTO {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  branchId: string | null;
  branchName: string | null;
  roleId: string;
  roleKey: string;
  roleName: string;
  isActive: boolean;
  mustChangePassword: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
}

/** Row used to build the authenticated Actor. */
export interface ActorRow {
  id: string;
  organizationId: string;
  branchId: string | null;
  roleId: string;
  roleKey: string;
  roleName: string;
  name: string;
  email: string;
  isActive: boolean;
  permissions: string[];
}

export interface CredentialRow {
  id: string;
  organizationId: string;
  passwordHash: string;
  isActive: boolean;
}

export interface UserLookupDTO {
  id: string;
  name: string;
  /** Contact details are only sent to users who manage staff or logins. */
  email?: string | null;
  phone?: string | null;
  roleName: string;
  branchId: string | null;
}
