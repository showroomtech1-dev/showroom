import type { LucideIcon } from "lucide-react"
import {
  BarChart3,
  Boxes,
  Clock,
  CreditCard,
  FileSpreadsheet,
  LayoutDashboard,
  Package,
  Receipt,
  Settings,
  ShoppingCart,
  Truck,
  UserCheck,
  Users,
  Wallet,
} from "lucide-react"

export interface NavItem {
  label: string
  path: string
  icon: LucideIcon
  anyOf?: readonly string[]
  badge?: string
  mobilePrimary?: boolean
}

export interface NavSection {
  title: string
  items: NavItem[]
}

export const NAV_SECTIONS: NavSection[] = [
  {
    title: "Overview",
    items: [
      {
        label: "Dashboard",
        path: "/dashboard",
        icon: LayoutDashboard,
        anyOf: ["dashboard.read"],
        mobilePrimary: true,
      },
      {
        label: "Point of Sale",
        path: "/pos",
        icon: ShoppingCart,
        anyOf: ["sale.create"],
        badge: "Till",
        mobilePrimary: true,
      },
    ],
  },
  {
    title: "Sales & Customers",
    items: [
      {
        label: "Sales & Receipts",
        path: "/sales",
        icon: Receipt,
        anyOf: ["sale.create", "sale.readall", "cashup.manage"],
        mobilePrimary: true,
      },
      {
        label: "Quotations",
        path: "/quotations",
        icon: FileSpreadsheet,
        anyOf: ["quotation.manage"],
      },
      {
        label: "Customers & Debts",
        path: "/customers",
        icon: Users,
        anyOf: ["customer.read", "customerpayment.create"],
        mobilePrimary: true,
      },
    ],
  },
  {
    title: "Inventory & Supply",
    items: [
      {
        label: "Products",
        path: "/products",
        icon: Package,
        anyOf: ["product.read"],
        mobilePrimary: true,
      },
      {
        label: "Stock & Counts",
        path: "/inventory",
        icon: Boxes,
        anyOf: ["inventory.read", "stocktake.manage"],
      },
      {
        label: "Suppliers & Bills",
        path: "/suppliers",
        icon: Truck,
        anyOf: ["supplier.read", "supply.manage", "supplierpayment.manage"],
      },
    ],
  },
  {
    title: "Finance & Reports",
    items: [
      {
        label: "Expenses",
        path: "/expenses",
        icon: CreditCard,
        anyOf: ["expense.read", "expense.manage"],
      },
      {
        label: "Finance & Accounts",
        path: "/finance",
        icon: Wallet,
        anyOf: ["account.read", "finance.read"],
      },
      {
        label: "Reports & Export",
        path: "/reports",
        icon: BarChart3,
        anyOf: ["report.read"],
      },
    ],
  },
  {
    title: "People & Admin",
    items: [
      {
        label: "Staff & Attendance",
        path: "/people",
        icon: UserCheck,
        anyOf: ["employee.read", "attendance.clock", "leave.request", "loan.manage"],
      },
      {
        label: "Payroll & Payslips",
        path: "/payroll",
        icon: Clock,
        anyOf: ["payroll.read", "payroll.manage", "payroll.approve", "payroll.pay"],
      },
      {
        label: "Settings & Access",
        path: "/settings",
        icon: Settings,
        anyOf: ["settings.manage", "branch.manage", "user.manage", "role.manage", "audit.read", "trash.manage", "backup.manage"],
      },
    ],
  },
]
