-- ==============================================================================
-- Migration: 028_add_delivery_proof_to_orders.sql
-- Description: Adds delivery_proof column to orders and deliveries tables
-- ==============================================================================

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS delivery_proof TEXT;

ALTER TABLE deliveries
  ADD COLUMN IF NOT EXISTS delivery_proof TEXT;

