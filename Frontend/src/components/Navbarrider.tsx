import React from 'react'
import { useLocation } from 'react-router-dom'
import NavShell from './nav/NavShell'

export interface NavbarRiderProps {
    subtitle?: string
}

export const NavbarRider: React.FC<NavbarRiderProps> = ({ subtitle }) => {
    const location = useLocation()

    const getCurrentPageName = () => {
        if (subtitle) return subtitle
        if (location.pathname === '/rider') return 'Rider Dispatch & Tracking'
        if (location.pathname === '/account') return 'Account Management'
        return 'Delivery Dispatch'
    }

    return (
        <NavShell
            role="rider"
            subtitle={getCurrentPageName()}
        />
    )
}

export default NavbarRider
