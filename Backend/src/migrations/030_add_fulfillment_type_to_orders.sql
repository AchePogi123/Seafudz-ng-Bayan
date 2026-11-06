-- Migration: 030_add_fulfillment_type_to_orders.sql
-- Adds fulfillment_type column to orders table to support Online Store Pick-Up alongside Delivery.

ALTER TABLE orders ADD COLUMN IF NOT EXISTS fulfillment_type VARCHAR(20) DEFAULT 'DELIVERY';

-- Update existing orders to have explicit fulfillment_type
UPDATE orders
SET fulfillment_type = CASE
  WHEN UPPER(order_type) = 'ON_SITE' THEN 'ON_SITE'
  ELSE 'DELIVERY'
END
WHERE fulfillment_type IS NULL;

-- Create index for high-performance filtering by fulfillment_type
CREATE INDEX IF NOT EXISTS idx_orders_fulfillment_type ON orders(fulfillment_type);

