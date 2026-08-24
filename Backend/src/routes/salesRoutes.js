import { Router } from 'express';
import { query } from '../config/db.js';

const router = Router();

// GET /api/sales/summary - Get sales summary analytics from database
router.get('/sales/summary', async (req, res) => {
  try {
    const summarySql = `
      SELECT 
        COUNT(id)::int AS "totalOrders",
        COALESCE(SUM(total), 0)::float AS "grossRevenue",
        COALESCE(SUM(subtotal), 0)::float AS "subtotalRevenue",
        COALESCE(SUM(tax), 0)::float AS "vatCollected",
        COALESCE(AVG(total), 0)::float AS "averageOrderValue"
      FROM orders
      WHERE UPPER(status) != 'CANCELLED'
    `;
    const summaryRes = await query(summarySql);
    const summary = summaryRes.rows[0];

    const paymentSql = `
      SELECT payment_method, COALESCE(SUM(amount), 0)::float AS total
      FROM payments
      GROUP BY payment_method
    `;
    const paymentRes = await query(paymentSql);
    const paymentMethods = {};
    paymentRes.rows.forEach((r) => {
      paymentMethods[r.payment_method || 'CASH'] = r.total;
    });

    const topDishesSql = `
      SELECT oi.product_name_snapshot AS name, 
             SUM(oi.quantity)::int AS "quantitySold", 
             SUM(oi.subtotal)::float AS "revenue"
      FROM order_items oi
      JOIN orders o ON oi.order_id = o.id
      WHERE UPPER(o.status) != 'CANCELLED'
      GROUP BY oi.product_name_snapshot
      ORDER BY "quantitySold" DESC
      LIMIT 5
    `;
    const topDishesRes = await query(topDishesSql);

    return res.status(200).json({
      success: true,
      data: {
        totalOrders: summary.totalOrders,
        grossRevenue: summary.grossRevenue,
        subtotalRevenue: summary.subtotalRevenue,
        vatCollected: summary.vatCollected,
        averageOrderValue: Math.round(summary.averageOrderValue),
        paymentMethods,
        topDishes: topDishesRes.rows,
      },
    });
  } catch (error) {
    console.error('Error generating sales summary:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to generate sales summary',
      error: error.message,
    });
  }
});

// GET /api/sales/transactions - Get list of transactions ledger from database
router.get('/sales/transactions', async (req, res) => {
  try {
    const sql = `
      SELECT o.id AS "orderId", 
             o.id AS "transactionId", 
             o.created_at AS "date", 
             o.order_type AS "type", 
             COALESCE(p.payment_method, 'CASH') AS "paymentMethod", 
             o.total AS "totalAmount",
             o.status AS "status"
      FROM orders o
      LEFT JOIN (
        SELECT DISTINCT ON (order_id) order_id, payment_method
        FROM payments
        ORDER BY order_id, created_at DESC
      ) p ON o.id = p.order_id
      ORDER BY o.created_at DESC
    `;
    const { rows } = await query(sql);

    return res.status(200).json({
      success: true,
      count: rows.length,
      data: rows,
    });
  } catch (error) {
    console.error('Error fetching transactions:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve transactions ledger',
      error: error.message,
    });
  }
});

export default router;
