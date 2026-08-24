import React, { useState, useEffect } from 'react'
import { Navbar } from '../components/Navbar'

export interface OrderItem {
  name: string;
  quantity: number;
  price: number;
}

export interface OnlineOrder {
  id: string;
  ref: string;
  customer: string;
  phone: string;
  address: string;
  paymentMethod: string;
  status: 'pending' | 'flagged' | 'pending_preparation' | 'preparing' | 'assigned';
  items: OrderItem[];
  total: number;
  createdAt: string;
  correctionNote?: string;
  riderId?: string;
  assignedRiderName?: string;
}

export interface Rider {
  id: string;
  name: string;
  status: 'Available' | 'Busy - 1 delivery active' | 'Offline';
  vehicle: string;
  phone: string;
}

const INITIAL_RIDERS: Rider[] = [
  { id: 'r-1', name: 'Danilo "Speedy" Santos', status: 'Available', vehicle: 'Honda Click 125i', phone: '0917-555-0192' },
  { id: 'r-2', name: 'Mark "Cajun" Dimaculangan', status: 'Busy - 1 delivery active', vehicle: 'Yamaha Aerox 155', phone: '0918-222-9981' },
  { id: 'r-3', name: 'Jun-Jun "Dagat" Reyes', status: 'Available', vehicle: 'Suzuki Smash 115', phone: '0922-777-3322' },
  { id: 'r-4', name: 'Ronaldo dela Cruz', status: 'Offline', vehicle: 'Honda Beat', phone: '0909-111-2233' }
]

// Initial mock online orders to make the UI look rich and interactive immediately
const INITIAL_ONLINE_ORDERS: OnlineOrder[] = [
  {
    id: 'oo-1',
    ref: 'ORD-8821',
    customer: 'Clarissa Dimapilis',
    phone: '0917-882-9912',
    address: 'Block 4, Lot 12, Mahogany St., Phase 2, Cavite City',
    paymentMethod: 'GCash',
    status: 'pending',
    items: [
      { name: 'Seafood Cajun Mix', quantity: 1, price: 1800 },
      { name: 'Fresh Juice', quantity: 2, price: 250 }
    ],
    total: 2300,
    createdAt: '5 mins ago'
  },
  {
    id: 'oo-2',
    ref: 'ORD-8822',
    customer: 'Michael Reyes',
    phone: '0908-112-4455',
    address: 'Room 204, Jade Heights Condominium, Taft Ave, Manila',
    paymentMethod: 'Cash on Delivery',
    status: 'pending',
    items: [
      { name: 'Crab Bucket', quantity: 1, price: 2500 },
      { name: 'Spicy Shrimp', quantity: 1, price: 1200 }
    ],
    total: 3700,
    createdAt: '12 mins ago'
  },
  {
    id: 'oo-3',
    ref: 'ORD-8823',
    customer: 'Samantha Go',
    phone: '0918-334-9988',
    address: '15 Dunhill St., Fairview, Quezon City',
    paymentMethod: 'GCash',
    status: 'pending',
    items: [
      { name: 'Seafood Bilao', quantity: 1, price: 2000 }
    ],
    total: 2000,
    createdAt: '25 mins ago'
  }
]

const CUSTOMER_NAMES = ['Elena Cruz', 'Gabriel Santos', 'Patricia Luna', 'Renzo Diaz', 'Melissa Lim']
const DISHES = [
  { name: 'Seafood Cajun Mix', price: 1800 },
  { name: 'Crab Bucket', price: 2500 },
  { name: 'Spicy Shrimp', price: 1200 },
  { name: 'Seafood Bilao', price: 2000 },
  { name: 'Garlic Butter Shrimp', price: 1000 },
  { name: 'Fresh Juice', price: 250 }
]

