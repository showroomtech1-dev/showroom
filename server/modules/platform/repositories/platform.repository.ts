// Cross-business reads for platform operators. This is the ONLY repository that deliberately
// queries without an organization_id filter — every caller is behind requirePlatformAdmin().
import { likePattern, SqlParams } from "../../../infrastructure/database/sql";
import { db } from "../../../infrastructure/database/transaction";
import type { PresenceProfile } from "../../../infrastructure/realtime/presence";
import { fromWindowedRows, getOffset, type PagedRows } from "../../../shared/pagination/paginate";
import type {
  PlatformBusinessDTO,
  PlatformDailyDTO,
  PlatformLoginDTO,
  PlatformTotalsDTO,
  PlatformUserDTO,
  RecentSignupDTO,
} from "../dto/platform.dto";

export type BusinessSort = "newest" | "oldest" | "name" | "lastActive" | "sales";
export type BusinessStatus = "online" | "active7d" | "dormant" | "neverSold";
export type UserSort = "recent" | "lastSeen" | "lastLogin" | "name";
export type UserStatus = "online" | "active24h" | "active7d" | "neverLoggedIn" | "deactivated" | "new7d";

export interface BusinessListFilter {
  page: number;
  limit: number;
  search?: string;
  sort: BusinessSort;
  status?: BusinessStatus;
  onlineOrgIds: string[];
}

export interface UserListFilter {
  page: number;
  limit: number;
  search?: string;
  sort: UserSort;
  status?: UserStatus;
  organizationId?: string;
  onlineUserIds: string[];
}

/** Start of "today" in the viewer's timezone, as timestamptz. */
const startOfToday = (tz: string) => `(date_trunc('day', now() AT TIME ZONE ${tz}) AT TIME ZONE ${tz})`;

const LIVE_SALE = `s.deleted_at IS NULL AND s.status <> 'voided'`;

/** The business owner: an "owner"-role user, else the first account created. */
const OWNER_LATERAL = `
  LEFT JOIN LATERAL (
    SELECT u.id, u.name, u.email, u.phone, u.last_login_at
    FROM users u JOIN roles r ON r.id = u.role_id
    WHERE u.organization_id = o.id AND u.deleted_at IS NULL
    ORDER BY (r.key = 'owner') DESC, u.created_at ASC
    LIMIT 1
  ) ow ON true`;

export class PlatformRepository {
  static Instance = new PlatformRepository();
  private constructor() {}

  async totals(timezone: string): Promise<PlatformTotalsDTO> {
    const p = new SqlParams();
    const tz = p.add(timezone);
    const today = startOfToday(tz);
    const rows: PlatformTotalsDTO[] = await db().query(
      `SELECT
         (SELECT COUNT(*) FROM organizations) AS "businesses",
         (SELECT COUNT(*) FROM organizations WHERE created_at >= ${today}) AS "signupsToday",
         (SELECT COUNT(*) FROM organizations WHERE created_at >= now() - interval '7 days') AS "signups7d",
         (SELECT COUNT(*) FROM organizations WHERE created_at >= now() - interval '30 days') AS "signups30d",
         u.users AS "users", u.active AS "activeUsers", u.deactivated AS "deactivatedUsers", u.never AS "neverLoggedIn",
         u.new7d AS "newUsers7d", u.today AS "loggedInToday", u.seen24h AS "activeLast24h", u.seen7d AS "activeLast7d",
         (SELECT COUNT(*) FROM sales s WHERE ${LIVE_SALE} AND s.sold_at >= ${today}) AS "salesToday",
         (SELECT COUNT(*) FROM sales s WHERE ${LIVE_SALE} AND s.sold_at >= now() - interval '30 days') AS "sales30d",
         (SELECT COUNT(DISTINCT s.organization_id) FROM sales s WHERE ${LIVE_SALE} AND s.sold_at >= now() - interval '30 days') AS "sellingBusinesses30d",
         (SELECT COUNT(*) FROM products WHERE deleted_at IS NULL) AS "products",
         (SELECT COUNT(*) FROM customers WHERE deleted_at IS NULL) AS "customers"
       FROM (
         SELECT COUNT(*) AS users,
                COUNT(*) FILTER (WHERE is_active) AS active,
                COUNT(*) FILTER (WHERE NOT is_active) AS deactivated,
                COUNT(*) FILTER (WHERE last_login_at IS NULL) AS never,
                COUNT(*) FILTER (WHERE created_at >= now() - interval '7 days') AS new7d,
                COUNT(*) FILTER (WHERE last_login_at >= ${today}) AS today,
                COUNT(*) FILTER (WHERE last_seen_at >= now() - interval '24 hours') AS seen24h,
                COUNT(*) FILTER (WHERE last_seen_at >= now() - interval '7 days') AS seen7d
         FROM users WHERE deleted_at IS NULL
       ) u`,
      p.values
    );
    return rows[0];
  }

