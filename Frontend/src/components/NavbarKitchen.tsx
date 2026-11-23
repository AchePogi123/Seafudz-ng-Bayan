import React from 'react'
import { useLocation } from 'react-router-dom'
import NavShell from './nav/NavShell'

export interface NavbarKitchenProps {
    subtitle?: string
}

export const NavbarKitchen: React.FC<NavbarKitchenProps> = ({ subtitle }) => {
    const location = useLocation()

    const getCurrentPageName = () => {
        if (subtitle) return subtitle
        if (location.pathname === '/kitchen') return 'Kitchen Display System'
        if (location.pathname === '/account') return 'Account Management'
        return 'Kitchen Management'
    }

    return (
        <NavShell
            role="kitchen"
            subtitle={getCurrentPageName()}
        />
    )
}

export default NavbarKitchen