export const AssistantRole: React.FC = () => {
  const [orders, setOrders] = useState<OnlineOrder[]>(INITIAL_ONLINE_ORDERS)
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null)
  const [notification, setNotification] = useState<string | null>(null)

  const [activeTab, setActiveTab] = useState<'pending' | 'kitchen' | 'dispatch' | 'all'>('pending')
  const [correctionNoteInput, setCorrectionNoteInput] = useState('')
  const [selectedRiderId, setSelectedRiderId] = useState('')

  // Auto-dismiss notification toast
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => {
        setNotification(null)
      }, 4000)
      return () => clearTimeout(timer)
    }
  }, [notification])

  // Simulate incoming online orders periodically to keep UI alive
  useEffect(() => {
    const interval = setInterval(() => {
      const randomName = CUSTOMER_NAMES[Math.floor(Math.random() * CUSTOMER_NAMES.length)]
      const numItems = Math.floor(Math.random() * 2) + 1
      const selectedItems: OrderItem[] = []
      let total = 0

      for (let i = 0; i < numItems; i++) {
        const dish = DISHES[Math.floor(Math.random() * DISHES.length)]
        const qty = Math.floor(Math.random() * 2) + 1
        selectedItems.push({
          name: dish.name,
          quantity: qty,
          price: dish.price
        })
        total += dish.price * qty
      }

      const orderId = `oo-${Date.now()}`
      const refNumber = `ORD-${Math.floor(Math.random() * 9000) + 1000}`

      const newOrder: OnlineOrder = {
        id: orderId,
        ref: refNumber,
        customer: randomName,
        phone: `09${Math.floor(Math.random() * 900000000 + 100000000)}`,
        address: `${Math.floor(Math.random() * 120) + 1} Aurora Blvd, Quezon City`,
        paymentMethod: Math.random() > 0.4 ? 'GCash' : 'Cash on Delivery',
        status: 'pending',
        items: selectedItems,
        total,
        createdAt: 'Just now'
      }

      setOrders(prev => [newOrder, ...prev])
      setNotification(`🔔 New Online Order Received! ${refNumber} - ₱${total}`)
    }, 25000)

    return () => clearInterval(interval)
  }, [])

  const selectedOrder = orders.find(o => o.id === selectedOrderId)

  // Phone Validation helper for Philippine numbers
  const validatePhone = (phoneStr: string): { isValid: boolean; cleaned: string } => {
    const cleaned = phoneStr.replace(/[^0-9+]/g, '')
    if (cleaned.startsWith('+639')) {
      return { isValid: cleaned.length === 13, cleaned }
    }
    if (cleaned.startsWith('09')) {
      return { isValid: cleaned.length === 11, cleaned }
    }
    return { isValid: false, cleaned }
  }

  // Address completeness helper
  const validateAddress = (addressStr: string): { isComplete: boolean; warningMsg?: string } => {
    const cleaned = addressStr.trim()
    if (cleaned.length === 0) {
      return { isComplete: false, warningMsg: 'Address is missing.' }
    }
    if (cleaned.length < 15) {
      return { isComplete: false, warningMsg: 'Address details seem too short.' }
    }
    const keywords = ['brgy', 'barangay', 'st', 'street', 'ave', 'avenue', 'phase', 'block', 'lot', 'no', 'corner', 'cty', 'city', 'silang']
    const hasDetails = keywords.some(keyword => cleaned.toLowerCase().includes(keyword))
    if (!hasDetails) {
      return { isComplete: false, warningMsg: 'Missing landmark or street indicator (e.g. St, Brgy).' }
    }
    return { isComplete: true }
  }

  // Real-time evaluation of selected order
  const customerNameValid = selectedOrder ? selectedOrder.customer.trim().length > 0 : false
  const phoneValidation = selectedOrder ? validatePhone(selectedOrder.phone) : { isValid: false, cleaned: '' }
  const addressValidation = selectedOrder ? validateAddress(selectedOrder.address) : { isComplete: false, warningMsg: '' }

  const handleFlagForCorrection = () => {
    if (!selectedOrderId || !selectedOrder) return
    if (!correctionNoteInput.trim()) {
      setNotification('⚠️ Please enter a correction note first.')
      return
    }
    setOrders(prev =>
      prev.map(o =>
        o.id === selectedOrderId
          ? { ...o, status: 'flagged', correctionNote: correctionNoteInput }
          : o
      )
    )
    setNotification(`🚩 Order ${selectedOrder.ref} flagged for correction.`)
    setCorrectionNoteInput('')
  }

  const handleApproveSendToKitchen = () => {
    if (!selectedOrderId || !selectedOrder) return
    if (!customerNameValid || !phoneValidation.isValid || !addressValidation.isComplete) {
      setNotification('⚠️ Fix or acknowledge checklist issues before sending to kitchen.')
      return
    }
    setOrders(prev =>
      prev.map(o =>
        o.id === selectedOrderId ? { ...o, status: 'pending_preparation' } : o
      )
    )
    setNotification(`🍳 Order ${selectedOrder.ref} approved and sent to Kitchen!`)
  }

  const handleAssignRider = () => {
    if (!selectedOrderId || !selectedOrder) return
    if (!selectedRiderId) {
      setNotification('⚠️ Please select a rider to dispatch.')
      return
    }
    const rider = INITIAL_RIDERS.find(r => r.id === selectedRiderId)
    if (!rider) return

    setOrders(prev =>
      prev.map(o =>
        o.id === selectedOrderId
          ? { ...o, status: 'preparing', riderId: rider.id, assignedRiderName: rider.name }
          : o
      )
    )
    setNotification(`🔔 Rider ${rider.name} notified of Order ${selectedOrder.ref}`)
  }

  // Filter list based on selected pipeline stage tab
  const filteredOrders = orders.filter(order => {
    if (activeTab === 'pending') return order.status === 'pending' || order.status === 'flagged'
    if (activeTab === 'kitchen') return order.status === 'pending_preparation'
    if (activeTab === 'dispatch') return order.status === 'preparing' || order.status === 'assigned'
    return true
  })

  return (
    <div className="flex flex-col min-h-screen bg-[#f8f6f4] text-[#2c1810] font-sans pb-8">
      {/* Role-Based Navigation Bar */}
      <div className="p-4 z-20">
        <Navbar />
      </div>

      {/* Pipeline View Workspace */}
      <div className="flex-1 flex flex-col lg:flex-row bg-[#f8f6f4] text-[#2c1810] overflow-hidden">
        {/* Left panel: Order Feed */}
        <div className="flex-1 flex flex-col border-r border-[#e0d6cf] bg-[#f8f6f4]">
          {/* Pipeline Navigation Header */}
          <div className="p-4 bg-white border-b border-[#e0d6cf] flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h2 className="text-xl font-bold tracking-tight text-[#2c1810] flex items-center gap-2">
                <span className="text-[#ff7b00]">🍤</span> Order Status Pipeline
              </h2>
              <p className="text-xs text-neutral-500">Bagong Silang Branch • Real-time Feeds</p>
            </div>

            <div className="flex bg-[#f8f6f4] p-1 rounded-xl border border-[#e0d6cf] text-xs">
              <button
                onClick={() => setActiveTab('pending')}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all ${activeTab === 'pending'
                  ? 'bg-[#ff7b00] text-white shadow'
                  : 'text-neutral-500 hover:text-[#ff7b00]'
                  }`}
              >
                Pending Verification ({orders.filter(o => o.status === 'pending' || o.status === 'flagged').length})
              </button>
              <button
                onClick={() => setActiveTab('kitchen')}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all ${activeTab === 'kitchen'
                  ? 'bg-[#ff7b00] text-white shadow'
                  : 'text-neutral-500 hover:text-[#ff7b00]'
                  }`}
              >
                Kitchen ({orders.filter(o => o.status === 'pending_preparation').length})
              </button>
              <button
                onClick={() => setActiveTab('dispatch')}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all ${activeTab === 'dispatch'
                  ? 'bg-[#ff7b00] text-white shadow'
                  : 'text-neutral-500 hover:text-[#ff7b00]'
                  }`}
              >
                Rider Dispatch ({orders.filter(o => o.status === 'preparing' || o.status === 'assigned').length})
              </button>
              <button
                onClick={() => setActiveTab('all')}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all ${activeTab === 'all'
                  ? 'bg-[#e0d6cf] text-[#2c1810]'
                  : 'text-neutral-500 hover:text-[#ff7b00]'
                  }`}
              >
                All ({orders.length})
              </button>
            </div>
          </div>

          {/* Order Feed Cards */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {filteredOrders.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-neutral-400 bg-white border border-dashed border-[#e0d6cf] rounded-2xl p-6 text-center">
                <span className="text-4xl mb-3">🗂️</span>
                <h4 className="text-sm font-bold text-neutral-700">No Orders in this pipeline stage</h4>
                <p className="text-xs text-neutral-500 max-w-xs mt-1">Pending and incoming delivery orders appear here automatically.</p>
              </div>
            ) : (
              filteredOrders.map(order => {
                const isSelected = order.id === selectedOrderId
                return (
                  <div
                    key={order.id}
                    onClick={() => setSelectedOrderId(order.id)}
                    className={`group relative bg-white border rounded-2xl p-4 cursor-pointer transition-all duration-200 hover:-translate-y-0.5 ${isSelected
                      ? 'border-[#ff7b00] ring-2 ring-[#ff7b00]/20 bg-[#fffbf9] shadow-sm'
                      : 'border-[#e0d6cf] hover:border-[#ff7b00]/50 hover:bg-[#fffbf9]/40'
                      }`}
                  >
                    <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#e0d6cf]">
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-[#ff7b00] text-sm tracking-wider">{order.ref}</span>
                        <span className="text-[10px] text-neutral-400 font-semibold">{order.createdAt}</span>
                      </div>
                      <span className={`text-[10px] font-extrabold px-2.5 py-1 rounded-full uppercase tracking-wider ${order.status === 'pending'
                        ? 'bg-amber-100 text-amber-800'
                        : order.status === 'flagged'
                          ? 'bg-rose-100 text-rose-800 animate-pulse'
                          : order.status === 'pending_preparation'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}>
                        {order.status.replace('_', ' ').toUpperCase()}
                      </span>
                    </div>

                    <div className="flex flex-col md:flex-row justify-between md:items-center gap-2">
                      <div>
                        <div className="font-bold text-neutral-800 text-sm">{order.customer}</div>
                        <div className="text-xs text-neutral-500 truncate max-w-md">{order.address}</div>
                      </div>
                      <div className="flex items-center justify-between md:justify-end gap-3 text-right">
                        <span className="text-[10px] text-neutral-400 font-semibold">{order.paymentMethod}</span>
                        <span className="font-extrabold text-[#2c1810] text-sm">₱{order.total.toLocaleString()}</span>
                      </div>
                    </div>
                    {order.correctionNote && (
                      <div className="mt-2 text-[11px] text-rose-800 bg-rose-50 border border-rose-100 p-2 rounded-lg font-medium italic">
                        ⚠️ Note: {order.correctionNote}
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* Right panel: Console details & Pipelines (POS style sidebar theme) */}
        <div className="w-full lg:w-[480px] bg-[#a08070] text-white border-t lg:border-t-0 border-[#8c6b5a] flex flex-col overflow-y-auto">
          {selectedOrder ? (
            <div className="flex flex-col p-6 space-y-6">

              {/* Header Details */}
              <div className="bg-[#8c6b5a] p-5 rounded-2xl border border-white/10 shadow-inner">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-[10px] uppercase font-bold text-white/60 tracking-wider">Active Reference</div>
                    <h3 className="text-2xl font-black text-white tracking-wide mt-0.5">{selectedOrder.ref}</h3>
                  </div>
                  <span className={`text-[10px] font-black px-2.5 py-1 rounded-full uppercase border ${selectedOrder.status === 'pending'
                    ? 'bg-amber-100 text-amber-900 border-amber-200'
                    : selectedOrder.status === 'flagged'
                      ? 'bg-rose-100 text-rose-900 border-rose-200'
                      : selectedOrder.status === 'pending_preparation'
                        ? 'bg-blue-100 text-blue-900 border-blue-200'
                        : 'bg-emerald-100 text-emerald-900 border-emerald-200'
                    }`}>
                    {selectedOrder.status.replace('_', ' ').toUpperCase()}
                  </span>
                </div>
                <div className="mt-4 border-t border-white/15 pt-3">
                  <div className="font-bold text-white text-base">{selectedOrder.customer}</div>
                  <div className="text-xs text-white/80 font-semibold mt-0.5">{selectedOrder.phone}</div>
                </div>
              </div>

              {/* Pipeline Stage Indicators */}
              <div className="grid grid-cols-3 gap-2 text-center text-[10px] font-bold uppercase tracking-wider">
                <div className={`p-2 rounded-lg border ${selectedOrder.status === 'pending' || selectedOrder.status === 'flagged'
                  ? 'bg-[#ff7b00] text-white border-[#ff7b00]'
                  : 'bg-black/10 text-white/50 border-white/10'
                  }`}>
                  1. Verification
                </div>
                <div className={`p-2 rounded-lg border ${selectedOrder.status === 'pending_preparation'
                  ? 'bg-[#ff7b00] text-white border-[#ff7b00]'
                  : 'bg-black/10 text-white/50 border-white/10'
                  }`}>
                  2. Kitchen Queue
                </div>
                <div className={`p-2 rounded-lg border ${selectedOrder.status === 'preparing' || selectedOrder.status === 'assigned'
                  ? 'bg-[#ff7b00] text-white border-[#ff7b00]'
                  : 'bg-black/10 text-white/50 border-white/10'
                  }`}>
                  3. Rider Dispatch
                </div>
              </div>

              {/* PIPELINE VIEW 1: interactive Verification Checklist (Pending or Flagged) */}
              {(selectedOrder.status === 'pending' || selectedOrder.status === 'flagged') && (
                <div className="space-y-4">
                  <div className="p-4 bg-black/10 rounded-2xl border border-white/10 space-y-4">
                    <h4 className="text-xs font-extrabold uppercase text-white/80 tracking-wider flex items-center gap-1.5">
                      📋 Verification Checklist
                    </h4>

                    <div className="space-y-3 text-xs">
                      {/* Checklist item 1 */}
                      <div className="flex items-start justify-between p-2.5 rounded-xl bg-[#8c6b5a]/40 border border-white/10">
                        <div>
                          <div className="font-bold text-white">Customer Name Present</div>
                          <div className="text-[10px] text-white/70 mt-0.5">Value: "{selectedOrder.customer}"</div>
                        </div>
                        <div>
                          {customerNameValid ? (
                            <span className="text-emerald-300 font-bold flex items-center gap-1">✓ Verified</span>
                          ) : (
                            <span className="text-rose-300 font-bold flex items-center gap-1">⚠️ Missing</span>
                          )}
                        </div>
                      </div>

                      {/* Checklist item 2 */}
                      <div className="flex items-start justify-between p-2.5 rounded-xl bg-[#8c6b5a]/40 border border-white/10">
                        <div>
                          <div className="font-bold text-white">PH Mobile Format</div>
                          <div className="text-[10px] text-white/70 mt-0.5">Value: "{selectedOrder.phone}"</div>
                        </div>
                        <div>
                          {phoneValidation.isValid ? (
                            <span className="text-emerald-300 font-bold flex items-center gap-1">✓ Valid format</span>
                          ) : (
                            <span className="text-amber-300 font-bold flex items-center gap-1">⚠️ Invalid</span>
                          )}
                        </div>
                      </div>

                      {/* Checklist item 3 */}
                      <div className="flex items-start justify-between p-2.5 rounded-xl bg-[#8c6b5a]/40 border border-white/10">
                        <div>
                          <div className="font-bold text-white">Complete Address Details</div>
                          <div className="text-[10px] text-white/70 mt-0.5 truncate max-w-[200px]" title={selectedOrder.address}>
                            Value: "{selectedOrder.address}"
                          </div>
                        </div>
                        <div>
                          {addressValidation.isComplete ? (
                            <span className="text-emerald-300 font-bold flex items-center gap-1">✓ Complete</span>
                          ) : (
                            <span className="text-amber-300 font-bold flex items-center gap-1">⚠️ Short/Incomplete</span>
                          )}
                        </div>
                      </div>

                      {addressValidation.warningMsg && (
                        <p className="text-[11px] text-amber-300 italic bg-amber-500/10 p-2 rounded-lg border border-amber-400/20">
                          ⚠️ {addressValidation.warningMsg}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Flag for Correction Box */}
                  <div className="p-4 bg-black/10 rounded-2xl border border-white/10 space-y-3">
                    <h5 className="text-[11px] font-extrabold uppercase text-white/80 tracking-wider">
                      Flag for Correction Note
                    </h5>
                    <textarea
                      value={correctionNoteInput}
                      onChange={(e) => setCorrectionNoteInput(e.target.value)}
                      placeholder="Enter instructions (e.g. Address needs landmark, wrong format...)"
                      className="w-full text-xs p-3 rounded-xl bg-[#8c6b5a]/30 border border-white/15 text-white placeholder-white/50 focus:outline-none focus:border-[#ff7b00] min-h-[70px] resize-none"
                    />
                    <div className="flex gap-3">
                      <button
                        onClick={handleFlagForCorrection}
                        className="flex-1 bg-rose-600 hover:bg-rose-700 active:scale-[0.98] text-white py-2.5 px-4 rounded-xl font-bold transition-all text-xs flex items-center justify-center gap-1.5 shadow-md border border-rose-500/20"
                      >
                        🚩 Flag for Correction
                      </button>
                      <button
                        onClick={handleApproveSendToKitchen}
                        className="flex-1 bg-[#ff7b00] hover:bg-[#e66f00] active:scale-[0.98] text-white py-2.5 px-4 rounded-xl font-bold transition-all text-xs flex items-center justify-center gap-1.5 shadow-md shadow-orange-900/20"
                      >
                        🍳 Approve & Kitchen
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* PIPELINE VIEW 2: Kitchen Handshake Pending Preparation */}
              {selectedOrder.status === 'pending_preparation' && (
                <div className="p-5 bg-black/10 rounded-2xl border border-white/10 space-y-4">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl animate-spin text-amber-300">🧑‍🍳</span>
                    <div>
                      <h4 className="text-sm font-bold text-white">Sent to Kitchen Queue</h4>
                      <p className="text-xs text-white/70">Order is pending kitchen verification and preparation.</p>
                    </div>
                  </div>

                  {/* Simulated dispatch bypass button */}
                  <button
                    onClick={() => {
                      setOrders(prev =>
                        prev.map(o => o.id === selectedOrderId ? { ...o, status: 'preparing' } : o)
                      )
                      setNotification(`🍳 Kitchen handshake complete. Order ${selectedOrder.ref} is ready for dispatch assignment!`)
                    }}
                    className="w-full bg-[#ff7b00] hover:bg-[#e66f00] active:scale-[0.98] text-white py-3 px-4 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-1.5"
                  >
                    ⚡ Advance to Dispatch Matching
                  </button>
                </div>
              )}

              {/* PIPELINE VIEW 3: Rider Dispatch Panel */}
              {(selectedOrder.status === 'preparing' || selectedOrder.status === 'assigned') && (
                <div className="space-y-4">
                  <div className="p-4 bg-black/10 rounded-2xl border border-white/10 space-y-3">
                    <h4 className="text-xs font-extrabold uppercase text-white/80 tracking-wider flex items-center gap-1.5">
                      🏍️ Select Dispatch Rider
                    </h4>

                    {selectedOrder.assignedRiderName ? (
                      <div className="bg-[#8c6b5a]/50 border border-white/10 p-3 rounded-xl">
                        <div className="text-xs font-bold text-white/70">Assigned Rider:</div>
                        <div className="text-sm font-bold text-emerald-300 mt-1 flex items-center gap-1.5">
                          <span>🏍️</span> {selectedOrder.assignedRiderName}
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <select
                          value={selectedRiderId}
                          onChange={(e) => setSelectedRiderId(e.target.value)}
                          className="w-full text-xs p-3 rounded-xl bg-[#8c6b5a] border border-white/10 text-white focus:outline-none focus:border-[#ff7b00]"
                        >
                          <option value="" className="text-[#2c1810]">-- Choose an Available Rider --</option>
                          {INITIAL_RIDERS.map(rider => (
                            <option key={rider.id} value={rider.id} disabled={rider.status === 'Offline'} className="text-[#2c1810]">
                              {rider.name} ({rider.status}) - {rider.vehicle}
                            </option>
                          ))}
                        </select>

                        <button
                          onClick={handleAssignRider}
                          className="w-full bg-[#ff7b00] hover:bg-[#e66f00] active:scale-[0.98] text-white py-3 px-4 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-1.5 shadow-md shadow-orange-950/20"
                        >
                          🚀 Assign Dispatch
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Dispatch Details Summary */}
                  <div className="p-4 bg-black/10 rounded-2xl border border-white/10 space-y-3 text-xs">
                    <h5 className="font-extrabold uppercase text-white/80 tracking-wider">
                      Dispatch Summary
                    </h5>
                    <div className="space-y-2 divide-y divide-white/10">
                      <div className="pt-2 flex justify-between">
                        <span className="text-white/60">Customer:</span>
                        <span className="font-bold text-white">{selectedOrder.customer} ({selectedOrder.phone})</span>
                      </div>
                      <div className="pt-2 flex justify-between">
                        <span className="text-white/60">Address:</span>
                        <span className="font-bold text-white text-right max-w-[240px] truncate" title={selectedOrder.address}>
                          {selectedOrder.address}
                        </span>
                      </div>
                      <div className="pt-2">
                        <span className="text-white/60 block mb-1">Cargo Details (Items):</span>
                        <div className="space-y-1 bg-[#8c6b5a]/40 border border-white/10 p-2.5 rounded-lg">
                          {selectedOrder.items.map((item, idx) => (
                            <div key={idx} className="flex justify-between text-[11px]">
                              <span className="text-white/90 font-medium">{item.quantity}x {item.name}</span>
                              <span className="text-white/70">₱{(item.price * item.quantity).toLocaleString()}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="pt-2 flex justify-between font-bold text-white">
                        <span>Total Amount:</span>
                        <span className="text-[#ffd099]">₱{selectedOrder.total.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Cargo itemized preview */}
              <div className="p-4 bg-black/10 rounded-2xl border border-white/10 space-y-2">
                <h5 className="text-xs uppercase font-extrabold tracking-wider text-white/80">Order Items</h5>
                <div className="divide-y divide-white/10 bg-[#8c6b5a]/40 border border-white/10 rounded-xl overflow-hidden">
                  {selectedOrder.items.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 text-xs">
                      <div>
                        <span className="font-bold text-[#ffd099] mr-2">{item.quantity}x</span>
                        <span className="text-white font-semibold">{item.name}</span>
                      </div>
                      <span className="font-extrabold text-white/90">₱{(item.price * item.quantity).toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center p-8 text-white/60 bg-black/5 min-h-[300px]">
              <span className="text-4xl mb-3">👈</span>
              <h4 className="text-sm font-bold text-white">No Order Selected</h4>
              <p className="text-xs text-white/70 max-w-[260px] mt-1">
                Select an order from the list on the left to view details and process through the pipeline stages.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Floating Toast Notification */}
      {notification && (
        <div className="fixed bottom-6 right-6 bg-[#ff7b00] text-white px-6 py-4 rounded-xl shadow-2xl z-50 animate-in fade-in slide-in-from-bottom-5 duration-300 max-w-sm flex items-center gap-3 border border-orange-500/30">
          <div className="text-xl">🔔</div>
          <p className="font-semibold text-xs leading-snug">{notification}</p>
        </div>
      )}
    </div>
  )
}
