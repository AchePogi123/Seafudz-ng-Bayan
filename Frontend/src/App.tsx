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
import Login from './features/Login'
import UserManagement from './features/UserManagement'
import SalesReportAdmin from './features/SalesReportAdmin'
import AdminDashboard from './features/AdminDashboard'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/admin-dashboard" element={<AdminDashboard />} />
        <Route path="/customer-dashboard" element={<CustomerDashboard />} />
        <Route path="/login" element={<Login />} />
        <Route path="/users" element={<UserManagement />} />
        <Route path="/admin-customers" element={<AdminCustomerView />} />
        <Route path="/pos" element={<POS />} />
        <Route path="/kitchen" element={<KitchenMode />} />
        <Route path="/assistant" element={<AssistantRole />} />
        <Route path="/rider" element={<RideRoleDemo />} />
        <Route path="/sales-report" element={<SalesReportCashier />} />
        <Route path="/admin-sales-report" element={<SalesReportAdmin />} />
        <Route path="/customer" element={<OnlineCustomer />} />
        <Route path="/account" element={<AccMan />} />
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App