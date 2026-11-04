import { EntitySchema } from "typeorm";
import { createdAt, primaryId, textColumn, updatedAt, varchar } from "../../../infrastructure/database/columns";

export interface Organization {
  id: string;
  name: string;
  legalName: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  website: string | null;
  logoUrl: string | null;
  logoPublicId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export const OrganizationEntity = new EntitySchema<Organization>({
  name: "Organization",
  tableName: "organizations",
  columns: {
    id: primaryId(),
    name: varchar("name", 160),
    legalName: varchar("legal_name", 200, true),
    phone: varchar("phone", 30, true),
    email: varchar("email", 160, true),
    address: textColumn("address"),
    website: varchar("website", 200, true),
    logoUrl: varchar("logo_url", 500, true),
    logoPublicId: varchar("logo_public_id", 255, true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
});