  /** One row per local day for the last `days` days: new businesses, new users, people who signed in. */
  async daily(timezone: string, days: number): Promise<PlatformDailyDTO[]> {
    const p = new SqlParams();
    const tz = p.add(timezone);
    const span = p.add(days - 1);
    // A day of slack on the lower bound covers timezones ahead of UTC.
    const since = `now() - (CAST(${span} AS int) + 2) * interval '1 day'`;
    const localDay = (col: string) => `(${col} AT TIME ZONE ${tz})::date`;
    return db().query(
      `WITH d AS (
         SELECT (now() AT TIME ZONE ${tz})::date - g AS day FROM generate_series(0, CAST(${span} AS int)) g
       ),
       o AS (SELECT ${localDay("created_at")} AS day, COUNT(*) AS n FROM organizations WHERE created_at >= ${since} GROUP BY 1),
       u AS (SELECT ${localDay("created_at")} AS day, COUNT(*) AS n FROM users WHERE deleted_at IS NULL AND created_at >= ${since} GROUP BY 1),
       l AS (SELECT ${localDay("created_at")} AS day, COUNT(DISTINCT user_id) AS n FROM audit_logs WHERE action = 'login' AND created_at >= ${since} GROUP BY 1)
       SELECT to_char(d.day, 'YYYY-MM-DD') AS "date",
         COALESCE(o.n, 0) AS "signups", COALESCE(u.n, 0) AS "newUsers", COALESCE(l.n, 0) AS "logins"
       FROM d LEFT JOIN o ON o.day = d.day LEFT JOIN u ON u.day = d.day LEFT JOIN l ON l.day = d.day
       ORDER BY d.day`,
      p.values
    );
  }

  async recentSignups(limit: number): Promise<RecentSignupDTO[]> {
    return db().query(
      `SELECT o.id, o.name, o.created_at AS "createdAt", ow.name AS "ownerName", ow.email AS "ownerEmail", ow.phone AS "ownerPhone"
       FROM organizations o ${OWNER_LATERAL}
       ORDER BY o.created_at DESC LIMIT $1`,
      [limit]
    );
  }

  async businesses(f: BusinessListFilter): Promise<PagedRows<Omit<PlatformBusinessDTO, "onlineCount">>> {
    const p = new SqlParams();
    const where: string[] = ["true"];
    if (f.search) {
      const s = p.add(likePattern(f.search));
      where.push(`(o.name ILIKE ${s} OR o.email ILIKE ${s} OR o.phone ILIKE ${s} OR ow.name ILIKE ${s} OR ow.email ILIKE ${s} OR ow.phone ILIKE ${s})`);
    }
    if (f.status === "online") where.push(`o.id = ANY(${p.add(f.onlineOrgIds)}::uuid[])`);
    if (f.status === "active7d") where.push(`uc.last_seen >= now() - interval '7 days'`);
    if (f.status === "dormant") where.push(`(uc.last_seen IS NULL OR uc.last_seen < now() - interval '30 days')`);
    if (f.status === "neverSold") where.push(`sa.last_sale IS NULL`);

    const order: Record<BusinessSort, string> = {
      newest: `o.created_at DESC`,
      oldest: `o.created_at ASC`,
      name: `o.name ASC`,
      lastActive: `uc.last_seen DESC NULLS LAST`,
      sales: `sa.sales_30d DESC, sa.total_30d DESC`,
    };

    const rows = await db().query(
      `SELECT o.id, o.name, o.phone, o.email, o.address, o.created_at AS "createdAt",
         COALESCE(st.currency_symbol, '₦') AS "currencySymbol",
         ow.id AS "ownerId", ow.name AS "ownerName", ow.email AS "ownerEmail", ow.phone AS "ownerPhone", ow.last_login_at AS "ownerLastLoginAt",
         uc.users AS "userCount", uc.active_users AS "activeUserCount", uc.last_login AS "lastLoginAt", uc.last_seen AS "lastSeenAt",
         (SELECT COUNT(*) FROM branches b WHERE b.organization_id = o.id AND b.deleted_at IS NULL) AS "branchCount",
         (SELECT COUNT(*) FROM products pr WHERE pr.organization_id = o.id AND pr.deleted_at IS NULL) AS "productCount",
         (SELECT COUNT(*) FROM customers c WHERE c.organization_id = o.id AND c.deleted_at IS NULL) AS "customerCount",
         sa.sales_30d AS "sales30d", sa.total_30d AS "salesTotal30d", sa.last_sale AS "lastSaleAt",
         COUNT(*) OVER() AS "__total"
       FROM organizations o
       LEFT JOIN organization_settings st ON st.organization_id = o.id
       ${OWNER_LATERAL}
       LEFT JOIN LATERAL (
         SELECT COUNT(*) AS users, COUNT(*) FILTER (WHERE u.is_active) AS active_users,
                MAX(u.last_login_at) AS last_login, MAX(u.last_seen_at) AS last_seen
         FROM users u WHERE u.organization_id = o.id AND u.deleted_at IS NULL
       ) uc ON true
       LEFT JOIN LATERAL (
         SELECT COUNT(*) FILTER (WHERE s.sold_at >= now() - interval '30 days') AS sales_30d,
                COALESCE(SUM(s.total - s.returned_amount) FILTER (WHERE s.sold_at >= now() - interval '30 days'), 0) AS total_30d,
                MAX(s.sold_at) AS last_sale
         FROM sales s WHERE s.organization_id = o.id AND ${LIVE_SALE}
       ) sa ON true
       WHERE ${where.join(" AND ")}
       ORDER BY ${order[f.sort]}, o.id
       LIMIT ${p.add(f.limit)} OFFSET ${p.add(getOffset(f.page, f.limit))}`,
      p.values
    );
    return fromWindowedRows(rows, f.page, f.limit);
  }

