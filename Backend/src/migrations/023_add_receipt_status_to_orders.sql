-- Migration 023: Add receipt printing status columns to orders
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS receipt_status VARCHAR(50) DEFAULT 'UNPRINTED',
ADD COLUMN IF NOT EXISTS is_receipt_printed BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS receipt_printed_at TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_orders_receipt_status ON orders(receipt_status);

