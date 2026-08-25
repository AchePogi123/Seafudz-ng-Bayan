import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { POS } from './features/POS'
import { KitchenMode } from './features/KitchenMode'
import { AssistantRole } from './features/AssistantRole'
import { RideRoleDemo } from './features/rideRoleDemo'
import { SalesReportCashier } from './features/salesReportCashier'
import { OnlineCustomer } from './features/OnlineCustomer'
import { AccMan } from './features/AccMan'
import CustomerDashboard from './features/CustomerDashboard'
import AdminCustomerView from './features/AdminCustomerViewTemp'
import Dashboard from './features/Dashboard'
import AdminDashboard from './features/AdminDashboard'
import SalesReportAdmin from './features/SalesReportAdmin'
import Login from './features/Login'
import AboutUs from './features/AboutUs'
import UserManagement from './features/UserManagement'
import ProtectedRoute from './components/ProtectedRoute'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public Routes & Landing Page */}
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/login" element={<Login />} />
        <Route path="/about" element={<AboutUs />} />

        {/* Customer Routes */}
        <Route
          path="/customer"
          element={
            <ProtectedRoute allowedRoles={['admin', 'customer', 'cashier', 'kitchen', 'rider', 'assistant']}>
              <OnlineCustomer />
            </ProtectedRoute>
          }
        />
        <Route
          path="/customer-dashboard"
          element={
            <ProtectedRoute allowedRoles={['admin', 'customer', 'cashier', 'kitchen', 'rider', 'assistant']}>
              <CustomerDashboard />
            </ProtectedRoute>
          }
        />

        {/* Account Management */}
        <Route
          path="/account"
          element={
            <ProtectedRoute allowedRoles={['admin', 'cashier', 'kitchen', 'rider', 'assistant', 'customer']}>
              <AccMan />
            </ProtectedRoute>
          }
        />

        {/* Cashier & POS Feature Routes */}
        <Route
          path="/pos"
          element={
            <ProtectedRoute allowedRoles={['admin', 'cashier']}>
              <POS />
            </ProtectedRoute>
          }
        />
        <Route
          path="/sales-report"
          element={
            <ProtectedRoute allowedRoles={['admin', 'cashier']}>
              <SalesReportCashier />
            </ProtectedRoute>
          }
        />

        {/* Kitchen Feature Route */}
        <Route
          path="/kitchen"
          element={
            <ProtectedRoute allowedRoles={['admin', 'kitchen']}>
              <KitchenMode />
            </ProtectedRoute>
          }
        />

        {/* Assistant Floor Call Route */}
        <Route
          path="/assistant"
          element={
            <ProtectedRoute allowedRoles={['admin', 'assistant']}>
              <AssistantRole />
            </ProtectedRoute>
          }
        />

        {/* Rider Delivery Route */}
        <Route
          path="/rider"
          element={
            <ProtectedRoute allowedRoles={['admin', 'rider']}>
              <RideRoleDemo />
            </ProtectedRoute>
          }
        />

        {/* Admin Management Dashboard Routes */}
        <Route
          path="/admin-dashboard"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <AdminDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin-sales-report"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <SalesReportAdmin />
            </ProtectedRoute>
          }
        />
        <Route
          path="/users"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <UserManagement />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin-customers"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <AdminCustomerView />
            </ProtectedRoute>
          }
        />

        {/* Redirect root to Landing Page (/dashboard) */}
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        {/* Fallback redirect to /dashboard */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App