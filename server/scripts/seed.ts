// Demo data: a two-branch Lagos showroom with ~2 months of history, created through the real
// services (so stock, ledgers, allocations and the audit log are all consistent).
//   npm run seed            (refuses to run twice — use a fresh database to re-seed)
// Every demo login uses the password  Password123!
import "reflect-metadata";
import { AppDataSource } from "../infrastructure/database/dataSource";
import { WILDCARD } from "../modules/access/catalog/permissions.catalog";
import { resolveActor } from "../modules/auth/services/actorResolver";
import { CustomerService } from "../modules/customer/services/customer.service";
import { CustomerPaymentService } from "../modules/customer/services/customerPayment.service";
import { AttendanceService } from "../modules/employee/services/attendance.service";
import { EmployeeService } from "../modules/employee/services/employee.service";
import { ExpenseService } from "../modules/expense/services/expense.service";
import { RecurringExpenseService } from "../modules/expense/services/recurringExpense.service";
import { AccountService } from "../modules/finance/services/account.service";
import { TransferService } from "../modules/finance/services/transfer.service";
import { StockService } from "../modules/inventory/services/stock.service";
import { StockTakeService } from "../modules/inventory/services/stockTake.service";
import { LoanService } from "../modules/loan/services/loan.service";
import { AlertScannerService } from "../modules/notification/services/alertScanner.service";
import { BranchService } from "../modules/organization/services/branch.service";
import { OnboardingService } from "../modules/organization/services/onboarding.service";
import { OrganizationService } from "../modules/organization/services/organization.service";
import { PayrollService } from "../modules/payroll/services/payroll.service";
import { PayrollPaymentService } from "../modules/payroll/services/payrollPayment.service";
import { CategoryService } from "../modules/product/services/category.service";
import { ProductService } from "../modules/product/services/product.service";
import { QuotationService } from "../modules/quotation/services/quotation.service";
import { CashupService } from "../modules/sale/services/cashup.service";
import { SaleService } from "../modules/sale/services/sale.service";
import { SaleReturnService } from "../modules/sale/services/saleReturn.service";
import { SupplierService } from "../modules/supplier/services/supplier.service";
import { SupplierPaymentService } from "../modules/supplierPayment/services/supplierPayment.service";
import { SupplyService } from "../modules/supply/services/supply.service";
import { UserRepository } from "../modules/user/repositories/user.repository";
import { UserService } from "../modules/user/services/user.service";
import type { Actor } from "../shared/types/actor";
import { addDays, endOfMonth, startOfMonth, todayIn } from "../shared/utils/dates";

const PASSWORD = "Password123!";
const OWNER_EMAIL = "owner@showroompro.test";
const TZ = "Africa/Lagos";
const N = (naira: number) => Math.round(naira * 100); // naira → kobo

