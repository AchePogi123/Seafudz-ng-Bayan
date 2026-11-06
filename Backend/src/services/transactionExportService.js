import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { query } from '../config/db.js';
import { MANILA_TIMEZONE, formatManilaDateTime, getManilaTimestampString } from './backupService.js';

/**
 * Formats a Date object into Manila YYYY-MM-DD HH:mm:ss string
 */
export function formatManilaIso(date) {
  if (!date) return 'N/A';
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return 'N/A';

  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: MANILA_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(d).reduce((acc, p) => ({ ...acc, [p.type]: p.value }), {});

  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second}`;
}

/**
 * Shared database querying and data normalization for transaction exports
 */
export async function fetchHistoricalTransactionsData({
  startDate = null,
  endDate = null,
  period = 'all',
  channel = 'all',
} = {}) {
  let dateFilter = '';
  const dateParams = [];
  let pIdx = 1;

  const normalizedPeriod = (period || '').toLowerCase().trim();

  if (normalizedPeriod === 'today' || normalizedPeriod === '1d') {
    dateFilter = ` AND o.created_at >= (((NOW() AT TIME ZONE 'Asia/Manila')::date)::timestamp AT TIME ZONE 'Asia/Manila') AND o.created_at < ((((NOW() AT TIME ZONE 'Asia/Manila')::date + 1))::timestamp AT TIME ZONE 'Asia/Manila')`;
  } else if (normalizedPeriod === 'this week' || normalizedPeriod === 'week' || normalizedPeriod === '1w') {
    dateFilter = ` AND o.created_at >= ((((NOW() AT TIME ZONE 'Asia/Manila')::date - INTERVAL '6 days'))::timestamp AT TIME ZONE 'Asia/Manila') AND o.created_at < ((((NOW() AT TIME ZONE 'Asia/Manila')::date + 1))::timestamp AT TIME ZONE 'Asia/Manila')`;
  } else if (normalizedPeriod === 'this month' || normalizedPeriod === 'month' || normalizedPeriod === '1m') {
    dateFilter = ` AND o.created_at >= (DATE_TRUNC('month', NOW() AT TIME ZONE 'Asia/Manila') AT TIME ZONE 'Asia/Manila') AND o.created_at < ((((NOW() AT TIME ZONE 'Asia/Manila')::date + 1))::timestamp AT TIME ZONE 'Asia/Manila')`;
  } else if (normalizedPeriod === 'this year' || normalizedPeriod === 'year' || normalizedPeriod === '1y') {
    dateFilter = ` AND o.created_at >= (DATE_TRUNC('year', NOW() AT TIME ZONE 'Asia/Manila') AT TIME ZONE 'Asia/Manila') AND o.created_at < ((((NOW() AT TIME ZONE 'Asia/Manila')::date + 1))::timestamp AT TIME ZONE 'Asia/Manila')`;
  } else if (startDate || endDate) {
    if (startDate && /^\d{4}-\d{2}-\d{2}$/.test(String(startDate).trim())) {
      dateFilter += ` AND o.created_at >= (($${pIdx++}::date)::timestamp AT TIME ZONE 'Asia/Manila')`;
      dateParams.push(String(startDate).trim());
    }
    if (endDate && /^\d{4}-\d{2}-\d{2}$/.test(String(endDate).trim())) {
      dateFilter += ` AND o.created_at < ((($${pIdx++}::date + 1))::timestamp AT TIME ZONE 'Asia/Manila')`;
      dateParams.push(String(endDate).trim());
    }
  }

  // Channel filter
  let channelFilter = '';
  if (channel && channel.toLowerCase() !== 'all') {
    const c = channel.toLowerCase();
    if (c.includes('pos') || c.includes('on_site') || c.includes('walk')) {
      channelFilter = ` AND LOWER(o.order_type) IN ('on_site', 'pos', 'walk-in', 'on-site', 'pos order')`;
    } else if (c.includes('online') || c.includes('delivery')) {
      channelFilter = ` AND LOWER(o.order_type) IN ('online', 'delivery', 'online customer', 'online order')`;
    }
  }

  const dateRangeLabel =
    normalizedPeriod === 'today'
      ? 'Today'
      : normalizedPeriod === 'week'
      ? 'This Week'
      : normalizedPeriod === 'month'
      ? 'This Month'
      : normalizedPeriod === 'year'
      ? 'This Year'
      : startDate || endDate
      ? `${startDate || 'Earliest'} to ${endDate || 'Latest'}`
      : 'All Available Historical Records';

  // 1. Fetch Orders with Customer, Cashier, and Delivery details
  const ordersSql = `
    SELECT 
      o.id AS order_id,
      o.created_at,
      o.order_type,
      o.table_id,
      o.status AS order_status,
      COALESCE(o.subtotal, 0)::float AS subtotal,
      COALESCE(o.tax, 0)::float AS tax,
      COALESCE(o.delivery_fee, 0)::float AS delivery_fee,
      COALESCE(o.total, 0)::float AS total,
      o.notes AS order_notes,
      o.cancelled_at,
      o.customer_resolution,
      o.customer_resolution_status,
      o.customer_replacements,
      c.fullname AS customer_name,
      c.phone AS customer_phone,
      e.fullname AS cashier_name,
      d.delivery_address,
      d.status AS delivery_status
    FROM orders o
    LEFT JOIN customers c ON o.customer_id = c.id
    LEFT JOIN employees e ON o.cashier_id = e.id
    LEFT JOIN (
      SELECT DISTINCT ON (order_id) order_id, delivery_address, status
      FROM deliveries
      ORDER BY order_id, created_at DESC
    ) d ON o.id = d.order_id
    WHERE 1=1 ${dateFilter} ${channelFilter}
    ORDER BY o.created_at DESC;
  `;

  const ordersRes = await query(ordersSql, dateParams);
  const orders = ordersRes.rows;

  if (orders.length === 0) {
    return {
      orders: [],
      itemsRes: { rows: [] },
      paymentsRes: { rows: [] },
      refundsRes: { rows: [] },
      itemsByOrder: new Map(),
      paymentsByOrder: new Map(),
      refundsByOrder: new Map(),
      dateRangeLabel,
      normalizedPeriod,
    };
  }

  const orderIds = orders.map((o) => o.order_id);

  // 2. Fetch Order Items
  const itemsSql = `
    SELECT 
      id,
      order_id,
      product_name_snapshot,
      COALESCE(unit_price, 0)::float AS unit_price,
      quantity,
      COALESCE(subtotal, 0)::float AS subtotal,
      item_status,
      replacement_for_item_id,
      notes
    FROM order_items
    WHERE order_id = ANY($1)
    ORDER BY order_id, id ASC;
  `;
  const itemsRes = await query(itemsSql, [orderIds]);

  const itemsByOrder = new Map();
  itemsRes.rows.forEach((it) => {
    if (!itemsByOrder.has(it.order_id)) itemsByOrder.set(it.order_id, []);
    itemsByOrder.get(it.order_id).push(it);
  });

  // 3. Fetch Payments
  const paymentsSql = `
    SELECT 
      id,
      order_id,
      payment_method,
      COALESCE(amount, 0)::float AS amount,
      status,
      reference_number,
      COALESCE(refunded_amount, 0)::float AS refunded_amount,
      paid_at
    FROM payments
    WHERE order_id = ANY($1)
    ORDER BY order_id, created_at DESC;
  `;
  const paymentsRes = await query(paymentsSql, [orderIds]);

  const paymentsByOrder = new Map();
  paymentsRes.rows.forEach((pm) => {
    if (!paymentsByOrder.has(pm.order_id)) paymentsByOrder.set(pm.order_id, []);
    paymentsByOrder.get(pm.order_id).push(pm);
  });

  // 4. Fetch Refunds
  const refundsSql = `
    SELECT 
      id,
      order_id,
      COALESCE(amount, 0)::float AS amount,
      status,
      reason,
      reference_number,
      completed_at
    FROM refunds
    WHERE order_id = ANY($1)
    ORDER BY order_id, created_at DESC;
  `;
  const refundsRes = await query(refundsSql, [orderIds]);

  const refundsByOrder = new Map();
  refundsRes.rows.forEach((rf) => {
    if (!refundsByOrder.has(rf.order_id)) refundsByOrder.set(rf.order_id, []);
    refundsByOrder.get(rf.order_id).push(rf);
  });

  return {
    orders,
    itemsRes,
    paymentsRes,
    refundsRes,
    itemsByOrder,
    paymentsByOrder,
    refundsByOrder,
    dateRangeLabel,
    normalizedPeriod,
  };
}

/**
 * Builds an Excel workbook containing historical transactions, itemized breakdown,
 * and executive financial summary.
 */
export async function generateTransactionsExcel({
  startDate = null,
  endDate = null,
  period = 'all',
  channel = 'all',
  adminEmail = 'Administrator',
} = {}) {
  const data = await fetchHistoricalTransactionsData({ startDate, endDate, period, channel });
  const { orders, itemsRes, paymentsByOrder, refundsByOrder, itemsByOrder, dateRangeLabel, normalizedPeriod } = data;

  if (orders.length === 0) {
    // Generate empty workbook with notice
    const wb = new ExcelJS.Workbook();
    wb.creator = 'Seafudz ng Bayan POS System';
    const ws = wb.addWorksheet('Transactions Ledger');
    ws.addRow(['No historical transactions found matching the selected criteria.']);
    const buffer = await wb.xlsx.writeBuffer();
    return {
      buffer,
      totalRecords: 0,
      filename: `seafudz_transactions_${getManilaTimestampString()}.xlsx`,
    };
  }

  // Build Excel Workbook
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Seafudz ng Bayan POS System';
  workbook.lastModifiedBy = adminEmail;
  workbook.created = new Date();
  workbook.modified = new Date();

  // -------------------------------------------------------------
  // Sheet 1: Transactions Ledger
  // -------------------------------------------------------------
  const ledgerWs = workbook.addWorksheet('Transactions Ledger', {
    views: [{ state: 'frozen', ySplit: 5 }],
  });

  // Title Banner
  ledgerWs.mergeCells('A1:T1');
  const titleCell = ledgerWs.getCell('A1');
  titleCell.value = 'SEAFUDZ NG BAYAN — HISTORICAL TRANSACTIONS AUDIT LEDGER';
  titleCell.font = { name: 'Calibri', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEA580C' } }; // Orange-600
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  ledgerWs.getRow(1).height = 30;

  // Metadata Banner
  ledgerWs.mergeCells('A2:T2');
  const metaCell = ledgerWs.getCell('A2');

  metaCell.value = `Period: ${dateRangeLabel} | Generated: ${formatManilaDateTime(new Date())} (Asia/Manila) | Total Orders: ${orders.length} | Exported By: ${adminEmail}`;
  metaCell.font = { name: 'Calibri', size: 10, italic: true, color: { argb: 'FF475569' } };
  metaCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
  metaCell.alignment = { horizontal: 'left', vertical: 'middle' };
  ledgerWs.getRow(2).height = 20;

  // Notice Row
  ledgerWs.mergeCells('A3:T3');
  const noticeCell = ledgerWs.getCell('A3');
  noticeCell.value = 'Notice: This Excel document is for accounting audit and inspection. For full disaster recovery or database re-installation, use the compressed database snapshot (.sql.gz) in Database Backups.';
  noticeCell.font = { name: 'Calibri', size: 9, bold: true, color: { argb: 'FF94A3B8' } };
  noticeCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
  noticeCell.alignment = { horizontal: 'left', vertical: 'middle' };
  ledgerWs.getRow(3).height = 18;

  // Empty separator row
  ledgerWs.getRow(4).height = 8;

  // Table Column Headers (Row 5)
  const columns = [
    { header: 'Order Ref #', key: 'order_id', width: 28 },
    { header: 'Transaction Date (Manila)', key: 'date_time', width: 22 },
    { header: 'Channel', key: 'channel', width: 16 },
    { header: 'Table / Delivery Address', key: 'destination', width: 30 },
    { header: 'Customer Name', key: 'customer', width: 22 },
    { header: 'Staff / Cashier', key: 'cashier', width: 20 },
    { header: 'Order Status', key: 'order_status', width: 16 },
    { header: 'Cancellation Details', key: 'cancellation_details', width: 26 },
    { header: 'Ordered Items Summary', key: 'items_summary', width: 45 },
    { header: 'Total Units', key: 'total_units', width: 12 },
    { header: 'Subtotal (₱)', key: 'subtotal', width: 16 },
    { header: '12% VAT (₱)', key: 'tax', width: 15 },
    { header: 'Delivery Fee (₱)', key: 'delivery_fee', width: 16 },
    { header: 'Gross Total (₱)', key: 'total', width: 18 },
    { header: 'Payment Method', key: 'payment_method', width: 18 },
    { header: 'Payment Status', key: 'payment_status', width: 16 },
    { header: 'Payment Ref #', key: 'payment_ref', width: 20 },
    { header: 'Refund Amount (₱)', key: 'refund_amount', width: 18 },
    { header: 'Refund Status & Reason', key: 'refund_reason', width: 32 },
    { header: 'Replacement / Exchange', key: 'replacement_details', width: 30 },
  ];

  ledgerWs.columns = columns;

  const headerRow = ledgerWs.getRow(5);
  headerRow.values = columns.map((c) => c.header);
  headerRow.height = 26;
  headerRow.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } }; // Slate-800
  headerRow.alignment = { vertical: 'middle', horizontal: 'center' };

  // Data Rows
  let startDataRow = 6;
  let runningSubtotal = 0;
  let runningTax = 0;
  let runningDelivery = 0;
  let runningGross = 0;
  let runningRefunds = 0;

  orders.forEach((ord, idx) => {
    const items = itemsByOrder.get(ord.order_id) || [];
    const payments = paymentsByOrder.get(ord.order_id) || [];
    const refunds = refundsByOrder.get(ord.order_id) || [];

    // Items summary
    const itemsSummary = items
      .map((i) => `${i.product_name_snapshot || 'Item'} x${i.quantity || 1}`)
      .join(', ') || 'No Items Recorded';
    const totalUnits = items.reduce((sum, i) => sum + (Number(i.quantity) || 0), 0);

    // Replacements
    const replacementItems = items.filter((i) => i.replacement_for_item_id || i.item_status === 'REPLACED');
    let replacementDetails = 'None';
    if (replacementItems.length > 0) {
      replacementDetails = replacementItems
        .map((r) => `${r.product_name_snapshot} (Status: ${r.item_status})`)
        .join(', ');
    } else if (ord.customer_replacements && typeof ord.customer_replacements === 'object') {
      try {
        replacementDetails = JSON.stringify(ord.customer_replacements);
      } catch {}
    }

    // Payments summary
    const paymentMethods = payments.map((p) => p.payment_method).filter(Boolean);
    const paymentMethodStr = paymentMethods.length > 0 ? Array.from(new Set(paymentMethods)).join(' / ') : 'Cash';
    const paymentStatusStr = payments.length > 0 ? payments[0].status || 'COMPLETED' : 'PAID';
    const paymentRefs = payments.map((p) => p.reference_number).filter(Boolean);
    const paymentRefStr = paymentRefs.length > 0 ? paymentRefs.join(', ') : 'N/A';

    // Refunds summary
    const refundTotal = refunds.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
    const refundReasons = refunds.map((r) => `${r.status}: ${r.reason || 'General Refund'}`).join('; ') || 'None';

    // Channel formatting
    const fulfillment = (ord.fulfillment_type || ord.fulfillmentType || '').toUpperCase();
    const rawType = (ord.order_type || '').toUpperCase();
    const channelLabel = fulfillment === 'PICKUP'
      ? 'Store Pick-Up'
      : (rawType.includes('ONLINE') || rawType.includes('DELIVERY') ? 'Online Delivery' : 'POS Walk-In');

    // Destination
    const destination = ord.table_id ? `Table ${ord.table_id}` : ord.delivery_address || (fulfillment === 'PICKUP' ? 'Store Counter (Pick-Up)' : (channelLabel === 'Online Delivery' ? 'Online Customer' : 'Dine-In / Takeout'));

    // Customer name protection
    const customer = ord.customer_name || (channelLabel === 'Online Delivery' || channelLabel === 'Store Pick-Up' ? 'Online Customer' : '—');

    // Staff
    const staff = ord.cashier_name || (channelLabel === 'Online Delivery' ? 'Online Direct' : 'Cashier');

    // Cancellation details
    let cancellationStr = 'N/A';
    if (ord.order_status === 'CANCELLED' || ord.cancelled_at) {
      cancellationStr = `Cancelled ${ord.cancelled_at ? formatManilaIso(ord.cancelled_at) : ''} (${ord.customer_resolution_status || 'CANCELLED'})`;
    } else if (ord.order_status === 'KITCHEN_REJECTED') {
      cancellationStr = 'Declined by Kitchen (Quantity Exceeded)';
    }

    const row = ledgerWs.addRow({
      order_id: ord.order_id,
      date_time: formatManilaIso(ord.created_at),
      channel: channelLabel,
      destination,
      customer,
      cashier: staff,
      order_status: ord.order_status,
      cancellation_details: cancellationStr,
      items_summary: itemsSummary,
      total_units: totalUnits,
      subtotal: ord.subtotal,
      tax: ord.tax,
      delivery_fee: ord.delivery_fee,
      total: ord.total,
      payment_method: paymentMethodStr,
      payment_status: paymentStatusStr,
      payment_ref: paymentRefStr,
      refund_amount: refundTotal,
      refund_reason: refundReasons,
      replacement_details: replacementDetails,
    });

    runningSubtotal += ord.subtotal;
    runningTax += ord.tax;
    runningDelivery += ord.delivery_fee;
    runningGross += ord.total;
    runningRefunds += refundTotal;

    row.height = 20;
    row.font = { name: 'Calibri', size: 9 };

    // Zebra striping
    if (idx % 2 === 1) {
      row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
    }

    // Alignment and Number Formatting
    row.getCell('order_id').font = { name: 'Consolas', size: 9, bold: true };
    row.getCell('order_id').alignment = { horizontal: 'left', vertical: 'middle' };
    row.getCell('date_time').alignment = { horizontal: 'center', vertical: 'middle' };
    row.getCell('channel').alignment = { horizontal: 'center', vertical: 'middle' };
    row.getCell('total_units').alignment = { horizontal: 'right', vertical: 'middle' };
    row.getCell('total_units').numFmt = '#,##0';

    // Currency columns
    ['subtotal', 'tax', 'delivery_fee', 'total', 'refund_amount'].forEach((k) => {
      const c = row.getCell(k);
      c.numFmt = '"₱"#,##0.00';
      c.alignment = { horizontal: 'right', vertical: 'middle' };
    });

    row.getCell('total').font = { name: 'Calibri', size: 9, bold: true };

    // Status highlighting
    const statusCell = row.getCell('order_status');
    statusCell.alignment = { horizontal: 'center', vertical: 'middle' };
    if (ord.order_status === 'COMPLETED') {
      statusCell.font = { color: { argb: 'FF15803D' }, bold: true }; // Green
    } else if (ord.order_status === 'CANCELLED' || ord.order_status === 'KITCHEN_REJECTED') {
      statusCell.font = { color: { argb: 'FFB91C1C' }, bold: true }; // Red
    }
  });

  // Summary Total Row
  const totalRowIndex = startDataRow + orders.length;
  const totalRow = ledgerWs.addRow({
    order_id: 'TOTAL AUDIT SUMMARY',
    date_time: '',
    channel: '',
    destination: '',
    customer: '',
    cashier: '',
    order_status: '',
    cancellation_details: '',
    items_summary: `Records: ${orders.length}`,
    total_units: { formula: `SUM(J6:J${totalRowIndex - 1})` },
    subtotal: { formula: `SUM(K6:K${totalRowIndex - 1})` },
    tax: { formula: `SUM(L6:L${totalRowIndex - 1})` },
    delivery_fee: { formula: `SUM(M6:M${totalRowIndex - 1})` },
    total: { formula: `SUM(N6:N${totalRowIndex - 1})` },
    payment_method: '',
    payment_status: '',
    payment_ref: '',
    refund_amount: { formula: `SUM(R6:R${totalRowIndex - 1})` },
    refund_reason: '',
    replacement_details: '',
  });

  totalRow.height = 24;
  totalRow.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF0F172A' } };
  totalRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFDE047' } }; // Light Yellow
  totalRow.alignment = { vertical: 'middle' };
  ['subtotal', 'tax', 'delivery_fee', 'total', 'refund_amount'].forEach((k) => {
    const c = totalRow.getCell(k);
    c.numFmt = '"₱"#,##0.00';
    c.alignment = { horizontal: 'right', vertical: 'middle' };
  });

  // -------------------------------------------------------------
  // Sheet 2: Itemized Breakdown
  // -------------------------------------------------------------
  const itemsWs = workbook.addWorksheet('Itemized Breakdown', {
    views: [{ state: 'frozen', ySplit: 3 }],
  });

  itemsWs.mergeCells('A1:J1');
  const itemsTitle = itemsWs.getCell('A1');
  itemsTitle.value = 'SEAFUDZ NG BAYAN — ITEMIZED DISH & INVENTORY SALES BREAKDOWN';
  itemsTitle.font = { name: 'Calibri', size: 12, bold: true, color: { argb: 'FFFFFFFF' } };
  itemsTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0284C7' } }; // Sky-600
  itemsTitle.alignment = { horizontal: 'center', vertical: 'middle' };
  itemsWs.getRow(1).height = 25;

  itemsWs.mergeCells('A2:J2');
  const itemsMeta = itemsWs.getCell('A2');
  itemsMeta.value = `Line items breakdown for accounting and sales volume audit. Matching orders: ${orders.length} | Items: ${itemsRes.rows.length}`;
  itemsMeta.font = { name: 'Calibri', size: 9, italic: true, color: { argb: 'FF475569' } };
  itemsMeta.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
  itemsWs.getRow(2).height = 18;

  const itemCols = [
    { header: 'Order Ref #', key: 'order_id', width: 28 },
    { header: 'Order Date (Manila)', key: 'date_time', width: 20 },
    { header: 'Product Name', key: 'product_name', width: 32 },
    { header: 'Unit Price (₱)', key: 'unit_price', width: 16 },
    { header: 'Quantity', key: 'quantity', width: 12 },
    { header: 'Line Subtotal (₱)', key: 'subtotal', width: 18 },
    { header: 'Item Status', key: 'item_status', width: 16 },
    { header: 'Replacement For Item ID', key: 'replacement_id', width: 25 },
    { header: 'Item Special Notes', key: 'notes', width: 28 },
    { header: 'Parent Order Status', key: 'order_status', width: 18 },
  ];

  itemsWs.columns = itemCols;
  const itemHeaderRow = itemsWs.getRow(3);
  itemHeaderRow.values = itemCols.map((c) => c.header);
  itemHeaderRow.height = 24;
  itemHeaderRow.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
  itemHeaderRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
  itemHeaderRow.alignment = { vertical: 'middle', horizontal: 'center' };

  const ordersMap = new Map(orders.map((o) => [o.order_id, o]));

  itemsRes.rows.forEach((it, idx) => {
    const parent = ordersMap.get(it.order_id);
    const row = itemsWs.addRow({
      order_id: it.order_id,
      date_time: parent ? formatManilaIso(parent.created_at) : 'N/A',
      product_name: it.product_name_snapshot || 'Dish Item',
      unit_price: it.unit_price,
      quantity: it.quantity,
      subtotal: it.subtotal,
      item_status: it.item_status || 'ACTIVE',
      replacement_id: it.replacement_for_item_id ? String(it.replacement_for_item_id) : 'None',
      notes: it.notes || '-',
      order_status: parent ? parent.order_status : 'N/A',
    });

    row.height = 18;
    row.font = { name: 'Calibri', size: 9 };
    if (idx % 2 === 1) {
      row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
    }

    row.getCell('order_id').font = { name: 'Consolas', size: 9 };
    row.getCell('unit_price').numFmt = '"₱"#,##0.00';
    row.getCell('quantity').numFmt = '#,##0';
    row.getCell('subtotal').numFmt = '"₱"#,##0.00';
    row.getCell('unit_price').alignment = { horizontal: 'right', vertical: 'middle' };
    row.getCell('quantity').alignment = { horizontal: 'right', vertical: 'middle' };
    row.getCell('subtotal').alignment = { horizontal: 'right', vertical: 'middle' };
  });

  // -------------------------------------------------------------
  // Sheet 3: Executive Financial Summary
  // -------------------------------------------------------------
  const summaryWs = workbook.addWorksheet('Executive Summary');
  summaryWs.columns = [
    { header: 'Metric', key: 'metric', width: 35 },
    { header: 'Value', key: 'value', width: 25 },
    { header: 'Notes', key: 'notes', width: 45 },
  ];

  summaryWs.mergeCells('A1:C1');
  const sumTitle = summaryWs.getCell('A1');
  sumTitle.value = 'SEAFUDZ NG BAYAN — EXECUTIVE FINANCIAL & METRICS SUMMARY';
  sumTitle.font = { name: 'Calibri', size: 12, bold: true, color: { argb: 'FFFFFFFF' } };
  sumTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF15803D' } }; // Green-700
  sumTitle.alignment = { horizontal: 'center', vertical: 'middle' };
  summaryWs.getRow(1).height = 26;

  const sumHeader = summaryWs.getRow(2);
  sumHeader.values = ['Metric Category', 'Summary Figure', 'Accounting Description'];
  sumHeader.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
  sumHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
  summaryWs.getRow(2).height = 20;

  const completedOrders = orders.filter((o) => o.order_status === 'COMPLETED');
  const cancelledOrders = orders.filter((o) => o.order_status === 'CANCELLED');
  const posOrders = orders.filter((o) => (o.order_type || '').toUpperCase().includes('POS') || (o.order_type || '').toUpperCase().includes('ON_SITE'));
  const deliveryOrders = orders.filter((o) => (o.order_type || '').toUpperCase().includes('ONLINE') || (o.order_type || '').toUpperCase().includes('DELIVERY'));

  const netRevenue = runningGross - runningRefunds;

  const summaryDataRows = [
    { m: 'Report Scope', v: dateRangeLabel, n: 'Filtered date period' },
    { m: 'Total Historical Orders Queried', v: orders.length, n: 'All matching records in scope' },
    { m: 'Completed Orders', v: completedOrders.length, n: 'Orders successfully settled and delivered/served' },
    { m: 'Cancelled Orders', v: cancelledOrders.length, n: 'Orders cancelled with recorded resolution reasons' },
    { m: 'POS In-Store Orders', v: posOrders.length, n: 'Walk-in dine-in and takeout counter orders' },
    { m: 'Online Delivery Orders', v: deliveryOrders.length, n: 'Online ordering platform delivery transactions' },
    { m: 'Gross Orders Revenue (₱)', v: runningGross, n: 'Sum of all order totals (including VAT and delivery fee)', num: true },
    { m: 'Subtotal Revenue (₱)', v: runningSubtotal, n: 'Net food & beverage dishes price', num: true },
    { m: '12% VAT Tax Collected (₱)', v: runningTax, n: 'Value Added Tax collected on sales', num: true },
    { m: 'Delivery Fees Collected (₱)', v: runningDelivery, n: 'Delivery dispatch charges', num: true },
    { m: 'Total Refunded / Voided (₱)', v: runningRefunds, n: 'Customer settlements and voided amounts', num: true },
    { m: 'Net Recognized Revenue (₱)', v: netRevenue, n: 'Gross Revenue minus Total Refunds', num: true, highlight: true },
  ];

  summaryDataRows.forEach((r) => {
    const row = summaryWs.addRow([r.m, r.v, r.n]);
    row.height = 20;
    row.font = { name: 'Calibri', size: 10 };
    if (r.num) {
      const valCell = row.getCell(2);
      valCell.numFmt = '"₱"#,##0.00';
      valCell.alignment = { horizontal: 'right', vertical: 'middle' };
    }
    if (r.highlight) {
      row.font = { name: 'Calibri', size: 10, bold: true };
      row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCFCE7' } }; // Light Green
    }
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const filename = `seafudz_transactions_${dateRangeLabel.replace(/[\s/:]+/g, '_')}_${getManilaTimestampString()}.xlsx`;

  return {
    buffer,
    filename,
    totalRecords: orders.length,
    grossRevenue: runningGross,
    netRevenue,
    dateRange: dateRangeLabel,
  };
}

/**
 * Builds an official PDF document containing historical transactions,
 * financial KPI executive summary, and itemized sales volume.
 */
export async function generateTransactionsPDF({
  startDate = null,
  endDate = null,
  period = 'all',
  channel = 'all',
  adminEmail = 'Administrator',
} = {}) {
  const data = await fetchHistoricalTransactionsData({ startDate, endDate, period, channel });
  const { orders, itemsRes, paymentsByOrder, refundsByOrder, itemsByOrder, dateRangeLabel, normalizedPeriod } = data;

  const doc = new PDFDocument({
    size: 'A4',
    layout: 'landscape',
    margins: { top: 36, bottom: 20, left: 36, right: 36 },
    bufferPages: true,
  });

  const buffers = [];
  doc.on('data', (chunk) => buffers.push(chunk));
  const endPromise = new Promise((resolve) => doc.on('end', resolve));

  const margin = 36;
  const contentWidth = 770;
  const maxY = 525;

  const channelLabel =
    channel === 'pos'
      ? 'POS In-Store'
      : channel === 'online'
      ? 'Online Delivery'
      : 'All Channels';

  if (orders.length === 0) {
    // Header Banner
    doc.rect(margin, margin, contentWidth, 54).fill('#0F172A');
    doc.fillColor('#EA580C').font('Helvetica-Bold').fontSize(16).text('SEAFUDZ NG BAYAN', margin + 14, margin + 10);
    doc.fillColor('#F8FAFC').font('Helvetica-Bold').fontSize(9).text('HISTORICAL TRANSACTIONS & FINANCIAL AUDIT REPORT', margin + 14, margin + 32);

    doc.fillColor('#94A3B8').font('Helvetica').fontSize(8);
    doc.text(`Period: ${dateRangeLabel} | Scope: ${channelLabel}`, margin + 450, margin + 10, { width: 306, align: 'right' });
    doc.text(`Generated: ${formatManilaDateTime(new Date())} (Asia/Manila UTC+8)`, margin + 450, margin + 22, { width: 306, align: 'right' });
    doc.text(`Exported By: ${adminEmail}`, margin + 450, margin + 34, { width: 306, align: 'right' });

    // Empty state message
    doc.rect(margin, margin + 74, contentWidth, 120).fillAndStroke('#F8FAFC', '#E2E8F0');
    doc.fillColor('#475569').font('Helvetica-Bold').fontSize(12).text(
      'No historical transactions found matching the selected criteria.',
      margin,
      margin + 120,
      { align: 'center', width: contentWidth }
    );
    doc.fillColor('#94A3B8').font('Helvetica').fontSize(9).text(
      `Filters applied: Period [${dateRangeLabel}], Channel [${channelLabel}]`,
      margin,
      margin + 140,
      { align: 'center', width: contentWidth }
    );

    // Footer
    doc.strokeColor('#CBD5E1').lineWidth(0.5).moveTo(margin, 560).lineTo(margin + contentWidth, 560).stroke();
    doc.fillColor('#64748B').font('Helvetica').fontSize(7.5).text(
      'Seafudz ng Bayan POS System — Official Financial & Transaction Audit Document (Confidential)',
      margin,
      566,
      { width: 500 }
    );
    doc.fillColor('#64748B').font('Helvetica-Bold').fontSize(7.5).text(
      'Page 1 of 1',
      margin + contentWidth - 150,
      566,
      { align: 'right', width: 150 }
    );

    doc.end();
    await endPromise;
    return {
      buffer: Buffer.concat(buffers),
      totalRecords: 0,
      filename: `seafudz_transactions_${getManilaTimestampString()}.pdf`,
    };
  }

  // Calculate metrics
  let runningSubtotal = 0;
  let runningTax = 0;
  let runningDelivery = 0;
  let runningGross = 0;
  let runningRefunds = 0;
  let totalUnits = 0;

  orders.forEach((ord) => {
    runningSubtotal += Number(ord.subtotal) || 0;
    runningTax += Number(ord.tax) || 0;
    runningDelivery += Number(ord.delivery_fee) || 0;
    runningGross += Number(ord.total) || 0;

    const rfs = refundsByOrder.get(ord.order_id) || [];
    const rfTotal = rfs.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
    runningRefunds += rfTotal;

    const itms = itemsByOrder.get(ord.order_id) || [];
    totalUnits += itms.reduce((sum, i) => sum + (Number(i.quantity) || 0), 0);
  });

  const netRevenue = runningGross - runningRefunds;
  const completedOrders = orders.filter((o) => o.order_status === 'COMPLETED');
  const cancelledOrders = orders.filter((o) => o.order_status === 'CANCELLED' || o.order_status === 'KITCHEN_REJECTED');
  const posOrders = orders.filter((o) => (o.order_type || '').toUpperCase().includes('POS') || (o.order_type || '').toUpperCase().includes('ON_SITE') || (o.order_type || '').toUpperCase().includes('WALK'));
  const deliveryOrders = orders.filter((o) => (o.order_type || '').toUpperCase().includes('ONLINE') || (o.order_type || '').toUpperCase().includes('DELIVERY'));

  // --- Page 1 Header Banner ---
  doc.rect(margin, margin, contentWidth, 54).fill('#0F172A');
  doc.fillColor('#EA580C').font('Helvetica-Bold').fontSize(16).text('SEAFUDZ NG BAYAN', margin + 14, margin + 10);
  doc.fillColor('#F8FAFC').font('Helvetica-Bold').fontSize(9).text('HISTORICAL TRANSACTIONS & FINANCIAL AUDIT REPORT', margin + 14, margin + 32);

  doc.fillColor('#94A3B8').font('Helvetica').fontSize(8);
  doc.text(`Period: ${dateRangeLabel} | Scope: ${channelLabel}`, margin + 450, margin + 10, { width: 306, align: 'right' });
  doc.text(`Generated: ${formatManilaDateTime(new Date())} (Asia/Manila UTC+8)`, margin + 450, margin + 22, { width: 306, align: 'right' });
  doc.text(`Auditor: ${adminEmail}`, margin + 450, margin + 34, { width: 306, align: 'right' });

  // --- Executive KPI Summary Cards ---
  const kpiY = margin + 64;
  const kpiW = 146;
  const kpiH = 44;
  const kpiGap = 10;

  const kpis = [
    { title: 'GROSS SALES', value: `PHP ${runningGross.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, bg: '#F8FAFC', border: '#E2E8F0', text: '#0F172A' },
    { title: '12% VAT TAX', value: `PHP ${runningTax.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, bg: '#F8FAFC', border: '#E2E8F0', text: '#0F172A' },
    { title: 'DELIVERY FEES', value: `PHP ${runningDelivery.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, bg: '#F8FAFC', border: '#E2E8F0', text: '#0F172A' },
    { title: 'TOTAL REFUNDS', value: `PHP ${runningRefunds.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, bg: '#FEF2F2', border: '#FECACA', text: '#B91C1C' },
    { title: 'NET REVENUE', value: `PHP ${netRevenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, bg: '#DCFCE7', border: '#86EFAC', text: '#15803D', bold: true },
  ];

  kpis.forEach((kpi, idx) => {
    const x = margin + idx * (kpiW + kpiGap);
    doc.rect(x, kpiY, kpiW, kpiH).fillAndStroke(kpi.bg, kpi.border);
    doc.fillColor('#64748B').font('Helvetica-Bold').fontSize(7).text(kpi.title, x + 8, kpiY + 8, { width: kpiW - 16 });
    doc.fillColor(kpi.text).font('Helvetica-Bold').fontSize(10.5).text(kpi.value, x + 8, kpiY + 22, { width: kpiW - 16 });
  });

  // Secondary Strip
  const stripY = kpiY + kpiH + 8;
  doc.rect(margin, stripY, contentWidth, 20).fillAndStroke('#F1F5F9', '#CBD5E1');
  doc.fillColor('#334155').font('Helvetica-Bold').fontSize(7.5).text(
    `Total Orders: ${orders.length}   |   Completed: ${completedOrders.length}   |   Cancelled: ${cancelledOrders.length}   |   POS In-Store: ${posOrders.length}   |   Online Delivery: ${deliveryOrders.length}   |   Total Units Sold: ${totalUnits}`,
    margin + 12,
    stripY + 5
  );

  // --- Section 1: Transactions Ledger Table ---
  let currentY = stripY + 28;
  doc.fillColor('#0F172A').font('Helvetica-Bold').fontSize(10.5).text('1. HISTORICAL TRANSACTIONS LEDGER', margin, currentY);
  currentY += 15;

  const cols = [
    { title: 'Order Ref #', key: 'id', width: 130, align: 'left' },
    { title: 'Date (Manila)', key: 'date', width: 85, align: 'center' },
    { title: 'Channel', key: 'channel', width: 65, align: 'center' },
    { title: 'Customer / Dest', key: 'customer', width: 105, align: 'left' },
    { title: 'Status', key: 'status', width: 75, align: 'center' },
    { title: 'Ordered Items Summary', key: 'items', width: 160, align: 'left' },
    { title: 'Payment', key: 'payment', width: 75, align: 'center' },
    { title: 'Gross Total', key: 'total', width: 75, align: 'right' },
  ];

  const drawTableHeader = (y) => {
    doc.rect(margin, y, contentWidth, 20).fill('#1E293B');
    let curX = margin;
    cols.forEach((col) => {
      doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(7.5).text(col.title, curX + 4, y + 6, {
        width: col.width - 8,
        align: col.align,
      });
      curX += col.width;
    });
  };

  drawTableHeader(currentY);
  currentY += 20;

  orders.forEach((ord, idx) => {
    if (currentY + 20 > maxY) {
      doc.addPage();
      currentY = margin;
      drawTableHeader(currentY);
      currentY += 20;
    }

    const items = itemsByOrder.get(ord.order_id) || [];
    const payments = paymentsByOrder.get(ord.order_id) || [];

    const itemsSummary = items
      .map((i) => `${i.product_name_snapshot || 'Item'} x${i.quantity || 1}`)
      .join(', ') || 'No Items';

    const paymentMethods = payments.map((p) => p.payment_method).filter(Boolean);
    const paymentMethodStr = paymentMethods.length > 0 ? Array.from(new Set(paymentMethods)).join('/') : 'Cash';

    const rawType = (ord.order_type || '').toUpperCase();
    const isOnline = rawType.includes('ONLINE') || rawType.includes('DELIVERY');
    const channelLabelStr = isOnline ? 'Online' : 'POS Walk-In';

    // Clean & understandable Customer / Destination formatting
    const custName = (ord.customer_name || ord.customer || '').trim();
    const isPickup = (ord.fulfillment_type || ord.fulfillmentType || ord.type || '').toUpperCase().includes('PICKUP');
    const isPos = !isOnline;

    let destination = '';
    if (ord.table_id) {
      destination = custName ? `${custName} (Table ${ord.table_id})` : `Table ${ord.table_id}`;
    } else if (isPickup) {
      destination = custName && custName !== 'Online Customer' ? `${custName} (Pick-Up)` : 'Store Pick-Up';
    } else if (isPos) {
      destination = custName && custName !== 'Walk-In Customer' && custName !== 'Online Customer' ? custName : 'POS Counter';
    } else {
      // Online delivery
      let addr = (ord.delivery_address || '').trim();
      if (addr) {
        addr = addr.replace(/,\s*\d{4}.*$/, '');
        addr = addr.replace(/,\s*(?:Metro Manila|Philippines|Eastern Manila District).*$/i, '');
        const parts = addr.split(',').map((p) => p.trim()).filter(Boolean);
        if (parts.length > 2) {
          addr = `${parts[0]}, ${parts[1]}`;
        }
      }
      if (custName && custName !== 'Online Customer') {
        destination = addr ? `${custName} (${addr})` : custName;
      } else {
        destination = addr || 'Online Delivery';
      }
    }

    const isEven = idx % 2 === 0;
    if (isEven) {
      doc.rect(margin, currentY, contentWidth, 20).fill('#F8FAFC');
    }

    let statusColor = '#334155';
    if (ord.order_status === 'COMPLETED') statusColor = '#16A34A';
    else if (ord.order_status === 'CANCELLED' || ord.order_status === 'KITCHEN_REJECTED') statusColor = '#DC2626';
    else statusColor = '#D97706';

    const rowData = [
      { text: ord.order_id, col: cols[0], font: 'Helvetica-Bold' },
      { text: formatManilaIso(ord.created_at).slice(0, 16), col: cols[1], font: 'Helvetica' },
      { text: channelLabelStr, col: cols[2], font: 'Helvetica' },
      { text: destination, col: cols[3], font: 'Helvetica' },
      { text: ord.order_status, col: cols[4], font: 'Helvetica-Bold', color: statusColor },
      { text: itemsSummary, col: cols[5], font: 'Helvetica' },
      { text: paymentMethodStr, col: cols[6], font: 'Helvetica' },
      { text: `PHP ${(Number(ord.total) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, col: cols[7], font: 'Helvetica-Bold' },
    ];

    let curX = margin;
    rowData.forEach((item) => {
      doc.fillColor(item.color || '#1E293B').font(item.font).fontSize(7.5).text(item.text, curX + 4, currentY + 5, {
        width: item.col.width - 8,
        height: 10,
        align: item.col.align,
        lineBreak: false,
        ellipsis: true,
      });
      curX += item.col.width;
    });

    currentY += 20;
  });

  // Summary Row for Ledger
  if (currentY + 22 > maxY) {
    doc.addPage();
    currentY = margin;
  }
  doc.rect(margin, currentY, contentWidth, 22).fillAndStroke('#FEF08A', '#EAB308');
  doc.fillColor('#854D0E').font('Helvetica-Bold').fontSize(8);
  doc.text(`TOTAL AUDIT SUMMARY (${orders.length} orders, ${totalUnits} units)`, margin + 8, currentY + 6);
  doc.text(`Gross Revenue: PHP ${runningGross.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, margin + 400, currentY + 6, {
    width: contentWidth - 408,
    align: 'right',
  });
  currentY += 32;

  // --- Section 2: Itemized Product Sales Audit ---
  const productAggMap = new Map();
  itemsRes.rows.forEach((it) => {
    const name = it.product_name_snapshot || 'Product Item';
    if (!productAggMap.has(name)) {
      productAggMap.set(name, {
        name,
        unitPrice: Number(it.unit_price) || 0,
        unitsSold: 0,
        totalSales: 0,
      });
    }
    const agg = productAggMap.get(name);
    agg.unitsSold += Number(it.quantity) || 0;
    agg.totalSales += Number(it.subtotal) || 0;
  });

  const sortedProducts = Array.from(productAggMap.values()).sort((a, b) => b.totalSales - a.totalSales);

  if (sortedProducts.length > 0) {
    if (currentY + 80 > maxY) {
      doc.addPage();
      currentY = margin;
    }

    doc.fillColor('#0F172A').font('Helvetica-Bold').fontSize(10.5).text('2. ITEMIZED PRODUCT & DISH SALES VOLUME AUDIT', margin, currentY);
    currentY += 15;

    const dishCols = [
      { title: 'Product Name', width: 270, align: 'left' },
      { title: 'Unit Price (PHP)', width: 120, align: 'right' },
      { title: 'Units Sold', width: 110, align: 'right' },
      { title: 'Total Sales (PHP)', width: 140, align: 'right' },
      { title: 'Share of Sales', width: 130, align: 'right' },
    ];

    const drawDishHeader = (y) => {
      doc.rect(margin, y, contentWidth, 20).fill('#0284C7');
      let curX = margin;
      dishCols.forEach((col) => {
        doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(7.5).text(col.title, curX + 6, y + 6, {
          width: col.width - 12,
          align: col.align,
        });
        curX += col.width;
      });
    };

    drawDishHeader(currentY);
    currentY += 20;

    const totalDishSubtotal = runningSubtotal || 1;

    sortedProducts.forEach((prod, pIdx) => {
      if (currentY + 20 > maxY) {
        doc.addPage();
        currentY = margin;
        drawDishHeader(currentY);
        currentY += 20;
      }

      if (pIdx % 2 === 0) {
        doc.rect(margin, currentY, contentWidth, 20).fill('#F8FAFC');
      }

      const sharePct = ((prod.totalSales / totalDishSubtotal) * 100).toFixed(1);

      let curX = margin;
      const cells = [
        { text: prod.name, width: dishCols[0].width, align: 'left', font: 'Helvetica-Bold' },
        { text: `PHP ${prod.unitPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, width: dishCols[1].width, align: 'right', font: 'Helvetica' },
        { text: `${prod.unitsSold}`, width: dishCols[2].width, align: 'right', font: 'Helvetica' },
        { text: `PHP ${prod.totalSales.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, width: dishCols[3].width, align: 'right', font: 'Helvetica-Bold' },
        { text: `${sharePct}%`, width: dishCols[4].width, align: 'right', font: 'Helvetica' },
      ];

      cells.forEach((cell) => {
        doc.fillColor('#1E293B').font(cell.font).fontSize(7.5).text(cell.text, curX + 6, currentY + 5, {
          width: cell.width - 12,
          height: 10,
          align: cell.align,
          lineBreak: false,
          ellipsis: true,
        });
        curX += cell.width;
      });

      currentY += 20;
    });

    // Dishes total row
    if (currentY + 22 > maxY) {
      doc.addPage();
      currentY = margin;
    }
    doc.rect(margin, currentY, contentWidth, 22).fillAndStroke('#E0F2FE', '#0284C7');
    doc.fillColor('#0369A1').font('Helvetica-Bold').fontSize(8);
    doc.text(`TOTAL PRODUCT LINE ITEMS (${sortedProducts.length} dishes, ${totalUnits} total units)`, margin + 8, currentY + 6);
    doc.text(`Food & Beverage Subtotal: PHP ${runningSubtotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, margin + 400, currentY + 6, {
      width: contentWidth - 408,
      align: 'right',
    });
    currentY += 22;
  }

  // --- Section 3: Official Signatures & Verification Block ---
  const signBlockHeight = 65;
  if (currentY + signBlockHeight + 14 > maxY) {
    doc.addPage();
    currentY = margin + 10;
  } else {
    currentY += 16;
  }

  doc.rect(margin, currentY, contentWidth, signBlockHeight).fillAndStroke('#F8FAFC', '#CBD5E1');

  // Title of the signature section
  doc.fillColor('#0F172A').font('Helvetica-Bold').fontSize(8).text(
    'FINANCIAL AUDIT VERIFICATION & ACKNOWLEDGEMENT',
    margin + 16,
    currentY + 8,
    { height: 10, lineBreak: false }
  );

  const colSignW = 260;
  const leftSignX = margin + 50;
  const rightSignX = margin + contentWidth - colSignW - 50;
  const lineY = currentY + 42;

  // Cashier Signature Column
  doc.strokeColor('#64748B').lineWidth(0.8).moveTo(leftSignX, lineY).lineTo(leftSignX + colSignW, lineY).stroke();
  doc.fillColor('#334155').font('Helvetica-Bold').fontSize(7.5).text(
    'CASHIER SIGNATURE',
    leftSignX,
    lineY + 4,
    { width: colSignW, align: 'center', height: 10, lineBreak: false }
  );
  doc.fillColor('#64748B').font('Helvetica').fontSize(6.5).text(
    'Prepared & reconciled with register shift ledger',
    leftSignX,
    lineY + 13,
    { width: colSignW, align: 'center', height: 10, lineBreak: false }
  );

  // Owner Signature Column
  doc.strokeColor('#64748B').lineWidth(0.8).moveTo(rightSignX, lineY).lineTo(rightSignX + colSignW, lineY).stroke();
  doc.fillColor('#0F172A').font('Helvetica-Bold').fontSize(7.5).text(
    'OWNER / STORE MANAGER SIGNATURE',
    rightSignX,
    lineY + 4,
    { width: colSignW, align: 'center', height: 10, lineBreak: false }
  );
  doc.fillColor('#64748B').font('Helvetica').fontSize(6.5).text(
    'Verified, audited & approved for official accounting records',
    rightSignX,
    lineY + 13,
    { width: colSignW, align: 'center', height: 10, lineBreak: false }
  );

  // --- Footers on all pages ---
  const range = doc.bufferedPageRange();
  const totalPages = range.count;
  for (let i = range.start; i < range.start + totalPages; i++) {
    doc.switchToPage(i);
    doc.strokeColor('#CBD5E1').lineWidth(0.5).moveTo(margin, 555).lineTo(margin + contentWidth, 555).stroke();
    doc.fillColor('#64748B').font('Helvetica').fontSize(7.5).text(
      'Seafudz ng Bayan POS System — Official Financial & Transaction Audit Document (Confidential)',
      margin,
      562,
      { width: 500, height: 10, lineBreak: false }
    );
    doc.fillColor('#64748B').font('Helvetica-Bold').fontSize(7.5).text(
      `Page ${i + 1} of ${totalPages}`,
      margin + contentWidth - 150,
      562,
      { align: 'right', width: 150, height: 10, lineBreak: false }
    );
  }

  doc.end();
  await endPromise;
  const pdfBuffer = Buffer.concat(buffers);
  const filename = `seafudz_transactions_${dateRangeLabel.replace(/[\s/:]+/g, '_')}_${getManilaTimestampString()}.pdf`;

  return {
    buffer: pdfBuffer,
    filename,
    totalRecords: orders.length,
    grossRevenue: runningGross,
    netRevenue,
    dateRange: dateRangeLabel,
  };
}

export default {
  generateTransactionsExcel,
  generateTransactionsPDF,
  fetchHistoricalTransactionsData,
  formatManilaIso,
};
