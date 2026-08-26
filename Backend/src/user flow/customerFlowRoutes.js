import { Router } from 'express';
import { query } from '../config/db.js';
import { inMemoryOrders, formatOrderResponse } from './sharedFlowStore.js';

const router = Router();

/**
 * Online Customer places an order -> Saved in Backend with status PENDING
 */
router.post('/user-flow/orders', async (req, res) => {
  try {
    const {
      customerName,
      phone,
      deliveryAddress,
      address,
      paymentMethod,
      notes,
      items,
      cartItems,
      subtotal,
      vat,
      deliveryFee,
      total,
    } = req.body;

    const rawItems = items || cartItems || [];
    if (!rawItems || rawItems.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Order items cannot be empty',
      });
    }

    const orderId = `SFB-${Math.floor(1000 + Math.random() * 9000)}`;
    const calcSubtotal = subtotal || rawItems.reduce((acc, i) => acc + ((i.price || i.unit_price || 0) * (i.quantity || 1)), 0);
    const calcVat = vat || Math.round(calcSubtotal * 0.12 * 100) / 100;
    const calcFee = deliveryFee || 50;
    const calcTotal = total || (calcSubtotal + calcVat + calcFee);
    const cleanAddress = deliveryAddress || address || 'Metro Manila Address';
    const cleanPhone = phone || '0917-000-0000';
    const cleanCustomer = customerName || 'Online Customer';

    const orderRecord = {
      id: orderId,
      customer_name: cleanCustomer,
      customerName: cleanCustomer,
      customer_phone: cleanPhone,
      phone: cleanPhone,
      delivery_address: cleanAddress,
      address: cleanAddress,
      payment_method: paymentMethod || 'GCash',
      paymentMethod: paymentMethod || 'GCash',
      notes: notes || '',
      subtotal: calcSubtotal,
      vat: calcVat,
      delivery_fee: calcFee,
      total: calcTotal,
      status: 'PENDING',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      items: rawItems.map(i => ({
        id: i.id || i.product_id || 'item-1',
        name: i.name || i.product_name_snapshot || 'Seafood Dish',
        quantity: i.quantity || 1,
        price: i.price || i.unit_price || 0,
        specialNote: i.specialNote || i.notes || '',
      })),
    };

    // Store in Backend Memory
    inMemoryOrders.set(orderId, orderRecord);

    // Try saving to PostgreSQL DB if DB is active
    try {
      await query(
        `INSERT INTO orders (id, order_type, status, subtotal, tax, delivery_fee, total, notes, created_at)
         VALUES ($1, 'ONLINE', 'PENDING', $2, $3, $4, $5, $6, NOW())
         ON CONFLICT (id) DO UPDATE SET status = 'PENDING'`,
        [orderId, calcSubtotal, calcVat, calcFee, calcTotal, notes || null]
      );
    } catch (dbErr) {
      console.warn('DB query note (using central memory fallback):', dbErr.message);
    }

    const formatted = formatOrderResponse(orderRecord);
    console.log(`🛒 [Order Flow] Customer placed order ${orderId} -> Status: PENDING`);

    return res.status(201).json({
      success: true,
      message: `Order ${orderId} created successfully with status PENDING`,
      data: formatted,
    });
  } catch (error) {
    console.error('Error creating order in user flow:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to create order',
      error: error.message,
    });
  }
});

/**
 * Online Customer or Role monitors single order by ID
 */
router.get('/user-flow/orders/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (inMemoryOrders.has(id)) {
      const order = formatOrderResponse(inMemoryOrders.get(id));
      return res.status(200).json({
        success: true,
        data: order,
      });
    }

    // DB search
    try {
      const { rows } = await query(`
        SELECT o.id, o.status, o.subtotal, o.tax AS vat, o.delivery_fee, o.total, o.notes, o.created_at, o.updated_at,
               c.fullname AS customer_name, c.phone AS customer_phone, c.delivery_address,
               COALESCE(
                 json_agg(
                   json_build_object(
                     'id', oi.id,
                     'name', oi.product_name_snapshot,
                     'quantity', oi.quantity,
                     'price', oi.unit_price
                   )
                 ) FILTER (WHERE oi.id IS NOT NULL), '[]'
               ) AS items
        FROM orders o
        LEFT JOIN customers c ON o.customer_id = c.id
        LEFT JOIN order_items oi ON o.id = oi.order_id
        WHERE o.id = $1
        GROUP BY o.id, c.fullname, c.phone, c.delivery_address
      `, [id]);

      if (rows.length > 0) {
        const order = formatOrderResponse(rows[0]);
        return res.status(200).json({
          success: true,
          data: order,
        });
      }
    } catch {
      /* ignore */
    }

    return res.status(404).json({
      success: false,
      message: `Order ${id} not found`,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve order status',
      error: error.message,
    });
  }
});

export default router;
