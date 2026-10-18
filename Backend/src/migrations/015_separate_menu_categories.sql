-- ============================================
-- MIGRATION: Separate Menu Categories
-- Description: Separates combined categories (e.g. Value Meals & Add-ons,
--   Beverages & Shakes) into discrete, independent categories:
--   - Seafoods
--   - Value Meals
--   - Siomai
--   - Add Ons
--   - Shake & Lemonade
--   - Desserts
--   - Drinks
-- ============================================

-- 1. Ensure the 7 discrete categories exist
INSERT INTO categories (name, description) VALUES
('Seafoods', 'Signature Seafood Bilaos, Trays, Tubs, and Ala Carte Mixes'),
('Value Meals', 'Rice Bowls, Pastil, Chao Fan, and Value Meals'),
('Siomai', 'Steamed and Fried Dimsum Siomai Specials'),
('Add Ons', 'Sweet Corn, Extra Rice, Sauces, and Add-on Toppings'),
('Shake & Lemonade', 'Fresh Fruit Shakes and Lemonade Drinks'),
('Desserts', 'Sweet Treats, Mango Pudding, and Desserts'),
('Drinks', 'Refreshing Sodas, Bottled Water, Coffee, and Iced Tea')
ON CONFLICT (name) DO UPDATE SET description = EXCLUDED.description;

-- 2. Reassign products to Seafoods
UPDATE products SET category_id = (SELECT id FROM categories WHERE name = 'Seafoods')
WHERE id IN (
  'all-shrimp-alacarte-199', 'all-shrimp-bowl-699', 'all-shrimp-tray-1099',
  'mixed-seafoods-alacarte-99', 'mixed-seafoods-tub-189', 'mixed-seafoods-bowl-699', 'mixed-seafoods-tray-1199',
  'item-001', 'item-002', 'item-003', 'item-004', 'item-005', 'item-006', 'item-007'
) OR category_id IN (SELECT id FROM categories WHERE name IN ('Seafood Mixes', 'Shrimp Specials', 'Crabs & Shellfish'));

-- 3. Reassign products to Value Meals
UPDATE products SET category_id = (SELECT id FROM categories WHERE name = 'Value Meals')
WHERE id IN (
  'chicken-pastil-35', 'fried-noodles-35', 'chao-fan-35',
  'item-008', 'item-009', 'item-010'
) OR (id LIKE 'custom-%' AND LOWER(name) LIKE ANY(ARRAY['%pastil%', '%noodles%', '%chao fan%', '%silog%', '%rice bowl%']));

-- 4. Reassign products to Siomai
UPDATE products SET category_id = (SELECT id FROM categories WHERE name = 'Siomai')
WHERE id IN (
  'pork-siomai-5', 'beef-siomai-5', 'chicken-siomai-5', 'sharksfin-siomai-5', 'japanese-siomai-6',
  'item-011', 'item-012', 'item-013', 'item-014', 'item-015'
) OR LOWER(name) LIKE '%siomai%';

-- 5. Reassign products to Add Ons
UPDATE products SET category_id = (SELECT id FROM categories WHERE name = 'Add Ons')
WHERE id IN (
  'corn-addon-20', 'rice-cup-20', 'shrimp-regular-addon-20', 'shrimp-jumbo-addon-30', 'tahong-addon-30', 'sausage-addon-50', 'special-sauce-addon-30',
  'item-032', 'item-033', 'item-035', 'item-036', 'item-037', 'item-038', 'item-039'
);

-- 6. Reassign products to Shake & Lemonade
UPDATE products SET category_id = (SELECT id FROM categories WHERE name = 'Shake & Lemonade')
WHERE id IN (
  'lemonade-small-40', 'lemonade-big-50', 'cucumber-lemonade-small-40', 'cucumber-lemonade-big-50', 'shake-small-40', 'shake-big-50',
  'item-024', 'item-025', 'item-026', 'item-027', 'item-028'
) OR LOWER(name) LIKE '%shake%' OR LOWER(name) LIKE '%lemonade%';

-- 7. Reassign products to Desserts
UPDATE products SET category_id = (SELECT id FROM categories WHERE name = 'Desserts')
WHERE id IN (
  'mango-pudding-50', 'banana-con-yelo-50', 'ice-cream-50',
  'item-029', 'item-030', 'item-031'
) OR LOWER(name) LIKE '%pudding%' OR LOWER(name) LIKE '%yelo%' OR LOWER(name) LIKE '%ice cream%';

-- 8. Reassign products to Drinks
UPDATE products SET category_id = (SELECT id FROM categories WHERE name = 'Drinks')
WHERE id IN (
  'mineral-water-15', 'black-coffee-30', 'coke-mismo-25', 'coke-1-5l-110', 'sprite-mismo-25', 'sprite-1-5l-100', 'royal-mismo-25', 'royal-1-5l-100', 'icetea-glass-20', 'icetea-pitcher-100',
  'item-016', 'item-017', 'item-018', 'item-019', 'item-020', 'item-021', 'item-022', 'item-023', 'item-034', 'item-040'
);

-- 9. Delete old composite categories that have no products
DELETE FROM categories
WHERE name IN ('Value Meals & Add-ons', 'Beverages & Shakes', 'Seafood Mixes', 'Shrimp Specials', 'Crabs & Shellfish')
AND id NOT IN (SELECT DISTINCT category_id FROM products);
