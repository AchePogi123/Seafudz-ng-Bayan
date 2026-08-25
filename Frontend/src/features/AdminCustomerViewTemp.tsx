import React, { useState } from 'react'
import NavbarAdmin from '../components/NavbarAdmin'

export interface RegisteredCustomer {
    id: string
    fullName: string
    email: string
    phone: string
    deliveryAddress: string
    totalOrders: number
    totalSpent: number
    status: 'active' | 'suspended'
    registeredDate: string
    lastOrderDate: string
}

const INITIAL_CUSTOMERS: RegisteredCustomer[] = [
    {
        id: 'CUST-1001',
        fullName: 'Clarissa Dimapilis',
        email: 'clarissa.dimapilis@gmail.com',
        phone: '0917-882-9912',
        deliveryAddress: 'Block 4, Lot 12, Mahogany St., Phase 2, Cavite City',
        totalOrders: 18,
        totalSpent: 12450,
        status: 'active',
        registeredDate: '2026-01-15',
        lastOrderDate: '2026-08-20',
    },
    {
        id: 'CUST-1002',
        fullName: 'Juan Paolo Dela Cruz',
        email: 'jp.delacruz@yahoo.com',
        phone: '0922-456-7890',
        deliveryAddress: 'Unit 502, Katipunan Residences, Quezon City',
        totalOrders: 6,
        totalSpent: 4200,
        status: 'active',
        registeredDate: '2026-03-02',
        lastOrderDate: '2026-08-11',
    },
    {
        id: 'CUST-1003',
        fullName: 'Angelica Ramos',
        email: 'angie.ramos@gmail.com',
        phone: '0908-112-3344',
        deliveryAddress: '742 Commonwealth Ave, Tandang Sora, Quezon City',
        totalOrders: 1,
        totalSpent: 850,
        status: 'suspended',
        registeredDate: '2026-07-29',
        lastOrderDate: '2026-07-29',
    },
]

