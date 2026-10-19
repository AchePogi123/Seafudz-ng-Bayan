import test from 'node:test';
import assert from 'node:assert/strict';
import zlib from 'zlib';
import pg from 'pg';
import { promisify } from 'util';
import {
  ensureBackupBucket,
  detectPgDump,
  createDatabaseBackup,
  listDatabaseBackups,
  getBackupDownloadUrl,
  enforceRetentionPolicy,
  MAX_BACKUPS_RETAINED,
  BACKUP_BUCKET,
  BACKUP_FILENAME_REGEX,
} from '../services/backupService.js';
import { supabase } from '../config/supabase.js';
import { getDbPool } from '../config/db.js';
import { generateSessionHashToken } from '../cryptography/hashToken.js';

const gunzipAsync = promisify(zlib.gunzip);

test('1. Supabase Storage bucket verification and privacy', async () => {
  const isBucketReady = await ensureBackupBucket();
  assert.equal(isBucketReady, true, 'Bucket must exist or be created');

  const { data: buckets, error } = await supabase.storage.listBuckets();
  assert.equal(error, null, 'Listing buckets must not error');

  const bucket = buckets.find((b) => b.name === BACKUP_BUCKET);
  assert.ok(bucket, `Bucket '${BACKUP_BUCKET}' must exist`);
  assert.equal(bucket.public, false, `Bucket '${BACKUP_BUCKET}' must be PRIVATE (public: false)`);
});

test('2. Backup tool detection', async () => {
  const toolInfo = await detectPgDump();
  assert.ok(typeof toolInfo.available === 'boolean', 'Tool detection must return boolean available');
  console.log('   [Test] Backup Tool Status:', toolInfo.available ? `pg_dump at ${toolInfo.path}` : 'Native PostgreSQL Dumper fallback');
});

test('3. Complete database backup generation, gzip compression, and schema validation', async () => {
  const backupRes = await createDatabaseBackup({ triggeredBy: 'automated_test_suite' });

  assert.equal(backupRes.success, true, 'Backup execution must succeed');
  assert.ok(BACKUP_FILENAME_REGEX.test(backupRes.filename), 'Filename must match seafudz_backup_YYYY-MM-DD_HHmmss.sql.gz');
  assert.ok(backupRes.sizeBytes > 1000, 'Backup size must be non-empty and greater than 1KB');

  // Verify file download and gzip decompression integrity
  const { data: blob, error } = await supabase.storage.from(BACKUP_BUCKET).download(backupRes.filename);
  assert.equal(error, null, 'Must download generated backup from Supabase');

  const buffer = Buffer.from(await blob.arrayBuffer());
  const decompressed = (await gunzipAsync(buffer)).toString('utf8');

  assert.ok(decompressed.includes('CREATE TABLE'), 'Dump must contain CREATE TABLE statements');
  assert.ok(decompressed.includes('orders'), 'Dump must contain orders table');
  assert.ok(decompressed.includes('products'), 'Dump must contain products table');
  assert.ok(decompressed.includes('employees'), 'Dump must contain employees table');
});

