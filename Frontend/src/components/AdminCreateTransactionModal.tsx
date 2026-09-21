import React, { useState } from 'react'
import { CLIENT_MENU_ITEMS } from './MenuCard'
import { API_BASE_URL } from '../utils/api'

interface AdminCreateTransactionModalProps {
  isOpen: boolean
  onClose: () => void
  onCreated?: () => void
}

export const AdminCreateTransactionModal: React.FC<AdminCreateTransactionModalProps> = ({
  isOpen,
  onClose,
  onCreated,
}) => {
  const [customerName, setCustomerName] = useState('Walk-In Customer')
  const [phone, setPhone] = useState('0917-000-0000')
  const [address, setAddress] = useState('Metro Manila')
  const [orderType, setOrderType] = useState<'Dine In' | 'Take Out' | 'Delivery'>('Take Out')
  const [tableName, setTableName] = useState('Table 1')
  const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'GCash' | 'COD'>('Cash')
  const [paymentStatus, setPaymentStatus] = useState<'PAID' | 'PENDING'>('PAID')
  const [orderStatus, setOrderStatus] = useState<string>('COMPLETED')
  const [notes, setNotes] = useState('')
  const [selectedItemName, setSelectedItemName] = useState(CLIENT_MENU_ITEMS[0]?.name || 'All Shrimp Alacarte')
  const [selectedQty, setSelectedQty] = useState(1)
  const [itemsList, setItemsList] = useState<Array<{ name: string; quantity: number; price: number }>>([
    { name: CLIENT_MENU_ITEMS[0]?.name || 'All Shrimp Alacarte', quantity: 1, price: CLIENT_MENU_ITEMS[0]?.price || 199 }
  ])
  const [isSubmitting, setIsSubmitting] = useState(false)

  if (!isOpen) return null

  const handleAddItem = () => {
    const menuItem = CLIENT_MENU_ITEMS.find((m) => m.name === selectedItemName)
    const price = menuItem ? menuItem.price : 150
    const existingIndex = itemsList.findIndex((i) => i.name === selectedItemName)
    if (existingIndex >= 0) {
      const updated = [...itemsList]
      updated[existingIndex].quantity += selectedQty
      setItemsList(updated)
    } else {
      setItemsList([...itemsList, { name: selectedItemName, quantity: selectedQty, price }])
    }
  }

  const handleRemoveItem = (index: number) => {
    setItemsList(itemsList.filter((_, i) => i !== index))
  }

  const subtotal = itemsList.reduce((sum, item) => sum + item.price * item.quantity, 0)
  const vat = Math.round(subtotal * 0.12 * 100) / 100
  const deliveryFee = orderType === 'Delivery' ? 50 : 0
  const total = subtotal + vat + deliveryFee

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (itemsList.length === 0) {
      alert('Please add at least one item to the transaction.')
      return
    }

    setIsSubmitting(true)

    const prefix = orderType === 'Delivery' ? 'SFB' : 'POS'
    const orderId = `${prefix}-${Math.floor(1000 + Math.random() * 9000)}`

    const newOrderPayload = {
      id: orderId,
      ref: orderId,
      customerName,
      customer: customerName,
      phone,
      deliveryAddress: address,
      address,
      orderType: orderType === 'Delivery' ? 'ONLINE' : orderType.toUpperCase(),
      type: orderType,
      table: orderType === 'Dine In' ? tableName : undefined,
      paymentMethod,
      payment_method: paymentMethod,
      paymentStatus,
      status: orderStatus.toUpperCase(),
      notes,
      items: itemsList,
      cartItems: itemsList.map((i) => ({ name: i.name, quantity: i.quantity, price: i.price, item: { name: i.name, price: i.price } })),
      subtotal,
      vat,
      deliveryFee,
      total,
      isPosOrder: orderType !== 'Delivery',
      dateTime: new Date().toLocaleString(),
      createdAt: new Date().toISOString(),
    }

    // 1. Post to Backend API (Persists to PostgreSQL Database)
    try {
      await fetch(`${API_BASE_URL}/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newOrderPayload),
      }).catch(() => {})
    } catch {}

    // 2. Persist in LocalStorage & dispatch sync event
    try {
      const stored = localStorage.getItem('seafudz_orders')
      const parsed = stored ? JSON.parse(stored) : []
      const updated = [newOrderPayload, ...parsed]
      localStorage.setItem('seafudz_orders', JSON.stringify(updated))
      window.dispatchEvent(new Event('seafudz_order_created'))
    } catch (e) {
      console.warn('Error saving local order:', e)
    }

    setIsSubmitting(false)
    if (onCreated) onCreated()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
      <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-neutral-200 space-y-5 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-neutral-100 pb-4">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-orange-600 bg-orange-50 px-2.5 py-1 rounded-full border border-orange-200">
              Admin Exclusive
            </span>
            <h2 className="text-xl font-extrabold text-neutral-900 mt-1">
              ➕ Create New Transaction
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-neutral-400 hover:text-neutral-700 text-xl font-bold p-2 rounded-xl hover:bg-neutral-100 transition-all cursor-pointer"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Customer & Contact Info */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-neutral-700 mb-1">Customer Name</label>
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-neutral-200 focus:outline-none focus:ring-2 focus:ring-orange-500 font-semibold"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-neutral-700 mb-1">Phone Number</label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-neutral-200 focus:outline-none focus:ring-2 focus:ring-orange-500 font-semibold"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-neutral-700 mb-1">Delivery / Address</label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-neutral-200 focus:outline-none focus:ring-2 focus:ring-orange-500 font-semibold"
              />
            </div>
          </div>

          {/* Channel & Status */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-bold text-neutral-700 mb-1">Order Channel</label>
              <select
                value={orderType}
                onChange={(e) => setOrderType(e.target.value as any)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-neutral-200 focus:outline-none focus:ring-2 focus:ring-orange-500 font-semibold bg-white"
              >
                <option value="Take Out">Take Out</option>
                <option value="Dine In">Dine In</option>
                <option value="Delivery">Delivery</option>
              </select>
            </div>

            {orderType === 'Dine In' && (
              <div>
                <label className="block text-xs font-bold text-neutral-700 mb-1">Table #</label>
                <input
                  type="text"
                  value={tableName}
                  onChange={(e) => setTableName(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-neutral-200 focus:outline-none focus:ring-2 focus:ring-orange-500 font-semibold"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-neutral-700 mb-1">Payment Method</label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as any)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-neutral-200 focus:outline-none focus:ring-2 focus:ring-orange-500 font-semibold bg-white"
              >
                <option value="Cash">Cash</option>
                <option value="GCash">GCash</option>
                <option value="COD">COD</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-neutral-700 mb-1">Payment Status</label>
              <select
                value={paymentStatus}
                onChange={(e) => setPaymentStatus(e.target.value as any)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-neutral-200 focus:outline-none focus:ring-2 focus:ring-orange-500 font-semibold bg-white"
              >
                <option value="PAID">PAID</option>
                <option value="PENDING">PENDING</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-neutral-700 mb-1">Order Status</label>
              <select
                value={orderStatus}
                onChange={(e) => setOrderStatus(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-neutral-200 focus:outline-none focus:ring-2 focus:ring-orange-500 font-semibold bg-white"
              >
                <option value="PENDING">PENDING</option>
                <option value="CONFIRMED">CONFIRMED</option>
                <option value="PREPARING">PREPARING</option>
                <option value="READY">READY</option>
                <option value="OUT_FOR_DELIVERY">OUT FOR DELIVERY</option>
                <option value="COMPLETED">COMPLETED</option>
                <option value="CANCELLED">CANCELLED</option>
              </select>
            </div>
          </div>

          {/* Items Selector */}
          <div className="bg-neutral-50 p-4 rounded-2xl border border-neutral-200 space-y-3">
            <h3 className="text-xs font-extrabold text-neutral-800 uppercase tracking-wider">
              Add Items to Order
            </h3>

            <div className="flex flex-col sm:flex-row items-center gap-2">
              <select
                value={selectedItemName}
                onChange={(e) => setSelectedItemName(e.target.value)}
                className="flex-1 w-full px-3 py-2 text-xs rounded-xl border border-neutral-200 bg-white font-semibold"
              >
                {CLIENT_MENU_ITEMS.map((item) => (
                  <option key={item.id} value={item.name}>
                    {item.name} — ₱{item.price}
                  </option>
                ))}
              </select>

              <input
                type="number"
                min={1}
                max={99}
                value={selectedQty}
                onChange={(e) => setSelectedQty(Math.max(1, parseInt(e.target.value, 10) || 1))}
                className="w-20 px-3 py-2 text-xs rounded-xl border border-neutral-200 bg-white font-bold text-center"
              />

              <button
                type="button"
                onClick={handleAddItem}
                className="w-full sm:w-auto px-4 py-2 bg-neutral-900 hover:bg-black text-white text-xs font-bold rounded-xl cursor-pointer transition-all shadow-2xs"
              >
                + Add Item
              </button>
            </div>

            {/* Added Items List */}
            {itemsList.length > 0 && (
              <div className="space-y-1.5 pt-2">
                {itemsList.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between bg-white px-3 py-2 rounded-xl border border-neutral-200 text-xs font-medium"
                  >
                    <span>
                      <strong className="font-bold">{item.name}</strong> x{item.quantity}
                    </span>
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-neutral-800">
                        ₱{(item.price * item.quantity).toLocaleString()}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(idx)}
                        className="text-red-500 hover:text-red-700 font-bold text-xs cursor-pointer"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-bold text-neutral-700 mb-1">Order Notes (Optional)</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="E.g. Extra spicy cajun, no onions"
              className="w-full px-3 py-2 text-xs rounded-xl border border-neutral-200 focus:outline-none focus:ring-2 focus:ring-orange-500 font-semibold"
            />
          </div>

          {/* Total Breakdown */}
          <div className="bg-orange-50 p-4 rounded-2xl border border-orange-200 flex items-center justify-between">
            <div className="text-xs text-neutral-600 font-medium space-y-0.5">
              <div>Subtotal: ₱{subtotal.toLocaleString()}</div>
              <div>VAT (12%): ₱{vat.toLocaleString()} | Fee: ₱{deliveryFee}</div>
            </div>
            <div className="text-right">
              <span className="text-[10px] font-bold uppercase tracking-wider text-orange-600 block">
                Total Transaction
              </span>
              <span className="text-xl font-black text-neutral-900">
                ₱{total.toLocaleString()}
              </span>
            </div>
          </div>

          {/* Submit Actions */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl border border-neutral-200 text-neutral-600 font-bold text-xs hover:bg-neutral-100 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2.5 rounded-xl bg-[#ff7b00] hover:bg-[#e06c00] text-white font-extrabold text-xs shadow-md shadow-orange-500/20 cursor-pointer transition-all active:scale-95 disabled:opacity-50"
            >
              {isSubmitting ? 'Saving...' : 'Create & Persist to Database'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
