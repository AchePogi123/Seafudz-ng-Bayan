import React, { useState } from 'react'
import NavbarCashier from '../components/NavbarCashier'

interface Transaction {
  id: string
  ref: string
  dateTime: string
  items: string
  customer: string
  total: number
  type: 'Dine In' | 'Take Out' | 'Delivery'
}

type TabType = 'Today' | 'This Week' | 'This Month' | 'This Year'

const MOCK_TRANSACTIONS: Record<TabType, Transaction[]> = {
  Today: [
    {
      id: 'tx-1',
      ref: 'ORD-8821',
      dateTime: '2026-06-29 16:30',
      items: 'Seafood Cajun Mix x1, Fresh Juice x2',
      customer: 'Clarissa Dimapilis',
      total: 2300,
      type: 'Delivery'
    },
    {
      id: 'tx-2',
      ref: 'ORD-8822',
      dateTime: '2026-06-29 15:45',
      items: 'Crab Bucket x1, Spicy Shrimp x1',
      customer: 'Michael Reyes',
      total: 3700,
      type: 'Delivery'
    },
    {
      id: 'tx-3',
      ref: 'ORD-A123',
      dateTime: '2026-06-29 14:15',
      items: 'Spicy Shrimp x2, Fresh Juice x3',
      customer: 'Walk-In (Table 1)',
      total: 3150,
      type: 'Dine In'
    }
  ],
  'This Week': [
    {
      id: 'tx-1',
      ref: 'ORD-8821',
      dateTime: '2026-06-29 16:30',
      items: 'Seafood Cajun Mix x1, Fresh Juice x2',
      customer: 'Clarissa Dimapilis',
      total: 2300,
      type: 'Delivery'
    },
    {
      id: 'tx-2',
      ref: 'ORD-8822',
      dateTime: '2026-06-29 15:45',
      items: 'Crab Bucket x1, Spicy Shrimp x1',
      customer: 'Michael Reyes',
      total: 3700,
      type: 'Delivery'
    },
    {
      id: 'tx-3',
      ref: 'ORD-A123',
      dateTime: '2026-06-29 14:15',
      items: 'Spicy Shrimp x2, Fresh Juice x3',
      customer: 'Walk-In (Table 1)',
      total: 3150,
      type: 'Dine In'
    },
    {
      id: 'tx-4',
      ref: 'ORD-8819',
      dateTime: '2026-06-28 19:10',
      items: 'Seafood Bilao x1',
      customer: 'Samantha Go',
      total: 2000,
      type: 'Delivery'
    },
    {
      id: 'tx-5',
      ref: 'ORD-A122',
      dateTime: '2026-06-27 12:30',
      items: 'Garlic Butter Shrimp x2, Fresh Juice x2',
      customer: 'Walk-In (Table 4)',
      total: 2500,
      type: 'Take Out'
    }
  ],
  'This Month': [
    {
      id: 'tx-1',
      ref: 'ORD-8821',
      dateTime: '2026-06-29 16:30',
      items: 'Seafood Cajun Mix x1, Fresh Juice x2',
      customer: 'Clarissa Dimapilis',
      total: 2300,
      type: 'Delivery'
    },
    {
      id: 'tx-2',
      ref: 'ORD-8822',
      dateTime: '2026-06-29 15:45',
      items: 'Crab Bucket x1, Spicy Shrimp x1',
      customer: 'Michael Reyes',
      total: 3700,
      type: 'Delivery'
    },
    {
      id: 'tx-3',
      ref: 'ORD-A123',
      dateTime: '2026-06-29 14:15',
      items: 'Spicy Shrimp x2, Fresh Juice x3',
      customer: 'Walk-In (Table 1)',
      total: 3150,
      type: 'Dine In'
    },
    {
      id: 'tx-6',
      ref: 'ORD-C109',
      dateTime: '2026-06-15 18:20',
      items: 'Crab Bucket x2, Seafood Bilao x1',
      customer: 'John Smith',
      total: 7000,
      type: 'Delivery'
    },
    {
      id: 'tx-7',
      ref: 'ORD-T101',
      dateTime: '2026-06-10 13:00',
      items: 'Seafood Cajun Mix x3, Garlic Butter Shrimp x1',
      customer: 'Walk-In',
      total: 6400,
      type: 'Take Out'
    }
  ],
  'This Year': [
    {
      id: 'tx-1',
      ref: 'ORD-8821',
      dateTime: '2026-06-29 16:30',
      items: 'Seafood Cajun Mix x1, Fresh Juice x2',
      customer: 'Clarissa Dimapilis',
      total: 2300,
      type: 'Delivery'
    },
    {
      id: 'tx-2',
      ref: 'ORD-8822',
      dateTime: '2026-06-29 15:45',
      items: 'Crab Bucket x1, Spicy Shrimp x1',
      customer: 'Michael Reyes',
      total: 3700,
      type: 'Delivery'
    },
    {
      id: 'tx-3',
      ref: 'ORD-A123',
      dateTime: '2026-06-29 14:15',
      items: 'Spicy Shrimp x2, Fresh Juice x3',
      customer: 'Walk-In (Table 1)',
      total: 3150,
      type: 'Dine In'
    },
    {
      id: 'tx-8',
      ref: 'ORD-A001',
      dateTime: '2026-01-05 11:30',
      items: 'Seafood Bilao x10, Fresh Juice x10',
      customer: 'New Year Catering',
      total: 22500,
      type: 'Delivery'
    }
  ]
}