export const AdminCustomerView: React.FC = () => {
    const [customers, setCustomers] = useState<RegisteredCustomer[]>(INITIAL_CUSTOMERS)
    const [searchQuery, setSearchQuery] = useState('')
    const [selectedCustomer, setSelectedCustomer] = useState<RegisteredCustomer | null>(null)

    // Toggle account status (active vs suspended)
    const toggleAccountStatus = (id: string, e?: React.MouseEvent) => {
        if (e) e.stopPropagation()
        setCustomers((prev) =>
            prev.map((c) =>
                c.id === id ? { ...c, status: c.status === 'active' ? 'suspended' : 'active' } : c
            )
        )
    }

    // Filter customers based on search query
    const filteredCustomers = customers.filter(
        (c) =>
            c.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
            c.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
            c.phone.includes(searchQuery) ||
            c.id.toLowerCase().includes(searchQuery.toLowerCase())
    )

    return (
        <div className="min-h-screen bg-[#f8f6f4] p-3 sm:p-4 lg:p-6 transition-all duration-300">
            <div className="w-full flex flex-col gap-6 max-w-[1400px] mx-auto">
                <NavbarAdmin />

                {/* Page Header */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white p-6 rounded-3xl border border-neutral-100 shadow-xs gap-4">
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="text-2xl">🛍️</span>
                            <h1 className="text-2xl font-black text-slate-800 tracking-tight">
                                Customer Directory
                            </h1>
                        </div>
                        <p className="text-xs text-slate-500 mt-1">
                            View registered customer accounts, review ordering histories, and manage access statuses.
                        </p>
                    </div>

                    <div className="flex items-center gap-3 bg-neutral-50 px-4 py-2 rounded-2xl border border-neutral-200/60">
                        <span className="text-xs font-bold text-neutral-500 uppercase">Total Accounts:</span>
                        <span className="text-lg font-black text-orange-600">{customers.length}</span>
                    </div>
                </div>

                {/* Search & Filter Bar */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="relative w-full sm:w-96">
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search by name, email, phone, or ID..."
                            className="w-full bg-white border border-neutral-200 rounded-2xl px-4 py-3 text-xs font-medium focus:outline-none focus:border-orange-500 shadow-2xs transition-all"
                        />
                        <span className="absolute right-4 top-3 text-slate-400">🔍</span>
                    </div>
                </div>

                {/* Customers Data Table */}
                <div className="bg-white rounded-3xl border border-neutral-100 shadow-xs overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-neutral-50 border-b border-neutral-100 text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                                    <th className="p-4">Customer ID</th>
                                    <th className="p-4">Full Name</th>
                                    <th className="p-4">Contact Info</th>
                                    <th className="p-4">Total Orders</th>
                                    <th className="p-4">Total Spent</th>
                                    <th className="p-4">Status</th>
                                    <th className="p-4 text-center">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-neutral-50 text-xs font-medium text-slate-700">
                                {filteredCustomers.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="text-center py-12 text-slate-400">
                                            <p className="text-sm font-bold text-slate-600">No Customers Found</p>
                                            <p className="text-xs mt-1">Try adjusting your search filter.</p>
                                        </td>
                                    </tr>
                                ) : (
                                    filteredCustomers.map((customer) => (
                                        <tr
                                            key={customer.id}
                                            onClick={() => setSelectedCustomer(customer)}
                                            className="hover:bg-orange-50/30 cursor-pointer transition-colors"
                                        >
                                            <td className="p-4 font-bold text-slate-900">{customer.id}</td>
                                            <td className="p-4">
                                                <span className="font-bold text-slate-800 block">{customer.fullName}</span>
                                                <span className="text-[10px] text-slate-400">Joined {customer.registeredDate}</span>
                                            </td>
                                            <td className="p-4">
                                                <p className="text-slate-800">{customer.phone}</p>
                                                <p className="text-[11px] text-slate-400">{customer.email}</p>
                                            </td>
                                            <td className="p-4">
                                                <span className="bg-slate-100 text-slate-700 font-bold px-2.5 py-1 rounded-full text-[11px]">
                                                    {customer.totalOrders} Orders
                                                </span>
                                            </td>
                                            <td className="p-4 font-extrabold text-orange-600">
                                                ₱{customer.totalSpent.toLocaleString()}
                                            </td>
                                            <td className="p-4">
                                                <span
                                                    className={`px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${customer.status === 'active'
                                                            ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                                                            : 'bg-rose-50 text-rose-600 border border-rose-200'
                                                        }`}
                                                >
                                                    {customer.status}
                                                </span>
                                            </td>
                                            <td className="p-4">
                                                <div className="flex items-center justify-center gap-2">
                                                    <button
                                                        onClick={(e) => toggleAccountStatus(customer.id, e)}
                                                        className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-all ${customer.status === 'active'
                                                                ? 'bg-rose-50 text-rose-600 hover:bg-rose-100'
                                                                : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
                                                            }`}
                                                    >
                                                        {customer.status === 'active' ? 'Suspend' : 'Activate'}
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Customer Detail Modal */}
                {selectedCustomer && (
                    <div
                        className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200"
                        onClick={() => setSelectedCustomer(null)}
                    >
                        <div
                            className="bg-white rounded-3xl border border-neutral-100 shadow-2xl w-full max-w-lg p-6 space-y-6 animate-in zoom-in-95 duration-200"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="flex justify-between items-start border-b border-neutral-100 pb-4">
                                <div>
                                    <span className="text-[10px] font-bold text-orange-600 uppercase tracking-widest">
                                        Customer Details
                                    </span>
                                    <h3 className="text-xl font-black text-slate-800 mt-0.5">
                                        {selectedCustomer.fullName}
                                    </h3>
                                    <p className="text-xs text-slate-400">ID: {selectedCustomer.id}</p>
                                </div>
                                <button
                                    onClick={() => setSelectedCustomer(null)}
                                    className="text-slate-400 hover:text-slate-700 text-xl font-bold p-1"
                                >
                                    ×
                                </button>
                            </div>

                            <div className="space-y-3 text-xs">
                                <div className="bg-neutral-50 p-3 rounded-2xl border border-neutral-100 space-y-1">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase">Contact Information</p>
                                    <p>
                                        <span className="font-bold text-slate-600">Email:</span> {selectedCustomer.email}
                                    </p>
                                    <p>
                                        <span className="font-bold text-slate-600">Phone:</span> {selectedCustomer.phone}
                                    </p>
                                </div>

                                <div className="bg-neutral-50 p-3 rounded-2xl border border-neutral-100 space-y-1">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase">Default Delivery Address</p>
                                    <p className="text-slate-700 font-medium leading-relaxed">
                                        {selectedCustomer.deliveryAddress}
                                    </p>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div className="bg-neutral-50 p-3 rounded-2xl border border-neutral-100">
                                        <p className="text-[10px] font-bold text-slate-400 uppercase">Total Orders</p>
                                        <p className="text-base font-black text-slate-800 mt-1">
                                            {selectedCustomer.totalOrders}
                                        </p>
                                    </div>
                                    <div className="bg-neutral-50 p-3 rounded-2xl border border-neutral-100">
                                        <p className="text-[10px] font-bold text-slate-400 uppercase">Total Lifetime Spent</p>
                                        <p className="text-base font-black text-orange-600 mt-1">
                                            ₱{selectedCustomer.totalSpent.toLocaleString()}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="pt-4 border-t border-neutral-100 flex justify-end">
                                <button
                                    onClick={() => setSelectedCustomer(null)}
                                    className="bg-neutral-900 text-white font-bold px-6 py-2.5 rounded-xl text-xs hover:bg-neutral-800"
                                >
                                    Close
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}

export default AdminCustomerView