# ShowroomPro API

REST API for running a retail showroom: suppliers & vendors, inventory, POS, customers & debts, expenses, staff & payroll, accounts, dashboard and reports. Built to `ai_agent_flow_backend.md`: TypeScript run through `tsx`, Express 4, TypeORM (`EntitySchema`), Zod, and permission-based access control.

Schema and screen list: [`../docs/schema-and-screens.md`](../docs/schema-and-screens.md).

## Setup

Requirements: Node 20+ and PostgreSQL 13+.

```bash
cd server
npm install
cp .env.example .env              # then edit DB_* and the JWT secrets
createdb showroompro              # or create the database in pgAdmin
npm run migration:run             # creates all tables (5 migrations, one per phase)
npm run seed                      # demo business with ~2 months of history
npm run dev                       # http://localhost:4000
```

Demo logins (password `Password123!`):

| Role | Email |
|---|---|
| Owner / Admin | owner@showroompro.test |
| Manager | manager@showroompro.test |
| Sales staff (Lekki) | sales@showroompro.test |
| Sales staff (Ikeja) | sales2@showroompro.test |
| Accountant | accountant@showroompro.test |

To start a real business without demo data:
`npm run create-business -- --name "My Showroom" --owner "Your Name" --email you@example.com --password "Secret123"`

File uploads (product photos, receipts, payment proof, staff documents, logo) need the `CLOUDINARY_*` settings. Without them, upload endpoints answer `503` and everything else works.

## Scripts

