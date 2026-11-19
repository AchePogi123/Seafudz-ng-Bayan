-- ============================================
-- MIGRATION: 039_remove_pay_in_store_status.sql
-- Description: Retires the "Pay in Store" online checkout option.
--
-- An online store pick-up used to be placeable now and settled in cash at the counter later,
-- which left the kitchen cooking food nobody had paid for. Every online order — delivery AND
-- store pick-up — is now prepaid by GCash, so 'PAY_IN_STORE' and 'PENDING_STORE_PICKUP' are no
-- longer statuses an order can hold. Any row still sitting in one is an unpaid order, so it is
-- moved to 'GCASH_AUTHORIZED', which is exactly that: placed, awaiting the customer's payment.
--
-- A cashier's own POS ticket is unaffected: it is rung up and paid at the counter in one go and
-- never passes through these statuses.
-- ============================================

DO $$
DECLARE
  moved INTEGER;
BEGIN
  UPDATE orders
     SET status = 'GCASH_AUTHORIZED', updated_at = NOW()
   WHERE status IN ('PAY_IN_STORE', 'PENDING_STORE_PICKUP');
  GET DIAGNOSTICS moved = ROW_COUNT;
  IF moved > 0 THEN
    RAISE NOTICE 'Moved % pay-in-store order(s) to GCASH_AUTHORIZED (awaiting GCash payment).', moved;
  END IF;

  UPDATE payments
     SET payment_method = 'GCASH', updated_at = NOW()
   WHERE UPPER(payment_method) IN ('PAY_IN_STORE', 'PENDING_STORE_PICKUP')
     AND status <> 'PAID';

  ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;
  ALTER TABLE orders ADD CONSTRAINT orders_status_check
    CHECK (status IN (
      'PENDING', 'IN_PROCESS', 'COMPLETED', 'CANCELLED', 'CONFIRMED',
      'PREPARING', 'READY', 'OUT_FOR_DELIVERY', 'GCASH_PENDING_APPROVAL',
      'GCASH_AUTHORIZED', 'RECEIPT_SUBMITTED', 'RECEIPT_REJECTED',
      'PENDING_COD',
      'FLAGGED', 'OUT_OF_STOCK',
      'AWAITING_KITCHEN_APPROVAL', 'APPROVED_BY_KITCHEN', 'KITCHEN_REJECTED',
      'CANCEL_REQUESTED'
    ));
END $$;