// Deterministic pseudo-random numbers so every seed looks the same.
let state = 20260601;
const rand = () => {
  state = (state + 0x6d2b79f5) | 0;
  let t = Math.imul(state ^ (state >>> 15), 1 | state);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const pick = <T>(list: T[]): T => list[Math.floor(rand() * list.length)];
const between = (min: number, max: number) => Math.floor(min + rand() * (max - min + 1));

/** Lagos local time on a given date, as an ISO string with offset. */
const at = (date: string, hour: number, minute = 0) => `${date}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00+01:00`;

async function actorFor(userId: string, organizationId: string, extra: string[] = []): Promise<Actor> {
  const actor = await resolveActor(userId, organizationId);
  if (!actor) throw new Error("Could not load seed user");
  // Seed-only: allow back-dating history for every user (never granted in the app itself).
  return { ...actor, permissions: actor.permissions.includes(WILDCARD) ? actor.permissions : [...actor.permissions, ...extra] };
}

async function main(): Promise<void> {
  await AppDataSource.initialize();
  if (await UserRepository.Instance.existsByEmail(OWNER_EMAIL)) {
    console.log(`Demo data already exists (${OWNER_EMAIL}). Use a fresh database to seed again.`);
    await AppDataSource.destroy();
    return;
  }
  const today = todayIn(TZ);
  const day = (offset: number) => addDays(today, offset);
  console.log("Seeding ShowroomPro demo data…");

  // ── Business, settings, branches, users ────────────────────────────────────
  const biz = await OnboardingService.Instance.createBusiness({
    businessName: "Lekki Home & Electronics",
    ownerName: "Adaeze Okafor",
    ownerEmail: OWNER_EMAIL,
    ownerPassword: PASSWORD,
    phone: "0803 555 0101",
    address: "12 Admiralty Way, Lekki Phase 1, Lagos",
    branchName: "Lekki Showroom",
    bankName: "GTBank",
  });
  const owner = await actorFor(biz.ownerUserId, biz.organizationId);
  await OrganizationService.Instance.updateBusiness(owner, { email: "hello@lekkihome.ng", website: "https://lekkihome.ng" });
  await OrganizationService.Instance.updateSettings(owner, {
    taxEnabled: true,
    taxRateBps: 750,
    taxInclusive: true,
    taxNumber: "TIN-20384756",
    commissionEnabled: true,
    commissionRateBps: 150,
    receiptHeader: "Quality furniture, electronics & home appliances",
    latenessDeduction: N(500),
    absenceDeduction: N(3000),
    workStartTime: "08:30",
  });
  const ikeja = await BranchService.Instance.create(owner, { name: "Ikeja Showroom", code: "IKJ", address: "45 Allen Avenue, Ikeja, Lagos", phone: "0805 555 0202" });

  const user = (name: string, email: string, role: string, branchId: string) =>
    UserService.Instance.create(owner, { name, email, password: PASSWORD, roleId: biz.roleIds[role], branchId, mustChangePassword: false, phone: null });
  const manager = await user("Tunde Bakare", "manager@showroompro.test", "manager", biz.mainBranchId);
  const sales1 = await user("Chioma Eze", "sales@showroompro.test", "sales_staff", biz.mainBranchId);
  const sales2 = await user("Ibrahim Musa", "sales2@showroompro.test", "sales_staff", ikeja.id);
  const accountant = await user("Funke Adeyemi", "accountant@showroompro.test", "accountant", biz.mainBranchId);
  const managerActor = await actorFor(manager.id, biz.organizationId);
  const seller1 = await actorFor(sales1.id, biz.organizationId, ["sale.backdate"]);
  const seller2 = await actorFor(sales2.id, biz.organizationId, ["sale.backdate"]);
  const accountantActor = await actorFor(accountant.id, biz.organizationId);

  // ── Money accounts (opening balances) ──────────────────────────────────────
  const accounts = await AccountService.Instance.list(owner, { includeInactive: true });
  const bank = accounts.find((a) => a.type === "bank")!;
  const cash = accounts.find((a) => a.type === "cash")!;
  await AccountService.Instance.update(owner, bank.id, { accountNumber: "0123456789", notes: "Main operating account" });
  // Starting money: the owner's savings (opening balance) moved into the business accounts.
  const capital = await AccountService.Instance.create(owner, { name: "Owner's savings (Access Bank)", type: "bank", bankName: "Access Bank", openingBalance: N(30_000_000), isDefault: false });
  await AccountService.Instance.create(owner, { name: "Ikeja cash drawer", type: "cash", branchId: ikeja.id, openingBalance: N(50_000), isDefault: false });
  await TransferService.Instance.create(owner, { fromAccountId: capital.id, toAccountId: bank.id, amount: N(24_000_000), transferDate: day(-62), reference: "Capital injection" });
  await TransferService.Instance.create(owner, { fromAccountId: bank.id, toAccountId: cash.id, amount: N(300_000), transferDate: day(-61), reference: "Float for cash drawer" });

  // ── Suppliers & vendors ────────────────────────────────────────────────────
  const sup = (name: string, category: string, extra: Partial<Parameters<typeof SupplierService.Instance.create>[1]> = {}) =>
    SupplierService.Instance.create(owner, { type: "supplier", name, category, ...extra });
  const furnitureCo = await sup("Royal Furniture Makers Ltd", "Furniture", { contactPerson: "Mr. Olumide", phone: "0802 111 2233", bankName: "Zenith Bank", bankAccountNumber: "1012345678", bankAccountName: "Royal Furniture Makers Ltd", paymentTermsDays: 30 });
  const electroHub = await sup("ElectroHub Distributors", "Electronics", { contactPerson: "Mrs. Nwosu", phone: "0809 222 3344", paymentTermsDays: 21 });
  const coolAir = await sup("CoolAir Appliances Nigeria", "Home appliances", { contactPerson: "Kelechi", phone: "0813 333 4455", paymentTermsDays: 14 });
  const brightLights = await sup("BrightLights Imports", "Lighting & decor", { phone: "0706 444 5566", paymentTermsDays: 30 });
  const cleaners = await SupplierService.Instance.create(owner, { type: "vendor", name: "SparkleClean Services", category: "Cleaning", phone: "0701 555 6677" });
  const genFix = await SupplierService.Instance.create(owner, { type: "vendor", name: "PowerGen Repairs", category: "Generator maintenance", phone: "0817 666 7788" });

  // ── Catalogue ──────────────────────────────────────────────────────────────
  const cat = async (name: string) => (await CategoryService.Instance.create(owner, { name })).id;
  const cFurniture = await cat("Furniture");
  const cElectronics = await cat("Electronics");
  const cAppliances = await cat("Home Appliances");
  const cLighting = await cat("Lighting & Decor");

  type P = { name: string; categoryId: string; brand: string; supplierId: string; cost: number; price: number; reorder: number; unit?: string; variants?: Array<{ name?: string; size?: string; color?: string; model?: string; cost?: number; price?: number }> };
  const catalogue: P[] = [
    { name: "3-Seater Fabric Sofa", categoryId: cFurniture, brand: "Royal", supplierId: furnitureCo.id, cost: 285_000, price: 390_000, reorder: 2, variants: [{ color: "Grey" }, { color: "Navy Blue" }, { color: "Beige" }] },
    { name: "L-Shape Leather Sofa", categoryId: cFurniture, brand: "Royal", supplierId: furnitureCo.id, cost: 620_000, price: 845_000, reorder: 1 },
    { name: "6-Seater Dining Set", categoryId: cFurniture, brand: "Royal", supplierId: furnitureCo.id, cost: 410_000, price: 560_000, reorder: 1, unit: "set" },
    { name: "Executive Office Chair", categoryId: cFurniture, brand: "ErgoMax", supplierId: furnitureCo.id, cost: 68_000, price: 98_000, reorder: 4, variants: [{ color: "Black" }, { color: "Brown" }] },
    { name: "King Size Bed Frame", categoryId: cFurniture, brand: "Royal", supplierId: furnitureCo.id, cost: 310_000, price: 425_000, reorder: 1 },
    { name: "Smart LED TV", categoryId: cElectronics, brand: "Hisense", supplierId: electroHub.id, cost: 0, price: 0, reorder: 2, variants: [{ size: '43"', cost: 215_000, price: 268_000 }, { size: '55"', cost: 345_000, price: 429_000 }, { size: '65"', cost: 520_000, price: 649_000 }] },
    { name: "Home Theatre System", categoryId: cElectronics, brand: "LG", supplierId: electroHub.id, cost: 148_000, price: 189_000, reorder: 2 },
    { name: "Bluetooth Soundbar", categoryId: cElectronics, brand: "Sony", supplierId: electroHub.id, cost: 82_000, price: 109_000, reorder: 3 },
    { name: "Split Air Conditioner 1.5HP", categoryId: cAppliances, brand: "Haier Thermocool", supplierId: coolAir.id, cost: 395_000, price: 489_000, reorder: 2 },
    { name: "Double Door Refrigerator", categoryId: cAppliances, brand: "Hisense", supplierId: coolAir.id, cost: 455_000, price: 568_000, reorder: 1 },
    { name: "Chest Freezer 200L", categoryId: cAppliances, brand: "Haier Thermocool", supplierId: coolAir.id, cost: 265_000, price: 329_000, reorder: 2 },
    { name: "Microwave Oven 25L", categoryId: cAppliances, brand: "Scanfrost", supplierId: coolAir.id, cost: 58_000, price: 79_500, reorder: 3 },
    { name: "Standing Fan 18\"", categoryId: cAppliances, brand: "Binatone", supplierId: coolAir.id, cost: 24_000, price: 34_500, reorder: 6 },
    { name: "Crystal Chandelier", categoryId: cLighting, brand: "Lumiere", supplierId: brightLights.id, cost: 95_000, price: 145_000, reorder: 1, variants: [{ model: "6-arm" }, { model: "12-arm", cost: 165_000, price: 245_000 }] },
    { name: "Wall Mirror (Gold Frame)", categoryId: cLighting, brand: "Lumiere", supplierId: brightLights.id, cost: 28_000, price: 45_000, reorder: 3 },
    { name: "Rechargeable Floor Lamp", categoryId: cLighting, brand: "Lontor", supplierId: brightLights.id, cost: 18_500, price: 29_900, reorder: 5 },
  ];

  const variantsBySupplier = new Map<string, Array<{ id: string; cost: number }>>();
  const sellable: Array<{ id: string; price: number }> = [];
  for (const p of catalogue) {
    const created = await ProductService.Instance.create(owner, {
      name: p.name,
      categoryId: p.categoryId,
      brand: p.brand,
      supplierId: p.supplierId,
      unit: p.unit ?? "pcs",
      costPrice: N(p.cost || p.variants?.[0]?.cost || 0),
      sellingPrice: N(p.price || p.variants?.[0]?.price || 0),
      reorderLevel: p.reorder,
      variants: p.variants?.map((v) => ({ ...v, costPrice: v.cost !== undefined ? N(v.cost) : undefined, sellingPrice: v.price !== undefined ? N(v.price) : undefined })),
    });
    for (const v of created.variants) {
      const list = variantsBySupplier.get(p.supplierId) ?? [];
      list.push({ id: v.id, cost: v.costPrice ?? 0 });
      variantsBySupplier.set(p.supplierId, list);
      sellable.push({ id: v.id, price: v.sellingPrice });
    }
  }

  // ── Supplies (stock in), some paid, some part-paid, some on credit ─────────
  const receive = async (supplierId: string, date: string, qty: () => number, payment?: { fraction: number; method: "transfer" | "cash" }, branchId?: string, invoice?: string) => {
    const items = (variantsBySupplier.get(supplierId) ?? []).map((v) => ({ variantId: v.id, quantity: qty(), unitCost: v.cost }));
    const subtotal = items.reduce((s, i) => s + i.quantity * i.unitCost, 0);
    return SupplyService.Instance.create(owner, {
      supplierId,
      branchId: branchId ?? biz.mainBranchId,
      supplyDate: date,
      invoiceNumber: invoice,
      discount: 0,
      items,
      payment: payment ? { amount: Math.round(subtotal * payment.fraction), method: payment.method } : undefined,
    });
  };
  await receive(furnitureCo.id, day(-58), () => between(3, 6), { fraction: 1, method: "transfer" }, undefined, "RFM-1041");
  await receive(electroHub.id, day(-56), () => between(5, 9), { fraction: 0.5, method: "transfer" }, undefined, "EH-77812");
  await receive(coolAir.id, day(-55), () => between(5, 10), undefined, undefined, "CA-5531");
  await receive(brightLights.id, day(-50), () => between(6, 12), { fraction: 1, method: "transfer" }, undefined, "BL-209");
  await receive(furnitureCo.id, day(-40), () => between(2, 4), undefined, ikeja.id, "RFM-1077");
  await receive(electroHub.id, day(-35), () => between(3, 5), { fraction: 0.3, method: "transfer" }, ikeja.id, "EH-78010");
  await receive(coolAir.id, day(-20), () => between(2, 5), undefined, ikeja.id, "CA-5602");
  // A vendor bill for a service (no stock), paid later.
  await SupplyService.Instance.create(owner, { supplierId: genFix.id, supplyDate: day(-25), invoiceNumber: "PG-0091", discount: 0, items: [{ description: "Generator servicing & parts (60kVA)", quantity: 1, unitCost: N(185_000) }] });

  // Supplier payments after the fact (one deliberately over-pays a little).
  await SupplierPaymentService.Instance.create(accountantActor, { supplierId: coolAir.id, amount: N(2_000_000), method: "transfer", paymentDate: day(-30), reference: "TRF/CA/0930" });
  await SupplierPaymentService.Instance.create(accountantActor, { supplierId: electroHub.id, amount: N(1_000_000), method: "transfer", paymentDate: day(-18), reference: "TRF/EH/1018" });
  await SupplierPaymentService.Instance.create(accountantActor, { supplierId: genFix.id, amount: N(190_000), method: "cash", paymentDate: day(-10), reference: "Cash voucher 44" });

  // ── Customers ──────────────────────────────────────────────────────────────
  const customerNames: Array<[string, string]> = [
    ["Mrs. Ngozi Okonkwo", "08031234567"],
    ["Mr. Femi Adebayo", "08029876543"],
    ["Bisi Ventures Ltd", "08051112222"],
    ["Dr. Ahmed Bello", "08064445555"],
    ["Grace Etim", "08077778888"],
    ["Pastor John Okoro", "08180001111"],
    ["Yetunde Interiors", "09012223333"],
    ["Mr. Emeka Nnaji", "08136667777"],
  ];
  const customers: string[] = [];
  for (const [name, phone] of customerNames) customers.push((await CustomerService.Instance.create(owner, { name, phone, creditLimit: name.includes("Ltd") || name.includes("Interiors") ? N(3_000_000) : null })).id);

  // ── Sales over the last ~45 days ───────────────────────────────────────────
  const saleIds: string[] = [];
  for (let offset = -45; offset <= 0; offset += 1) {
    const date = day(offset);
    const count = offset === 0 ? 3 : between(0, 3);
    for (let n = 0; n < count; n += 1) {
      const seller = rand() < 0.6 ? seller1 : seller2;
      const branchId = seller === seller1 ? biz.mainBranchId : ikeja.id;
      const lines = Array.from({ length: between(1, 3) }, () => ({ variantId: pick(sellable).id, quantity: rand() < 0.85 ? 1 : 2, discount: 0 }));
      const unique = [...new Map(lines.map((l) => [l.variantId, l])).values()];
      const listTotal = unique.reduce((s, l) => s + l.quantity * (sellable.find((v) => v.id === l.variantId)?.price ?? 0), 0);
      const discounted = rand() < 0.15;
      // Prices include VAT, so the total is simply the list total less the 5% discount (same rounding as the app).
      const total = discounted ? listTotal - Math.round((listTotal * 500) / 10_000) : listTotal;
      const credit = rand() < 0.2;
      const customerId = credit || rand() < 0.5 ? pick(customers) : undefined;
      const method = pick(["cash", "transfer", "pos", "pos", "transfer"] as const);
      const paid = credit ? Math.round(total * pick([0, 0.3, 0.5])) : total;
      try {
        const result = await SaleService.Instance.create(seller, {
          branchId,
          customerId,
          soldAt: at(date, between(9, 18), between(0, 59)),
          items: unique,
          discount: discounted ? { type: "percent", value: 5 } : undefined,
          payments: paid > 0 ? [{ method, amount: paid }] : [],
        });
        saleIds.push(result.sale.id);
      } catch (err) {
        // A branch can run out of a product, or a customer can hit their credit limit — realistic; skip that sale.
        if (!(err instanceof Error && /Not enough stock|credit limit/.test(err.message))) throw err;
      }
    }
  }

  // Debt payments, a return and a void.
  await CustomerPaymentService.Instance.create(accountantActor, { customerId: customers[2], amount: N(250_000), method: "transfer", paymentDate: day(-6), reference: "BV/TRF/2231" });
  await CustomerPaymentService.Instance.create(seller1, { customerId: customers[0], amount: N(100_000), method: "cash", paymentDate: day(-3) });
  const returnable = await SaleService.Instance.get(owner, saleIds[Math.floor(saleIds.length / 2)]);
  await SaleReturnService.Instance.create(managerActor, { saleId: returnable.id, items: [{ saleItemId: returnable.items[0].id, quantity: 1, restock: true }], reason: "Customer changed their mind (colour)", returnDate: day(-12), refundMethod: "cash" });
  await SaleService.Instance.void(managerActor, saleIds[saleIds.length - 4], "Entered twice by mistake");

  // ── Quotations ─────────────────────────────────────────────────────────────
  const q1 = await QuotationService.Instance.create(seller1, { customerId: customers[6], items: [{ variantId: sellable[0].id, quantity: 2, discount: 0 }, { variantId: sellable[6].id, quantity: 1, discount: 0 }], discount: { type: "percent", value: 3 }, terms: "50% deposit to confirm order. Delivery within Lagos is free." });
  await QuotationService.Instance.setStatus(seller1, q1.id, "sent");
  const q2 = await QuotationService.Instance.create(seller2, { customerName: "Mr. Segun Afolabi", customerPhone: "08023334444", branchId: ikeja.id, items: [{ variantId: sellable[11].id, quantity: 1, discount: 0 }] });
  await QuotationService.Instance.convert(owner, q2.id, { payments: [{ method: "transfer", amount: q2.total }] }).catch((err: Error) => console.log(`  (quotation not converted: ${err.message})`));

  // ── Stock adjustments & a stock take ───────────────────────────────────────
  await StockService.Instance.adjust(managerActor, { variantId: sellable[sellable.length - 1].id, branchId: biz.mainBranchId, mode: "change", quantity: -1, reason: "damage", note: "Cracked during unloading" }).catch((err: Error) =>
    console.log(`  (adjustment skipped: ${err.message})`)
  );
  const take = await StockTakeService.Instance.start(managerActor, { branchId: biz.mainBranchId, categoryId: cLighting, notes: "Monthly lighting count" });
  const sheet = await StockTakeService.Instance.items(managerActor, take.id, { page: 1, limit: 100 });
  await StockTakeService.Instance.recordCounts(managerActor, take.id, {
    counts: sheet.data.map((i, idx) => ({ variantId: i.variantId, countedQuantity: Math.max(0, i.systemQuantity - (idx === 0 ? 1 : 0)) })),
  });
  await StockTakeService.Instance.complete(managerActor, take.id);

  // ── Expenses ───────────────────────────────────────────────────────────────
  const categories = await ExpenseService.Instance.categories(owner);
  const catId = (name: string) => categories.find((c) => c.name === name)!.id;
  for (const monthsAgo of [-2, -1, 0]) {
    const base = startOfMonth(addDays(today, monthsAgo * 30));
    if (base > today) continue;
    const when = (d: number) => (addDays(base, d) > today ? today : addDays(base, d));
    await ExpenseService.Instance.create(accountantActor, { categoryId: catId("Electricity"), amount: N(between(120, 180) * 1000), method: "transfer", payee: "Eko Electricity (EKEDC)", expenseDate: when(4), description: "Prepaid meter top-up" });
    await ExpenseService.Instance.create(accountantActor, { categoryId: catId("Fuel"), amount: N(between(60, 95) * 1000), method: "cash", payee: "Total Filling Station", expenseDate: when(8), description: "Diesel for generator" });
    await ExpenseService.Instance.create(accountantActor, { categoryId: catId("Transport"), amount: N(between(15, 40) * 1000), method: "cash", payee: "Dispatch riders", expenseDate: when(12), description: "Customer deliveries" });
    await ExpenseService.Instance.create(accountantActor, { categoryId: catId("Marketing"), amount: N(between(30, 70) * 1000), method: "transfer", payee: "Instagram Ads", expenseDate: when(15) });
    await ExpenseService.Instance.create(accountantActor, { categoryId: catId("Maintenance"), amount: N(between(10, 25) * 1000), method: "cash", payee: "SparkleClean Services", supplierId: cleaners.id, expenseDate: when(20), description: "Showroom deep cleaning" });
  }
  const rent = await RecurringExpenseService.Instance.create(owner, { categoryId: catId("Rent"), name: "Lekki showroom rent", amount: N(850_000), method: "transfer", payee: "Admiralty Properties Ltd", frequency: "monthly", startDate: startOfMonth(addDays(today, -60)) });
  await RecurringExpenseService.Instance.record(accountantActor, rent.id, {});
  await RecurringExpenseService.Instance.record(accountantActor, rent.id, {});
  await RecurringExpenseService.Instance.create(owner, { categoryId: catId("Internet"), name: "Spectranet business internet", amount: N(35_000), method: "transfer", payee: "Spectranet", frequency: "monthly", startDate: day(2) });
  await RecurringExpenseService.Instance.create(owner, { categoryId: catId("Maintenance"), name: "Weekly cleaning", amount: N(12_000), method: "cash", payee: "SparkleClean Services", supplierId: cleaners.id, frequency: "weekly", startDate: day(-1) });

  // ── Employees, attendance, leave, loans ────────────────────────────────────
  const emp = (firstName: string, lastName: string, jobTitle: string, salary: number, branchId: string, userId?: string, extra: Record<string, unknown> = {}) =>
    EmployeeService.Instance.create(owner, {
      firstName,
      lastName,
      jobTitle,
      salary: N(salary),
      branchId,
      userId: userId ?? null,
      startDate: day(-400),
      payFrequency: "monthly",
      phone: `080${between(10000000, 99999999)}`,
      bankName: pick(["GTBank", "Access Bank", "Zenith Bank", "UBA", "First Bank"]),
      bankAccountNumber: String(between(1000000000, 9999999999)),
      nextOfKinName: "Next of kin",
      nextOfKinPhone: "08000000000",
      nextOfKinRelationship: "Sibling",
      guarantorName: "Guarantor",
      guarantorPhone: "08011111111",
      ...extra,
    });
  const eTunde = await emp("Tunde", "Bakare", "Store Manager", 280_000, biz.mainBranchId, manager.id);
  const eChioma = await emp("Chioma", "Eze", "Sales Executive", 120_000, biz.mainBranchId, sales1.id);
  const eIbrahim = await emp("Ibrahim", "Musa", "Sales Executive", 115_000, ikeja.id, sales2.id);
  const eFunke = await emp("Funke", "Adeyemi", "Accountant", 200_000, biz.mainBranchId, accountant.id);
  const eSamuel = await emp("Samuel", "Udo", "Delivery & Logistics", 90_000, biz.mainBranchId);
  const eMusa = await emp("Musa", "Danjuma", "Security", 75_000, ikeja.id);
  const staff = [eTunde, eChioma, eIbrahim, eFunke, eSamuel, eMusa];

  for (let offset = -35; offset < 0; offset += 1) {
    const date = day(offset);
    const weekday = new Date(`${date}T12:00:00Z`).getUTCDay();
    if (weekday === 0) continue; // closed on Sundays
    await AttendanceService.Instance.mark(owner, {
      date,
      entries: staff.map((e) => {
        const r = rand();
        const status = r < 0.82 ? "present" : r < 0.94 ? "late" : "absent";
        return { employeeId: e.id, status, minutesLate: status === "late" ? between(20, 75) : undefined, clockInAt: status !== "absent" ? at(date, status === "late" ? 9 : 8, between(0, 29)) : null, clockOutAt: status !== "absent" ? at(date, 18, between(0, 30)) : null };
      }),
    });
  }
  const leave = await AttendanceService.Instance.requestLeave(owner, { employeeId: eSamuel.id, type: "annual", startDate: day(5), endDate: day(9), reason: "Family event in Enugu" });
  await AttendanceService.Instance.reviewLeave(owner, leave.id, "approved", "Enjoy!");
  await AttendanceService.Instance.requestLeave(seller1, { type: "casual", startDate: day(14), endDate: day(14), reason: "Hospital appointment" });
  await LoanService.Instance.create(owner, { employeeId: eSamuel.id, type: "loan", principal: N(150_000), installmentAmount: N(25_000), method: "transfer", issueDate: day(-45), notes: "Motorcycle repair" });
  await LoanService.Instance.create(owner, { employeeId: eChioma.id, type: "advance", principal: N(30_000), method: "cash", issueDate: day(-20), notes: "Salary advance" });

  // ── Payroll: last month paid, this month in draft ──────────────────────────
  const lastMonthEnd = addDays(startOfMonth(today), -1);
  const lastMonthStart = startOfMonth(lastMonthEnd);
  const lastRun = await PayrollService.Instance.createRun(managerActor, { frequency: "monthly", periodStart: lastMonthStart, periodEnd: lastMonthEnd, payDate: lastMonthEnd, notes: "Monthly salaries" });
  const tundeLine = lastRun.items.find((i) => i.employeeId === eTunde.id);
  if (tundeLine) await PayrollService.Instance.updateItem(managerActor, lastRun.id, tundeLine.id, { allowanceLines: [{ label: "Transport allowance", amount: N(20_000) }], bonus: N(25_000) });
  await PayrollService.Instance.approve(owner, lastRun.id);
  await PayrollPaymentService.Instance.payRun(accountantActor, lastRun.id, { method: "transfer", paymentDate: lastMonthEnd, reference: "Salary batch" });
  await PayrollService.Instance.createRun(managerActor, { frequency: "monthly", periodStart: startOfMonth(today), periodEnd: endOfMonth(today), payDate: endOfMonth(today) });

  // ── End-of-day cash-up for yesterday, then alerts ──────────────────────────
  const preview = await CashupService.Instance.preview(managerActor, { date: day(-1), branchId: biz.mainBranchId });
  await CashupService.Instance.close(managerActor, { date: day(-1), branchId: biz.mainBranchId, countedAmount: preview.expectedAmount - N(1_500), notes: "Short by ₦1,500 — small change given out", postAdjustment: true });
  await AlertScannerService.Instance.scanOrganization(biz.organizationId);

  console.log(`
Done. Sign in with any of these (password: ${PASSWORD})
  Owner / Admin : ${OWNER_EMAIL}
  Manager       : manager@showroompro.test
  Sales staff   : sales@showroompro.test   (Lekki)
  Sales staff   : sales2@showroompro.test  (Ikeja)
  Accountant    : accountant@showroompro.test
Sales recorded: ${saleIds.length}`);
  await AppDataSource.destroy();
}

main().catch(async (err) => {
  console.error("Seeding failed:", err);
  await AppDataSource.destroy().catch(() => undefined);
  process.exit(1);
});
