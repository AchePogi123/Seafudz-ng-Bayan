import { Router } from 'express';
import { query } from '../config/db.js';

const router = Router();

// GET /api/menu - Get menu items from database with optional filters
router.get('/menu', async (req, res) => {
  try {
    const { category, search, available, minPrice, maxPrice, limit, page } = req.query;

    let sql = `
      SELECT p.*, c.name AS category
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;

    if (category && category !== 'All Menu') {
      sql += ` AND LOWER(c.name) = LOWER($${paramIndex++})`;
      params.push(category);
    }

    if (search) {
      sql += ` AND (LOWER(p.name) LIKE $${paramIndex} OR LOWER(p.description) LIKE $${paramIndex})`;
      params.push(`%${search.toLowerCase()}%`);
      paramIndex++;
    }

    if (available !== undefined) {
      sql += ` AND p.is_available = $${paramIndex++}`;
      params.push(available === 'true');
    }

    if (minPrice) {
      sql += ` AND p.price >= $${paramIndex++}`;
      params.push(Number(minPrice));
    }

    if (maxPrice) {
      sql += ` AND p.price <= $${paramIndex++}`;
      params.push(Number(maxPrice));
    }

    sql += ` ORDER BY p.created_at DESC`;

    if (limit && page) {
      const limitNum = parseInt(limit, 10) || 10;
      const pageNum = parseInt(page, 10) || 1;
      const offsetNum = (pageNum - 1) * limitNum;

      sql += ` LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
      params.push(limitNum, offsetNum);
    }

    const { rows } = await query(sql, params);

    return res.status(200).json({
      success: true,
      count: rows.length,
      data: rows,
    });
  } catch (error) {
    console.error('Error fetching menu items:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve menu items from database',
      error: error.message,
    });
  }
});

// GET /api/menu/:id - Get single menu item by ID
router.get('/menu/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const sql = `
      SELECT p.*, c.name AS category
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.id = $1
    `;
    const { rows } = await query(sql, [id]);

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: `Menu item with ID '${id}' not found`,
      });
    }

    return res.status(200).json({
      success: true,
      data: rows[0],
    });
  } catch (error) {
    console.error('Error fetching menu item:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve menu item',
      error: error.message,
    });
  }
});

// GET /api/categories - Get categories with item counts
router.get('/categories', async (req, res) => {
  try {
    const sql = `
      SELECT c.id, c.name, COUNT(p.id)::int AS "itemCount"
      FROM categories c
      LEFT JOIN products p ON c.id = p.category_id
      GROUP BY c.id, c.name
      ORDER BY c.id ASC
    `;
    const { rows } = await query(sql);

    return res.status(200).json({
      success: true,
      count: rows.length,
      data: rows,
    });
  } catch (error) {
    console.error('Error fetching categories:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve categories',
      error: error.message,
    });
  }
});

export default router;
