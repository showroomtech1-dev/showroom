import { STORAGE_FOLDERS } from "../../../config/constants";
import { inTransaction } from "../../../infrastructure/database/transaction";
import { assertPermission, can } from "../../../shared/access/can";
import { readBranchScope } from "../../../shared/access/scope";
import { AppError } from "../../../shared/errors/AppError";
import { StorageService } from "../../../shared/services/storage.service";
import type { Actor } from "../../../shared/types/actor";
import { AuditService } from "../../audit/services/audit.service";
import { BranchService } from "../../organization/services/branch.service";
import { ReferenceCodeService } from "../../organization/services/referenceCode.service";
import { UserRepository } from "../../user/repositories/user.repository";
import type { EmployeeDocumentDTO, EmployeeDTO } from "../dto/employee.dto";
import { EmployeeRepository } from "../repositories/employee.repository";
import type { CreateEmployeeInput, ListEmployeesQuery, UpdateEmployeeInput } from "../validators/employee.schema";

export class EmployeeService {
  static Instance = new EmployeeService();
  private constructor(
    private readonly repo = EmployeeRepository.Instance,
    private readonly users = UserRepository.Instance,
    private readonly branches = BranchService.Instance,
    private readonly codes = ReferenceCodeService.Instance,
    private readonly storage = StorageService.Instance,
    private readonly audit = AuditService.Instance
  ) {}

  /** Salary and bank details are payroll information: only payroll viewers and HR managers see them. */
  private present(actor: Actor, e: EmployeeDTO): EmployeeDTO {
    if (can(actor, "payroll.read") || can(actor, "employee.manage")) return e;
    const { salary: _s, bankName: _b, bankAccountNumber: _n, bankAccountName: _a, ...rest } = e;
    return rest;
  }

  async list(actor: Actor, query: ListEmployeesQuery) {
    const result = await this.repo.list(actor.organizationId, { ...query, branchId: readBranchScope(actor, query.branchId) });
    return { data: result.data.map((e) => this.present(actor, e)), meta: result.meta };
  }

  async get(actor: Actor, id: string): Promise<EmployeeDTO & { documents: EmployeeDocumentDTO[] }> {
    const employee = await this.repo.findById(actor.organizationId, id);
    if (!employee) throw AppError.notFound("Employee not found");
    readBranchScope(actor, employee.branchId);
    return { ...this.present(actor, employee), documents: await this.repo.documents(id) };
  }

  async me(actor: Actor): Promise<EmployeeDTO> {
    const employee = await this.repo.findByUserId(actor.organizationId, actor.id);
    if (!employee) throw AppError.notFound("Your login is not linked to an employee profile");
    return employee;
  }

  private async assertUser(actor: Actor, userId: string | null | undefined, exceptId?: string): Promise<void> {
    if (!userId) return;
    if (!(await this.users.findById(actor.organizationId, userId))) throw AppError.badRequest("User not found");
    if (await this.repo.userLinkedElsewhere(actor.organizationId, userId, exceptId)) throw AppError.conflict("That login is already linked to another employee");
  }

  async create(actor: Actor, data: CreateEmployeeInput) {
    assertPermission(actor, "employee.manage");
    await this.assertUser(actor, data.userId);
    const branchId = await this.branches.resolveForWrite(actor, data.branchId);
    const id = await inTransaction(async (tx) => {
      const code = await this.codes.next(actor.organizationId, "employee", tx);
      const employeeId = await this.repo.create(
        {
          organizationId: actor.organizationId,
          branchId,
          userId: data.userId ?? null,
          code,
          firstName: data.firstName,
          lastName: data.lastName,
          photoUrl: null,
          photoPublicId: null,
          phone: data.phone ?? null,
          email: data.email ?? null,
          address: data.address ?? null,
          jobTitle: data.jobTitle ?? null,
          startDate: data.startDate,
          endDate: null,
          status: "active",
          payFrequency: data.payFrequency,
          salary: data.salary,
          commissionRateBps: data.commissionRateBps ?? null,
          bankName: data.bankName ?? null,
          bankAccountNumber: data.bankAccountNumber ?? null,
          bankAccountName: data.bankAccountName ?? null,
          nextOfKinName: data.nextOfKinName ?? null,
          nextOfKinPhone: data.nextOfKinPhone ?? null,
          nextOfKinRelationship: data.nextOfKinRelationship ?? null,
          nextOfKinAddress: data.nextOfKinAddress ?? null,
          guarantorName: data.guarantorName ?? null,
          guarantorPhone: data.guarantorPhone ?? null,
          guarantorAddress: data.guarantorAddress ?? null,
          guarantorRelationship: data.guarantorRelationship ?? null,
          guarantorOccupation: data.guarantorOccupation ?? null,
          notes: data.notes ?? null,
        },
        tx
      );
      await this.audit.log(actor, { action: "create", entityType: "employee", entityId: employeeId, summary: `Added employee ${data.firstName} ${data.lastName} (${code})`, after: { salary: data.salary, payFrequency: data.payFrequency, startDate: data.startDate } }, tx);
      return employeeId;
    });
    return this.get(actor, id);
  }

