import { Connector } from '@google-cloud/cloud-sql-connector';
import pg from 'pg';
import dotenv from 'dotenv';

// Load environment variables from .env
dotenv.config();

const { Pool } = pg;

let pool;

/**
 * Initializes and returns a PostgreSQL connection pool using process.env.
 * Supports both Google Cloud SQL Connector (for GCP/production)
 * and standard TCP pool (for local pgAdmin / PostgreSQL).
 */
export async function getDbPool() {
  if (pool) return pool;

  const connectionString = process.env.DATABASE_URL;
  const instanceConnectionName = process.env.INSTANCE_CONNECTION_NAME;

  // Resolve host, user, password, port, db name with fallbacks to Railway PG* env vars
  const rawHost = process.env.DB_HOST || process.env.PGHOST || 'localhost';
  const dbHost = rawHost.includes('${{') ? (process.env.PGHOST || 'localhost') : rawHost;

  const rawPort = process.env.DB_PORT || process.env.PGPORT || '5432';
  const dbPort = parseInt(rawPort.includes('${{') ? (process.env.PGPORT || '5432') : rawPort, 10);

  const rawUser = process.env.DB_USER || process.env.PGUSER || 'postgres';
  const dbUser = rawUser.includes('${{') ? (process.env.PGUSER || 'postgres') : rawUser;

  const rawPass = process.env.DB_PASSWORD !== undefined ? process.env.DB_PASSWORD : (process.env.PGPASSWORD || process.env.POSTGRES_PASSWORD || '');
  const dbPassword = String(rawPass.includes('${{') ? (process.env.PGPASSWORD || process.env.POSTGRES_PASSWORD || '') : rawPass);

  const rawName = process.env.DB_NAME || process.env.PGDATABASE || process.env.POSTGRES_DB || 'seafudz_db';
  const dbName = rawName.includes('${{') ? (process.env.PGDATABASE || process.env.POSTGRES_DB || 'seafudz_db') : rawName;

  if (connectionString && !connectionString.includes('${{')) {
    console.log('[DB] Initializing PostgreSQL Pool with DATABASE_URL');
    pool = new Pool({
      connectionString,
      max: parseInt(process.env.DB_POOL_MAX || '10', 10),
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });
  } else if (instanceConnectionName) {
    // Cloud SQL Connector setup with timeout safety
    console.log(`[DB] Initializing Cloud SQL Connector for: ${instanceConnectionName}`);
    try {
      const connector = new Connector();
      const optionsPromise = connector.getOptions({
        instanceConnectionName,
        ipType: process.env.IP_TYPE || 'PUBLIC',
      });
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Cloud SQL Connector options timeout')), 3000)
      );
      const clientOpts = await Promise.race([optionsPromise, timeoutPromise]);

      pool = new Pool({
        ...clientOpts,
        user: dbUser,
        password: dbPassword,
        database: dbName,
        max: parseInt(process.env.DB_POOL_MAX || '10', 10),
        idleTimeoutMillis: 30000,
      });
    } catch (connErr) {
      console.warn(`[WARN] Cloud SQL Connector note (${connErr.message}). Using standard TCP pool.`);
      pool = new Pool({
        host: dbHost,
        port: dbPort,
        user: dbUser,
        password: dbPassword,
        database: dbName,
        max: parseInt(process.env.DB_POOL_MAX || '10', 10),
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 3000,
      });
    }
  } else {
    // Standard PostgreSQL pool using process.env
    console.log(`[DB] Initializing PostgreSQL Pool (Host: ${dbHost}:${dbPort}, User: ${dbUser}, Database: ${dbName})`);
    pool = new Pool({
      host: dbHost,
      port: dbPort,
      user: dbUser,
      password: dbPassword,
      database: dbName,
      max: parseInt(process.env.DB_POOL_MAX || '10', 10),
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });
  }

  pool.on('error', (err) => {
    console.error('[ERROR] Unexpected database pool error:', err);
  });

  return pool;
}

/**
 * Executes a SQL query using the process.env initialized connection pool.
 */
export async function query(text, params) {
  const dbPool = await getDbPool();
  return dbPool.query(text, params);
}

/**
 * Tests the PostgreSQL connection initialized with process.env credentials.
 */
export async function testDbConnection() {
  try {
    const res = await query('SELECT NOW() AS current_time, current_database() AS db_name');
    const { current_time, db_name } = res.rows[0];
    console.log(`[DB] PostgreSQL Connected Successfully!`);
    console.log(`   Database: ${db_name} | Host: ${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || '5432'}`);
    return { connected: true, database: db_name, time: current_time };
  } catch (err) {
    console.error(`[ERROR] PostgreSQL Connection Error: ${err.message}`);
    console.error(`[INFO] Verify process.env values in Backend/.env (DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME)`);
    return { connected: false, error: err.message };
  }
}

export default {
  getDbPool,
  query,
  testDbConnection,
};
