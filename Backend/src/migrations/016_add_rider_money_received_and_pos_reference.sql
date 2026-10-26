-- ==============================================================================
-- Migration: 016_add_rider_money_received_and_pos_reference.sql
-- Description: Adds rider_cash_received to orders and deliveries, adds payment_reference
--              and payment_method to orders table, and relaxes payments check constraint
--              for flexible multi-channel POS (Hybrid, GCash, Maya, COD).
-- ==============================================================================

-- 1. Add rider_cash_received to orders and deliveries
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS rider_cash_received NUMERIC(10,2);

ALTER TABLE deliveries
  ADD COLUMN IF NOT EXISTS rider_cash_received NUMERIC(10,2);

-- 2. Add payment_reference and payment_method directly on orders table
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS payment_reference VARCHAR(255);

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS payment_method VARCHAR(255);

-- 3. Relax payments table check constraint to support HYBRID, MAYA, COD, etc.
ALTER TABLE payments
  DROP CONSTRAINT IF EXISTS payments_payment_method_check;