  async users(f: UserListFilter): Promise<PagedRows<Omit<PlatformUserDTO, "online" | "currentPath" | "device">>> {
    const p = new SqlParams();
    const where = ["u.deleted_at IS NULL"];
    if (f.search) {
      const s = p.add(likePattern(f.search));
      where.push(`(u.name ILIKE ${s} OR u.email ILIKE ${s} OR u.phone ILIKE ${s} OR o.name ILIKE ${s})`);
    }
    if (f.organizationId) where.push(`u.organization_id = ${p.add(f.organizationId)}`);
    if (f.status === "online") where.push(`u.id = ANY(${p.add(f.onlineUserIds)}::uuid[])`);
    if (f.status === "active24h") where.push(`u.last_seen_at >= now() - interval '24 hours'`);
    if (f.status === "active7d") where.push(`u.last_seen_at >= now() - interval '7 days'`);
    if (f.status === "neverLoggedIn") where.push(`u.last_login_at IS NULL`);
    if (f.status === "deactivated") where.push(`u.is_active = false`);
    if (f.status === "new7d") where.push(`u.created_at >= now() - interval '7 days'`);

    const order: Record<UserSort, string> = {
      recent: `u.created_at DESC`,
      lastSeen: `u.last_seen_at DESC NULLS LAST`,
      lastLogin: `u.last_login_at DESC NULLS LAST`,
      name: `u.name ASC`,
    };

    const rows = await db().query(
      `SELECT u.id, u.name, u.email, u.phone, u.is_active AS "isActive", u.created_at AS "createdAt",
         u.last_login_at AS "lastLoginAt", u.last_seen_at AS "lastSeenAt",
         u.organization_id AS "organizationId", o.name AS "businessName",
         r.name AS "roleName", r.key AS "roleKey", b.name AS "branchName",
         (SELECT COUNT(*) FROM refresh_tokens t WHERE t.user_id = u.id AND t.revoked_at IS NULL AND t.expires_at > now()) AS "activeSessions",
         COUNT(*) OVER() AS "__total"
       FROM users u
       JOIN organizations o ON o.id = u.organization_id
       JOIN roles r ON r.id = u.role_id
       LEFT JOIN branches b ON b.id = u.branch_id
       WHERE ${where.join(" AND ")}
       ORDER BY ${order[f.sort]}, u.id
       LIMIT ${p.add(f.limit)} OFFSET ${p.add(getOffset(f.page, f.limit))}`,
      p.values
    );
    return fromWindowedRows(rows, f.page, f.limit);
  }

  async recentLogins(limit: number): Promise<PlatformLoginDTO[]> {
    return db().query(
      `SELECT a.id, a.user_id AS "userId", a.user_name AS "userName", u.email,
         a.organization_id AS "organizationId", o.name AS "businessName",
         CASE WHEN a.summary ILIKE '%with Google%' THEN 'google' ELSE 'password' END AS "method",
         a.ip, a.created_at AS "createdAt"
       FROM audit_logs a
       JOIN organizations o ON o.id = a.organization_id
       LEFT JOIN users u ON u.id = a.user_id
       WHERE a.action = 'login'
       ORDER BY a.created_at DESC LIMIT $1`,
      [limit]
    );
  }

  /** Name, business and role for the presence list. */
  async presenceProfile(userId: string): Promise<PresenceProfile | null> {
    const rows: PresenceProfile[] = await db().query(
      `SELECT u.id AS "userId", u.organization_id AS "organizationId", o.name AS "businessName",
         u.name, u.email, r.name AS "roleName", b.name AS "branchName"
       FROM users u
       JOIN organizations o ON o.id = u.organization_id
       JOIN roles r ON r.id = u.role_id
       LEFT JOIN branches b ON b.id = u.branch_id
       WHERE u.id = $1 AND u.deleted_at IS NULL`,
      [userId]
    );
    return rows[0] ?? null;
  }

  async signupSummary(organizationId: string): Promise<RecentSignupDTO | null> {
    const rows: RecentSignupDTO[] = await db().query(
      `SELECT o.id, o.name, o.created_at AS "createdAt", ow.name AS "ownerName", ow.email AS "ownerEmail", ow.phone AS "ownerPhone"
       FROM organizations o ${OWNER_LATERAL}
       WHERE o.id = $1`,
      [organizationId]
    );
    return rows[0] ?? null;
  }
}
