-- ==============================================================================
-- Migration: 029_add_customer_name_to_orders.sql
-- Description: Adds customer_name column to orders table and backfills from customers
-- ==============================================================================

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS customer_name VARCHAR(255);

-- Backfill from customers table where available
UPDATE orders o
SET customer_name = c.fullname
FROM customers c
WHERE o.customer_id = c.id
  AND (o.customer_name IS NULL OR o.customer_name = '');
