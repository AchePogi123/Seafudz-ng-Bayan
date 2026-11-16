import React from 'react'
import { useLocation } from 'react-router-dom'
import { getActiveUser } from '../cryptography/cryptoSession'
import NavShell, { NavSearch, NavStatusPill } from './nav/NavShell'

interface NavbarProps {
  searchQuery?: string
  setSearchQuery?: (query: string) => void
}

export const Navbar: React.FC<NavbarProps> = ({ searchQuery, setSearchQuery }) => {
  const location = useLocation()

  const activeUser = getActiveUser()
  const userRole = (activeUser?.role || 'customer').toLowerCase()

  const getCurrentRoleName = () => {
    switch (location.pathname) {
      case '/customer': return 'Online Customer Menu'
      case '/pos': return 'Cashier Point of Sale'
      case '/kitchen': return 'Kitchen Display System'
      case '/assistant': return 'Order Assistant Panel'
      case '/rider': return 'Rider Delivery Dispatch'
      case '/sales-report': return 'Sales & Financial Reports'
      case '/dashboard': return 'Admin Management'
      case '/account': return 'Account Management'
      default: return 'Fresh Seafood & Bilao Feasts'
    }
  }

  const hasSearch = searchQuery !== undefined && setSearchQuery !== undefined

  return (
    <NavShell role={userRole} subtitle={getCurrentRoleName()}>
      {hasSearch ? (
        <NavSearch
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Search seafood dishes..."
          widthClass="w-full md:w-[280px] lg:w-[320px]"
        />
      ) : (
        <div className="hidden md:flex md:items-center">
          <NavStatusPill>Operational System Ready</NavStatusPill>
        </div>
      )}
    </NavShell>
  )
}

export default Navbar
