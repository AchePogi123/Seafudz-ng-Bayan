-- MIGRATION: 031_remove_estimated_servings.sql
-- Description: Removes Estimated Servings columns (remaining_servings from products, servings_deducted from orders)

ALTER TABLE products DROP COLUMN IF EXISTS remaining_servings;
ALTER TABLE orders DROP COLUMN IF EXISTS servings_deducted;
