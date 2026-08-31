import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getDbPool } from '../config/db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function runMigrations() {
  console.log('=================================================');
  console.log('📦 Seafudz ng Bayan - Running Database Migrations');
  console.log('-------------------------------------------------');

  let pool;
  let client;

  try {
    const connectPromise = getDbPool().then((p) => {
      pool = p;
      return p.connect();
    });
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Connection attempt timed out')), 2500)
    );
    client = await Promise.race([connectPromise, timeoutPromise]);
  } catch (err) {
    console.warn(`⚠️ Database connection unavailable (${err.message}).`);
    console.warn(`👉 Skipping automatic startup migration.`);
    console.log('=================================================');
    return;
  }

  try {
    // 1. Ensure schema_migrations tracking table exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id SERIAL PRIMARY KEY,
        filename VARCHAR(255) NOT NULL UNIQUE,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // 2. Fetch list of already applied migrations
    const { rows } = await client.query('SELECT filename FROM schema_migrations;');
    const appliedFiles = new Set(rows.map((row) => row.filename));

    // 3. Read migration directory for .sql files
    const files = fs
      .readdirSync(__dirname)
      .filter((file) => file.endsWith('.sql'))
      .sort();

    if (files.length === 0) {
      console.log('ℹ️  No migration files found.');
      return;
    }

    let pendingCount = 0;

    for (const file of files) {
      if (appliedFiles.has(file)) {
        console.log(`✅ Already applied: ${file}`);
        continue;
      }

      pendingCount++;
      console.log(`🚀 Executing migration: ${file}...`);
      const filePath = path.join(__dirname, file);
      const sql = fs.readFileSync(filePath, 'utf8');

      try {
        await client.query('BEGIN');
        await client.query(sql);
        await client.query(
          'INSERT INTO schema_migrations (filename) VALUES ($1);',
          [file]
        );
        await client.query('COMMIT');
        console.log(`✨ Successfully applied migration: ${file}`);
      } catch (migrationErr) {
        await client.query('ROLLBACK');
        console.error(`❌ Migration failed [${file}]:`, migrationErr.message);
        throw migrationErr;
      }
    }

    if (pendingCount === 0) {
      console.log('🎉 Database is up to date! No pending migrations.');
    } else {
      console.log(`🎉 Completed ${pendingCount} pending migration(s) successfully.`);
    }

    // Sync sequence counters for auto-incrementing primary keys
    try {
      await client.query(`
        SELECT setval(pg_get_serial_sequence('order_items', 'id'), COALESCE(max(id), 1)) FROM order_items;
        SELECT setval(pg_get_serial_sequence('categories', 'id'), COALESCE(max(id), 1)) FROM categories;
        SELECT setval(pg_get_serial_sequence('payments', 'id'), COALESCE(max(id), 1)) FROM payments;
      `);
      console.log('🔄 Serial sequence counters synchronized successfully.');
    } catch {
      // Ignore if table or sequence does not exist yet
    }

  } catch (err) {
    console.error('❌ Migration process halted due to error:', err);
    process.exit(1);
  } finally {
    if (client) client.release();
    // Only close pool if running directly as a standalone CLI script
    if (process.argv[1] && process.argv[1].includes('migrate.js')) {
      if (pool) await pool.end();
    }
  }

  console.log('=================================================');
}

// Auto-run only if executed directly via node CLI
if (process.argv[1] && process.argv[1].includes('migrate.js')) {
  runMigrations();
}
