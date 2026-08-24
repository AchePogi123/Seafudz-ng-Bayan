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
import ForgotPassword from './features/ForgotPassword'
import CreateAccount from './features/CreateAccount'
import UserManagement from './features/UserManagement'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/login" element={<Login />} />
        <Route path="/create-account" element={<CreateAccount />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/users" element={<UserManagement />} />
        <Route path="/pos" element={<POS />} />
        <Route path="/kitchen" element={<KitchenMode />} />
        <Route path="/assistant" element={<AssistantRole />} />
        <Route path="/rider" element={<RideRoleDemo />} />
        <Route path="/sales-report" element={<SalesReportCashier />} />
        <Route path="/customer" element={<OnlineCustomer />} />
        <Route path="/account" element={<AccMan />} />
        <Route path="/about" element={<AboutUs />} />
        {/* Redirect root to /dashboard */}
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        {/* Fallback redirect to /dashboard for any unknown routes */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App


