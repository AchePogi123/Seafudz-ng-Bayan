ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS customer_resolution VARCHAR(20),
  ADD COLUMN IF NOT EXISTS customer_resolution_status VARCHAR(30) NOT NULL DEFAULT 'NONE',
  ADD COLUMN IF NOT EXISTS customer_replacements JSONB NOT NULL DEFAULT '[]'::jsonb;

DO $$
BEGIN
  ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;
  ALTER TABLE orders ADD CONSTRAINT orders_status_check
    CHECK (status IN (
      'PENDING', 'IN_PROCESS', 'COMPLETED', 'CANCELLED', 'CONFIRMED',
      'PREPARING', 'READY', 'OUT_FOR_DELIVERY', 'GCASH_PENDING_APPROVAL',
      'GCASH_AUTHORIZED', 'RECEIPT_SUBMITTED', 'RECEIPT_REJECTED',
      'PENDING_COD', 'FLAGGED', 'OUT_OF_STOCK'
    ));
END $$;

ALTER TABLE orders
  DROP CONSTRAINT IF EXISTS orders_customer_resolution_check,
  ADD CONSTRAINT orders_customer_resolution_check
    CHECK (customer_resolution IS NULL OR customer_resolution IN ('REPLACE', 'REFUND'));

ALTER TABLE orders
  DROP CONSTRAINT IF EXISTS orders_customer_resolution_status_check,
  ADD CONSTRAINT orders_customer_resolution_status_check
    CHECK (customer_resolution_status IN ('NONE', 'AWAITING_CUSTOMER', 'PENDING_ASSISTANT', 'COMPLETED'));

ALTER TABLE orders
  DROP CONSTRAINT IF EXISTS orders_customer_replacements_check,
  ADD CONSTRAINT orders_customer_replacements_check
    CHECK (jsonb_typeof(customer_replacements) = 'array');
