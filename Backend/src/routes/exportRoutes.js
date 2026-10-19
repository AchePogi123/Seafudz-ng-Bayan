import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/authMiddleware.js';
import { generateTransactionsExcel } from '../services/transactionExportService.js';
import { query } from '../config/db.js';

const router = Router();

/**
 * GET /api/admin/export/transactions/preview
 * Returns quick metadata preview (total records, estimated gross revenue)
 * for the selected date range.
 */
router.get('/admin/export/transactions/preview', requireAuth, requireRole(['admin']), async (req, res) => {
  try {
    const { startDate, endDate, period = 'all', channel = 'all' } = req.query;

    let dateFilter = '';
    const dateParams = [];
    let pIdx = 1;
    const normPeriod = (period || '').toLowerCase().trim();

    if (normPeriod === 'today' || normPeriod === '1d') {
      dateFilter = ` AND created_at >= (((NOW() AT TIME ZONE 'Asia/Manila')::date)::timestamp AT TIME ZONE 'Asia/Manila') AND created_at < ((((NOW() AT TIME ZONE 'Asia/Manila')::date + 1))::timestamp AT TIME ZONE 'Asia/Manila')`;
    } else if (normPeriod === 'this week' || normPeriod === 'week' || normPeriod === '1w') {
      dateFilter = ` AND created_at >= ((((NOW() AT TIME ZONE 'Asia/Manila')::date - INTERVAL '6 days'))::timestamp AT TIME ZONE 'Asia/Manila') AND created_at < ((((NOW() AT TIME ZONE 'Asia/Manila')::date + 1))::timestamp AT TIME ZONE 'Asia/Manila')`;
    } else if (normPeriod === 'this month' || normPeriod === 'month' || normPeriod === '1m') {
      dateFilter = ` AND created_at >= (DATE_TRUNC('month', NOW() AT TIME ZONE 'Asia/Manila') AT TIME ZONE 'Asia/Manila') AND created_at < ((((NOW() AT TIME ZONE 'Asia/Manila')::date + 1))::timestamp AT TIME ZONE 'Asia/Manila')`;
    } else if (normPeriod === 'this year' || normPeriod === 'year' || normPeriod === '1y') {
      dateFilter = ` AND created_at >= (DATE_TRUNC('year', NOW() AT TIME ZONE 'Asia/Manila') AT TIME ZONE 'Asia/Manila') AND created_at < ((((NOW() AT TIME ZONE 'Asia/Manila')::date + 1))::timestamp AT TIME ZONE 'Asia/Manila')`;
    } else if (startDate || endDate) {
      if (startDate && /^\d{4}-\d{2}-\d{2}$/.test(String(startDate).trim())) {
        dateFilter += ` AND created_at >= (($${pIdx++}::date)::timestamp AT TIME ZONE 'Asia/Manila')`;
        dateParams.push(String(startDate).trim());
      }
      if (endDate && /^\d{4}-\d{2}-\d{2}$/.test(String(endDate).trim())) {
        dateFilter += ` AND created_at < ((($${pIdx++}::date + 1))::timestamp AT TIME ZONE 'Asia/Manila')`;
        dateParams.push(String(endDate).trim());
      }
    }

    let channelFilter = '';
    if (channel && channel.toLowerCase() !== 'all') {
      const c = channel.toLowerCase();
      if (c.includes('pos') || c.includes('on_site') || c.includes('walk')) {
        channelFilter = ` AND LOWER(order_type) IN ('on_site', 'pos', 'walk-in', 'on-site', 'pos order')`;
      } else if (c.includes('online') || c.includes('delivery')) {
        channelFilter = ` AND LOWER(order_type) IN ('online', 'delivery', 'online customer', 'online order')`;
      }
    }

    const countSql = `
      SELECT 
        COUNT(*)::int AS count,
        COALESCE(SUM(total), 0)::float AS "grossTotal",
        MIN(created_at) AS "earliestDate",
        MAX(created_at) AS "latestDate"
      FROM orders
      WHERE 1=1 ${dateFilter} ${channelFilter};
    `;

    const countRes = await query(countSql, dateParams);
    const row = countRes.rows[0] || { count: 0, grossTotal: 0 };

    return res.status(200).json({
      success: true,
      data: {
        totalRecords: row.count,
        grossTotal: row.grossTotal,
        earliestDate: row.earliestDate,
        latestDate: row.latestDate,
      },
    });
  } catch (err) {
    console.error('[EXPORT PREVIEW ERROR]:', err.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve export preview',
      error: err.message,
    });
  }
});

/**
 * GET /api/admin/export/transactions/excel
 * Generates and downloads a complete formatted Excel (.xlsx) file.
 * Restricted to authenticated Admin users only.
 */
router.get('/admin/export/transactions/excel', requireAuth, requireRole(['admin']), async (req, res) => {
  const adminEmail = req.user?.email || req.user?.username || 'Administrator';
  const startTime = Date.now();

  try {
    const { startDate, endDate, period = 'all', channel = 'all' } = req.query;

    console.log(`[ADMIN AUDIT] Historical transactions Excel export initiated by: ${adminEmail} (Scope: ${period}, Channel: ${channel})`);

    const result = await generateTransactionsExcel({
      startDate,
      endDate,
      period,
      channel,
      adminEmail,
    });

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`[ADMIN AUDIT] Excel export generated in ${duration}s (${result.totalRecords} records, ${result.buffer.byteLength} bytes)`);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    res.setHeader('X-Total-Records', String(result.totalRecords));
    res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition, X-Total-Records');

    return res.send(Buffer.from(result.buffer));
  } catch (err) {
    console.error('[EXPORT EXCEL ERROR]:', err.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to generate Excel transactions export',
      error: err.message,
    });
  }
});

export default router;
