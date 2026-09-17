// Central In-Memory Store Fallback for backend order flow
export const inMemoryOrders = new Map();

/**
 * Normalizes status strings to standard upper-case flow statuses:
 * PENDING -> CONFIRMED -> PREPARING -> READY -> OUT_FOR_DELIVERY -> COMPLETED
 */
export function normalizeFlowStatus(rawStatus) {
  if (!rawStatus) return 'PENDING';
  const upper = String(rawStatus).toUpperCase().trim();
  
  if (upper === 'PENDING' || upper === 'PENDING_VERIFICATION' || upper === 'UNCONFIRMED') return 'PENDING';
  if (upper === 'CONFIRMED' || upper === 'PENDING_PREPARATION' || upper === 'APPROVED' || upper === 'IN_KITCHEN' || upper === 'IN KITCHEN') return 'CONFIRMED';
  if (upper === 'PREPARING' || upper === 'COOKING' || upper === 'IN_PROCESS') return 'PREPARING';
  if (upper === 'READY' || upper === 'READY_FOR_PICKUP' || upper === 'PREPARED') return 'READY';
  if (upper === 'OUT_FOR_DELIVERY' || upper === 'DISPATCHED' || upper === 'ON_THE_WAY') return 'OUT_FOR_DELIVERY';
  if (upper === 'COMPLETED' || upper === 'DELIVERED' || upper === 'SERVED') return 'COMPLETED';
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
