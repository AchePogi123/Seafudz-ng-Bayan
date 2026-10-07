-- ============================================
-- 005_add_password_hash_columns.sql
-- Add password_hash column for robust dual-auth fallback
-- ============================================

ALTER TABLE employees ADD COLUMN IF NOT EXISTS password_hash TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS password_hash TEXT;
