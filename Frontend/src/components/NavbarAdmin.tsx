import React from 'react'
import { useLocation } from 'react-router-dom'
import NavShell from './nav/NavShell'

export interface NavbarAdminProps {
    /** Overrides the page name derived from the route (Account Management uses this). */
    subtitle?: string
}

export const NavbarAdmin: React.FC<NavbarAdminProps> = ({ subtitle }) => {
    const location = useLocation()

    const getCurrentPageName = () => {
        if (subtitle) return subtitle
        if (location.pathname === '/admin-dashboard') return 'Executive Dashboard'
        if (location.pathname === '/admin-inventory') return 'Inventory Management'
        if (location.pathname === '/admin-sales-report') return 'Sales & Audit Ledger'
        if (location.pathname === '/users') return 'User & Staff Management'
        if (location.pathname === '/admin-customers') return 'Customer Directory'
        if (location.pathname === '/account') return 'Account Management'
        return 'Administrator Portal'
    }

    return <NavShell role="admin" subtitle={getCurrentPageName()} />
}

export default NavbarAdmin
