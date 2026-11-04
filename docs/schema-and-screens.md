# ShowroomPro — Database schema & screen list

PostgreSQL, TypeORM migrations in `server/infrastructure/database/migrations/` (one per build phase).

## Conventions

| Rule | Detail |
|---|---|
| Money | `BIGINT` in **kobo** (₦1 = 100). Never floats. Rates are basis points (`750` = 7.5 %). |
| Tenant | Every business row has `organization_id`; every query filters on it first. |
| Branches | `branch_id` on stock, sales, expenses, staff, cash-ups → multi-branch from day one. |
| Soft delete | `deleted_at` on master data and financial records; restorable from **Settings → Trash**. |
| Codes | Human-readable references from `counters`: `RCP-000123` (sale), `GRN-000045` (supply), `SPY-` / `CPY-` (payments), `EXP-`, `QT-`, `RTN-`, `PR-`, `PS-`, `LN-` / `ADV-`, `SUP-`, `CUS-`, `EMP-`, `SKU-`. |
| Idempotency | `client_ref` (unique per business) on sales, payments and expenses, so an offline queue can retry safely. |
| Audit | `audit_logs` row written **in the same transaction** as every create / edit / delete / approval. |
| Money ledger | Every movement of money posts to `account_transactions`. Corrections post a `reversal` row; history is never rewritten. |

## Tables by phase

### Phase 1 — Auth, settings, accounts
| Table | Purpose / key columns |
|---|---|
| `organizations` | Business profile: name, phone, email, address, logo |
| `organization_settings` | Currency (NGN/₦), timezone, receipt header/footer, VAT (enabled, rate, inclusive, TIN), commission (enabled, rate), allow negative stock, reminder days, default credit days, work start time, lateness/absence deductions |
| `branches` | Locations; one `is_main` |
| `roles` | Named permission bundles (`permissions text[]`); built-in: Owner (locked), Manager, Sales Staff, Accountant |
| `users` | Login (bcrypt hash), role, home branch, active flag |
| `refresh_tokens` | Hashed, rotated refresh tokens (replay = all sessions revoked) |
| `audit_logs` | who, action, entity, summary, before/after JSON, IP, time |
| `counters` | Per-business sequences for reference codes |
| `accounts` | Cash in hand, bank, POS — opening balance, default per type |
| `account_transactions` | The money ledger: date, in/out, amount, type, source reference |
| `account_transfers` | Moving money between accounts |
| `notifications`, `notification_reads` | Alerts (deduplicated, auto-resolve) and per-user read state |

### Phase 2 — Suppliers & inventory
| Table | Purpose / key columns |
|---|---|
| `suppliers` | Suppliers **and vendors** (`type`), contact, category, bank details, payment terms, active |
| `supplies`, `supply_items` | Goods received / vendor bills: invoice no., dates, due date, discount, total, `amount_paid`, status `paid / part_paid / credit`. Lines without a product = service bill |
| `supplier_payments` | Date, amount, method, account, reference, proof file, `allocated_amount`, `is_overpayment`, `overpaid_amount` |
| `supplier_payment_allocations` | Which supplies each payment settled (oldest due first) |
| `product_categories`, `products` | Name, category, brand, description, unit, default prices, reorder level, supplier |
| `product_variants` | Size / colour / model, **SKU, barcode**, cost (weighted average) & selling price |
| `product_photos` | Cloudinary URL + public id |
| `stock_levels` | Quantity per variant per branch (atomic updates) |
| `stock_movements` | Every change: opening, supply, sale, return, void, adjustment (+ reason), stock take, transfer |
| `stock_takes`, `stock_take_items` | Physical counts: snapshot → counts → variances posted |

### Phase 3 — Sales & customers
| Table | Purpose / key columns |
|---|---|
| `customers` | Name, phone (unique), email, address, optional credit limit |
| `sales` | Receipt no., branch, customer, seller, time, subtotal, discount, VAT, total, paid, balance due, due date, cost snapshot, commission, returned amount, public receipt token, void info |
| `sale_items` | Product/variant snapshot, qty, list & charged price, line discount, unit cost, returned qty |
| `sale_payments` | Split payments at the till (cash / transfer / POS / cheque) |
| `customer_payments`, `customer_payment_allocations` | Debt payments, applied to the oldest unpaid sales |
| `sale_returns`, `sale_return_items` | Value returned, VAT & cost reversed, amount credited to balance vs refunded, restock flag |
| `quotations`, `quotation_items` | Quotation / proforma; converts to a sale |
| `cash_reconciliations` | End-of-day: expected vs counted cash, difference, optional adjustment |

