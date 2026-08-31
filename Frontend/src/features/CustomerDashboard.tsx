import React from 'react'
import { Link } from 'react-router-dom'
import NavbarCustomer from '../components/NavbarCustomer'

export const CustomerDashboard: React.FC = () => {
    return (
        <div className="min-h-screen bg-[#f8f6f4] p-3 sm:p-4 lg:p-6 flex flex-col gap-6">
            <NavbarCustomer />

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col items-center justify-center text-center p-6 bg-white rounded-3xl border border-neutral-100 shadow-xs">
                <div className="max-w-md space-y-4">
                    <div className="w-16 h-16 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center text-3xl mx-auto shadow-inner border border-amber-100">
                        🦞
                    </div>
                    <h1 className="text-3xl font-black text-slate-800 tracking-tight">
                        Customer Dashboard
                    </h1>
                    <p className="text-slate-500 text-sm leading-relaxed">
                        We are building a personalized hub for your favorite orders, reward points, and personal account insights. Stay tuned!
                    </p>
                    <div className="pt-2">
                        <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-100/60 text-amber-800 text-xs font-bold uppercase tracking-wider">
                            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                            Feature Coming Soon
                        </span>
                    </div>

                    <div className="pt-4">
                        <Link
                            to="/customer"
                            className="inline-flex items-center gap-2 px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl text-sm transition-all shadow-md shadow-orange-500/20 active:scale-95"
                        >
                            <span>🍽️</span>
                            <span>Browse Online Menu</span>
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default CustomerDashboard