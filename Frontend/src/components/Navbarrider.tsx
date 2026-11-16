import React from 'react'
import { useLocation } from 'react-router-dom'
import NavShell from './nav/NavShell'

export const NavbarRider: React.FC = () => {
    const location = useLocation()

    return (
        <NavShell
            role="rider"
            subtitle={location.pathname === '/rider' ? 'Rider Dispatch & Tracking' : 'Delivery Dispatch'}
        />
    )
}

export default NavbarRider
