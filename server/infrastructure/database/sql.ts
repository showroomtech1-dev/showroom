// Tiny helper for parameterised raw SQL with dynamic filters. Values are always bound ($1, $2…),
// never concatenated into the SQL text.
export class SqlParams {
  readonly values: unknown[] = [];

  /** Bind a value and return its placeholder. */
  add(value: unknown): string {
    this.values.push(value);
    return `$${this.values.length}`;
  }
}

/** Escape LIKE wildcards in user search text. */
export function likePattern(search: string): string {
  return `%${search.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

/** SQL fragment: `column` (timestamptz) falls on local dates [from, to] in timezone `tzParam`. */
export function tzDateBetween(column: string, fromParam: string, toParam: string, tzParam: string): string {
  return `${column} >= (CAST(${fromParam} AS date)::timestamp AT TIME ZONE ${tzParam}) AND ${column} < ((CAST(${toParam} AS date) + 1)::timestamp AT TIME ZONE ${tzParam})`;
}

/** SQL expression: the local calendar date of a timestamptz column. */
export function tzLocalDate(column: string, tzParam: string): string {
  return `(${column} AT TIME ZONE ${tzParam})::date`;
}
