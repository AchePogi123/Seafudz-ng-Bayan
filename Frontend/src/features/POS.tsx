import React, { useState, useMemo } from 'react'
import { CategoryTabs } from '../components/CategoryTabs'
import { MenuGrid } from '../components/MenuGrid'
import { OrderSummary } from '../components/OrderSummary'
import { SuccessModal } from '../components/SuccessModal'
import { ReceiptModal } from './ReceiptModal'
import { CLIENT_MENU_ITEMS, CLIENT_CATEGORIES } from '../components/MenuCard'
import type { MenuItem } from '../components/MenuCard'
import type { CartItem } from '../components/OrderItemRow'
import { API_BASE_URL } from '../utils/api'
import { useMenuPrices } from '../utils/menuPriceManager'
import { NavbarCashier } from '../components/NavbarCashier'

export const POS: React.FC = () => {
  const { getEffectivePrice, updatePrice } = useMenuPrices()

  const [menuItems] = useState<MenuItem[]>(CLIENT_MENU_ITEMS)
  const [categories] = useState<string[]>(CLIENT_CATEGORIES)

  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('All Menu')
  const [cartItems, setCartItems] = useState<CartItem[]>([])
  const [orderType, setOrderType] = useState('Take Out')
  const [orderNotes, setOrderNotes] = useState('')
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false)
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false)
  const [isMobileCartOpen, setIsMobileCartOpen] = useState(false)

  const [lastOrderDetails, setLastOrderDetails] = useState<{
    table: string
    type: string
    total: number
    cartItems: CartItem[]
    notes?: string
    cashReceived?: string
    change?: number | null
    paymentMethod?: string
  } | null>(null)

  const totalCartCount = useMemo(() => {
    return cartItems.reduce((acc, item) => acc + item.quantity, 0)
  }, [cartItems])

  const totalCartPrice = useMemo(() => {
    const rawSubtotal = cartItems.reduce((acc, item) => acc + item.item.price * item.quantity, 0)
    return Math.round(rawSubtotal * 1.12)
  }, [cartItems])

  const filteredItems = useMemo(() => {
    return menuItems
      .map((item) => ({
        ...item,
        price: getEffectivePrice(item.id, item.price),
      }))
      .filter((item) => {
        const matchesSearch =
          item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          item.description.toLowerCase().includes(searchQuery.toLowerCase())

        const matchesCategory =
          selectedCategory === 'All Menu' || item.category.toLowerCase() === selectedCategory.toLowerCase()

        return matchesSearch && matchesCategory
      })
  }, [menuItems, searchQuery, selectedCategory, getEffectivePrice])

  const handlePriceUpdate = (item: MenuItem, newPrice: number) => {
    updatePrice(item.id, newPrice)
    setCartItems((prev) =>
      prev.map((ci) =>
        ci.item.id === item.id ? { ...ci, item: { ...ci.item, price: newPrice } } : ci
      )
    )
  }

  const handleAddToCart = (item: MenuItem) => {
    setCartItems((prevItems) => {
      const existing = prevItems.find((ci) => ci.item.id === item.id)
      if (existing) {
        return prevItems.map((ci) =>
          ci.item.id === item.id ? { ...ci, quantity: ci.quantity + 1 } : ci
        )
      }
      return [...prevItems, { item, quantity: 1 }]
    })
  }

  const handleIncrement = (itemId: string) => {
    setCartItems((prevItems) =>
      prevItems.map((ci) =>
        ci.item.id === itemId ? { ...ci, quantity: ci.quantity + 1 } : ci
      )
    )
  }

  const handleDecrement = (itemId: string) => {
    setCartItems((prevItems) =>
      prevItems
        .map((ci) =>
          ci.item.id === itemId ? { ...ci, quantity: ci.quantity - 1 } : ci
        )
        .filter((ci) => ci.quantity > 0)
    )
  }

  const handleRemove = (itemId: string) => {
    setCartItems((prevItems) => prevItems.filter((ci) => ci.item.id !== itemId))
  }

  const handleConfirmOrder = () => {
    if (cartItems.length === 0) return

    const rawSubtotal = cartItems.reduce((acc, ci) => acc + ci.item.price * ci.quantity, 0)
    const totalWithVat = Math.round(rawSubtotal * 1.12)

    setLastOrderDetails({
      table: 'N/A',
      type: orderType,
      total: totalWithVat,
      cartItems: [...cartItems],
      notes: orderNotes,
    })
    setIsMobileCartOpen(false)
    setIsSuccessModalOpen(true)
  }

  const handleCloseSuccessModal = () => {
    setCartItems([])
    setOrderNotes('')
    setIsSuccessModalOpen(false)
    setLastOrderDetails(null)
  }

  const handleConfirmPayment = async (cashReceived: string, change: number | null, paymentMethod: string) => {
    const rawSubtotal = cartItems.reduce((acc, ci) => acc + ci.item.price * ci.quantity, 0)
    const vat = rawSubtotal * 0.12
    const total = Math.round(rawSubtotal + vat)
    const orderId = `POS-${Date.now().toString().slice(-4)}`

    const posOrderPayload = {
      isPosOrder: true,
      status: 'PENDING',
      orderType: orderType === 'Dine In' ? 'DINE_IN' : 'TAKE_OUT',
      type: orderType,
      paymentMethod,
      notes: orderNotes, // Pass special kitchen notes (e.g., "Extra Spicy")
      subtotal: rawSubtotal,
      vat: Math.round(vat),
      deliveryFee: 0,
      total,
      cartItems: cartItems.map((ci) => ({
        productId: ci.item.id,
        name: ci.item.name,
        unit_price: ci.item.price,
        quantity: ci.quantity,
        notes: orderNotes || null,
        item: ci.item
      })),
    }

    try {
      await fetch(`${API_BASE_URL}/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(posOrderPayload),
      })
    } catch (err) {
      console.error('POS order API error:', err)
    }

    // Save to local storage with special notes included
    const localOrderObj = {
      id: orderId,
      ref: orderId,
      dateTime: new Date().toLocaleString(),
      type: orderType,
      status: 'In Kitchen',
      paymentStatus: 'Paid',
      customer: 'Walk-In',
      items: cartItems.map((ci) => `${ci.item.name} x${ci.quantity}`).join(', '),
      notes: orderNotes,
      total,
      paymentMethod,
      cartItems: [...cartItems],
    }

    try {
      const existing = JSON.parse(localStorage.getItem('seafudz_orders') || '[]')
      localStorage.setItem('seafudz_orders', JSON.stringify([localOrderObj, ...existing]))
      window.dispatchEvent(new Event('seafudz_order_created'))
    } catch (e) {
      console.warn('LocalStorage save warning:', e)
    }

    setLastOrderDetails({
      table: 'N/A',
      type: orderType,
      total,
      cartItems: [...cartItems],
      notes: orderNotes,
      cashReceived,
      change,
      paymentMethod,
    })

    setIsSuccessModalOpen(false)
    setIsReceiptModalOpen(true)
  }

  const handleCloseReceiptModal = () => {
    setIsReceiptModalOpen(false)
    setCartItems([])
    setOrderNotes('')
    setOrderType('Take Out')
    setLastOrderDetails(null)
  }

  return (
    <div className="min-h-screen bg-[#f8f6f4] p-3 sm:p-4 lg:p-4 transition-all duration-300 pb-24 lg:pb-6">
      <div className="w-full flex flex-col gap-4 sm:gap-6">
        <NavbarCashier searchQuery={searchQuery} setSearchQuery={setSearchQuery} />

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 sm:gap-6 items-start">
          <main className="lg:col-span-3 flex flex-col gap-4 sm:gap-6">
            <CategoryTabs
              selectedCategory={selectedCategory}
              setSelectedCategory={setSelectedCategory}
              categories={categories}
            />

            <section className="flex-grow">
              <MenuGrid
                items={filteredItems}
                onAddToCart={handleAddToCart}
                showAvailabilityToggle={true}
                allowPriceEdit={true}
                onUpdatePrice={handlePriceUpdate}
              />
            </section>
          </main>

          <div className="hidden lg:block lg:col-span-1 lg:sticky lg:top-6 h-full">
            <OrderSummary
              cartItems={cartItems}
              orderType={orderType}
              setOrderType={setOrderType}
              orderNotes={orderNotes}
              setOrderNotes={setOrderNotes}
              onIncrement={handleIncrement}
              onDecrement={handleDecrement}
              onRemove={handleRemove}
              onConfirmOrder={handleConfirmOrder}
            />
          </div>
        </div>
      </div>

      {cartItems.length > 0 && (
        <div className="fixed bottom-3 left-3 right-3 lg:hidden z-40">
          <button
            onClick={() => setIsMobileCartOpen(true)}
            className="w-full bg-orange-600 hover:bg-orange-700 text-white font-semibold py-3 px-4 rounded-xl shadow-lg flex items-center justify-between transition-all active:scale-98 cursor-pointer"
          >
            <div className="flex items-center gap-2.5">
              <span className="bg-white/20 px-2 py-0.5 rounded-lg text-xs font-bold">
                {totalCartCount} {totalCartCount === 1 ? 'item' : 'items'}
              </span>
              <span className="text-sm font-medium">View Order</span>
            </div>
            <span className="text-sm font-bold">
              ₱{totalCartPrice.toLocaleString()}
            </span>
          </button>
        </div>
      )}

      {isMobileCartOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 lg:hidden flex flex-col justify-end p-0 sm:p-4 animate-fade-in">
          <div className="w-full max-h-[85vh] h-[85vh] rounded-t-3xl sm:rounded-3xl overflow-hidden shadow-2xl animate-slide-up">
            <OrderSummary
              cartItems={cartItems}
              orderType={orderType}
              setOrderType={setOrderType}
              orderNotes={orderNotes}
              setOrderNotes={setOrderNotes}
              onIncrement={handleIncrement}
              onDecrement={handleDecrement}
              onRemove={handleRemove}
              onConfirmOrder={handleConfirmOrder}
              onClose={() => setIsMobileCartOpen(false)}
            />
          </div>
        </div>
      )}

      <SuccessModal
        isOpen={isSuccessModalOpen}
        onClose={handleCloseSuccessModal}
        onConfirm={handleConfirmPayment}
        orderDetails={lastOrderDetails}
      />

      <ReceiptModal
        isOpen={isReceiptModalOpen}
        onClose={handleCloseReceiptModal}
        orderDetails={lastOrderDetails}
      />
    </div>
  )
}

export default POS