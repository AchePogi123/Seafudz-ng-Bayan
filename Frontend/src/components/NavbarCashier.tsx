import React from 'react'
import { useLocation } from 'react-router-dom'
import NavShell, { NavSearch } from './nav/NavShell'

interface NavbarCashierProps {
    searchQuery?: string
    setSearchQuery?: (query: string) => void
    subtitle?: string
}

export const NavbarCashier: React.FC<NavbarCashierProps> = ({ searchQuery, setSearchQuery, subtitle }) => {
    const location = useLocation()

    const getCurrentPageName = () => {
        if (subtitle) return subtitle
        if (location.pathname === '/pos') return 'Point of Sale Terminal'
        if (location.pathname === '/sales-report') return 'Shift Sales & Register'
        if (location.pathname === '/kitchen') return 'Kitchen Display Mode'
        if (location.pathname === '/account') return 'Account Management'
        return 'Cashier Terminal'
    }

    return (
        <NavShell role="cashier" subtitle={getCurrentPageName()}>
            {searchQuery !== undefined && setSearchQuery !== undefined && (
                <NavSearch
                    value={searchQuery}
                    onChange={setSearchQuery}
                    placeholder="Search seafood dishes..."
                    widthClass="w-full md:w-[300px] lg:w-[360px]"
                />
            )}
        </NavShell>
    )
}

export default NavbarCashier
