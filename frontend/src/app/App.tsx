import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from '../features/auth/AuthProvider';
import { LoginPage } from '../features/auth/LoginPage';
import { RegisterPage } from '../features/auth/RegisterPage';
import { ProtectedRoute } from '../features/auth/ProtectedRoute';
import { AppLayout } from './AppLayout';
import { PropertyListPage, PropertyForm, PropertyDetailPage } from '../features/properties';
import { CategoryListPage, CategoryForm } from '../features/categories';
import { ExpenseListPage, ExpenseForm } from '../features/expenses';
import { LoanListPage, LoanForm, LoanDetailPage } from '../features/loans';
import { IncomeListPage, IncomeForm } from '../features/income';
import { DepositListPage, DepositForm } from '../features/deposits';
import { DepreciationPage } from '../features/depreciation';
import { DashboardPage } from '../features/dashboard';
import { ReminderListPage, ReminderForm } from '../features/reminders';
import { ReportsPage } from '../features/reports';
import { SimulationPage } from '../features/reports/SimulationPage';
import { UtilityBillingPage } from '../features/utility-billing';
import { SettingsPage } from '../features/settings';
import { TenantListPage, TenantForm } from '../features/tenants';
import { LeaseListPage, LeaseForm } from '../features/leases';
import { DocumentsPage } from '../features/documents';

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        {/* Public routes */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />

        {/* Protected routes */}
        <Route element={<ProtectedRoute />}>
          <Route path="/" element={<AppLayout />}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="objekte" element={<PropertyListPage />} />
            <Route path="objekte/neu" element={<PropertyForm mode="create" />} />
            <Route path="objekte/:id" element={<PropertyDetailPage />} />
            <Route path="objekte/:id/bearbeiten" element={<PropertyForm mode="edit" />} />
            <Route path="mieter" element={<TenantListPage />} />
            <Route path="mieter/neu" element={<TenantForm mode="create" />} />
            <Route path="mieter/:id/bearbeiten" element={<TenantForm mode="edit" />} />
            <Route path="mietvertraege" element={<LeaseListPage />} />
            <Route path="mietvertraege/neu" element={<LeaseForm mode="create" />} />
            <Route path="mietvertraege/:id/bearbeiten" element={<LeaseForm mode="edit" />} />
            <Route path="einnahmen" element={<IncomeListPage />} />
            <Route path="einnahmen/neu" element={<IncomeForm mode="create" />} />
            <Route path="einnahmen/:id/bearbeiten" element={<IncomeForm mode="edit" />} />
            <Route path="kautionen" element={<DepositListPage />} />
            <Route path="kautionen/neu" element={<DepositForm />} />
            <Route path="ausgaben" element={<ExpenseListPage />} />
            <Route path="ausgaben/neu" element={<ExpenseForm mode="create" />} />
            <Route path="ausgaben/:id/bearbeiten" element={<ExpenseForm mode="edit" />} />
            <Route path="darlehen" element={<LoanListPage />} />
            <Route path="darlehen/neu" element={<LoanForm mode="create" />} />
            <Route path="darlehen/:id" element={<LoanDetailPage />} />
            <Route path="darlehen/:id/bearbeiten" element={<LoanForm mode="edit" />} />
            <Route path="afa" element={<DepreciationPage />} />
            <Route path="nebenkosten" element={<UtilityBillingPage />} />
            <Route path="dokumente" element={<DocumentsPage />} />
            <Route path="berichte" element={<ReportsPage />} />
            <Route path="berichte/simulation" element={<SimulationPage />} />
            <Route path="erinnerungen" element={<ReminderListPage />} />
            <Route path="erinnerungen/neu" element={<ReminderForm mode="create" />} />
            <Route path="erinnerungen/:id/bearbeiten" element={<ReminderForm mode="edit" />} />
            <Route path="kategorien" element={<CategoryListPage />} />
            <Route path="kategorien/neu" element={<CategoryForm mode="create" />} />
            <Route path="kategorien/:id/bearbeiten" element={<CategoryForm mode="edit" />} />
            <Route path="einstellungen" element={<SettingsPage />} />
          </Route>
        </Route>
      </Routes>
    </AuthProvider>
  );
}
