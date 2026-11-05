import type { ReactNode } from "react"
import { formatBps, formatMoney } from "@/lib/money"
import type { CashFlow, ProfitAndLoss } from "@/types/finance.types"

type Tone = "default" | "emerald" | "rose"

interface RowProps {
  label: ReactNode
  amount: number
  /** "minus" shows the amount as a deduction; "total" makes it a bold result line. */
  kind?: "plus" | "minus" | "total"
  note?: string
  tone?: Tone
  indent?: boolean
}

const TONE: Record<Tone, string> = {
  default: "text-slate-900 dark:text-slate-100",
  emerald: "text-emerald-600 dark:text-emerald-400",
  rose: "text-rose-600 dark:text-rose-400",
}

function Row({ label, amount, kind = "plus", note, tone = "default", indent }: RowProps) {
  const total = kind === "total"
  return (
    <div
      className={`flex items-baseline justify-between gap-3 py-1.5 ${
        total ? "mt-1 border-t border-slate-200 pt-2.5 dark:border-slate-700" : ""
      }`}
    >
      <div className={indent ? "pl-4" : ""}>
        <p className={`text-xs ${total ? "font-bold text-slate-900 dark:text-slate-100" : "text-slate-600 dark:text-slate-300"}`}>
          {label}
        </p>
        {note && <p className="text-[11px] text-slate-400">{note}</p>}
      </div>
      <p className={`shrink-0 font-mono text-xs tabular-nums ${total ? "text-sm font-bold" : "font-medium"} ${TONE[tone]}`}>
        {kind === "minus" && amount !== 0 ? "− " : ""}
        {formatMoney(kind === "minus" ? Math.abs(amount) : amount)}
      </p>
    </div>
  )
}

function Heading({ children }: { children: ReactNode }) {
  return (
    <p className="mt-3 mb-0.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400 first:mt-0">{children}</p>
  )
}

function Panel({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{title}</h3>
      <p className="mb-3 text-[11px] text-slate-500 dark:text-slate-400">{subtitle}</p>
      <div className="divide-y divide-slate-100 dark:divide-slate-800/70">{children}</div>
    </div>
  )
}

/** Shows how each Profit & Loss figure was reached, step by step. */
export function PnlBreakdown({ data }: { data: ProfitAndLoss }) {
  const { revenue, expenses } = data
  const categories = [...expenses.byCategory].sort((a, b) => b.amount - a.amount)
  return (
    <Panel title="How these figures were worked out" subtitle={`${revenue.salesCount} completed sales in this period`}>
      <div>
        <Heading>Revenue</Heading>
        <Row
          label="Sales (excluding VAT)"
          amount={revenue.salesExcludingTax}
          note={revenue.discountsGiven > 0 ? `After ${formatMoney(revenue.discountsGiven)} of discounts given` : undefined}
        />
        <Row label="Sales returns" amount={revenue.returns} kind="minus" />
        <Row label="Net revenue" amount={revenue.total} kind="total" />
        {data.tax.collected !== 0 && (
          <p className="pb-1 text-[11px] text-slate-400">
            {data.tax.name} collected: {formatMoney(data.tax.collected)} — owed to the tax authority, so it isn&apos;t counted as revenue.
          </p>
        )}
      </div>

      <div>
        <Heading>Cost of goods sold</Heading>
        <Row label="Cost of items sold (less returned stock)" amount={data.costOfGoodsSold} kind="minus" />
        <Row
          label={`Gross profit · ${formatBps(data.grossMarginBps)} margin`}
          amount={data.grossProfit}
          kind="total"
          tone={data.grossProfit >= 0 ? "emerald" : "rose"}
        />
        <p className="pb-1 text-[11px] text-slate-400">
          Gross margin = gross profit ÷ net revenue ({formatMoney(data.grossProfit)} ÷ {formatMoney(revenue.total)}).
        </p>
      </div>

      <div>
        <Heading>Expenses</Heading>
        {categories.map((c) => (
          <Row key={c.category} label={c.category} amount={c.amount} kind="minus" indent />
        ))}
        <Row label="Supplier & vendor bills" amount={expenses.vendorBills} kind="minus" indent />
        <Row label="Payroll" amount={expenses.payroll} kind="minus" indent />
        <Row label="Total expenses" amount={expenses.total} kind="total" />
      </div>

      <div>
        <Row
          label={`Net profit · ${formatBps(data.netMarginBps)} margin`}
          amount={data.netProfit}
          kind="total"
          tone={data.netProfit >= 0 ? "emerald" : "rose"}
        />
        <p className="pt-1 text-[11px] text-slate-400">
          Net profit = gross profit − total expenses.
          <br />
          Net margin = net profit ÷ net revenue ({formatMoney(data.netProfit)} ÷ {formatMoney(revenue.total)}).
        </p>
      </div>
    </Panel>
  )
}

/** Shows where the cash came from and where it went. */
export function CashFlowBreakdown({ data }: { data: CashFlow }) {
  const sum = (lines: CashFlow["inflows"] | CashFlow["outflows"]) => {
    const byLabel = new Map<string, number>()
    for (const l of lines) byLabel.set(l.label, (byLabel.get(l.label) ?? 0) + l.amount)
    return [...byLabel.entries()].sort((a, b) => b[1] - a[1])
  }
  return (
    <Panel title="Where the cash came from and went" subtitle="Money actually received and paid out, across accounts">
      <div>
        {data.openingBalance !== null && <Row label="Opening balance" amount={data.openingBalance} />}
        <Heading>Cash in</Heading>
        {sum(data.inflows).map(([label, amount]) => (
          <Row key={label} label={label} amount={amount} indent />
        ))}
        <Row label="Total cash in" amount={data.totalIn} kind="total" tone="emerald" />
      </div>
      <div>
        <Heading>Cash out</Heading>
        {sum(data.outflows).map(([label, amount]) => (
          <Row key={label} label={label} amount={amount} kind="minus" indent />
        ))}
        <Row label="Total cash out" amount={data.totalOut} kind="total" tone="rose" />
      </div>
      <div>
        <Row label="Net cash flow" amount={data.netCashFlow} kind="total" tone={data.netCashFlow >= 0 ? "emerald" : "rose"} />
        {data.closingBalance !== null && <Row label="Closing balance" amount={data.closingBalance} />}
        <p className="pt-1 text-[11px] text-slate-400">Net cash flow = total cash in − total cash out.</p>
      </div>
    </Panel>
  )
}