export const SalesReportCashier: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('Today')
  const [searchQuery, setSearchQuery] = useState('')

  const currentTransactions = MOCK_TRANSACTIONS[activeTab].filter((tx) => {
    const query = searchQuery.toLowerCase()
    return (
      tx.ref.toLowerCase().includes(query) ||
      tx.customer.toLowerCase().includes(query) ||
      tx.items.toLowerCase().includes(query) ||
      tx.type.toLowerCase().includes(query)
    )
  })

  // Calculate statistics
  const totalSales = currentTransactions.reduce((acc, curr) => acc + curr.total, 0)
  const totalOrders = currentTransactions.length
  const averageOrder = totalOrders > 0 ? Math.round(totalSales / totalOrders) : 0

  // Quick logic for mock top-selling item based on tab
  const getTopSellingItem = (tab: TabType) => {
    switch (tab) {
      case 'Today': return 'Spicy Shrimp'
      case 'This Week': return 'Seafood Cajun Mix'
      case 'This Month': return 'Crab Bucket'
      case 'This Year': return 'Seafood Bilao'
      default: return 'Seafood Bilao'
    }
  }

  return (
    <div className="min-h-screen bg-[#f8f6f4] text-[#2c1810] font-sans p-3 sm:p-4 lg:p-6 pb-12">
      {/* Integrated Cashier Navbar */}
      <NavbarCashier searchQuery={searchQuery} setSearchQuery={setSearchQuery} />

      {/* Main Container */}
      <div className="max-w-7xl mx-auto pt-6">
        <h1 className="text-3xl font-extrabold mb-6">Sales Reports</h1>

        {/* Tab Navigation */}
        <div className="flex gap-2 border-b border-neutral-300 mb-8 pb-1 overflow-x-auto">
          {(['Today', 'This Week', 'This Month', 'This Year'] as TabType[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-6 py-3 rounded-t-xl font-bold text-sm transition-all whitespace-nowrap cursor-pointer ${activeTab === tab
                ? 'bg-orange-600 text-white shadow-md'
                : 'text-neutral-500 hover:text-neutral-800 hover:bg-white/50'
                }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Summary Statistics Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 text-center hover:shadow-md transition-all">
            <h3 className="text-xs uppercase font-extrabold tracking-wider text-neutral-400 mb-2">Total Sales</h3>
            <div className="text-3xl font-black text-orange-600">
              ₱{totalSales.toLocaleString()}
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 text-center hover:shadow-md transition-all">
            <h3 className="text-xs uppercase font-extrabold tracking-wider text-neutral-400 mb-2">Total Orders</h3>
            <div className="text-3xl font-black text-orange-600">
              {totalOrders}
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 text-center hover:shadow-md transition-all">
            <h3 className="text-xs uppercase font-extrabold tracking-wider text-neutral-400 mb-2">Average Order</h3>
            <div className="text-3xl font-black text-orange-600">
              ₱{averageOrder.toLocaleString()}
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 text-center hover:shadow-md transition-all">
            <h3 className="text-xs uppercase font-extrabold tracking-wider text-neutral-400 mb-2">Top Selling Item</h3>
            <div className="text-3xl font-black text-orange-600 truncate px-1">
              {getTopSellingItem(activeTab)}
            </div>
          </div>
        </div>

        {/* Transaction History Table */}
        <h2 className="text-xl font-extrabold mb-4">Transaction History</h2>
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
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
              <tbody className="divide-y divide-neutral-100 text-sm">
                {currentTransactions.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-16 text-center text-neutral-400">
                      <div className="text-3xl mb-2">📊</div>
                      <div className="font-bold text-neutral-600">No transactions recorded yet.</div>
                      <div className="text-xs">Transactions will appear here once orders are completed or matched by search.</div>
                    </td>
                  </tr>
                ) : (
                  currentTransactions.map((tx) => (
                    <tr key={tx.id} className="hover:bg-neutral-50/50 transition-colors">
                      <td className="px-6 py-4 font-bold text-orange-600">{tx.ref}</td>
                      <td className="px-6 py-4 text-neutral-500 whitespace-nowrap">{tx.dateTime}</td>
                      <td className="px-6 py-4 font-medium text-neutral-800">{tx.items}</td>
                      <td className="px-6 py-4 text-neutral-600 font-medium">{tx.customer}</td>
                      <td className="px-6 py-4 font-bold text-[#2c1810]">₱{tx.total.toLocaleString()}</td>
                      <td className="px-6 py-4">
                        <span className={`text-xs font-extrabold px-3 py-1.5 rounded-full ${tx.type === 'Dine In'
                          ? 'bg-blue-50 text-blue-700 border border-blue-100'
                          : tx.type === 'Take Out'
                            ? 'bg-amber-50 text-amber-700 border border-amber-100'
                            : 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                          }`}>
                          {tx.type}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}

export default SalesReportCashier