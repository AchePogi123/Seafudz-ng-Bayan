-- ============================================
-- MIGRATION: 041_refund_accountability_and_retire_cod.sql
-- Description: Two related clean-ups around money that leaves the till.
--
-- 1. REFUND ACCOUNTABILITY.
--    A cancelled order that was already paid for is not finished when it is marked CANCELLED:
--    somebody still has to hand the money back. Until now the refunds ledger recorded the proof
--    (screenshot / reference) but not WHO returned it, so a sales report could show a cancelled
--    transaction with no way to tell whether the assistant or the cashier actually paid out.
--    `processed_by` / `processed_by_role` / `refund_method` close that gap, and a cash refund at
--    the counter (which has no screenshot to show) is now recorded as a named person's act.
--
-- 2. COD IS RETIRED.
--    Cash on Delivery was removed from the product: an online order is prepaid by GCash and a POS
--    ticket is paid at the counter. 'PENDING_COD' is therefore no longer a status an order can
--    hold, and 'COD' is no longer a payment method the reports should ever have to render.
--    Rows still carrying either are legacy: a PENDING_COD order was never paid, so it moves to
--    'GCASH_AUTHORIZED' (placed, awaiting the customer's payment), and a COD payment method
--    becomes 'CASH' — the money, if it ever arrived, arrived as cash.
-- ============================================

-- 1. Refund accountability columns
ALTER TABLE refunds
  ADD COLUMN IF NOT EXISTS processed_by VARCHAR(255),
  ADD COLUMN IF NOT EXISTS processed_by_role VARCHAR(50),
  ADD COLUMN IF NOT EXISTS refund_method VARCHAR(50);

COMMENT ON COLUMN refunds.processed_by IS 'Name of the staff member who handed the money back.';
COMMENT ON COLUMN refunds.processed_by_role IS 'Their role at the time: assistant, cashier or admin.';
COMMENT ON COLUMN refunds.refund_method IS 'How the money went back: GCASH (transfer, has proof) or CASH (over the counter).';

CREATE INDEX IF NOT EXISTS idx_refunds_processed_by_role ON refunds(processed_by_role);

-- A completed refund that nobody signed for predates this migration; it stays NULL and the
-- reports render it as "not recorded" rather than inventing an accountable name.

-- 2. Retire COD
DO $$
DECLARE
  moved INTEGER;
  remethoded INTEGER;
BEGIN
  UPDATE orders
     SET status = 'GCASH_AUTHORIZED', updated_at = NOW()
   WHERE UPPER(COALESCE(status, '')) = 'PENDING_COD';
  GET DIAGNOSTICS moved = ROW_COUNT;
  IF moved > 0 THEN
    RAISE NOTICE 'Moved % PENDING_COD order(s) to GCASH_AUTHORIZED (awaiting GCash payment).', moved;
  END IF;

  UPDATE orders
     SET payment_method = 'CASH', updated_at = NOW()
   WHERE UPPER(COALESCE(payment_method, '')) LIKE '%COD%';
  GET DIAGNOSTICS remethoded = ROW_COUNT;

  UPDATE payments
     SET payment_method = 'CASH'
   WHERE UPPER(COALESCE(payment_method, '')) LIKE '%COD%';

  IF remethoded > 0 THEN
    RAISE NOTICE 'Re-labelled % COD order(s) as CASH.', remethoded;
  END IF;

  ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;
  ALTER TABLE orders ADD CONSTRAINT orders_status_check
    CHECK (status IN (
      'PENDING', 'IN_PROCESS', 'COMPLETED', 'CANCELLED', 'CONFIRMED',
      'PREPARING', 'READY', 'OUT_FOR_DELIVERY', 'GCASH_PENDING_APPROVAL',
      'GCASH_AUTHORIZED', 'RECEIPT_SUBMITTED', 'RECEIPT_REJECTED',
      'FLAGGED', 'OUT_OF_STOCK',
      'AWAITING_KITCHEN_APPROVAL', 'APPROVED_BY_KITCHEN', 'KITCHEN_REJECTED',
      'CANCEL_REQUESTED'
    ));
END $$;
