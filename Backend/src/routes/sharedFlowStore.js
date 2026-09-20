// Central In-Memory Store Fallback for backend order flow
export const inMemoryOrders = new Map();

/**
 * Normalizes status strings to standard upper-case flow statuses:
 * PENDING -> CONFIRMED -> PREPARING -> READY -> OUT_FOR_DELIVERY -> COMPLETED
 */
export function normalizeFlowStatus(rawStatus) {
  if (!rawStatus) return 'PENDING';
  const upper = String(rawStatus).toUpperCase().trim();
  
  if (['PENDING', 'PENDING_VERIFICATION', 'UNCONFIRMED', 'NEW', 'ORDER PLACED'].includes(upper)) return 'PENDING';
  if (['CONFIRMED', 'PENDING_PREPARATION', 'APPROVED', 'VERIFIED', 'SENT_TO_KITCHEN', 'IN_KITCHEN', 'IN KITCHEN', 'IN_PROCESS'].includes(upper)) return 'CONFIRMED';
  if (['PREPARING', 'COOKING', 'IN_PREPARATION'].includes(upper)) return 'PREPARING';
  if (['READY', 'READY_FOR_PICKUP', 'PREPARED', 'DONE'].includes(upper)) return 'READY';
  if (['OUT_FOR_DELIVERY', 'OUT FOR DELIVERY', 'DISPATCHED', 'ON_THE_WAY', 'IN_TRANSIT'].includes(upper)) return 'OUT_FOR_DELIVERY';
  if (['COMPLETED', 'DELIVERED', 'SERVED'].includes(upper)) return 'COMPLETED';
  if (upper === 'FLAGGED' || upper === 'CANCELLED') return upper;
  
  return 'PENDING';
}

/**
 * Format order record consistently for frontend consumption
 */
export function formatOrderResponse(row) {
  const normStatus = normalizeFlowStatus(row.status);
  const items = Array.isArray(row.items) ? row.items : [];
  
  return {
    id: row.id,
    ref: row.id,
    customerName: row.customer_name || row.customerName || 'Online Customer',
    customer: row.customer_name || row.customerName || 'Online Customer',
    phone: row.customer_phone || row.phone || '0917-000-0000',
    address: row.delivery_address || row.address || 'Delivery Address',
    deliveryAddress: row.delivery_address || row.address || 'Delivery Address',
    paymentMethod: row.payment_method || row.paymentMethod || 'GCash',
    notes: row.notes || '',
    items: items.map(item => ({
      id: item.id || item.product_id || item.menu_item_id,
      name: item.name || item.product_name_snapshot || 'Seafood Dish',
      quantity: item.quantity || 1,
      price: item.price || item.unit_price || 0,
      specialNote: item.specialNote || item.notes || '',
    })),
    subtotal: parseFloat(row.subtotal || 0),
    vat: parseFloat(row.vat || row.tax || 0),
    deliveryFee: parseFloat(row.delivery_fee || row.deliveryFee || 0),
    total: parseFloat(row.total || 0),
    status: normStatus,
    createdAt: row.created_at || row.createdAt || new Date().toISOString(),
    updatedAt: row.updated_at || row.updatedAt || new Date().toISOString(),
  };
}
