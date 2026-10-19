import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/authMiddleware.js';
import {
  listDatabaseBackups,
  createDatabaseBackup,
  getBackupDownloadUrl,
  detectPgDump,
  MAX_BACKUPS_RETAINED,
  BACKUP_BUCKET,
  MANILA_TIMEZONE,
  formatManilaDateTime,
} from '../services/backupService.js';

const router = Router();

/**
 * GET /api/admin/backups
 * Returns list of verified backups in private storage and system status.
 * Restricted to authenticated Admin users only.
 */
router.get('/admin/backups', requireAuth, requireRole(['admin']), async (req, res) => {
  try {
    const adminEmail = req.user?.email || req.user?.username || 'Admin';
    console.log(`[ADMIN AUDIT] Backup list requested by admin: ${adminEmail}`);

    const [backups, pgDumpInfo] = await Promise.all([
      listDatabaseBackups(),
      detectPgDump(),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        backups,
        totalBackups: backups.length,
        retentionLimit: MAX_BACKUPS_RETAINED,
        storageBucket: BACKUP_BUCKET,
        storagePrivate: true,
        timezone: MANILA_TIMEZONE,
        nextScheduledTime: '03:00 AM (Asia/Manila)',
        activeEngine: pgDumpInfo.available ? `pg_dump (${pgDumpInfo.path})` : 'Native PostgreSQL Schema & Data Dumper',
        timestamp: new Date().toISOString(),
      },
    });
  } catch (err) {
    console.error('[BACKUP API ERROR] Failed to retrieve backups:', err.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve database backups list',
      error: err.message,
    });
  }
});

/**
 * POST /api/admin/backups/run
 * Triggers a manual database backup.
 * Restricted to authenticated Admin users only.
 * Mutual exclusion prevents concurrent backup executions.
 */
router.post('/api/admin/backups/run', requireAuth, requireRole(['admin']), async (req, res) => {
  const adminEmail = req.user?.email || req.user?.username || 'Admin';
  const startTime = Date.now();
  console.log(`[ADMIN AUDIT] Manual database backup initiated by admin: ${adminEmail}`);

  try {
    const backupResult = await createDatabaseBackup({
      triggeredBy: 'manual_admin',
      userEmail: adminEmail,
    });

    console.log(`[ADMIN AUDIT] Manual backup completed successfully for ${adminEmail}: ${backupResult.filename}`);

    return res.status(200).json({
      success: true,
      message: 'Database backup completed, verified, and uploaded successfully.',
      data: backupResult,
    });
  } catch (err) {
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.error(`[ADMIN AUDIT] Manual backup failed after ${duration}s: ${err.message}`);

    const isConflict = err.message?.includes('already running') || err.message?.includes('currently in progress');
    return res.status(isConflict ? 409 : 500).json({
      success: false,
      message: err.message || 'Database backup execution failed',
      durationSeconds: duration,
    });
  }
});

// Support both /api/admin/backups/run and /admin/backups/run when mounted under /api
router.post('/admin/backups/run', requireAuth, requireRole(['admin']), async (req, res) => {
  const adminEmail = req.user?.email || req.user?.username || 'Admin';
  const startTime = Date.now();
  console.log(`[ADMIN AUDIT] Manual database backup initiated by admin: ${adminEmail}`);

  try {
    const backupResult = await createDatabaseBackup({
      triggeredBy: 'manual_admin',
      userEmail: adminEmail,
    });

    console.log(`[ADMIN AUDIT] Manual backup completed successfully for ${adminEmail}: ${backupResult.filename}`);

    return res.status(200).json({
      success: true,
      message: 'Database backup completed, verified, and uploaded successfully.',
      data: backupResult,
    });
  } catch (err) {
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.error(`[ADMIN AUDIT] Manual backup failed after ${duration}s: ${err.message}`);

    const isConflict = err.message?.includes('already running') || err.message?.includes('currently in progress');
    return res.status(isConflict ? 409 : 500).json({
      success: false,
      message: err.message || 'Database backup execution failed',
      durationSeconds: duration,
    });
  }
});

/**
 * GET /api/admin/backups/download/:filename
 * Generates a short-lived (60-second) signed URL to securely download a backup.
 * Strictly verifies admin role and validates filename against path traversal.
 */
router.get('/admin/backups/download/:filename', requireAuth, requireRole(['admin']), async (req, res) => {
  const { filename } = req.params;
  const adminEmail = req.user?.email || req.user?.username || 'Admin';

  console.log(`[ADMIN AUDIT] Backup download requested for '${filename}' by admin: ${adminEmail}`);

  try {
    const downloadInfo = await getBackupDownloadUrl(filename);

    console.log(`[ADMIN AUDIT] Signed download URL generated for '${filename}' (Expires in 60s)`);

    return res.status(200).json({
      success: true,
      message: 'Signed download URL generated successfully. Valid for 60 seconds.',
      data: downloadInfo,
    });
  } catch (err) {
    console.error(`[ADMIN AUDIT] Download request rejected for '${filename}': ${err.message}`);

    const isNotFound = err.message?.includes('not found');
    const isForbidden = err.message?.includes('Access denied');

    return res.status(isForbidden ? 403 : isNotFound ? 404 : 400).json({
      success: false,
      message: err.message || 'Failed to generate download URL for backup',
    });
  }
});

export default router;
