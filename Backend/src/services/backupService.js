import zlib from 'zlib';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawn } from 'child_process';
import { promisify } from 'util';
import { pipeline } from 'stream';
import { getDbPool, query } from '../config/db.js';
import { supabase } from '../config/supabase.js';

const streamPipeline = promisify(pipeline);
const gunzipAsync = promisify(zlib.gunzip);

// Core configuration constants
export const BACKUP_BUCKET = 'database-backups';
export const MAX_BACKUPS_RETAINED = 30;
export const BACKUP_FILENAME_PREFIX = 'seafudz_backup_';
export const BACKUP_FILENAME_REGEX = /^seafudz_backup_(\d{4}-\d{2}-\d{2}_\d{6})\.sql\.gz$/;
export const BACKUP_ADVISORY_LOCK_ID = 84729184; // 64-bit bigint identifier for distributed lock
export const MANILA_TIMEZONE = 'Asia/Manila';

// In-process lock tracker
let isLocalBackupRunning = false;
let schedulerIntervalId = null;

/**
 * Returns formatted timestamp string for Asia/Manila timezone
 * Format: YYYY-MM-DD_HHmmss
 */
export function getManilaTimestampString(date = new Date()) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: MANILA_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const parts = formatter.formatToParts(date).reduce((acc, p) => ({ ...acc, [p.type]: p.value }), {});
  return `${parts.year}-${parts.month}-${parts.day}_${parts.hour}${parts.minute}${parts.second}`;
}

/**
 * Formats a Date object into human-readable Manila time
 */
export function formatManilaDateTime(date) {
  if (!date) return 'Unknown';
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return 'Invalid Date';
  return new Intl.DateTimeFormat('en-PH', {
    timeZone: MANILA_TIMEZONE,
    dateStyle: 'medium',
    timeStyle: 'medium',
  }).format(d);
}

/**
 * Checks whether the private Supabase Storage bucket exists.
 * If not, creates it as a private bucket (public: false).
 */
export async function ensureBackupBucket() {
  try {
    const { data: buckets, error: listErr } = await supabase.storage.listBuckets();
    if (listErr) {
      console.warn(`[BACKUP] Warning listing storage buckets: ${listErr.message}`);
    }

    const bucket = buckets?.find((b) => b.name === BACKUP_BUCKET);
    if (!bucket) {
      console.log(`[BACKUP] Bucket '${BACKUP_BUCKET}' does not exist. Creating private bucket...`);
      const { data: createData, error: createErr } = await supabase.storage.createBucket(BACKUP_BUCKET, {
        public: false,
      });
      if (createErr && !createErr.message?.includes('already exists')) {
        throw new Error(`Failed to create private bucket '${BACKUP_BUCKET}': ${createErr.message}`);
      }
      console.log(`[BACKUP] Private bucket '${BACKUP_BUCKET}' verified/created.`);
      return true;
    }

    if (bucket.public) {
      console.warn(`[SECURITY WARNING] Bucket '${BACKUP_BUCKET}' is currently public! Attempting to make private...`);
      try {
        await supabase.storage.updateBucket(BACKUP_BUCKET, { public: false });
        console.log(`[BACKUP] Successfully set '${BACKUP_BUCKET}' to private.`);
      } catch (secErr) {
        console.error(`[SECURITY ERROR] Failed to enforce private status on bucket: ${secErr.message}`);
      }
    }

    return true;
  } catch (err) {
    console.error(`[BACKUP] Error ensuring backup bucket '${BACKUP_BUCKET}': ${err.message}`);
    throw err;
  }
}

/**
 * Detects whether pg_dump utility is available on this system.
 */
export async function detectPgDump() {
  const customPath = process.env.PG_DUMP_PATH;
  const candidates = [customPath, 'pg_dump', '/usr/bin/pg_dump', '/usr/local/bin/pg_dump'].filter(Boolean);

  for (const bin of candidates) {
    try {
      const isAvailable = await new Promise((resolve) => {
        const proc = spawn(bin, ['--version'], { stdio: ['ignore', 'pipe', 'ignore'] });
        proc.on('error', () => resolve(false));
        proc.on('close', (code) => resolve(code === 0));
      });
      if (isAvailable) {
        return { available: true, path: bin };
      }
    } catch {
      // Continue checking next candidate
    }
  }

  return { available: false, path: null };
}

