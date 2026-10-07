-- ============================================
-- 004_create_password_resets.sql
-- Create table for storing password reset tokens
-- ============================================

CREATE TABLE IF NOT EXISTS password_resets (
    email VARCHAR(255) PRIMARY KEY,
    token VARCHAR(255) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