### Phase 4 — Expenses
| Table | Purpose / key columns |
|---|---|
| `expense_categories` | Built-in (rent, electricity, fuel, internet, maintenance, marketing, transport, taxes, miscellaneous) + custom |
| `expenses` | Date, category, amount, method, account, payee / vendor, description, receipt file |
| `recurring_expenses` | Amount, frequency (weekly / monthly / quarterly / yearly), next due date → reminders, "record" / "skip" |

### Phase 5 — Employees & payroll
| Table | Purpose / key columns |
|---|---|
| `employees` | Photo, phone, address, next of kin, guarantor, role/job title, start date, salary, pay frequency, bank, commission override, linked login |
| `employee_documents` | Uploaded files (ID, guarantor form…) |
| `attendance` | One row per employee per day: present / late / absent / leave / half day / off, clock in/out, minutes late |
| `leave_requests` | Type, dates, status (pending → approved / rejected / cancelled) |
| `payroll_runs` | Period, pay date, status `draft → approved → paid` (or cancelled), totals |
| `payroll_items` | Per employee: basic, allowances, bonus, commission, lateness/absence/loan/advance/other deductions, gross, net, paid |
| `payroll_payments` | Salary payments (method, account, reference) |
| `payslips` | Frozen snapshot per paid employee (PDF on demand) |
| `loans`, `loan_repayments` | Staff loans & salary advances; repaid via payroll deductions or manually |

### Phase 6 — Dashboard & reports
No new tables — computed from the above.

## Roles (built-in, editable except Owner)

| Area | Owner | Manager | Sales Staff | Accountant |
|---|:-:|:-:|:-:|:-:|
| Settings, users, roles, backup | ✅ | — | — | — |
| Approve payroll | ✅ | — | — | — |
| Prepare payroll, employees, attendance | ✅ | ✅ | own clock-in & leave | view, pay salaries |
| Suppliers, supplies | ✅ | ✅ | — | view + payments |
| Products, stock, adjustments, stock take | ✅ | ✅ | view (no cost prices) | view |
| POS, customers, quotations, debt payments | ✅ | ✅ | ✅ (own sales only) | debt payments, view |
| Void / returns / price override | ✅ | ✅ | — | — |
| Expenses, accounts, transfers, cash-up | ✅ | ✅ | — | ✅ |
| Dashboard, P&L, reports, exports | ✅ | ✅ | — | ✅ |
| Audit log, trash | ✅ | ✅ | — | audit only |

## Screens (frontend — mobile first)

**Auth:** Sign in · Change password · My profile

**Home:** Dashboard (today / month sales, profit, low stock, payables, customer debts, upcoming payments, top products, charts) · Notifications

**Sales:** POS (search / scan, cart, discount, split payment, change due, credit) · Receipt (print / PDF / WhatsApp share) · Sales list & detail · Void · Returns & refunds · Quotations (list, editor, PDF, convert) · Daily summary · End-of-day cash-up · Commissions

**Customers:** List (with debt filter) · Profile (purchase history, statement, WhatsApp reminder) · Record debt payment · Debtors (ageing)

**Inventory:** Products (list, detail with variants, stock per branch, photos) · Product editor · Categories · Stock levels & alerts · Stock movements · Adjust stock · Branch transfer · Stock takes (count sheet) · Valuation

**Suppliers & vendors:** List · Profile (ledger, statement PDF) · Record supply / vendor bill · Supplies list · Supplier payments (with proof upload, over-payment warning) · Payables widget

**Expenses:** List · Record expense (receipt photo) · Categories · Recurring expenses · Expense reports

**People:** Employees (list, profile, documents) · Attendance (clock in/out, register, summary) · Leave · Loans & advances

**Payroll:** Runs · Run editor (allowances, deductions, bonuses) · Approve · Pay · Payslips (PDF) · Employee pay ledger

**Finance:** Accounts & balances · Account statement · Transfers · Profit & loss · Cash flow · Payables / receivables

**Reports:** Sales, sales by product / staff, inventory, expenses, payroll, P&L, cash flow, debtors, creditors, supplier statement — filters (dates, branch, staff, product, supplier) — export PDF / Excel / CSV

**Settings:** Business profile & logo · Receipt layout · Currency & VAT · Commission · Attendance rules · Branches · Users · Roles & permissions · Audit log · Trash (restore) · Backup download