  async update(actor: Actor, id: string, data: UpdateEmployeeInput) {
    assertPermission(actor, "employee.manage");
    const before = await this.repo.findById(actor.organizationId, id);
    if (!before) throw AppError.notFound("Employee not found");
    await this.assertUser(actor, data.userId, id);
    const branchId = data.branchId ? await this.branches.resolveForWrite(actor, data.branchId) : undefined;
    const patch = { ...data, ...(branchId ? { branchId } : {}), ...(data.status === "terminated" && !data.endDate && !before.endDate ? { endDate: new Date().toISOString().slice(0, 10) } : {}) };
    await inTransaction(async (tx) => {
      await this.repo.update(actor.organizationId, id, patch, tx);
      await this.audit.log(
        actor,
        { action: "update", entityType: "employee", entityId: id, summary: `Updated employee ${before.fullName}`, before: { salary: before.salary, status: before.status, payFrequency: before.payFrequency, jobTitle: before.jobTitle }, after: patch },
        tx
      );
    });
    return this.get(actor, id);
  }

  async remove(actor: Actor, id: string): Promise<void> {
    assertPermission(actor, "employee.manage");
    const employee = await this.repo.findById(actor.organizationId, id);
    if (!employee) throw AppError.notFound("Employee not found");
    if (await this.repo.hasPayroll(id)) throw AppError.conflict("This employee has payroll or loan records. Mark them terminated instead.");
    await inTransaction(async (tx) => {
      await this.repo.softDelete(actor.organizationId, id, tx);
      await this.audit.log(actor, { action: "delete", entityType: "employee", entityId: id, summary: `Deleted employee ${employee.fullName}` }, tx);
    });
  }

  async uploadPhoto(actor: Actor, id: string, buffer: Buffer) {
    assertPermission(actor, "employee.manage");
    const employee = await this.repo.findById(actor.organizationId, id);
    if (!employee) throw AppError.notFound("Employee not found");
    const { url, publicId } = await this.storage.replace(buffer, { folder: STORAGE_FOLDERS.employee, maxDimension: 800 }, employee.photoPublicId);
    await this.repo.update(actor.organizationId, id, { photoUrl: url, photoPublicId: publicId });
    return this.get(actor, id);
  }

  async addDocument(actor: Actor, id: string, file: { buffer: Buffer; mimetype: string; originalname: string }, meta: { name?: string | null; category?: string | null }) {
    assertPermission(actor, "employee.manage");
    const employee = await this.repo.findById(actor.organizationId, id);
    if (!employee) throw AppError.notFound("Employee not found");
    const { url, publicId } = await this.storage.upload(file.buffer, { folder: STORAGE_FOLDERS.employeeDocument, kind: file.mimetype.startsWith("image/") ? "image" : "document" });
    await this.repo.addDocument({
      organizationId: actor.organizationId,
      employeeId: id,
      name: (meta.name || file.originalname || "Document").slice(0, 120),
      category: meta.category ?? null,
      url,
      publicId,
      mimeType: file.mimetype,
      uploadedById: actor.id,
    });
    await this.audit.log(actor, { action: "create", entityType: "employee_document", entityId: id, summary: `Uploaded a document for ${employee.fullName}` });
    return this.get(actor, id);
  }

  async removeDocument(actor: Actor, id: string, documentId: string) {
    assertPermission(actor, "employee.manage");
    const document = await this.repo.findDocument(id, documentId);
    if (!document || !(await this.repo.findById(actor.organizationId, id))) throw AppError.notFound("Document not found");
    await this.repo.removeDocument(documentId);
    await this.storage.delete(document.publicId);
    return this.get(actor, id);
  }
}
