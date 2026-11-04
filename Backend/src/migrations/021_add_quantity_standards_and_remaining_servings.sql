-- ============================================
-- MIGRATION: 021_add_quantity_standards_and_remaining_servings.sql
-- Description: Adds quantity_standard and remaining_servings columns to products,
--   adds approval tracking and servings_deducted flag to orders,
--   and expands orders status check to include AWAITING_KITCHEN_APPROVAL and KITCHEN_REJECTED.
-- ============================================

-- 1. Add quantity_standard and remaining_servings to products
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS quantity_standard INT NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS remaining_servings INT DEFAULT NULL;

-- 2. Seed / Update Authoritative Quantity Standards for all 41 products
-- Seafoods (Standard: 5)
UPDATE products SET quantity_standard = 5 WHERE id IN (
  'mixed-seafoods-alacarte-99', 'item-001',
  'mixed-seafoods-tub-189', 'item-002',
  'all-shrimp-alacarte-199', 'item-005',
  'all-shrimp-bowl-699', 'item-006',
  'mixed-seafoods-bowl-699', 'item-003',
  'all-shrimp-tray-1099', 'item-007',
  'mixed-seafoods-tray-1199', 'item-004'
) OR LOWER(name) LIKE '%shrimp%' OR LOWER(name) LIKE '%mixed seafood%';

-- Value Meals (Standard: 10)
UPDATE products SET quantity_standard = 10 WHERE id IN (
  'chicken-pastil-35', 'item-009',
  'fried-noodles-35', 'item-010',
  'chao-fan-35', 'item-008'
) OR LOWER(name) LIKE '%pastil%' OR LOWER(name) LIKE '%noodle%' OR LOWER(name) LIKE '%chao fan%';

-- Siomai (Standard: 20)
UPDATE products SET quantity_standard = 20 WHERE id IN (
  'pork-siomai-5', 'item-011',
  'beef-siomai-5', 'item-012',
  'chicken-siomai-5', 'item-013',
  'sharksfin-siomai-5', 'item-014',
  'japanese-siomai-6', 'item-015'
) OR LOWER(name) LIKE '%siomai%';

-- Add Ons
UPDATE products SET quantity_standard = 10 WHERE id IN ('corn-addon-20', 'item-033', 'rice-cup-20', 'item-032', 'special-sauce-addon-30', 'item-038', 'sausage-addon-50', 'item-039')
  OR LOWER(name) LIKE '%corn%' OR LOWER(name) LIKE '%rice%' OR LOWER(name) LIKE '%sauce%' OR LOWER(name) LIKE '%sausage%';

UPDATE products SET quantity_standard = 5 WHERE id IN ('shrimp-regular-addon-20', 'item-035', 'shrimp-jumbo-addon-30', 'item-036', 'tahong-addon-30', 'item-037')
  OR LOWER(name) LIKE '%tahong%';

-- Shake & Lemonade (Standard: 10)
UPDATE products SET quantity_standard = 10 WHERE id IN (
  'lemonade-small-40', 'item-025',
  'lemonade-big-50', 'item-026',
  'cucumber-lemonade-small-40', 'item-027',
  'cucumber-lemonade-big-50', 'item-028',
  'shake-small-40', 'item-024',
  'shake-big-50'
) OR LOWER(name) LIKE '%lemonade%' OR LOWER(name) LIKE '%shake%';

-- Desserts (Standard: 10)
UPDATE products SET quantity_standard = 10 WHERE id IN (
  'mango-pudding-50', 'item-031',
  'banana-con-yelo-50', 'item-029',
  'ice-cream-50', 'item-030'
) OR LOWER(name) LIKE '%pudding%' OR LOWER(name) LIKE '%con yelo%' OR LOWER(name) LIKE '%ice cream%';

-- Drinks
UPDATE products SET quantity_standard = 20 WHERE id IN (
  'mineral-water-15', 'item-016',
  'coke-mismo-25', 'item-017',
  'sprite-mismo-25', 'item-018',
  'royal-mismo-25', 'item-019'
) OR LOWER(name) LIKE '%mismo%' OR LOWER(name) LIKE '%mineral water%';

UPDATE products SET quantity_standard = 10 WHERE id IN (
  'house-iced-tea-glass-20', 'icetea-glass-20', 'item-034',
  'black-coffee-30', 'item-020'
) OR LOWER(name) LIKE '%black coffee%' OR (LOWER(name) LIKE '%iced tea%' AND LOWER(name) LIKE '%glass%');

UPDATE products SET quantity_standard = 5 WHERE id IN (
  'sprite-1-5l-100', 'item-022',
  'royal-1-5l-100', 'item-023',
  'house-iced-tea-pitcher-100', 'icetea-pitcher-100', 'item-040',
  'coke-1-5l-110', 'item-021'
) OR LOWER(name) LIKE '%1.5l%' OR LOWER(name) LIKE '%1.5 liters%' OR LOWER(name) LIKE '%pitcher%';

-- 3. Add approval columns and idempotency flag to orders
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS requires_kitchen_approval BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS kitchen_approval_status VARCHAR(30) NOT NULL DEFAULT 'NONE',
  ADD COLUMN IF NOT EXISTS kitchen_approved_at TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS kitchen_rejected_at TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS servings_deducted BOOLEAN NOT NULL DEFAULT FALSE;

-- 4. Update orders_status_check constraint to include AWAITING_KITCHEN_APPROVAL and KITCHEN_REJECTED
DO $$
BEGIN
  ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;
  ALTER TABLE orders ADD CONSTRAINT orders_status_check
    CHECK (status IN (
      'PENDING', 'IN_PROCESS', 'COMPLETED', 'CANCELLED', 'CONFIRMED',
      'PREPARING', 'READY', 'OUT_FOR_DELIVERY', 'GCASH_PENDING_APPROVAL',
      'GCASH_AUTHORIZED', 'RECEIPT_SUBMITTED', 'RECEIPT_REJECTED',
      'PENDING_COD', 'FLAGGED', 'OUT_OF_STOCK',
      'AWAITING_KITCHEN_APPROVAL', 'KITCHEN_REJECTED'
    ));
END $$;
