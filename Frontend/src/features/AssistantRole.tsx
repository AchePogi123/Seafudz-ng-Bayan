import React, { useState, useEffect } from 'react'
import { NavbarAssistant } from '../components/NavbarAssistant'
import { API_BASE_URL } from '../utils/api'

export interface OrderItem {
  name: string
  quantity: number
  price: number
}

export interface OnlineOrder {
  id: string
  ref: string
  customer: string
  phone: string
  address: string
  paymentMethod: string
  status: 'pending' | 'flagged' | 'pending_preparation' | 'preparing' | 'assigned' | 'confirmed' | 'ready' | 'out_for_delivery' | 'completed' | string
  items: OrderItem[]
  total: number
  createdAt: string
  correctionNote?: string
  riderId?: string
  assignedRiderName?: string
}

export interface Rider {
  id: string
  name: string
  status: 'Available' | 'Busy - 1 delivery active' | 'Offline'
  vehicle: string
  phone: string
}

const INITIAL_MOCK_ORDERS: OnlineOrder[] = []

const INITIAL_MOCK_RIDERS: Rider[] = [
  { id: 'r-1', name: 'Rider Alex Ramos', status: 'Available', vehicle: 'Yamaha NMAX (Plate 123-ABC)', phone: '09170001111' },
  { id: 'r-2', name: 'Dan Cruz', status: 'Available', vehicle: 'Honda Click 125i (Plate 456-DEF)', phone: '09180002222' },
  { id: 'r-3', name: 'Marky Santos', status: 'Busy - 1 delivery active', vehicle: 'Kawasaki Barako (Plate 789-GHI)', phone: '09200003333' },
]