/**
 * Escapes SQL string value safely for SQL INSERT statements
 */
function sqlEscapeValue(val, udtName = '') {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
  if (typeof val === 'number') {
    if (!Number.isFinite(val)) return 'NULL';
    return String(val);
  }
  if (val instanceof Date) {
    return `'${val.toISOString()}'`;
  }
  if (typeof val === 'object') {
    // JSON or array
    const jsonStr = JSON.stringify(val);
    const escaped = jsonStr.replace(/'/g, "''");
    return `'${escaped}'::jsonb`;
  }
  // Standard string
  const str = String(val);
  const escaped = str.replace(/'/g, "''");
  if (udtName === 'uuid') {
    return `'${escaped}'::uuid`;
  }
  return `'${escaped}'`;
}

/**
 * Pure Node.js resilient PostgreSQL schema and data dump generator.
 * Used whenever pg_dump is not present in the runtime environment.
 * Generates valid SQL containing:
 * - Extensions (uuid-ossp, pgcrypto)
 * - Sequences & current sequence values
 * - Complete table DDL (columns, types, defaults, nullability)
 * - Primary keys, unique constraints, foreign keys
 * - Indexes
 * - Complete table data rows as SQL INSERTs
 * - Safe replica session handling for foreign key dependency resolution during restore
 */
export async function generateNativePostgresDumpStream(writableStream) {
  const pool = await getDbPool();
  const write = (text) => writableStream.write(text, 'utf8');

  // Header
  write(`--\n-- Seafudz ng Bayan Database Backup\n`);
  write(`-- Generated at: ${new Date().toISOString()} (Asia/Manila: ${formatManilaDateTime(new Date())})\n`);
  write(`-- Backup Engine: Seafudz Native PostgreSQL Dumper\n--\n\n`);
  write(`SET statement_timeout = 0;\n`);
  write(`SET lock_timeout = 0;\n`);
  write(`SET client_encoding = 'UTF8';\n`);
  write(`SET standard_conforming_strings = on;\n`);
  write(`SET check_function_bodies = false;\n`);
  write(`SET client_min_messages = warning;\n`);
  write(`SET row_security = off;\n\n`);

  // Ensure extensions
  write(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;\n`);
  write(`CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA public;\n\n`);

  // Disable triggers/foreign key checks during restore
  write(`SET session_replication_role = 'replica';\n\n`);

  // 1. Sequences
  const seqRes = await pool.query(`
    SELECT sequence_name 
    FROM information_schema.sequences 
    WHERE sequence_schema = 'public'
    ORDER BY sequence_name;
  `);

  for (const seq of seqRes.rows) {
    const sName = seq.sequence_name;
    write(`CREATE SEQUENCE IF NOT EXISTS "public"."${sName}";\n`);
    try {
      const valRes = await pool.query(`SELECT last_value, is_called FROM "public"."${sName}"`);
      if (valRes.rows.length > 0) {
        const { last_value, is_called } = valRes.rows[0];
        write(`SELECT setval('"public"."${sName}"', ${last_value}, ${is_called ? 'true' : 'false'});\n`);
      }
    } catch {
      // Continue if sequence value query fails
    }
  }
  write(`\n`);

  // 2. Discover Tables
  const tablesRes = await pool.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    ORDER BY table_name;
  `);
  const tables = tablesRes.rows.map((r) => r.table_name);

  // 3. For each table, generate DDL and insert data
  for (const table of tables) {
    write(`-- Table: ${table}\n`);
    write(`DROP TABLE IF EXISTS "public"."${table}" CASCADE;\n`);

    // Column definitions
    const colRes = await pool.query(
      `
      SELECT 
        column_name, 
        data_type, 
        udt_name,
        character_maximum_length,
        is_nullable, 
        column_default
      FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = $1
      ORDER BY ordinal_position;
    `,
      [table]
    );

    const colDefs = colRes.rows.map((col) => {
      let typeDef = col.data_type;
      if (col.data_type === 'character varying') {
        typeDef = col.character_maximum_length ? `varchar(${col.character_maximum_length})` : 'varchar';
      } else if (col.data_type === 'USER-DEFINED') {
        typeDef = col.udt_name;
      }

      let def = `  "${col.column_name}" ${typeDef}`;
      if (col.column_default) {
        def += ` DEFAULT ${col.column_default}`;
      }
      if (col.is_nullable === 'NO') {
        def += ` NOT NULL`;
      }
      return def;
    });

    write(`CREATE TABLE "public"."${table}" (\n${colDefs.join(',\n')}\n);\n\n`);

    // Fetch and write rows
    const dataRes = await pool.query(`SELECT * FROM "public"."${table}"`);
    if (dataRes.rows.length > 0) {
      const cols = colRes.rows.map((c) => c.column_name);
      const colMap = new Map(colRes.rows.map((c) => [c.column_name, c.udt_name]));
      const colsSql = cols.map((c) => `"${c}"`).join(', ');

      write(`-- Data for: ${table} (${dataRes.rows.length} rows)\n`);
      const BATCH_SIZE = 50;
      for (let i = 0; i < dataRes.rows.length; i += BATCH_SIZE) {
        const batch = dataRes.rows.slice(i, i + BATCH_SIZE);
        const valuesRows = batch.map((row) => {
          const vals = cols.map((col) => sqlEscapeValue(row[col], colMap.get(col)));
          return `(${vals.join(', ')})`;
        });
        write(`INSERT INTO "public"."${table}" (${colsSql}) VALUES\n${valuesRows.join(',\n')};\n`);
      }
      write(`\n`);
    }
  }

  // Functions (e.g. update_timestamp_column)
  write(`-- Functions\n`);
  write(`CREATE OR REPLACE FUNCTION public.update_timestamp_column() RETURNS trigger\n`);
  write(`LANGUAGE plpgsql\nAS $$\nBEGIN\n   NEW.updated_at = NOW();\n   RETURN NEW;\nEND;\n$$;\n\n`);

  // Constraints (Primary Keys, Foreign Keys, Unique, Check)
  const constraintsRes = await pool.query(`
    SELECT 
      tc.table_name,
      tc.constraint_name,
      tc.constraint_type,
      pg_get_constraintdef(c.oid) AS constraint_def
    FROM information_schema.table_constraints tc
    JOIN pg_constraint c ON c.conname = tc.constraint_name
    WHERE tc.table_schema = 'public' 
      AND tc.constraint_type IN ('PRIMARY KEY', 'UNIQUE', 'FOREIGN KEY', 'CHECK')
    ORDER BY 
      CASE tc.constraint_type 
        WHEN 'PRIMARY KEY' THEN 1 
        WHEN 'UNIQUE' THEN 2 
        WHEN 'CHECK' THEN 3 
        WHEN 'FOREIGN KEY' THEN 4 
      END;
  `);

  write(`-- Constraints\n`);
  for (const con of constraintsRes.rows) {
    if (con.constraint_def) {
      write(
        `ALTER TABLE "public"."${con.table_name}" ADD CONSTRAINT "${con.constraint_name}" ${con.constraint_def};\n`
      );
    }
  }
  write(`\n`);

  // Indexes (excluding constraint-backed indexes to avoid relation already exists errors)
  const indexesRes = await pool.query(`
    SELECT indexname, indexdef 
    FROM pg_indexes 
    WHERE schemaname = 'public' 
      AND indexname NOT IN (
        SELECT conname FROM pg_constraint WHERE connamespace = 'public'::regnamespace
      )
    ORDER BY indexname;
  `);

  write(`-- Indexes\n`);
  for (const idx of indexesRes.rows) {
    write(`${idx.indexdef};\n`);
  }
  write(`\n`);

  // Triggers
  const triggersRes = await pool.query(`
    SELECT trigger_name, event_manipulation, event_object_table, action_timing
    FROM information_schema.triggers 
    WHERE trigger_schema = 'public'
    ORDER BY trigger_name;
  `);

  write(`-- Triggers\n`);
  for (const trg of triggersRes.rows) {
    write(
      `DROP TRIGGER IF EXISTS "${trg.trigger_name}" ON "public"."${trg.event_object_table}";\n` +
      `CREATE TRIGGER "${trg.trigger_name}" ${trg.action_timing} ${trg.event_manipulation} ` +
      `ON "public"."${trg.event_object_table}" FOR EACH ROW EXECUTE FUNCTION update_timestamp_column();\n`
    );
  }
  write(`\n`);

  // Re-enable triggers/foreign keys
  write(`SET session_replication_role = 'origin';\n\n`);
  write(`-- Backup Completed Successfully --\n`);
  writableStream.end();
}

/**
 * Spawns pg_dump and pipes output to writableStream
 */
async function runPgDumpStream(pgDumpPath, writableStream) {
  const connectionString = process.env.DATABASE_URL;
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

  const args = ['--no-owner', '--no-acl', '--clean', '--if-exists', '--schema=public'];
  const env = { ...process.env };

  if (connectionString && !connectionString.includes('${{')) {
    args.push(`--dbname=${connectionString}`);
  } else {
    args.push(`--host=${dbHost}`);
    args.push(`--port=${dbPort}`);
    args.push(`--username=${dbUser}`);
    args.push(`--dbname=${dbName}`);
    if (dbPassword) {
      env.PGPASSWORD = dbPassword;
    }
  }

  return new Promise((resolve, reject) => {
    const dumpProc = spawn(pgDumpPath, args, { env, stdio: ['ignore', 'pipe', 'pipe'] });
    let stderr = '';

    dumpProc.stderr.on('data', (d) => {
      stderr += d.toString();
    });

    dumpProc.stdout.pipe(writableStream, { end: true });

    dumpProc.on('error', (err) => {
      reject(new Error(`Failed to start pg_dump process: ${err.message}`));
    });

    dumpProc.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`pg_dump exited with error code ${code}: ${stderr}`));
      }
    });
  });
}

