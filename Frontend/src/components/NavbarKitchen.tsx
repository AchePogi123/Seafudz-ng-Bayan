import React from 'react'
import { useLocation } from 'react-router-dom'
import NavShell from './nav/NavShell'

export const NavbarKitchen: React.FC = () => {
    const location = useLocation()

    return (
        <NavShell
            role="kitchen"
            subtitle={location.pathname === '/kitchen' ? 'Kitchen Display System' : 'Kitchen Management'}
        />
    )
}

export default NavbarKitchen
