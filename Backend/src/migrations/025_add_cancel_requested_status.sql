-- ============================================
-- MIGRATION: 025_add_cancel_requested_status.sql
-- Description: Adds CANCEL_REQUESTED status to orders_status_check
-- ============================================

DO $$
BEGIN
  ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;
  ALTER TABLE orders ADD CONSTRAINT orders_status_check
    CHECK (status IN (
      'PENDING', 'IN_PROCESS', 'COMPLETED', 'CANCELLED', 'CONFIRMED',
      'PREPARING', 'READY', 'OUT_FOR_DELIVERY', 'GCASH_PENDING_APPROVAL',
      'GCASH_AUTHORIZED', 'RECEIPT_SUBMITTED', 'RECEIPT_REJECTED',
      'PENDING_COD', 'FLAGGED', 'OUT_OF_STOCK',
      'AWAITING_KITCHEN_APPROVAL', 'APPROVED_BY_KITCHEN', 'KITCHEN_REJECTED',
      'CANCEL_REQUESTED'
    ));
END $$;

