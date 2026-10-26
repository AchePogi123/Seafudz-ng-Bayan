import { Router } from 'express';
import { query } from '../config/db.js';
import { requireAuth, requireRole } from '../middleware/authMiddleware.js';
import { inMemoryOrders } from './sharedFlowStore.js';

const router = Router();

// GET /api/sales/summary - Get sales summary analytics from database
router.get('/sales/summary', requireAuth, requireRole(['admin', 'cashier']), async (req, res) => {
  try {
    const { tab, period, startDate, endDate } = req.query;
    const selectedPeriod = (tab || period || '').toLowerCase().trim();

    let dateFilter = '';
    const dateParams = [];
    let pIdx = 1;

    if (selectedPeriod === 'today' || selectedPeriod === '1d') {
      dateFilter = ` AND o.created_at >= (((NOW() AT TIME ZONE 'Asia/Manila')::date)::timestamp AT TIME ZONE 'Asia/Manila') AND o.created_at < ((((NOW() AT TIME ZONE 'Asia/Manila')::date + 1))::timestamp AT TIME ZONE 'Asia/Manila')`;
    } else if (selectedPeriod === 'this week' || selectedPeriod === 'week' || selectedPeriod === '1w') {
      dateFilter = ` AND o.created_at >= ((((NOW() AT TIME ZONE 'Asia/Manila')::date - INTERVAL '6 days'))::timestamp AT TIME ZONE 'Asia/Manila') AND o.created_at < ((((NOW() AT TIME ZONE 'Asia/Manila')::date + 1))::timestamp AT TIME ZONE 'Asia/Manila')`;
    } else if (selectedPeriod === 'this month' || selectedPeriod === 'month' || selectedPeriod === '1m') {
      dateFilter = ` AND o.created_at >= (DATE_TRUNC('month', NOW() AT TIME ZONE 'Asia/Manila') AT TIME ZONE 'Asia/Manila') AND o.created_at < ((((NOW() AT TIME ZONE 'Asia/Manila')::date + 1))::timestamp AT TIME ZONE 'Asia/Manila')`;
    } else if (selectedPeriod === 'this year' || selectedPeriod === 'year' || selectedPeriod === '1y') {
      dateFilter = ` AND o.created_at >= (DATE_TRUNC('year', NOW() AT TIME ZONE 'Asia/Manila') AT TIME ZONE 'Asia/Manila') AND o.created_at < ((((NOW() AT TIME ZONE 'Asia/Manila')::date + 1))::timestamp AT TIME ZONE 'Asia/Manila')`;
    } else {
      if (startDate && /^\d{4}-\d{2}-\d{2}$/.test(String(startDate).trim())) {
        dateFilter += ` AND o.created_at >= (($${pIdx++}::date)::timestamp AT TIME ZONE 'Asia/Manila')`;
        dateParams.push(String(startDate).trim());
      }
      if (endDate && /^\d{4}-\d{2}-\d{2}$/.test(String(endDate).trim())) {
        dateFilter += ` AND o.created_at < ((($${pIdx++}::date + 1))::timestamp AT TIME ZONE 'Asia/Manila')`;
        dateParams.push(String(endDate).trim());
      }
    }

    const summarySql = `
      SELECT 
        COUNT(o.id)::int AS "totalOrders",
        COALESCE(SUM(o.total), 0)::float AS "grossRevenue",
        COALESCE(SUM(o.subtotal), 0)::float AS "subtotalRevenue",
        COALESCE(SUM(o.tax), 0)::float AS "vatCollected",
        COALESCE(AVG(o.total), 0)::float AS "averageOrderValue",
        COALESCE(COUNT(CASE WHEN LOWER(o.order_type) IN ('on_site', 'pos', 'on-site', 'walk-in', 'walk_in', 'pos order') THEN 1 END), 0)::int AS "posOrders",
        COALESCE(SUM(CASE WHEN LOWER(o.order_type) IN ('on_site', 'pos', 'on-site', 'walk-in', 'walk_in', 'pos order') THEN o.total ELSE 0 END), 0)::float AS "posRevenue",
        COALESCE(COUNT(CASE WHEN LOWER(o.order_type) IN ('online', 'delivery', 'online customer', 'online order') THEN 1 END), 0)::int AS "deliveryOrders",
        COALESCE(SUM(CASE WHEN LOWER(o.order_type) IN ('online', 'delivery', 'online customer', 'online order') THEN o.total ELSE 0 END), 0)::float AS "deliveryRevenue",
        COALESCE(COUNT(DISTINCT COALESCE(o.customer_id::text, c.fullname)), 0)::int AS "uniqueCustomers"
      FROM orders o
      LEFT JOIN customers c ON o.customer_id = c.id
      WHERE UPPER(o.status) != 'CANCELLED' ${dateFilter}
    `;
    const summaryRes = await query(summarySql, dateParams);
    const summary = summaryRes.rows[0] || {};

    // Check DB order IDs to merge in-memory orders if any exist
    let memPosOrders = 0;
    let memPosRevenue = 0;
    let memDeliveryOrders = 0;
    let memDeliveryRevenue = 0;

    try {
      const dbOrderIdsRes = await query(`SELECT o.id FROM orders o WHERE UPPER(o.status) != 'CANCELLED' ${dateFilter}`, dateParams);
      const dbOrderIds = new Set(dbOrderIdsRes.rows.map(r => String(r.id)));

      // Calculate Manila time boundary helpers for inMemoryOrders
      const nowManilaStr = new Date().toLocaleString('en-US', { timeZone: 'Asia/Manila' });
      const nowManila = new Date(nowManilaStr);
      const todayStart = new Date(nowManila.getFullYear(), nowManila.getMonth(), nowManila.getDate(), 0, 0, 0, 0).getTime();
      const todayEnd = new Date(nowManila.getFullYear(), nowManila.getMonth(), nowManila.getDate(), 23, 59, 59, 999).getTime();

      inMemoryOrders.forEach((ord, id) => {
        if (!dbOrderIds.has(String(id)) && String(ord.status || '').toUpperCase() !== 'CANCELLED') {
          // Date matching check
          const ordTime = ord.created_at ? new Date(ord.created_at).getTime() : (ord.dateTime ? new Date(ord.dateTime).getTime() : 0);
          if (ordTime > 0) {
            if (selectedPeriod === 'today' || selectedPeriod === '1d') {
              if (ordTime < todayStart || ordTime > todayEnd) return;
            } else if (selectedPeriod === 'this week' || selectedPeriod === 'week' || selectedPeriod === '1w') {
              const weekStart = new Date(nowManila.getFullYear(), nowManila.getMonth(), nowManila.getDate() - 6, 0, 0, 0, 0).getTime();
              if (ordTime < weekStart || ordTime > todayEnd) return;
            } else if (selectedPeriod === 'this month' || selectedPeriod === 'month' || selectedPeriod === '1m') {
              const monthStart = new Date(nowManila.getFullYear(), nowManila.getMonth(), 1, 0, 0, 0, 0).getTime();
              if (ordTime < monthStart || ordTime > todayEnd) return;
            } else if (selectedPeriod === 'this year' || selectedPeriod === 'year' || selectedPeriod === '1y') {
              const yearStart = new Date(nowManila.getFullYear(), 0, 1, 0, 0, 0, 0).getTime();
              if (ordTime < yearStart || ordTime > todayEnd) return;
            } else if (startDate || endDate) {
              if (startDate && ordTime < new Date(`${startDate}T00:00:00+08:00`).getTime()) return;
              if (endDate && ordTime > new Date(`${endDate}T23:59:59.999+08:00`).getTime()) return;
            }
          }

          const type = String(ord.order_type || ord.type || 'ONLINE').toUpperCase();
          const tot = parseFloat(ord.total || 0);
          if (type.includes('ON_SITE') || type.includes('POS') || type.includes('WALK')) {
            memPosOrders++;
            memPosRevenue += tot;
          } else {
            memDeliveryOrders++;
            memDeliveryRevenue += tot;
          }
        }
      });
    } catch (e) {
      console.warn('Error merging in-memory orders in sales summary:', e);
    }

    const posOrders = (summary.posOrders || 0) + memPosOrders;
    const deliveryOrders = (summary.deliveryOrders || 0) + memDeliveryOrders;
    const totalOrders = posOrders + deliveryOrders;

    const posRevenue = (summary.posRevenue || 0) + memPosRevenue;
    const deliveryRevenue = (summary.deliveryRevenue || 0) + memDeliveryRevenue;
    const grossRevenue = posRevenue + deliveryRevenue;
    const averageOrderValue = totalOrders > 0 ? Math.round(grossRevenue / totalOrders) : 0;

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
    const paymentRes = await query(paymentSql, dateParams);
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
    const topDishesRes = await query(topDishesSql, dateParams);

    const categoriesSql = `
      SELECT 
        CASE 
          WHEN LOWER(oi.product_name_snapshot) LIKE '%shrimp%' OR LOWER(oi.product_name_snapshot) LIKE '%seafood%' OR LOWER(oi.product_name_snapshot) LIKE '%tahong%' OR LOWER(oi.product_name_snapshot) LIKE '%crab%' OR LOWER(COALESCE(c.name, '')) IN ('seafood mixes', 'shrimp specials', 'crabs & shellfish', 'seafoods') THEN 'Seafoods'
          WHEN LOWER(oi.product_name_snapshot) LIKE '%siomai%' THEN 'Siomai'
          WHEN LOWER(oi.product_name_snapshot) LIKE '%pastil%' OR LOWER(oi.product_name_snapshot) LIKE '%noodles%' OR LOWER(oi.product_name_snapshot) LIKE '%chao fan%' THEN 'Value Meals'
          WHEN LOWER(oi.product_name_snapshot) LIKE '%lemonade%' OR LOWER(oi.product_name_snapshot) LIKE '%shake%' THEN 'Shake & Lemonade'
          WHEN LOWER(oi.product_name_snapshot) LIKE '%coke%' OR LOWER(oi.product_name_snapshot) LIKE '%sprite%' OR LOWER(oi.product_name_snapshot) LIKE '%royal%' OR LOWER(oi.product_name_snapshot) LIKE '%water%' OR LOWER(oi.product_name_snapshot) LIKE '%coffee%' OR LOWER(oi.product_name_snapshot) LIKE '%tea%' THEN 'Drinks'
          WHEN LOWER(oi.product_name_snapshot) LIKE '%pudding%' OR LOWER(oi.product_name_snapshot) LIKE '%ice cream%' OR LOWER(oi.product_name_snapshot) LIKE '%yelo%' THEN 'Desserts'
          WHEN LOWER(oi.product_name_snapshot) LIKE '%corn%' OR LOWER(oi.product_name_snapshot) LIKE '%rice%' OR LOWER(oi.product_name_snapshot) LIKE '%sauce%' OR LOWER(oi.product_name_snapshot) LIKE '%sausage%' OR LOWER(oi.product_name_snapshot) LIKE '%add-on%' THEN 'Add Ons'
          ELSE 'Seafoods'
        END AS category,
        COALESCE(SUM(oi.subtotal), 0)::float AS revenue,
        COALESCE(SUM(oi.quantity), 0)::int AS units
      FROM order_items oi
      JOIN orders o ON oi.order_id = o.id
      LEFT JOIN (
        SELECT DISTINCT ON (LOWER(TRIM(name))) id, name, category_id FROM products ORDER BY LOWER(TRIM(name)), category_id
      ) p ON (oi.product_id = p.id OR LOWER(TRIM(oi.product_name_snapshot)) = LOWER(TRIM(p.name)))
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE UPPER(o.status) != 'CANCELLED' ${dateFilter}
      GROUP BY 1
      ORDER BY revenue DESC
    `;
    const categoriesRes = await query(categoriesSql, dateParams);

    return res.status(200).json({
      success: true,
      data: {
        totalOrders,
        grossRevenue,
        subtotalRevenue: summary.subtotalRevenue || grossRevenue,
        vatCollected: summary.vatCollected || 0,
        averageOrderValue,
        posOrders,
        posRevenue,
        deliveryOrders,
        deliveryRevenue,
        uniqueCustomers: summary.uniqueCustomers || 0,
        breakdown,
        paymentMethods: {
          CASH: breakdown.cash.total,
          GCASH: breakdown.gcash.total,
          MAYA: breakdown.maya.total,
          HYBRID: breakdown.hybrid.total,
          COD: breakdown.cod.total,
        },
        topDishes: topDishesRes.rows,
        categoryBreakdown: categoriesRes.rows,
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
             COALESCE(o.payment_method, p.payment_method, 'CASH') AS "paymentMethod", 
             COALESCE(NULLIF(o.payment_reference, ''), NULLIF(p.reference_number, '')) AS "paymentReference",
             COALESCE(NULLIF(o.payment_reference, ''), NULLIF(p.reference_number, '')) AS "referenceNumber",
             COALESCE(NULLIF(o.payment_receipt, ''), NULLIF(p.payment_receipt, '')) AS "paymentReceipt",
             COALESCE(o.rider_cash_received, d.rider_cash_received) AS "riderCashReceived",
             o.total AS "totalAmount",
             o.status AS "status"
      FROM orders o
      LEFT JOIN (
        SELECT DISTINCT ON (order_id) order_id, payment_method, reference_number, payment_receipt
        FROM payments
        ORDER BY order_id, created_at DESC
      ) p ON o.id = p.order_id
      LEFT JOIN (
        SELECT DISTINCT ON (order_id) order_id, rider_cash_received
        FROM deliveries
        ORDER BY order_id, created_at DESC
      ) d ON o.id = d.order_id
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
