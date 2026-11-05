import { Suspense, lazy } from "react"
import { Navigate, Route, Routes } from "react-router-dom"
import { useAuth } from "@/contexts/AuthContext"
import { DashboardLayout } from "@/components/layout/DashboardLayout"
import { PageLoader } from "@/components/shared/PageLoader"

const LoginPage = lazy(() => import("@/pages/auth/LoginPage"))
const PublicReceiptPage = lazy(() => import("@/pages/public/PublicReceiptPage"))
const DashboardPage = lazy(() => import("@/pages/DashboardPage"))
const PosPage = lazy(() => import("@/pages/sales/PosPage"))
const SalesPage = lazy(() => import("@/pages/sales/SalesPage"))
const QuotationsPage = lazy(() => import("@/pages/sales/QuotationsPage"))
const CustomersPage = lazy(() => import("@/pages/customers/CustomersPage"))
const ProductsPage = lazy(() => import("@/pages/inventory/ProductsPage"))
const InventoryPage = lazy(() => import("@/pages/inventory/InventoryPage"))
const SuppliersPage = lazy(() => import("@/pages/suppliers/SuppliersPage"))
const ExpensesPage = lazy(() => import("@/pages/expenses/ExpensesPage"))
const PeoplePage = lazy(() => import("@/pages/people/PeoplePage"))
const PayrollPage = lazy(() => import("@/pages/payroll/PayrollPage"))
const FinancePage = lazy(() => import("@/pages/finance/FinancePage"))
const ReportsPage = lazy(() => import("@/pages/reports/ReportsPage"))
const SettingsPage = lazy(() => import("@/pages/settings/SettingsPage"))
const ProfilePage = lazy(() => import("@/pages/auth/ProfilePage"))

function ProtectedRoute({
  children,
  anyOf,
}: {
  children: React.ReactNode
  anyOf?: readonly string[]
}) {
  const { isAuthenticated, isLoading, canAny } = useAuth()
  if (isLoading) return <PageLoader />
  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (anyOf && !canAny(anyOf)) return <Navigate to="/" replace />
  return <>{children}</>
}

export default function App() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        {/* Public Routes */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/r/:token" element={<PublicReceiptPage />} />

        {/* Authenticated Shell */}
        <Route
          element={
            <ProtectedRoute>
              <DashboardLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<DashboardPage />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route
            path="pos"
            element={
              <ProtectedRoute anyOf={["sale.create"]}>
                <PosPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="sales"
            element={
              <ProtectedRoute anyOf={["sale.create", "sale.readall", "cashup.manage"]}>
                <SalesPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="quotations"
            element={
              <ProtectedRoute anyOf={["quotation.manage"]}>
                <QuotationsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="customers"
            element={
              <ProtectedRoute anyOf={["customer.read", "customer.manage", "customerpayment.create"]}>
                <CustomersPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="products"
            element={
              <ProtectedRoute anyOf={["product.read", "product.manage"]}>
                <ProductsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="inventory"
            element={
              <ProtectedRoute anyOf={["inventory.read", "inventory.adjust", "inventory.transfer", "stocktake.manage"]}>
                <InventoryPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="suppliers"
            element={
              <ProtectedRoute anyOf={["supplier.read", "supplier.manage", "supply.manage", "supplierpayment.manage"]}>
                <SuppliersPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="expenses"
            element={
              <ProtectedRoute anyOf={["expense.read", "expense.manage"]}>
                <ExpensesPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="people"
            element={
              <ProtectedRoute anyOf={["employee.read", "employee.manage", "attendance.clock", "leave.request", "loan.manage"]}>
                <PeoplePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="payroll"
            element={
              <ProtectedRoute anyOf={["payroll.read", "payroll.manage", "payroll.approve", "payroll.pay"]}>
                <PayrollPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="finance"
            element={
              <ProtectedRoute anyOf={["account.read", "account.manage", "finance.read"]}>
                <FinancePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="reports"
            element={
              <ProtectedRoute anyOf={["report.read", "report.export"]}>
                <ReportsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="settings"
            element={
              <ProtectedRoute anyOf={["settings.manage", "branch.manage", "user.manage", "role.manage", "audit.read", "trash.manage", "backup.manage"]}>
                <SettingsPage />
              </ProtectedRoute>
            }
          />
          <Route path="profile" element={<ProfilePage />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  )
}
