import dotenv from 'dotenv';
dotenv.config();

import { getDbPool } from '../src/config/db.js';

async function resetTransactions() {
  console.log('====================================================');
  console.log('Seafudz ng Bayan — Safe Transaction Reset Script');
  console.log('====================================================');

  const pool = await getDbPool();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    console.log('[*] Truncating transactional tables (orders, order_items, payments, deliveries, kitchen_orders, refunds, assistant_calls)...');
    await client.query(`
      TRUNCATE TABLE 
        order_items, 
        payments, 
        refunds, 
        deliveries, 
        kitchen_orders, 
        assistant_calls, 
        orders 
      RESTART IDENTITY CASCADE;
    `);

    console.log('[*] Resetting product remaining_servings countdown to NULL (standard availability)...');
    await client.query(`UPDATE products SET remaining_servings = NULL;`);

    await client.query('COMMIT');
    console.log('[SUCCESS] All transactional tables have been cleanly wiped and reset!');

    // Verify row counts of critical tables
    console.log('\n--- Critical System Tables Preserved ---');
    const criticalTables = ['employees', 'customers', 'categories', 'products', 'tables', 'schema_migrations'];
    for (const tbl of criticalTables) {
      const res = await client.query(`SELECT COUNT(*) FROM ${tbl}`);
      console.log(`  ✓ ${tbl.padEnd(20)}: ${res.rows[0].count} rows (intact)`);
    }

    console.log('\n--- Transactional Tables Reset ---');
    const txTables = ['orders', 'order_items', 'payments', 'deliveries', 'kitchen_orders', 'refunds'];
    for (const tbl of txTables) {
      const res = await client.query(`SELECT COUNT(*) FROM ${tbl}`);
      console.log(`  ✓ ${tbl.padEnd(20)}: ${res.rows[0].count} rows (fresh start)`);
    }

    console.log('\n====================================================');
    console.log('[DONE] Fresh start ready! Zero transactions in system.');
    console.log('====================================================');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[ERROR] Reset failed, rolled back changes:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

resetTransactions().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