/**
 * Validates the generated gzip backup file.
 * Ensures:
 * 1. File exists and is non-empty (> 100 bytes)
 * 2. Gunzip decompresses without errors (gzip integrity)
 * 3. Decompressed SQL contains necessary database structure (tables, inserts)
 */
export async function validateBackupFile(filePath) {
  const stats = await fs.promises.stat(filePath);
  if (stats.size < 100) {
    throw new Error(`Backup validation failed: Compressed file size too small (${stats.size} bytes).`);
  }

  const compressedBuffer = await fs.promises.readFile(filePath);
  let decompressedSql;
  try {
    decompressedSql = (await gunzipAsync(compressedBuffer)).toString('utf8');
  } catch (gzipErr) {
    throw new Error(`Backup validation failed: Gzip integrity check failed (${gzipErr.message}).`);
  }

  // Structural validation
  const requiredKeywords = ['CREATE TABLE', 'orders', 'order_items', 'products', 'employees'];
  const missingKeywords = requiredKeywords.filter((kw) => !decompressedSql.includes(kw));
  if (missingKeywords.length > 0) {
    throw new Error(`Backup validation failed: Missing expected schema structures: ${missingKeywords.join(', ')}`);
  }

  return {
    valid: true,
    compressedSize: stats.size,
    decompressedSize: Buffer.byteLength(decompressedSql, 'utf8'),
  };
}

