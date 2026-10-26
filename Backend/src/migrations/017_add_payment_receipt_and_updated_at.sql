-- ==============================================================================
-- Migration: 017_add_payment_receipt_and_updated_at.sql
-- Description: Adds payment_receipt directly to orders table and ensures updated_at
--              exists on payments table so updates never fail.
-- ==============================================================================

-- 1. Add payment_receipt directly on orders table
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS payment_receipt TEXT;

-- 2. Ensure updated_at exists on payments table
ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
