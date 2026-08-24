import { Router } from 'express';
import { query } from '../config/db.js';

const router = Router();

// GET /api/rider/deliveries - Get active delivery jobs
router.get('/rider/deliveries', async (req, res) => {
  try {
    const sql = `
      SELECT o.id, o.order_type, o.status AS order_status, o.total, o.created_at,
             d.id AS delivery_id, d.delivery_address, COALESCE(d.status, 'PENDING') AS status,
             c.fullname AS customer_name, c.phone AS customer_phone,
             e.fullname AS rider_name, d.rider_id,
             COALESCE(
               json_agg(
                 json_build_object(
                   'id', oi.id,
                   'menu_item_id', oi.product_id,
                   'product_id', oi.product_id,
                   'quantity', oi.quantity,
                   'unit_price', oi.unit_price,
                   'subtotal', oi.subtotal,
                   'name', COALESCE(oi.product_name_snapshot, p.name)
                 )
               ) FILTER (WHERE oi.id IS NOT NULL), '[]'
             ) AS "items"
      FROM orders o
      LEFT JOIN deliveries d ON o.id = d.order_id
      LEFT JOIN customers c ON o.customer_id = c.id
      LEFT JOIN employees e ON d.rider_id = e.id
      LEFT JOIN order_items oi ON o.id = oi.order_id
      LEFT JOIN products p ON oi.product_id = p.id
      WHERE UPPER(o.order_type) = 'ONLINE' OR d.id IS NOT NULL
      GROUP BY o.id, d.id, d.delivery_address, d.status, d.rider_id, c.fullname, c.phone, e.fullname
      ORDER BY o.created_at DESC
    `;
    const { rows } = await query(sql);

    return res.status(200).json({
      success: true,
      count: rows.length,
      data: rows,
    });
  } catch (error) {
    console.error('Error fetching rider deliveries:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve delivery jobs',
      error: error.message,
    });
  }
});

// PATCH /api/rider/deliveries/:id/status - Update delivery status
router.patch('/rider/deliveries/:id/status', async (req, res) => {
  try {
    const { status, employeeId } = req.body;
    const { id } = req.params;

    const normalizedStatus = (status || '').toUpperCase();
    const validStatuses = ['PENDING', 'ASSIGNED', 'PICKED_UP', 'DELIVERED', 'CANCELLED'];
    const finalStatus = validStatuses.includes(normalizedStatus) ? normalizedStatus : 'ASSIGNED';

    let delSql = `
      INSERT INTO deliveries (order_id, delivery_address, status, rider_id, updated_at)
      VALUES ($1, 'Standard Delivery Address', $2, $3, NOW())
      ON CONFLICT (order_id) DO UPDATE SET
        status = EXCLUDED.status,
        rider_id = COALESCE(EXCLUDED.rider_id, deliveries.rider_id),
        updated_at = NOW()
      RETURNING *
    `;
    const { rows } = await query(delSql, [id, finalStatus, employeeId || null]);

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: `Delivery order '${id}' not found`,
      });
    }

    return res.status(200).json({
      success: true,
      message: `Delivery '${id}' status updated to ${finalStatus}`,
      data: rows[0],
    });
  } catch (error) {
    console.error('Error updating delivery status:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update delivery status',
      error: error.message,
    });
  }
});

export default router;
