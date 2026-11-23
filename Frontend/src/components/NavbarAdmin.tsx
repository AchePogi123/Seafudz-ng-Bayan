import React from 'react'
import SidebarDrawer from './SidebarDrawer'

export interface NavbarAdminProps {
    subtitle?: string
}

export const NavbarAdmin: React.FC<NavbarAdminProps> = () => {
    return (
        <SidebarDrawer
            isOpen={true}
            onClose={() => {}}
            role="admin"
            persistent
        />
    )
}

export default NavbarAdmin