/**
 * Enforces the 30-backup rolling retention policy.
 * Lists all backups, sorts by timestamp, and deletes only oldest excess files
 * strictly matching BACKUP_FILENAME_REGEX.
 */
export async function enforceRetentionPolicy() {
  try {
    const { data: files, error } = await supabase.storage.from(BACKUP_BUCKET).list('', {
      limit: 1000,
      sortBy: { column: 'name', order: 'asc' },
    });

    if (error) {
      console.error(`[BACKUP RETENTION] Error listing backups for retention check: ${error.message}`);
      return { cleaned: 0, retained: 0, error: error.message };
    }

    if (!files || files.length === 0) {
      return { cleaned: 0, retained: 0 };
    }

    // Strictly match our backup naming convention
    const backupFiles = files.filter((f) => BACKUP_FILENAME_REGEX.test(f.name));

    // Sort ascending (oldest first)
    backupFiles.sort((a, b) => a.name.localeCompare(b.name));

    if (backupFiles.length <= MAX_BACKUPS_RETAINED) {
      console.log(`[BACKUP RETENTION] ${backupFiles.length} backups present. (Limit: ${MAX_BACKUPS_RETAINED}). No deletion needed.`);
      return { cleaned: 0, retained: backupFiles.length };
    }

    const excessCount = backupFiles.length - MAX_BACKUPS_RETAINED;
    const filesToDelete = backupFiles.slice(0, excessCount).map((f) => f.name);

    console.log(`[BACKUP RETENTION] Found ${backupFiles.length} backups. Deleting ${excessCount} oldest file(s):`, filesToDelete);

    const { error: removeErr } = await supabase.storage.from(BACKUP_BUCKET).remove(filesToDelete);
    if (removeErr) {
      console.error(`[BACKUP RETENTION] Cleanup deletion error: ${removeErr.message}`);
      return { cleaned: 0, retained: backupFiles.length, error: removeErr.message };
    }

    console.log(`[BACKUP RETENTION] Successfully cleaned up ${filesToDelete.length} oldest backup(s).`);
    return { cleaned: filesToDelete.length, retained: MAX_BACKUPS_RETAINED };
  } catch (err) {
    console.error(`[BACKUP RETENTION] Retention enforcement failure: ${err.message}`);
    return { cleaned: 0, retained: 0, error: err.message };
  }
}

