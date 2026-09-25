import { Router } from 'express';
import { query } from '../config/db.js';
import { requireAuth, requireRole } from '../middleware/authMiddleware.js';

const router = Router();

// GET /api/sales/summary - Get sales summary analytics from database
router.get('/sales/summary', requireAuth, requireRole(['admin', 'cashier']), async (req, res) => {
  try {
    const { tab, period } = req.query;
    const selectedPeriod = (tab || period || '').toLowerCase();

    let dateFilter = '';
    if (selectedPeriod === 'today') {
      dateFilter = ` AND o.created_at >= CURRENT_DATE`;
    } else if (selectedPeriod === 'this week' || selectedPeriod === 'week') {
      dateFilter = ` AND o.created_at >= NOW() - INTERVAL '7 days'`;
    } else if (selectedPeriod === 'this month' || selectedPeriod === 'month') {
      dateFilter = ` AND o.created_at >= DATE_TRUNC('month', CURRENT_DATE)`;
    } else if (selectedPeriod === 'this year' || selectedPeriod === 'year') {
      dateFilter = ` AND o.created_at >= DATE_TRUNC('year', CURRENT_DATE)`;
    }

    const summarySql = `
      SELECT 
        COUNT(o.id)::int AS "totalOrders",
        COALESCE(SUM(o.total), 0)::float AS "grossRevenue",
        COALESCE(SUM(o.subtotal), 0)::float AS "subtotalRevenue",
        COALESCE(SUM(o.tax), 0)::float AS "vatCollected",
        COALESCE(AVG(o.total), 0)::float AS "averageOrderValue",
        COALESCE(COUNT(CASE WHEN LOWER(o.order_type) = 'on_site' THEN 1 END), 0)::int AS "posOrders",
        COALESCE(SUM(CASE WHEN LOWER(o.order_type) = 'on_site' THEN o.total ELSE 0 END), 0)::float AS "posRevenue",
        COALESCE(COUNT(CASE WHEN LOWER(o.order_type) = 'online' THEN 1 END), 0)::int AS "deliveryOrders",
        COALESCE(SUM(CASE WHEN LOWER(o.order_type) = 'online' THEN o.total ELSE 0 END), 0)::float AS "deliveryRevenue",
        COALESCE(COUNT(DISTINCT COALESCE(o.customer_id::text, c.fullname)), 0)::int AS "uniqueCustomers"
      FROM orders o
      LEFT JOIN customers c ON o.customer_id = c.id
      WHERE UPPER(o.status) != 'CANCELLED' ${dateFilter}
    `;
    const summaryRes = await query(summarySql);
    const summary = summaryRes.rows[0];

    const paymentSql = `
      SELECT 
        LOWER(COALESCE(p.payment_method, 'cash')) AS method,
        COUNT(DISTINCT o.id)::int AS count,
        COALESCE(SUM(o.total), 0)::float AS total
      FROM orders o
      LEFT JOIN (
        SELECT DISTINCT ON (order_id) order_id, payment_method
        FROM payments
        ORDER BY order_id, created_at DESC
      ) p ON o.id = p.order_id
      WHERE UPPER(o.status) != 'CANCELLED' ${dateFilter}
      GROUP BY LOWER(COALESCE(p.payment_method, 'cash'))
    `;
    const paymentRes = await query(paymentSql);
    const breakdown = {
      cash: { total: 0, count: 0 },
      gcash: { total: 0, count: 0 },
      maya: { total: 0, count: 0 },
      hybrid: { total: 0, count: 0 },
      cod: { total: 0, count: 0 }
    };
    paymentRes.rows.forEach((r) => {
      const m = r.method;
      if (m.includes('hybrid') || m.includes('split')) {
        breakdown.hybrid.total += r.total;
        breakdown.hybrid.count += r.count;
      } else if (m.includes('gcash')) {
        breakdown.gcash.total += r.total;
        breakdown.gcash.count += r.count;
      } else if (m.includes('maya')) {
        breakdown.maya.total += r.total;
        breakdown.maya.count += r.count;
      } else if (m.includes('cod')) {
        breakdown.cod.total += r.total;
        breakdown.cod.count += r.count;
      } else {
        breakdown.cash.total += r.total;
        breakdown.cash.count += r.count;
      }
    });

    const topDishesSql = `
      SELECT oi.product_name_snapshot AS name, 
             SUM(oi.quantity)::int AS "quantitySold", 
             SUM(oi.subtotal)::float AS "revenue"
      FROM order_items oi
      JOIN orders o ON oi.order_id = o.id
      WHERE UPPER(o.status) != 'CANCELLED' ${dateFilter}
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
        averageOrderValue: Math.round(summary.averageOrderValue || 0),
        posOrders: summary.posOrders,
        posRevenue: summary.posRevenue,
        deliveryOrders: summary.deliveryOrders,
        deliveryRevenue: summary.deliveryRevenue,
        uniqueCustomers: summary.uniqueCustomers,
        breakdown,
        paymentMethods: {
          CASH: breakdown.cash.total,
          GCASH: breakdown.gcash.total,
          MAYA: breakdown.maya.total,
          HYBRID: breakdown.hybrid.total,
          COD: breakdown.cod.total,
        },
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
router.get('/sales/transactions', requireAuth, requireRole(['admin', 'cashier']), async (req, res) => {
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
