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
 * Single Authoritative Financial Ledger Calculation Engine
 */
export function calculateFinancialLedger(payments = [], refunds = [], orderTotal = 0, paymentMethod = 'GCash') {
  const normMethod = (paymentMethod || 'GCash').toUpperCase();
  const isCOD = normMethod === 'COD' || normMethod === 'CASH';

  // 1. Gross Confirmed Payments Received
  let grossConfirmedPaid = 0;
  for (const p of payments) {
    const st = String(p.status || '').toUpperCase();
    const isConfirmed = ['PAID', 'PARTIALLY_REFUNDED'].includes(st)
      || (st === 'REFUNDED' && (p.paid_at || p.paidAt || p.reference_number || p.referenceNumber));
    if (isConfirmed) {
      grossConfirmedPaid += parseFloat(p.amount || 0);
    }
  }
  grossConfirmedPaid = Math.round(grossConfirmedPaid * 100) / 100;

  // 2. Completed Refunds from Authoritative refunds ledger
  let completedRefunds = 0;
  let pendingRefundAmount = 0;
  for (const r of refunds) {
    const rStatus = String(r.status || '').toUpperCase();
    if (rStatus === 'COMPLETED') {
      completedRefunds += parseFloat(r.amount || 0);
    } else if (rStatus === 'PENDING') {
      pendingRefundAmount += parseFloat(r.amount || 0);
    }
  }
  completedRefunds = Math.round(completedRefunds * 100) / 100;
  pendingRefundAmount = Math.round(pendingRefundAmount * 100) / 100;

  // 3. Net Confirmed Paid
  const netConfirmedPaid = Math.max(0, Math.round((grossConfirmedPaid - completedRefunds) * 100) / 100);

  // 4. Pending Additional Payments
  let pendingAdditionalAmount = 0;
  for (const p of payments) {
    const pType = String(p.payment_type || p.paymentType || '').toUpperCase();
    const st = String(p.status || '').toUpperCase();
    if (pType === 'ADDITIONAL' && st === 'PENDING') {
      pendingAdditionalAmount += parseFloat(p.amount || 0);
    }
  }
  pendingAdditionalAmount = Math.round(pendingAdditionalAmount * 100) / 100;

  // 5. Total Balance Comparison
  const currentTotal = Math.round(parseFloat(orderTotal || 0) * 100) / 100;
  const balanceDiff = Math.round((currentTotal - netConfirmedPaid) * 100) / 100;

  let excessAmount = 0;
  let additionalRequired = 0;
  let financialStatus = 'FULLY_PAID';

  if (isCOD) {
    excessAmount = 0;
    additionalRequired = 0;
    financialStatus = 'UNPAID_COD';
  } else if (grossConfirmedPaid === 0) {
    excessAmount = 0;
    additionalRequired = 0;
    financialStatus = 'PENDING_INITIAL_PAYMENT';
  } else if (balanceDiff < 0) {
    excessAmount = Math.abs(balanceDiff);
    additionalRequired = 0;
    financialStatus = pendingRefundAmount > 0 ? 'EXCESS_REFUND_PENDING' : 'EXCESS_REFUND_DUE';
  } else if (balanceDiff > 0) {
    excessAmount = 0;
    additionalRequired = balanceDiff;
    financialStatus = pendingAdditionalAmount > 0 ? 'ADDITIONAL_PAYMENT_PENDING' : 'ADDITIONAL_PAYMENT_REQUIRED';
  } else {
    if (pendingRefundAmount > 0) {
      excessAmount = pendingRefundAmount;
      financialStatus = 'EXCESS_REFUND_PENDING';
    } else {
      excessAmount = 0;
      financialStatus = completedRefunds > 0 ? 'EXCESS_REFUND_COMPLETED' : 'FULLY_PAID';
    }
    additionalRequired = 0;
  }

  return {
    isCOD,
    orderTotal: currentTotal,
    grossConfirmedPaid,
    completedRefunds,
    netConfirmedPaid,
    pendingRefundAmount,
    pendingAdditionalAmount,
    balanceDiff,
    excessAmount,
    additionalRequired,
    financialStatus,
  };
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
  const payments = Array.isArray(row.payments) ? row.payments : [];
  const refunds = Array.isArray(row.refunds) ? row.refunds : [];
  const rawMethod = row.payment_method || row.paymentMethod
    || payments.find(p => p.payment_method)?.payment_method
    || (String(row.status || '').toUpperCase() === 'PENDING_COD' ? 'COD' : 'GCash');
  const paymentMethod = String(rawMethod || 'GCash').toUpperCase().includes('COD') || String(rawMethod || '').toUpperCase() === 'CASH'
    ? 'COD'
    : (rawMethod || 'GCash');

  const formattedItems = items.map(item => ({
    id: item.id || item.product_id || item.menu_item_id,
    productId: item.product_id || item.productId || item.menu_item_id,
    name: item.name || item.product_name_snapshot || 'Seafood Dish',
    quantity: item.quantity || 1,
    price: item.price || item.unit_price || 0,
    item_status: item.item_status || item.itemStatus || 'ACTIVE',
    specialNote: item.specialNote || item.notes || '',
    replacementForItemId: item.replacement_for_item_id || item.replacementForItemId || null,
  }));
  const outOfStockItems = Array.isArray(row.outOfStockItems) ? row.outOfStockItems
    : Array.isArray(row.out_of_stock_items) ? row.out_of_stock_items
    : formattedItems.filter(item => String(item.item_status).toUpperCase() === 'OUT_OF_STOCK');

  let effectiveTotal = parseFloat(row.total || 0);
  if (row.projectedTotal || row.projected_total) {
    effectiveTotal = parseFloat(row.projectedTotal || row.projected_total);
  } else if (normStatus === 'OUT_OF_STOCK' && customerResolution === 'REPLACE' && customerReplacements.length > 0) {
    const activeSubtotal = formattedItems
      .filter(i => String(i.item_status).toUpperCase() === 'ACTIVE')
      .reduce((sum, i) => sum + (Number(i.price || 0) * Number(i.quantity || 1)), 0);
    const replacementSubtotal = customerReplacements
      .reduce((sum, r) => sum + (Number(r.newPrice || 0) * Number(r.quantity || 1)), 0);
    const projSubtotal = Math.round((activeSubtotal + replacementSubtotal) * 100) / 100;
    const projVat = Math.round(projSubtotal * 0.12 * 100) / 100;
    const deliveryFee = parseFloat(row.delivery_fee || row.deliveryFee || 0);
    effectiveTotal = Math.round((projSubtotal + projVat + deliveryFee) * 100) / 100;
  }

  const ledger = calculateFinancialLedger(payments, refunds, effectiveTotal, paymentMethod);

  const refundReceiptFromRefunds = refunds.slice().reverse().find(r => r.refund_receipt || r.refundReceipt)?.refund_receipt
    || refunds.slice().reverse().find(r => r.refund_receipt || r.refundReceipt)?.refundReceipt;
  const refundReferenceFromRefunds = refunds.slice().reverse().find(r => r.reference_number || r.referenceNumber)?.reference_number
    || refunds.slice().reverse().find(r => r.reference_number || r.referenceNumber)?.referenceNumber;

  return {
    id: row.id,
    ref: row.id,
    customerName: row.customer_name || row.customerName || 'Online Customer',
    customer: row.customer_name || row.customerName || 'Online Customer',
    phone: row.customer_phone || row.phone || '0917-000-0000',
    address: row.delivery_address || row.address || 'Delivery Address',
    deliveryAddress: row.delivery_address || row.address || 'Delivery Address',
    deliveryLatitude: row.delivery_latitude ?? row.deliveryLatitude ?? null,
    deliveryLongitude: row.delivery_longitude ?? row.deliveryLongitude ?? null,
    paymentMethod: row.payment_method || row.paymentMethod || 'GCash',
    paymentReceipt: row.payment_receipt || row.paymentReceipt || undefined,
    refundReceipt: row.refund_receipt || row.refundReceipt || refundReceiptFromRefunds || undefined,
    refundReference: row.refund_reference || row.refundReference || refundReferenceFromRefunds || undefined,
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
    total: effectiveTotal,
    status: normStatus,
    outOfStockItems,
    customerResolution,
    customerResolutionStatus,
    customerReplacements,
    financialStatus: ledger.financialStatus,
    netConfirmedPaid: ledger.netConfirmedPaid,
    grossConfirmedPaid: ledger.grossConfirmedPaid,
    completedRefundAmount: ledger.completedRefunds,
    pendingRefundAmount: ledger.pendingRefundAmount,
    additionalRequired: ledger.additionalRequired,
    excessAmount: ledger.excessAmount,
    payments,
    refunds,
    createdAt: row.created_at || row.createdAt || new Date().toISOString(),
    updatedAt: row.updated_at || row.updatedAt || new Date().toISOString(),
  };
}
