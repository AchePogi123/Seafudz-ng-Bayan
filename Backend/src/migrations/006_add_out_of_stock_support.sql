-- ============================================
-- MIGRATION: Add Out-of-Stock Handling Support
-- Date: 2026-10-12
-- Description: Adds item-level status tracking,
--   expands order/payment status constraints,
--   and adds refund amount tracking.
-- ============================================

-- 1. Add item_status column to order_items
ALTER TABLE order_items
  ADD COLUMN IF NOT EXISTS item_status VARCHAR(50) DEFAULT 'ACTIVE';

-- Drop existing constraint if present, then recreate
DO $$
BEGIN
  ALTER TABLE order_items DROP CONSTRAINT IF EXISTS order_items_item_status_check;
  ALTER TABLE order_items ADD CONSTRAINT order_items_item_status_check
    CHECK (item_status IN ('ACTIVE', 'OUT_OF_STOCK', 'REPLACED', 'REFUNDED'));
EXCEPTION WHEN others THEN
  RAISE NOTICE 'order_items item_status constraint already exists or error: %', SQLERRM;
END $$;

-- 2. Expand orders.status CHECK constraint to include OUT_OF_STOCK
DO $$
BEGIN
  ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;
  ALTER TABLE orders ADD CONSTRAINT orders_status_check
    CHECK (status IN (
      'PENDING',
      'IN_PROCESS',
      'COMPLETED',
      'CANCELLED',
      'CONFIRMED',
      'PREPARING',
      'READY',
      'OUT_FOR_DELIVERY',
      'GCASH_PENDING_APPROVAL',
      'GCASH_AUTHORIZED',
      'RECEIPT_SUBMITTED',
      'RECEIPT_REJECTED',
      'PENDING_COD',
      'FLAGGED',
      'OUT_OF_STOCK'
    ));
EXCEPTION WHEN others THEN
  RAISE NOTICE 'orders status constraint update note: %', SQLERRM;
END $$;

-- 3. Expand payments.status CHECK constraint to include PARTIALLY_REFUNDED
DO $$
BEGIN
  ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_status_check;
  ALTER TABLE payments ADD CONSTRAINT payments_status_check
    CHECK (status IN (
      'PENDING',
      'PAID',
      'FAILED',
      'REFUNDED',
      'PARTIALLY_REFUNDED'
    ));
EXCEPTION WHEN others THEN
  RAISE NOTICE 'payments status constraint update note: %', SQLERRM;
END $$;

-- 4. Add refunded_amount column to payments
ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS refunded_amount NUMERIC(10,2) DEFAULT 0;

-- 5. Expand kitchen_orders.status CHECK constraint to include OUT_OF_STOCK
DO $$
BEGIN
  ALTER TABLE kitchen_orders DROP CONSTRAINT IF EXISTS kitchen_orders_status_check;
  ALTER TABLE kitchen_orders ADD CONSTRAINT kitchen_orders_status_check
    CHECK (status IN (
      'PENDING',
      'IN_PROCESS',
      'COMPLETED',
      'CANCELLED',
      'OUT_OF_STOCK'
    ));
EXCEPTION WHEN others THEN
  RAISE NOTICE 'kitchen_orders status constraint update note: %', SQLERRM;
END $$;
