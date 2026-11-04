export type AuditAction =
  | "create"
  | "update"
  | "delete"
  | "restore"
  | "approve"
  | "cancel"
  | "void"
  | "pay"
  | "reverse"
  | "login"
  | "export";

export interface AuditEntryInput {
  action: AuditAction;
  entityType: string;
  entityId?: string | null;
  summary: string;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
}

export interface AuditLogDTO {
  id: string;
  userId: string | null;
  userName: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  summary: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  ip: string | null;
  createdAt: Date;
}

export interface AuditListFilter {
  page: number;
  limit: number;
  entityType?: string;
  entityId?: string;
  userId?: string;
  action?: string;
  from?: string;
  to?: string;
  timezone: string;
}
