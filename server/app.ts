// Express wiring. Route order matters where a router has fixed paths next to /:id — those are
// declared first inside each router.
import cors from "cors";
import express, { type Application } from "express";
import helmet from "helmet";
import { env } from "./config/env";
import roleRoutes from "./modules/access/routes/role.routes";
import auditRoutes from "./modules/audit/routes/audit.routes";
import authRoutes from "./modules/auth/routes/auth.routes";
import { customerPaymentRouter, customerRouter } from "./modules/customer/routes/customer.routes";
import dashboardRoutes from "./modules/dashboard/routes/dashboard.routes";
import { attendanceRouter, employeeRouter, leaveRouter } from "./modules/employee/routes/employee.routes";
import { expenseCategoryRouter, expenseRouter, recurringExpenseRouter } from "./modules/expense/routes/expense.routes";
import { accountRouter, transferRouter } from "./modules/finance/routes/account.routes";
import financeReportRoutes from "./modules/finance/routes/financeReport.routes";
import { inventoryRouter, stockTakeRouter } from "./modules/inventory/routes/inventory.routes";
import loanRoutes from "./modules/loan/routes/loan.routes";
import notificationRoutes from "./modules/notification/routes/notification.routes";
import { branchRouter, settingsRouter } from "./modules/organization/routes/organization.routes";
import payrollRoutes from "./modules/payroll/routes/payroll.routes";
import { categoryRouter, productRouter } from "./modules/product/routes/product.routes";
import quotationRoutes from "./modules/quotation/routes/quotation.routes";
import reportRoutes from "./modules/report/routes/report.routes";
import { cashupRouter, publicReceiptRouter, saleReturnRouter, saleRouter } from "./modules/sale/routes/sale.routes";
import supplierRoutes from "./modules/supplier/routes/supplier.routes";
import supplierPaymentRoutes from "./modules/supplierPayment/routes/supplierPayment.routes";
import supplyRoutes from "./modules/supply/routes/supply.routes";
import systemRoutes from "./modules/system/routes/system.routes";
import userRoutes from "./modules/user/routes/user.routes";
import { enforceRouteGuards } from "./shared/access/routeAudit";
import { publicRoute } from "./shared/access/can";
import { globalErrorHandler, notFoundHandler } from "./shared/middleware/errorHandler.middleware";
import { apiRateLimiter } from "./shared/middleware/rateLimiter.middleware";
import { ApiResponse } from "./shared/response/apiResponse";

export function createApp(): Application {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", 1);

  app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
  app.use(
    cors({
      origin: (origin, cb) => cb(null, !origin || env.corsOrigins.includes(origin) || !env.isProduction),
      credentials: true,
      exposedHeaders: ["Content-Disposition"],
    })
  );
  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: false, limit: "1mb" }));

  const health = express.Router();
  health.get("/", publicRoute("health check"), (_req, res) => {
    res.json(ApiResponse.ok("ShowroomPro API is running", { status: "ok", time: new Date().toISOString() }));
  });
  app.use("/health", health);

  const v1 = express.Router();
  v1.use(apiRateLimiter);

  // ── Phase 1: auth, settings, users, roles, accounts, audit, notifications ──
  v1.use("/auth", authRoutes);
  v1.use("/settings", settingsRouter);
  v1.use("/branches", branchRouter);
  v1.use("/roles", roleRoutes);
  v1.use("/users", userRoutes);
  v1.use("/audit-logs", auditRoutes);
  v1.use("/accounts", accountRouter);
  v1.use("/account-transfers", transferRouter);
  v1.use("/notifications", notificationRoutes);

  // ── Phase 2: suppliers & inventory ─────────────────────────────────────────
  v1.use("/suppliers", supplierRoutes);
  v1.use("/supplies", supplyRoutes);
  v1.use("/supplier-payments", supplierPaymentRoutes);
  v1.use("/products", productRouter);
  v1.use("/product-categories", categoryRouter);
  v1.use("/inventory", inventoryRouter);
  v1.use("/stock-takes", stockTakeRouter);

  // ── Phase 3: sales, customers ──────────────────────────────────────────────
  v1.use("/customers", customerRouter);
  v1.use("/customer-payments", customerPaymentRouter);
  v1.use("/sales", saleRouter);
  v1.use("/sale-returns", saleReturnRouter);
  v1.use("/quotations", quotationRoutes);
  v1.use("/cash-ups", cashupRouter);
  v1.use("/public/receipts", publicReceiptRouter);

  // ── Phase 4: expenses ──────────────────────────────────────────────────────
  v1.use("/expenses", expenseRouter);
  v1.use("/expense-categories", expenseCategoryRouter);
  v1.use("/recurring-expenses", recurringExpenseRouter);

  // ── Phase 5: people & payroll ──────────────────────────────────────────────
  v1.use("/employees", employeeRouter);
  v1.use("/attendance", attendanceRouter);
  v1.use("/leave", leaveRouter);
  v1.use("/payroll", payrollRoutes);
  v1.use("/loans", loanRoutes);

  // ── Phase 6: dashboard, finance statements, reports, system ────────────────
  v1.use("/dashboard", dashboardRoutes);
  v1.use("/finance", financeReportRoutes);
  v1.use("/reports", reportRoutes);
  v1.use("/system", systemRoutes);

  app.use("/api/v1", v1);
  app.use(notFoundHandler);
  app.use(globalErrorHandler);

  // Deny-by-default: any route that forgot its access guard is blocked (and logged).
  enforceRouteGuards(app);
  return app;
}