/**
 * Creates a complete database backup, compresses with gzip, validates it,
 * uploads to private Supabase storage, and enforces retention.
 *
 * Uses PostgreSQL distributed advisory lock to guarantee mutual exclusion
 * across multiple Railway backend instances.
 */
export async function createDatabaseBackup({ triggeredBy = 'manual', userEmail = null } = {}) {
  // 1. Process-level mutual exclusion
  if (isLocalBackupRunning) {
    throw new Error('A database backup is already running in this instance. Please wait for completion.');
  }

  const pool = await getDbPool();
  let client = null;
  let hasAdvisoryLock = false;

  try {
    isLocalBackupRunning = true;
    client = await pool.connect();

    // 2. Distributed mutual exclusion across all Railway instances
    const lockRes = await client.query('SELECT pg_try_advisory_lock($1) AS acquired', [BACKUP_ADVISORY_LOCK_ID]);
    hasAdvisoryLock = Boolean(lockRes.rows[0]?.acquired);

    if (!hasAdvisoryLock) {
      console.warn(`[BACKUP] Advisory lock (${BACKUP_ADVISORY_LOCK_ID}) already held by another instance/job.`);
      throw new Error('A database backup is currently in progress across backend instances. Please wait.');
    }

    const startTime = Date.now();
    const manilaTimestamp = getManilaTimestampString();
    const filename = `${BACKUP_FILENAME_PREFIX}${manilaTimestamp}.sql.gz`;
    const tempDir = os.tmpdir();
    const tempGzPath = path.join(tempDir, `${filename}.tmp_${Date.now()}`);

    console.log(`[BACKUP] >>> Starting database backup (${triggeredBy}) at ${new Date().toISOString()}`);
    console.log(`[BACKUP] Target Filename: ${filename}`);

    // Ensure bucket exists and is private
    await ensureBackupBucket();

    // 3. Detect pg_dump or choose resilient native dumper
    const pgDumpInfo = await detectPgDump();
    const gzipStream = zlib.createGzip({ level: 9 });
    const fileWriteStream = fs.createWriteStream(tempGzPath);

    if (pgDumpInfo.available) {
      console.log(`[BACKUP] Engine: System pg_dump utility (${pgDumpInfo.path})`);
      const dumpPipePromise = runPgDumpStream(pgDumpInfo.path, gzipStream);
      await Promise.all([dumpPipePromise, streamPipeline(gzipStream, fileWriteStream)]);
    } else {
      console.log(`[BACKUP] Engine: Resilient Native PostgreSQL Dumper (pg_dump binary not present in environment)`);
      const nativeDumpPromise = generateNativePostgresDumpStream(gzipStream);
      await Promise.all([nativeDumpPromise, streamPipeline(gzipStream, fileWriteStream)]);
    }

    // 4. Validate completed backup file
    console.log(`[BACKUP] Validating backup integrity and schema structures...`);
    const validation = await validateBackupFile(tempGzPath);
    console.log(`[BACKUP] Validation Passed! Compressed: ${validation.compressedSize} bytes, Uncompressed: ${validation.decompressedSize} bytes.`);

    // 5. Upload to Supabase Storage private bucket
    console.log(`[BACKUP] Uploading to Supabase Storage: '${BACKUP_BUCKET}/${filename}'...`);
    const fileBuffer = await fs.promises.readFile(tempGzPath);
    const { data: uploadData, error: uploadErr } = await supabase.storage.from(BACKUP_BUCKET).upload(filename, fileBuffer, {
      contentType: 'application/gzip',
      upsert: false,
    });

    if (uploadErr) {
      throw new Error(`Supabase Storage upload failed: ${uploadErr.message}`);
    }

    // Confirm file exists in bucket
    const { data: verifyList, error: verifyErr } = await supabase.storage.from(BACKUP_BUCKET).list('', {
      search: filename,
    });
    const uploadedRecord = verifyList?.find((f) => f.name === filename);
    if (verifyErr || !uploadedRecord) {
      throw new Error('Supabase Storage verification failed: Uploaded file not visible in bucket list.');
    }

    console.log(`[BACKUP] Successfully uploaded and confirmed: ${filename} (${uploadedRecord.metadata?.size || validation.compressedSize} bytes)`);

    // Clean up temporary local file
    try {
      await fs.promises.unlink(tempGzPath);
    } catch { }

    // 6. Enforce 30-backup rolling retention policy
    let retentionResult = { cleaned: 0, retained: 1 };
    try {
      retentionResult = await enforceRetentionPolicy();
    } catch (retErr) {
      console.error(`[BACKUP] Retention cleanup logged error (backup preserved): ${retErr.message}`);
    }

    const durationSeconds = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`[BACKUP] <<< Backup completed successfully in ${durationSeconds}s. Retained: ${retentionResult.retained}`);

    return {
      success: true,
      filename,
      sizeBytes: validation.compressedSize,
      durationSeconds,
      engine: pgDumpInfo.available ? 'pg_dump' : 'native_postgres_dumper',
      retention: retentionResult,
      timestamp: new Date().toISOString(),
      manilaDate: formatManilaDateTime(new Date()),
      triggeredBy,
    };
  } catch (err) {
    console.error(`[BACKUP ERROR] Database backup failed: ${err.message}`);
    throw err;
  } finally {
    isLocalBackupRunning = false;
    if (client && hasAdvisoryLock) {
      try {
        await client.query('SELECT pg_advisory_unlock($1)', [BACKUP_ADVISORY_LOCK_ID]);
      } catch (unlockErr) {
        console.warn(`[BACKUP] Warning releasing advisory lock: ${unlockErr.message}`);
      }
      client.release();
    } else if (client) {
      client.release();
    }
  }
}