| Script | Does |
|---|---|
| `npm run dev` / `npm start` | Start the API (watch mode / normal) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run migration:run` / `migration:revert` | Apply / roll back migrations |
| `npm run seed` | Demo data (refuses to run twice) |
| `npm run create-business` | Create a real business + owner |

## API conventions

- Base path `/api/v1`. Every response uses the same envelope: `{ success, message, statusCode, data, errors, meta? }`. Lists are paginated with `?page=&limit=`, and `meta` holds the totals.
- **All money is in kobo** (integers). `₦1,500.00` = `150000`.
- Auth: `POST /auth/login` returns `tokens.accessToken` (15 min) and `refreshToken` (7 days, rotated by `POST /auth/refresh`). Send `Authorization: Bearer <accessToken>`.
- Every route declares a permission guard. A route without one is blocked with `403` at boot (deny by default).
- Reports and statements take `?format=json|csv|xlsx|pdf`. Exports need `report.export`.
- Idempotency: send a `clientRef` (8–64 chars) on sales, payments and expenses. A retry with the same value returns the original record instead of creating a duplicate.
- Offline sales: the web app queues sales made without a connection and syncs them later with their real `soldAt` time. Any seller may send a `soldAt` up to 72 hours old; older times need `sale.backdate`.

## Endpoints by phase (how to try each phase)

Sign in first: `POST /api/v1/auth/login` `{ "email": "owner@showroompro.test", "password": "Password123!" }`.

**1 — Auth & settings:** `POST /auth/forgot-password` · `POST /auth/reset-password` · `GET /auth/me` · `GET|PATCH /settings` · `PATCH /settings/business` · `POST /settings/logo` · `/branches` · `/users` (+ `/:id/reset-password`, `/lookup`) · `/roles` (+ `/permissions`) · `/accounts` (+ `/:id/statement`, `/options`) · `/account-transfers` · `/audit-logs` · `/notifications` (+ `/unread-count`, `/read-all`, `/scan`)

**2 — Suppliers & inventory:** `/suppliers` (`?type=vendor`, `/:id/statement?format=pdf`, `/payables`) · `/supplies` · `/supplier-payments` (+ `/:id/proof`) · `/products` (+ `/pos-search?q=`, `/barcode/:code`, `/:id/variants`, `/:id/photos`) · `/product-categories` · `/inventory/levels|alerts|movements|valuation` · `POST /inventory/adjustments` · `POST /inventory/transfers` · `/stock-takes` (+ `/:id/items`, `/:id/counts`, `/:id/complete`)

Try: record a supply with a part-payment, then check `GET /suppliers/:id` (balance), `GET /inventory/levels`, and pay the rest with `POST /supplier-payments`. Pay too much and the response carries an over-payment `warning`.

**3 — Sales & customers:** `POST /sales` (split payments, discounts, credit, change due) · `/sales/:id/receipt?size=thermal|a4` · `/sales/:id/share` (WhatsApp link) · `POST /sales/:id/void` · `/sale-returns` · `/quotations` (+ `/:id/pdf`, `/:id/convert`) · `/customers` (+ `/debtors`, `/:id/statement`, `/:id/reminder`, `/:id/purchases`) · `/customer-payments` · `/sales/daily-summary` · `/sales/commissions` · `/cash-ups/preview` · `POST /cash-ups` · public `GET /public/receipts/:token`

**4 — Expenses:** `/expenses` (+ `/:id/receipt`, `/report?groupBy=category|payee|month`) · `/expense-categories` · `/recurring-expenses` (+ `/:id/record`, `/:id/skip`)

**5 — Employees & payroll:** `/employees` (+ `/me`, `/:id/photo`, `/:id/documents`) · `POST /attendance/clock-in|clock-out` · `POST /attendance/mark` · `/attendance/summary` · `/leave` (+ `/:id/review`) · `/loans` (+ `/:id/repayments`) · `/payroll/runs` → `PATCH /runs/:id/items/:itemId` → `POST /runs/:id/approve` (owner only) → `POST /runs/:id/pay` · `/payroll/payslips/:id/pdf` · `/payroll/employees/:employeeId/ledger`

**6 — Dashboard & reports:** `/dashboard` · `/dashboard/charts` · `/finance/profit-and-loss` · `/finance/cash-flow` · `/finance/profit-trend` · `/finance/payables-receivables` · `/reports/:type?format=pdf` (types: `GET /reports`) · `/system/backup` · `/system/trash` + `POST /system/trash/:type/:id/restore`

## Email

Set `EMAIL_USER` + `EMAIL_PASSWORD` (a Gmail **App Password**: Google Account → Security → 2-Step Verification → App passwords). Gmail through Nodemailer is the default. On startup the server log shows `[mail] email on (Gmail)` or `email off`. Emails are only sent by the running server, never by `npm run seed` or the scripts. Addresses on reserved test domains (the demo `@showroompro.test` logins) are skipped.

| Email | Sent when | Who gets it | Owner can switch off (`PATCH /settings`) |
|---|---|---|---|
| Welcome + sign-in details | A user is created | The new user | — |
| Password reset code | `POST /auth/forgot-password` → `POST /auth/reset-password` | The user | — |
| Password changed / reset by a manager | Password changed or reset | The user | — |
| Receipt (PDF attached) | A sale is made for a customer with an email address · `POST /sales/:id/email` | Customer | `emailReceiptsEnabled` |
| Debt reminder | `POST /customers/:id/reminder/email` · automatically when a debt becomes overdue | Customer | `emailDebtRemindersAuto` (off by default) |
| Payslip (PDF attached) | Salary paid in full · `POST /payroll/payslips/:id/email` | Employee (profile email or login email) | `emailPayslipsEnabled` |
| Leave approved / declined | Leave reviewed | Employee | — |
| Daily digest | Every morning after `emailDigestHour` (default 7 am) | Users with `dashboard.read` | `emailDigestEnabled` |
| Urgent alerts | A product runs out, or a supplier payment becomes overdue (once per problem) | Users allowed to see that alert | `emailAlertsEnabled` |

`POST /notifications/test-email` sends a test to the signed-in owner.

**Apps Script relay** (`EMAIL_PROVIDER=script`): the server POSTs JSON `{ to, subject, html, text, name, replyTo, attachments: [{ fileName, mimeType, content (base64) }] }` to `EMAIL_SCRIPT_URL`. A matching web app:

```js
function doPost(e) {
  var m = JSON.parse(e.postData.contents);
  var attachments = (m.attachments || []).map(function (a) {
    return Utilities.newBlob(Utilities.base64Decode(a.content), a.mimeType, a.fileName);
  });
  MailApp.sendEmail({ to: m.to, subject: m.subject, htmlBody: m.html, body: m.text, name: m.name, replyTo: m.replyTo, attachments: attachments });
  return ContentService.createTextOutput(JSON.stringify({ ok: true })).setMimeType(ContentService.MimeType.JSON);
}
```

## How it fits together

```
server/
 ├── app.ts · server.ts            Express wiring · process entry (DB, HTTP, reminder scheduler)
 ├── config/                       env.ts (only reader of process.env) · constants.ts
 ├── modules/<domain>/             entities · repositories · services · controllers · validators · routes · dto (· domain)
 ├── shared/                       access (guards, scope, route audit) · middleware · http/handler · utils (money, dates, pdf) · services (storage, export)
 ├── infrastructure/               database (dataSource, columns, migrations, sql) · storage (Cloudinary) · scheduler
 └── scripts/                      migrate · seed · createBusiness
```

- **Stock** only changes through `StockService.move` (an atomic quantity update plus a `stock_movements` row). Receiving goods updates the weighted-average cost.
- **Money** only moves through `LedgerService` (`account_transactions`). Deleting or voiding something posts reversals.
- **Payments are allocated** to the oldest unpaid supplies or sales. Unused credit is applied automatically to the next one.
- **Alerts** (low or out of stock, supplier payments due, customer debts, recurring expenses) are refreshed every `SCHEDULER_INTERVAL_MINUTES` and after sales. Each user sees only the alerts their permissions allow.

Not done yet: automated tests (Jest specs, route-coverage/role-matrix specs), the Postman collection, and the frontend.
