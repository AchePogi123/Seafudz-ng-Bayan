import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { POS } from './features/POS'
import { KitchenMode } from './features/KitchenMode'
import { AssistantRole } from './features/AssistantRole'
import { RideRoleDemo } from './features/rideRoleDemo'
import { SalesReportCashier } from './features/salesReportCashier'
import { OnlineCustomer } from './features/OnlineCustomer'
import { AccMan } from './features/AccMan'
import AboutUs from './features/AboutUs'
import Dashboard from './features/Dashboard'
import Login from './features/Login'
import UserManagement from './features/UserManagement'
import ProtectedRoute from './components/ProtectedRoute'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public Routes */}
        <Route path="/login" element={<Login />} />
        <Route path="/about" element={<AboutUs />} />

        {/* Customer Store Route */}
        <Route
          path="/customer"
          element={
            <ProtectedRoute allowedRoles={['admin', 'customer', 'cashier', 'kitchen', 'rider', 'assistant']}>
              <OnlineCustomer />
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
          path="/dashboard"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <Dashboard />
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

        {/* Redirect root to /customer */}
        <Route path="/" element={<Navigate to="/customer" replace />} />
        {/* Fallback redirect to /customer */}
        <Route path="*" element={<Navigate to="/customer" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App


