import { EntitySchema } from "typeorm";
import { createdAt, deletedAt, manyToOne, primaryId, uuidColumn, varchar } from "../../../infrastructure/database/columns";

export interface EmployeeDocument {
  id: string;
  organizationId: string;
  employeeId: string;
  name: string;
  category: string | null;
  url: string;
  publicId: string;
  mimeType: string | null;
  uploadedById: string | null;
  createdAt: Date;
  deletedAt: Date | null;
  employee?: { id: string };
}

export const EmployeeDocumentEntity = new EntitySchema<EmployeeDocument>({
  name: "EmployeeDocument",
  tableName: "employee_documents",
  columns: {
    id: primaryId(),
    organizationId: uuidColumn("organization_id"),
    employeeId: uuidColumn("employee_id"),
    name: varchar("name", 120),
    category: varchar("category", 40, true),
    url: varchar("url", 500),
    publicId: varchar("public_id", 255),
    mimeType: varchar("mime_type", 100, true),
    uploadedById: uuidColumn("uploaded_by_id", true),
    createdAt: createdAt(),
    deletedAt: deletedAt(),
  },
  relations: { employee: manyToOne("Employee", "employee_id", "CASCADE") },
  indices: [{ name: "IDX_employee_documents_employee", columns: ["employeeId"] }],
});
