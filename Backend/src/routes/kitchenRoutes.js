import { Router } from 'express';
import { query } from '../config/db.js';

const router = Router();

// GET /api/kitchen/orders - Get active kitchen order tickets
router.get('/kitchen/orders', async (req, res) => {
  try {
    const sql = `
      SELECT o.id, o.customer_id, o.cashier_id, o.assistant_id, o.table_id,
             o.order_type, o.status AS order_status,
             COALESCE(ko.status, o.status) AS status,
             o.notes, o.created_at, o.updated_at,
             t.name AS table_name,
             COALESCE(
               json_agg(
                 json_build_object(
                   'id', oi.id,
                   'menu_item_id', oi.product_id,
                   'product_id', oi.product_id,
                   'quantity', oi.quantity,
                   'unit_price', oi.unit_price,
                   'subtotal', oi.subtotal,
                   'notes', oi.notes,
                   'name', COALESCE(oi.product_name_snapshot, p.name)
                 )
               ) FILTER (WHERE oi.id IS NOT NULL), '[]'
             ) AS "items"
      FROM orders o
      LEFT JOIN kitchen_orders ko ON o.id = ko.order_id
      LEFT JOIN tables t ON o.table_id = t.id
      LEFT JOIN order_items oi ON o.id = oi.order_id
      LEFT JOIN products p ON oi.product_id = p.id
      WHERE UPPER(COALESCE(ko.status, o.status)) IN ('PENDING', 'IN_PROCESS', 'COOKING', 'PREPARING')
      GROUP BY o.id, ko.status, t.name
      ORDER BY o.created_at ASC
    `;
    const { rows } = await query(sql);

    return res.status(200).json({
      success: true,
      count: rows.length,
      data: rows,
    });
  } catch (error) {
    console.error('Error fetching kitchen orders:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve kitchen tickets',
      error: error.message,
    });
  }
});

// PATCH /api/kitchen/orders/:id/status - Update ticket status
router.patch('/kitchen/orders/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    const { id } = req.params;

    const normalizedStatus = (status || '').toUpperCase();
    const validStatuses = ['PENDING', 'IN_PROCESS', 'COMPLETED', 'CANCELLED'];
    const finalStatus = validStatuses.includes(normalizedStatus) ? normalizedStatus : 'IN_PROCESS';

    // Update kitchen_orders status
    await query(`
      INSERT INTO kitchen_orders (order_id, status, updated_at)
      VALUES ($1, $2, NOW())
      ON CONFLICT (order_id) DO UPDATE SET
        status = EXCLUDED.status,
        updated_at = NOW()
    `, [id, finalStatus]);

    // Also update order status
    const sql = `
      UPDATE orders
      SET status = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING *
    `;
    const { rows } = await query(sql, [finalStatus, id]);

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: `Kitchen ticket '${id}' not found`,
      });
    }

    return res.status(200).json({
      success: true,
      message: `Kitchen ticket '${id}' updated to ${finalStatus}`,
      data: rows[0],
    });
  } catch (error) {
    console.error('Error updating kitchen order status:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update kitchen ticket status',
      error: error.message,
    });
  }
});

// DELETE /api/kitchen/orders/:id - Cancel/remove ticket
router.delete('/kitchen/orders/:id', async (req, res) => {
  try {
    const { id } = req.params;

    await query(`
      UPDATE kitchen_orders
      SET status = 'CANCELLED', cancelled_at = NOW(), updated_at = NOW()
      WHERE order_id = $1
    `, [id]);

    const sql = `
      UPDATE orders
      SET status = 'CANCELLED', updated_at = NOW()
      WHERE id = $1
      RETURNING id
    `;
    await query(sql, [id]);

    return res.status(200).json({
      success: true,
      message: `Kitchen ticket '${id}' updated to cancelled`,
    });
  } catch (error) {
    console.error('Error deleting kitchen order:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete kitchen ticket',
      error: error.message,
    });
  }
});

export default router;
