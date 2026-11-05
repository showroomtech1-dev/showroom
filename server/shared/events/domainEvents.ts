// In-process domain events. Services announce what happened after their transaction commits;
// listeners (e.g. emails) react without the services depending on them. Listener failures are
// logged and never reach the caller.

export interface OpenedAlert {
  type: string;
  severity: string;
  title: string;
  body: string | null;
  entityType: string;
  entityId: string;
  branchId: string | null;
  permission: string;
  dedupeKey: string;
}

export interface DomainEvents {
  "user.created": { organizationId: string; userId: string; tempPassword: string; mustChangePassword: boolean };
  "user.passwordResetByAdmin": { organizationId: string; userId: string; tempPassword: string };
  "user.passwordChanged": { organizationId: string; userId: string };
  "auth.passwordResetRequested": { organizationId: string; userId: string; code: string };
  "sale.created": { organizationId: string; saleId: string };
  "leave.reviewed": { organizationId: string; leaveId: string };
  "payslip.issued": { organizationId: string; payslipIds: string[] };
  "alerts.opened": { organizationId: string; alerts: OpenedAlert[] };
}

type Listener<K extends keyof DomainEvents> = (payload: DomainEvents[K]) => Promise<void> | void;

const listeners = new Map<keyof DomainEvents, Array<(payload: never) => Promise<void> | void>>();

export const domainEvents = {
  on<K extends keyof DomainEvents>(event: K, listener: Listener<K>): void {
    const list = listeners.get(event) ?? [];
    list.push(listener as (payload: never) => Promise<void> | void);
    listeners.set(event, list);
  },

  emit<K extends keyof DomainEvents>(event: K, payload: DomainEvents[K]): void {
    for (const listener of (listeners.get(event) ?? []) as Array<Listener<K>>) {
      Promise.resolve()
        .then(() => listener(payload))
        .catch((err) => console.error(`[events] "${event}" listener failed`, err));
    }
  },
};
