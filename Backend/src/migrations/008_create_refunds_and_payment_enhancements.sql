-- ==============================================================================
-- Migration: 008_create_refunds_and_payment_enhancements.sql
-- Description: Creates refunds table, links replacement items, adds receipt
--              columns, and backfills legacy refunds safely without data loss.
-- ==============================================================================

-- 1. Create dedicated refunds table for verifiable transaction tracking
CREATE TABLE IF NOT EXISTS refunds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id VARCHAR(100) NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
    payment_id UUID REFERENCES payments(id) ON DELETE RESTRICT,
    amount NUMERIC(10,2) NOT NULL CHECK (amount > 0),
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING'
        CHECK (status IN ('PENDING', 'COMPLETED', 'FAILED', 'CANCELLED', 'VOID')),
    reason VARCHAR(255) DEFAULT 'EXCESS_REPLACEMENT',
    reference_number VARCHAR(255),
    refund_receipt TEXT,
    is_legacy_backfill BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_refunds_order ON refunds(order_id);
CREATE INDEX IF NOT EXISTS idx_refunds_payment ON refunds(payment_id);
CREATE INDEX IF NOT EXISTS idx_refunds_status ON refunds(status);

-- Database-enforced safeguard: Only one active PENDING refund permitted per order at a time
CREATE UNIQUE INDEX IF NOT EXISTS uq_pending_order_refund
    ON refunds(order_id)
    WHERE status = 'PENDING';

-- 2. Extend payments table
ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS payment_type VARCHAR(50) DEFAULT 'INITIAL'
    CHECK (payment_type IN ('INITIAL', 'ADDITIONAL')),
  ADD COLUMN IF NOT EXISTS payment_receipt TEXT;

-- 3. Extend order_items table for non-destructive replacement history
ALTER TABLE order_items
  ADD COLUMN IF NOT EXISTS replacement_for_item_id BIGINT
    REFERENCES order_items(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_order_items_replacement
  ON order_items(replacement_for_item_id);

-- 4. Idempotent legacy refund backfill (Per Payment Record)
--    Distinguishes verified legacy payments from unverified ambiguous test records:
--    - Verified: Has paid_at OR reference_number -> Backfill as COMPLETED
--    - Ambiguous: paid_at IS NULL AND reference_number IS NULL -> Backfill as VOID (does not inject phantom cash outflows)
INSERT INTO refunds (
    order_id,
    payment_id,
    amount,
    status,
    reason,
    reference_number,
    is_legacy_backfill,
    created_at,
    completed_at
)
SELECT
    p.order_id,
    p.id AS payment_id,
    COALESCE(NULLIF(p.refunded_amount, 0), p.amount) AS amount,
    CASE
        WHEN p.paid_at IS NOT NULL OR p.reference_number IS NOT NULL THEN 'COMPLETED'
        ELSE 'VOID'
    END AS status,
    CASE
        WHEN p.paid_at IS NOT NULL OR p.reference_number IS NOT NULL THEN 'LEGACY_VERIFIED_REFUND'
        ELSE 'LEGACY_UNVERIFIED_CANCELLATION'
    END AS reason,
    p.reference_number,
    TRUE AS is_legacy_backfill,
    p.created_at,
    CASE
        WHEN p.paid_at IS NOT NULL OR p.reference_number IS NOT NULL THEN COALESCE(p.paid_at, p.created_at)
        ELSE NULL
    END AS completed_at
FROM payments p
WHERE (p.status = 'REFUNDED' OR COALESCE(p.refunded_amount, 0) > 0)
  AND NOT EXISTS (
      SELECT 1 FROM refunds r WHERE r.payment_id = p.id
  );
