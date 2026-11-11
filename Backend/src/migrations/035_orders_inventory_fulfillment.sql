-- ============================================================================
-- MIGRATION: 035_orders_inventory_fulfillment.sql
-- 034 was extended with orders.inventory_fulfillment after some databases had
-- already applied it. Re-assert the column so every database has it.
-- ============================================================================
ALTER TABLE orders ADD COLUMN IF NOT EXISTS inventory_fulfillment VARCHAR(20);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS inventory_prep_started_at TIMESTAMPTZ;
