import React from 'react'
import { useLocation } from 'react-router-dom'
import NavShell, { NavSearch } from './nav/NavShell'

interface NavbarAssistantProps {
    searchQuery?: string
    setSearchQuery?: (query: string) => void
}

export const NavbarAssistant: React.FC<NavbarAssistantProps> = ({ searchQuery, setSearchQuery }) => {
    const location = useLocation()

    return (
        <NavShell
            role="assistant"
            subtitle={location.pathname === '/assistant' ? 'Assistant Order Management' : 'Assistant Panel'}
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
