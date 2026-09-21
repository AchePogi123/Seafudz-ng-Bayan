import React, { useState, useEffect } from 'react'
import { API_BASE_URL } from '../utils/api'

export interface TransactionData {
  id: string
  ref?: string
  customer?: string
  customerName?: string
  phone?: string
  address?: string
  type?: string
  order_type?: string
  table?: string
  paymentMethod?: string
  paymentStatus?: string
  status?: string
  notes?: string
  total?: number
  items?: any
  cartItems?: any[]
  subtotal?: number
  vat?: number
  deliveryFee?: number
}

interface AdminEditTransactionModalProps {
  isOpen: boolean
  transaction: TransactionData | null
  onClose: () => void
  onSave?: () => void
}

export const AdminEditTransactionModal: React.FC<AdminEditTransactionModalProps> = ({
  isOpen,
  transaction,
  onClose,
  onSave,
}) => {
  const [customerName, setCustomerName] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [status, setStatus] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('')
  const [paymentStatus, setPaymentStatus] = useState('')
  const [notes, setNotes] = useState('')
  const [total, setTotal] = useState<number>(0)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (transaction) {
      setCustomerName(transaction.customer || transaction.customerName || 'Walk-In Customer')
      setPhone(transaction.phone || '')
      setAddress(transaction.address || '')
      setStatus((transaction.status || 'PENDING').toUpperCase())
      setPaymentMethod(transaction.paymentMethod || 'Cash')
      setPaymentStatus(transaction.paymentStatus || 'PAID')
      setNotes(transaction.notes || '')
      setTotal(Number(transaction.total || 0))
    }
  }, [transaction])

  if (!isOpen || !transaction) return null

  const orderId = transaction.id || transaction.ref || ''

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaving(true)

    const updatedPayload = {
      ...transaction,
      customerName,
      customer: customerName,
      phone,
      address,
      status: status.toUpperCase(),
      paymentMethod,
      paymentStatus,
      notes,
      total,
      updated_at: new Date().toISOString(),
    }

    // 1. Send PUT request to Backend API (Persists to PostgreSQL DB)
    try {
      await fetch(`${API_BASE_URL}/orders/${orderId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedPayload),
      }).catch(() => {})
    } catch {}

    // 2. Persist in shared LocalStorage & trigger multi-terminal sync
    try {
      const stored = localStorage.getItem('seafudz_orders')
      if (stored) {
        const parsed = JSON.parse(stored)
        const updated = parsed.map((o: any) =>
          o.id === orderId || o.ref === orderId ? { ...o, ...updatedPayload } : o
        )
        localStorage.setItem('seafudz_orders', JSON.stringify(updated))
      }
      window.dispatchEvent(new Event('seafudz_order_created'))
    } catch (e) {
      console.warn('Error updating local order:', e)
    }

    setIsSaving(false)
    if (onSave) onSave()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
      <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-neutral-200 space-y-5">
        <div className="flex items-center justify-between border-b border-neutral-100 pb-4">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-orange-600 bg-orange-50 px-2.5 py-1 rounded-full border border-orange-200">
              Admin Exclusive
            </span>
            <h2 className="text-xl font-extrabold text-neutral-900 mt-1">
              ✏️ Edit Transaction #{orderId}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-neutral-400 hover:text-neutral-700 text-xl font-bold p-2 rounded-xl hover:bg-neutral-100 transition-all cursor-pointer"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSave} className="space-y-4 text-xs font-medium">
          {/* Customer Name */}
          <div>
            <label className="block font-bold text-neutral-700 mb-1">Customer Name</label>
            <input
              type="text"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-200 focus:outline-none focus:ring-2 focus:ring-orange-500 font-semibold"
              required
            />
          </div>

          {/* Phone & Address */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-neutral-700 mb-1">Phone Number</label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-200 focus:outline-none focus:ring-2 focus:ring-orange-500 font-semibold"
              />
            </div>
            <div>
              <label className="block font-bold text-neutral-700 mb-1">Delivery Address</label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-200 focus:outline-none focus:ring-2 focus:ring-orange-500 font-semibold"
              />
            </div>
          </div>

          {/* Status Override */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-neutral-700 mb-1">Status (Admin Override)</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-200 focus:outline-none focus:ring-2 focus:ring-orange-500 font-bold bg-white"
              >
                <option value="PENDING">PENDING</option>
                <option value="CONFIRMED">CONFIRMED</option>
                <option value="PREPARING">PREPARING</option>
                <option value="COOKING">COOKING</option>
                <option value="READY">READY</option>
                <option value="OUT_FOR_DELIVERY">OUT FOR DELIVERY</option>
                <option value="COMPLETED">COMPLETED</option>
                <option value="CANCELLED">CANCELLED</option>
              </select>
            </div>

            <div>
              <label className="block font-bold text-neutral-700 mb-1">Payment Method</label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-200 focus:outline-none focus:ring-2 focus:ring-orange-500 font-semibold bg-white"
              >
                <option value="Cash">Cash</option>
                <option value="GCash">GCash</option>
                <option value="COD">COD</option>
              </select>
            </div>
          </div>

          {/* Total Amount & Payment Status */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-neutral-700 mb-1">Total Price (₱)</label>
              <input
                type="number"
                value={total}
                onChange={(e) => setTotal(Number(e.target.value) || 0)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-200 focus:outline-none focus:ring-2 focus:ring-orange-500 font-bold text-orange-600"
                required
              />
            </div>

            <div>
              <label className="block font-bold text-neutral-700 mb-1">Payment Status</label>
              <select
                value={paymentStatus}
                onChange={(e) => setPaymentStatus(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-200 focus:outline-none focus:ring-2 focus:ring-orange-500 font-semibold bg-white"
              >
                <option value="PAID">PAID</option>
                <option value="PENDING">PENDING</option>
              </select>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block font-bold text-neutral-700 mb-1">Order / Admin Notes</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-200 focus:outline-none focus:ring-2 focus:ring-orange-500 font-semibold"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-neutral-100">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl border border-neutral-200 text-neutral-600 font-bold text-xs hover:bg-neutral-100 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-6 py-2.5 rounded-xl bg-[#ff7b00] hover:bg-[#e06c00] text-white font-extrabold text-xs shadow-md shadow-orange-500/20 cursor-pointer transition-all active:scale-95 disabled:opacity-50"
            >
              {isSaving ? 'Saving...' : 'Save & Update Database'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