test('4. Full restoration verification in separate test database', async () => {
  const backups = await listDatabaseBackups();
  assert.ok(backups.length > 0, 'At least one backup must exist for restoration test');

  const latestBackup = backups[0];
  const { data: blob, error } = await supabase.storage.from(BACKUP_BUCKET).download(latestBackup.filename);
  assert.equal(error, null, 'Downloaded backup must succeed');

  const buffer = Buffer.from(await blob.arrayBuffer());
  const decompressedSql = (await gunzipAsync(buffer)).toString('utf8');

  const mainPool = await getDbPool();
  const testDbName = 'seafudz_restore_verify_test';

  try {
    await mainPool.query(`DROP DATABASE IF EXISTS ${testDbName}`);
  } catch {}
  await mainPool.query(`CREATE DATABASE ${testDbName}`);

  const testPool = new pg.Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
    database: testDbName,
  });

  try {
    await testPool.query(decompressedSql);

    const tablesRes = await testPool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `);

    assert.ok(tablesRes.rows.length >= 10, 'Restored database must contain at least 10 tables');
    const tableNames = tablesRes.rows.map((r) => r.table_name);
    assert.ok(tableNames.includes('orders'), 'Restored DB must contain orders');
    assert.ok(tableNames.includes('products'), 'Restored DB must contain products');
    assert.ok(tableNames.includes('employees'), 'Restored DB must contain employees');

    const ordersCount = (await testPool.query('SELECT count(*) FROM orders')).rows[0].count;
    assert.ok(Number(ordersCount) >= 0, 'Orders count query must succeed');
  } finally {
    await testPool.end();
    await mainPool.query(`DROP DATABASE ${testDbName}`);
  }
});

test('5. 30-backup rolling retention policy and non-backup preservation', async () => {
  const dummyBackups = [];
  for (let i = 1; i <= 35; i++) {
    const day = String(i).padStart(2, '0');
    dummyBackups.push(`seafudz_backup_2025-01-${day}_030000.sql.gz`);
  }

  for (const name of dummyBackups) {
    await supabase.storage.from(BACKUP_BUCKET).upload(name, Buffer.from('mock_test_content'), { upsert: true });
  }

  await supabase.storage.from(BACKUP_BUCKET).upload('safe_manual_report.txt', Buffer.from('important'), { upsert: true });

  const result = await enforceRetentionPolicy();
  assert.ok(result.cleaned >= 5, 'Must clean up excess backups');

  const { data: listAfter } = await supabase.storage.from(BACKUP_BUCKET).list('', { limit: 1000 });
  const matchingBackups = listAfter.filter((f) => BACKUP_FILENAME_REGEX.test(f.name));
  assert.equal(matchingBackups.length, MAX_BACKUPS_RETAINED, 'Must keep exactly 30 backups');

  const safeFile = listAfter.find((f) => f.name === 'safe_manual_report.txt');
  assert.ok(safeFile, 'Non-backup files must NOT be deleted');

  // Clean up mock files
  await supabase.storage.from(BACKUP_BUCKET).remove(dummyBackups.concat(['safe_manual_report.txt']));
});

test('6. Download signed URL generation and path traversal protection', async () => {
  const backups = await listDatabaseBackups();
  assert.ok(backups.length > 0, 'Must have backups to test download');

  const validFilename = backups[0].filename;
  const downloadInfo = await getBackupDownloadUrl(validFilename);

  assert.ok(downloadInfo.signedUrl, 'Signed URL must be generated');
  assert.ok(downloadInfo.signedUrl.startsWith('http'), 'Signed URL must be a valid HTTP URL');
  assert.equal(downloadInfo.expiresInSeconds, 60, 'Signed URL must be short-lived (60s)');

  // Test path traversal attempt
  await assert.rejects(
    async () => {
      await getBackupDownloadUrl('../../etc/passwd');
    },
    { message: /Access denied|Invalid filename/ },
    'Path traversal attempt must be rejected'
  );

  await assert.rejects(
    async () => {
      await getBackupDownloadUrl('random_file.sql');
    },
    { message: /Access denied|Invalid filename/ },
    'Non-standard filename must be rejected'
  );
});

test('7. Distributed advisory lock prevents concurrent executions', async () => {
  const pool = await getDbPool();
  const client = await pool.connect();
  const LOCK_ID = 84729184;

  try {
    // Acquire the lock manually
    const lockRes = await client.query('SELECT pg_try_advisory_lock($1) AS acquired', [LOCK_ID]);
    assert.equal(lockRes.rows[0].acquired, true, 'Manual advisory lock acquisition must succeed');

    // Attempt to run backup while lock is held
    await assert.rejects(
      async () => {
        await createDatabaseBackup({ triggeredBy: 'concurrency_test' });
      },
      { message: /currently in progress/ },
      'Backup must fail when advisory lock is held by another process'
    );
  } finally {
    await client.query('SELECT pg_advisory_unlock($1)', [LOCK_ID]);
    client.release();
  }
});

test('8. Historical transactions Excel (.xlsx) export and schema integrity', async () => {
  const { generateTransactionsExcel } = await import('../services/transactionExportService.js');
  const ExcelJS = (await import('exceljs')).default;

  const exportResult = await generateTransactionsExcel({ period: 'all' });
  assert.equal(exportResult.totalRecords, 33, 'All 33 historical database orders must be exported');
  assert.ok(exportResult.grossRevenue > 30000, 'Gross revenue must accurately sum historical totals');
  assert.ok(exportResult.buffer.byteLength > 10000, 'Excel buffer size must be valid (>10KB)');

  // Verify that the buffer is a readable ExcelJS workbook with all 3 sheets
  const testWb = new ExcelJS.Workbook();
  await testWb.xlsx.load(exportResult.buffer);

  assert.equal(testWb.worksheets.length, 3, 'Exported workbook must contain exactly 3 sheets');
  assert.equal(testWb.worksheets[0].name, 'Transactions Ledger');
  assert.equal(testWb.worksheets[1].name, 'Itemized Breakdown');
  assert.equal(testWb.worksheets[2].name, 'Executive Summary');

  // Verify sheet contents: Ledger must have headers and data rows
  const ledgerSheet = testWb.getWorksheet('Transactions Ledger');
  assert.ok(ledgerSheet.rowCount >= 35, 'Ledger must contain headers, 33 orders, and summary row');

  // Verify refunds and cancellations exist in the sheet
  let foundCancelled = false;
  let foundRefundAmount = false;
  ledgerSheet.eachRow((row) => {
    const statusVal = String(row.getCell(7).value || '');
    if (statusVal === 'CANCELLED') foundCancelled = true;
    const refundVal = Number(row.getCell(18).value || 0);
    if (refundVal > 0) foundRefundAmount = true;
  });

  assert.ok(foundCancelled, 'Ledger must contain records with CANCELLED status');
  assert.ok(foundRefundAmount, 'Ledger must contain records with refund amounts');
});

test('9. Admin-only export authorization and RBAC verification', async () => {
  const adminTokenObj = generateSessionHashToken({
    userId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a55',
    email: 'admin@seafudz.ph',
    role: 'admin',
  });

  const cashierTokenObj = generateSessionHashToken({
    userId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    email: 'cashier@seafudz.ph',
    role: 'cashier',
  });

  // Test preview endpoint
  const cashierPrev = await fetch('http://localhost:5000/api/admin/export/transactions/preview?period=all', {
    headers: { Authorization: `Bearer ${cashierTokenObj.sessionToken}` },
  });
  assert.equal(cashierPrev.status, 403, 'Cashier must be blocked with 403 Forbidden from export preview');

  const adminPrev = await fetch('http://localhost:5000/api/admin/export/transactions/preview?period=all', {
    headers: { Authorization: `Bearer ${adminTokenObj.sessionToken}` },
  });
  assert.equal(adminPrev.status, 200, 'Admin must receive 200 OK for export preview');
  const prevJson = await adminPrev.json();
  assert.equal(prevJson.data?.totalRecords, 33, 'Preview must reflect all 33 historical records');

  // Test excel download endpoint
  const cashierDl = await fetch('http://localhost:5000/api/admin/export/transactions/excel?period=all', {
    headers: { Authorization: `Bearer ${cashierTokenObj.sessionToken}` },
  });
  assert.equal(cashierDl.status, 403, 'Cashier must be blocked with 403 Forbidden from Excel download');

  const adminDl = await fetch('http://localhost:5000/api/admin/export/transactions/excel?period=all', {
    headers: { Authorization: `Bearer ${adminTokenObj.sessionToken}` },
  });
  assert.equal(adminDl.status, 200, 'Admin must receive 200 OK for Excel download');
  assert.ok(
    adminDl.headers.get('content-type')?.includes('spreadsheetml'),
    'Response must be Excel spreadsheetml content type'
  );

  const p = await getDbPool();
  await p.end();
});

