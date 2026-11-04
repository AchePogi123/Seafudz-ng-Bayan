import { realtimeEmitter } from './realtimeEvents.js';

/**
 * Atomically deducts remaining servings for items in an order when it reaches CONFIRMED.
 * Ensures strict idempotency via orders.servings_deducted flag and row-level locks (FOR UPDATE).
 *
 * @param {import('pg').PoolClient} client - Active connected PostgreSQL client inside transaction
 * @param {string} orderId - Target order ID
 * @returns {Promise<{ success: boolean, alreadyDeducted: boolean, updatedProducts: Array<any> }>}
 */
export async function deductOrderRemainingServings(client, orderId) {
  try {
    // 1. Lock order row and check idempotency flag
    const orderRes = await client.query(
      `SELECT id, status, servings_deducted 
       FROM orders 
       WHERE id = $1 
       FOR UPDATE`,
      [orderId]
    );

    if (orderRes.rows.length === 0) {
      return { success: false, message: 'Order not found' };
    }

    const order = orderRes.rows[0];
    if (order.servings_deducted) {
      return { success: true, alreadyDeducted: true, updatedProducts: [] };
    }

    // 2. Fetch line items
    const itemRes = await client.query(
      `SELECT product_id, product_name_snapshot, quantity 
       FROM order_items 
       WHERE order_id = $1 AND COALESCE(item_status, 'ACTIVE') = 'ACTIVE'`,
      [orderId]
    );

    const items = itemRes.rows;
    if (items.length === 0) {
      await client.query(`UPDATE orders SET servings_deducted = TRUE, updated_at = NOW() WHERE id = $1`, [orderId]);
      return { success: true, alreadyDeducted: false, updatedProducts: [] };
    }

    // 3. Resolve products & lock rows
    const productIds = items.map((i) => i.product_id).filter(Boolean);
    const productNames = items.map((i) => i.product_name_snapshot).filter(Boolean);

    const prodRes = await client.query(
      `SELECT id, name, remaining_servings, is_available 
       FROM products 
       WHERE (id::text = ANY($1::text[]) OR LOWER(name) = ANY(SELECT LOWER(x) FROM unnest($2::text[]) AS x))
         AND remaining_servings IS NOT NULL
       FOR UPDATE`,
      [productIds, productNames]
    );

    const updatedProducts = [];
    const processedProductNames = new Set();

    // 4. Decrement servings for products configured with manual remaining servings
    for (const prod of prodRes.rows) {
      const normName = String(prod.name).toLowerCase();
      if (processedProductNames.has(normName)) {
        continue;
      }
      processedProductNames.add(normName);

      const matchingItems = items.filter(
        (i) => i.product_id === prod.id || String(i.product_name_snapshot).toLowerCase() === normName
      );
      const totalQuantity = matchingItems.reduce((acc, curr) => acc + (Number(curr.quantity) || 1), 0);

      if (totalQuantity > 0) {
        const currentServings = Number(prod.remaining_servings);
        const newServings = Math.max(0, currentServings - totalQuantity);
        const newIsAvailable = newServings > 0;

        const updateRes = await client.query(
          `UPDATE products 
           SET remaining_servings = $1, 
               is_available = CASE WHEN $1 <= 0 THEN FALSE ELSE is_available END,
               updated_at = NOW() 
           WHERE id = $2 OR LOWER(name) = LOWER($3)
           RETURNING id, name, remaining_servings, is_available`,
          [newServings, prod.id, prod.name]
        );

        if (updateRes.rows.length > 0) {
          for (const updatedRow of updateRes.rows) {
            if (!updatedProducts.some((p) => p.id === updatedRow.id)) {
              updatedProducts.push(updatedRow);
            }

            // Broadcast real-time event whenever remaining servings change or reaches 0
            realtimeEmitter.emit('order_update', {
              type: 'PRODUCT_AVAILABILITY_CHANGED',
              productId: String(updatedRow.id),
              productName: updatedRow.name,
              isAvailable: Boolean(updatedRow.is_available),
              remainingServings: updatedRow.remaining_servings,
              timestamp: Date.now(),
            });
          }
        }
      }
    }

    // 5. Mark order as deducted
    await client.query(
      `UPDATE orders 
       SET servings_deducted = TRUE, updated_at = NOW() 
       WHERE id = $1`,
      [orderId]
    );

    return { success: true, alreadyDeducted: false, updatedProducts };
  } catch (err) {
    console.error(`[SERVINGS] Error deducting servings for order ${orderId}:`, err.message);
    throw err;
  }
}

/**
 * Restores remaining servings if a confirmed order is cancelled before preparation.
 */
export async function restoreOrderRemainingServings(client, orderId) {
  try {
    const orderRes = await client.query(
      `SELECT id, servings_deducted 
       FROM orders 
       WHERE id = $1 
       FOR UPDATE`,
      [orderId]
    );

    if (orderRes.rows.length === 0 || !orderRes.rows[0].servings_deducted) {
      return { success: true, restored: false };
    }

    const itemRes = await client.query(
      `SELECT product_id, product_name_snapshot, quantity 
       FROM order_items 
       WHERE order_id = $1 AND COALESCE(item_status, 'ACTIVE') = 'ACTIVE'`,
      [orderId]
    );

    const items = itemRes.rows;
    const productIds = items.map((i) => i.product_id).filter(Boolean);
    const productNames = items.map((i) => i.product_name_snapshot).filter(Boolean);

    const prodRes = await client.query(
      `SELECT id, name, remaining_servings, is_available 
       FROM products 
       WHERE (id::text = ANY($1::text[]) OR LOWER(name) = ANY(SELECT LOWER(x) FROM unnest($2::text[]) AS x))
         AND remaining_servings IS NOT NULL
       FOR UPDATE`,
      [productIds, productNames]
    );

    const updatedProducts = [];
    const processedProductNames = new Set();

    for (const prod of prodRes.rows) {
      const normName = String(prod.name).toLowerCase();
      if (processedProductNames.has(normName)) {
        continue;
      }
      processedProductNames.add(normName);

      const matchingItems = items.filter(
        (i) => i.product_id === prod.id || String(i.product_name_snapshot).toLowerCase() === normName
      );
      const totalQuantity = matchingItems.reduce((acc, curr) => acc + (Number(curr.quantity) || 1), 0);

      if (totalQuantity > 0) {
        const newServings = Number(prod.remaining_servings) + totalQuantity;
        const restoreRes = await client.query(
          `UPDATE products 
           SET remaining_servings = $1, 
               is_available = TRUE,
               updated_at = NOW() 
           WHERE id = $2 OR LOWER(name) = LOWER($3)
           RETURNING id, name, remaining_servings, is_available`,
          [newServings, prod.id, prod.name]
        );

        if (restoreRes.rows.length > 0) {
          for (const restoredRow of restoreRes.rows) {
            if (!updatedProducts.some((p) => p.id === restoredRow.id)) {
              updatedProducts.push(restoredRow);
            }
            realtimeEmitter.emit('order_update', {
              type: 'PRODUCT_AVAILABILITY_CHANGED',
              productId: String(restoredRow.id),
              productName: restoredRow.name,
              isAvailable: true,
              remainingServings: restoredRow.remaining_servings,
              timestamp: Date.now(),
            });
          }
        }
      }
    }

    await client.query(`UPDATE orders SET servings_deducted = FALSE, updated_at = NOW() WHERE id = $1`, [orderId]);
    return { success: true, restored: true, updatedProducts };
  } catch (err) {
    console.warn(`[SERVINGS] Note restoring servings for order ${orderId}:`, err.message);
    return { success: false, error: err.message };
  }
}
