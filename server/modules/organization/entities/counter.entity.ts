// Per-organisation sequences for human-readable reference codes (RCP-000123, SUP-0042, …).
import { EntitySchema } from "typeorm";
import { bigintNumber } from "../../../infrastructure/database/columns";

export interface Counter {
  organizationId: string;
  key: string;
  value: number;
}

export const CounterEntity = new EntitySchema<Counter>({
  name: "Counter",
  tableName: "counters",
  columns: {
    organizationId: { type: "uuid", name: "organization_id", primary: true },
    key: { type: "varchar", length: 40, name: "key", primary: true },
    value: { type: "bigint", name: "value", default: 0, transformer: bigintNumber },
  },
});
