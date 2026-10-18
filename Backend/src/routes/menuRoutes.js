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
import { requireActiveAdmin, requireAuth, requireRole } from '../middleware/authMiddleware.js';
import { validateAndNormalizeProductImage } from '../utils/validateProductImage.js';
import { realtimeEmitter } from '../utils/realtimeEvents.js';

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
      WHERE p.is_active = TRUE
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

router.post('/menu', requireAuth, requireActiveAdmin, async (req, res) => {
  const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
  const description = typeof req.body?.description === 'string' ? req.body.description.trim() : '';
  const category = typeof req.body?.category === 'string' ? req.body.category.trim() : '';
  const price = Number(req.body?.price);

  if (!name || name.length > 255) {
    return res.status(400).json({ success: false, message: 'Product name is required and must be 255 characters or fewer.' });
  }
  if (!category || category.length > 100) {
    return res.status(400).json({ success: false, message: 'A valid product category is required.' });
  }
  if (!Number.isFinite(price) || price < 0 || price > 99999999.99) {
    return res.status(400).json({ success: false, message: 'Price must be a valid amount between 0 and 99,999,999.99.' });
  }
  if (description.length > 2000) {
    return res.status(400).json({ success: false, message: 'Product description must be 2,000 characters or fewer.' });
  }

  const slug = name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60) || 'product';
  const id = `custom-${slug}-${randomUUID().slice(0, 8)}`;

  try {
    const { rows } = await query(
      `WITH product_category AS (
         INSERT INTO categories (name)
         VALUES ($1)
         ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
         RETURNING id
       )
       INSERT INTO products (id, category_id, name, description, price)
       SELECT $2, id, $3, $4, $5
       FROM product_category
       RETURNING id, name, description, price, image, is_available`,
      [category, id, name, description || null, price]
    );

    const product = { ...rows[0], category, image: getProductImageUrl(rows[0].image) };
    realtimeEmitter.emit('order_update', {
      type: 'PRODUCT_CATALOG_CHANGED',
      action: 'CREATE',
      product,
      productId: String(product.id),
      productName: product.name,
      timestamp: Date.now(),
    });
    return res.status(201).json({ success: true, data: product });
  } catch (error) {
    console.error('Error creating menu item:', error);
    return res.status(500).json({ success: false, message: 'Failed to create product.' });
  }
});

router.delete('/menu/:id', requireAuth, requireActiveAdmin, async (req, res) => {
  const productId = req.params.id;
  if (!/^[a-z0-9-]{1,100}$/i.test(productId)) {
    return res.status(400).json({ success: false, message: 'Invalid product ID.' });
  }

  try {
    const { rows } = await query(
      `UPDATE products
       SET is_active = FALSE, is_available = FALSE, updated_at = NOW()
       WHERE id = $1 AND is_active = TRUE
       RETURNING id, name`,
      [productId]
    );
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Product not found.' });
    }

    realtimeEmitter.emit('order_update', {
      type: 'PRODUCT_CATALOG_CHANGED',
      action: 'DELETE',
      productId: String(rows[0].id),
      productName: rows[0].name,
      timestamp: Date.now(),
    });
    return res.status(200).json({ success: true, data: rows[0] });
  } catch (error) {
    console.error('Error archiving menu item:', error);
    return res.status(500).json({ success: false, message: 'Failed to remove product from the menu.' });
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
      WHERE p.id = $1 AND p.is_active = TRUE
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

// PATCH /api/menu/:id/availability - Kitchen and Admin stock control.
router.patch('/menu/:id/availability', requireAuth, requireRole(['kitchen', 'admin']), async (req, res) => {
  const { is_available: isAvailable } = req.body || {};
  if (typeof isAvailable !== 'boolean') {
    return res.status(400).json({ success: false, message: 'is_available must be a boolean.' });
  }

  try {
    const { rows } = await query(
      `UPDATE products
       SET is_available = $1, updated_at = NOW()
       WHERE id::text = $2
       RETURNING id, name, is_available`,
      [isAvailable, req.params.id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Product not found.' });
    }

    const product = rows[0];
    realtimeEmitter.emit('order_update', {
      type: 'PRODUCT_AVAILABILITY_CHANGED',
      productId: String(product.id),
      productName: product.name,
      isAvailable: product.is_available,
      timestamp: Date.now(),
    });
    return res.status(200).json({ success: true, data: product });
  } catch (error) {
    console.error('Error updating product availability:', error);
    return res.status(500).json({ success: false, message: 'Failed to update product availability.' });
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

  realtimeEmitter.emit('order_update', {
    type: 'PRODUCT_CATALOG_CHANGED',
    productId,
    image: getProductImageUrl(objectPath),
    timestamp: Date.now(),
  });

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

  realtimeEmitter.emit('order_update', {
    type: 'PRODUCT_CATALOG_CHANGED',
    productId,
    image: null,
    timestamp: Date.now(),
  });

  return res.status(200).json({ success: true, data: { id: productId, image: null }, cleanupPending });
});

// GET /api/categories - Get categories with item counts
router.get('/categories', async (req, res) => {
  try {
    const sql = `
      SELECT c.id, c.name, COUNT(p.id)::int AS "itemCount"
      FROM categories c
      LEFT JOIN products p ON c.id = p.category_id AND p.is_active = TRUE
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
