import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import multer from 'multer';
import { getDbPool, query } from '../config/db.js';
import {
  getProductImageStorage,
  getProductImageUrl,
  isManagedProductImagePath,
  PRODUCT_IMAGE_PREFIX,
} from '../config/productImageStorage.js';
import { requireActiveAdmin, requireAuth } from '../middleware/authMiddleware.js';
import { validateAndNormalizeProductImage } from '../utils/validateProductImage.js';

const router = Router();
const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 0 },
}).single('image');

function parseImageUpload(req, res, next) {
  imageUpload(req, res, (error) => {
    if (!error) return next();
    const status = error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
    return res.status(status).json({
      success: false,
      message: status === 413 ? 'Image must be 5 MB or smaller.' : 'Invalid image upload.',
    });
  });
}

function managedPathForProduct(value, productId) {
  return isManagedProductImagePath(value) && value.startsWith(`${PRODUCT_IMAGE_PREFIX}${productId}/`);
}

async function deleteStoredImage(path) {
  const { error } = await getProductImageStorage().remove([path]);
  if (error) throw error;
}

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
    const data = rows.map((row) => ({ ...row, image: getProductImageUrl(row.image) }));

    return res.status(200).json({
      success: true,
      count: data.length,
      data,
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
      data: { ...rows[0], image: getProductImageUrl(rows[0].image) },
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

// POST /api/menu/:id/image - Replace a product image.
router.post('/menu/:id/image', requireAuth, requireActiveAdmin, parseImageUpload, async (req, res) => {
  const productId = req.params.id;
  if (!/^[a-z0-9-]{1,100}$/i.test(productId)) {
    return res.status(400).json({ success: false, message: 'Invalid product ID.' });
  }
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'Select an image to upload.' });
  }

  let normalized;
  try {
    normalized = await validateAndNormalizeProductImage(req.file.buffer);
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message || 'Invalid image file.' });
  }

  const objectPath = `${PRODUCT_IMAGE_PREFIX}${productId}/${randomUUID()}.${normalized.extension}`;
  let client;
  try {
    const pool = await getDbPool();
    client = await pool.connect();
  } catch (error) {
    console.error('Could not open product image transaction:', error);
    return res.status(500).json({ success: false, message: 'Could not save product image.' });
  }
  let transactionOpen = false;
  let uploaded = false;
  let oldImage = null;

  try {
    await client.query('BEGIN');
    transactionOpen = true;
    const existing = await client.query('SELECT image FROM products WHERE id::text = $1 FOR UPDATE', [productId]);
    if (existing.rows.length === 0) {
      await client.query('ROLLBACK');
      transactionOpen = false;
      return res.status(404).json({ success: false, message: 'Product not found.' });
    }
    oldImage = existing.rows[0].image;

    const { error: uploadError } = await getProductImageStorage().upload(objectPath, normalized.buffer, {
      contentType: normalized.contentType,
      upsert: false,
    });
    if (uploadError) throw uploadError;
    uploaded = true;

    await client.query('UPDATE products SET image = $1 WHERE id::text = $2', [objectPath, productId]);
    await client.query('COMMIT');
    transactionOpen = false;
  } catch (error) {
    if (transactionOpen) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackError) {
        console.error('Product image transaction rollback failed:', rollbackError);
      }
    }
    if (uploaded) {
      try {
        await deleteStoredImage(objectPath);
      } catch (cleanupError) {
        console.error(`Orphaned product image requires cleanup (${objectPath}):`, cleanupError);
      }
    }
    console.error('Product image replacement failed:', error);
    return res.status(500).json({ success: false, message: 'Could not save product image.' });
  } finally {
    client.release();
  }

  let oldImageCleanupPending = false;
  if (managedPathForProduct(oldImage, productId)) {
    try {
      await deleteStoredImage(oldImage);
    } catch (error) {
      oldImageCleanupPending = true;
      console.error(`Stale product image requires cleanup (${oldImage}):`, error);
    }
  }

  return res.status(200).json({
    success: true,
    data: { id: productId, image: getProductImageUrl(objectPath) },
    oldImageCleanupPending,
  });
});

// DELETE /api/menu/:id/image - Restore the bundled image by clearing the DB reference.
router.delete('/menu/:id/image', requireAuth, requireActiveAdmin, async (req, res) => {
  const productId = req.params.id;
  if (!/^[a-z0-9-]{1,100}$/i.test(productId)) {
    return res.status(400).json({ success: false, message: 'Invalid product ID.' });
  }

  let client;
  try {
    const pool = await getDbPool();
    client = await pool.connect();
  } catch (error) {
    console.error('Could not open product image removal transaction:', error);
    return res.status(500).json({ success: false, message: 'Could not restore the bundled product image.' });
  }
  let transactionOpen = false;
  let oldImage = null;
  try {
    await client.query('BEGIN');
    transactionOpen = true;
    const existing = await client.query('SELECT image FROM products WHERE id::text = $1 FOR UPDATE', [productId]);
    if (existing.rows.length === 0) {
      await client.query('ROLLBACK');
      transactionOpen = false;
      return res.status(404).json({ success: false, message: 'Product not found.' });
    }
    oldImage = existing.rows[0].image;
    await client.query('UPDATE products SET image = NULL WHERE id::text = $1', [productId]);
    await client.query('COMMIT');
    transactionOpen = false;
  } catch (error) {
    if (transactionOpen) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackError) {
        console.error('Product image removal rollback failed:', rollbackError);
      }
    }
    console.error('Product image removal failed:', error);
    return res.status(500).json({ success: false, message: 'Could not restore the bundled product image.' });
  } finally {
    client.release();
  }

  let cleanupPending = false;
  if (managedPathForProduct(oldImage, productId)) {
    try {
      await deleteStoredImage(oldImage);
    } catch (error) {
      cleanupPending = true;
      console.error(`Stale product image requires cleanup (${oldImage}):`, error);
    }
  }

  return res.status(200).json({ success: true, data: { id: productId, image: null }, cleanupPending });
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
