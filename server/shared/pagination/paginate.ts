import type { PaginationMeta } from "../response/apiResponse";

export interface PaginationParams {
  page: number;
  limit: number;
}

export interface PagedRows<T> {
  data: T[];
  meta: PaginationMeta;
}

export function getOffset(page: number, limit: number): number {
  return (page - 1) * limit;
}

/** Count only known on page 1 (cheap lists). */
export function buildMeta(page: number, limit: number, total: number, resultCount: number): PaginationMeta {
  return {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
    hasNext: resultCount === limit,
    hasPrev: page > 1,
  };
}

/** Exact total on every page ("Showing 21–40 of 312"). */
export function buildMetaFromTotal(page: number, limit: number, total: number): PaginationMeta {
  const totalPages = Math.max(1, Math.ceil(total / limit));
  return { page, limit, total, totalPages, hasNext: page < totalPages, hasPrev: page > 1 };
}

/**
 * Rows selected with `COUNT(*) OVER() AS "__total"` carry the full match count on every row.
 * Strip it and build exact pagination meta.
 */
export function fromWindowedRows<T extends Record<string, unknown>>(
  rows: Array<T & { __total?: unknown }>,
  page: number,
  limit: number
): PagedRows<T> {
  const total = rows.length > 0 ? Number(rows[0].__total ?? 0) : 0;
  const data = rows.map((row) => {
    const { __total: _ignored, ...rest } = row;
    return rest as unknown as T;
  });
  return { data, meta: buildMetaFromTotal(page, limit, total) };
}
