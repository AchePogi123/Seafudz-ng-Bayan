// Central In-Memory Store Fallback for backend order flow
export const inMemoryOrders = new Map();

/**
 * Normalizes status strings to standard upper-case flow statuses:
 * PENDING -> CONFIRMED -> PREPARING -> READY -> OUT_FOR_DELIVERY -> COMPLETED
 */
export function normalizeFlowStatus(rawStatus) {
  if (!rawStatus) return 'PENDING';
  const upper = String(rawStatus).toUpperCase().trim();
  
  if (['GCASH_PENDING_APPROVAL', 'GCASH_AUTHORIZED', 'RECEIPT_SUBMITTED', 'RECEIPT_REJECTED', 'PENDING_COD'].includes(upper)) return upper;
  if (['PENDING', 'PENDING_VERIFICATION', 'UNCONFIRMED', 'NEW', 'ORDER PLACED'].includes(upper)) return 'PENDING';
  if (['CONFIRMED', 'PENDING_PREPARATION', 'APPROVED', 'VERIFIED', 'SENT_TO_KITCHEN', 'IN_KITCHEN', 'IN KITCHEN', 'IN_PROCESS'].includes(upper)) return 'CONFIRMED';
  if (['PREPARING', 'COOKING', 'IN_PREPARATION'].includes(upper)) return 'PREPARING';
  if (['READY', 'READY_FOR_PICKUP', 'PREPARED', 'DONE'].includes(upper)) return 'READY';
  if (['OUT_FOR_DELIVERY', 'OUT FOR DELIVERY', 'DISPATCHED', 'ON_THE_WAY', 'IN_TRANSIT'].includes(upper)) return 'OUT_FOR_DELIVERY';
  if (['COMPLETED', 'DELIVERED', 'SERVED'].includes(upper)) return 'COMPLETED';
  if (upper === 'FLAGGED' || upper === 'CANCELLED' || upper === 'OUT_OF_STOCK' || upper === 'OUT OF STOCK') return upper === 'OUT OF STOCK' ? 'OUT_OF_STOCK' : upper;
  
  return 'PENDING';
}

/**
 * Format order record consistently for frontend consumption
 */
export function formatOrderResponse(row) {
  const normStatus = normalizeFlowStatus(row.status);
  const items = Array.isArray(row.items) ? row.items : [];
  const isBulk = false;
  const isReceiptPrinted = Boolean(row.is_receipt_printed || row.isReceiptPrinted || row.receipt_printed || row.receiptStatus === 'PRINTED' || row.receipt_status === 'PRINTED');
  const receiptStatus = isReceiptPrinted ? 'PRINTED' : (row.receipt_status || row.receiptStatus || 'UNPRINTED');
  const customerResolution = row.customer_resolution || row.customerResolution || null;
  const rawResolutionStatus = row.customer_resolution_status || row.customerResolutionStatus;
  const customerResolutionStatus = rawResolutionStatus && rawResolutionStatus !== 'NONE'
    ? rawResolutionStatus
    : normStatus === 'OUT_OF_STOCK'
      ? customerResolution ? 'PENDING_ASSISTANT' : 'AWAITING_CUSTOMER'
      : 'NONE';
  const rawReplacements = row.customer_replacements ?? row.customerReplacements;
  let customerReplacements = Array.isArray(rawReplacements) ? rawReplacements : [];
  if (typeof rawReplacements === 'string') {
    try { customerReplacements = JSON.parse(rawReplacements); } catch { customerReplacements = []; }
  }
  if (!Array.isArray(customerReplacements)) customerReplacements = [];
  const formattedItems = items.map(item => ({
    id: item.id || item.product_id || item.menu_item_id,
    productId: item.product_id || item.productId || item.menu_item_id,
    name: item.name || item.product_name_snapshot || 'Seafood Dish',
    quantity: item.quantity || 1,
    price: item.price || item.unit_price || 0,
    item_status: item.item_status || item.itemStatus || 'ACTIVE',
    specialNote: item.specialNote || item.notes || '',
  }));
  const outOfStockItems = Array.isArray(row.outOfStockItems) ? row.outOfStockItems
    : Array.isArray(row.out_of_stock_items) ? row.out_of_stock_items
    : formattedItems.filter(item => String(item.item_status).toUpperCase() === 'OUT_OF_STOCK');

  return {
    id: row.id,
    ref: row.id,
    customerName: row.customer_name || row.customerName || 'Online Customer',
    customer: row.customer_name || row.customerName || 'Online Customer',
    phone: row.customer_phone || row.phone || '0917-000-0000',
    address: row.delivery_address || row.address || 'Delivery Address',
    deliveryAddress: row.delivery_address || row.address || 'Delivery Address',
    paymentMethod: row.payment_method || row.paymentMethod || 'GCash',
    paymentReceipt: row.payment_receipt || row.paymentReceipt || undefined,
    refundReceipt: row.refund_receipt || row.refundReceipt || undefined,
    refundReference: row.refund_reference || row.refundReference || undefined,
    gcashAuthorized: Boolean(row.gcash_authorized || row.gcashAuthorized || normStatus === 'GCASH_AUTHORIZED'),
    gcash_authorized: Boolean(row.gcash_authorized || row.gcashAuthorized || normStatus === 'GCASH_AUTHORIZED'),
    receiptStatus: receiptStatus,
    isReceiptPrinted: isReceiptPrinted,
    is_receipt_printed: isReceiptPrinted,
    rejectionReason: row.rejection_reason || row.rejectionReason || '',
    isBulk: false,
    is_bulk: false,
    notes: row.notes || '',
    items: formattedItems,
    subtotal: parseFloat(row.subtotal || 0),
    vat: parseFloat(row.vat || row.tax || 0),
    deliveryFee: parseFloat(row.delivery_fee || row.deliveryFee || 0),
    total: parseFloat(row.total || 0),
    status: normStatus,
    outOfStockItems,
    customerResolution,
    customerResolutionStatus,
    customerReplacements,
    createdAt: row.created_at || row.createdAt || new Date().toISOString(),
    updatedAt: row.updated_at || row.updatedAt || new Date().toISOString(),
  };
}

