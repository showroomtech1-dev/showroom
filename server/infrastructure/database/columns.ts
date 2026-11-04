// Column builders for EntitySchema definitions so every entity declares money, ids and
// timestamps the same way. Money is BIGINT minor units (kobo) mapped to a JS number.
import type { EntitySchemaColumnOptions, EntitySchemaRelationOptions, ValueTransformer } from "typeorm";

export const bigintNumber: ValueTransformer = {
  to: (value: unknown) => value,
  from: (value: unknown) => (value === null || value === undefined ? value : Number(value)),
};

export const primaryId = (): EntitySchemaColumnOptions => ({ type: "uuid", primary: true, generated: "uuid" });

export const uuidColumn = (name: string, nullable = false): EntitySchemaColumnOptions => ({ type: "uuid", name, nullable });

export const moneyColumn = (name: string, nullable = false): EntitySchemaColumnOptions =>
  nullable
    ? { type: "bigint", name, nullable: true, transformer: bigintNumber }
    : { type: "bigint", name, default: 0, transformer: bigintNumber };

export const intColumn = (name: string, defaultValue: number | null = 0): EntitySchemaColumnOptions =>
  defaultValue === null ? { type: "int", name, nullable: true } : { type: "int", name, default: defaultValue };

export const varchar = (name: string, length: number, nullable = false, defaultValue?: string): EntitySchemaColumnOptions => ({
  type: "varchar",
  name,
  length,
  nullable,
  ...(defaultValue !== undefined ? { default: defaultValue } : {}),
});

export const textColumn = (name: string, nullable = true): EntitySchemaColumnOptions => ({ type: "text", name, nullable });

export const boolColumn = (name: string, defaultValue: boolean): EntitySchemaColumnOptions => ({
  type: "boolean",
  name,
  default: defaultValue,
});

export const dateColumn = (name: string, nullable = false): EntitySchemaColumnOptions => ({ type: "date", name, nullable });

export const timestampColumn = (name: string, nullable = true): EntitySchemaColumnOptions => ({
  type: "timestamptz",
  name,
  nullable,
});

export const jsonColumn = (name: string, nullable = true): EntitySchemaColumnOptions => ({ type: "jsonb", name, nullable });

export const createdAt = (): EntitySchemaColumnOptions => ({ type: "timestamptz", name: "created_at", createDate: true });
export const updatedAt = (): EntitySchemaColumnOptions => ({ type: "timestamptz", name: "updated_at", updateDate: true });
export const deletedAt = (): EntitySchemaColumnOptions => ({
  type: "timestamptz",
  name: "deleted_at",
  deleteDate: true,
  nullable: true,
});

export function manyToOne(
  target: string,
  joinColumn: string,
  onDelete: "RESTRICT" | "CASCADE" | "SET NULL" = "RESTRICT"
): EntitySchemaRelationOptions {
  return { type: "many-to-one", target, joinColumn: { name: joinColumn }, onDelete };
}