/**
 * Lists available database backups in the private bucket.
 * Returns metadata sorted descending (newest first).
 */
export async function listDatabaseBackups() {
  await ensureBackupBucket();

  const { data: files, error } = await supabase.storage.from(BACKUP_BUCKET).list('', {
    limit: 1000,
    sortBy: { column: 'name', order: 'desc' },
  });

  if (error) {
    throw new Error(`Failed to list backups: ${error.message}`);
  }

  if (!files || files.length === 0) {
    return [];
  }

  const validBackups = files
    .filter((f) => BACKUP_FILENAME_REGEX.test(f.name))
    .map((f) => {
      const sizeBytes = f.metadata?.size || f.size || 0;
      let formattedSize = `${(sizeBytes / 1024).toFixed(1)} KB`;
      if (sizeBytes >= 1024 * 1024) {
        formattedSize = `${(sizeBytes / (1024 * 1024)).toFixed(2)} MB`;
      }

      // Extract timestamp from filename: seafudz_backup_YYYY-MM-DD_HHmmss.sql.gz
      const match = f.name.match(BACKUP_FILENAME_REGEX);
      const rawTimestamp = match ? match[1] : null;
      let manilaFormatted = f.created_at ? formatManilaDateTime(f.created_at) : 'Unknown';

      if (rawTimestamp) {
        const [dPart, tPart] = rawTimestamp.split('_');
        const [year, month, day] = dPart.split('-');
        const hour = tPart.slice(0, 2);
        const min = tPart.slice(2, 4);
        const sec = tPart.slice(4, 6);
        const parsedDate = new Date(`${year}-${month}-${day}T${hour}:${min}:${sec}+08:00`);
        if (!isNaN(parsedDate.getTime())) {
          manilaFormatted = formatManilaDateTime(parsedDate);
        }
      }

      return {
        filename: f.name,
        sizeBytes,
        formattedSize,
        createdAt: f.created_at || null,
        manilaFormatted,
        isVerified: true,
      };
    });

  // Sort newest first
  validBackups.sort((a, b) => b.filename.localeCompare(a.filename));
  return validBackups;
}