export const AssistantRole: React.FC = () => {
  const [orders, setOrders] = useState<OnlineOrder[]>(INITIAL_MOCK_ORDERS)
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null)
  const [notification, setNotification] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'pending' | 'kitchen' | 'dispatch' | 'all'>('pending')
  const [correctionNoteInput, setCorrectionNoteInput] = useState('')
  const [selectedRiderId, setSelectedRiderId] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [riders] = useState<Rider[]>(INITIAL_MOCK_RIDERS)

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 4000)
      return () => clearTimeout(timer)
    }
  }, [notification])

  const selectedOrder = orders.find((o) => o.id === selectedOrderId)

  const validatePhone = (phoneStr: string): { isValid: boolean; cleaned: string } => {
    const cleaned = phoneStr.replace(/[^0-9+]/g, '')
    if (cleaned.startsWith('+639')) return { isValid: cleaned.length === 13, cleaned }
    if (cleaned.startsWith('09')) return { isValid: cleaned.length === 11, cleaned }
    return { isValid: false, cleaned }
  }

  const validateAddress = (addressStr: string): { isComplete: boolean; warningMsg?: string } => {
    const cleaned = addressStr.trim()
    if (cleaned.length === 0) return { isComplete: false, warningMsg: 'Address is missing.' }
    if (cleaned.length < 15) return { isComplete: false, warningMsg: 'Address details seem too short.' }
    const keywords = ['brgy', 'barangay', 'st', 'street', 'ave', 'avenue', 'phase', 'block', 'lot', 'no', 'corner', 'cty', 'city', 'silang']
    const hasDetails = keywords.some((keyword) => cleaned.toLowerCase().includes(keyword))
    if (!hasDetails) return { isComplete: false, warningMsg: 'Missing landmark or street indicator (e.g. St, Brgy).' }
    return { isComplete: true }
  }

  const customerNameValid = selectedOrder ? selectedOrder.customer.trim().length > 0 : false
  const phoneValidation = selectedOrder ? validatePhone(selectedOrder.phone) : { isValid: false, cleaned: '' }
  const addressValidation = selectedOrder ? validateAddress(selectedOrder.address) : { isComplete: false, warningMsg: '' }

  // Fetch live orders from central backend
  const fetchAssistantOrders = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/user-flow/orders`)
      if (res.ok) {
        const data = await res.json()
        if (Array.isArray(data.data) && data.data.length > 0) {
          const mapped: OnlineOrder[] = data.data.map((o: {
            id: string
            customer?: string
            customerName?: string
            phone?: string
            address?: string
            deliveryAddress?: string
            paymentMethod?: string
            status?: string
            items?: Array<{ name: string; quantity: number; price: number }>
            total?: number
            createdAt?: string
            notes?: string
          }) => ({
            id: o.id,
            ref: o.id,
            customer: o.customer || o.customerName || 'Online Customer',
            phone: o.phone || '0917-000-0000',
            address: o.address || o.deliveryAddress || 'Metro Manila Address',
            paymentMethod: o.paymentMethod || 'GCash',
            status: (o.status || 'PENDING').toLowerCase(),
            items: o.items || [],
            total: o.total || 0,
            createdAt: o.createdAt || 'Just now',
            correctionNote: o.notes,
          }))

          setOrders(mapped)
        }
      }
    } catch (err) {
      console.warn('Backend connection note in AssistantRole:', err)
    }
  }

  useEffect(() => {
    void fetchAssistantOrders()
    const timer = setInterval(() => {
      void fetchAssistantOrders()
    }, 2000)
    return () => clearInterval(timer)
  }, [])

  const handleFlagForCorrection = async () => {
    if (!selectedOrderId || !selectedOrder) return
    if (!correctionNoteInput.trim()) {
      setNotification('⚠️ Please enter a correction note first.')
      return
    }

    try {
      await fetch(`${API_BASE_URL}/user-flow/orders/${selectedOrderId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'FLAGGED', note: correctionNoteInput }),
      })
    } catch {
      /* ignore */
    }

    setOrders((prev) =>
      prev.map((o) =>
        o.id === selectedOrderId ? { ...o, status: 'flagged', correctionNote: correctionNoteInput } : o
      )
    )
    setNotification(`🚩 Order ${selectedOrder.ref} flagged for correction.`)
    setCorrectionNoteInput('')
  }

  const handleApproveSendToKitchen = async () => {
    if (!selectedOrderId || !selectedOrder) return

    try {
      await fetch(`${API_BASE_URL}/user-flow/orders/${selectedOrderId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'CONFIRMED' }),
      })
    } catch (err) {
      console.warn('Could not persist CONFIRMED to backend:', err)
    }

    setOrders((prev) =>
      prev.map((o) => (o.id === selectedOrderId ? { ...o, status: 'confirmed' } : o))
    )
    setNotification(`🍳 Order ${selectedOrder.ref} confirmed and sent to Kitchen!`)
  }

  const handleAssignRider = () => {
    if (!selectedOrderId || !selectedOrder) return
    if (!selectedRiderId) {
      setNotification('⚠️ Please select a rider to dispatch.')
      return
    }
    const rider = riders.find((r) => r.id === selectedRiderId)
    if (!rider) return

    setOrders((prev) =>
      prev.map((o) =>
        o.id === selectedOrderId
          ? { ...o, status: 'out_for_delivery', riderId: rider.id, assignedRiderName: rider.name }
          : o
      )
    )
    setNotification(`🔔 Rider ${rider.name} notified of Order ${selectedOrder.ref}`)
  }

  const filteredOrders = orders.filter((order) => {
    const s = (order.status || '').toLowerCase()
    const matchesTab =
      activeTab === 'pending'
        ? s === 'pending' || s === 'flagged' || s === 'pending_verification' || s === 'unconfirmed'
        : activeTab === 'kitchen'
        ? s === 'confirmed' || s === 'pending_preparation' || s === 'preparing'
        : activeTab === 'dispatch'
        ? s === 'ready' || s === 'out_for_delivery' || s === 'assigned' || s === 'completed'
        : true

    if (!matchesTab) return false

    if (!searchQuery.trim()) return true
    const q = searchQuery.toLowerCase()
    return (
      order.ref.toLowerCase().includes(q) ||
      order.customer.toLowerCase().includes(q) ||
      order.phone.toLowerCase().includes(q) ||
      order.address.toLowerCase().includes(q) ||
      order.items.some((i) => i.name.toLowerCase().includes(q))
    )
  })

  return (
    <div className="min-h-screen bg-[#f8f6f4] p-3 sm:p-4 lg:p-4 transition-all duration-300 pb-24 lg:pb-6 text-neutral-900 font-sans">
      <div className="w-full flex flex-col gap-4 sm:gap-6">
        {/* Top Navbar matching Cashier POS styling */}
        <NavbarAssistant searchQuery={searchQuery} setSearchQuery={setSearchQuery} />

        {/* 4-Column Layout (3 Cols Left for Orders Pipeline, 1 Col Right for Details Panel) */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 sm:gap-6 items-start">
          
          {/* Left Column (3 Cols) */}
          <main className="lg:col-span-3 flex flex-col gap-4 sm:gap-6">
            
            {/* Header & Pipeline Filter Bar */}
            <div className="bg-white rounded-2xl p-4 sm:p-5 border border-neutral-200/80 shadow-2xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-base sm:text-lg font-extrabold text-neutral-900 tracking-tight flex items-center gap-2">
                  <span className="text-orange-500">🍤</span> Order Status Pipeline
                </h2>
                <p className="text-xs text-neutral-400 font-medium mt-0.5">
                  Bagong Silang Branch • Real-time Online Feeds
                </p>
              </div>

              {/* Pipeline Tab Switcher */}
              <div className="flex bg-neutral-100/80 p-1 rounded-xl border border-neutral-200/80 text-xs font-semibold overflow-x-auto max-w-full">
                <button
                  onClick={() => setActiveTab('pending')}
                  className={`px-3.5 py-1.5 rounded-lg font-bold transition-all whitespace-nowrap cursor-pointer ${
                    activeTab === 'pending'
                      ? 'bg-orange-600 text-white shadow-2xs'
                      : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-200/60'
                  }`}
                >
                  Pending Verification ({orders.filter((o) => o.status === 'pending' || o.status === 'flagged' || o.status === 'pending_verification' || o.status === 'unconfirmed').length})
                </button>
                <button
                  onClick={() => setActiveTab('kitchen')}
                  className={`px-3.5 py-1.5 rounded-lg font-bold transition-all whitespace-nowrap cursor-pointer ${
                    activeTab === 'kitchen'
                      ? 'bg-orange-600 text-white shadow-2xs'
                      : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-200/60'
                  }`}
                >
                  Kitchen ({orders.filter((o) => o.status === 'confirmed' || o.status === 'pending_preparation' || o.status === 'preparing').length})
                </button>
                <button
                  onClick={() => setActiveTab('dispatch')}
                  className={`px-3.5 py-1.5 rounded-lg font-bold transition-all whitespace-nowrap cursor-pointer ${
                    activeTab === 'dispatch'
                      ? 'bg-orange-600 text-white shadow-2xs'
                      : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-200/60'
                  }`}
                >
                  Rider Dispatch ({orders.filter((o) => o.status === 'ready' || o.status === 'out_for_delivery' || o.status === 'assigned').length})
                </button>
                <button
                  onClick={() => setActiveTab('all')}
                  className={`px-3.5 py-1.5 rounded-lg font-bold transition-all whitespace-nowrap cursor-pointer ${
                    activeTab === 'all'
                      ? 'bg-neutral-900 text-white shadow-2xs'
                      : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-200/60'
                  }`}
                >
                  All ({orders.length})
                </button>
              </div>
            </div>

            {/* Orders Feed */}
            <section className="space-y-3">
              {filteredOrders.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-neutral-400 bg-white border border-dashed border-neutral-200/80 rounded-2xl p-6 text-center shadow-2xs">
                  <svg className="w-10 h-10 text-neutral-300 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                  <h4 className="text-sm font-bold text-neutral-700">No Orders in this pipeline stage</h4>
                  <p className="text-xs text-neutral-400 max-w-xs mt-1">
                    Incoming customer online delivery requests will appear here once available.
                  </p>
                </div>
              ) : (
                filteredOrders.map((order) => {
                  const isSelected = order.id === selectedOrderId
                  return (
                    <div
                      key={order.id}
                      onClick={() => setSelectedOrderId(order.id)}
                      className={`group bg-white rounded-2xl p-4 sm:p-5 border transition-all duration-200 cursor-pointer shadow-2xs flex flex-col justify-between gap-3 ${
                        isSelected
                          ? 'border-orange-500 ring-2 ring-orange-500/20 bg-orange-50/20 shadow-md'
                          : 'border-neutral-200/80 hover:border-orange-500/50 hover:shadow-md'
                      }`}
                    >
                      <div className="flex items-center justify-between pb-2 border-b border-neutral-100">
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-orange-600 text-sm sm:text-base tracking-wide">
                            {order.ref}
                          </span>
                          <span className="text-xs text-neutral-400 font-medium">
                            {order.createdAt}
                          </span>
                        </div>
                        <span
                          className={`text-[10px] font-extrabold px-2.5 py-1 rounded-full uppercase tracking-wider ${
                            order.status === 'pending' || order.status === 'pending_verification'
                              ? 'bg-amber-50 text-amber-700 border border-amber-200'
                              : order.status === 'flagged'
                              ? 'bg-rose-50 text-rose-700 border border-rose-200 animate-pulse'
                              : order.status === 'confirmed' || order.status === 'pending_preparation'
                              ? 'bg-blue-50 text-blue-700 border border-blue-200'
                              : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          }`}
                        >
                          {order.status.replace('_', ' ').toUpperCase()}
                        </span>
                      </div>

                      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2">
                        <div>
                          <div className="font-bold text-neutral-900 text-sm sm:text-base">
                            {order.customer}
                          </div>
                          <div className="text-xs text-neutral-500 truncate max-w-md mt-0.5">
                            {order.address} • Phone: {order.phone}
                          </div>
                        </div>

                        <div className="flex items-center justify-between sm:justify-end gap-4 text-right">
                          <span className="text-xs text-neutral-400 font-semibold bg-neutral-100 px-2.5 py-1 rounded-lg">
                            {order.paymentMethod}
                          </span>
                          <span className="font-extrabold text-neutral-900 text-base sm:text-lg">
                            ₱{order.total.toLocaleString()}
                          </span>
                        </div>
                      </div>

                      {order.correctionNote && (
                        <div className="text-xs text-rose-700 bg-rose-50 border border-rose-100 p-2.5 rounded-xl font-medium">
                          ⚠️ Flag Note: {order.correctionNote}
                        </div>
                      )}
                    </div>
                  )
                })
              )}
            </section>
          </main>

          {/* Right Sidebar Column (1 Col) - Styled like POS OrderSummary */}
          <div className="lg:col-span-1 lg:sticky lg:top-6 h-full">
            <aside className="bg-white rounded-2xl p-5 sm:p-6 text-neutral-900 flex flex-col h-full shadow-2xs border border-neutral-200/80 transition-all space-y-5">
              {selectedOrder ? (
                <>
                  {/* Sidebar Header */}
                  <div className="border-b border-neutral-100 pb-3 flex items-start justify-between">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-neutral-400 tracking-wider">
                        Active Order
                      </span>
                      <h3 className="text-xl font-black text-neutral-900 tracking-tight mt-0.5">
                        {selectedOrder.ref}
                      </h3>
                      <div className="text-xs font-bold text-neutral-800 mt-1">
                        {selectedOrder.customer}
                      </div>
                      <div className="text-xs text-neutral-400 font-medium">
                        {selectedOrder.phone}
                      </div>
                    </div>
                    <span
                      className={`text-[10px] font-extrabold px-2.5 py-1 rounded-full uppercase border ${
                        selectedOrder.status === 'pending' || selectedOrder.status === 'pending_verification'
                          ? 'bg-amber-50 text-amber-700 border-amber-200'
                          : selectedOrder.status === 'flagged'
                          ? 'bg-rose-50 text-rose-700 border-rose-200'
                          : selectedOrder.status === 'confirmed' || selectedOrder.status === 'pending_preparation'
                          ? 'bg-blue-50 text-blue-700 border-blue-200'
                          : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      }`}
                    >
                      {selectedOrder.status.replace('_', ' ').toUpperCase()}
                    </span>
                  </div>

                  {/* Step Progress Tracker */}
                  <div className="grid grid-cols-3 gap-1.5 text-center text-[10px] font-bold uppercase tracking-wider">
                    <div
                      className={`p-2 rounded-xl border ${
                        selectedOrder.status === 'pending' || selectedOrder.status === 'flagged' || selectedOrder.status === 'pending_verification'
                          ? 'bg-orange-600 text-white border-orange-600 shadow-2xs'
                          : 'bg-neutral-50 text-neutral-400 border-neutral-200'
                      }`}
                    >
                      1. Verification
                    </div>
                    <div
                      className={`p-2 rounded-xl border ${
                        selectedOrder.status === 'confirmed' || selectedOrder.status === 'pending_preparation'
                          ? 'bg-orange-600 text-white border-orange-600 shadow-2xs'
                          : 'bg-neutral-50 text-neutral-400 border-neutral-200'
                      }`}
                    >
                      2. Kitchen
                    </div>
                    <div
                      className={`p-2 rounded-xl border ${
                        selectedOrder.status === 'preparing' || selectedOrder.status === 'ready' || selectedOrder.status === 'assigned' || selectedOrder.status === 'out_for_delivery'
                          ? 'bg-orange-600 text-white border-orange-600 shadow-2xs'
                          : 'bg-neutral-50 text-neutral-400 border-neutral-200'
                      }`}
                    >
                      3. Dispatch
                    </div>
                  </div>

                  {/* Verification Section */}
                  {(selectedOrder.status === 'pending' || selectedOrder.status === 'flagged' || selectedOrder.status === 'pending_verification') && (
                    <div className="space-y-4">
                      <div className="bg-neutral-50 rounded-xl p-3.5 border border-neutral-200/80 space-y-2.5">
                        <label className="block text-[11px] font-semibold text-neutral-500 uppercase tracking-wider mb-1">
                          📋 Verification Checklist
                        </label>
                        <div className="space-y-2 text-xs">
                          <div className="flex items-center justify-between p-2 rounded-lg bg-white border border-neutral-200/60">
                            <span className="font-semibold text-neutral-700">Customer Name</span>
                            {customerNameValid ? (
                              <span className="text-emerald-600 font-bold">✓ Verified</span>
                            ) : (
                              <span className="text-rose-600 font-bold">⚠️ Missing</span>
                            )}
                          </div>
                          <div className="flex items-center justify-between p-2 rounded-lg bg-white border border-neutral-200/60">
                            <span className="font-semibold text-neutral-700">PH Phone Format</span>
                            {phoneValidation.isValid ? (
                              <span className="text-emerald-600 font-bold">✓ Valid</span>
                            ) : (
                              <span className="text-amber-600 font-bold">⚠️ Invalid</span>
                            )}
                          </div>
                          <div className="flex items-center justify-between p-2 rounded-lg bg-white border border-neutral-200/60">
                            <span className="font-semibold text-neutral-700">Address Details</span>
                            {addressValidation.isComplete ? (
                              <span className="text-emerald-600 font-bold">✓ Complete</span>
                            ) : (
                              <span className="text-amber-600 font-bold">⚠️ Short</span>
                            )}
                          </div>
                          {addressValidation.warningMsg && (
                            <p className="text-[11px] text-amber-700 italic bg-amber-50 p-2 rounded-lg border border-amber-200/60">
                              ⚠️ {addressValidation.warningMsg}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Correction Note Input */}
                      <div>
                        <label className="block text-[11px] font-semibold text-neutral-500 uppercase tracking-wider mb-1">
                          Flag for Correction Note
                        </label>
                        <textarea
                          value={correctionNoteInput}
                          onChange={(e) => setCorrectionNoteInput(e.target.value)}
                          placeholder="Enter instructions for correction..."
                          rows={2}
                          className="w-full bg-neutral-50 hover:bg-neutral-100/80 text-neutral-800 rounded-xl p-2.5 text-xs font-medium border border-neutral-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 resize-none"
                        />
                      </div>

                      {/* Action Buttons */}
                      <div className="grid grid-cols-2 gap-2.5">
                        <button
                          onClick={handleFlagForCorrection}
                          className="w-full bg-rose-600 hover:bg-rose-700 text-white font-semibold py-2.5 px-3 rounded-xl transition-all shadow-2xs active:scale-[0.99] cursor-pointer text-xs"
                        >
                          🚩 Flag Correction
                        </button>
                        <button
                          onClick={handleApproveSendToKitchen}
                          className="w-full bg-orange-600 hover:bg-orange-700 text-white font-semibold py-2.5 px-3 rounded-xl transition-all shadow-2xs active:scale-[0.99] cursor-pointer text-xs"
                        >
                          🍳 Approve & Kitchen
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Rider Dispatch Section */}
                  {(selectedOrder.status === 'confirmed' || selectedOrder.status === 'pending_preparation' || selectedOrder.status === 'preparing' || selectedOrder.status === 'ready' || selectedOrder.status === 'assigned') && (
                    <div className="bg-neutral-50 rounded-xl p-3.5 border border-neutral-200/80 space-y-3">
                      <label className="block text-[11px] font-semibold text-neutral-500 uppercase tracking-wider mb-1">
                        🏍️ Dispatch Rider Assignment
                      </label>
                      {selectedOrder.assignedRiderName ? (
                        <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-xl text-xs">
                          <span className="text-neutral-500 font-semibold">Assigned Rider:</span>
                          <div className="font-bold text-emerald-800 text-sm mt-0.5">
                            🏍️ {selectedOrder.assignedRiderName}
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-2.5">
                          <select
                            value={selectedRiderId}
                            onChange={(e) => setSelectedRiderId(e.target.value)}
                            className="w-full bg-white text-neutral-800 rounded-xl px-3 py-2 text-xs font-semibold appearance-none border border-neutral-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 cursor-pointer"
                          >
                            <option value="">-- Select Available Rider --</option>
                            {riders.map((r) => (
                              <option key={r.id} value={r.id} disabled={r.status === 'Offline'}>
                                {r.name} ({r.status})
                              </option>
                            ))}
                          </select>
                          <button
                            onClick={handleAssignRider}
                            className="w-full bg-orange-600 hover:bg-orange-700 text-white font-semibold py-2.5 px-3 rounded-xl transition-all shadow-2xs active:scale-[0.99] cursor-pointer text-xs"
                          >
                            🚀 Assign Dispatch
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Order Items List */}
                  <div className="space-y-2">
                    <label className="block text-[11px] font-semibold text-neutral-500 uppercase tracking-wider">
                      Order Items ({selectedOrder.items.reduce((a, b) => a + b.quantity, 0)})
                    </label>
                    <div className="bg-neutral-50 rounded-xl border border-neutral-200/80 p-3 divide-y divide-neutral-200/60 max-h-[160px] overflow-y-auto custom-scrollbar">
                      {selectedOrder.items.map((item, idx) => (
                        <div key={idx} className="flex justify-between items-center py-1.5 first:pt-0 last:pb-0 text-xs font-semibold text-neutral-800">
                          <div>
                            <span className="text-orange-600 font-bold mr-1.5">{item.quantity}x</span>
                            <span>{item.name}</span>
                          </div>
                          <span className="font-bold text-neutral-900">
                            ₱{(item.price * item.quantity).toLocaleString()}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Total Summary */}
                  <div className="pt-2 border-t border-neutral-100 flex items-center justify-between font-bold text-neutral-900">
                    <span>Total Amount</span>
                    <span className="text-lg text-orange-600 font-extrabold">
                      ₱{selectedOrder.total.toLocaleString()}
                    </span>
                  </div>
                </>
              ) : (
                <div className="h-full min-h-[280px] flex flex-col items-center justify-center text-center p-6 bg-neutral-50 rounded-xl border border-dashed border-neutral-200/80">
                  <svg className="w-8 h-8 text-neutral-300 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
                  </svg>
                  <h4 className="text-xs font-bold text-neutral-700">No Order Selected</h4>
                  <p className="text-[11px] text-neutral-400 max-w-[200px] mt-1">
                    Select an order from the list on the left to review details and approve for kitchen.
                  </p>
                </div>
              )}
            </aside>
          </div>
        </div>
      </div>

      {/* Floating Notification */}
      {notification && (
        <div className="fixed bottom-6 right-6 bg-neutral-900 text-white px-5 py-3.5 rounded-2xl shadow-2xl z-50 max-w-sm flex items-center gap-3 border border-neutral-800 animate-fade-in">
          <div className="text-base">🔔</div>
          <p className="font-medium text-xs leading-snug">{notification}</p>
        </div>
      )}
    </div>
  )
}

export default AssistantRole