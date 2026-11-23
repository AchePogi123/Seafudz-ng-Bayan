import React from 'react'
import { useLocation } from 'react-router-dom'
import NavShell, { NavSearch } from './nav/NavShell'

interface NavbarAssistantProps {
    searchQuery?: string
    setSearchQuery?: (query: string) => void
    subtitle?: string
}

export const NavbarAssistant: React.FC<NavbarAssistantProps> = ({ searchQuery, setSearchQuery, subtitle }) => {
    const location = useLocation()

    const getCurrentPageName = () => {
        if (subtitle) return subtitle
        if (location.pathname === '/assistant') return 'Assistant Order Management'
        if (location.pathname === '/account') return 'Account Management'
        return 'Assistant Panel'
    }

    return (
        <NavShell
            role="assistant"
            subtitle={getCurrentPageName()}
        >
            {searchQuery !== undefined && setSearchQuery !== undefined && (
                <NavSearch
                    value={searchQuery}
                    onChange={setSearchQuery}
                    placeholder="Search customer, ref, address..."
                    widthClass="w-full md:w-[280px] lg:w-[320px]"
                />
            )}
        </NavShell>
    )
}

export default NavbarAssistant