/**
 * Validates requested filename and generates a short-lived signed download URL (60 seconds)
 * for an authorized Admin.
 */
export async function getBackupDownloadUrl(filename) {
  if (!filename || typeof filename !== 'string') {
    throw new Error('Invalid filename provided.');
  }

  // Strict path traversal and naming pattern check
  if (!BACKUP_FILENAME_REGEX.test(filename) || filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
    throw new Error('Access denied: Filename does not match valid backup naming pattern.');
  }

  await ensureBackupBucket();

  // Verify file actually exists in bucket
  const { data: list, error: listErr } = await supabase.storage.from(BACKUP_BUCKET).list('', {
    search: filename,
  });

  if (listErr || !list?.some((f) => f.name === filename)) {
    throw new Error(`Backup file '${filename}' not found in storage.`);
  }

  // Generate 60-second short-lived signed download URL
  const { data, error } = await supabase.storage.from(BACKUP_BUCKET).createSignedUrl(filename, 60);
  if (error || !data?.signedUrl) {
    throw new Error(`Failed to generate signed download URL: ${error?.message || 'Unknown error'}`);
  }

  return {
    filename,
    signedUrl: data.signedUrl,
    expiresInSeconds: 60,
  };
}

/**
 * Checks if a backup has already been performed today (Asia/Manila time)
 */
export async function hasBackupForToday() {
  try {
    const todayPrefix = `seafudz_backup_${getManilaTimestampString().slice(0, 10)}`;
    const { data: files } = await supabase.storage.from(BACKUP_BUCKET).list('', {
      search: todayPrefix,
    });
    return Boolean(files && files.some((f) => f.name.startsWith(todayPrefix)));
  } catch {
    return false;
  }
}

/**
 * Starts the automatic daily backup scheduler.
 * Runs at 03:00 AM Asia/Manila time every day.
 * Includes concurrency prevention across multiple Railway instances.
 */
export function initBackupScheduler() {
  if (schedulerIntervalId) {
    clearInterval(schedulerIntervalId);
  }

  console.log(`[BACKUP SCHEDULER] Initializing 30-day automated rolling database backup scheduler.`);
  console.log(`[BACKUP SCHEDULER] Daily target: 03:00 AM ${MANILA_TIMEZONE}. Max retention: ${MAX_BACKUPS_RETAINED} backups.`);

  const checkSchedule = async () => {
    try {
      const nowManilaStr = new Date().toLocaleString('en-US', { timeZone: MANILA_TIMEZONE });
      const nowManila = new Date(nowManilaStr);
      const currentHour = nowManila.getHours();
      const currentMinute = nowManila.getMinutes();

      // Trigger if hour is 3 AM and minute is 0 (or up to 03:05 for startup leeway)
      if (currentHour === 3 && currentMinute <= 5) {
        const alreadyRanToday = await hasBackupForToday();
        if (alreadyRanToday) {
          return;
        }

        console.log(`[BACKUP SCHEDULER] Scheduled time (03:00 AM Manila) reached. Attempting distributed backup...`);
        try {
          await createDatabaseBackup({ triggeredBy: 'schedule' });
        } catch (jobErr) {
          // If lock was held by another Railway instance, this is expected and clean
          if (jobErr.message?.includes('currently in progress') || jobErr.message?.includes('already held')) {
            console.log(`[BACKUP SCHEDULER] Handled by another backend instance.`);
          } else {
            console.error(`[BACKUP SCHEDULER] Scheduled backup error: ${jobErr.message}`);
          }
        }
      }
    } catch (schedErr) {
      console.warn(`[BACKUP SCHEDULER] Periodic check note: ${schedErr.message}`);
    }
  };

  // Run check every 60 seconds
  schedulerIntervalId = setInterval(checkSchedule, 60000);

  // Also run initial check asynchronously
  setTimeout(checkSchedule, 5000);

  return schedulerIntervalId;
}

export default {
  ensureBackupBucket,
  detectPgDump,
  createDatabaseBackup,
  listDatabaseBackups,
  getBackupDownloadUrl,
  enforceRetentionPolicy,
  initBackupScheduler,
};
