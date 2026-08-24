import React, { useState } from 'react'
import { NavbarAdmin } from '../components/NavbarAdmin'

type TabType = 'Today' | 'This Week' | 'This Month' | 'This Year'

const SalesReportAdmin: React.FC = () => {
    const [activeTab, setActiveTab] = useState<TabType>('Today')

    const handlePrintAll = () => {
        window.print()
    }

    return (
        <div className="min-h-screen bg-[#f0ece8] text-[#2c1810] font-sans pb-12">
            {/* Navbar - Hidden on Print */}
            <div className="p-4 sm:p-6 print:hidden">
                <NavbarAdmin />
            </div>

            <div className="max-w-7xl mx-auto px-4 sm:px-6">
                {/* Header Title & Print Button - Hidden on Print */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6 print:hidden">
                    <h1 className="text-3xl font-extrabold">💰 Sales Management</h1>
                    <button
                        onClick={handlePrintAll}
                        className="bg-[#ff7b00] hover:bg-[#e66f00] text-white font-bold px-6 py-3 rounded-xl shadow-md transition-all"
                    >
                        🖨️ Print All Invoices
                    </button>
                </div>

                {/* Tab Filters - Hidden on Print */}
                <div className="flex gap-2 border-b border-neutral-300 mb-8 pb-1 print:hidden">
                    {(['Today', 'This Week', 'This Month', 'This Year'] as TabType[]).map((tab) => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`px-6 py-3 rounded-t-xl font-bold text-sm transition-all ${activeTab === tab
                                ? 'bg-[#ff7b00] text-white shadow-md'
                                : 'text-neutral-500 hover:text-neutral-800 hover:bg-white/50'
                                }`}
                        >
                            {tab}
                        </button>
                    ))}
                </div>

                {/* Analytics Metric Cards - Hidden on Print */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8 print:hidden">
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-[#e0d6cf] text-center">
                        <h3 className="text-xs uppercase font-extrabold tracking-wider text-neutral-400 mb-2">Total Sales</h3>
                        <div className="text-3xl font-black text-[#ff7b00]">--</div>
                    </div>
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-[#e0d6cf] text-center">
                        <h3 className="text-xs uppercase font-extrabold tracking-wider text-neutral-400 mb-2">Total Orders</h3>
                        <div className="text-3xl font-black text-[#ff7b00]">--</div>
                    </div>
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-[#e0d6cf] text-center">
                        <h3 className="text-xs uppercase font-extrabold tracking-wider text-neutral-400 mb-2">Average Order</h3>
                        <div className="text-3xl font-black text-[#ff7b00]">--</div>
                    </div>
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-[#e0d6cf] text-center">
                        <h3 className="text-xs uppercase font-extrabold tracking-wider text-neutral-400 mb-2">Top Selling Item</h3>
                        <div className="text-3xl font-black text-[#ff7b00]">--</div>
                    </div>
                </div>

                {/* PRINT ONLY SECTION */}
                <div id="print-area">
                    {/* Print Report Header */}
                    <div className="hidden print:block text-center mb-6">
                        <h1 className="text-2xl font-bold text-orange-600">Seafudz Ng Bayan</h1>
                        <p className="text-sm text-gray-600">Bagong Silang Phase 1, Brgy. 176</p>
                        <p className="text-sm text-gray-600">Open 24/7</p>
                        <p className="text-sm font-semibold mt-2">Transaction Report — {activeTab}</p>
                        <p className="text-xs text-gray-500">Printed on: {new Date().toLocaleString()}</p>
                        <div className="border-t border-dashed border-gray-400 my-4"></div>
                    </div>

                    <h2 className="text-xl font-extrabold mb-4 print:text-lg">Transaction History</h2>

                    {/* Table Container */}
                    <div className="bg-white rounded-2xl border border-[#e0d6cf] shadow-sm overflow-hidden print:shadow-none print:border print:rounded-none">
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-neutral-100">
                                <thead className="bg-neutral-50 text-left text-xs uppercase font-extrabold tracking-wider text-neutral-500">
                                    <tr>
                                        <th className="px-6 py-4">Reference #</th>
                                        <th className="px-6 py-4">Date & Time</th>
                                        <th className="px-6 py-4">Items</th>
                                        <th className="px-6 py-4">Customer</th>
                                        <th className="px-6 py-4">Total Amount</th>
                                        <th className="px-6 py-4">Order Type</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr>
                                        <td colSpan={6} className="px-6 py-16 text-center text-neutral-400">
                                            <div className="text-3xl mb-2">📊</div>
                                            <div className="font-bold text-neutral-600">No transactions recorded yet.</div>
                                            <div className="text-xs mt-1">Transactions will appear here once orders are completed.</div>
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Print Report Footer */}
                    <div className="hidden print:block text-center mt-8 text-sm text-gray-500">
                        <div className="border-t border-dashed border-gray-400 my-4"></div>
                        <p>Thank you for using Seafudz Ng Bayan System</p>
                        <p className="text-xs mt-1">This is a computer-generated report</p>
                    </div>
                </div>
            </div>

            {/* Print Specific CSS Overrides */}
            <style>{`
        @media print {
          body {
            background-color: #ffffff !important;
            color: #000000 !important;
          }
          body * {
            visibility: hidden !important;
          }
          #print-area, #print-area * {
            visibility: visible !important;
          }
          #print-area {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
          }
        }
      `}</style>
        </div>
    )
}

export default SalesReportAdmin