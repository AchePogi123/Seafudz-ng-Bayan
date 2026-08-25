import React from 'react'
import NavbarAdmin from '../components/NavbarAdmin'

const AdminDashboard: React.FC = () => {
    return (
        <div className="min-h-screen bg-slate-50 p-3 sm:p-4 lg:p-4 flex flex-col gap-4">
            <NavbarAdmin />
            <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                    <h1 className="text-2xl font-bold text-slate-800">Admin Dashboard</h1>
                    <p className="text-slate-500 mt-2">Coming soon...</p>
                </div>
            </div>
        </div>
    )
}

export default AdminDashboard